import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Alert, Platform } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import BrandHeader from '@/components/BrandHeader';
import { RoundButton, Button, colors } from '@/components/admin/AdminUI';
import { CategorySheet, ServiceSheet } from '@/components/admin/CatalogSheets';
import { useCatalogStore, type Service } from '@/lib/admin-catalog';
import { usePageBottomSpace } from '@/lib/layout';

// Mirrors the customer category page (blob hero, service titles, bordered
// option cards) so admins edit exactly what customers see.
const heroBg = '#D7C3A7';

type ServiceSheetState = { service: Service | null; parentServiceId: string | null; parentName?: string } | null;

export default function AdminCategoryScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const { getToken } = useAuth();
  const router = useRouter();
  const pageBottom = usePageBottomSpace();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const tokenFn = useCallback(() => getTokenRef.current(), []);

  const category = useCatalogStore(s => s.categories.find(c => c.id === categoryId));
  const services = useCatalogStore(s => s.services);
  const { saveCategory, deleteCategory, saveService, deleteService } = useCatalogStore();

  const [editingCategory, setEditingCategory] = useState(false);
  const [serviceSheet, setServiceSheet] = useState<ServiceSheetState>(null);

  const groups = useMemo(() => {
    const parents = services.filter(s => s.categoryId === categoryId && s.parentServiceId === null);
    return parents.map(p => ({ parent: p, options: services.filter(s => s.parentServiceId === p.id) }));
  }, [services, categoryId]);

  if (!category) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.white }}>
        <BrandHeader left={<RoundButton icon="arrow-back" label="Back" onPress={() => router.back()} />} />
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 30 }}>
          This category no longer exists.
        </Text>
      </SafeAreaView>
    );
  }

  const toggleFeatured = async () => {
    try {
      await saveCategory(tokenFn, { name: category.name, popular: !category.popular }, category.id);
    } catch {
      Alert.alert("Couldn't update", 'Please try again.');
    }
  };

  const confirmDeleteCategory = () => {
    Alert.alert(`Delete “${category.name}”?`, 'Only possible when it has no services.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCategory(tokenFn, category.id);
            setEditingCategory(false);
            router.back();
          } catch {
            Alert.alert("Can't delete", 'Remove the services in this category first.');
          }
        },
      },
    ]);
  };

  const confirmDeleteService = (svc: Service) => {
    const options = services.filter(s => s.parentServiceId === svc.id).length;
    if (options > 0) {
      Alert.alert("Can't delete yet", `Delete the ${options} options under “${svc.name}” first.`);
      return;
    }
    Alert.alert(`Delete “${svc.name}”?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteService(tokenFn, svc.id);
            setServiceSheet(null);
          } catch (e: any) {
            Alert.alert("Can't delete", e?.message || 'Salons or bookings still use this service.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined} style={{ flex: 1, backgroundColor: colors.white }}>
      <BrandHeader
        left={<RoundButton icon="arrow-back" label="Back" onPress={() => router.back()} />}
        right={<RoundButton icon="create-outline" label="Edit category" onPress={() => setEditingCategory(true)} />}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: pageBottom }} showsVerticalScrollIndicator={false}>
        {/* Hero — same blob as the customer category page */}
        <View style={{ backgroundColor: heroBg, paddingBottom: 30 }}>
          <View style={{ alignItems: 'center', marginTop: 20 }}>
            <View style={{ width: 320, height: 200, borderRadius: 24, overflow: 'hidden' }}>
              <Image source={require('../../../../assets/Vector-2.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                <Text adjustsFontSizeToFit numberOfLines={2} style={{ fontSize: 40, color: colors.dark, fontFamily: 'Philosopher-Bold', textAlign: 'center', paddingHorizontal: 20 }}>
                  {category.name}
                </Text>
              </View>
            </View>
          </View>

          {/* Admin controls */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 4 }}>
            <TouchableOpacity
              onPress={toggleFeatured}
              accessibilityRole="switch"
              accessibilityState={{ checked: category.popular }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18,
                backgroundColor: category.popular ? colors.dark : 'rgba(255,255,255,0.55)',
              }}
            >
              <Ionicons name={category.popular ? 'star' : 'star-outline'} size={15} color={category.popular ? colors.beige : colors.dark} />
              <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: category.popular ? colors.white : colors.dark }}>
                {category.popular ? 'Featured' : 'Not featured'}
              </Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.55)' }}>
              <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: colors.dark }}>
                {groups.length} {groups.length === 1 ? 'service' : 'services'}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {groups.length === 0 ? (
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 30 }}>
              No services in this category yet.
            </Text>
          ) : (
            groups.map(({ parent, options }, idx) => (
              <View key={parent.id} style={{ marginTop: idx === 0 ? 30 : 40 }}>
                {/* Service title — tap to edit */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setServiceSheet({ service: parent, parentServiceId: null })}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 }}
                >
                  <Text style={{ textAlign: 'center', fontSize: 28, color: colors.dark, fontFamily: 'Philosopher-Bold', flexShrink: 1 }}>
                    {parent.name}
                  </Text>
                  <Ionicons name="create-outline" size={18} color={colors.muted} />
                </TouchableOpacity>

                {options.map(option => (
                  <TouchableOpacity
                    key={option.id}
                    activeOpacity={0.7}
                    onPress={() => setServiceSheet({ service: option, parentServiceId: parent.id })}
                    style={optionCard}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 20, color: colors.dark, fontFamily: 'Philosopher-Bold' }}>{option.name}</Text>
                        {option.description ? (
                          <Text style={{ fontSize: 15, color: '#8A7F75', fontFamily: 'Philosopher-Bold', marginTop: 4, lineHeight: 20 }}>
                            {option.description}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name="create-outline" size={18} color={colors.beige} style={{ marginTop: 3, marginLeft: 8 }} />
                    </View>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setServiceSheet({ service: null, parentServiceId: parent.id, parentName: parent.name })}
                  style={[optionCard, { minHeight: 64, borderStyle: 'dashed', borderWidth: 2, backgroundColor: colors.light, alignItems: 'center' }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="add" size={20} color={colors.dark} />
                    <Text style={{ fontSize: 16, color: colors.dark, fontFamily: 'Philosopher-Bold' }}>Add option</Text>
                  </View>
                </TouchableOpacity>
              </View>
            ))
          )}

          <Button
            label="Add a service"
            icon="add"
            variant="outline"
            onPress={() => setServiceSheet({ service: null, parentServiceId: null })}
            style={{ marginTop: 36 }}
          />
        </View>
      </ScrollView>

      <CategorySheet
        visible={editingCategory}
        category={category}
        onClose={() => setEditingCategory(false)}
        onSave={async input => {
          try {
            await saveCategory(tokenFn, input, category.id);
            setEditingCategory(false);
          } catch (e: any) {
            Alert.alert("Couldn't save", e?.message ?? 'Please try again.');
          }
        }}
        onDelete={confirmDeleteCategory}
      />

      <ServiceSheet
        visible={serviceSheet !== null}
        service={serviceSheet?.service ?? null}
        categoryId={category.id}
        parentServiceId={serviceSheet?.parentServiceId ?? null}
        parentName={serviceSheet?.parentName}
        onClose={() => setServiceSheet(null)}
        onSave={async input => {
          try {
            await saveService(tokenFn, input, serviceSheet?.service ?? undefined);
            setServiceSheet(null);
          } catch (e: any) {
            Alert.alert("Couldn't save", e?.message ?? 'Please try again.');
          }
        }}
        onDelete={serviceSheet?.service ? () => confirmDeleteService(serviceSheet.service!) : undefined}
      />
    </SafeAreaView>
  );
}

const optionCard = {
  backgroundColor: '#FFFFFF',
  borderRadius: 30,
  borderWidth: 3,
  borderColor: heroBg,
  minHeight: 84,
  justifyContent: 'center' as const,
  marginBottom: 12,
  paddingVertical: 14,
};
