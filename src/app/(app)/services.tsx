// src/app/(app)/services.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { SafeAreaView, ScrollView, View, Text, TouchableOpacity, ActivityIndicator, Modal, Animated, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from 'expo-font';
import { useRouter, useLocalSearchParams } from "expo-router";
import getServicesByCategory from "../actions/get-services";
import getServicesBySalon from "../actions/get-services-by-salon";
import getSaloonsMap from "../actions/get-saloons-map";
import { Service } from "../types";
import { Salon } from "../../../types/salon";
import Header from "../components/Header";
import SideMenu from "../components/SideMenu";

// Colors
const darkBrown = "#423120";
const lightBrown = "#D7C3A7";
const beige = "#D9C7AF";
const veryLightBeige = "#ffffffff";

const HIUKSET_SUBCATS = [
  'Hiusten leikkauspalvelut',
  'Hiusten värjäyspalvelut',
  'Leikkaus ja värjäys',
  'Kampaukset',
  'Hoidot',
  'Hiustenpidennykset',
  'Permanentti',
  'Letit',
];

export default function ServicesPage() {
  const router = useRouter();
  const { categoryName, salonId, salonName, uiVariant, subCategory } = useLocalSearchParams<{
    categoryName: string;
    salonId?: string;
    salonName?: string;
    uiVariant?: string;
    subCategory?: string;
  }>();

  const [services, setServices] = useState<Service[]>([]);
  const [hiuksetSub, setHiuksetSub] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dynamicCategoryName, setDynamicCategoryName] = useState<string>('');
  const [isMenuVisible, setMenuVisible] = useState(false);

  // Salon state for hero carousel
  const [salon, setSalon] = useState<Salon | null>(null);
  // Hero box carousel state: 0 = title, 1+ = images
  const [heroContentIndex, setHeroContentIndex] = useState(0);

  // Get salon images array - use useMemo to prevent recalculation issues
  const salonImages = useMemo(() => {
    return salon?.images?.map(img => img.url).filter((url): url is string => Boolean(url)) || [];
  }, [salon?.images]);

  // Total pages: number of images
  const totalPages = salonImages.length;

  // Animated opacity values for smooth fade transitions
  const fadeAnims = useRef<Animated.Value[]>([]).current;

  // Initialize animated values when totalPages or salonImages change
  useEffect(() => {
    // Ensure we have enough animated values for all images
    if (totalPages > 0) {
      // Reset array if it's the wrong size
      if (fadeAnims.length !== totalPages) {
        fadeAnims.length = 0; // Clear existing
        for (let i = 0; i < totalPages; i++) {
          fadeAnims.push(new Animated.Value(i === 0 ? 1 : 0));
        }
      }
    }
  }, [totalPages, salonImages.length]);

  // Reset carousel to start from Title when images load
  useEffect(() => {
    if (salonImages.length > 0) {
      setHeroContentIndex(0);
      // Reset animations: Title (index 0) = 1, others = 0
      fadeAnims.forEach((anim, i) => {
        anim.setValue(i === 0 ? 1 : 0);
      });
    }
  }, [salonImages.length, fadeAnims]);

  // Auto-transition effect for hero box with smooth fade
  useEffect(() => {
    if (salonImages.length === 0 || totalPages === 0) return; // No images to cycle through

    const interval = setInterval(() => {
      setHeroContentIndex(prevIndex => {
        const nextIndex = (prevIndex + 1) % totalPages;
        const currentIndex = prevIndex; // Capture current index before update

        // Animate fade in next (smoother 1000ms transition)
        // We keep the previous image opaque until the new one fully covers it
        // This prevents the "dip" where background shows through
        if (fadeAnims[nextIndex]) {
          Animated.timing(fadeAnims[nextIndex], {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }).start(() => {
            // After transition is complete, hide the previous one
            if (fadeAnims[currentIndex]) {
              fadeAnims[currentIndex].setValue(0);
            }
          });
        }

        return nextIndex;
      });
    }, 3000); // 3 seconds per slide

    return () => clearInterval(interval);
  }, [salonImages.length, totalPages, fadeAnims]);

  const formatDescription = (text?: string) =>
    text ? text.replace(/\s+/g, " ").trim() : "";

  // Store pricing info for salon services (serviceId -> { price, durationMinutes })
  const [salonServicePricing, setSalonServicePricing] = useState<Map<string, { price: number; durationMinutes: number }>>(new Map());

  // Track which service has work types displayed
  const [selectedServiceWithWorkTypes, setSelectedServiceWithWorkTypes] = useState<Service | null>(null);
  // Track which parent service is selected (for salon services)
  const [selectedParentServiceId, setSelectedParentServiceId] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    'Philosopher-Regular': require("../assets/fonts/Philosopher-Regular.ttf"),
    'Philosopher-Bold': require("../assets/fonts/Philosopher-Bold.ttf"),
    'Philosopher-Italic': require("../assets/fonts/Philosopher-Italic.ttf"),
    'Philosopher-BoldItalic': require("../assets/fonts/Philosopher-BoldItalic.ttf"),
  });

  // Function to extract category names from services
  const extractCategoryNames = (services: Service[]) => {
    const categoryNames = new Set<string>();

    services.forEach(service => {
      if (service.category?.name) {
        categoryNames.add(service.category.name);
      }
      // Also check parent service category
      if (service.parentService?.category?.name) {
        categoryNames.add(service.parentService.category.name);
      }
    });

    return Array.from(categoryNames);
  };

  // Fetch services when component mounts
  useEffect(() => {
    const fetchServices = async () => {
      // Helper to process workTypes (add defaults or reorder)
      const processServiceWorkTypes = (service: any) => {
        const isKynnet = service.category?.name === 'Kynnet' || service.categoryId === '1dca56ac-d3b1-4e3c-986e-ad9b11aa6794';
        // Only Letit services (and their sub-services) should have default workTypes in Hiukset category
        const isLetit = (service.name && (service.name.includes('Letit'))) ||
          (service.parentService?.name && (service.parentService.name.includes('Letit') || service.parentService.name.includes('Letti')));
        const isHiukset = service.category?.name === 'Hiukset' ||
          service.parentService?.category?.name === 'Hiukset' ||
          (service.category?.name && HIUKSET_SUBCATS.includes(service.category.name)) ||
          (service.parentService?.category?.name && HIUKSET_SUBCATS.includes(service.parentService.category.name));
        const needsWorkTypes = !service.workTypes || (Array.isArray(service.workTypes) && service.workTypes.length === 0);

        let updatedService = { ...service };

        if (isKynnet && needsWorkTypes) {
          updatedService.workTypes = ['UUDET', 'POISTO', 'HUOLTO'];
          // console.log(`✅ Added default workTypes to ${service.name} (Kynnet category)`);
        } else if (isLetit && needsWorkTypes) {
          // Only add default workTypes for Letit services in Hiukset
          const standardHiuksetOrder = ['Ei lisäkkeitä', 'Lyhyet', 'Keskipitkät', 'Pitkät'];
          updatedService.workTypes = standardHiuksetOrder;
          // console.log(`✅ Added default workTypes to ${service.name} (Letit service)`);
        } else if (isHiukset && !needsWorkTypes) {
          // For other Hiukset services, only reorder if they already have workTypes from backend
          const standardHiuksetOrder = ['Ei lisäkkeitä', 'Lyhyet', 'Keskipitkät', 'Pitkät'];
          const standardEnumOrder = ['EI_LISAKKEITA', 'LYHYET', 'KESKIPITKAT', 'PITKAT'];
          // Determine if we should reorder existing worktypes
          const currentTypes = [...(service.workTypes || [])];

          const getSortIndex = (type: string) => {
            const norm = type.toUpperCase();
            let idx = standardEnumOrder.indexOf(norm);
            if (idx === -1) {
              // Try matching against standard display names
              idx = standardHiuksetOrder.findIndex(t => t.toUpperCase() === norm);
            }
            return idx;
          };

          const hasHiuksetTypes = currentTypes.some(t => getSortIndex(t) !== -1);

          if (hasHiuksetTypes) {
            currentTypes.sort((a, b) => {
              const idxA = getSortIndex(a);
              const idxB = getSortIndex(b);

              // If both are recognized, sort by index
              if (idxA !== -1 && idxB !== -1) return idxA - idxB;

              // Put recognized items first
              if (idxA !== -1) return -1;
              if (idxB !== -1) return 1;

              return 0;
            });

            updatedService.workTypes = currentTypes;
            // console.log(`✅ Reordered workTypes for ${service.name} (Hiukset category)`);
          }
        }
        return updatedService;
      };

      // If coming from salon-sector (has salonId), fetch services for that specific salon
      if (salonId) {
        try {
          setLoading(true);
          setError(null);
          const data = await getServicesBySalon(salonId);

          // Normalize workTypes field (handle both camelCase and snake_case from API)
          const normalizedData = data.map((service: any) => {
            // Normalize workTypes - check both camelCase and snake_case
            const workTypes = service.workTypes || service.work_types || service.WorkTypes;

            // Also normalize parentService workTypes if it exists
            let normalizedParentService = service.parentService;
            if (service.parentService) {
              const parentWorkTypes = service.parentService.workTypes || service.parentService.work_types || service.parentService.WorkTypes;
              normalizedParentService = {
                ...service.parentService,
                workTypes: parentWorkTypes && Array.isArray(parentWorkTypes) ? parentWorkTypes : undefined,
              };
            }

            let normalizedService = {
              ...service,
              workTypes: workTypes && Array.isArray(workTypes) ? workTypes : undefined,
              parentService: normalizedParentService,
            };

            // Apply processServiceWorkTypes helper
            return processServiceWorkTypes(normalizedService);
          });

          // Extract pricing info from saloonServices and store in map
          const pricingMap = new Map<string, { price: number; durationMinutes: number }>();
          normalizedData.forEach(service => {
            // Check if service has saloonServices array
            if (service.saloonServices && service.saloonServices.length > 0) {
              const salonServiceInfo = service.saloonServices.find(ss => ss.saloonId === salonId);
              if (salonServiceInfo) {
                pricingMap.set(service.id, {
                  price: salonServiceInfo.price,
                  durationMinutes: salonServiceInfo.durationMinutes
                });
                console.log(`Pricing from saloonServices for ${service.name}:`, salonServiceInfo.price, salonServiceInfo.durationMinutes);
              }
            } else {
              // API might return services with pricing directly as properties
              // Check if the service object itself has price and durationMinutes
              const serviceAny = service as any;
              if (serviceAny.price !== undefined && serviceAny.durationMinutes !== undefined) {
                pricingMap.set(service.id, {
                  price: serviceAny.price,
                  durationMinutes: serviceAny.durationMinutes
                });
                console.log(`Pricing from service object for ${service.name}:`, serviceAny.price, serviceAny.durationMinutes);
              } else {
                console.warn(`No pricing info found for service: ${service.name} (ID: ${service.id})`);
              }
            }
          });
          setSalonServicePricing(pricingMap);
          console.log('Salon service pricing map size:', pricingMap.size);
          console.log('Salon service pricing map:', Object.fromEntries(pricingMap));

          // Filter by category if categoryName is provided (coming from salon-sector category click)
          // Skip filtering if categoryName is "Kaikki palvelut" (it's just a heading, not a real category)
          let filteredData = normalizedData;
          if (categoryName && categoryName !== 'Kaikki palvelut') {
            filteredData = normalizedData.filter(service =>
              service.category?.name === categoryName ||
              service.parentService?.category?.name === categoryName
            );
            console.log('Filtered services by category:', categoryName, filteredData.length, 'of', normalizedData.length);
          }

          // Log services after normalization to verify workTypes are present
          console.log('Services after normalization (first 3):', normalizedData.slice(0, 3).map(s => ({
            name: s.name,
            workTypes: s.workTypes,
            category: s.category?.name
          })));

          setServices(filteredData);

          // Set dynamic category name - use categoryName if provided, otherwise extract from services
          // Never use "Kaikki palvelut" as it's just a heading, not a category
          if (categoryName && categoryName !== 'Kaikki palvelut') {
            setDynamicCategoryName(categoryName);
          } else {
            const categoryNames = extractCategoryNames(filteredData);
            const categoryDisplayName = categoryNames.length > 0
              ? categoryNames.join(', ')
              : 'Palvelut';
            setDynamicCategoryName(categoryDisplayName);
          }

          console.log('Fetched services for salon:', salonId, filteredData);
          console.log('Category name:', categoryName || 'All');
        } catch (err) {
          console.error('Error fetching salon services:', err);
          setError(err instanceof Error ? err.message : 'Failed to fetch salon services');
        } finally {
          setLoading(false);
        }
        return;
      }

      // Normal flow - fetch services by category
      if (!categoryName) {
        setError('No category selected');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await getServicesByCategory(categoryName);



        // Normalize workTypes field (handle both camelCase and snake_case from API)
        const normalizedData = data.map((service: any) => {
          // Normalize workTypes - check both camelCase and snake_case
          const workTypes = service.workTypes || service.work_types || service.WorkTypes;
          let normalizedService = {
            ...service,
            workTypes: workTypes && Array.isArray(workTypes) ? workTypes : undefined,
            // Also normalize sub-services if they exist
            subServices: service.subServices ? service.subServices.map((sub: any) => {
              const subWorkTypes = sub.workTypes || sub.work_types || sub.WorkTypes;
              let normalizedSub = {
                ...sub,
                workTypes: subWorkTypes && Array.isArray(subWorkTypes) ? subWorkTypes : undefined
              };
              // Apply recursive processing to sub-service
              return processServiceWorkTypes(normalizedSub);
            }) : undefined
          };

          // Apply processing to main service
          return processServiceWorkTypes(normalizedService);
        });


        setServices(normalizedData);
        console.log('Fetched services for category:', categoryName, normalizedData);
        // Log workTypes for debugging
        normalizedData.forEach((service: Service) => {
          if (service.workTypes && service.workTypes.length > 0) {
            console.log(`✅ Service "${service.name}" has workTypes:`, service.workTypes);
          }
          // Also check sub-services
          if (service.subServices) {
            service.subServices.forEach((sub: Service) => {
              if (sub.workTypes && sub.workTypes.length > 0) {
                console.log(`✅ Sub-service "${sub.name}" has workTypes:`, sub.workTypes);
              }
            });
          }
        });
      } catch (err) {
        console.error('Error fetching services:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch services');
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, [categoryName, salonId]);

  useEffect(() => {
    if (uiVariant === 'hiukset' && typeof subCategory === 'string') {
      setHiuksetSub(subCategory);
    }
  }, [uiVariant, subCategory]);

  // Fetch salon data when salonId is available (for carousel)
  useEffect(() => {
    const fetchSalonData = async () => {
      if (!salonId) {
        setSalon(null);
        return;
      }

      try {
        // Fetch all salons and find the specific one
        const allSalons = await getSaloonsMap();
        const foundSalon = allSalons.find(s => s.id === salonId);

        if (foundSalon) {
          setSalon(foundSalon);
          console.log('Fetched salon for carousel:', foundSalon.name, 'Images:', foundSalon.images?.length);
        } else {
          console.warn('Salon not found for ID:', salonId);
          setSalon(null);
        }
      } catch (err) {
        console.error('Error fetching salon data for carousel:', err);
        setSalon(null);
      }
    };

    if (salonId) {
      fetchSalonData();
    }
  }, [salonId]);

  if (!fontsLoaded) {
    return null;
  }

  // Group services by parent-child relationship
  const groupServices = (services: Service[]) => {
    // If coming from salon (salonId exists), handle sub-services differently
    if (salonId) {
      console.log('Grouping salon services, salonId:', salonId);
      console.log('Services to group:', services.length);

      // For salon-specific services, group by their parent services
      const parentServices = new Map();

      services.forEach(service => {
        console.log('Processing service:', service.name, 'parentService:', !!service.parentService, 'workTypes:', service.workTypes);
        if (service.parentService) {
          const parentId = service.parentService.id;
          console.log('Adding to parent:', parentId, service.parentService.name);
          if (!parentServices.has(parentId)) {
            parentServices.set(parentId, {
              ...service.parentService,
              subServices: []
            });
          }
          // Make sure we preserve workTypes when pushing to subServices
          parentServices.get(parentId).subServices.push({
            ...service,
            workTypes: service.workTypes // Explicitly preserve workTypes
          });
        } else {
          console.log('No parent service, treating as main service');
          // If no parent service, treat as main service
          if (!parentServices.has(service.id)) {
            parentServices.set(service.id, {
              ...service,
              subServices: []
            });
          }
        }
      });

      const result = Array.from(parentServices.values());
      console.log('Grouped result:', result.length, 'groups');
      return result;
    }

    // Normal flow - group by parent-child relationship
    const mainServices = services.filter(service => !service.parentServiceId);

    // For each main service, find its sub-services
    return mainServices.map(mainService => ({
      ...mainService,
      subServices: services.filter(service => service.parentServiceId === mainService.id)
    }));
  };

  const groupedServices = groupServices(services);

  // For Hiukset: when a subcategory is selected, only show that parent group
  const hiuksetGroups = useMemo(() => {
    if (uiVariant === 'hiukset' && !salonId && hiuksetSub) {
      const target = hiuksetSub.toLowerCase();
      return groupedServices.filter(g => (g.name || '').toLowerCase() === target);
    }
    return groupedServices;
  }, [groupedServices, uiVariant, salonId, hiuksetSub]);

  // Debug logging
  console.log('Services count:', services.length);
  console.log('Grouped services count:', groupedServices.length);
  console.log('Grouped services:', groupedServices.map(g => ({ name: g.name, subServicesCount: g.subServices?.length || 0 })));

  // Render parent services as boxes (for salon services)
  const renderParentServices = () => {
    if (!salonId || groupedServices.length === 0) return null;

    return (
      <View style={{ paddingHorizontal: 20, marginTop: 30 }}>
        {groupedServices.map((parentService) => (
          <TouchableOpacity
            key={parentService.id}
            activeOpacity={0.7}
            style={{
              backgroundColor: "white",
              borderRadius: 30,
              borderWidth: 3,
              borderColor: lightBrown,
              width: 330,
              minHeight: 84,
              justifyContent: "center",
              marginBottom: 12,
              alignSelf: "center",
              paddingVertical: 12,
            }}
            onPress={() => setSelectedParentServiceId(parentService.id)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 20,
                    color: darkBrown,
                    fontFamily: "Philosopher-Bold",
                  }}
                >
                  {parentService.name}
                </Text>
                {parentService.subServices && parentService.subServices.length > 0 && (
                  <Text
                    style={{
                      fontSize: 14,
                      color: darkBrown,
                      fontFamily: "Philosopher-Regular",
                      opacity: 0.6,
                      marginTop: 4,
                    }}
                  >
                    {parentService.subServices.length} palvelua
                  </Text>
                )}
              </View>
              <Ionicons name="arrow-forward" size={22} color={darkBrown} />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Render sub-services for selected parent (for salon services)
  const renderSubServicesForParent = () => {
    if (!salonId || !selectedParentServiceId) return null;

    const selectedParent = groupedServices.find(g => g.id === selectedParentServiceId);
    if (!selectedParent || !selectedParent.subServices || selectedParent.subServices.length === 0) return null;

    return (
      <View style={{ marginTop: 30 }}>
        {/* Parent service title */}
        <Text
          style={{
            textAlign: "center",
            fontSize: 30,
            color: darkBrown,
            fontFamily: "Philosopher-Bold",
            marginBottom: 20,
          }}
        >
          {selectedParent.name}
        </Text>

        {/* Sub-services */}
        {selectedParent.subServices.map((subService) => (
          <View key={subService.id} style={{ marginBottom: 12 }}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={{
                backgroundColor: "white",
                borderRadius: 30,
                borderWidth: 3,
                borderColor: lightBrown,
                width: 330,
                // Keep name-only boxes as-is; normalize description cards to a consistent height
                minHeight: subService.description ? 100 : 84,
                justifyContent: "center",
                alignSelf: "center",
                paddingVertical: 12,
              }}
              onPress={() => handleServicePress(subService)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16 }}>
                <View style={{ flex: 1 }}>
                  {(() => {
                    const name = subService.name || '';
                    const trimmed = name.trim();
                    // If name has parentheses, split: non-paren on top, paren on bottom
                    if (trimmed.includes('(') && trimmed.includes(')')) {
                      const parenStart = trimmed.indexOf('(');
                      const beforeParen = trimmed.substring(0, parenStart).trim();
                      const parenPart = trimmed.substring(parenStart).trim();
                      if (beforeParen && parenPart) {
                        // If parenthetical part is short (15 chars or less), keep on one line
                        if (parenPart.length <= 15) {
                          return (
                            <Text
                              style={{
                                fontSize: 20,
                                color: darkBrown,
                                fontFamily: "Philosopher-Bold",
                              }}
                            >
                              {name}
                            </Text>
                          );
                        }
                        // Otherwise split into two lines
                        return (
                          <View>
                            <Text
                              style={{
                                fontSize: 20,
                                color: darkBrown,
                                fontFamily: "Philosopher-Bold",
                              }}
                            >
                              {beforeParen}
                            </Text>
                            <Text
                              style={{
                                fontSize: 20,
                                color: darkBrown,
                                fontFamily: "Philosopher-Bold",
                              }}
                            >
                              {parenPart}
                            </Text>
                          </View>
                        );
                      }
                    }
                    return (
                      <Text
                        style={{
                          fontSize: 20,
                          color: darkBrown,
                          fontFamily: "Philosopher-Bold",
                        }}
                      >
                        {name}
                      </Text>
                    );
                  })()}

                  {subService.description && (
                    <Text
                      style={{
                        fontSize: 15,
                        color: darkBrown,
                        fontFamily: "Philosopher-Bold",
                        opacity: 0.6,
                        marginTop: 4,
                        lineHeight: 20,
                      }}
                      numberOfLines={4}
                    >
                      {formatDescription(subService.description)}
                    </Text>
                  )}
                </View>
                {subService.durationMinutes && (
                  <Text
                    style={{
                      fontSize: 14,
                      color: darkBrown,
                      fontFamily: "Philosopher-Regular",
                      opacity: 0.6,
                      marginTop: 2,
                    }}
                  >
                    {subService.durationMinutes} min
                  </Text>
                )}
              </View>
            </TouchableOpacity>
            {/* Show work types if this service is selected */}
            {selectedServiceWithWorkTypes?.id === subService.id && renderWorkTypes(subService)}
          </View>
        ))}
      </View>
    );
  };

  const handleServicePress = (service: Service) => {
    console.log(`Selected service: ${service.name} (ID: ${service.id})`);
    console.log('Service workTypes:', service.workTypes);
    console.log('Service workTypes type:', typeof service.workTypes);
    console.log('Service workTypes length:', service.workTypes?.length);
    console.log('Full service object:', JSON.stringify(service, null, 2));
    console.log('Current salonId:', salonId);
    console.log('Current salonName:', salonName);
    console.log('Salon service pricing map size:', salonServicePricing.size);

    // Check if service has workTypes (for both salon and non-salon flows)
    // Also check for work_types (snake_case) in case API returns it that way
    let workTypes = service.workTypes || (service as any).work_types || (service as any).WorkTypes;

    // Check if category is "Kynnet" - if so, use default workTypes if service doesn't have them
    const isKynnetCategory = service.category?.name === 'Kynnet' || service.categoryId === '1dca56ac-d3b1-4e3c-986e-ad9b11aa6794';
    const isHiuksetCategory = service.category?.name === 'Hiukset' || service.parentService?.category?.name === 'Hiukset';

    // If no workTypes or empty array, and category is Kynnet, use default workTypes immediately
    if (isKynnetCategory && (!workTypes || (Array.isArray(workTypes) && workTypes.length === 0))) {
      workTypes = ['UUDET', 'POISTO', 'HUOLTO'];

    } else if ((!workTypes || (Array.isArray(workTypes) && workTypes.length === 0)) && service.parentService) {
      // If still no workTypes, check parent service (for non-Kynnet categories)
      const parentWorkTypes = service.parentService.workTypes || (service.parentService as any).work_types || (service.parentService as any).WorkTypes;
      // Only use parent workTypes if it's not empty
      if (parentWorkTypes && Array.isArray(parentWorkTypes) && parentWorkTypes.length > 0) {
        workTypes = parentWorkTypes;
      }
    }

    const hasWorkTypes = workTypes && Array.isArray(workTypes) && workTypes.length > 0;

    console.log('hasWorkTypes check:', hasWorkTypes);
    console.log('workTypes value:', workTypes);
    console.log('Service workTypes from object:', service.workTypes);
    console.log('Service work_types from object:', (service as any).work_types);
    console.log('Service WorkTypes from object:', (service as any).WorkTypes);
    console.log('ParentService workTypes:', service.parentService?.workTypes);

    // Show work types if service has them (for both salon and non-salon flows)
    if (hasWorkTypes) {
      // Toggle: if clicking the same service that's already selected, close it
      if (selectedServiceWithWorkTypes?.id === service.id) {
        console.log('✅ Service already selected, closing work types');
        setSelectedServiceWithWorkTypes(null);
        return;
      }

      console.log('✅ Service has workTypes, showing work type selector');
      // Ensure workTypes is in the correct format
      const serviceWithWorkTypes = {
        ...service,
        workTypes: Array.isArray(workTypes) ? workTypes : []
      };
      setSelectedServiceWithWorkTypes(serviceWithWorkTypes);
      return;
    }

    console.log('❌ No workTypes found, proceeding to navigation');

    // If coming from a salon, navigate directly to checkout
    if (salonId) {
      // Get pricing info from our pricing map
      const pricingInfo = salonServicePricing.get(service.id);

      console.log('Found pricing info:', pricingInfo);

      if (pricingInfo) {
        console.log(`✅ Navigating directly to checkout for salon: ${salonName}`);
        router.push({
          pathname: "/(app)/checkout",
          params: {
            saloonId: salonId,
            saloonName: salonName || 'Salon',
            serviceId: service.id,
            serviceName: service.name,
            parentServiceName: service.parentService?.name,
            categoryName: categoryName || dynamicCategoryName || 'Service',
            price: pricingInfo.price.toString(),
            durationMinutes: pricingInfo.durationMinutes.toString()
          }
        });
        return;
      } else {
        console.warn('⚠️ No pricing info found for this service, falling back to saloons page');
        // Fallback to saloons page
        router.push({
          pathname: "/(app)/saloons",
          params: {
            serviceId: service.id,
            serviceName: service.name,
            parentServiceName: service.parentService?.name,
            categoryName: categoryName || dynamicCategoryName || 'Service',
            salonId: salonId
          }
        });
        return;
      }
    }

    // Normal flow - Navigate to saloons page with serviceId and serviceName
    console.log('Normal flow - navigating to saloons page');
    router.push({
      pathname: "/(app)/saloons",
      params: {
        serviceId: service.id,
        serviceName: service.name,
        parentServiceName: service.parentService?.name,
        categoryName: categoryName
      }
    });
  };

  const handleWorkTypePress = (service: Service, workType: string) => {
    console.log(`Selected work type: ${workType} for service: ${service.name}`);
    setSelectedServiceWithWorkTypes(null);

    // If coming from a salon, navigate to checkout with workType
    if (salonId) {
      const pricingInfo = salonServicePricing.get(service.id);
      if (pricingInfo) {
        console.log(`✅ Navigating to checkout with workType for salon: ${salonName}`);
        router.push({
          pathname: "/(app)/checkout",
          params: {
            saloonId: salonId,
            saloonName: salonName || 'Salon',
            serviceId: service.id,
            serviceName: service.name,
            parentServiceName: service.parentService?.name,
            categoryName: categoryName || dynamicCategoryName || 'Service',
            price: pricingInfo.price.toString(),
            durationMinutes: pricingInfo.durationMinutes.toString(),
            workType: workType
          }
        });
        return;
      }
    }

    // Normal flow - Navigate to saloons with workType parameter
    router.push({
      pathname: "/(app)/saloons",
      params: {
        serviceId: service.id,
        serviceName: service.name,
        parentServiceName: service.parentService?.name,
        categoryName: categoryName || dynamicCategoryName || 'Service',
        workType: workType
      }
    });
  };

  // Helper to format work type for display
  const formatWorkType = (workType: string): string => {
    const mapping: Record<string, string> = {
      'UUDET': 'Uudet',
      'POISTO': 'Poisto',
      'HUOLTO': 'Huolto',
      'EI_LISAKKEITA': 'Ei lisäkkeitä',
      'LYHYET': 'Lyhyet',
      'KESKIPITKAT': 'Keskipitkät',
      'PITKAT': 'Pitkät'
    };
    return mapping[workType] || workType;
  };

  // Render work types UI below a service
  const renderWorkTypes = (service: Service) => {
    if (!service.workTypes || service.workTypes.length === 0) return null;

    return (
      <View
        style={{
          backgroundColor: 'white',
          borderRadius: 24,

          width: 330,
          alignSelf: 'center',
          marginTop: 12,
          marginBottom: 12,
          paddingVertical: 20,
          paddingHorizontal: 16,
        }}
      >

        {/* Work Types Row */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {service.workTypes.map((workType, index) => (
            <React.Fragment key={workType}>
              <TouchableOpacity
                onPress={() => handleWorkTypePress(service, workType)}
                activeOpacity={0.7}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    color: darkBrown,
                    fontFamily: 'Philosopher-Bold',
                  }}
                >
                  {formatWorkType(workType)}
                </Text>
              </TouchableOpacity>
              {index < service.workTypes!.length - 1 && (
                <View
                  style={{
                    width: 3,
                    height: 24,
                    backgroundColor: lightBrown,
                    marginHorizontal: -7,
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </View>
      </View>
    );
  };

  // Hiukset custom helpers (moved constants to top of file)

  const renderHiuksetSubList = () => (
    <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
      {HIUKSET_SUBCATS.map((label) => (
        < TouchableOpacity
          key={label}
          onPress={() => router.push({ pathname: '/services', params: { categoryName, uiVariant: 'hiukset', subCategory: label } })
          }
          style={{
            backgroundColor: 'white',
            borderWidth: 3,
            borderColor: lightBrown,
            borderRadius: 30,
            width: 330,
            minHeight: 84,
            alignSelf: 'center',
            paddingVertical: 12,
            paddingHorizontal: 16,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Text style={{ color: darkBrown, fontFamily: 'Philosopher-Bold', fontSize: 18 }} numberOfLines={1}>{label}</Text>
          <Ionicons name="arrow-forward" size={22} color={darkBrown} />
        </TouchableOpacity >
      ))}
    </View >
  );

  const filterHiuksetBySub = (list: Service[], sub?: string) => {
    if (!sub) return list;
    const s = sub.toLowerCase();
    const filtered = list.filter(svc =>
      (svc.parentService?.name && svc.parentService.name.toLowerCase() === s) ||
      (svc.name && svc.name.toLowerCase().includes(s.split(' ')[0]))
    );
    return filtered.length ? filtered : list;
  };

  // Karvanpoistot: sections per parent group with title, description, and two-column sub-service grid
  const renderKarvanpoistotSections = () => (
    <View style={{ paddingHorizontal: 20, marginTop: 30 }}>
      {(groupedServices as any[]).map((g: any) => {
        const subs = (g.subServices || []).filter((s: any) => !!s?.name);
        const rows: any[] = [];
        for (let i = 0; i < subs.length; i += 2) rows.push(subs.slice(i, i + 2));
        return (
          <View key={g.id || g.name} style={{ marginBottom: 24 }}>
            {/* Section Title */}
            {g.name ? (
              <Text style={{ textAlign: 'center', color: darkBrown, fontFamily: 'Philosopher-Bold', fontSize: 30, marginBottom: 6 }}>
                {g.name}
              </Text>
            ) : null}
            {/* Optional description under title */}
            {g.description ? (
              <Text style={{ textAlign: 'center', color: darkBrown, fontSize: 15, opacity: 0.7, fontFamily: 'Philosopher-Regular', marginBottom: 12 }}>
                {g.description}
              </Text>
            ) : null}
            {/* Two-column grid of sub-services */}
            {rows.map((row, idx) => (
              <View key={idx} style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                {row.map((s: any) => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => {
                      if (s.id) {
                        router.push({
                          pathname: '/(app)/saloons',
                          params: {
                            serviceId: s.id,
                            serviceName: s.name,
                            categoryName: categoryName,
                            parentServiceName: g.name
                          }
                        });
                      } else {
                        // Fallback: keep old behavior if id missing
                        router.push({ pathname: '/services', params: { categoryName, uiVariant: 'karvanpoistot', subCategory: s.name } });
                      }
                    }}
                    style={{
                      backgroundColor: 'white',
                      borderWidth: 3,
                      borderColor: lightBrown,
                      borderRadius: 24,
                      width: 160,
                      minHeight: 90,
                      paddingVertical: 10,
                      paddingHorizontal: 10,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginHorizontal: 10,
                    }}
                  >
                    <Text style={{ color: darkBrown, fontFamily: 'Philosopher-Bold', fontSize: 16, textAlign: 'center' }} numberOfLines={2}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: veryLightBeige }}>
      {/* Header - Full Width */}
      <Header
        showBack={true}
        showMenu={true}
        onBackPress={() => {
          // If a parent service is selected, go back to parent services list
          if (selectedParentServiceId) {
            setSelectedParentServiceId(null);
          } else {
            router.back();
          }
        }}
        onMenuPress={() => setMenuVisible(true)}
        disableSafeAreaPadding={true}
      />

      {/* Salon Info Header - Show when coming from map */}


      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* HERO SECTION - Conditional rendering based on flow */}
        {salonId ? (
          // Hero section when coming from salon-sector (salon-selector)
          <View style={{ backgroundColor: beige, height: 320, position: "relative" }}>
            {/* Background vectors (left/right) - behind the hero card */}
            <Image
              source={require("../../../assets/vector-left.png")}
              style={{
                position: "absolute",
                top: 97,
                left: -45,
                width: 220,
                height: 200,
                opacity: 0.9,
              }}
              resizeMode="contain"
            />
            <Image
              source={require("../../../assets/vector-right.png")}
              style={{
                position: "absolute",
                top: 18,
                right: -45,
                width: 220,
                height: 200,
                opacity: 0.9,
              }}
              resizeMode="contain"
            />

            {/* White Box - Centered */}
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <View
                style={{
                  width: 300,
                  height: 195,
                  backgroundColor: "white",
                  borderRadius: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                  position: "relative",
                  overflow: "hidden"
                }}
              >
                {/* Images - each rendered with absolute positioning, animates opacity */}
                {salonImages.length > 0 && fadeAnims.length >= salonImages.length ? (
                  salonImages.map((imageUrl, index) => {
                    const animValue = fadeAnims[index];
                    if (!animValue) return null;
                    return (
                      <Animated.Image
                        key={`salon-image-${index}`}
                        source={{ uri: imageUrl }}
                        style={{
                          width: "100%",
                          height: "100%",
                          borderRadius: 24,
                          position: "absolute",
                          opacity: animValue,
                          zIndex: heroContentIndex === index ? 10 : 0
                        }}
                        resizeMode="cover"
                      />
                    );
                  })
                ) : (
                  /* Fallback if no images - Show Title */
                  <View
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "white"
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Philosopher-Bold",
                        fontSize: 40,
                        color: darkBrown,
                        textAlign: "center",
                        paddingHorizontal: 16
                      }}
                    >
                      {salonName || salon?.name || "Salon"} Salonki
                    </Text>
                  </View>
                )}

                {/* Ellipses at bottom - indicate current page */}
                {salonImages.length > 1 && (
                  <View style={{
                    position: "absolute",
                    bottom: 16,
                    flexDirection: "row",
                    zIndex: 20
                  }}>
                    {/* Generate ellipses based on total pages (images only), max 4 */}
                    {Array.from({ length: Math.min(totalPages, 4) }).map((_, index) => {
                      // If we have more pages than dots, keep the last dot active for subsequent pages
                      const isActive = heroContentIndex === index || (index === 3 && heroContentIndex > 3);

                      return (
                        <View
                          key={index}
                          style={{
                            width: 11,
                            height: 11,
                            marginLeft: index > 0 ? 5 : 0,
                            backgroundColor: isActive ? darkBrown : beige,
                            borderRadius: 5.5
                          }}
                        />
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          </View>
        ) : (
          // Normal hero section
          <View style={{ backgroundColor: lightBrown, paddingBottom: 30 }}>
            <View style={{ alignItems: "center", marginTop: 20 }}>
              <View style={{ position: "relative", width: 320, height: 200, borderRadius: 24, overflow: "hidden" }}>
                <Image
                  source={require("../../../assets/Vector-2.png")}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="contain"
                />

                {/* Title centered over image */}
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 40,
                      color: "#423120",
                      fontFamily: "Philosopher-Bold",
                      textAlign: "center",
                      paddingHorizontal: 20,
                    }}
                  >
                    {categoryName || "Services"}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Content with padding */}
        <View style={{ paddingHorizontal: 20 }}>
          {/* Loading State */}
          {loading && (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", marginTop: 50 }}>
              <ActivityIndicator size="large" color={darkBrown} />
              <Text
                style={{
                  marginTop: 10,
                  fontFamily: "Philosopher-Bold",
                  fontSize: 16,
                  color: darkBrown,
                }}
              >

              </Text>
            </View>
          )}

          {/* Error State */}
          {error && (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", marginTop: 50 }}>
              <Text
                style={{
                  fontFamily: "Philosopher-Bold",
                  fontSize: 16,
                  color: "red",
                  textAlign: "center",
                  marginBottom: 20,
                }}
              >
                Error: {error}
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor: lightBrown,
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 8,
                }}
                onPress={() => {
                  // Retry fetching
                  if (categoryName) {
                    setError(null);
                    setLoading(true);
                    getServicesByCategory(categoryName)
                      .then(setServices)
                      .catch((err) => setError(err.message))
                      .finally(() => setLoading(false));
                  }
                }}
              >
                <Text style={{ fontFamily: "Philosopher-Bold", color: darkBrown }}>
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* SERVICE CATEGORIES */}
          {!loading && !error && (
            <View>
              {/* Hiukset landing (no sub chosen) */}
              {uiVariant === 'hiukset' && !salonId && !hiuksetSub && renderHiuksetSubList()}
              {/* Karvanpoistot landing sections */}
              {uiVariant === 'karvanpoistot' && !salonId && !subCategory && renderKarvanpoistotSections()}

              {/* For salon services: show parent services first, then sub-services when selected */}
              {salonId && !selectedParentServiceId && renderParentServices()}
              {salonId && selectedParentServiceId && renderSubServicesForParent()}

              {/* Normal flow: show services grouped by parent */}
              {!salonId && (uiVariant !== 'hiukset' || !!hiuksetSub || !!salonId) && (uiVariant !== 'karvanpoistot' || !!subCategory || !!salonId) && (
                (uiVariant === 'karvanpoistot' && !salonId && subCategory ? hiuksetGroups : hiuksetGroups).length > 0 ? (
                  (uiVariant === 'karvanpoistot' && !salonId && subCategory ? hiuksetGroups : hiuksetGroups)
                    .map((service) => ({
                      ...service,
                      subServices: (uiVariant === 'hiukset' && !salonId && hiuksetSub)
                        ? service.subServices // When hiuksetSub is set, hiuksetGroups already filtered to the correct parent, so show all subServices
                        : (uiVariant === 'karvanpoistot' && !salonId && subCategory)
                          ? (service.subServices || []).filter(svc => (svc.name || '').toLowerCase() === String(subCategory).toLowerCase())
                          : service.subServices,
                    }))
                    .filter((service) => (service.subServices?.length || 0) > 0)
                    .map((service, idx) => (
                      <View
                        key={service.id}
                        style={{
                          marginTop: idx === 0 ? 30 : 40,
                        }}
                      >
                        {/* Main Service as Category Title */}
                        <Text
                          style={{
                            textAlign: "center",
                            fontSize: 28,
                            color: darkBrown,
                            fontFamily: "Philosopher-Bold",
                            marginBottom: 20,
                          }}
                        >
                          {service.name}
                        </Text>

                        {/* Sub Service Buttons */}
                        {service.subServices && service.subServices.length > 0 ? (
                          <>
                            {service.subServices.map((subService) => (
                              <View key={subService.id}>
                                <TouchableOpacity
                                  activeOpacity={0.7}
                                  style={{
                                    backgroundColor: "white",
                                    borderRadius: 30,
                                    borderWidth: 3,
                                    borderColor: lightBrown,
                                    width: 330,
                                    minHeight: subService.description ? 140 : 84,
                                    justifyContent: "center",
                                    marginBottom: 12,
                                    alignSelf: "center",
                                    paddingVertical: 12,
                                    opacity: 1,
                                  }}
                                  onPress={() => handleServicePress(subService)}
                                >
                                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16 }}>
                                    <View style={{ flex: 1 }}>
                                      {(() => {
                                        const name = subService.name || '';
                                        const trimmed = name.trim();
                                        // If name has parentheses, split: non-paren on top, paren on bottom
                                        if (trimmed.includes('(') && trimmed.includes(')')) {
                                          const parenStart = trimmed.indexOf('(');
                                          const beforeParen = trimmed.substring(0, parenStart).trim();
                                          const parenPart = trimmed.substring(parenStart).trim();
                                          if (beforeParen && parenPart) {
                                            // If parenthetical part is short (15 chars or less), keep on one line
                                            if (parenPart.length <= 15) {
                                              return (
                                                <Text
                                                  style={{
                                                    fontSize: 20,
                                                    color: darkBrown,
                                                    fontFamily: "Philosopher-Bold",
                                                  }}
                                                >
                                                  {name}
                                                </Text>
                                              );
                                            }
                                            // Otherwise split into two lines
                                            return (
                                              <View>
                                                <Text
                                                  style={{
                                                    fontSize: 20,
                                                    color: darkBrown,
                                                    fontFamily: "Philosopher-Bold",
                                                  }}
                                                >
                                                  {beforeParen}
                                                </Text>
                                                <Text
                                                  style={{
                                                    fontSize: 20,
                                                    color: darkBrown,
                                                    fontFamily: "Philosopher-Bold",
                                                  }}
                                                >
                                                  {parenPart}
                                                </Text>
                                              </View>
                                            );
                                          }
                                        }
                                        return (
                                          <Text
                                            style={{
                                              fontSize: 20,
                                              color: darkBrown,
                                              fontFamily: "Philosopher-Bold",
                                            }}
                                          >
                                            {name}
                                          </Text>
                                        );
                                      })()}

                                      {/* Add description here */}
                                      {subService.description && (
                                        <Text
                                          style={{
                                            fontSize: 15,
                                            color: darkBrown,
                                            fontFamily: "Philosopher-Bold",
                                            opacity: 0.6,
                                            marginTop: 4,
                                            lineHeight: 20,
                                          }}
                                          numberOfLines={4}
                                        >
                                          {formatDescription(subService.description)}
                                        </Text>
                                      )}

                                    </View>
                                    {subService.durationMinutes && (
                                      <Text
                                        style={{
                                          fontSize: 14,
                                          color: darkBrown,
                                          fontFamily: "Philosopher-Regular",
                                          opacity: 0.6,
                                          marginTop: 2,
                                        }}
                                      >
                                        {subService.durationMinutes} min
                                      </Text>
                                    )}
                                  </View>
                                </TouchableOpacity>
                                {/* Show work types if this service is selected */}
                                {selectedServiceWithWorkTypes?.id === subService.id && renderWorkTypes(subService)}
                              </View>
                            ))}
                            {/* Custom style text for Letit */}
                            {service.name === 'Letit' && (
                              <Text
                                style={{
                                  textAlign: "center",
                                  fontSize: 18,
                                  color: darkBrown,
                                  fontFamily: "Philosopher-Regular",
                                  opacity: 0.7,
                                  marginTop: 20,
                                  marginBottom: 12,
                                  paddingHorizontal: 20,
                                }}
                              >
                                Custom-tyyli halukkaille — ota yhteyttä suoraan hoitolaan tai tekijään lisätietoja varten.
                              </Text>
                            )}
                          </>
                        ) : (
                          // If no sub-services, show the main service as a clickable button
                          <View>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              style={{
                                backgroundColor: "white",
                                borderRadius: 30,
                                borderWidth: 3,
                                borderColor: lightBrown,
                                width: 330,
                                minHeight: service.description ? 140 : 84,
                                justifyContent: "center",
                                marginBottom: 12,
                                alignSelf: "center",
                                paddingVertical: 12,
                                opacity: 1,
                              }}
                              onPress={() => handleServicePress(service)}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16 }}>
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={{
                                      fontSize: 20,
                                      color: darkBrown,
                                      fontFamily: "Philosopher-Bold",
                                    }}
                                  >
                                    {service.name}
                                  </Text>

                                  {/* Add description here */}
                                  {service.description && (
                                    <Text
                                      style={{
                                        fontSize: 15,
                                        color: darkBrown,
                                        fontFamily: "Philosopher-Bold",
                                        opacity: 0.6,
                                        marginTop: 4,
                                        lineHeight: 20,
                                      }}
                                      numberOfLines={4}
                                    >
                                      {formatDescription(service.description)}
                                    </Text>
                                  )}

                                  {service.price && (
                                    <Text
                                      style={{
                                        fontSize: 16,
                                        color: darkBrown,
                                        fontFamily: "Philosopher-Regular",
                                        opacity: 0.7,
                                        marginTop: 4,
                                      }}
                                    >
                                      €{service.price}
                                    </Text>
                                  )}
                                </View>
                                {service.durationMinutes && (
                                  <Text
                                    style={{
                                      fontSize: 14,
                                      color: darkBrown,
                                      fontFamily: "Philosopher-Regular",
                                      opacity: 0.6,
                                      marginTop: 2,
                                    }}
                                  >
                                    {service.durationMinutes} min
                                  </Text>
                                )}
                              </View>
                            </TouchableOpacity>
                            {/* Show work types if this service is selected */}
                            {selectedServiceWithWorkTypes?.id === service.id && renderWorkTypes(service)}
                          </View>
                        )}
                      </View>
                    ))
                ) : (
                  <View style={{ flex: 1, justifyContent: "center", alignItems: "center", marginTop: 50 }}>
                    <Text
                      style={{
                        fontFamily: "Philosopher-Bold",
                        fontSize: 18,
                        color: darkBrown,
                        textAlign: "center",
                      }}
                    >
                      No services found for {String(hiuksetSub || subCategory || categoryName)}
                    </Text>
                  </View>
                )
              )}
            </View>
          )}
        </View>
        {/* Bottom spacer so last card is fully visible above tab bar */}
        {(uiVariant !== 'hiukset' || !!hiuksetSub || !!salonId) && (uiVariant !== 'karvanpoistot' || !!subCategory || !!salonId) && (
          <View style={{ height: 40 }} />
        )}
      </ScrollView>

      {/* Modal for the side menu */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={isMenuVisible}
        onRequestClose={() => setMenuVisible(false)}
        statusBarTranslucent={true}
      >
        <SideMenu onClose={() => setMenuVisible(false)} />
      </Modal>
    </SafeAreaView>
  );
}