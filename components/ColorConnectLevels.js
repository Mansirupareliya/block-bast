import React, { useMemo, useRef, useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Circle, G } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './AppText';
import { LEVEL_FONT } from '../utils/fonts';

// Color Connect level select: a cream card with a wooden rim and a ribbon
// header, 20 levels per page (4 × 5) that you swipe through, page dots
// underneath. Each level is a glossy rounded tile with a star plate:
//   blue  = solved (gold stars = stars earned)
//   green = the level to play next
//   grey + padlock = locked
// The page with the next level is shown first.
const COLS = 4;
const ROWS = 5;
const PER_PAGE = COLS * ROWS;

const FACE = {
  solved: { colors: ['#6FE6FF', '#22B4F7', '#0B8DE8'], base: '#0A64B8', stroke: '#0A5AA8' },
  current: { colors: ['#A8F56E', '#4FCB22', '#2C9F10'], base: '#1F7A0A', stroke: '#1A6E08' },
  open: { colors: ['#6FE6FF', '#22B4F7', '#0B8DE8'], base: '#0A64B8', stroke: '#0A5AA8' },
  locked: { colors: ['#B9CCD8', '#8DA6B6', '#6F8999'], base: '#4D6575', stroke: '#4D6575' },
};

export default function ColorConnectLevels({
  levelCount, stars, maxUnlocked, current, onPick, onLocked, onBack,
}) {
  const insets = useSafeAreaInsets();
  const pages = Math.ceil(levelCount / PER_PAGE);
  const startPage = Math.min(pages - 1, Math.floor((current - 1) / PER_PAGE));
  const [page, setPage] = useState(startPage);
  const [area, setArea] = useState(null); // grid area { w, h }
  const scroller = useRef(null);
  const placed = useRef(false);

  const starTotal = Object.values(stars).reduce((a, b) => a + b, 0);

  // Tile size from the room the card actually has, so all 5 rows fit on any
  // phone. A row is the tile plus its star plate (0.3 × tile) and a gap.
  const tile = area
    ? Math.floor(Math.min((area.w - 24 - (COLS - 1) * 12) / COLS, (area.h - (ROWS - 1) * 8) / ROWS / 1.32, 96))
    : 0;

  const pageNums = useMemo(() => Array.from({ length: pages }, (_, p) => {
    const nums = [];
    for (let i = p * PER_PAGE + 1; i <= Math.min(levelCount, (p + 1) * PER_PAGE); i++) nums.push(i);
    return nums;
  }), [pages, levelCount]);

  const goTo = (p) => {
    if (!area) return;
    scroller.current?.scrollTo({ x: p * area.w, animated: true });
    setPage(p);
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + 10 }]}>
      {/* Top: back button, stars earned */}
      <View style={s.topRow}>
        <SquareButton onPress={onBack}>
          <Svg width={28} height={28} viewBox="0 0 34 34">
            <Path d="M15 6 L4 17 L15 28 L15 21 L29 21 L29 13 L15 13 Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={3} strokeLinejoin="round" />
          </Svg>
        </SquareButton>
        <View style={s.pill}>
          <View style={s.pillIcon}><StarIcon size={40} on /></View>
          <Text style={s.pillTxt}>{starTotal}</Text>
        </View>
      </View>

      {/* Wooden-rimmed card */}
      <View style={s.cardWrap}>
        <View style={s.wood}>
          <LinearGradient colors={['#FFF6E6', '#FCEBD2', '#F8E0BF']} style={s.card}>
            <View
              style={s.gridArea}
              onLayout={(e) => {
                const { width: w, height: h } = e.nativeEvent.layout;
                setArea({ w, h });
              }}
            >
              {area && (
                <ScrollView
                  ref={scroller}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onContentSizeChange={() => {
                    if (placed.current) return;
                    placed.current = true;
                    scroller.current?.scrollTo({ x: startPage * area.w, animated: false });
                  }}
                  onScroll={(e) => {
                    const p = Math.round(e.nativeEvent.contentOffset.x / area.w);
                    if (p !== page) setPage(p);
                  }}
                  scrollEventThrottle={64}
                >
                  {pageNums.map((nums, p) => (
                    <View key={p} style={[s.page, { width: area.w, height: area.h }]}>
                      {/* Only this page and its neighbours are built, so the
                          screen opens fast; others fill in as you swipe. */}
                      {Math.abs(p - page) <= 1 && nums.map((num) => {
                        const st = stars[num] ? 'solved' : num === current ? 'current' : num <= maxUnlocked ? 'open' : 'locked';
                        return (
                          <LevelTile
                            key={num} num={num} state={st} stars={stars[num] || 0} size={tile}
                            onPress={() => (st === 'locked' ? onLocked() : onPick(num))}
                          />
                        );
                      })}
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Page dots */}
            <View style={s.dots}>
              {pageNums.map((_, p) => (
                <Pressable key={p} onPress={() => goTo(p)} hitSlop={6}>
                  <View style={[s.dot, p === page && s.dotOn]} />
                </Pressable>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* Ribbon header */}
        <View style={s.ribbonWrap} pointerEvents="none">
          <View style={s.ribbonBase} />
          <LinearGradient colors={['#FF7E98', '#FB4F72', '#EC3459']} style={s.ribbon}>
            <View style={s.ribbonShine} />
            <Text style={s.ribbonTxt}>LEVEL SELECT</Text>
          </LinearGradient>
        </View>
      </View>

    </View>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────
const LevelTile = React.memo(function LevelTile({ num, state, stars, size, onPress }) {
  const f = FACE[state];
  const r = size * 0.34;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.tileCell, { width: size }, pressed && { transform: [{ scale: 0.92 }] }]}>
      {/* White rim with a soft shadow, glossy face inside */}
      <View style={[s.rim, { width: size, height: size, borderRadius: r + 4 }]}>
        <View style={{ flex: 1, borderRadius: r, backgroundColor: f.base, paddingBottom: size * 0.06 }}>
          <LinearGradient colors={f.colors} style={[s.face, { borderRadius: r }]}>
            <View style={[s.faceShine, { borderRadius: r, height: size * 0.3 }]} />
            {state === 'locked'
              ? <LockIcon size={size * 0.44} />
              : <NumText size={size * 0.42} stroke={f.stroke}>{num}</NumText>}
          </LinearGradient>
        </View>
      </View>
      {/* Star plate */}
      <View style={[s.plate, { width: size * 0.92, height: size * 0.3, borderRadius: size * 0.1, marginTop: -size * 0.04 }]}>
        <StarRow size={size * 0.26} count={stars} />
      </View>
    </Pressable>
  );
});

// White number with a coloured outline (RN Text has no stroke, so the
// outline is the same text stacked at small offsets behind it).
function NumText({ children, size, stroke }) {
  const w = Math.max(1.5, size * 0.07);
  // 4 diagonal copies + a drop below read as a full outline at this size.
  const offs = [[-w, -w], [w, -w], [-w, w], [w, w], [0, w * 1.8]];
  const base = { ...LEVEL_FONT, fontSize: size, textAlign: 'center' };
  return (
    <View>
      {offs.map(([dx, dy], i) => (
        <Text key={i} style={[base, { position: 'absolute', left: dx, right: -dx, top: dy, color: stroke }]}>{children}</Text>
      ))}
      <Text style={[base, { color: '#FFFFFF' }]}>{children}</Text>
    </View>
  );
}

function starPath(cx, cy, R, rr) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? rr : R;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    d += `${i ? 'L' : 'M'}${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)} `;
  }
  return `${d}Z`;
}
const STAR = starPath(20, 21.5, 15, 7.5);

function StarIcon({ size, on }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      {on ? (
        <>
          <Path d={STAR} fill="#E88A00" stroke="#E88A00" strokeWidth={5} strokeLinejoin="round" transform="translate(0 1.5)" />
          <Path d={STAR} fill="#FFD21F" stroke="#FFB800" strokeWidth={3.5} strokeLinejoin="round" />
          <Path d={starPath(20, 22, 7, 3.5)} fill="#FFF1A0" fillOpacity={0.8} />
        </>
      ) : (
        <Path d={STAR} fill="#A9D4F2" stroke="#BFE0F7" strokeWidth={3.5} strokeLinejoin="round" />
      )}
    </Svg>
  );
}

// Three stars in a single Svg (one native view instead of three).
const StarRow = React.memo(function StarRow({ size, count }) {
  return (
    <Svg width={size * 3} height={size} viewBox="0 0 120 40">
      {[0, 1, 2].map((i) => (
        <G key={i} transform={`translate(${i * 40} 0)`}>
          {i < count ? (
            <>
              <Path d={STAR} fill="#E88A00" stroke="#E88A00" strokeWidth={5} strokeLinejoin="round" transform="translate(0 1.5)" />
              <Path d={STAR} fill="#FFD21F" stroke="#FFB800" strokeWidth={3.5} strokeLinejoin="round" />
            </>
          ) : (
            <Path d={STAR} fill="#A9D4F2" stroke="#BFE0F7" strokeWidth={3.5} strokeLinejoin="round" />
          )}
        </G>
      ))}
    </Svg>
  );
});

function LockIcon({ size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Path d="M12 18 V13 a8 8 0 0 1 16 0 V18" fill="none" stroke="#FFFFFF" strokeWidth={4.5} strokeLinecap="round" />
      <Rect x="7" y="17" width="26" height="20" rx="6" fill="#FFFFFF" />
      <Circle cx="20" cy="25.5" r="3.2" fill="#6F8999" />
      <Rect x="18.6" y="26" width="2.8" height="6" rx="1.4" fill="#6F8999" />
    </Svg>
  );
}

function SquareButton({ children, onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      {({ pressed }) => (
        <View style={[s.sqRim, pressed && { transform: [{ scale: 0.92 }] }]}>
          <View style={{ flex: 1, borderRadius: 15, backgroundColor: '#0A64B8', paddingBottom: 4 }}>
            <LinearGradient colors={['#6FE6FF', '#22B4F7', '#0B8DE8']} style={[s.face, { borderRadius: 15 }]}>
              <View style={[s.faceShine, { borderRadius: 15, height: 16 }]} />
              {children}
            </LinearGradient>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  pill: {
    flexDirection: 'row', alignItems: 'center', height: 40, paddingRight: 16, paddingLeft: 46, borderRadius: 20,
    backgroundColor: '#EAF6FF', borderWidth: 2, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  pillIcon: { position: 'absolute', left: -6, top: -6, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  pillTxt: { ...LEVEL_FONT, fontSize: 22, color: '#1279D6' },

  cardWrap: { flex: 1, paddingHorizontal: 14, paddingTop: 22, paddingBottom: 14 },
  wood: {
    flex: 1, borderRadius: 30, padding: 7, backgroundColor: '#B5602A',
    borderWidth: 3, borderColor: '#8A4019',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  card: { flex: 1, borderRadius: 22, paddingTop: 44, paddingBottom: 10, borderWidth: 3, borderColor: '#FFF9EF' },
  gridArea: { flex: 1 },
  page: { flexDirection: 'row', flexWrap: 'wrap', alignContent: 'space-around', justifyContent: 'space-around', paddingHorizontal: 12 },
  tileCell: { alignItems: 'center' },
  rim: {
    padding: 4, backgroundColor: '#FFFFFF',
    shadowColor: '#7A4A20', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  face: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  faceShine: { position: 'absolute', top: 3, left: 5, right: 5, backgroundColor: 'rgba(255,255,255,0.3)' },
  plate: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E6F4FF', borderWidth: 2, borderColor: '#FFFFFF',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 8 },
  dot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#E5B98A', borderWidth: 2, borderColor: '#D9A672' },
  dotOn: { backgroundColor: '#3FC51C', borderColor: '#FFFFFF', borderWidth: 3 },

  ribbonWrap: { position: 'absolute', top: 0, left: '18%', right: '18%', alignItems: 'center' },
  ribbonBase: { position: 'absolute', top: 6, left: 4, right: 4, height: 54, borderRadius: 18, backgroundColor: '#B81F42' },
  ribbon: {
    alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', height: 52,
    borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 30, borderBottomRightRadius: 30,
    borderWidth: 2, borderColor: '#FFA3B6',
  },
  ribbonShine: { position: 'absolute', top: 4, left: 12, right: 12, height: 14, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.3)' },
  ribbonTxt: {
    ...LEVEL_FONT, fontSize: 24, color: '#FFFFFF', letterSpacing: 1,
    textShadowColor: '#A0153A', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1,
  },

  sqRim: {
    width: 54, height: 54, padding: 4, borderRadius: 19, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
});
