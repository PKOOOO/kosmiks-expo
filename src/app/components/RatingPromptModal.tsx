// src/app/components/RatingPromptModal.tsx
import React, { useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    Alert,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Booking } from "../types";
import { API_ENDPOINTS } from "../../../config/constants";

const darkBrown = "#423120";

interface RatingPromptModalProps {
    visible: boolean;
    booking: Booking | null;
    serviceName: string;
    salonName: string;
    onClose: () => void;
    onRatingSubmitted: () => void;
}

export const RatingPromptModal: React.FC<RatingPromptModalProps> = ({
    visible,
    booking,
    serviceName,
    salonName,
    onClose,
    onRatingSubmitted,
}) => {
    const insets = useSafeAreaInsets();
    const [selectedRating, setSelectedRating] = useState(0);
    const [comment, setComment] = useState("");
    const [submittingRating, setSubmittingRating] = useState(false);

    const submitRating = async () => {
        if (!booking || selectedRating === 0) return;

        setSubmittingRating(true);
        try {
            console.log(`Submitting rating ${selectedRating} for booking ${booking.id}`);

            const response = await fetch(API_ENDPOINTS.REVIEWS, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    bookingId: booking.id,
                    rating: selectedRating,
                    comment: comment.trim() || undefined,
                }),
            });

            if (!response.ok) {
                const responseText = await response.text();
                console.error("Rating submission failed:", responseText);
                throw new Error("Failed to submit rating");
            }

            setSelectedRating(0);
            setComment("");
            onRatingSubmitted();
            Alert.alert("Kiitos!", `Annoit arvosanan ${selectedRating}/5 ⭐`);
        } catch (error) {
            console.error("Error submitting rating:", error);
            Alert.alert("Virhe", "Arvosanan lähettäminen epäonnistui.");
        } finally {
            setSubmittingRating(false);
        }
    };

    const handleClose = () => {
        setSelectedRating(0);
        setComment("");
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={handleClose}
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
                        maxHeight: "85%",
                    }}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Handle bar */}
                            <View style={{
                                width: 40,
                                height: 4,
                                backgroundColor: "#E0CFB9",
                                borderRadius: 2,
                                alignSelf: "center",
                                marginBottom: 20,
                            }} />

                            {/* Title */}
                            <Text style={{
                                fontFamily: "Philosopher-Bold",
                                fontSize: 24,
                                color: darkBrown,
                                textAlign: "center",
                                marginBottom: 8,
                            }}>
                                Arvostele hoito
                            </Text>

                            {/* Service & Salon name */}
                            <Text style={{
                                fontFamily: "Philosopher-Regular",
                                fontSize: 20,
                                color: darkBrown,
                                textAlign: "center",
                                marginBottom: 24,
                                opacity: 0.7,
                            }}>
                                {serviceName} - {salonName}
                            </Text>

                            {/* Star Rating */}
                            <View style={{
                                flexDirection: "row",
                                justifyContent: "center",
                                marginBottom: 16,
                            }}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <TouchableOpacity
                                        key={star}
                                        onPress={() => setSelectedRating(star)}
                                        style={{ paddingHorizontal: 8 }}
                                    >
                                        <Text style={{
                                            fontSize: 40,
                                            color: star <= selectedRating ? darkBrown : "#E0CFB9",
                                        }}>
                                            ★
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Rating description */}
                            <Text style={{
                                fontFamily: "Philosopher-Regular",
                                fontSize: 20,
                                color: darkBrown,
                                textAlign: "center",
                                marginBottom: 16,
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
                                    value={comment}
                                    onChangeText={setComment}
                                />
                            </View>

                            {/* Buttons */}
                            <View style={{ flexDirection: "row", gap: 12 }}>
                                <TouchableOpacity
                                    style={{
                                        flex: 1,
                                        backgroundColor: "#F5F5F5",
                                        paddingVertical: 16,
                                        borderRadius: 12,
                                        alignItems: "center",
                                    }}
                                    onPress={handleClose}
                                >
                                    <Text style={{
                                        fontFamily: "Philosopher-Bold",
                                        fontSize: 16,
                                        color: darkBrown,
                                    }}>
                                        Myöhemmin
                                    </Text>
                                </TouchableOpacity>

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
                        </ScrollView>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

export default RatingPromptModal;
