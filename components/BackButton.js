import React from 'react';
import ImageButton from './ImageButton';

// The one back button used across every game and screen: the green glossy
// arrow (art is 160x151).
export default function BackButton(props) {
  return <ImageButton source={require('../assets/back_button.png')} aspect={160 / 151} {...props} />;
}
