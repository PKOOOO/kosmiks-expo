import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ImageSourcePropType, StyleProp, ImageStyle, ViewStyle } from 'react-native';
import { Image as ExpoImage, ImageContentFit, ImageProps as ExpoImageProps } from 'expo-image';
import { cssInterop } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';

const beige = '#E9DDCD';
const darkBrown = '#423120';

const FIT: Record<string, ImageContentFit> = {
  cover: 'cover',
  contain: 'contain',
  stretch: 'fill',
  center: 'scale-down',
  repeat: 'cover',
};

type RemoteImageProps = {
  source: ImageSourcePropType;
  style?: StyleProp<ImageStyle>;
  /** Same values as React Native's Image, mapped to expo-image's contentFit. */
  resizeMode?: keyof typeof FIT;
  onError?: () => void;
  onLoad?: () => void;
  accessibilityLabel?: string;
  /** NativeWind classes; mapped to `style` by cssInterop below. */
  className?: string;
};

/**
 * Drop-in replacement for <Image source={{ uri }}> on remote images.
 *
 * - Caches on disk (expo-image `memory-disk`), so photos the user has already
 *   seen still show when they're offline.
 * - Fades images in, and shows a beige placeholder with an image icon
 *   instead of an empty gap if the image can't be loaded.
 */
function RemoteImage({ source, style, resizeMode = 'cover', onError, onLoad, accessibilityLabel }: RemoteImageProps) {
  const uri = typeof source === 'object' && source && !Array.isArray(source) ? (source as { uri?: string }).uri : undefined;
  const isLocalAsset = typeof source === 'number';
  const [failed, setFailed] = useState(false);

  // A new URL deserves a fresh attempt.
  useEffect(() => setFailed(false), [uri]);

  if (failed || (!uri && !isLocalAsset)) {
    const flat = StyleSheet.flatten(style) as ViewStyle | undefined;
    return (
      <View style={[flat, styles.fallback]} accessibilityLabel={accessibilityLabel}>
        <Ionicons name="image-outline" size={22} color={darkBrown} style={{ opacity: 0.35 }} />
      </View>
    );
  }

  return (
    <ExpoImage
      source={source as ExpoImageProps['source']}
      style={style}
      contentFit={FIT[resizeMode] ?? 'cover'}
      cachePolicy="memory-disk"
      transition={200}
      accessibilityLabel={accessibilityLabel}
      onLoad={onLoad}
      onError={() => {
        setFailed(true);
        onError?.();
      }}
    />
  );
}

// Let NativeWind `className` work on RemoteImage like it does on Image.
cssInterop(RemoteImage, { className: 'style' });

export default RemoteImage;

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: beige,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
