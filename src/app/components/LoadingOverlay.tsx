// components/LoadingOverlay.tsx
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';

interface LoadingOverlayProps {
  message?: string;
  submessage?: string;
}

export default function LoadingOverlay({ 
  message = "Processing Your Booking",
  submessage = "Please wait while we confirm your appointment and process payment..."
}: LoadingOverlayProps) {
  return (
    <View className="absolute inset-0 bg-black/50 items-center justify-center z-50">
      <BlurView intensity={100} tint="light" className="absolute inset-0" />
      
      <View className="bg-white rounded-3xl p-8 items-center shadow-2xl">
        <View className="w-20 h-20 bg-[#F4EDE5] rounded-full items-center justify-center mb-6">
          <View className="animate-spin">
            <MaterialIcons name="spa" size={40} color="#423120" />
          </View>
        </View>
        
        <Text className="text-[#423120] text-xl font-bold font-[Philosopher] mb-2 text-center">
          {message}
        </Text>
        
        <Text className="text-[#968469] font-[Philosopher] text-center leading-5 mb-4">
          {submessage}
        </Text>
        
        {/* Progress Dots */}
        <View className="flex-row space-x-2">
          {[...Array(3)].map((_, index) => (
            <View
              key={index}
              className="w-2 h-2 bg-[#423120] rounded-full animate-pulse"
            //   style={{
            //     animationDelay: `${index * 0.2}s`
            //   }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}