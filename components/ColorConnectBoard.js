import React, { useEffect, useMemo, useRef } from 'react';
import { View, Image, PanResponder, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { DOT_COLORS, walkBetween, isConnected } from '../utils/colorConnect';
import { DOT_IMAGES, NEON_CELL } from '../utils/colorConnectAssets';
import ConnectFX from './ColorConnectFX';

// The Color Connect grid: draws cells, lines and dots, and turns finger
// movement into cell events. It holds no game state — the screen passes the
// board in and gets back:
//   onDown(cell)  finger went down on a cell
//   onEnter(cell) finger moved onto a neighbouring cell (skipped cells from
//                 a fast swipe are replayed one by one, in order)
//   onUp()        finger lifted / gesture cancelled
// `size` is the board width in px; cells are size / n.
function ColorConnectBoard({
  n, dots, paths, size, disabled, activeColor, headCell, sparkles, winPulse, connects = [],
  onDown, onEnter, onUp,
}) {
  const cs = size / n;

  // PanResponder is created once, so it reads the latest props via a ref.
  const live = useRef({});
  live.current = { n, cs, disabled, onDown, onEnter, onUp };
  const touch = useRef({ originX: 0, originY: 0, last: -1 });

  const cellAt = (pageX, pageY) => {
    const { n: N, cs: C } = live.current;
    const x = pageX - touch.current.originX, y = pageY - touch.current.originY;
    if (x < 0 || y < 0 || x >= C * N || y >= C * N) return -1;
    return Math.floor(y / C) * N + Math.floor(x / C);
  };

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !live.current.disabled,
    onMoveShouldSetPanResponder: () => !live.current.disabled,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const { pageX, pageY, locationX, locationY } = e.nativeEvent;
      // locationX is only reliable on the first touch (it's relative to
      // whatever view is under the finger later), so pin the board's page
      // origin now and use pageX/pageY from then on.
      touch.current.originX = pageX - locationX;
      touch.current.originY = pageY - locationY;
      const cell = cellAt(pageX, pageY);
      touch.current.last = cell;
      if (cell >= 0) live.current.onDown(cell);
    },
    onPanResponderMove: (e) => {
      const cell = cellAt(e.nativeEvent.pageX, e.nativeEvent.pageY);
      const { last } = touch.current;
      if (cell < 0 || cell === last) return;
      touch.current.last = cell;
      if (last < 0) { live.current.onDown(cell); return; }
      for (const step of walkBetween(live.current.n, last, cell)) live.current.onEnter(step);
    },
    onPanResponderRelease: () => { touch.current.last = -1; live.current.onUp(); },
    onPanResponderTerminate: () => { touch.current.last = -1; live.current.onUp(); },
  }), []);

  const center = (cell) => [((cell % n) + 0.5) * cs, (Math.floor(cell / n) + 0.5) * cs];

  // One memoised layer per colour: applyDrag keeps the arrays of untouched
  // colours as-is, so while you drag only the line under your finger redraws.
  const lines = paths.map((p, k) => <LineLayer key={`l${k}`} path={p} color={k} n={n} cs={cs} />);

  // Which pairs are linked, as a string, so the ball layer only redraws
  // when a pair connects or breaks, not on every drag step.
  const doneKey = dots.map((d, k) => (isConnected(paths[k], d) ? '1' : '0')).join('');

  const head = activeColor != null && headCell != null ? center(headCell) : null;

  const pulseScale = winPulse
    ? winPulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.04, 1] })
    : 1;

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ scale: pulseScale }] }}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <CellLayer n={n} cs={cs} />
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          {lines}
        </Svg>
        {head && (
          <View style={{
            position: 'absolute', left: head[0] - cs * 0.7, top: head[1] - cs * 0.7, width: cs * 1.4, height: cs * 1.4,
            borderRadius: cs, backgroundColor: DOT_COLORS[activeColor], opacity: 0.22,
          }} />
        )}
        <DotLayer dots={dots} doneKey={doneKey} n={n} cs={cs} />
        {sparkles.map((sp) => (
          <Sparkle key={sp.id} x={center(sp.cell)[0]} y={center(sp.cell)[1]} color={DOT_COLORS[sp.color]} cs={cs} />
        ))}
        {connects.map((fx) => (
          <ConnectFX key={fx.id} path={fx.path} color={fx.color} n={n} cs={cs}
            linePath={roundedPath(fx.path.map(center), cs * 0.32)} />
        ))}
      </View>
      {/* Touch layer on top; everything under it ignores touches. */}
      <View style={StyleSheet.absoluteFill} {...responder.panHandlers} />
    </Animated.View>
  );
}

// One colour's neon tube: soft outer glow layers, a solid coloured tube and
// a bright near-white core, with rounded corners where the path turns.
const LineLayer = React.memo(function LineLayer({ path, color, n, cs }) {
  if (path.length < 2) return null;
  const d = roundedPath(path.map((cell) => [((cell % n) + 0.5) * cs, (Math.floor(cell / n) + 0.5) * cs]), cs * 0.32);
  const c = DOT_COLORS[color];
  const common = { d, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <>
      <Path {...common} stroke={c} strokeOpacity={0.1} strokeWidth={cs * 0.58} />
      <Path {...common} stroke={c} strokeOpacity={0.3} strokeWidth={cs * 0.32} />
      <Path {...common} stroke={c} strokeWidth={cs * 0.18} />
      <Path {...common} stroke="#FFFFFF" strokeOpacity={0.65} strokeWidth={cs * 0.07} />
    </>
  );
});

// The glossy balls, with a coloured halo once a pair is linked.
const DotLayer = React.memo(function DotLayer({ dots, doneKey, n, cs }) {
  const ball = cs * 0.52;
  return dots.map(([a, b], k) => {
    const done = doneKey[k] === '1';
    return [a, b].map((cell) => {
      const x = ((cell % n) + 0.5) * cs, y = (Math.floor(cell / n) + 0.5) * cs;
      return (
        <React.Fragment key={`d${cell}`}>
          {done && (
            <View style={{
              position: 'absolute', left: x - cs * 0.33, top: y - cs * 0.33, width: cs * 0.66, height: cs * 0.66,
              borderRadius: cs, backgroundColor: DOT_COLORS[k], opacity: 0.4,
            }} />
          )}
          <Image source={DOT_IMAGES[k]} fadeDuration={0}
            style={{ position: 'absolute', left: x - ball / 2, top: y - ball / 2, width: ball, height: ball }} />
        </React.Fragment>
      );
    });
  });
});

// SVG path through cell centres with each 90° turn rounded off by radius r
// (a quadratic curve that uses the corner as its control point).
function roundedPath(pts, r) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [x, y] = pts[i], [nx, ny] = pts[i + 1];
    const straight = (px === x && x === nx) || (py === y && y === ny);
    if (straight) { d += ` L${x},${y}`; continue; }
    const ax = x + Math.sign(px - x) * r, ay = y + Math.sign(py - y) * r;
    const bx = x + Math.sign(nx - x) * r, by = y + Math.sign(ny - y) * r;
    d += ` L${ax},${ay} Q${x},${y} ${bx},${by}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  return `${d} L${lx},${ly}`;
}

// The neon glass cell art tiled n×n. Memoised: it only changes with the grid
// size, not on every drag step.
const CellLayer = React.memo(function CellLayer({ n, cs }) {
  const cells = [];
  for (let i = 0; i < n * n; i++) {
    cells.push(
      <Image key={i} source={NEON_CELL} fadeDuration={0} resizeMode="stretch"
        style={{ position: 'absolute', left: (i % n) * cs, top: Math.floor(i / n) * cs, width: cs, height: cs }} />,
    );
  }
  return <>{cells}</>;
});

// A little burst of light where a pair was just connected.
const RAYS = 6;
function Sparkle({ x, y, color, cs }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [t]);
  const opacity = t.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] });
  const d = Math.max(4, cs * 0.16);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y }}>
      <Animated.View style={{
        position: 'absolute', left: -cs * 0.5, top: -cs * 0.5, width: cs, height: cs, borderRadius: cs,
        borderWidth: 2, borderColor: color, opacity,
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.6] }) }],
      }} />
      {Array.from({ length: RAYS }, (_, i) => {
        const a = (i / RAYS) * Math.PI * 2;
        const dist = t.interpolate({ inputRange: [0, 1], outputRange: [0, cs * 0.75] });
        return (
          <Animated.View key={i} style={{
            position: 'absolute', left: -d / 2, top: -d / 2, width: d, height: d, borderRadius: d,
            backgroundColor: i % 2 ? '#FFFFFF' : color, opacity,
            transform: [
              { translateX: Animated.multiply(dist, Math.cos(a)) },
              { translateY: Animated.multiply(dist, Math.sin(a)) },
            ],
          }} />
        );
      })}
    </View>
  );
}

export default React.memo(ColorConnectBoard);
