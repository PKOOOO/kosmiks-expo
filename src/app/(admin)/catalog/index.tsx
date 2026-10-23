import React, { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Platform, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import CategoryCardGrid from '@/components/CategoryCardGrid';
import BrandHeader from '@/components/BrandHeader';
import { RoundButton, EmptyState, colors } from '@/components/admin/AdminUI';
import { CategorySheet } from '@/components/admin/CatalogSheets';
import { useCatalogStore } from '@/lib/admin-catalog';
import { useTabBarSpace } from '@/lib/layout';

// Catalog: the same category blocks customers see. Tap one to manage its
// services; darker blocks are the featured ones on the customer home screen.
export default function AdminCatalogScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const tabBarSpace = useTabBarSpace();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const tokenFn = useCallback(() => getTokenRef.current(), []);

  const { categories, services, loaded, load, saveCategory } = useCatalogStore();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try { await load(tokenFn); } catch { setError("Couldn't load the catalog."); } finally { setRefreshing(false); }
  }, [load, tokenFn]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const featured = categories.filter(c => c.popular).map(c => c.name);
  const serviceCount = services.filter(s => s.parentServiceId === null).length;

  return (
    <SafeAreaView edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined} style={{ flex: 1, backgroundColor: colors.white }}>
      <BrandHeader right={<RoundButton icon="add" filled label="Add category" onPress={() => setAdding(true)} />} />

      {!loaded ? (
        <ActivityIndicator size="large" color={colors.dark} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: tabBarSpace }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void refresh(); }} tintColor={colors.dark} />}
        >
          {categories.length === 0 ? (
            <EmptyState icon="grid-outline" title={error ?? 'No categories yet'} body={error ? undefined : 'Tap + to add the first one.'} />
          ) : (
            <>
              <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 14 }}>
                {categories.length} categories · {serviceCount} services
              </Text>
              <CategoryCardGrid
                categories={categories}
                selectedCategoryNames={featured}
                onCategoryPress={c => router.push(`/(admin)/catalog/${c.id}` as any)}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18 }}>
                <View style={{ width: 14, height: 14, borderRadius: 5, backgroundColor: colors.dark }} />
                <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: colors.muted }}>Featured on the customer home screen</Text>
              </View>
            </>
          )}
        </ScrollView>
      )}

      <CategorySheet
        visible={adding}
        category={null}
        onClose={() => setAdding(false)}
        onSave={async input => {
          try {
            const created = await saveCategory(tokenFn, input);
            setAdding(false);
            router.push(`/(admin)/catalog/${created.id}` as any);
          } catch (e: any) {
            Alert.alert("Couldn't create category", e?.message ?? 'Please try again.');
          }
        }}
      />
    </SafeAreaView>
  );
}
