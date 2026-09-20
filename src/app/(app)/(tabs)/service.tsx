import React, { useEffect, useState, useRef } from "react";
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Animated, Easing, ActivityIndicator, Image } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Header from "@/components/Header";
import SideMenu from "@/components/SideMenu";
import { useFonts } from "expo-font";
import getCategories from "@/actions/get-categories";
import { Category, Service } from "@/types";
import { Salon } from "@/types/salon";
import getSaloonsMap from "@/actions/get-saloons-map";
import { API_ENDPOINTS } from "@/config/constants";

const normalizeString = (str: string) => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "") // remove punctuation for robustness
    .trim();
};

const levenshtein = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

const fuzzyMatch = (queryPart: string, target: string): boolean => {
  const q = normalizeString(queryPart);
  const t = normalizeString(target);
  if (!q || !t) return false;

  // 1. Direct substring match
  if (t.includes(q)) return true;

  // 2. Starts with (helpful for short parts like "IP" matching "IPL")
  if (q.length >= 2 && t.startsWith(q)) return true;

  // 3. Typo tolerance (Levenshtein)
  const threshold = q.length <= 4 ? 1 : 2;

  // Check against full string
  if (levenshtein(q, t) <= threshold) return true;

  // Check against individual words in target
  const targetWords = t.split(/\s+/);
  for (const word of targetWords) {
    if (levenshtein(q, word) <= threshold) return true;
    if (q.length >= 3 && word.startsWith(q)) return true;
  }

  return false;
};

export default function ServicesPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [isMenuVisible, setMenuVisible] = useState(false);

  const [fontsLoaded] = useFonts({
    'Philosopher-Regular': require("../../../assets/app-fonts/Philosopher-Regular.ttf"),
    'Philosopher-Bold': require("../../../assets/app-fonts/Philosopher-Bold.ttf"),
    'Philosopher-Italic': require("../../../assets/app-fonts/Philosopher-Italic.ttf"),
    'Philosopher-BoldItalic': require("../../../assets/app-fonts/Philosopher-BoldItalic.ttf"),
  });

  const darkBrown = "#423120";
  const lightBeige = "#ffffffff";
  const chipBeige = "#D7C3A7";

  // Popular categories (home-provided API)
  const [popularCategories, setPopularCategories] = useState<Category[]>([]);
  const [popularLoading, setPopularLoading] = useState<boolean>(false);

  // All categories for search
  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState<boolean>(false);
  const [catError, setCatError] = useState<string | null>(null);

  // All services for search (including sub-services)
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState<boolean>(false);
  const [servicesError, setServicesError] = useState<string | null>(null);

  // Salons for search
  const [salons, setSalons] = useState<Salon[]>([]);
  const [salonLoading, setSalonLoading] = useState<boolean>(false);
  const [salonError, setSalonError] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<'category' | 'salon' | 'service'>('category');

  // Fetch popular categories
  useEffect(() => {
    const fetchPopular = async () => {
      try {
        setPopularLoading(true);
        const res = await fetch(`${API_ENDPOINTS.CATEGORIES}?popular=true&global=true`);
        const data = await res.json();
        const categoriesData: Category[] = Array.isArray(data) ? data.filter(Boolean) : [];
        setPopularCategories(categoriesData);
      } catch (e) {
        console.warn("Failed to load popular categories", e);
      } finally {
        setPopularLoading(false);
      }
    };
    fetchPopular();
  }, []);

  // Fetch all services (including sub-services) for search
  useEffect(() => {
    const loadAllServices = async () => {
      try {
        setServicesLoading(true);
        setServicesError(null);
        const res = await fetch(API_ENDPOINTS.SERVICES, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch services: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        setAllServices(data);
      } catch (err) {
        setServicesError(err instanceof Error ? err.message : 'Failed to fetch services');
      } finally {
        setServicesLoading(false);
      }
    };
    loadAllServices();
  }, []);

  // Fetch all categories for search
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setCatLoading(true);
        setCatError(null);
        const data = await getCategories();
        setCategories(data);
      } catch (err) {
        setCatError(err instanceof Error ? err.message : 'Failed to fetch categories');
      } finally {
        setCatLoading(false);
      }
    };
    loadCategories();
  }, []);

  // Fetch all salons for search
  useEffect(() => {
    const loadSalons = async () => {
      try {
        setSalonLoading(true);
        setSalonError(null);
        const data = await getSaloonsMap();
        setSalons(data);
      } catch (err) {
        setSalonError(err instanceof Error ? err.message : 'Failed to fetch salons');
      } finally {
        setSalonLoading(false);
      }
    };
    loadSalons();
  }, []);

  const onChipPress = (name: string) => {
    router.push({ pathname: "/services", params: { categoryName: name } });
  };

  const onSalonPress = (salon: Salon) => {
    // Navigate to salon-sector page
    router.push({
      pathname: "/salon-sector",
      params: {
        salonId: salon.id,
        salonName: salon.name
      }
    });
  };

  // Determine search type based on query content
  useEffect(() => {
    const q = normalizeString(query);
    if (q.length === 0) {
      setSearchType('category');
      return;
    }

    // Check for EXACT category match first (highest priority)
    const hasExactCategoryMatch = categories.some(c => 
      normalizeString(c.name) === q
    );

    if (hasExactCategoryMatch) {
      setSearchType('category');
      return;
    }

    // Check salon matches
    const salonMatches = salons.filter(s => {
      const normalizedSName = normalizeString(s.name);
      const normalizedSAddress = normalizeString(s.address || "");
      const normalizedSIntro = normalizeString(s.shortIntro || "");
      return normalizedSName.includes(q) || normalizedSAddress.includes(q) || normalizedSIntro.includes(q);
    }).length;

    // Check category matches (partial/fuzzy)
    const categoryMatches = categories.filter(c =>
      normalizeString(c.name).includes(q)
    ).length;

    // Check service/sub-service matches (using same logic as filteredServices)
    const serviceMatches = allServices.filter(s => {
      const normalizedName = normalizeString(s.name);

      // Robust parent name resolution: Check parentService object OR find in allServices by ID
      let parentName = s.parentService?.name || "";
      if (!parentName && s.parentServiceId) {
        const parent = allServices.find(as => as.id === s.parentServiceId);
        if (parent) parentName = parent.name;
      }
      const normalizedParentName = normalizeString(parentName);

      const matchesName = normalizedName.includes(q);
      const matchesParent = normalizedParentName && normalizedParentName.includes(q);

      const queryParts = q.split(/\s+/).filter(Boolean);
      const matchesCombined = queryParts.length > 1 && queryParts.every(part =>
        normalizedName.includes(part) || (normalizedParentName && normalizedParentName.includes(part))
      );

      return (matchesName || matchesParent || matchesCombined) && s.parentServiceId;
    }).length;

    // Priority: exact category (handled above) > salon > service > category
    if (salonMatches > 0 && salonMatches >= categoryMatches && salonMatches >= serviceMatches) {
      setSearchType('salon');
    } else if (serviceMatches > 0) {
      setSearchType('service');
    } else {
      setSearchType('category');
    }
  }, [query, salons, categories, allServices]);

  const filteredCategoryNames = query.trim().length === 0
    ? []
    : categories
      .map((c) => c.name)
      .filter(Boolean)
      .filter((name) => {
        const parts = query.split(/\s+/).filter(Boolean);
        return parts.every(part => fuzzyMatch(part, name));
      });

  const filteredSalons = query.trim().length === 0
    ? []
    : salons.filter((salon) => {
      const parts = query.split(/\s+/).filter(Boolean);
      const combined = `${salon.name} ${salon.address || ""} ${salon.shortIntro || ""}`;
      return parts.every(part => fuzzyMatch(part, combined));
    });

  // Filter services (including sub-services) - only sub-services (those with parentServiceId)
  const filteredServices = query.trim().length === 0
    ? []
    : allServices.filter((service) => {
      // Robust parent name resolution
      let parentName = service.parentService?.name || "";
      if (!parentName && service.parentServiceId) {
        const parent = allServices.find(as => as.id === service.parentServiceId);
        if (parent) parentName = parent.name;
      }

      const queryParts = query.split(/\s+/).filter(Boolean);
      const combined = `${service.name} ${parentName}`;
      const matchesAllParts = queryParts.every(part => fuzzyMatch(part, combined));

      return matchesAllParts && service.parentServiceId;
    });

  const onServicePress = (service: Service, parentName?: string) => {
    // Resolve parent name if not provided
    let resolvedParentName = parentName || service.parentService?.name || "";
    if (!resolvedParentName && service.parentServiceId) {
      const parent = allServices.find(as => as.id === service.parentServiceId);
      if (parent) resolvedParentName = parent.name;
    }

    // Navigate to saloons page with serviceId to show salons that provide this service
    router.push({
      pathname: "/saloons",
      params: {
        serviceId: service.id,
        serviceName: service.name,
        categoryName: service.category?.name || "",
        parentServiceName: resolvedParentName,
      },
    });
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View collapsable={false} className="flex-1" style={{ backgroundColor: lightBeige }}>
      {/* Fixed header to match Home */}
      <Header showBack={true} onMenuPress={() => setMenuVisible(true)} onBackPress={() => router.back()} />

      {/* Side menu modal */}
      <Modal visible={isMenuVisible} animationType="slide" transparent={false} onRequestClose={() => setMenuVisible(false)} statusBarTranslucent={true}>
        <SideMenu onClose={() => setMenuVisible(false)} />
      </Modal>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-6">

          {/* Search bar - same style as in Map */}
          <View style={{ alignItems: "center" }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#FFFFFF",
                borderRadius: 25,
                borderWidth: 1,
                borderColor: darkBrown,
                width: 320,
                height: 46,
                paddingHorizontal: 16,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 3.84,
                elevation: 5,
              }}
            >
              <Ionicons name="search" size={20} color={darkBrown} style={{ marginRight: 12 }} />
              <TextInput
                style={{ flex: 1, fontSize: 16, fontFamily: 'Philosopher-Bold', color: darkBrown }}
                value={query}
                onChangeText={setQuery}
                placeholder="Etsi hoitoja..."
                placeholderTextColor="#999"
                returnKeyType="search"
              />
            </View>
          </View>

          {/* When searching: show matching salon names, services, or categories */}
          {query.trim().length > 0 ? (
            <View style={{ marginTop: 20 }}>
              {(catLoading || salonLoading || servicesLoading) ? (
                <View style={{ alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                  <ActivityIndicator size="large" color={darkBrown} />
                  <Text style={{ color: darkBrown, fontFamily: 'Philosopher-Regular', marginTop: 10 }}>
                    {searchType === 'salon' ? 'Ladataan salonkeja...' : searchType === 'service' ? 'Ladataan palveluja...' : 'Ladataan kategorioita...'}
                  </Text>
                </View>
              ) : searchType === 'salon' && filteredSalons.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 8 }}>
                  {filteredSalons.map((salon) => (
                    <Chip
                      key={salon.id}
                      label={salon.name}
                      onPress={() => onSalonPress(salon)}
                      color={chipBeige}
                      textColor={darkBrown}
                      fullWidth={true}
                    />
                  ))}
                </View>
              ) : searchType === 'service' && filteredServices.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 8 }}>
                  {filteredServices.map((service) => {
                    // Resolve parent name
                    let parentName = service.parentService?.name || "";
                    if (!parentName && service.parentServiceId) {
                      const parent = allServices.find(as => as.id === service.parentServiceId);
                      if (parent) parentName = parent.name;
                    }

                    // For Karvanpoistot category, show parent name in parentheses to distinguish duplicates
                    const isKarvanpoistot = service.category?.name === 'Karvanpoistot' || 
                      ['Sokerointi', 'IPL karvanpoisto', 'Laserkarvanpoistot'].includes(parentName);
                    
                    const displayName = isKarvanpoistot && parentName 
                      ? `${service.name} (${parentName})`
                      : service.name;

                    return (
                      <Chip
                        key={service.id}
                        label={displayName}
                        onPress={() => onServicePress(service, parentName)}
                        color={chipBeige}
                        textColor={darkBrown}
                        fullWidth={true}
                      />
                    );
                  })}
                </View>
              ) : searchType === 'category' && filteredCategoryNames.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 8 }}>
                  {filteredCategoryNames.map((name) => (
                    <Chip key={name} label={name} onPress={() => onChipPress(name)} color={chipBeige} textColor={darkBrown} fullWidth={true} />
                  ))}
                </View>
              ) : (
                <View style={{ alignItems: 'center', marginTop: 10 }}>
                  <Text style={{ fontFamily: 'Philosopher-Bold', color: darkBrown, fontSize: 16 }}>
                    Ei löytynyt
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <>
              {/* Section title */}
              <Text style={{ color: darkBrown, fontFamily: 'Philosopher-Bold', fontSize: 20 }} className="mt-8">
                Suosituimmat palvelut
              </Text>

              {/* Popular Categories - 2-1-2-1 pattern */}
              <View className="mt-5">
                {popularLoading ? (
                  <View style={{ alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <ActivityIndicator size="large" color={darkBrown} />
                  </View>
                ) : popularCategories.length > 0 ? (
                  <>
                    {/* First row - 2 categories */}
                    {popularCategories.length > 0 && (
                      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'stretch', marginBottom: 20, gap: 12 }}>
                        {popularCategories.slice(0, 2).map((category) => (
                          <Chip
                            key={category.id}
                            label={category.name}
                            onPress={() => onChipPress(category.name)}
                            color={chipBeige}
                            textColor={darkBrown}
                            fixedWidth={true}
                          />
                        ))}
                        {popularCategories.length === 1 && <View style={{ width: 160 }} />}
                      </View>
                    )}

                    {/* Second row - 1 category centered */}
                    {popularCategories.length > 2 && (
                      <View className="flex-row justify-center mb-5">
                        <Chip
                          label={popularCategories[2].name}
                          onPress={() => onChipPress(popularCategories[2].name)}
                          color={chipBeige}
                          textColor={darkBrown}
                          fixedWidth={true}
                        />
                      </View>
                    )}

                    {/* Third row - 2 categories */}
                    {popularCategories.length > 3 && (
                      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'stretch', marginBottom: 20, gap: 12 }}>
                        {popularCategories.slice(3, 5).map((category) => (
                          <Chip
                            key={category.id}
                            label={category.name}
                            onPress={() => onChipPress(category.name)}
                            color={chipBeige}
                            textColor={darkBrown}
                            fixedWidth={true}
                          />
                        ))}
                        {popularCategories.length === 4 && <View style={{ width: 160 }} />}
                      </View>
                    )}

                    {/* Fourth row - 1 category centered */}
                    {popularCategories.length > 5 && (
                      <View className="flex-row justify-center mb-5">
                        <Chip
                          label={popularCategories[5].name}
                          onPress={() => onChipPress(popularCategories[5].name)}
                          color={chipBeige}
                          textColor={darkBrown}
                          fixedWidth={true}
                        />
                      </View>
                    )}

                    {/* Continue pattern for remaining categories */}
                    {popularCategories.length > 6 && popularCategories.slice(6).map((category, idx) => {
                      const position = idx % 3;
                      if (position === 0) {
                        const nextCategory = popularCategories[6 + idx + 1];
                        return (
                          <View key={category.id} style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'stretch', marginBottom: 20, gap: 12 }}>
                            <Chip
                              label={category.name}
                              onPress={() => onChipPress(category.name)}
                              color={chipBeige}
                              textColor={darkBrown}
                              fixedWidth={true}
                            />
                            {nextCategory ? (
                              <Chip
                                label={nextCategory.name}
                                onPress={() => onChipPress(nextCategory.name)}
                                color={chipBeige}
                                textColor={darkBrown}
                                fixedWidth={true}
                              />
                            ) : (
                              <View style={{ width: 160 }} />
                            )}
                          </View>
                        );
                      } else if (position === 2) {
                        return (
                          <View key={category.id} className="flex-row justify-center mb-5">
                            <Chip
                              label={category.name}
                              onPress={() => onChipPress(category.name)}
                              color={chipBeige}
                              textColor={darkBrown}
                              fixedWidth={true}
                            />
                          </View>
                        );
                      }
                      return null;
                    })}
                  </>
                ) : (
                  <Text style={{ color: darkBrown, fontFamily: 'Philosopher-Regular', textAlign: 'center', marginTop: 10 }}>
                    No popular categories available
                  </Text>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function SalonCard({
  salon,
  onPress,
  darkBrown,
  lightBeige,
  beige
}: {
  salon: Salon;
  onPress: () => void;
  darkBrown: string;
  lightBeige: string;
  beige: string;
}) {
  return (
    <TouchableOpacity
      style={{ alignItems: "center", marginBottom: 24, position: "relative" }}
      onPress={onPress}
    >
      {/* Top Box - Salon Picture */}
      <View
        style={{
          width: 310,
          height: 200,
          backgroundColor: lightBeige,
          borderRadius: 24,
          position: "absolute",
          zIndex: 10,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden"
        }}
      >
        {salon.images && salon.images.length > 0 && salon.images[0].url ? (
          <Image
            source={{ uri: salon.images[0].url }}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 24
            }}
            resizeMode="cover"
          />
        ) : (
          <View style={{
            width: "100%",
            height: "100%",
            backgroundColor: lightBeige,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Ionicons name="business-outline" size={48} color={darkBrown} />
            <Text style={{
              color: darkBrown,
              fontFamily: "Philosopher-Regular",
              marginTop: 8,
              fontSize: 14
            }}>
              {salon.name}
            </Text>
          </View>
        )}
      </View>

      {/* Bottom Box - Salon Info */}
      <View
        style={{
          width: 310,
          height: 190,
          marginTop: 140,
          borderWidth: 2,
          borderColor: beige,
          backgroundColor: "white",
          borderRadius: 24,
          justifyContent: "center",
          paddingVertical: 16
        }}
      >
        <View style={{ marginTop: 40 }}>
          <View style={{ paddingHorizontal: 16 }}>
            <Text
              style={{
                fontFamily: "Philosopher-Bold",
                fontSize: 20,
                color: darkBrown,
                marginTop: 28
              }}
            >
              {salon.name}
            </Text>
          </View>

          <View style={{
            borderBottomWidth: 1,
            marginTop: 8,
            borderBottomColor: beige
          }} />

          <View style={{ paddingHorizontal: 16 }}>
            <Text
              style={{
                fontFamily: "Philosopher-Bold",
                fontSize: 15,
                color: "#423120",
                marginTop: 4
              }}
            >
              {salon.shortIntro || 'No description'}
            </Text>
            <Text
              style={{
                fontFamily: "Philosopher-Bold",
                fontSize: 15,
                color: "#423120",
                marginTop: 4
              }}
            >
              Location: {salon.address || 'Not specified'}
            </Text>

            <View style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-end",
              marginTop: 8
            }}>
              {/* Star Rating - 5 stars total */}
              {(() => {
                const rating = salon.averageRating || salon.rating || 0;
                const filledStars = Math.round(rating);
                const totalStars = 5;
                return (
                  <View style={{ flexDirection: "row" }}>
                    {[...Array(totalStars)].map((_, index) => (
                      <Text
                        key={index}
                        style={{
                          color: index < filledStars ? darkBrown : "#E0CFB9",
                          fontSize: 18,
                          fontFamily: "Philosopher-Bold",
                        }}
                      >
                        ★
                      </Text>
                    ))}
                  </View>
                );
              })()}
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function Chip({ label, onPress, color, textColor, fixedWidth, fullWidth }: { label: string; onPress: () => void; color: string; textColor: string; fixedWidth?: boolean; fullWidth?: boolean }) {
  // Force parentheses to new line if present
  const displayLabel = label.replace(/\s*\(/g, '\n(');

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: color,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: fullWidth ? 75 : 50, // "Bigger box" for search results (fullWidth)
        ...(fixedWidth ? { width: 160 } : {}),
        ...(fullWidth ? { width: '100%' } : {}),
      }}
    >
      <Text
        style={{ color: textColor, fontFamily: 'Philosopher-Bold', fontSize: 15, textAlign: 'center' }}
      >
        {displayLabel}
      </Text>
    </TouchableOpacity>
  );
}
