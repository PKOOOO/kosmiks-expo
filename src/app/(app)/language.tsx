// src/app/(app)/language.tsx
import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useFonts } from "expo-font";
import Header from "@/components/Header";

const darkBrown = "#423120";
const beige = "#D9C7AF";
const lightBeige = "#D7C3A7";
const titleLine = "#D7C3A7";

export default function LanguagePage() {
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState<string>("Suomi");

  const [fontsLoaded] = useFonts({
    'Philosopher-Regular': require("../../assets/app-fonts/Philosopher-Regular.ttf"),
    'Philosopher-Bold': require("../../assets/app-fonts/Philosopher-Bold.ttf"),
    'Philosopher-Italic': require("../../assets/app-fonts/Philosopher-Italic.ttf"),
    'Philosopher-BoldItalic': require("../../assets/app-fonts/Philosopher-BoldItalic.ttf"),
  });

  const languages = [
    { code: "fi", name: "Suomi" },
    { code: "sv", name: "Svenska" },
    { code: "en", name: "English" },
  ];

  const handleLanguageSelect = (languageCode: string, languageName: string) => {
    setSelectedLanguage(languageName);
    // TODO: Implement language change logic here
    // This could save to AsyncStorage or update a language store
    console.log("Selected language:", languageCode, languageName);
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="SERVEY"
        showBack={true}
        showMenu={true}
        onBackPress={() => router.back()}
        onMenuPress={() => { }}
        disableSafeAreaPadding={true}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Card Container */}
        <View style={styles.card}>
          {/* Title */}
          <Text style={styles.title}>Kieli</Text>

          {/* Horizontal line */}
          <View style={styles.titleLine} />

          {/* Language Buttons */}
          <View style={styles.buttonsContainer}>
            {languages.map((language) => (
              <TouchableOpacity
                key={language.code}
                style={[
                  styles.languageButton,
                  selectedLanguage === language.name && styles.languageButtonSelected
                ]}
                onPress={() => handleLanguageSelect(language.code, language.name)}
                activeOpacity={0.7}
              >
                <Text style={styles.languageButtonText}>{language.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
    borderWidth: 3,
    borderColor: beige,
    width: "100%",
    maxWidth: 400,
    height: 309,
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 25,
    fontFamily: "Philosopher-Bold",
    color: darkBrown,
    textAlign: "center",
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
  buttonsContainer: {
    gap: 16,
    alignItems: "center",
  },
  languageButton: {
    backgroundColor: lightBeige,
    borderRadius: 30,
    height: 47,
    width: 127,
    justifyContent: "center",
    alignItems: "center",
    alignContent: "center",
    paddingHorizontal: 20,
  },
  languageButtonSelected: {
    backgroundColor: beige,
    borderWidth: 2,
    borderColor: darkBrown,
  },
  languageButtonText: {
    fontSize: 15,
    fontFamily: "Philosopher-Bold",
    color: darkBrown,
  },
});
