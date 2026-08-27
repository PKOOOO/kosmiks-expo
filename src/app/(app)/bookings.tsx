// src/app/(app)/bookings.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { getBookings } from "../actions/get-bookings";
import { Booking } from "../types";
import { Ionicons } from "@expo/vector-icons";
import { API_ENDPOINTS } from "../../../config/constants";
import { router, useLocalSearchParams } from "expo-router";
import Header from "../components/Header";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const beige = "#D9C7AF";
const darkBrown = "#423120";
const lightBeige = "#E4D2BA";
const { width: screenWidth } = Dimensions.get("window");

// Function to fetch salon details by ID
const fetchSalonDetails = async (salonId: string) => {
  try {
    const response = await fetch(`${API_ENDPOINTS.SALONS}/${salonId}`);
    if (response.ok) {
      const salon = await response.json();
      return salon.name || "Salon";
    }
  } catch (error) {
    console.error("Error fetching salon details:", error);
  }
  return "Salon";
};

/** Helpers to safely extract names from different possible backend shapes */
function getServiceName(b: Booking) {
  const anyB = b as any;
  return (
    anyB.subService?.name ||
    anyB.service?.subService?.name ||
    anyB.service?.name ||
    anyB.subServiceName ||
    anyB.serviceName ||
    "Palvelu"
  );
}
function getSalonName(b: Booking, salonNames: Record<string, string>) {
  const anyB = b as any;

  // First try to get from fetched salon names
  if (anyB.saloonId && salonNames[anyB.saloonId]) {
    console.log("Using fetched salon name:", salonNames[anyB.saloonId]);
    return salonNames[anyB.saloonId];
  }

  // Fallback to direct fields
  const salonName = (
    anyB.salon?.name ||
    anyB.saloon?.name ||
    anyB.salonName ||
    anyB.saloonName ||
    "Salon"
  );

  console.log("Extracted salon name:", salonName);
  return salonName;
}

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [salonNames, setSalonNames] = useState<Record<string, string>>({});
  const { user } = useUser();
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ view?: string }>();

  // Rating modal state
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [reviewComment, setReviewComment] = useState("");

  // Determine which view to show: 'upcoming', 'past', or 'all' (default)
  const viewMode = params.view || 'all';

  // Separate bookings into upcoming (pending/confirmed) and past (completed)
  const upcomingBookings = bookings.filter(
    (b) => b.status === 'pending' || b.status === 'confirmed'
  );
  const pastBookings = bookings.filter((b) => b.status === 'completed');

  // Get the title based on view mode
  const getTitle = () => {
    switch (viewMode) {
      case 'upcoming':
        return 'Tulevat hoidot';
      case 'past':
        return 'Menneet hoidot';
      default:
        return 'Varaukset';
    }
  };

  // Fonts are loaded globally in root _layout.tsx

  const fetchBookings = async () => {
    try {
      setLoading(true);
      // Clerk uses user.id, not user.$id
      const userId = user?.id;
      const userEmail = user?.primaryEmailAddress?.emailAddress;

      console.log("Fetching bookings for user");
      console.log("User ID:", userId);
      console.log("User Email:", userEmail);

      const token = await getToken();
      const data = await getBookings(token ?? undefined, userId, userEmail);
      console.log("Bookings data received:", data);
      setBookings(data);

      // Fetch salon names for each booking
      const salonNamePromises = data.map(async (booking: any) => {
        if (booking.saloonId && !salonNames[booking.saloonId]) {
          const salonName = await fetchSalonDetails(booking.saloonId);
          return { salonId: booking.saloonId, salonName };
        }
        return null;
      });

      const salonResults = await Promise.all(salonNamePromises);
      const newSalonNames: Record<string, string> = {};
      salonResults.forEach(result => {
        if (result) {
          newSalonNames[result.salonId] = result.salonName;
        }
      });

      if (Object.keys(newSalonNames).length > 0) {
        setSalonNames(prev => ({ ...prev, ...newSalonNames }));
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
      Alert.alert("Error", "Failed to fetch bookings");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBookings();
    setRefreshing(false);
  };

  useEffect(() => {
    if (user) {
      fetchBookings();
    }
  }, [user]);

  const confirmCancel = (id: string) => {
    Alert.alert("Peruuta varaus", "Haluatko varmasti peruuttaa varauksen?", [
      { text: "Ei", style: "cancel" },
      {
        text: "Kyllä",
        style: "destructive",
        onPress: () => {
          setBookings((prev) => prev.filter((b) => b.id !== id));
          Alert.alert("Peruutettu", "Varaus peruutettu.");
        },
      },
    ]);
  };

  const handleRating = (booking: Booking) => {
    setSelectedBooking(booking);
    setSelectedRating(0);
    setRatingModalVisible(true);
  };

  const submitRating = async () => {
    if (!selectedBooking || selectedRating === 0) return;

    setSubmittingRating(true);
    try {
      console.log(`Submitting rating ${selectedRating} for booking ${selectedBooking.id}`);
      console.log(`API URL: ${API_ENDPOINTS.REVIEWS}`);

      const response = await fetch(API_ENDPOINTS.REVIEWS, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingId: selectedBooking.id,
          rating: selectedRating,
          comment: reviewComment.trim() || undefined,
        }),
      });

      const responseText = await response.text();
      console.log(`Response status: ${response.status}`);
      console.log(`Response body: ${responseText.substring(0, 200)}`);

      if (!response.ok) {
        console.error("Rating submission failed:", responseText);
        throw new Error("Failed to submit rating");
      }

      const result = JSON.parse(responseText);
      console.log("Rating submitted successfully:", result);

      setRatingModalVisible(false);
      setSelectedBooking(null);
      setSelectedRating(0);

      Alert.alert("Kiitos!", `Annoit arvosanan ${selectedRating}/5 ⭐`);
    } catch (error) {
      console.error("Error submitting rating:", error);
      Alert.alert("Virhe", "Arvosanan lähettäminen epäonnistui.");
    } finally {
      setSubmittingRating(false);
    }
  };

  const closeRatingModal = () => {
    setRatingModalVisible(false);
    setSelectedBooking(null);
    setSelectedRating(0);
    setReviewComment("");
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator size="large" color={darkBrown} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      {/* Header */}
      <Header
        title="SERVEY"
        showBack={true}
        showMenu={true}
        onBackPress={() => router.back()}
      />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        {/* WELCOME SECTION */}
        <View style={{
          backgroundColor: "#D7C3A7", // tan top section
          paddingTop: 20,
          paddingBottom: 40,
          alignItems: "center",
        }}>
          {/* Welcome message in arch-shaped panel */}
          <View style={{
            backgroundColor: "#F4EDE5",
            width: 240,
            height: 240,
            borderTopLeftRadius: 180,
            borderTopRightRadius: 180,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            justifyContent: "center",
            alignItems: "center",
            marginTop: 40,
            shadowColor: "#423120",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
          }}>
            <Text style={{
              fontSize: 25,
              fontFamily: "Philosopher-Bold",
              color: "#423120",
              textAlign: "center",
              lineHeight: 30,
            }}>
              {getTitle()}
            </Text>
          </View>
        </View>

        {/* Tulevat hoidot - show only when viewMode is 'upcoming' or 'all' */}
        {(viewMode === 'upcoming' || viewMode === 'all') && (
          <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
            {viewMode === 'all' && (
              <Text
                style={{
                  fontSize: 25,
                  fontFamily: "Philosopher-Bold",
                  color: darkBrown,
                  borderBottomWidth: 1,
                  borderBottomColor: "#D9C7AF",
                  paddingBottom: 4,
                }}
              >
                Tulevat hoidot
              </Text>
            )}

            {upcomingBookings.length === 0 ? (
              <View
                style={{
                  marginTop: 20,
                  padding: 20,
                  borderWidth: 3,
                  borderColor: "#D9C7AF",
                  borderRadius: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{
                  color: "#666",
                  fontSize: 15,
                  fontFamily: "Philosopher-Bold"
                }}>
                  Ei tulevia varauksia.
                </Text>
              </View>
            ) : (
              <View
                style={{
                  marginTop: 16,
                  borderWidth: 3,
                  borderColor: "#D9C7AF",
                  borderRadius: 12,
                  paddingVertical: 12,
                }}
              >
                {upcomingBookings.map((b, i) => {
                  const serviceName = getServiceName(b);
                  const salonName = getSalonName(b, salonNames);
                  const bookingDate = new Date(b.bookingTime);
                  const dateStr = bookingDate.toLocaleDateString("fi-FI", {
                    weekday: "short",
                    day: "numeric",
                    month: "numeric",
                    year: "numeric",
                  });
                  const timeStr = bookingDate.toLocaleTimeString("fi-FI", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <View
                      key={b.id}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text
                          style={{
                            fontSize: 17,
                            fontFamily: "Philosopher-Bold",
                            color: darkBrown,
                            marginBottom: 4,
                          }}
                        >
                          • {serviceName}
                        </Text>
                        <Text style={{
                          color: "#666",
                          fontSize: 15,
                          fontFamily: "Philosopher-Regular",
                          marginLeft: 12
                        }}>{dateStr}</Text>
                        <Text style={{
                          color: "#666",
                          fontSize: 15,
                          fontFamily: "Philosopher-Regular",
                          marginLeft: 12
                        }}>
                          klo {timeStr}
                        </Text>
                        <Text style={{
                          color: "#666",
                          fontSize: 15,
                          marginTop: 2,
                          fontFamily: "Philosopher-Regular",
                          marginLeft: 12
                        }}>
                          {salonName} Salon
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => confirmCancel(b.id)}
                        style={{
                          backgroundColor: "#E9E2D8",
                          borderRadius: 20,
                          paddingHorizontal: 17,
                          paddingVertical: 6,
                        }}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={{
                            color: darkBrown,
                            fontFamily: "Philosopher-Bold",
                            fontSize: 15,
                            textTransform: "lowercase",
                          }}
                        >
                          peru
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Menneet hoidot (Past treatments) - show only when viewMode is 'past' or 'all' */}
        {(viewMode === 'past' || viewMode === 'all') && (
          <View style={{ marginTop: 32, paddingHorizontal: 20 }}>
            {viewMode === 'all' && (
              <Text
                style={{
                  fontSize: 25,
                  fontFamily: "Philosopher-Bold",
                  color: darkBrown,
                  borderBottomWidth: 1,
                  borderBottomColor: "#D9C7AF",
                  paddingBottom: 4,
                }}
              >
                Menneet hoidot
              </Text>
            )}

            {pastBookings.length === 0 ? (
              <View
                style={{
                  marginTop: 20,
                  padding: 20,
                  borderWidth: 2,
                  borderColor: "#D9C7AF",
                  borderRadius: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{
                  color: "#666",
                  fontSize: 15,
                  fontFamily: "Philosopher-Bold"
                }}>
                  Ei menneitä hoitoja.
                </Text>
              </View>
            ) : (
              <View
                style={{
                  marginTop: 16,
                  borderWidth: 3,
                  borderColor: "#D9C7AF",
                  borderRadius: 12,
                  paddingVertical: 12,
                }}
              >
                {pastBookings.map((b, i) => {
                  const serviceName = getServiceName(b);
                  const salonName = getSalonName(b, salonNames);
                  const bookingDate = new Date(b.bookingTime);
                  const dateStr = bookingDate.toLocaleDateString("fi-FI", {
                    weekday: "short",
                    day: "numeric",
                    month: "numeric",
                    year: "numeric",
                  });
                  const timeStr = bookingDate.toLocaleTimeString("fi-FI", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <View
                      key={b.id}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text
                          style={{
                            fontSize: 17,
                            fontFamily: "Philosopher-Bold",
                            color: darkBrown,
                            marginBottom: 4,
                          }}
                        >
                          • {serviceName}
                        </Text>
                        <Text style={{
                          color: "#666",
                          fontSize: 15,
                          fontFamily: "Philosopher-Regular",
                          marginLeft: 12
                        }}>{dateStr}</Text>
                        <Text style={{
                          color: "#666",
                          fontSize: 15,
                          fontFamily: "Philosopher-Regular",
                          marginLeft: 12
                        }}>
                          klo {timeStr}
                        </Text>
                        <Text style={{
                          color: "#666",
                          fontSize: 15,
                          marginTop: 2,
                          fontFamily: "Philosopher-Regular",
                          marginLeft: 12
                        }}>
                          {salonName} Salon
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => handleRating(b)}
                        style={{
                          backgroundColor: beige,
                          borderRadius: 20,
                          paddingHorizontal: 14,
                          paddingVertical: 6,
                          flexDirection: "row",
                          alignItems: "center",
                          borderWidth: 1,
                          borderColor: darkBrown,
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="star" size={14} color={darkBrown} style={{ marginRight: 4 }} />
                        <Text
                          style={{
                            color: darkBrown,
                            fontFamily: "Philosopher-Bold",
                            fontSize: 14,
                          }}
                        >
                          arvostele
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Rating Modal */}
      <Modal
        visible={ratingModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeRatingModal}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "flex-end",
          }}>
            <View style={{
              backgroundColor: "white",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 24,
              paddingTop: 24,
              paddingBottom: insets.bottom + 24,
            }}>
              {/* Handle bar */}
              <View style={{
                width: 40,
                height: 4,
                backgroundColor: "#E0CFB9",
                borderRadius: 2,
                alignSelf: "center",
                marginBottom: 20,
              }} />

              {/* Close Button */}
              <TouchableOpacity
                style={{
                  position: 'absolute',
                  top: 20,
                  right: 20,
                  zIndex: 10,
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#F4EDE5',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                onPress={closeRatingModal}
              >
                <Ionicons name="close" size={24} color={darkBrown} />
              </TouchableOpacity>

              {/* Title */}
              <Text style={{
                fontFamily: "Philosopher-Bold",
                fontSize: 20,
                color: darkBrown,
                textAlign: "center",
                marginBottom: 8,
              }}>
                Arvostele hoito
              </Text>

              {/* Service & Salon name */}
              {selectedBooking && (
                <Text style={{
                  fontFamily: "Philosopher-Regular",
                  fontSize: 18,
                  color: darkBrown,
                  textAlign: "center",
                  marginBottom: 24,
                  opacity: 0.7,
                }}>
                  {getServiceName(selectedBooking)} - {getSalonName(selectedBooking, salonNames)}
                </Text>
              )}

              {/* Star Rating */}
              <View style={{
                flexDirection: "row",
                justifyContent: "center",
                marginBottom: 16,
                gap: 4,
              }}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const isSelected = star <= selectedRating;
                  const starColor = isSelected ? darkBrown : "#E0CFB9";
                  return (
                    <TouchableOpacity
                      key={`star-${star}-${selectedRating}`}
                      onPress={() => setSelectedRating(star)}
                      activeOpacity={0.7}
                      style={{
                        padding: 8,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 36,
                          color: starColor,
                          fontFamily: 'Philosopher-Bold',
                        }}
                      >
                        ★
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Rating description */}
              <Text style={{
                fontFamily: "Philosopher-Regular",
                fontSize: 18,
                color: darkBrown,
                textAlign: "center",
                marginBottom: 24,
              }}>
                {selectedRating === 0 && "Valitse arvosana napauttamalla tähtiä"}
                {selectedRating === 1 && "Huono kokemus 😞"}
                {selectedRating === 2 && "Tyydyttävä 😐"}
                {selectedRating === 3 && "Hyvä 🙂"}
                {selectedRating === 4 && "Erittäin hyvä 😊"}
                {selectedRating === 5 && "Erinomainen! 🤩"}
              </Text>

              {/* Comment Input */}
              <View style={{ marginBottom: 24 }}>
                <Text style={{
                  fontFamily: "Philosopher-Bold",
                  fontSize: 16,
                  color: darkBrown,
                  marginBottom: 8,
                }}>
                  Kirjoita arvostelu (valinnainen)
                </Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: "#E0CFB9",
                    borderRadius: 12,
                    padding: 16,
                    fontFamily: "Philosopher-Regular",
                    fontSize: 16,
                    color: darkBrown,
                    minHeight: 100,
                    textAlignVertical: "top",
                  }}
                  placeholder="Kerro kokemuksestasi..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                  value={reviewComment}
                  onChangeText={setReviewComment}
                />
              </View>

              {/* Buttons */}
              <View style={{ flexDirection: "row", gap: 12 }}>


                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: selectedRating > 0 ? darkBrown : "#E0CFB9",
                    paddingVertical: 16,
                    borderRadius: 12,
                    alignItems: "center",
                  }}
                  onPress={submitRating}
                  disabled={selectedRating === 0 || submittingRating}
                >
                  {submittingRating ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={{
                      fontFamily: "Philosopher-Bold",
                      fontSize: 16,
                      color: "white",
                    }}>
                      Lähetä
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
