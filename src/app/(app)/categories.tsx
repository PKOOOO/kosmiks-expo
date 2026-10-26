import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, SafeAreaView, Modal } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import getCategories from "@/actions/get-categories";
import { Category } from "@/types";
import Header from "@/components/Header";
import SideMenu from "@/components/SideMenu";
import CategoryCardGrid from "@/components/CategoryCardGrid";
import ErrorState from "@/components/ErrorState";

const Categories: React.FC = () => {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [isMenuVisible, setMenuVisible] = useState(false);

  const baseButtonColor = "#D7C3A7";
  const baseTextColor = "#423120";
  const lightBeige = "#ffffffff";

  const [fontsLoaded] = useFonts({
    PhilosopherBold: require("../../assets/app-fonts/Philosopher-Bold.ttf"),
  });

  // Fetch categories from backend; also used by retry / reconnect
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCategories();
      setCategories(data);
    } catch (err) {
      console.warn('Error fetching categories:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  if (!fontsLoaded) {
    return null;
  }

  const openCategory = (category: Category) => {
    console.log(`Selected category: ${category.name} (ID: ${category.id})`);
    router.push({
      pathname: "services",
      params: {
        categoryName: category.name,
        ...(category.name.toLowerCase() === 'hiukset' ? { uiVariant: 'hiukset' } : {}),
        ...(category.name.toLowerCase() === 'karvanpoistot' ? { uiVariant: 'karvanpoistot' } : {}),
      },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: lightBeige }}>
      {/* Header - Full Width */}
      <Header
        showBack={true}
        showMenu={true}
        onBackPress={() => router.back()}
        onMenuPress={() => setMenuVisible(true)}
        disableSafeAreaPadding={true}
      />

      {/* Content with padding */}
      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        {/* Loading State */}
        {loading && (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={baseTextColor} />

          </View>
        )}

        {/* Error State */}
        {!loading && error != null && (
          <ErrorState error={error} onRetry={fetchCategories} style={{ flex: 1 }} />
        )}

        {/* Categories List with Custom Layout */}
        {!loading && !error && (
          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10, marginLeft: -5 }}>
            <CategoryCardGrid
              categories={categories}
              onCategoryPress={openCategory}
              fontFamily="PhilosopherBold"
              style={{ paddingBottom: 20 }}
            />
          </ScrollView>
        )}

        {/* Empty State */}
        {!loading && !error && categories.length === 0 && (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text
              style={{
                fontFamily: "PhilosopherBold",
                fontSize: 18,
                color: baseTextColor,
                textAlign: "center",
              }}
            >
              Kategorioita ei löytynyt
            </Text>
          </View>
        )}
      </View>

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

export default Categories;
