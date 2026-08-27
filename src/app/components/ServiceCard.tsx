// components/ServiceCard.tsx - Individual service card component
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AntDesign from "@expo/vector-icons/AntDesign";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const { width } = Dimensions.get('window');

interface ServiceCardProps {
  service: {
    id: number;
    name: string;
    category: string;
    categoryName: string;
    duration: number;
    price: number;
    originalPrice?: number;
    description: string;
    benefits: string[];
    images: string[];
    isPopular?: boolean;
    rating: number;
    reviewCount: number;
    therapists: number;
    intensity: string;
    bestFor: string;
  };
  isSelected: boolean;
  onSelect: () => void;
}

export default function ServiceCard({ service, isSelected, onSelect }: ServiceCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  return (
    <TouchableOpacity
      onPress={onSelect}
      className={`mb-6 rounded-3xl overflow-hidden shadow-lg ${
        isSelected 
          ? 'border-3 border-[#423120] shadow-xl' 
          : 'border border-[#E0D7CA] shadow-md'
      }`}
      activeOpacity={0.9}
    >
      <View className="bg-white">
        {/* Service Image Carousel */}
        <View className="relative">
          <ScrollView 
            horizontal 
            pagingEnabled 
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / (width - 48));
              setCurrentImageIndex(index);
            }}
          >
            {service.images.map((image: string, index: number) => (
              <Image 
                key={index}
                source={{ uri: image }}
                style={{ width: width - 48 }}
                className="h-56"
                resizeMode="cover"
              />
            ))}
          </ScrollView>
          
          {/* Image Indicators */}
          {service.images.length > 1 && (
            <View className="absolute bottom-4 left-0 right-0 flex-row justify-center">
              {service.images.map((_: any, index: number) => (
                <View
                  key={index}
                  className={`w-2 h-2 rounded-full mx-1 ${
                    index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </View>
          )}
          
          
          {/* Discount Badge */}
          {service.originalPrice && (
            <View className="absolute top-4 right-4 bg-red-500 px-3 py-1 rounded-full">
              <Text className="text-white text-xs font-bold font-[Philosopher]">
                SAVE ${service.originalPrice - service.price}
              </Text>
            </View>
          )}
          
          {/* Selection Indicator */}
          {isSelected && (
            <View className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <View className="bg-[#423120] w-16 h-16 rounded-full items-center justify-center shadow-lg">
                <AntDesign name="check" size={28} color="white" />
              </View>
            </View>
          )}
        </View>
        
        {/* Service Details */}
        <View className="p-6">
          <View className="flex-row items-start justify-between mb-3">
            <View className="flex-1 mr-4">
              <Text className="text-[#423120] text-xl font-bold font-[Philosopher] mb-1">
                {service.name}
              </Text>
              <Text className="text-[#968469] font-[Philosopher] mb-2">
                {service.categoryName}
              </Text>
              <Text className="text-[#968469] font-[Philosopher] text-sm leading-5">
                {service.description}
              </Text>
            </View>
            <View className="items-end">
              <View className="flex-row items-center mb-1">
                {service.originalPrice && (
                  <Text className="text-[#968469] text-lg font-[Philosopher] line-through mr-2">
                    ${service.originalPrice}
                  </Text>
                )}
                <Text className="text-[#423120] text-2xl font-bold font-[Philosopher]">
                  ${service.price}
                </Text>
              </View>
              <Text className="text-[#968469] font-[Philosopher] text-sm">
                {service.duration} minutes
              </Text>
            </View>
          </View>
          
          {/* Service Stats */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <AntDesign name="star" size={16} color="#FFD700" />
              <Text className="text-[#423120] font-[Philosopher] ml-1 font-bold">
                {service.rating}
              </Text>
              <Text className="text-[#968469] font-[Philosopher] ml-1">
                ({service.reviewCount} reviews)
              </Text>
            </View>
            
            <View className="flex-row items-center">
              <MaterialIcons name="people" size={16} color="#968469" />
              <Text className="text-[#968469] font-[Philosopher] ml-1">
                {service.therapists} therapists
              </Text>
            </View>
            
            <View className="bg-[#F4EDE5] px-3 py-1 rounded-full">
              <Text className="text-[#423120] font-[Philosopher] text-xs font-bold">
                {service.intensity} Intensity
              </Text>
            </View>
          </View>
          
          {/* Benefits */}
          <View className="mb-4">
            <Text className="text-[#423120] font-bold font-[Philosopher] mb-2">
              Key Benefits:
            </Text>
            <View className="flex-row flex-wrap">
              {service.benefits.map((benefit: string, index: number) => (
                <View key={index} className="bg-[#E0D7CA] px-3 py-1 rounded-full mr-2 mb-2">
                  <Text className="text-[#423120] text-xs font-[Philosopher]">
                    ✓ {benefit}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          
          {/* Best For */}
          <View className="border-t border-[#F4EDE5] pt-3">
            <Text className="text-[#968469] font-[Philosopher] text-sm">
              <Text className="font-bold">Best for:</Text> {service.bestFor}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}