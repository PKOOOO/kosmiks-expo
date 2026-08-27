// components/ServiceSelection.tsx
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Image,
  Dimensions
} from 'react-native';
import AntDesign from '@expo/vector-icons/AntDesign';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface ServiceSelectionProps {
  selectedService: any;
  setSelectedService: (service: any) => void;
}

export default function ServiceSelection({ selectedService, setSelectedService }: ServiceSelectionProps) {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const categories = [
    { id: 'all', name: 'All Services', icon: 'spa', color: '#423120' },
    { id: 'massage', name: 'Massage', icon: 'self-improvement', color: '#D7C3A7' },
    { id: 'facial', name: 'Facial', icon: 'face', color: '#E0D7CA' },
    { id: 'body', name: 'Body Care', icon: 'healing', color: '#968469' },
    { id: 'wellness', name: 'Wellness', icon: 'favorite', color: '#F4EDE5' },
  ];

  const services = [
    {
      id: 1,
      name: "Swedish Relaxation Massage",
      category: "massage",
      categoryName: "Massage Therapy",
      duration: 60,
      price: 85,
      originalPrice: 100,
      description: "A gentle, flowing massage that promotes deep relaxation and stress relief using long, smooth strokes.",
      benefits: ["Stress Relief", "Muscle Relaxation", "Improved Circulation", "Better Sleep"],
      images: [
        "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=300&fit=crop"
      ],
      isPopular: true,
      rating: 4.9,
      reviewCount: 156,
      therapists: 5,
      intensity: "Light",
      bestFor: "First-time clients, stress relief"
    },
    {
      id: 2,
      name: "Deep Tissue Therapeutic Massage",
      category: "massage",
      categoryName: "Massage Therapy",
      duration: 75,
      price: 120,
      description: "Targeted therapy focusing on deeper muscle layers to address chronic tension and pain.",
      benefits: ["Pain Relief", "Muscle Recovery", "Tension Release", "Improved Mobility"],
      images: [
        "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=400&h=300&fit=crop",
      ],
      rating: 4.8,
      reviewCount: 203,
      therapists: 3,
      intensity: "Firm",
      bestFor: "Athletes, chronic pain"
    },
    {
      id: 3,
      name: "Signature Hot Stone Therapy",
      category: "massage",
      categoryName: "Massage Therapy",
      duration: 90,
      price: 145,
      description: "Luxurious treatment combining heated volcanic stones with therapeutic massage techniques.",
      benefits: ["Deep Relaxation", "Improved Circulation", "Stress Reduction", "Muscle Warmth"],
      images: [
        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop",
      ],
      isPopular: true,
      rating: 4.9,
      reviewCount: 89,
      therapists: 4,
      intensity: "Medium",
      bestFor: "Cold weather, muscle stiffness"
    },
    {
      id: 4,
      name: "Purifying Deep Cleanse Facial",
      category: "facial",
      categoryName: "Facial Treatment",
      duration: 60,
      price: 95,
      description: "Comprehensive facial treatment designed to deeply cleanse and purify all skin types.",
      benefits: ["Deep Pore Cleansing", "Skin Brightening", "Hydration", "Blackhead Removal"],
      images: [
        "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=300&fit=crop",
      ],
      rating: 4.7,
      reviewCount: 124,
      therapists: 6,
      intensity: "Gentle",
      bestFor: "All skin types, monthly maintenance"
    },
    {
      id: 5,
      name: "Anti-Aging Collagen Facial",
      category: "facial",
      categoryName: "Facial Treatment",
      duration: 75,
      price: 135,
      description: "Advanced anti-aging treatment featuring collagen masks and peptide serums.",
      benefits: ["Fine Line Reduction", "Skin Firming", "Collagen Boost", "Hydration"],
      images: [
        "https://images.unsplash.com/photo-1559599101-f09722fb4948?w=400&h=300&fit=crop",
      ],
      isPopular: true,
      rating: 4.8,
      reviewCount: 67,
      therapists: 3,
      intensity: "Gentle",
      bestFor: "Mature skin, anti-aging"
    },
    {
      id: 6,
      name: "Detoxifying Body Wrap",
      category: "body",
      categoryName: "Body Treatment",
      duration: 80,
      price: 110,
      description: "Full-body detoxification treatment using natural clays and essential oils.",
      benefits: ["Detoxification", "Skin Smoothing", "Cellulite Reduction", "Hydration"],
      images: [
        "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=300&fit=crop",
      ],
      rating: 4.6,
      reviewCount: 45,
      therapists: 4,
      intensity: "Medium",
      bestFor: "Detox, special occasions"
    }
  ];

  const filteredServices = services.filter(service => {
    const matchesCategory = categoryFilter === 'all' || service.category === categoryFilter;
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         service.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <View className="px-6">
      {/* Header */}
      <View className="mb-6">
        <Text className="text-[#423120] text-2xl font-bold font-[Philosopher] mb-2">
          Choose Your Perfect Service
        </Text>
        <Text className="text-[#968469] font-[Philosopher] leading-5">
          Select from our curated collection of premium spa treatments designed for your wellness journey
        </Text>
      </View>

      {/* Search Bar */}
      <View className="mb-4">
        <View className="bg-[#F4EDE5] rounded-2xl flex-row items-center px-4 py-3 border border-[#E0D7CA]">
          <AntDesign name="search1" size={20} color="#968469" />
          <TextInput
            className="flex-1 ml-3 font-[Philosopher] text-[#423120] text-base"
            placeholder="Search treatments..."
            placeholderTextColor="#968469"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <AntDesign name="close" size={20} color="#968469" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Filter */}
      <View className="mb-6">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              onPress={() => setCategoryFilter(category.id)}
              className={`mr-3 px-4 py-3 rounded-full flex-row items-center border ${
                categoryFilter === category.id 
                  ? 'bg-[#423120] border-[#423120]' 
                  : 'bg-white border-[#E0D7CA]'
              }`}
            >
              <MaterialIcons 
                name={category.icon as any} 
                size={18} 
                color={categoryFilter === category.id ? 'white' : category.color}
              />
              <Text 
                className={`ml-2 font-[Philosopher] font-bold ${
                  categoryFilter === category.id 
                    ? 'text-white' 
                    : 'text-[#423120]'
                }`}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Services List */}
      {isLoading ? (
        <ServiceLoadingSkeleton />
      ) : (
        <View>
          {filteredServices.length === 0 ? (
            <NoServicesFound searchQuery={searchQuery} onClearSearch={() => setSearchQuery('')} />
          ) : (
            filteredServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                isSelected={selectedService?.id === service.id}
                onSelect={() => setSelectedService(service)}
              />
            ))
          )}
        </View>
      )}

      {/* Quick Book Popular */}
      {searchQuery === '' && categoryFilter === 'all' && (
        <PopularServicesQuickBook 
          services={services.filter(s => s.isPopular)} 
          onSelect={setSelectedService}
          selectedId={selectedService?.id}
        />
      )}
    </View>
  );
}

// Service Card Component
function ServiceCard({ service, isSelected, onSelect }: any) {
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
                style={{ width: width - 43 }}
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
          

        </View>
      </View>
    </TouchableOpacity>
  );
}

// Helper Components
function ServiceLoadingSkeleton() {
  return (
    <View className="space-y-6">
      {[...Array(3)].map((_, index) => (
        <View key={index} className="animate-pulse">
          <View className="bg-gray-200 h-48 rounded-3xl mb-4" />
          <View className="px-6">
            <View className="h-6 bg-gray-200 rounded mb-2" />
            <View className="h-4 bg-gray-200 rounded w-2/3 mb-4" />
            <View className="flex-row space-x-2">
              <View className="h-6 bg-gray-200 rounded-full px-3 py-1" />
              <View className="h-6 bg-gray-200 rounded-full px-3 py-1" />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function NoServicesFound({ searchQuery, onClearSearch }: any) {
  return (
    <View className="items-center py-12">
      <View className="bg-[#F4EDE5] w-24 h-24 rounded-full items-center justify-center mb-6">
        <MaterialIcons name="search-off" size={48} color="#968469" />
      </View>
      
      <Text className="text-[#423120] text-xl font-bold font-[Philosopher] mb-2 text-center">
        No Services Found
      </Text>
      
      <Text className="text-[#968469] font-[Philosopher] text-center mb-6 leading-5">
        {searchQuery 
          ? `No services match "${searchQuery}". Try adjusting your search.`
          : "No services available in this category."
        }
      </Text>
      
      <View className="space-y-3">
        <TouchableOpacity 
          onPress={onClearSearch}
          className="bg-[#423120] px-8 py-3 rounded-full"
        >
          <Text className="text-white font-bold font-[Philosopher]">
            Clear Search
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity className="px-8 py-3">
          <Text className="text-[#968469] font-[Philosopher] text-center">
            Browse All Services
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PopularServicesQuickBook({ services, onSelect, selectedId }: any) {
  return (
    <View className="mt-8">
      <Text className="text-[#423120] font-bold font-[Philosopher] text-lg mb-4">
        ⭐ Popular Choices
      </Text>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {services.map((service: any) => (
          <TouchableOpacity
            key={service.id}
            onPress={() => onSelect(service)}
            className={`mr-4 w-64 rounded-2xl border-2 ${
              selectedId === service.id 
                ? 'border-[#423120] bg-[#F4EDE5]' 
                : 'border-[#E0D7CA] bg-white'
            }`}
          >
            <Image 
              source={{ uri: service.images[0] }}
              className="w-full h-32 rounded-t-xl"
              resizeMode="cover"
            />
            <View className="p-4">
              <Text className="text-[#423120] font-bold font-[Philosopher] mb-1">
                {service.name}
              </Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-[#423120] font-bold font-[Philosopher]">
                  ${service.price}
                </Text>
                <View className="flex-row items-center">
                  <AntDesign name="star" size={12} color="#FFD700" />
                  <Text className="text-[#968469] font-[Philosopher] ml-1 text-sm">
                    {service.rating}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}