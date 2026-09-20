import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Alert,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import Header from "@/components/Header";
import SideMenu from "@/components/SideMenu";
import { useClerk, useAuth, useUser } from "@clerk/clerk-expo";

export default function ProfilePage() {
  const { signOut } = useClerk();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [isMenuVisible, setMenuVisible] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const handleMenuPress = async (menuItem: string) => {
    switch (menuItem) {
      case "Tulevat hoidot":
        if (isSignedIn) {
          router.push("/bookings?view=upcoming");
        } else {
          router.push("/sign-in");
        }
        break;
      case "Menneet hoidot":
        if (isSignedIn) {
          router.push("/bookings?view=past");
        } else {
          router.push("/sign-in");
        }
        break;
      case "Asetukset":
        if (isSignedIn) {
          router.push("/profile-edit");
        } else {
          Alert.alert("Kirjaudu sisään", "Sinun täytyy kirjautua sisään päästäksesi asetuksiin", [
            { text: "Peruuta", style: "cancel" },
            { text: "Kirjaudu", onPress: () => router.push("/sign-in") }
          ]);
        }
        break;
      case "Kieli":
        router.push("/language");
        break;
      case "Kirjaudu sisään":
        router.push("/sign-in");
        break;
      case "Kirjaudu ulos":
        if (isSigningOut) return;
        setIsSigningOut(true);
        try {
          await signOut();
          Alert.alert("Onnistui", "Olet kirjautunut ulos");
          router.replace("/");
        } catch (error) {
          Alert.alert("Virhe", "Kirjautuminen ulos epäonnistui");
        } finally {
          setIsSigningOut(false);
        }
        break;
    }
  };

  const menuItems = isSignedIn
    ? [
      "Tulevat hoidot",
      "Menneet hoidot",
      "Asetukset",
      "Kieli",
      "Kirjaudu ulos",
    ]
    : [
      "Tulevat hoidot",
      "Menneet hoidot",
      "Asetukset",
      "Kieli",
      "Kirjaudu sisään",
    ];

  // Get user's first name for display.
  // Falls back to email username (e.g. "alex" from "alex@gmail.com") so OAuth users
  // without a populated firstName don't end up as the generic "Käyttäjä".
  const emailUsername = user?.primaryEmailAddress?.emailAddress?.split('@')[0]
    ?? user?.emailAddresses?.[0]?.emailAddress?.split('@')[0];
  const displayName =
    user?.firstName
    || user?.fullName?.split(' ')[0]
    || user?.username
    || emailUsername
    || 'Käyttäjä';

  return (
    <View collapsable={false} style={styles.container}>
      {/* Header */}
      <Header
        title="SERVEY"
        showBack={true}
        showMenu={true}
        onBackPress={() => router.back()}
        onMenuPress={() => setMenuVisible(true)}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* WELCOME SECTION */}
        <View style={styles.headerContainer}>
          <View style={styles.archContainer}>
            <Text style={styles.welcomeText}>
              Tervetuloa,{"\n"}
              {displayName}!
            </Text>
          </View>
        </View>

        {/* MENU */}
        <View style={styles.menuContainer}>
          {menuItems.map((item) => {
            const isLoading = item === "Kirjaudu ulos" && isSigningOut;
            return (
              <TouchableOpacity
                key={item}
                onPress={() => handleMenuPress(item)}
                style={[styles.menuButton, { opacity: isLoading ? 0.6 : 1 }]}
                activeOpacity={0.7}
                disabled={isLoading}
              >
                <Text style={styles.menuButtonText}>{item}</Text>
                {isLoading ? (
                  <ActivityIndicator size="small" color="#423120" />
                ) : (
                  <Ionicons name="arrow-forward" size={20} color="#423120" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bottom Spacer */}
        <View style={{ height: 100 }} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  // WELCOME SECTION
  headerContainer: {
    backgroundColor: "#D7C3A7",
    paddingTop: 20,
    paddingBottom: 40,
    alignItems: "center",
  },
  archContainer: {
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
  },
  welcomeText: {
    fontSize: 25,
    fontFamily: "Philosopher-Bold",
    color: "#423120",
    textAlign: "center",
    lineHeight: 30,
  },

  // MENU
  menuContainer: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 40,
    width: "100%",
  },
  menuButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    minHeight: 84,
    paddingHorizontal: 20,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 3,
    borderColor: "#D7C3A7",
  },
  menuButtonText: {
    fontSize: 20,
    fontFamily: "Philosopher-Bold",
    color: "#423120",
  },
});
