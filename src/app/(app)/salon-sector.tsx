// src/app/(app)/salon-sector.tsx
import React, { useState, useEffect, useRef } from "react";
import { SafeAreaView, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, Modal, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import Header from "../components/Header";
import SideMenu from "../components/SideMenu";
import getServicesBySalon from "../actions/get-services-by-salon";
import { Service } from "../types";
import { Salon } from "../../../types/salon";
import getSaloonsMap from "../actions/get-saloons-map";
import getCategories from "../actions/get-categories";
import { Category } from "../types";

const darkBrown = "#3C2C1E";
const beige = "#D9C7AF";
const lightBeige = "#E4D2BA";
const chipBeige = "#D7C3A7";

const SalonSector = () => {
    const router = useRouter();
    const { salonId, salonName } = useLocalSearchParams<{
        salonId: string;
        salonName?: string;
    }>();

    const [salon, setSalon] = useState<Salon | null>(null);
    const [services, setServices] = useState<Service[]>([]);
    const [allCategories, setAllCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMenuVisible, setMenuVisible] = useState(false);

    // Hero box carousel state: 0 = title, 1+ = images
    const [heroContentIndex, setHeroContentIndex] = useState(0);

    // Get salon images array - use useMemo to prevent recalculation issues
    const salonImages = React.useMemo(() => {
        return salon?.images?.map(img => img.url).filter((url): url is string => Boolean(url)) || [];
    }, [salon?.images]);

    // Total pages: number of images
    const totalPages = salonImages.length;

    // Animated opacity values for smooth fade transitions
    const fadeAnims = useRef<Animated.Value[]>([]).current;

    // Initialize animated values when totalPages changes
    useEffect(() => {
        // Ensure we have enough animated values
        while (fadeAnims.length < totalPages) {
            fadeAnims.push(new Animated.Value(fadeAnims.length === 0 ? 1 : 0));
        }
    }, [totalPages, fadeAnims]);

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
        if (salonImages.length === 0) return; // No images to cycle through

        const interval = setInterval(() => {
            setHeroContentIndex(prevIndex => {
                const nextIndex = (prevIndex + 1) % totalPages;

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
                        if (fadeAnims[prevIndex]) {
                            fadeAnims[prevIndex].setValue(0);
                        }
                    });
                }

                return nextIndex;
            });
        }, 3000); // 3 seconds per slide

        return () => clearInterval(interval);
    }, [salonImages.length, totalPages, fadeAnims]);

    // Fetch salon details and services
    useEffect(() => {
        const fetchSalonData = async () => {
            if (!salonId) {
                setError('No salon selected');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                // Fetch all salons and find the specific one
                const allSalons = await getSaloonsMap();
                const foundSalon = allSalons.find(s => s.id === salonId);

                if (!foundSalon) {
                    throw new Error('Salon not found');
                }

                setSalon(foundSalon);

                // Fetch services for this salon
                const salonServices = await getServicesBySalon(salonId);
                setServices(salonServices);

                // If no services found, fetch all categories as fallback
                if (salonServices.length === 0) {
                    console.log('No services found for salon, fetching all categories as fallback');
                    const categories = await getCategories();
                    setAllCategories(categories);
                }

                console.log('Fetched salon:', foundSalon);
                console.log('Fetched services:', salonServices);
            } catch (err) {
                console.error('Error fetching salon data:', err);
                setError(err instanceof Error ? err.message : 'Failed to fetch salon data');
            } finally {
                setLoading(false);
            }
        };

        if (salonId) {
            fetchSalonData();
        }
    }, [salonId]);

    // Group services by category, or use all categories if no services
    const getCategoriesFromServices = () => {
        // If we have services, extract categories from them
        if (services.length > 0) {
            const categoryMap = new Map<string, { id: string; name: string; count: number }>();

            services.forEach(service => {
                if (service.category) {
                    const categoryId = service.category.id;
                    const categoryName = service.category.name;

                    if (categoryMap.has(categoryId)) {
                        const existing = categoryMap.get(categoryId)!;
                        categoryMap.set(categoryId, { ...existing, count: existing.count + 1 });
                    } else {
                        categoryMap.set(categoryId, { id: categoryId, name: categoryName, count: 1 });
                    }
                }
            });

            return Array.from(categoryMap.values());
        }

        // If no services, return all categories as fallback
        if (allCategories.length > 0) {
            return allCategories.map(cat => ({ id: cat.id, name: cat.name, count: 0 }));
        }

        return [];
    };

    const categories = getCategoriesFromServices();

    const onCategoryPress = (categoryName: string) => {
        router.push({
            pathname: "/services",
            params: {
                categoryName,
                salonId: salonId,
                salonName: salonName || salon?.name
            }
        });
    };



    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
            {/* Header - Fixed at Top */}
            <Header
                title="SERVEY"
                showBack={true}
                showMenu={true}
                onBackPress={() => router.back()}
                onMenuPress={() => setMenuVisible(true)}
                disableSafeAreaPadding={true}
            />

            {/* SCROLLABLE CONTENT */}
            <ScrollView
                style={{ flex: 1, backgroundColor: "white" }}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {/* HERO SECTION */}
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

                    {/* White Box - Centered with auto-transitioning content */}
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
                            {salonImages.length > 0 && salonImages.map((imageUrl, index) => (
                                <Animated.Image
                                    key={index}
                                    source={{ uri: imageUrl }}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        borderRadius: 24,
                                        position: "absolute",
                                        opacity: fadeAnims[index] || 0,
                                        zIndex: heroContentIndex === index ? 10 : 0
                                    }}
                                    resizeMode="cover"
                                />
                            ))}

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

                {/* Loading State */}
                {loading && (
                    <View style={{ alignItems: "center", marginTop: 80 }}>
                        <ActivityIndicator size="large" color={darkBrown} />
                        <Text
                            style={{
                                fontFamily: "Philosopher-Bold",
                                fontSize: 16,
                                color: darkBrown,
                                marginTop: 10,
                            }}
                        >

                        </Text>
                    </View>
                )}

                {/* Error State */}
                {error && (
                    <View style={{ alignItems: "center", marginTop: 80, paddingHorizontal: 16 }}>
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
                                backgroundColor: beige,
                                paddingHorizontal: 20,
                                paddingVertical: 10,
                                borderRadius: 8,
                            }}
                            onPress={() => router.back()}
                        >
                            <Text style={{ fontFamily: "Philosopher-Bold", color: darkBrown }}>
                                Go Back
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Salon Card and Categories */}
                {!loading && !error && salon && (
                    <>
                        {/* Single Salon Card */}
                        <TouchableOpacity
                            style={{ alignItems: "center", marginTop: 24, position: "relative" }}
                            activeOpacity={1}
                        >

                            {/* Second Box - Bottom Box (310x190) - Salon Info */}
                            <View
                                style={{
                                    width: 335,
                                    height: 190,
                                    marginTop: 20,
                                    borderWidth: 2,
                                    borderColor: chipBeige,
                                    backgroundColor: "white",
                                    borderRadius: 24,
                                    justifyContent: "center",
                                    paddingVertical: 16
                                }}
                            >
                                <View>


                                    <View style={{ paddingHorizontal: 16 }}>
                                        <Text
                                            style={{
                                                fontFamily: "Philosopher-Bold",
                                                fontSize: 18,
                                                color: "#423120",
                                                marginBottom: 4
                                            }}
                                        >
                                            {salonName || salon?.name || "Salon"} Salonki
                                        </Text>
                                        <Text
                                            style={{
                                                fontFamily: "Philosopher-Regular",
                                                fontSize: 14,
                                                color: "#423120",
                                                opacity: 0.8
                                            }}
                                        >
                                            {salon.shortIntro || 'No description'}
                                        </Text>
                                        <View style={{
                                            borderBottomWidth: 1,
                                            marginTop: 8,
                                            borderBottomColor: beige
                                        }} />
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
                                            borderBottomWidth: 1,
                                            marginTop: 8,
                                            borderBottomColor: beige
                                        }} />

                                        <View style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            marginTop: 4
                                        }}>
                                            <Text
                                                style={{
                                                    fontFamily: "Philosopher-Bold",
                                                    fontSize: 15,
                                                    color: "#423120",
                                                    marginBottom: 9,
                                                }}
                                            >
                                                Arviot:{" "}
                                            </Text>
                                            {/* Star Rating - 5 stars total */}
                                            <View style={{ flexDirection: "row", marginBottom: 9 }}>
                                                {(() => {
                                                    const rating = salon.averageRating || salon.rating || 0;
                                                    const filledStars = Math.round(rating);
                                                    const totalStars = 5;
                                                    return [...Array(totalStars)].map((_, index) => (
                                                        <Text
                                                            key={index}
                                                            style={{
                                                                color: index < filledStars ? darkBrown : "#E0CFB9",
                                                                fontSize: 18,
                                                            }}
                                                        >
                                                            ★
                                                        </Text>
                                                    ));
                                                })()}
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>

                        {/* Categories Section */}
                        {categories.length > 0 && (
                            <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
                                {/* Section title */}
                                <Text style={{ color: darkBrown, fontFamily: 'Philosopher-Bold', fontSize: 30, textAlign: 'center' }}>
                                    Kaikki palvelut
                                </Text>

                                {/* Categories Chips grid - Same layout as Suosituimmat palvelut (2-1-2-1 pattern) */}
                                <View style={{ marginTop: 20 }}>
                                    {/* First row - 2 chips */}
                                    {categories.length > 0 && (
                                        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20, gap: 12 }}>
                                            {categories.slice(0, 2).map((category) => (
                                                <Chip
                                                    key={category.id}
                                                    label={category.name}
                                                    onPress={() => onCategoryPress(category.name)}
                                                    color={chipBeige}
                                                    textColor={darkBrown}
                                                />
                                            ))}
                                            {categories.length === 1 && (
                                                <View style={{ width: 160 }} />
                                            )}
                                        </View>
                                    )}

                                    {/* Second row - 1 chip centered */}
                                    {categories.length > 2 && (
                                        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20 }}>
                                            <Chip
                                                label={categories[2].name}
                                                onPress={() => onCategoryPress(categories[2].name)}
                                                color={chipBeige}
                                                textColor={darkBrown}
                                            />
                                        </View>
                                    )}

                                    {/* Third row - 2 chips */}
                                    {categories.length > 3 && (
                                        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20, gap: 12 }}>
                                            {categories.slice(3, 5).map((category) => (
                                                <Chip
                                                    key={category.id}
                                                    label={category.name}
                                                    onPress={() => onCategoryPress(category.name)}
                                                    color={chipBeige}
                                                    textColor={darkBrown}
                                                />
                                            ))}
                                            {categories.length === 4 && (
                                                <View style={{ width: 160 }} />
                                            )}
                                        </View>
                                    )}

                                    {/* Fourth row - 1 chip centered */}
                                    {categories.length > 5 && (
                                        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20 }}>
                                            <Chip
                                                label={categories[5].name}
                                                onPress={() => onCategoryPress(categories[5].name)}
                                                color={chipBeige}
                                                textColor={darkBrown}
                                            />
                                        </View>
                                    )}

                                    {/* Additional rows following the same pattern if more categories */}
                                    {categories.length > 6 && categories.slice(6).map((category, idx) => {
                                        const position = idx % 3;
                                        // Pattern: 0,1 = row of 2, 2 = centered
                                        if (position === 0) {
                                            const nextCategory = categories[6 + idx + 1];
                                            return (
                                                <View key={category.id} style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20, gap: 12 }}>
                                                    <Chip
                                                        label={category.name}
                                                        onPress={() => onCategoryPress(category.name)}
                                                        color={chipBeige}
                                                        textColor={darkBrown}
                                                    />
                                                    {nextCategory ? (
                                                        <Chip
                                                            label={nextCategory.name}
                                                            onPress={() => onCategoryPress(nextCategory.name)}
                                                            color={chipBeige}
                                                            textColor={darkBrown}
                                                        />
                                                    ) : (
                                                        <View style={{ width: 160 }} />
                                                    )}
                                                </View>
                                            );
                                        } else if (position === 2) {
                                            return (
                                                <View key={category.id} style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20 }}>
                                                    <Chip
                                                        label={category.name}
                                                        onPress={() => onCategoryPress(category.name)}
                                                        color={chipBeige}
                                                        textColor={darkBrown}
                                                    />
                                                </View>
                                            );
                                        }
                                        return null;
                                    })}
                                </View>
                            </View>
                        )}

                        {categories.length === 0 && !loading && (
                            <View style={{ alignItems: "center", marginTop: 40, paddingHorizontal: 16 }}>
                                <Text
                                    style={{
                                        fontFamily: "Philosopher-Bold",
                                        fontSize: 16,
                                        color: darkBrown,
                                        textAlign: "center",
                                        opacity: 0.6,
                                    }}
                                >
                                    No services available at this salon
                                </Text>
                            </View>
                        )}
                    </>
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
};

// Helper function to chunk array
function chunkArray<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

// Chip component - Same as in service.tsx
function Chip({ label, onPress, color, textColor }: { label: string; onPress: () => void; color: string; textColor: string }) {
    const [containerWidth, setContainerWidth] = useState(0);
    const [textWidth, setTextWidth] = useState(0);
    const translateX = useRef(new Animated.Value(0)).current;

    const H_PADDING = 16; // internal horizontal padding so text doesn't touch edges
    const effectiveWidth = Math.max(0, containerWidth - H_PADDING * 2);
    const shouldScroll = textWidth > effectiveWidth && effectiveWidth > 0;

    useEffect(() => {
        let loop: Animated.CompositeAnimation | null = null;
        if (shouldScroll) {
            // Start centered if possible, then animate to left and back
            translateX.setValue(0);
            const distance = textWidth - effectiveWidth;
            loop = Animated.loop(
                Animated.sequence([
                    Animated.timing(translateX, {
                        toValue: -distance,
                        duration: Math.min(14000, 5000 + distance * 30),
                        easing: Easing.linear,
                        useNativeDriver: true,
                    }),
                    Animated.timing(translateX, {
                        toValue: 0,
                        duration: 1000,
                        easing: Easing.linear,
                        useNativeDriver: true,
                    }),
                ])
            );
            loop.start();
        }
        return () => {
            if (loop) loop.stop();
        };
    }, [shouldScroll, textWidth, effectiveWidth, translateX]);

    return (
        <TouchableOpacity
            onPress={onPress}
            style={{ backgroundColor: color, width: 160, height: 45 }}
            className="rounded-full items-center justify-center"
        >
            <View
                style={{ width: "100%", overflow: "hidden", alignItems: "center", paddingHorizontal: H_PADDING }}
                onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
            >
                <Animated.View style={{ transform: [{ translateX: shouldScroll ? translateX : 0 }], alignItems: "center" }}>
                    <Text
                        onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
                        numberOfLines={1}
                        style={{ color: textColor, fontFamily: 'Philosopher-Bold', fontSize: 15, textAlign: 'center' }}
                    >
                        {label}
                    </Text>
                </Animated.View>
            </View>
        </TouchableOpacity>
    );
}

export default SalonSector;

