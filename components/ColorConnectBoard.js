import React, { useEffect, useMemo, useRef } from 'react';
import { View, PanResponder, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Rect, Line, Circle, Polyline, Defs, RadialGradient, Stop } from 'react-native-svg';
import { DOT_COLORS, walkBetween, isConnected } from '../utils/colorConnect';

// The Color Connect grid: draws cells, lines and dots, and turns finger
// movement into cell events. It holds no game state — the screen passes the
// board in and gets back:
//   onDown(cell)  finger went down on a cell
//   onEnter(cell) finger moved onto a neighbouring cell (skipped cells from
//                 a fast swipe are replayed one by one, in order)
//   onUp()        finger lifted / gesture cancelled
// `size` is the board width in px; cells are size / n.
function ColorConnectBoard({
  n, dots, paths, size, disabled, activeColor, headCell, sparkles, winPulse,
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

  const tint = [];
  paths.forEach((p, k) => p.forEach((cell) => {
    tint.push(
      <Rect key={`t${cell}`} x={(cell % n) * cs} y={Math.floor(cell / n) * cs} width={cs} height={cs}
        fill={DOT_COLORS[k]} fillOpacity={0.2} />,
    );
  }));

  const grid = [];
  for (let i = 1; i < n; i++) {
    grid.push(<Line key={`h${i}`} x1={0} y1={i * cs} x2={size} y2={i * cs} stroke="#FFFFFF" strokeOpacity={0.14} strokeWidth={1} />);
    grid.push(<Line key={`v${i}`} x1={i * cs} y1={0} x2={i * cs} y2={size} stroke="#FFFFFF" strokeOpacity={0.14} strokeWidth={1} />);
  }

  const lines = paths.map((p, k) => {
    if (p.length < 2) return null;
    const pts = p.map((cell) => center(cell).join(',')).join(' ');
    const common = { points: pts, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
    return (
      <React.Fragment key={`l${k}`}>
        <Polyline {...common} stroke={DOT_COLORS[k]} strokeOpacity={0.25} strokeWidth={cs * 0.62} />
        <Polyline {...common} stroke={DOT_COLORS[k]} strokeWidth={cs * 0.38} />
        <Polyline {...common} stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={cs * 0.1} />
      </React.Fragment>
    );
  });

  const dotEls = dots.map(([a, b], k) => {
    const done = isConnected(paths[k], dots[k]);
    return [a, b].map((cell) => {
      const [x, y] = center(cell);
      return (
        <React.Fragment key={`d${cell}`}>
          <Circle cx={x} cy={y + cs * 0.04} r={cs * 0.36} fill="#000000" fillOpacity={0.35} />
          {done && <Circle cx={x} cy={y} r={cs * 0.46} fill={DOT_COLORS[k]} fillOpacity={0.3} />}
          <Circle cx={x} cy={y} r={cs * 0.34} fill={`url(#dot${k})`} />
          <Circle cx={x - cs * 0.1} cy={y - cs * 0.1} r={cs * 0.08} fill="#FFFFFF" fillOpacity={0.7} />
          {done && <Circle cx={x} cy={y} r={cs * 0.34} fill="none" stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={Math.max(1.5, cs * 0.05)} />}
        </React.Fragment>
      );
    });
  });

  const head = activeColor != null && headCell != null ? center(headCell) : null;

  const pulseScale = winPulse
    ? winPulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.04, 1] })
    : 1;

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ scale: pulseScale }] }}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={size} height={size}>
          <Defs>
            {DOT_COLORS.map((c, k) => (
              <RadialGradient key={k} id={`dot${k}`} cx="40%" cy="35%" r="70%">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
                <Stop offset="0.35" stopColor={c} stopOpacity="1" />
                <Stop offset="1" stopColor={c} stopOpacity="1" />
              </RadialGradient>
            ))}
          </Defs>
          <Rect x={0} y={0} width={size} height={size} fill="#0B2B33" />
          {tint}
          {grid}
          {lines}
          {head && <Circle cx={head[0]} cy={head[1]} r={cs * 0.7} fill={DOT_COLORS[activeColor]} fillOpacity={0.22} />}
          {dotEls}
        </Svg>
        {sparkles.map((sp) => (
          <Sparkle key={sp.id} x={center(sp.cell)[0]} y={center(sp.cell)[1]} color={DOT_COLORS[sp.color]} cs={cs} />
        ))}
      </View>
      {/* Touch layer on top; everything under it ignores touches. */}
      <View style={StyleSheet.absoluteFill} {...responder.panHandlers} />
    </Animated.View>
  );
}

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
