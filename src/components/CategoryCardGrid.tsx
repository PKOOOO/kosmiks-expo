import React from 'react';
import { Text, TouchableOpacity, View, ViewStyle } from 'react-native';

type CategoryCardItem = {
  id: string;
  name: string;
};

type CategoryCardGridProps = {
  categories: CategoryCardItem[];
  onCategoryPress: (category: CategoryCardItem) => void;
  selectedCategoryNames?: readonly string[];
  style?: ViewStyle;
  fontFamily?: string;
  /** Shorter cards so a full category list fits on one screen. */
  compact?: boolean;
};

const CARD_BACKGROUND = '#D7C3A7';
const TEXT_COLOR = '#423120';

const layoutPatterns = [
  { flex1: 1.5, flex2: 1 },
  { flex1: 1.1, flex2: 2 },
  { flex1: 1.7, flex2: 1.2 },
  { flex1: 1.2, flex2: 2 },
  { flex1: 2, flex2: 1.2 },
];

export default function CategoryCardGrid({
  categories,
  onCategoryPress,
  selectedCategoryNames = [],
  style,
  fontFamily = 'Philosopher-Bold',
  compact = false,
}: CategoryCardGridProps) {
  const rows: React.ReactNode[] = [];
  const selectedNames = new Set(selectedCategoryNames);
  const totalRows = Math.ceil(categories.length / 2);

  const renderCard = (category: CategoryCardItem, flex?: number) => {
    const selected = selectedNames.has(category.name);

    return (
      <TouchableOpacity
        key={category.id}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => onCategoryPress(category)}
        style={{
          flex,
          minWidth: 0,
          height: compact ? 58 : 88,
          margin: compact ? 4 : 6,
          borderRadius: compact ? 22 : 30,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? TEXT_COLOR : CARD_BACKGROUND,
        }}
      >
        <Text
          style={{
            paddingHorizontal: 12,
            color: selected ? '#FFFFFF' : TEXT_COLOR,
            fontFamily,
            fontSize: compact ? 16 : 18,
            textAlign: 'center',
          }}
        >
          {category.name}
        </Text>
      </TouchableOpacity>
    );
  };

  for (let index = 0; index < categories.length; index += 2) {
    const first = categories[index];
    const second = categories[index + 1];

    if (!second) {
      rows.push(
        <View key={`row-${first.id}`} style={{ width: '100%', alignItems: 'center' }}>
          <View style={{ width: '95%' }}>{renderCard(first)}</View>
        </View>,
      );
      continue;
    }

    const rowNumber = index / 2;
    const isLastFullRow = rowNumber === totalRows - 1;
    const pattern = isLastFullRow
      ? { flex1: 1, flex2: 2 }
      : layoutPatterns[rowNumber % layoutPatterns.length];

    rows.push(
      <View
        key={`row-${first.id}-${second.id}`}
        style={{ width: '100%', flexDirection: 'row', alignItems: 'center' }}
      >
        {renderCard(first, pattern.flex1)}
        {renderCard(second, pattern.flex2)}
      </View>,
    );
  }

  return <View style={[{ width: '100%' }, style]}>{rows}</View>;
}
