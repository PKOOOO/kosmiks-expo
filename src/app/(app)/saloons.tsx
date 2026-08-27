// src/app/(app)/saloons.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { SafeAreaView, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, Modal, Animated, FlatList, Dimensions, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import getSaloonsByService, { SaloonData } from "../actions/get-saloons-by-service";
import getSalonById from "../actions/get-salon-by-id";
import Header from "../components/Header";
import SideMenu from "../components/SideMenu";
import { MAPBOX_TOKEN, hasMapboxToken, MAP_UNAVAILABLE_HTML } from "@/config/constants";

const darkBrown = "#3C2C1E";
const beige = "#D9C7AF";
const lightBeige = "#E4D2BA";


// Auto-swipe image carousel component
const SaloonImageCarousel = ({ images, saloonName }: { images: string[], saloonName: string }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (images.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % images.length);
        }, 3000);

        return () => clearInterval(interval);
    }, [images.length]);

    if (images.length === 0) {
        return (
            <View
                style={{
                    width: 335,
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
                <Ionicons name="business-outline" size={48} color={darkBrown} />
                <Text style={{
                    color: darkBrown,
                    fontFamily: "Philosopher-Regular",
                    marginTop: 8,
                    fontSize: 14
                }}>
                    {saloonName}
                </Text>
            </View>
        );
    }

    return (
        <View
            style={{
                width: 335,
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
            {images.map((img, index) => (
                <Image
                    key={index}
                    source={{ uri: img }}
                    style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: 24,
                        position: "absolute",
                        opacity: index === currentIndex ? 1 : 0
                    }}
                    resizeMode="cover"
                />
            ))}

            {/* Dot indicators for multiple images */}
            {images.length > 1 && (
                <View style={{
                    position: "absolute",
                    bottom: 10,
                    flexDirection: "row",
                    gap: 6,
                    zIndex: 20
                }}>
                    {images.map((_, index) => (
                        <View
                            key={index}
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: index === currentIndex ? "white" : "rgba(255,255,255,0.5)"
                            }}
                        />
                    ))}
                </View>
            )}
        </View>
    );
};

const Saloons = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { serviceName, categoryName, serviceId, salonId, workType, parentServiceName } = useLocalSearchParams<{
        serviceName?: string;
        serviceId?: string;
        categoryName: string;
        salonId?: string;
        workType?: string;
        parentServiceName?: string;
    }>();

    const [saloons, setSaloons] = useState<SaloonData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMenuVisible, setMenuVisible] = useState(false);
    const [heroPageIndex, setHeroPageIndex] = useState(0); // 0 = title, 1 = map
    const flatListRef = useRef<FlatList>(null);

    const CAROUSEL_WIDTH = 340;

    const handleScroll = (event: any) => {
        const contentOffset = event.nativeEvent.contentOffset.x;
        const index = Math.round(contentOffset / CAROUSEL_WIDTH);
        if (index !== heroPageIndex) {
            setHeroPageIndex(index);
        }
    };

    // Generate HTML for the mini map in the hero box
    const generateMiniMapHTML = (saloonsList: SaloonData[]) => {
        if (!hasMapboxToken()) return MAP_UNAVAILABLE_HTML;

        // Default location (Helsinki, Finland)
        let centerLat = 60.1699;
        let centerLng = 24.9384;

        // Filter saloons with valid location and limit to 10
        const validSaloons = saloonsList.filter(s => s.latitude && s.longitude).slice(0, 10);

        if (validSaloons.length > 0) {
            centerLat = validSaloons[0].latitude!;
            centerLng = validSaloons[0].longitude!;
        }

        const markersJS = validSaloons.map(s => `
            (function() {
                const el = document.createElement('div');
                el.style.width = '32px';
                el.style.height = '32px';
                el.style.borderRadius = '50%';
                el.style.backgroundColor = '#3C2C1E';
                el.style.border = '3px solid white';
                el.style.display = 'flex';
                el.style.alignItems = 'center';
                el.style.justifyContent = 'center';
                el.style.fontSize = '16px';
                el.innerHTML = '✂️';
                el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';

                new mapboxgl.Marker(el)
                    .setLngLat([${s.longitude}, ${s.latitude}])
                    .addTo(map);
            })();
        `).join('\n');

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src='https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js'></script>
    <link href='https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css' rel='stylesheet' />
    <style>
        body { margin: 0; padding: 0; }
        #map { width: 100%; height: 100vh; }
        .mapboxgl-ctrl-logo, .mapboxgl-ctrl-attrib { display: none !important; }
    </style>
</head>
<body>
    <div id='map'></div>
    <script>
        mapboxgl.accessToken = '${MAPBOX_TOKEN}';
        const map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [${centerLng}, ${centerLat}],
            zoom: 12,
            interactive: false
        });

        ${markersJS}
    </script>
</body>
</html>
        `;
    };

    // Fetch saloons when component mounts
    useEffect(() => {
        const fetchSaloons = async () => {
            if (!serviceId) {
                setError('No service selected');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                // If coming from filtered services (has salonId), fetch only that specific salon
                if (salonId) {
                    const data = await getSalonById(salonId, serviceId);
                    setSaloons(data);
                    console.log('Fetched specific salon for service:', salonId, serviceId, data);
                } else {
                    // Normal flow - fetch all saloons for the service
                    const data = await getSaloonsByService(serviceId, workType);
                    setSaloons(data);
                    console.log('Fetched saloons for service:', serviceId, 'workType:', workType, data);
                }
            } catch (err) {
                console.error('Error fetching saloons:', err);
                setError(err instanceof Error ? err.message : 'Failed to fetch saloons');
            } finally {
                setLoading(false);
            }
        };

        if (serviceId) {
            fetchSaloons();
        }
    }, [serviceId, salonId, workType]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
            {/* Header - Fixed at Top */}
            <Header
                showBack={true}
                showMenu={true}
                onBackPress={() => router.back()}
                onMenuPress={() => setMenuVisible(true)}
                disableSafeAreaPadding={true}
            />

            {/* SCROLLABLE CONTENT */}
            <ScrollView
                style={{ flex: 1, backgroundColor: "white" }}
                contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
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
                            left: -49,
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
                            right: -49,
                            width: 220,
                            height: 200,
                            opacity: 0.9,
                        }}
                        resizeMode="contain"
                    />

                    {/* White Box - Centered - Swipeable */}
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <View
                            style={{
                                width: CAROUSEL_WIDTH,
                                height: 195,
                                backgroundColor: "white",
                                borderRadius: 24,
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 4,
                                elevation: 3,
                                position: "relative",
                                overflow: "hidden"
                            }}
                        >
                            <FlatList
                                ref={flatListRef}
                                data={[0, 1]} // Page 0: Title, Page 1: Map
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                onScroll={handleScroll}
                                scrollEventThrottle={16}
                                keyExtractor={(item) => item.toString()}
                                renderItem={({ item }) => (
                                    <View style={{ width: CAROUSEL_WIDTH, height: 195, alignItems: "center", justifyContent: "center" }}>
                                        {item === 0 ? (
                                            /* Page 0: Title */
                                            <Text
                                                numberOfLines={3}
                                                adjustsFontSizeToFit
                                                minimumFontScale={0.5}
                                                style={{
                                                    width: "100%",
                                                    paddingHorizontal: 10,
                                                    fontFamily: "Philosopher-Bold",
                                                    fontSize: 20,
                                                    color: darkBrown,
                                                    textAlign: "center",
                                                    transform: [{ scale: 1.4 }]
                                                }}
                                            >
                                                {(() => {
                                                    const text = salonId ? (serviceName || "Service") : (serviceName || "Services");
                                                    const trimmed = text.trim();
                                                    let displayContent: React.ReactNode = "";

                                                    // Special handling for text with parentheses
                                                    if (trimmed.includes('(') && trimmed.includes(')')) {
                                                        const parenStart = trimmed.indexOf('(');
                                                        const beforeParen = trimmed.substring(0, parenStart).trim();
                                                        const parenPart = trimmed.substring(parenStart).trim();
                                                        if (beforeParen && parenPart) {
                                                            displayContent = (
                                                                <>
                                                                    {beforeParen}
                                                                    {"\n"}
                                                                    <Text style={{ fontSize: 15 }}>{parenPart}</Text>
                                                                </>
                                                            );
                                                        } else {
                                                            displayContent = text;
                                                        }
                                                    } else {
                                                        const words = trimmed.split(/\s+/).filter(word => word.length > 0);
                                                        if (words.length === 2 && trimmed.length > 26) {
                                                            displayContent = words.join("\n");
                                                        } else if (words.length === 3 && trimmed.length > 26) {
                                                            displayContent = words.slice(0, 2).join(" ") + "\n" + words[2];
                                                        } else if (words.length === 4 && trimmed.length > 25) {
                                                            displayContent = words[0] + "\n" + words.slice(1).join(" ");
                                                        } else if (words.length >= 5 && trimmed.length > 23) {
                                                            displayContent = words.slice(0, 3).join(" ") + "\n" + words.slice(3).join(" ");
                                                        } else {
                                                            displayContent = text;
                                                        }
                                                    }

                                                    // If workType exists (e.g., PITKAT), show it below in parentheses
                                                    if (workType) {
                                                        const workTypeMapping: Record<string, string> = {
                                                            'UUDET': 'Uudet',
                                                            'POISTO': 'Poisto',
                                                            'HUOLTO': 'Huolto',
                                                            'EI_LISAKKEITA': 'Ei lisäkkeitä',
                                                            'LYHYET': 'Lyhyet',
                                                            'KESKIPITKAT': 'Keskipitkät',
                                                            'PITKAT': 'Pitkät'
                                                        };

                                                        let displayWorkType = workTypeMapping[workType];

                                                        if (!displayWorkType) {
                                                            const formatted = workType.replace(/_/g, ' ').toLowerCase();
                                                            displayWorkType = formatted.charAt(0).toUpperCase() + formatted.slice(1);
                                                        }

                                                        return (
                                                            <>
                                                                {displayContent}
                                                                {"\n"}
                                                                <Text style={{ fontSize: 15 }}>({displayWorkType})</Text>
                                                            </>
                                                        );
                                                    }

                                                    // If parentServiceName exists and category is Karvanpoistot, show it below in parentheses
                                                    if (parentServiceName && (categoryName === 'Karvanpoistot' || parentServiceName === 'Sokerointi' || parentServiceName === 'IPL karvanpoisto' || parentServiceName === 'Laserkarvanpoistot')) {
                                                        return (
                                                            <>
                                                                {displayContent}
                                                                {"\n"}
                                                                <Text style={{ fontSize: 13 }}>({parentServiceName})</Text>
                                                            </>
                                                        );
                                                    }

                                                    return displayContent;
                                                })()}
                                            </Text>
                                        ) : (
                                            /* Page 1: Mapbox Map - Tap to open full map */
                                            <TouchableOpacity
                                                activeOpacity={0.9}
                                                onPress={() => router.push("/(app)/(tabs)/map")}
                                                style={{
                                                    width: CAROUSEL_WIDTH,
                                                    height: 195,
                                                    borderRadius: 24,
                                                    overflow: "hidden"
                                                }}
                                            >
                                                <WebView
                                                    source={{ html: generateMiniMapHTML(saloons) }}
                                                    style={{
                                                        width: CAROUSEL_WIDTH,
                                                        height: 195,
                                                    }}
                                                    scrollEnabled={false}
                                                    javaScriptEnabled={true}
                                                    domStorageEnabled={true}
                                                    pointerEvents="none"
                                                />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}
                            />

                            {/* Ellipses at bottom - indicate current page */}
                            <View style={{
                                position: "absolute",
                                bottom: 16,
                                left: 0,
                                right: 0,
                                flexDirection: "row",
                                justifyContent: "center"
                            }}>
                                <View
                                    style={{
                                        width: 11,
                                        height: 11,
                                        backgroundColor: heroPageIndex === 0 ? darkBrown : beige,
                                        borderRadius: 5.5
                                    }}
                                />
                                <View
                                    style={{
                                        width: 11,
                                        height: 11,
                                        marginLeft: 5,
                                        backgroundColor: heroPageIndex === 1 ? darkBrown : beige,
                                        borderRadius: 5.5
                                    }}
                                />
                            </View>
                        </View>
                    </View>
                </View>

                {/* Loading State */}
                {loading && (
                    <View style={{ alignItems: "center", marginTop: 80 }}>
                        <ActivityIndicator size="large" color={darkBrown} />
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
                            onPress={() => {
                                if (serviceId) {
                                    setError(null);
                                    setLoading(true);
                                    getSaloonsByService(serviceId)
                                        .then(setSaloons)
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

                {/* Saloons List */}
                {!loading && !error && (
                    <>
                        {saloons.length > 0 ? (
                            saloons.map((saloon) => (
                                <TouchableOpacity
                                    key={saloon.id}
                                    style={{ alignItems: "center", marginTop: 24, position: "relative" }}
                                    onPress={() => {
                                        console.log(`Selected saloon: ${saloon.name} (ID: ${saloon.id})`);
                                        // Navigate to checkout with the selected saloon service
                                        router.push({
                                            pathname: "/(app)/checkout",
                                            params: {
                                                saloonId: saloon.id,
                                                saloonName: saloon.name,
                                                serviceId: serviceId,
                                                serviceName: serviceName,
                                                categoryName: categoryName,
                                                price: saloon.price.toString(),
                                                durationMinutes: saloon.durationMinutes.toString(),
                                                workType: workType
                                            }
                                        });
                                    }}
                                >
                                    {/* First Box - Top Box - Salon Picture with Auto-Swipe */}
                                    <SaloonImageCarousel
                                        images={saloon.images || (saloon.imageUrl ? [saloon.imageUrl] : [])}
                                        saloonName={saloon.name}
                                    />

                                    {/* Second Box - Bottom Box (327x200) - Salon Info */}
                                    <View
                                        style={{
                                            width: 335,
                                            height: 190,
                                            marginTop: 140,
                                            borderWidth: 2,
                                            borderColor: '#D7C3A7',
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
                                                    {saloon.name}
                                                </Text>
                                            </View>

                                            <View style={{
                                                borderBottomWidth: 2,
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
                                                    {saloon.shortIntro}
                                                </Text>
                                                <Text
                                                    style={{
                                                        fontFamily: "Philosopher-Bold",
                                                        fontSize: 15,
                                                        color: "#423120",
                                                        marginTop: 4
                                                    }}
                                                >
                                                    Price {saloon.price}€
                                                </Text>

                                                <View style={{
                                                    flexDirection: "row",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    marginTop: 8
                                                }}>
                                                    <Text
                                                        style={{
                                                            fontFamily: "Philosopher-Bold",
                                                            fontSize: 15,
                                                            color: "#423120",
                                                        }}
                                                    >
                                                        Time {saloon.durationMinutes} min
                                                    </Text>
                                                    {/* Star Rating - 5 stars total */}
                                                    <View style={{ flexDirection: "row" }}>
                                                        {(() => {
                                                            const rating = saloon.rating || 0;
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
                            ))
                        ) : (
                            <View style={{ alignItems: "center", marginTop: 80 }}>
                                <Text
                                    style={{
                                        fontFamily: "Philosopher-Bold",
                                        fontSize: 18,
                                        color: darkBrown,
                                        textAlign: "center",
                                    }}
                                >
                                    Saloneja ei ole saatavilla
                                </Text>
                                <Text
                                    style={{
                                        fontFamily: "Philosopher-Regular",
                                        fontSize: 16,
                                        color: darkBrown,
                                        textAlign: "center",
                                        marginTop: 8,
                                        opacity: 0.6,
                                    }}
                                >
                                    Ei salonkeja tällä hetkellä tarjoa {serviceName}
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

export default Saloons;