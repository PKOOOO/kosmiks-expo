// src/app/(app)/language.tsx
import React from "react";
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
import { LANGUAGES, useLanguage, useT } from '@/i18n';

const darkBrown = "#423120";
const beige = "#D9C7AF";
const lightBeige = "#D7C3A7";
const titleLine = "#D7C3A7";

export default function LanguagePage() {
  const { t } = useT();
  const router = useRouter();
  const lang = useLanguage((s) => s.lang);
  const setLang = useLanguage((s) => s.setLang);

  const [fontsLoaded] = useFonts({
    'Philosopher-Regular': require("../../assets/app-fonts/Philosopher-Regular.ttf"),
    'Philosopher-Bold': require("../../assets/app-fonts/Philosopher-Bold.ttf"),
    'Philosopher-Italic': require("../../assets/app-fonts/Philosopher-Italic.ttf"),
    'Philosopher-BoldItalic': require("../../assets/app-fonts/Philosopher-BoldItalic.ttf"),
  });


  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="KOSMIKS"
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
          <Text style={styles.title}>{t('language.title')}</Text>

          {/* Horizontal line */}
          <View style={styles.titleLine} />

          {/* Language Buttons */}
          <View style={styles.buttonsContainer}>
            {LANGUAGES.map((language) => (
              <TouchableOpacity
                key={language.code}
                style={[
                  styles.languageButton,
                  lang === language.code && styles.languageButtonSelected
                ]}
                onPress={() => setLang(language.code)}
                accessibilityState={{ selected: lang === language.code }}
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
