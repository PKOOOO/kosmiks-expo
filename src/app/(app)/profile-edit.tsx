// src/app/(app)/profile-edit.tsx
import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useFonts } from "expo-font";
import Header from "@/components/Header";
import { useAuth, useUser } from "@clerk/clerk-expo";

const darkBrown = "#423120";
const beige = "#D9C7AF";
const lightBeige = "#D7C3A7";
const inputBox = "F4EDE5"
const titleLine = "#D7C3A7";

export default function ProfileEditPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user: clerkUser, isLoaded: userLoaded } = useUser();
  const [isMenuVisible, setMenuVisible] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const [fontsLoaded] = useFonts({
    'Philosopher-Regular': require("../../assets/app-fonts/Philosopher-Regular.ttf"),
    'Philosopher-Bold': require("../../assets/app-fonts/Philosopher-Bold.ttf"),
    'Philosopher-Italic': require("../../assets/app-fonts/Philosopher-Italic.ttf"),
    'Philosopher-BoldItalic': require("../../assets/app-fonts/Philosopher-BoldItalic.ttf"),
  });

  useEffect(() => {
    // Wait for auth to load
    if (!authLoaded || !userLoaded) {
      return;
    }

    // Redirect if not authenticated
    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }

    // Load user data from Clerk
    if (clerkUser) {
      const fullName = clerkUser.fullName || clerkUser.firstName || "";
      setName(fullName);
      setEmail(clerkUser.primaryEmailAddress?.emailAddress || "");
      // Extract username from name (first name)
      setUsername(clerkUser.firstName || fullName.split(' ')[0] || "");
      // Phone might not be in user object, so leave empty or get from user.phoneNumbers if exists
      const phoneNumber = clerkUser.phoneNumbers?.[0]?.phoneNumber || "";
      setPhone(phoneNumber);
    }
  }, [clerkUser, isSignedIn, authLoaded, userLoaded, router]);

  const handleSave = async () => {
    if (!name || !email) {
      Alert.alert("Virhe", "Täytä kaikki pakolliset kentät");
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement update user API call here
      // await updateUser({ name, email, phone });

      Alert.alert("Onnistui", "Tiedot tallennettiin onnistuneesti", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (error) {
      Alert.alert("Virhe", "Tietojen tallennus epäonnistui");
    } finally {
      setLoading(false);
    }
  };

  if (!fontsLoaded || !authLoaded || !userLoaded) {
    return null;
  }

  // Redirect if not authenticated
  if (!isSignedIn) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="SERVEY"
        showBack={true}
        showMenu={true}
        onBackPress={() => router.back()}
        onMenuPress={() => setMenuVisible(true)}
        disableSafeAreaPadding={true}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Card Container */}
        <View style={styles.card}>
          {/* Title */}
          <Text style={styles.title}>Asetukset</Text>

          {/* Horizontal line */}
          <View style={styles.titleLine} />

          {/* Form Fields */}
          <View style={styles.formContainer}>

            {/* Käyttäjänimi (Username) */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Käyttäjänimi</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Anna käyttäjänimesi"
                placeholderTextColor={darkBrown + "80"}
              />
            </View>

            {/* Sähköpostiosoite (Email) */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Sähköpostiosoite</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="anna@example.com"
                placeholderTextColor={darkBrown + "80"}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Puhelin (Phone) */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Puhelin</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+358 123456789"
                placeholderTextColor={darkBrown + "80"}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={darkBrown} />
            ) : (
              <Text style={styles.saveButtonText}>Tallenna</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Bottom Spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
    justifyContent: "center",
    flexGrow: 1,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 27,
    borderWidth: 2,
    borderColor: beige,
    width: "100%",
    maxWidth: 400,
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 25,
    fontFamily: "Philosopher-Bold",
    color: darkBrown,
    textAlign: "left",
    marginTop: -8,
    marginBottom: 8,
  },
  titleLine: {
    height: 2,
    backgroundColor: titleLine,
    width: "118%",
    alignSelf: "center",
    marginBottom: 24,
  },
  formContainer: {
    gap: 20,
  },
  fieldContainer: {
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontFamily: "Philosopher-Bold",
    color: darkBrown,
    marginBottom: 4,
  },
  input: {
    backgroundColor: lightBeige,
    borderRadius: 25,
    height: 50,
    paddingHorizontal: 20,
    fontSize: 15,
    fontFamily: "Philosopher-Bold",
    color: darkBrown,
    borderWidth: 0,
  },
  saveButton: {
    backgroundColor: lightBeige,
    borderRadius: 25,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 18,
    fontFamily: "Philosopher-Bold",
    color: darkBrown,
  },
});
