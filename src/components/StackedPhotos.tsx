import React, { useState } from 'react';
import {
  Animated, View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UploadProgress from '@/components/UploadProgress';
import RemoteImage from '@/components/RemoteImage';

// Full-width landscape photos that stack while the page scrolls: each photo
// pins near the top of the scroll view and the next one slides up over it,
// leaving a thin edge of the earlier photos visible.

const GAP = 14;
const STICK_TOP = 12;   // where the first photo pins, from the scroll view's top
const PEEK = 10;        // how much of each covered photo stays visible
export const MAX_PHOTOS = 6;

type Props = {
  images: string[];
  width: number;
  /** The page ScrollView's contentOffset.y. */
  scrollY: Animated.Value;
  /** Y of this component's parent inside the scroll content (for pin maths). */
  parentOffsetY: number;
  uploading: number | 'new' | null;
  uploadProgress: number;
  onReplace: (index: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  /** Set false when the screen pins its own AddPhotoButton (e.g. a sticky footer). */
  showAddButton?: boolean;
};

export default function StackedPhotos({
  images, width, scrollY, parentOffsetY, uploading, uploadProgress, onReplace, onRemove, onAdd,
  showAddButton = true,
}: Props) {
  const height = Math.round(width * 0.62);
  const step = height + GAP;
  const [ownY, setOwnY] = useState<number | null>(null);
  const busy = uploading !== null;

  const last = images.length - 1;
  const stackTop = ownY == null ? null : parentOffsetY + ownY;
  // Scroll position at which photo i reaches its pin point.
  const pinAt = (i: number) => (stackTop ?? 0) + i * step - (STICK_TOP + i * PEEK);

  const transformFor = (i: number) => {
    if (stackTop == null || i >= last) return undefined;
    const start = pinAt(i);
    // Stay pinned until the last photo reaches its own pin; then all scroll away together.
    const travel = pinAt(last) - start;
    if (travel <= 0) return undefined;
    return [
      {
        translateY: scrollY.interpolate({
          inputRange: [start, start + travel],
          outputRange: [0, travel],
          extrapolate: 'clamp',
        }),
      },
      {
        // Ease the covered photo back a touch as the next one slides over it.
        scale: scrollY.interpolate({
          inputRange: [start, start + step],
          outputRange: [1, 0.95],
          extrapolate: 'clamp',
        }),
      },
    ];
  };

  return (
    <View onLayout={e => setOwnY(e.nativeEvent.layout.y)}>
      {images.map((url, index) => (
        <Animated.View
          key={`${url}-${index}`}
          style={[
            styles.photo,
            { width, height, marginBottom: GAP, zIndex: index + 1 },
            { transform: transformFor(index) ?? [] },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={index === 0 ? 'Replace cover photo' : `Replace salon photo ${index + 1}`}
            onPress={() => onReplace(index)}
            style={StyleSheet.absoluteFill}
          >
            <RemoteImage source={{ uri: url }} style={styles.image} />
          </TouchableOpacity>
          {index === 0 && (
            <View pointerEvents="none" style={styles.coverBadge}>
              <Text style={styles.coverBadgeText}>Cover</Text>
            </View>
          )}
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={index === 0 ? 'Remove cover photo' : `Remove salon photo ${index + 1}`}
            onPress={() => onRemove(index)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={styles.removeButton}
          >
            <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
          </TouchableOpacity>
          {uploading === index && (
            <View style={styles.overlay}>
              <UploadProgress percent={uploadProgress} onDark />
            </View>
          )}
        </Animated.View>
      ))}

      {showAddButton && images.length < MAX_PHOTOS && (
        <AddPhotoButton
          isFirst={images.length === 0}
          uploading={uploading === 'new'}
          disabled={busy}
          uploadProgress={uploadProgress}
          onPress={onAdd}
          style={{ width }}
        />
      )}
    </View>
  );
}

export function AddPhotoButton({
  isFirst, uploading, disabled, uploadProgress, onPress, style, filled = false,
}: {
  isFirst: boolean;
  uploading: boolean;
  disabled: boolean;
  uploadProgress: number;
  onPress: () => void;
  style?: object;
  /** Solid brown — for when it's the screen's main action in a footer. */
  filled?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[styles.addButton, filled && styles.addButtonFilled, style]}
    >
      {uploading ? (
        <UploadProgress percent={uploadProgress} size={30} onDark={filled} />
      ) : (
        <Text style={[styles.addText, filled && { color: '#FFFFFF' }]}>
          {isFirst ? 'Add a cover photo' : 'Add photo'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  photo: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#EDE3D8',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    minHeight: 26,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: 'rgba(244,237,229,0.94)',
  },
  coverBadgeText: { color: '#423120', fontFamily: 'Philosopher-Bold', fontSize: 12 },
  removeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(66,49,32,0.82)',
  },
  overlay: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(66,49,32,0.48)',
  },
  addButton: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#D7C3A7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonFilled: {
    borderColor: '#423120',
    backgroundColor: '#423120',
  },
  addText: { color: '#423120', fontFamily: 'Philosopher-Bold', fontSize: 15 },
});
