import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Bottom padding for scroll content on a tab's root screen, so the last item
 * clears the floating tab bar (iOS Liquid Glass bar, Android pill) — neither
 * is included in the safe-area inset.
 */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'ios' ? insets.bottom + 64 : insets.bottom + 110;
}

/** Bottom padding on pushed pages, where the tab bar is hidden. */
export function usePageBottomSpace() {
  const insets = useSafeAreaInsets();
  return insets.bottom + 24;
}
