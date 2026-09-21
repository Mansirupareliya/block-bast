import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, Platform, KeyboardAvoidingView,
} from 'react-native';
import { playTap } from '../utils/audioManager';
import { NEON, glassPanel } from '../utils/theme';
import { getPlayerName, setPlayerName, sanitizeName, MAX_NAME_LENGTH } from '../utils/playerIdentity';
import { STORAGE_KEYS, loadNumber } from '../utils/storage';
import { submitProgress } from '../utils/leaderboardService';

export default function SettingsScreen({ onBack }) {
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getPlayerName().then(setName);
  }, []);

  const canSave = sanitizeName(name).length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    playTap();
    const clean = await setPlayerName(name);
    setName(clean);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);

    // Best-effort: for every game this player has already made progress in,
    // push the renamed row to that game's leaderboard right away instead of
    // waiting for their next win. Silently ignored per-game if the
    // leaderboard isn't configured or the player hasn't played it yet.
    const [matchmakerLevel, matchmakerScore, blockblastScore] = await Promise.all([
      loadNumber(STORAGE_KEYS.MATCHMAKER_MAX_UNLOCKED, 1),
      loadNumber(STORAGE_KEYS.MATCHMAKER_BEST_SCORE, 0),
      loadNumber(STORAGE_KEYS.BLOCKBLAST_BEST_SCORE, 0),
    ]);
    if (matchmakerLevel > 1 || matchmakerScore > 0) {
      submitProgress('matchmakerLeaderboard', { name: clean, maxLevel: matchmakerLevel, bestScore: matchmakerScore }).catch(() => {});
    }
    if (blockblastScore > 0) {
      submitProgress('blockblastLeaderboard', { name: clean, bestScore: blockblastScore }).catch(() => {});
    }
  };

  const statusH = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 54;

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: NEON.bg0 }]} />
      <View style={{ height: statusH }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => { playTap(); onBack(); }} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.content}>
          <Text style={styles.label}>Display Name</Text>
          <Text style={styles.sub}>Shown on the Matchmaker leaderboard to every player.</Text>

          <View style={[styles.inputWrap, glassPanel()]}>
            <TextInput
              value={name}
              onChangeText={(t) => setName(t.slice(0, MAX_NAME_LENGTH))}
              placeholder="Your name"
              placeholderTextColor={NEON.textFaint}
              style={styles.input}
              maxLength={MAX_NAME_LENGTH}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
            <Text style={styles.counter}>{name.length}/{MAX_NAME_LENGTH}</Text>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnTxt}>{saved ? 'Saved ✓' : 'Save Name'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: NEON.glassFill, borderWidth: 1, borderColor: NEON.glassBorder,
  },
  backArrow: { fontSize: 18, color: '#FFFFFF', fontWeight: '800' },
  title: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },

  content: { paddingHorizontal: 20, paddingTop: 24 },
  label: { fontSize: 15, fontWeight: '700', color: NEON.textPrimary, marginBottom: 4 },
  sub: { fontSize: 12, color: NEON.textDim, marginBottom: 16 },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, paddingHorizontal: 14, marginBottom: 18,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
  counter: { fontSize: 11, color: NEON.textFaint, marginLeft: 8 },

  saveBtn: {
    backgroundColor: NEON.cyan, borderRadius: 14, paddingVertical: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnTxt: { fontSize: 15, fontWeight: '800', color: '#0B0B1A' },
});
