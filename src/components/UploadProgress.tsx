import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  percent: number;
  /** Light ring for use on top of a dark overlay or photo. */
  onDark?: boolean;
  size?: number;
};

// While waiting for the next real progress event the ring keeps creeping
// slowly, but never past this — only a finished upload closes the circle.
const CREEP_CAP = 90;
const STROKE = 4;

// Circular progress ring shown inside an upload slot while a file goes to
// storage. It fills smoothly towards the real progress rather than jumping,
// since phones often report a small upload in one or two big steps.
export default function UploadProgress({ percent, onDark = false, size = 52 }: Props) {
  const target = Math.max(0, Math.min(100, percent));
  const [shown, setShown] = useState(0);
  const creepRef = useRef(0);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    const id = setInterval(() => {
      const real = targetRef.current;
      if (real < 100 && creepRef.current < CREEP_CAP) creepRef.current += 0.6;
      const goal = real >= 100 ? 100 : Math.max(real, Math.min(creepRef.current, CREEP_CAP));
      setShown(prev => (prev >= goal ? prev : Math.min(goal, prev + Math.max(0.5, (goal - prev) * 0.25))));
    }, 40);
    return () => clearInterval(id);
  }, []);

  const color = onDark ? '#FFFFFF' : '#423120';
  const track = onDark ? 'rgba(255,255,255,0.3)' : '#E2D3BF';
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const done = shown >= 100;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={done ? 'Upload complete' : 'Uploading'}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(shown) }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={track} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - shown / 100)}
        />
      </Svg>
      <Ionicons name={done ? 'checkmark' : 'arrow-up'} size={size * 0.38} color={color} />
    </View>
  );
}
