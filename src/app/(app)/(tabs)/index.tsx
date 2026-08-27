// Page.js
import { SafeAreaView, ScrollView, View, Text, TouchableOpacity, Image, Modal, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import SideMenu from '../../components/SideMenu';
import RatingPromptModal from '../../components/RatingPromptModal';
import getCategories from '../../actions/get-categories';
import { getBookings } from '../../actions/get-bookings';
import { Category, Booking } from '../../types';
import Header from "../../components/Header";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { API_ENDPOINTS } from "../../../../config/constants";

const DISMISSED_RATINGS_KEY = '@cosmix_dismissed_rating_bookings';

export default function Page() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [isMenuVisible, setMenuVisible] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heroText, setHeroText] = useState("Palvelut nyt!");

  // Rating prompt modal state
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [pendingRatingBooking, setPendingRatingBooking] = useState<Booking | null>(null);
  const [ratingServiceName, setRatingServiceName] = useState("");
  const [ratingSalonName, setRatingSalonName] = useState("");

  // New color scheme based on provided HEX codes
  const darkBrown = "#423120";
  const lightBrown = "#D7C3A7";
  const veryLightBeige = "#F4EDE5";
  const white = "#FFFFFF";

  const [randomCategories, setRandomCategories] = useState<Category[]>([]);

  // Helper to get service name from booking
  const getServiceName = (b: Booking) => {
    const anyB = b as any;
    return (
      anyB.subService?.name ||
      anyB.service?.subService?.name ||
      anyB.service?.name ||
      anyB.subServiceName ||
      anyB.serviceName ||
      "Palvelu"
    );
  };

  // Helper to get salon name from booking
  const getSalonName = async (b: Booking): Promise<string> => {
    const anyB = b as any;
    const directName = anyB.salon?.name || anyB.saloon?.name || anyB.salonName || anyB.saloonName;
    if (directName) return directName;

    // Fetch salon name if not available
    if (anyB.saloonId) {
      try {
        const response = await fetch(`${API_ENDPOINTS.SALONS}/${anyB.saloonId}`);
        if (response.ok) {
          const salon = await response.json();
          return salon.name || "Salon";
        }
      } catch (error) {
        console.error("Error fetching salon details:", error);
      }
    }
    return "Salon";
  };

  // Check for unrated bookings on mount (auto rating popup)
  useEffect(() => {
    const checkUnratedBookings = async () => {
      if (!isSignedIn || !user) return;

      try {
        const userId = user.id;
        const userEmail = user.primaryEmailAddress?.emailAddress;

        // Get Clerk token BEFORE calling getBookings so the API can identify the user
        const token = await getToken();

        // Fetch user's bookings
        const bookings = await getBookings(token ?? undefined, userId, userEmail);

        // Filter for completed bookings without reviews
        const unratedBookings = bookings.filter(
          (b) => b.status === 'completed' && !b.hasReview
        );

        if (unratedBookings.length === 0) return;

        // Get dismissed booking IDs from storage
        const dismissedJson = await AsyncStorage.getItem(DISMISSED_RATINGS_KEY);
        const dismissedIds: string[] = dismissedJson ? JSON.parse(dismissedJson) : [];

        // Find first unrated booking that hasn't been dismissed
        const bookingToRate = unratedBookings.find((b) => !dismissedIds.includes(b.id));

        if (bookingToRate) {
          const serviceName = getServiceName(bookingToRate);
          const salonName = await getSalonName(bookingToRate);

          setPendingRatingBooking(bookingToRate);
          setRatingServiceName(serviceName);
          setRatingSalonName(salonName);
          setRatingModalVisible(true);
        }
      } catch (error) {
        console.error("Error checking unrated bookings:", error);
      }
    };

    // Small delay to let the app load first
    const timer = setTimeout(checkUnratedBookings, 1500);
    return () => clearTimeout(timer);
  }, [isSignedIn, user]);

  // Handle rating modal close (dismiss booking)
  const handleRatingClose = async () => {
    if (pendingRatingBooking) {
      try {
        // Store dismissed booking ID
        const dismissedJson = await AsyncStorage.getItem(DISMISSED_RATINGS_KEY);
        const dismissedIds: string[] = dismissedJson ? JSON.parse(dismissedJson) : [];
        dismissedIds.push(pendingRatingBooking.id);
        await AsyncStorage.setItem(DISMISSED_RATINGS_KEY, JSON.stringify(dismissedIds));
      } catch (error) {
        console.error("Error saving dismissed rating:", error);
      }
    }
    setRatingModalVisible(false);
    setPendingRatingBooking(null);
  };

  // Handle rating submitted
  const handleRatingSubmitted = () => {
    setRatingModalVisible(false);
    setPendingRatingBooking(null);
  };

  // Fetch categories on component mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getCategories();
        setCategories(data);

        // Select 4 random categories
        if (data.length > 0) {
          const shuffled = [...data].sort(() => 0.5 - Math.random());
          setRandomCategories(shuffled.slice(0, 4));
        }

        console.log('Fetched categories:', data);
      } catch (err) {
        console.error('Error fetching categories:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch categories');
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // Alternate hero text every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setHeroText(prevText =>
        prevText === "Palvelut nyt!" ? "Kartta" : "Palvelut nyt!"
      );
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Function to chunk array into rows of 2 items
  const chunkArray = (array: any[], chunkSize: number) => {
    const result = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      result.push(array.slice(i, i + chunkSize));
    }
    return result;
  };

  // Prepare categories for display (all categories - keep full objects)
  const displayCategories = categories;

  // Chunk into rows of 2
  const categoryRows = chunkArray(displayCategories, 2);

  return (
    <View collapsable={false} style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      {/* FIXED HEADER - Outside ScrollView */}
      <Header onMenuPress={() => setMenuVisible(true)} />

      {/* SCROLLABLE CONTENT */}
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {/* Hero Section */}
        <View style={{ backgroundColor: lightBrown }} className="px-4 py-6">
          {/* No `elevation` here: it is Android-only and makes Android paint a
              Material shadow around these rounded bounds (a thick frame on the
              beige hero). iOS ignores it, which is why only Android showed it.
              zIndex alone handles the stacking on both platforms. */}
          <View style={{ position: "relative", borderRadius: 20, height: 300, alignItems: "center", justifyContent: "center", zIndex: 1 }}>
            {/* Background vectors (left/right) - behind the hero card */}
            <Image
              pointerEvents="none"
              source={require("../../../../assets/vector-left.png")}
              style={{
                position: "absolute",
                top: 70,
                left: -55,
                width: 220,
                height: 220,
                opacity: 0.9,
              }}
              resizeMode="contain"
            />
            <Image
              pointerEvents="none"
              source={require("../../../../assets/vector-right.png")}
              style={{
                position: "absolute",
                top: -2,
                right: -60,
                width: 220,
                height: 210,
                opacity: 0.9,
              }}
              resizeMode="contain"
            />

            <TouchableOpacity
              style={{
                borderRadius: 20,
                overflow: "hidden",
                alignItems: "center",
                height: 300,
                justifyContent: "center",
                position: "relative",
                zIndex: 10,
              }}
              onPress={() => router.push("/map")}
              activeOpacity={0.8}
            >
              <Image
                source={{
                  uri: "https://res.cloudinary.com/dguk4ks45/image/upload/v1755533724/AdobeStock_130939808_cq1whi.png",
                }}
                style={{
                  width: 300,
                  height: 213,
                  borderRadius: 20,
                }}
                resizeMode="cover"
              />

              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 40,
                    fontFamily: "Philosopher-Bold",
                    color: darkBrown,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                  }}
                >
                  {heroText}
                </Text>
              </View>

              {/* Dots indicator at bottom of image */}
              <View pointerEvents="none" style={{
                position: "absolute",
                bottom: 50,
                left: 0,
                right: 0,
                flexDirection: "row",
                justifyContent: "center"
              }}>
                <View
                  style={{
                    width: 11,
                    height: 11,
                    backgroundColor: darkBrown,
                    borderRadius: 5.5
                  }}
                />
                <View
                  style={{
                    width: 11,
                    height: 11,
                    marginLeft: 5,
                    backgroundColor: darkBrown,
                    borderRadius: 5.5
                  }}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* POPULAR SERVICES */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 24 }}>
          <Text
            style={{
              color: darkBrown,
              fontFamily: "Philosopher-Bold",
              fontSize: 25,
              textAlign: "center",
            }}
          >
            Kauden suosituimmat palvelut.
          </Text>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
              marginTop: 16,
            }}
          >
            {randomCategories.map((category, idx) => (
              <TouchableOpacity
                key={idx}
                style={{ marginBottom: 24, width: "48%", alignItems: "center" }}
                onPress={() => {
                  router.push({
                    pathname: "/services",
                    params: {
                      categoryName: category.name,
                      ...(category.name.toLowerCase() === 'hiukset' ? { uiVariant: 'hiukset' } : {}),
                      ...(category.name.toLowerCase() === 'karvanpoistot' ? { uiVariant: 'karvanpoistot' } : {})
                    }
                  });
                }}
                activeOpacity={0.8}
              >
                <Image
                  source={require("../../../../assets/group.png")}
                  style={{ position: "absolute", top: 25, width: 200, height: 210 }}
                  resizeMode="contain"
                />

                <Image
                  source={{ uri: "https://res.cloudinary.com/dguk4ks45/image/upload/v1755533722/AdobeStock_323915985_kzt3ji.png" }}
                  style={{
                    width: 127,
                    height: 128,
                    borderRadius: 24,
                  }}
                />

                <Text
                  style={{
                    textAlign: "center",
                    marginTop: 5,
                    color: darkBrown,
                    fontFamily: "Philosopher-Bold",
                    fontSize: 15,
                    maxWidth: 120,
                  }}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* TAGLINE */}
        <View style={{ backgroundColor: lightBrown }} className="py-3">
          <View style={{ position: "relative", height: 77, alignItems: "center", justifyContent: "center" }}>
            <Image
              source={require("../../../../assets/wed.png")}
              style={{ position: "absolute", top: -130, width: 300, height: 330, opacity: 1 }}
              resizeMode="contain"
              onError={(e) => {
                console.warn('Failed to load wed.png', e.nativeEvent?.error);
              }}
            />
            <Text
              style={{
                textAlign: "center",
                color: darkBrown,
                fontFamily: "Philosopher-Bold",
                fontSize: 20,
                paddingHorizontal: 16,
              }}
            >
              Hemmottelu, jonka ansaitset.
            </Text>
          </View>
        </View>

        {/* CATEGORIES */}
        <View className="px-4 py-6">
          <Text
            style={{
              textAlign: "center",
              color: darkBrown,
              fontFamily: "Philosopher-Bold",
              fontSize: 25,
              marginBottom: 20,
            }}
          >
            Kategoriat
          </Text>

          {/* Loading State */}
          {loading && (
            <View style={{ alignItems: "center", justifyContent: "center", padding: 20 }}>
              <ActivityIndicator size="large" color={darkBrown} />
              <Text style={{ color: darkBrown, fontFamily: "Philosopher-Regular", marginTop: 10 }}>
                Ladataan kategorioita...
              </Text>
            </View>
          )}

          {/* Error State */}
          {error && (
            <View style={{ alignItems: "center", justifyContent: "center", padding: 20 }}>
              <Text style={{ color: "red", fontFamily: "Philosopher-Regular", textAlign: "center" }}>
                Virhe: {error}
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor: lightBrown,
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 8,
                  marginTop: 10,
                }}
                onPress={() => {
                  // Retry fetching
                  setError(null);
                  setLoading(true);
                  getCategories()
                    .then(setCategories)
                    .catch((err) => setError(err.message))
                    .finally(() => setLoading(false));
                }}
              >
                <Text style={{ fontFamily: "Philosopher-Bold", color: darkBrown }}>
                  Yritä uudelleen
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Categories Grid */}
          {!loading && !error && (
            <View className="mt-4">
              {categoryRows.map((row, rowIdx) => (
                <View key={rowIdx} style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 }}>
                  {row.map((category, colIdx) => (
                    <TouchableOpacity
                      key={colIdx}
                      style={{
                        backgroundColor: lightBrown,
                        width: 138,
                        height: 47,
                        borderRadius: 24,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                      onPress={() => {
                        // Navigate to services page with category name
                        // Match the same navigation logic as categories page
                        router.push({
                          pathname: "/services",
                          params: {
                            categoryName: category.name,
                            // Pass a UI variant flag for special categories like Hiukset and Karvanpoistot
                            ...(category.name.toLowerCase() === 'hiukset' ? { uiVariant: 'hiukset' } : {}),
                            ...(category.name.toLowerCase() === 'karvanpoistot' ? { uiVariant: 'karvanpoistot' } : {})
                          }
                        });
                      }}
                    >
                      <Text
                        style={{
                          color: darkBrown,
                          textAlign: "center",
                          fontFamily: "Philosopher-Bold",
                          fontSize: 15,
                          paddingHorizontal: 8,
                        }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {row.length === 1 && <View style={{ width: 160 }} />}
                </View>
              ))}
              {/* "Lisaa" button centered below all categories */}
              <View style={{ width: "100%", alignItems: "center", marginTop: 8 }}>
                <TouchableOpacity
                  style={{
                    backgroundColor: lightBrown,
                    borderRadius: 24,
                    paddingVertical: 10,
                    paddingHorizontal: 28,
                  }}
                  onPress={() => router.push("/categories")}
                >
                  <Text
                    style={{
                      color: darkBrown,
                      fontFamily: "Philosopher-Bold",
                      fontSize: 16,
                    }}
                  >
                    Lisää
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* LOGIN & ENTREPRENEURS */}
        <View style={{ backgroundColor: lightBrown }} className="py-8">
          <View className="flex-row" style={{ justifyContent: "center", gap: 49 }}>
            <TouchableOpacity
              style={{
                backgroundColor: veryLightBeige,
                width: 122,
                height: 122,
                borderTopLeftRadius: 100,
                borderTopRightRadius: 100,
                justifyContent: "center",
                alignItems: "center",
              }}
              onPress={() => router.push("/sign-in")}
              activeOpacity={0.8}
            >
              <Text style={{ color: darkBrown, fontSize: 25, fontFamily: "Philosopher-Bold", textAlign: "center" }}>
                Kirjaudu sisään
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                backgroundColor: veryLightBeige,
                width: 122,
                height: 122,
                borderTopLeftRadius: 100,
                borderTopRightRadius: 100,
                justifyContent: "center",
                alignItems: "center",
              }}
              onPress={() => {
                if (isSignedIn) {
                  router.push("/admin-webview");
                } else {
                  router.push("/sign-in?redirect=%2Fadmin-webview");
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: darkBrown, fontSize: 25, fontFamily: "Philosopher-Bold", textAlign: "center" }}>
                Yrittäjille
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* FOOTER LINKS */}
        <View className="py-6 px-4" style={{ paddingBottom: 24 + 60 + insets.bottom }}>
          {[
            ["Käyttöehdot", "Palvelut"],
            ["Meistä", "Etusivu"],
            ["Tili", "Lahjakortit"],
            ["Ota yhteyttä", "Ajanvaraus"],
          ].map((row, rowIdx) => (
            <View key={rowIdx} className="flex-row justify-between" style={{ marginBottom: 20 }}>
              {row.map((link, colIdx) => (
                <TouchableOpacity
                  key={colIdx}
                  style={{ width: "48%", justifyContent: "center" }}
                  onPress={() => {
                    // Handle footer navigation
                    switch (link) {
                      case "Etusivu":
                        router.push("/");
                        break;
                      case "Palvelut":
                        router.push("/categories");
                        break;
                      case "Ajanvaraus":
                        router.push("/bookings");
                        break;
                      case "Lahjakortit":
                        Alert.alert("Lahjakortit", "Tulossa pian");
                        break;
                      case "Tili":
                        router.push("/profile");
                        break;
                      case "Käyttöehdot":
                        router.push("/info?tab=terms");
                        break;
                      case "Meistä":
                        router.push("/info?tab=about");
                        break;
                      case "Ota yhteyttä":
                        router.push("/info?tab=contact");
                        break;
                      default:
                        console.log(`Navigate to: ${link}`);
                        break;
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      color: darkBrown,
                      fontSize: 15,
                      marginLeft: 24,
                      fontFamily: "Philosopher-Bold",
                      textAlign: "left",
                    }}
                  >
                    {link}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
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

      {/* Rating Prompt Modal - auto shows for unrated completed bookings */}
      <RatingPromptModal
        visible={ratingModalVisible}
        booking={pendingRatingBooking}
        serviceName={ratingServiceName}
        salonName={ratingSalonName}
        onClose={handleRatingClose}
        onRatingSubmitted={handleRatingSubmitted}
      />
    </View>
  );
}
