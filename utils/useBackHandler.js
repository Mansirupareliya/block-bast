import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

// Android hardware/gesture back. Navigation here is plain state (no
// navigator), so without this the OS closes the app from any screen.
// `handler` should do what the on-screen back button does in the current
// view. Registered once per mount (latest handler read via a ref) so a
// sub-screen mounted later — e.g. LeaderboardScreen — keeps priority.
export function useBackHandler(handler) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      ref.current();
      return true;
    });
    return () => sub.remove();
  }, []);
}
