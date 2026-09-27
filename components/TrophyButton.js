import React, { useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import { SvgXml } from 'react-native-svg';

// Green glossy trophy (matches the settings gear and back arrow). The
// source art's drop-shadow filter is left out: filter support on Android
// is unreliable and can make the whole group disappear.
const TROPHY_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="rimGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#228714"/>
      <stop offset="50%" stop-color="#0e5907"/>
      <stop offset="100%" stop-color="#053303"/>
    </linearGradient>
    <linearGradient id="bodyGrad" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="#bbf32d"/>
      <stop offset="35%" stop-color="#8de00c"/>
      <stop offset="80%" stop-color="#60be02"/>
      <stop offset="100%" stop-color="#3c8e00"/>
    </linearGradient>
    <linearGradient id="innerShade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#0f5203" stop-opacity="0.55"/>
    </linearGradient>
    <linearGradient id="starGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#c5f850"/>
    </linearGradient>
  </defs>
  <g>
    <path d="M 125 155 C 65 155 45 220 50 280 C 55 330 95 365 160 365 L 180 365 C 160 330 145 285 145 240 L 145 160 Z"
          fill="url(#rimGrad)" stroke="#042602" stroke-width="12" stroke-linejoin="round"/>
    <path d="M 387 155 C 447 155 467 220 462 280 C 457 330 417 365 352 365 L 332 365 C 352 330 367 285 367 240 L 367 160 Z"
          fill="url(#rimGrad)" stroke="#042602" stroke-width="12" stroke-linejoin="round"/>
    <path d="M 170 380 L 342 380 C 355 380 365 390 362 403 L 350 445 C 347 458 335 468 320 468 L 192 468 C 177 468 165 458 162 445 L 150 403 C 147 390 157 380 170 380 Z"
          fill="url(#rimGrad)" stroke="#042602" stroke-width="12" stroke-linejoin="round"/>
    <path d="M 130 95 C 130 95 125 250 170 325 C 205 380 307 380 342 325 C 387 250 382 95 382 95 C 382 80 370 70 355 70 L 157 70 C 142 70 130 80 130 95 Z"
          fill="url(#rimGrad)" stroke="#042602" stroke-width="14" stroke-linejoin="round"/>
  </g>
  <path d="M 132 172 C 85 172 72 225 76 270 C 80 308 110 335 152 338 C 140 295 135 240 132 172 Z"
        fill="url(#bodyGrad)"/>
  <path d="M 380 172 C 427 172 440 225 436 270 C 432 308 402 335 360 338 C 372 295 377 240 380 172 Z"
        fill="url(#bodyGrad)"/>
  <path d="M 180 394 L 332 394 C 340 394 346 400 344 408 L 334 440 C 332 447 325 452 317 452 L 195 452 C 187 452 180 447 178 440 L 168 408 C 166 400 172 394 180 394 Z"
        fill="url(#bodyGrad)"/>
  <path d="M 178 440 L 334 440 L 325 452 L 187 452 Z" fill="url(#innerShade)"/>
  <path d="M 148 98 C 148 98 144 245 184 312 C 214 360 298 360 328 312 C 368 245 364 98 364 98 C 364 90 358 84 350 84 L 162 84 C 154 84 148 90 148 98 Z"
        fill="url(#bodyGrad)"/>
  <path d="M 148 240 C 160 300 210 350 256 350 C 302 350 352 300 364 240 C 360 290 320 340 256 340 C 192 340 152 290 148 240 Z"
        fill="url(#innerShade)"/>
  <polygon points="256,170 269,208 209,208 238,230 227,268 256,245 285,268 274,230 303,208 243,208"
           transform="translate(256, 218) scale(0.9) translate(-256, -218)"
           fill="url(#starGrad)" stroke="#0e5907" stroke-width="4" stroke-linejoin="round"/>
  <path d="M 175 92 L 337 92" stroke="#ffffff" stroke-width="8" stroke-linecap="round" opacity="0.6"/>
  <path d="M 166 115 C 163 150 166 185 174 210"
        stroke="#ffffff" stroke-width="12" stroke-linecap="round" fill="none" opacity="0.85"/>
  <path d="M 183 235 C 191 255 203 275 218 290"
        stroke="#ffffff" stroke-width="10" stroke-linecap="round" fill="none" opacity="0.85"/>
  <ellipse cx="233" cy="307" rx="6" ry="4" transform="rotate(-30 233 307)" fill="#ffffff" opacity="0.85"/>
  <path d="M 105 178 C 80 195 72 225 76 255"
        stroke="#ffffff" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.75"/>
  <path d="M 190 405 L 240 405"
        stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity="0.75"/>
</svg>`;

export default function TrophyButton({ onPress, size = 50, style }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v) => Animated.spring(scale, { toValue: v, friction: 6, useNativeDriver: true }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => to(0.88)}
      onPressOut={() => to(1)}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <SvgXml xml={TROPHY_XML} width={size} height={size} />
      </Animated.View>
    </Pressable>
  );
}
