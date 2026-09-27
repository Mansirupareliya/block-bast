import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, Modal, ScrollView, Animated,
  FlatList, ActivityIndicator,
} from 'react-native';
import { playTap } from '../utils/audioManager';
import { NEON } from '../utils/theme';
import { LEVEL_FONT } from '../utils/fonts';
import { isFirebaseConfigured } from '../utils/firebase';
import { subscribeLeaderboard } from '../utils/leaderboardService';
import { getDeviceId } from '../utils/playerIdentity';
import {
  BADGES, badgeForStreak, coinsForDay,
  liveStreak, subscribeStreak, syncStreak, takeLastReward,
} from '../utils/dailyStreak';

const COIN_IMG = require('../assets/coin.png');

export function Coin({ size = 14 }) {
  return <Image source={COIN_IMG} style={{ width: size, height: size }} resizeMode="contain" />;
}

function useStreak() {
  const [s, setS] = useState(null);
  useEffect(() => subscribeStreak(setS), []);
  return s;
}

// ── Home header widget: current badge, streak days, coin balance ──────────
// Tapping the badge opens the badge list; tapping the coins opens the coin
// leaderboard.
export default function StreakBadge({ style }) {
  const s = useStreak();
  const [open, setOpen] = useState(null); // null | 'badges' | 'coins'
  const [reward, setReward] = useState(0);
  const pop = useRef(new Animated.Value(0)).current;

  const streak = s ? liveStreak(s) : 0;
  const badge = badgeForStreak(streak);

  // Coins earned since Home was last shown float up once as "+N".
  useEffect(() => {
    if (!s) return;
    const r = takeLastReward();
    if (!r) return;
    setReward(r);
    pop.setValue(0);
    Animated.sequence([
      Animated.timing(pop, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(pop, { toValue: 2, duration: 400, useNativeDriver: true }),
    ]).start(() => setReward(0));
  }, [s?.lastReward]);

  return (
    <View style={[styles.widget, style]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => { playTap(); setOpen('badges'); }}
        hitSlop={{ top: 8, left: 8, right: 8 }}
      >
        <Image
          source={(badge ?? BADGES[0]).image}
          style={[styles.widgetBadge, !badge && styles.locked]}
          resizeMode="contain"
        />
        <View style={[styles.daysPill, { borderColor: badge?.color ?? NEON.textFaint }]}>
          <Text style={styles.daysTxt}>{streak} {streak === 1 ? 'DAY' : 'DAYS'}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.coinPill}
        activeOpacity={0.8}
        onPress={() => { playTap(); setOpen('coins'); }}
        hitSlop={{ bottom: 8, left: 8, right: 8 }}
      >
        <Coin size={18} />
        <Text style={styles.coinTxt}>{s?.coins ?? 0}</Text>
      </TouchableOpacity>

      {reward > 0 && (
        <Animated.View pointerEvents="none" style={[styles.rewardPop, {
          opacity: pop.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }),
          transform: [{ translateY: pop.interpolate({ inputRange: [0, 1, 2], outputRange: [8, 0, -10] }) }],
        }]}>
          <Text style={styles.rewardTxt}>+{reward}</Text>
          <Coin size={14} />
        </Animated.View>
      )}

      <BadgeListModal visible={open === 'badges'} onClose={() => setOpen(null)} streakState={s} />
      <CoinLeaderboardModal visible={open === 'coins'} onClose={() => setOpen(null)} />
    </View>
  );
}

// ── Popup: every player's coin balance, richest first ──────────────────────
const MEDALS = ['🥇', '🥈', '🥉'];

const EMPTY_MESSAGES = {
  unconfigured: 'Leaderboard server is not connected yet.',
  error: "Couldn't load the leaderboard. Check your connection.",
  ready: 'No players yet. Play a game to get on the board!',
};

function CoinLeaderboardModal({ visible, onClose }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error | unconfigured
  const [myId, setMyId] = useState(null);

  useEffect(() => {
    if (!visible) return;
    if (!isFirebaseConfigured) { setStatus('unconfigured'); return; }
    setStatus('loading');
    getDeviceId().then(setMyId);
    // Push this device's latest coins/name first so the player sees themself.
    syncStreak();
    return subscribeLeaderboard(
      'playerStreaks',
      ['coins', 'streak'],
      (data) => { setRows(data); setStatus('ready'); },
      () => setStatus('error'),
    );
  }, [visible]);

  let body;
  if (status === 'loading') {
    body = <ActivityIndicator size="large" color="#FFC21A" style={{ marginVertical: 40 }} />;
  } else if (status !== 'ready' || rows.length === 0) {
    body = <Text style={styles.emptyTxt}>{EMPTY_MESSAGES[status]}</Text>;
  } else {
    body = (
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        style={{ flexGrow: 0 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => {
          const isMe = item.id === myId;
          const b = badgeForStreak(item.streak ?? 0);
          return (
            <View style={[styles.lbRow, isMe && styles.lbRowMe]}>
              <View style={styles.lbRank}>
                {index < 3
                  ? <Text style={styles.lbMedal}>{MEDALS[index]}</Text>
                  : <Text style={styles.lbRankTxt}>{index + 1}</Text>}
              </View>
              {b && <Image source={b.image} style={styles.lbBadge} resizeMode="contain" />}
              <Text style={styles.lbName} numberOfLines={1}>
                {item.name || 'Player'}{isMe ? ' (You)' : ''}
              </Text>
              <Coin size={18} />
              <Text style={styles.lbCoins}>{item.coins ?? 0}</Text>
            </View>
          );
        }}
      />
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={[styles.coinRow, { gap: 8 }]}>
              <Coin size={26} />
              <Text style={styles.sheetTitle}>Coin Leaderboard</Text>
            </View>
            <TouchableOpacity onPress={() => { playTap(); onClose(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>
          {body}
        </View>
      </View>
    </Modal>
  );
}

// ── Popup: every badge with its day range and how close the player is ─────
function BadgeListModal({ visible, onClose, streakState }) {
  const streak = streakState ? liveStreak(streakState) : 0;
  const current = badgeForStreak(streak);
  const nextCoins = coinsForDay(streak + 1);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Daily Streak Badges</Text>
            <TouchableOpacity onPress={() => { playTap(); onClose(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Summary */}
          <View style={styles.summary}>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryNum}>{streak}</Text>
              <Text style={styles.summaryLbl}>day streak</Text>
            </View>
            <View style={styles.summaryCell}>
              <View style={styles.coinRow}>
                <Coin size={16} />
                <Text style={styles.summaryNum}>{streakState?.coins ?? 0}</Text>
              </View>
              <Text style={styles.summaryLbl}>coins</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryNum}>{streakState?.bestStreak ?? 0}</Text>
              <Text style={styles.summaryLbl}>best streak</Text>
            </View>
          </View>
          <Text style={styles.hint}>
            Play any game every day to grow your streak. Next day pays {nextCoins} coins.
          </Text>

          <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
            {BADGES.map((b) => {
              const unlocked = streak >= b.minDays;
              const isCurrent = current?.id === b.id;
              return (
                <View
                  key={b.id}
                  style={[styles.row, isCurrent && { borderColor: b.color, backgroundColor: b.color + '22' }]}
                >
                  <Image source={b.image} style={[styles.rowBadge, !unlocked && styles.locked]} resizeMode="contain" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowName, { color: unlocked ? b.color : NEON.textDim }]}>{b.name}</Text>
                  </View>
                  <Text style={[styles.rowStatus, { color: isCurrent ? b.color : unlocked ? '#7CFFB2' : NEON.textFaint }]}>
                    {isCurrent ? 'CURRENT' : unlocked ? 'UNLOCKED' : `${b.minDays - streak} days to go`}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  widget: { alignItems: 'center', width: 80 },
  widgetBadge: { width: 58, height: 58 },
  locked: { opacity: 0.35 },
  daysPill: {
    position: 'absolute', bottom: -4, alignSelf: 'center',
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 9, borderWidth: 1,
    backgroundColor: 'rgba(5,5,20,0.85)',
  },
  daysTxt: { color: '#FFFFFF', fontSize: 10, ...LEVEL_FONT },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  coinPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8,
    paddingLeft: 2, paddingRight: 8, paddingVertical: 2,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,194,26,0.6)',
    backgroundColor: 'rgba(5,5,20,0.75)',
  },
  coinTxt: { color: '#FFD23F', fontSize: 14, ...LEVEL_FONT },
  rewardPop: {
    position: 'absolute', bottom: -22,
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  rewardTxt: { color: '#7CFFB2', fontSize: 13, ...LEVEL_FONT },

  emptyTxt: { color: NEON.textDim, fontSize: 13, textAlign: 'center', marginVertical: 30 },
  lbRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 10, marginBottom: 6,
    borderRadius: 12, borderWidth: 1, borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  lbRowMe: { borderColor: '#FFC21A', backgroundColor: 'rgba(255,194,26,0.12)' },
  lbRank: { width: 28, alignItems: 'center' },
  lbMedal: { fontSize: 20 },
  lbRankTxt: { color: NEON.textDim, fontSize: 14, ...LEVEL_FONT },
  lbBadge: { width: 28, height: 28 },
  lbName: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  lbCoins: { color: '#FFD23F', fontSize: 15, minWidth: 40, textAlign: 'right', ...LEVEL_FONT },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  sheet: {
    width: '100%', maxWidth: 420, maxHeight: '88%',
    backgroundColor: NEON.bg1, borderRadius: 20,
    borderWidth: 1.5, borderColor: NEON.glassBorder,
    padding: 16,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { color: '#FFFFFF', fontSize: 18, ...LEVEL_FONT },
  closeTxt: { color: NEON.textDim, fontSize: 18, fontWeight: '900' },

  summary: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  summaryCell: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    backgroundColor: NEON.bg2, borderRadius: 12,
  },
  summaryNum: { color: '#FFFFFF', fontSize: 18, ...LEVEL_FONT },
  summaryLbl: { color: NEON.textDim, fontSize: 10, fontWeight: '700', marginTop: 2 },
  hint: { color: NEON.textDim, fontSize: 11, textAlign: 'center', marginBottom: 12 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 6, paddingHorizontal: 8, marginBottom: 6,
    borderRadius: 12, borderWidth: 1, borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  rowBadge: { width: 52, height: 52 },
  rowName: { fontSize: 15, fontWeight: '900' },
  rowStatus: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
});
