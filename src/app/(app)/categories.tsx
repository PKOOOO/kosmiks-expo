import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, SafeAreaView, Modal } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import getCategories from "../actions/get-categories";
import { Category } from "../types";
import Header from "../components/Header";
import SideMenu from "../components/SideMenu";

const Categories: React.FC = () => {
  const router = useRouter();
  const { width } = Dimensions.get("window");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMenuVisible, setMenuVisible] = useState(false);

  const buttonMargin = 6;
  const buttonBorderRadius = 30;
  const baseButtonColor = "#D7C3A7";
  const baseTextColor = "#423120";
  const lightBeige = "#ffffffff";
  const baseFontSize = 18;
  const basePaddingVertical = 14;
  const basePaddingHorizontal = 24;

  const [fontsLoaded] = useFonts({
    PhilosopherBold: require("../assets/fonts/Philosopher-Bold.ttf"),
  });

  // Fetch categories from backend
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getCategories();
        setCategories(data);
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

  if (!fontsLoaded) {
    return null;
  }

  const CategoryButton = ({ category, style }: { category: Category, style?: any }) => (
    <TouchableOpacity
      style={{
        backgroundColor: baseButtonColor,
        borderRadius: buttonBorderRadius,
        margin: buttonMargin,
        alignItems: "center",
        justifyContent: "center",
        height: 88,
        ...style,
      }}
      onPress={() => {
        console.log(`Selected category: ${category.name} (ID: ${category.id})`);
        router.push({
          pathname: "services",
          params: {
            categoryName: category.name,
            // Pass a UI variant flag for special categories like Hiukset
            ...(category.name.toLowerCase() === 'hiukset' ? { uiVariant: 'hiukset' } : {}),
            ...(category.name.toLowerCase() === 'karvanpoistot' ? { uiVariant: 'karvanpoistot' } : {})
          }
        });
      }}
    >
      <Text
        style={{
          fontFamily: "PhilosopherBold",
          fontSize: baseFontSize,
          color: baseTextColor,
          textAlign: "center",
          paddingVertical: basePaddingVertical,
          paddingHorizontal: basePaddingHorizontal,
        }}
      >
        {category.name}
      </Text>
    </TouchableOpacity>
  );

  // Function to create rows dynamically based on the number of categories
  const createCategoryRows = () => {
    if (categories.length === 0) return null;

    const rows = [];
    let currentIndex = 0;

    const layoutPatterns = [
      { flex1: 1.5, flex2: 1 },
      { flex1: 1.1, flex2: 2 },
      { flex1: 1.7, flex2: 1.2 }, // Row 3: Increased flex2 for "Kynnet" box
      { flex1: 1.2, flex2: 2 },
      { flex1: 2, flex2: 1.2 },
    ];

    // Calculate total number of rows to determine if this is the last row
    const totalPairs = Math.ceil(categories.length / 2);

    while (currentIndex < categories.length) {
      const remainingCategories = categories.length - currentIndex;
      const currentRowNumber = Math.floor(currentIndex / 2) + 1;
      const isLastRow = currentRowNumber === totalPairs && remainingCategories === 2;

      if (remainingCategories === 1) {
        rows.push(
          <CategoryButton
            key={categories[currentIndex].id}
            category={categories[currentIndex]}
            style={{ width: "95%", alignSelf: "center" }}
          />
        );
        currentIndex++;
      } else {
        // For the last row, use narrow-wide pattern (1, 2)
        // For other rows, use the cycling pattern
        let pattern;
        if (isLastRow) {
          pattern = { flex1: 1, flex2: 2 };
        } else {
          const patternIndex = Math.floor(currentIndex / 2) % layoutPatterns.length;
          pattern = layoutPatterns[patternIndex];
        }

        rows.push(
          <View key={`row-${currentIndex}`} style={{ flexDirection: "row", justifyContent: "center", alignItems: "center" }}>
            <CategoryButton
              category={categories[currentIndex]}
              style={{
                flex: pattern.flex1,
                minWidth: (width * (pattern.flex1 / (pattern.flex1 + pattern.flex2)) * 0.94) - (buttonMargin * 2),
                maxWidth: "auto"
              }}
            />
            {currentIndex + 1 < categories.length && (
              <CategoryButton
                category={categories[currentIndex + 1]}
                style={{
                  flex: pattern.flex2,
                  minWidth: (width * (pattern.flex2 / (pattern.flex1 + pattern.flex2)) * 0.9) - (buttonMargin * 2),
                  maxWidth: "auto"
                }}
              />
            )}
          </View>
        );
        currentIndex += 2;
      }
    }

    return rows;
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
        {error && (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text
              style={{
                fontFamily: "PhilosopherBold",
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
                backgroundColor: baseButtonColor,
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 8,
              }}
              onPress={async () => {
                setError(null);
                setLoading(true);
                try {
                  const data = await getCategories();
                  setCategories(data);
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to fetch categories');
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Text style={{ fontFamily: "PhilosopherBold", color: baseTextColor }}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Categories List with Custom Layout */}
        {!loading && !error && (
          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10, marginLeft: -5 }}>
            <View style={{ flexDirection: "column", alignItems: "center", paddingBottom: 20 }}>
              {createCategoryRows()}
            </View>
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
              No categories found
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
