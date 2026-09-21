import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, FlatList, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { playTap } from '../utils/audioManager';
import { isFirebaseConfigured } from '../utils/firebase';
import { subscribeLeaderboard } from '../utils/leaderboardService';
import { getDeviceId } from '../utils/playerIdentity';

// Same glossy cartoon bubble button recipe as Matchmaker's own CartoonButton
// (components/GameHeader.js documents the shared language) — duplicated
// locally rather than imported since Matchmaker's version isn't exported.
function CartoonButton({ size = 44, onPress, children, style }) {
  const borderW = Math.max(3, size * 0.06);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }} style={style}>
      <LinearGradient
        colors={['#FFE27A', '#FFC93C', '#B9782E']}
        style={{
          width: size, height: size, borderRadius: size / 2,
          borderWidth: borderW, borderColor: '#7A4A18',
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5,
        }}
      >
        <View style={{
          position: 'absolute', top: size * 0.1, left: size * 0.12,
          width: size * 0.38, height: size * 0.22, borderRadius: size * 0.18,
          backgroundColor: 'rgba(255,255,255,0.55)', transform: [{ rotate: '-18deg' }],
        }} />
        {children}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

function LeaderboardRow({ item, rank, isMe, showStage }) {
  return (
    <View style={[styles.row, isMe && styles.rowMe]}>
      <View style={styles.rankWrap}>
        {rank <= 3 ? (
          <Text style={styles.medal}>{MEDALS[rank - 1]}</Text>
        ) : (
          <Text style={styles.rankNum}>{rank}</Text>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {item.name || 'Player'}{isMe ? ' (You)' : ''}
      </Text>
      {showStage && (
        <View style={styles.stagePill}>
          <Text style={styles.stagePillTxt}>Stage {item.maxLevel ?? 1}</Text>
        </View>
      )}
      <Text style={styles.score}>{item.bestScore ?? 0}</Text>
    </View>
  );
}

// Reusable across every game's leaderboard — pass the Firestore collection
// name and the ranking fields (see utils/leaderboardService.js) for that
// game. `showStage` hides the "Stage N" pill for games with no discrete
// levels (e.g. Block Blast, which only tracks a running high score).
export default function LeaderboardScreen({
  onBack, collectionName, sortFields, title = 'Leaderboard', showStage = true,
}) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState(isFirebaseConfigured ? 'loading' : 'unconfigured'); // loading | ready | error | unconfigured
  const [myDeviceId, setMyDeviceId] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    getDeviceId().then(setMyDeviceId);

    const unsubscribe = subscribeLeaderboard(
      collectionName,
      sortFields,
      (data) => { setRows(data); setStatus('ready'); },
      () => { setStatus('error'); },
    );
    return unsubscribe;
  }, [collectionName, sortFields]);

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor="transparent" barStyle="dark-content" translucent />

      <View style={styles.header}>
        <CartoonButton size={44} onPress={() => { playTap(); onBack(); }}>
          <Text style={styles.backArrow}>←</Text>
        </CartoonButton>
        <Text style={styles.title}>{title}</Text>
        <View style={{ width: 44 }} />
      </View>

      {status === 'unconfigured' && (
        <View style={styles.center}>
          <Text style={styles.centerIcon}>🏆</Text>
          <Text style={styles.centerTitle}>Leaderboard coming soon</Text>
          <Text style={styles.centerSub}>This app hasn't connected a leaderboard server yet.</Text>
        </View>
      )}

      {status === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#B8722E" />
        </View>
      )}

      {status === 'error' && (
        <View style={styles.center}>
          <Text style={styles.centerIcon}>⚠️</Text>
          <Text style={styles.centerTitle}>Couldn't load leaderboard</Text>
          <Text style={styles.centerSub}>Check your connection and try again later.</Text>
        </View>
      )}

      {status === 'ready' && (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <LeaderboardRow item={item} rank={index + 1} isMe={item.id === myDeviceId} showStage={showStage} />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.centerIcon}>🎮</Text>
              <Text style={styles.centerTitle}>No players yet</Text>
              <Text style={styles.centerSub}>Be the first on the board!</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FBE4C4' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingHorizontal: 20, paddingBottom: 12,
  },
  backArrow: { fontSize: 20, color: '#5A3410', fontWeight: '900', marginTop: -2 },
  title: { fontSize: 22, fontWeight: '900', color: '#5A3410' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  centerIcon: { fontSize: 44, marginBottom: 10 },
  centerTitle: { fontSize: 17, fontWeight: '800', color: '#5A3410', marginBottom: 4, textAlign: 'center' },
  centerSub: { fontSize: 13, color: '#7A5A38', textAlign: 'center' },

  listContent: { paddingHorizontal: 16, paddingBottom: 30 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF6E4', borderWidth: 1.5, borderColor: '#D9BE94',
    borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 8,
  },
  rowMe: { borderColor: '#B8722E', borderWidth: 2, backgroundColor: '#FFE9BF' },
  rankWrap: { width: 32, alignItems: 'center' },
  medal: { fontSize: 20 },
  rankNum: { fontSize: 15, fontWeight: '800', color: '#7A5A38' },
  name: { flex: 1, fontSize: 14, fontWeight: '700', color: '#5A3410', marginHorizontal: 8 },
  stagePill: {
    backgroundColor: '#F0A868', borderWidth: 1.5, borderColor: '#B8722E',
    borderRadius: 12, paddingVertical: 3, paddingHorizontal: 9, marginRight: 8,
  },
  stagePillTxt: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  score: { fontSize: 13, fontWeight: '800', color: '#7A5A38', minWidth: 44, textAlign: 'right' },
});
