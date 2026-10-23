import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

type TabsProps = React.ComponentProps<typeof Tabs>;
type TabBarProps = Parameters<NonNullable<TabsProps['tabBar']>>[0];
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const darkBrown = '#423120';
const beige = '#D7C3A7';
const white = '#FFFFFF';
const badgeGreen = '#25D366';

const BAR_HEIGHT = 72;
const BAR_INSET = 20;
const ICON_FRAME = 48;

const routeIcons: Record<string, IconName> = {
  service: 'search-outline',
  bookings: 'calendar-outline',
  services: 'cut-outline',
  // Admin dashboard
  applications: 'document-text-outline',
  saloons: 'storefront-outline',
  catalog: 'grid-outline',
};

// These are the same tab glyphs used by react-native-recurrly. Routes without
// a semantic match keep their Kosmiks-specific outline icon above.
const referenceIcons: Record<string, ImageSourcePropType> = {
  index: require('../../assets/tab-icons/home.png'),
  home: require('../../assets/tab-icons/home.png'),
  profile: require('../../assets/tab-icons/setting.png'),
  salon: require('../../assets/tab-icons/setting.png'),
  payouts: require('../../assets/tab-icons/wallet.png'),
  revenue: require('../../assets/tab-icons/activity.png'),
};

export default function TabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, BAR_INSET);
  const focusedRoute = state.routes[state.index];
  const focusedStyle = StyleSheet.flatten(
    descriptors[focusedRoute.key]?.options.tabBarStyle
  ) as ViewStyle | undefined;

  if (focusedStyle?.display === 'none') return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.positioner, { bottom: bottomInset }]}
    >
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const options = descriptors[route.key].options;
          const isFocused = state.index === index;
          const iconName = routeIcons[route.name];
          const referenceIcon = referenceIcons[route.name];
          const badge = options.tabBarBadge;
          const showBadge = badge !== undefined && badge !== null && badge !== 0 && badge !== '0';

          if (!iconName && !referenceIcon) return null;

          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigateToTab(route.key);
            }
          };

          const onLongPress = () => {
            emitter.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={
                options.tabBarAccessibilityLabel ??
                (typeof options.title === 'string' ? options.title : route.name)
              }
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.item}
            >
              <View style={styles.iconSlot}>
                <View style={styles.iconFrame}>
                  {isFocused && (
                    <Svg
                      pointerEvents="none"
                      width={ICON_FRAME}
                      height={ICON_FRAME}
                      style={styles.activeCircle}
                    >
                      <Circle cx={ICON_FRAME / 2} cy={ICON_FRAME / 2} r={ICON_FRAME / 2} fill={darkBrown} />
                    </Svg>
                  )}
                  {referenceIcon ? (
                    <Image
                      source={referenceIcon}
                      resizeMode="contain"
                      style={[
                        styles.referenceGlyph,
                        { tintColor: isFocused ? white : darkBrown },
                      ]}
                    />
                  ) : (
                    <Ionicons
                      name={iconName!}
                      size={24}
                      color={isFocused ? white : darkBrown}
                      style={styles.glyph}
                    />
                  )}
                </View>
                {showBadge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{String(badge)}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  positioner: {
    position: 'absolute',
    left: BAR_INSET,
    right: BAR_INSET,
    height: BAR_HEIGHT,
    zIndex: 1000,
  },
  bar: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 32,
    backgroundColor: beige,
    overflow: 'hidden',
  },
  item: {
    flex: 1,
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlot: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFrame: {
    width: ICON_FRAME,
    height: ICON_FRAME,
    borderRadius: ICON_FRAME / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  activeCircle: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  referenceGlyph: {
    width: 24,
    height: 24,
    zIndex: 1,
  },
  glyph: {
    zIndex: 1,
  },
  badge: {
    position: 'absolute',
    top: -1,
    right: -1,
    minWidth: 21,
    height: 21,
    paddingHorizontal: 4,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: badgeGreen,
    borderWidth: 2,
    borderColor: beige,
    zIndex: 2,
  },
  badgeText: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 11,
    lineHeight: 13,
    color: white,
  },
});
