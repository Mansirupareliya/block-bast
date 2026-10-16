import React from 'react';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';

// Game UI is laid out to exact pixel sizes, so the phone's "font size" /
// accessibility text scaling would make labels wrap and cards overflow on
// some devices (Samsung, Realme). Every screen imports Text / TextInput from
// here instead of react-native so text renders the same size everywhere.
export function Text(props) {
  return <RNText allowFontScaling={false} {...props} />;
}

export function TextInput(props) {
  return <RNTextInput allowFontScaling={false} {...props} />;
}

export default Text;
