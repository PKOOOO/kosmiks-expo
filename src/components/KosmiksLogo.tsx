import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Defs, G, Mask, Path, Rect } from 'react-native-svg';

const darkBrown = '#423120';

type KosmiksLogoProps = {
  /** Height of the arch symbol in px; the wordmark scales with it. */
  size?: number;
  /** Arch and wordmark colour. */
  color?: string;
  /** Show the KOSMIKS wordmark next to the symbol. */
  wordmark?: boolean;
};

/**
 * The Kosmiks logo: a petal K cut out of an arch, plus the KOSMIKS wordmark
 * (Philosopher Bold, wide letter spacing). Same geometry as the app icon
 * (assets/icon.png) and the client logo sheet; the viewBox is cropped to the
 * arch so it centres exactly next to text. The K is a real cut-out (mask), so
 * the logo works on any background colour.
 */
export default function KosmiksLogo({
  size = 28,
  color = darkBrown,
  wordmark = true,
}: KosmiksLogoProps) {
  const symbolWidth = (size * 104) / 132;
  const fontSize = Math.round(size * 0.68);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Kosmiks"
      style={{ flexDirection: 'row', alignItems: 'center', gap: Math.round(size * 0.32) }}
    >
      <Svg width={symbolWidth} height={size} viewBox="48 40 104 132">
        <Defs>
          <Mask id="kosmiksK" x={0} y={0} width={200} height={200} maskUnits="userSpaceOnUse">
            <Rect x={0} y={0} width={200} height={200} fill="#FFFFFF" />
            <G transform="translate(28 47) scale(0.7)" fill="#000000">
              <Rect x={66} y={50} width={14} height={100} rx={7} />
              <Path d="M88 100 C 96 72 114 56 140 50 C 134 76 116 94 88 100 Z" />
              <Path d="M88 100 C 116 106 134 124 140 150 C 114 144 96 128 88 100 Z" />
            </G>
          </Mask>
        </Defs>
        <Path
          d="M48 168 Q48 172 52 172 H148 Q152 172 152 168 V92 A52 52 0 0 0 48 92 Z"
          fill={color}
          mask="url(#kosmiksK)"
        />
      </Svg>
      {wordmark && (
        <Text
          style={{
            fontFamily: 'Philosopher-Bold',
            fontSize,
            letterSpacing: fontSize * 0.24,
            // Trailing letter-spacing would push the visual centre left.
            marginRight: -fontSize * 0.24,
            color,
          }}
        >
          KOSMIKS
        </Text>
      )}
    </View>
  );
}
