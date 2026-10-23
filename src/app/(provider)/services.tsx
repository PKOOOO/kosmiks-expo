import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  StyleSheet,
  NativeScrollEvent,
  NativeSyntheticEvent,
  useWindowDimensions,
  BackHandler,
  Image,
} from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { API_BASE_URL } from '@/config/constants';
import useProviderServicesStore from '@/store/provider-services.store';

const darkBrown = '#423120';
const beige = '#D7C3A7';
const lightBeige = '#F4EDE5';
const pageBg = '#F8F4EF';
const muted = '#85786B';
const green = '#3D7652';
const badgeGreen = '#25D366';
const white = '#FFFFFF';
const DURATION_STEP = 5;
const DURATION_ITEM_HEIGHT = 68;
const DURATION_VISIBLE_ROWS = 3;
const IOS_DURATION_VALUES = Array.from({ length: 96 }, (_, index) => (index + 1) * DURATION_STEP);

type GlobalService = { id: string; name: string; description?: string; parentServiceId?: string | null };
type GlobalCategory = { id: string; name: string; services: GlobalService[] };
type SaloonService = {
  serviceId: string;
  saloonId: string;
  price: number;
  durationMinutes: number;
  isAvailable: boolean;
  service: { id: string; name: string; description?: string; category?: { id?: string; name: string } };
};
type ProviderServiceListItem =
  | { kind: 'section'; id: string; title: string }
  | { kind: 'service'; id: string; service: SaloonService };
type EditForm = { serviceId: string; price: string; durationMinutes: number; isAvailable: boolean };
type AddStep = 1 | 2; // 1 = price, 2 = duration
type EditStep = 1 | 2 | 3;

const EMPTY_EDIT: EditForm = { serviceId: '', price: '', durationMinutes: 30, isAvailable: true };

function DurationControl({
  value,
  onChange,
  autoFocus = false,
}: {
  value: number;
  onChange: (duration: number) => void;
  autoFocus?: boolean;
}) {
  const wheelRef = useRef<ScrollViewInstance>(null);
  const [wheelHeight, setWheelHeight] = useState(DURATION_ITEM_HEIGHT * DURATION_VISIBLE_ROWS);
  const initialIndex = Math.max(
    0,
    Math.min(IOS_DURATION_VALUES.length - 1, Math.round(value / DURATION_STEP) - 1)
  );
  const lastIndexRef = useRef(initialIndex);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const frame = requestAnimationFrame(() => {
      wheelRef.current?.scrollTo({
        y: initialIndex * DURATION_ITEM_HEIGHT,
        animated: false,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  if (Platform.OS !== 'ios') {
    return (
      <View>
        <View style={styles.androidDurationInputWrap}>
          <TextInput
            autoFocus={autoFocus}
            value={value > 0 ? String(value) : ''}
            onChangeText={text => {
              const digits = text.replace(/[^0-9]/g, '');
              onChange(digits ? Number(digits) : 0);
            }}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="Enter minutes"
            placeholderTextColor="#B9AFA5"
            style={styles.androidDurationInput}
          />
          <Text style={styles.androidDurationUnit}>minutes</Text>
        </View>
      </View>
    );
  }

  const updateFromOffset = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.max(
      0,
      Math.min(
        IOS_DURATION_VALUES.length - 1,
        Math.round(event.nativeEvent.contentOffset.y / DURATION_ITEM_HEIGHT)
      )
    );

    if (nextIndex === lastIndexRef.current) return;
    lastIndexRef.current = nextIndex;
    onChange(IOS_DURATION_VALUES[nextIndex]);
    Haptics.selectionAsync().catch(() => undefined);
  };

  return (
    <View
      style={styles.durationWheel}
      onLayout={event => setWheelHeight(event.nativeEvent.layout.height)}
    >
      <ScrollView
        ref={wheelRef}
        style={styles.durationWheelScroller}
        showsVerticalScrollIndicator={false}
        snapToInterval={DURATION_ITEM_HEIGHT}
        decelerationRate="fast"
        nestedScrollEnabled
        scrollEventThrottle={16}
        onScroll={updateFromOffset}
        contentContainerStyle={[
          styles.durationWheelContent,
          { paddingVertical: Math.max(0, (wheelHeight - DURATION_ITEM_HEIGHT) / 2) },
        ]}
      >
        {IOS_DURATION_VALUES.map((duration, index) => {
          const selected = index === Math.max(
            0,
            Math.min(IOS_DURATION_VALUES.length - 1, Math.round(value / DURATION_STEP) - 1)
          );
          return (
            <TouchableOpacity
              key={duration}
              activeOpacity={1}
              onPress={() => {
                wheelRef.current?.scrollTo({
                  y: index * DURATION_ITEM_HEIGHT,
                  animated: true,
                });
              }}
              style={styles.durationWheelItem}
            >
              <Text style={[styles.durationWheelNumber, selected && styles.durationWheelNumberSelected]}>
                {duration}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function ProviderServicesScreen() {
  const { getToken } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const setProviderServicesCount = useProviderServicesStore(state => state.setCount);

  const [saloonId, setSaloonId] = useState<string | null>(null);
  const [services, setServices] = useState<SaloonService[]>([]);
  const [categories, setCategories] = useState<GlobalCategory[]>([]);
  const [browsingCategoryId, setBrowsingCategoryId] = useState<string | null>(null);
  // Inline service picker (customer-style list) shown after tapping + in a category.
  const [pickingService, setPickingService] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT);
  const [editStep, setEditStep] = useState<EditStep>(1);
  const [saving, setSaving] = useState(false);

  // Add-mode state
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [addDuration, setAddDuration] = useState(Platform.OS === 'ios' ? 30 : 0);
  const [addStep, setAddStep] = useState<AddStep>(1);
  const [addError, setAddError] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getTokenRef.current();
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
    };
    if (token) h['X-User-Token'] = token;
    return h;
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const headers = await authHeaders();
      const saloonRes = await fetch(`${API_BASE_URL}/saloons?owned=1`, { headers });
      if (!saloonRes.ok) throw new Error('Could not load salon');
      const saloons = await saloonRes.json();
      if (!Array.isArray(saloons) || saloons.length === 0) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const id = saloons[0].id;
      setSaloonId(id);
      const [svcRes, catRes] = await Promise.all([
        fetch(`${API_BASE_URL}/saloons/${id}/services`, { headers }),
        fetch(`${API_BASE_URL}/public/categories`),
      ]);
      if (svcRes.ok) {
        const data = await svcRes.json();
        setServices(Array.isArray(data) ? data : []);
      }
      if (catRes.ok) {
        const cats = await catRes.json();
        setCategories(Array.isArray(cats) ? cats.filter((c: GlobalCategory) => c.services?.length > 0) : []);
      }
    } catch {
      setError('Failed to load services.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authHeaders]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!loading) setProviderServicesCount(services.length);
  }, [loading, services.length, setProviderServicesCount]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, event => {
      setKeyboardVisible(true);
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    navigation.setOptions({
      tabBarStyle: modalVisible
        ? { display: 'none', height: 0, paddingBottom: 0 }
        : {
            backgroundColor: beige,
            borderTopWidth: 0,
            elevation: 0,
          },
    });

    return () => {
      navigation.setOptions({
        tabBarStyle: {
          backgroundColor: beige,
          borderTopWidth: 0,
          elevation: 0,
        },
      });
    };
  }, [modalVisible, navigation]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !browsingCategoryId || modalVisible) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pickingService) setPickingService(false);
      else setBrowsingCategoryId(null);
      return true;
    });

    return () => subscription.remove();
  }, [browsingCategoryId, modalVisible, pickingService]);

  // Tapping + shows the customer-style service list for the category inline;
  // choosing a service from it opens the sheet straight at the price step.
  const openAdd = (categoryId: string) => {
    setIsEditing(false);
    setSelectedServiceId('');
    setAddError(null);
    setActiveCategoryId(categoryId);
    setPickingService(true);
  };

  const pickService = (svc: GlobalService) => {
    setIsEditing(false);
    setSelectedServiceId(svc.id);
    setAddPrice('');
    setAddDuration(Platform.OS === 'ios' ? 30 : 0);
    setAddStep(1);
    setAddError(null);
    setModalVisible(true);
  };

  const closeModal = () => {
    Keyboard.dismiss();
    setModalVisible(false);
    setAddError(null);
  };

  const openEdit = (svc: SaloonService) => {
    setIsEditing(true);
    setEditStep(1);
    setEditForm({
      serviceId: svc.serviceId,
      price: String(svc.price),
      durationMinutes: svc.durationMinutes,
      isAvailable: svc.isAvailable,
    });
    setAddError(null);
    setModalVisible(true);
  };

  const parsePrice = (value: string) => Number(value.trim().replace(',', '.'));

  const handleSave = async () => {
    if (!saloonId) return;
    setSaving(true);
    try {
      const headers = await authHeaders();
      if (isEditing) {
        const price = parsePrice(editForm.price);
        if (isNaN(price) || price <= 0) {
          Alert.alert('Required', 'Enter a valid price.');
          return;
        }
        if (!Number.isFinite(editForm.durationMinutes) || editForm.durationMinutes <= 0) {
          Alert.alert('Required', 'Enter a valid duration.');
          return;
        }
        const res = await fetch(`${API_BASE_URL}/saloons/${saloonId}/services/${editForm.serviceId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ price, durationMinutes: editForm.durationMinutes, isAvailable: editForm.isAvailable }),
        });
        if (!res.ok) throw new Error();
        setServices(prev =>
          prev.map(s =>
            s.serviceId === editForm.serviceId
              ? { ...s, price, durationMinutes: editForm.durationMinutes, isAvailable: editForm.isAvailable }
              : s
          )
        );
      } else {
        if (!selectedServiceId) {
          Alert.alert('Required', 'Please select a service.');
          return;
        }
        const price = parsePrice(addPrice);
        if (isNaN(price) || price <= 0) {
          Alert.alert('Required', 'Enter a valid price.');
          return;
        }
        const res = await fetch(`${API_BASE_URL}/saloons/${saloonId}/services`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ serviceId: selectedServiceId, price, durationMinutes: addDuration, isAvailable: true }),
        });
        if (!res.ok) throw new Error(await res.text());
        const svcRes = await fetch(`${API_BASE_URL}/saloons/${saloonId}/services`, { headers });
        if (svcRes.ok) setServices(await svcRes.json());
        setPickingService(false);
      }
      closeModal();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save service. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (svc: SaloonService) => {
    Alert.alert('Delete Service', `Remove "${svc.service?.name}" from your salon?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!saloonId) return;
          setServices(prev => prev.filter(s => s.serviceId !== svc.serviceId));
          try {
            const headers = await authHeaders();
            const res = await fetch(`${API_BASE_URL}/saloons/${saloonId}/services/${svc.serviceId}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error();
          } catch {
            setServices(prev => [...prev, svc]);
            Alert.alert('Error', 'Failed to delete service. Please try again.');
          }
        },
      },
    ]);
  };

  const handleAddNext = () => {
    setAddError(null);

    if (addStep === 1) {
      const price = parsePrice(addPrice);
      if (!Number.isFinite(price) || price <= 0) {
        setAddError('Enter a valid price to continue.');
        return;
      }
      Keyboard.dismiss();
      setAddStep(2);
      return;
    }

    if (!Number.isFinite(addDuration) || addDuration <= 0) {
      setAddError('Enter a valid duration to continue.');
      return;
    }

    handleSave();
  };

  const handleAddBack = () => {
    Keyboard.dismiss();
    setAddError(null);
    // The service was chosen from the inline list, so Back from price returns there.
    if (addStep === 1) {
      closeModal();
      return;
    }
    setAddStep(1);
  };

  const handleEditNext = () => {
    setAddError(null);

    if (editStep === 1) {
      const price = parsePrice(editForm.price);
      if (!Number.isFinite(price) || price <= 0) {
        setAddError('Enter a valid price to continue.');
        return;
      }
      Keyboard.dismiss();
      setEditStep(2);
      return;
    }

    if (editStep === 2) {
      if (!Number.isFinite(editForm.durationMinutes) || editForm.durationMinutes <= 0) {
        setAddError('Enter a valid duration to continue.');
        return;
      }
      Keyboard.dismiss();
      setEditStep(3);
      return;
    }

    handleSave();
  };

  const handleEditBack = () => {
    Keyboard.dismiss();
    setAddError(null);
    setEditStep(step => Math.max(1, step - 1) as EditStep);
  };

  const addedServiceIds = new Set(services.map(s => s.serviceId));

  // Build the parent → sub-service tree for the active category.
  // Top-level nodes have no parentServiceId; a node with children is a
  // (non-selectable) group header, a node without children is a bookable leaf.
  const catServices = categories.find(c => c.id === activeCategoryId)?.services ?? [];
  const childrenByParent = new Map<string, GlobalService[]>();
  for (const s of catServices) {
    if (s.parentServiceId) {
      const arr = childrenByParent.get(s.parentServiceId) ?? [];
      arr.push(s);
      childrenByParent.set(s.parentServiceId, arr);
    }
  }
  const topLevelServices = catServices.filter(s => !s.parentServiceId);
  const selectedService = categories
    .flatMap(category => category.services)
    .find(service => service.id === selectedServiceId);
  const editingServiceName = services.find(service => service.serviceId === editForm.serviceId)?.service?.name ?? '—';
  const addPriceValue = parsePrice(addPrice);

  const browsingCategory = categories.find(category => category.id === browsingCategoryId);
  const providerServiceCountByCategoryId = new Map(
    categories.map(category => {
      const categoryServiceIds = new Set(category.services.map(service => service.id));
      const count = services.filter(service =>
        categoryServiceIds.has(service.serviceId) ||
        service.service?.category?.id === category.id ||
        service.service?.category?.name === category.name
      ).length;
      return [category.id, count];
    })
  );
  const browsingGlobalServices = browsingCategory?.services ?? [];
  const browsingGlobalServiceIds = new Set(browsingGlobalServices.map(service => service.id));
  const browsingServices = browsingCategory
    ? services.filter(service =>
        browsingGlobalServiceIds.has(service.serviceId) ||
        service.service?.category?.id === browsingCategory.id ||
        service.service?.category?.name === browsingCategory.name
      )
    : [];

  // Preserve the customer service page's parent → child presentation while
  // inserting the provider's price, duration and management actions.
  const browsingServiceById = new Map(browsingServices.map(service => [service.serviceId, service]));
  const browsingChildrenByParent = new Map<string, GlobalService[]>();
  browsingGlobalServices.forEach(service => {
    if (!service.parentServiceId) return;
    const children = browsingChildrenByParent.get(service.parentServiceId) ?? [];
    children.push(service);
    browsingChildrenByParent.set(service.parentServiceId, children);
  });

  const categoryServiceItems: ProviderServiceListItem[] = [];
  const appendedServiceIds = new Set<string>();
  browsingGlobalServices
    .filter(service => !service.parentServiceId)
    .forEach(parent => {
      const children = browsingChildrenByParent.get(parent.id) ?? [];
      const offeredChildren = children
        .map(child => browsingServiceById.get(child.id))
        .filter((service): service is SaloonService => Boolean(service));

      if (offeredChildren.length > 0) {
        categoryServiceItems.push({ kind: 'section', id: `section-${parent.id}`, title: parent.name });
        offeredChildren.forEach(service => {
          categoryServiceItems.push({ kind: 'service', id: service.serviceId, service });
          appendedServiceIds.add(service.serviceId);
        });
        return;
      }

      const offeredParent = browsingServiceById.get(parent.id);
      if (offeredParent) {
        categoryServiceItems.push({ kind: 'service', id: offeredParent.serviceId, service: offeredParent });
        appendedServiceIds.add(offeredParent.serviceId);
      }
    });

  // Keep services visible even if an older API record is missing from the
  // current public category tree.
  browsingServices.forEach(service => {
    if (!appendedServiceIds.has(service.serviceId)) {
      categoryServiceItems.push({ kind: 'service', id: service.serviceId, service });
    }
  });

  const renderCategoryHero = (title: string) => (
    <View style={styles.categoryHero}>
      <View style={styles.categoryHeroBlob}>
        <Image
          source={require('../../../assets/Vector-2.png')}
          style={styles.categoryHeroImage}
          resizeMode="contain"
        />
        <View style={styles.categoryHeroTitleOverlay}>
          <Text style={styles.categoryHeroTitle} numberOfLines={2}>{title}</Text>
        </View>
      </View>
    </View>
  );

  const renderPickerCard = (svc: GlobalService) => (
    <TouchableOpacity
      key={svc.id}
      activeOpacity={0.7}
      onPress={() => pickService(svc)}
      style={[styles.pickerCard, { minHeight: svc.description ? 140 : 84 }]}
    >
      <Text style={styles.pickerCardName}>{svc.name}</Text>
      {svc.description ? (
        <Text style={styles.pickerCardDescription} numberOfLines={4}>
          {svc.description.replace(/\s+/g, ' ').trim()}
        </Text>
      ) : null}
    </TouchableOpacity>
  );

  // Mirrors the customer services page: parent service as a centred title,
  // its sub-services as bordered cards. Services already offered are hidden.
  const renderServicePicker = () => {
    const sections = topLevelServices
      .map(parent => {
        const children = childrenByParent.get(parent.id) ?? [];
        const options = children.length > 0
          ? children.filter(child => !addedServiceIds.has(child.id))
          : addedServiceIds.has(parent.id) ? [] : [parent];
        return { parent, hasChildren: children.length > 0, options };
      })
      .filter(section => section.options.length > 0);

    if (sections.length === 0) {
      return (
        <View style={[styles.noOptionsCard, { marginHorizontal: 20 }]}>
          <Ionicons name="checkmark-circle-outline" size={24} color={muted} />
          <Text style={styles.noOptionsText}>No more services are available in this category.</Text>
        </View>
      );
    }

    return sections.map(({ parent, hasChildren, options }, idx) => (
      <View key={parent.id} style={{ marginTop: idx === 0 ? 10 : 28 }}>
        {hasChildren ? <Text style={styles.pickerSectionTitle}>{parent.name}</Text> : null}
        {options.map(renderPickerCard)}
      </View>
    ));
  };

  const renderService = ({ item }: { item: SaloonService }) => (
    <View style={styles.serviceCard}>
      <View style={styles.serviceCardTop}>
        <View style={styles.serviceTitleWrap}>
          <Text
            style={styles.serviceName}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {item.service?.name ?? 'Service'}
          </Text>
        </View>
        <Text style={styles.servicePrice}>€{Number(item.price).toFixed(2)}</Text>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.serviceCardBottom}>
        <View style={styles.metaRow}>
          <View style={styles.durationPill}>
            <Ionicons name="time-outline" size={14} color={muted} />
            <Text style={styles.durationText}>{item.durationMinutes} min</Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            accessibilityLabel={`Edit ${item.service?.name ?? 'service'}`}
            onPress={() => openEdit(item)}
            style={styles.iconButton}
          >
            <Ionicons name="pencil-outline" size={18} color={darkBrown} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel={`Delete ${item.service?.name ?? 'service'}`}
            onPress={() => handleDelete(item)}
            style={[styles.iconButton, styles.deleteButton]}
          >
            <Ionicons name="trash-outline" size={18} color="#B44747" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView
        edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined}
        style={styles.loadingScreen}
      >
        <ActivityIndicator size="large" color={darkBrown} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined}
      style={styles.screen}
    >
      <View
        style={styles.header}
      >
        {browsingCategoryId ? (
          <TouchableOpacity
            accessibilityLabel="Back to service categories"
            onPress={() => (pickingService ? setPickingService(false) : setBrowsingCategoryId(null))}
            style={styles.headerBackButton}
          >
            <Ionicons name="arrow-back" size={25} color={darkBrown} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.headerCopy}>
          <Text style={styles.pageTitle}>kosmiks</Text>
        </View>
        {browsingCategory && categoryServiceItems.length > 0 && !pickingService ? (
          <TouchableOpacity
            accessibilityLabel={`Add another ${browsingCategory.name} service`}
            onPress={() => openAdd(browsingCategory.id)}
            activeOpacity={0.85}
            style={styles.addButton}
          >
            <Ionicons name="add" size={27} color={darkBrown} />
          </TouchableOpacity>
        ) : null}
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={18} color="#B44747" />
          <Text style={styles.errorBannerText}>{error}</Text>
          <TouchableOpacity onPress={fetchData}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!browsingCategory ? (
        categories.length === 0 ? (
          <View style={styles.emptyStateWrap}>
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyTitle}>No service categories found</Text>
              <Text style={styles.emptyCopy}>Pull to refresh or try again in a moment.</Text>
              <TouchableOpacity onPress={fetchData} activeOpacity={0.85} style={styles.emptyButton}>
                <Text style={styles.emptyButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.categoryGrid}
            contentContainerStyle={styles.categoryGridContent}
          >
            {Array.from({ length: Math.ceil(categories.length / 2) }).map((_, rowIndex) => {
              const firstIndex = rowIndex * 2;
              const firstCategory = categories[firstIndex];
              const secondCategory = categories[firstIndex + 1];
              const firstCount = providerServiceCountByCategoryId.get(firstCategory.id) ?? 0;
              const secondCount = secondCategory
                ? providerServiceCountByCategoryId.get(secondCategory.id) ?? 0
                : 0;
              const patterns = [
                { first: 1.5, second: 1 },
                { first: 1.1, second: 2 },
                { first: 1.7, second: 1.2 },
                { first: 1.2, second: 2 },
                { first: 2, second: 1.2 },
              ];
              const isLastCompleteRow = rowIndex === Math.ceil(categories.length / 2) - 1 && Boolean(secondCategory);
              const pattern = isLastCompleteRow
                ? { first: 1, second: 2 }
                : patterns[rowIndex % patterns.length];

              return (
                <View key={firstCategory.id} style={[styles.categoryRow, { width: screenWidth - 28 }]}>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={() => setBrowsingCategoryId(firstCategory.id)}
                    style={[
                      styles.categoryTile,
                      secondCategory ? { flex: pattern.first } : styles.categoryTileSingle,
                    ]}
                  >
                    <Text style={styles.categoryTileText}>{firstCategory.name}</Text>
                    {firstCount > 0 ? (
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>{firstCount}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                  {secondCategory ? (
                    <TouchableOpacity
                      activeOpacity={0.82}
                      onPress={() => setBrowsingCategoryId(secondCategory.id)}
                      style={[styles.categoryTile, { flex: pattern.second }]}
                    >
                      <Text style={styles.categoryTileText}>{secondCategory.name}</Text>
                      {secondCount > 0 ? (
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryBadgeText}>{secondCount}</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        )
      ) : (
        <View style={styles.categoryServicesScreen}>
          {pickingService ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
            >
              {renderCategoryHero(browsingCategory.name)}
              {renderServicePicker()}
            </ScrollView>
          ) : categoryServiceItems.length === 0 ? (
            <>
              {renderCategoryHero(browsingCategory.name)}
              <View style={styles.emptyCategoryAddWrap}>
                <TouchableOpacity
                  accessibilityLabel={`Add a ${browsingCategory.name} service`}
                  onPress={() => openAdd(browsingCategory.id)}
                  activeOpacity={0.65}
                  style={styles.emptyCategoryAddButton}
                >
                  <Ionicons name="add" size={58} color={darkBrown} />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <FlatList
              data={categoryServiceItems}
              keyExtractor={item => item.id}
              renderItem={({ item }) => item.kind === 'section' ? (
                <Text style={styles.serviceSectionTitle}>{item.title}</Text>
              ) : renderService({ item: item.service })}
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchData(); }}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: insets.bottom + 110 },
              ]}
              ListHeaderComponent={renderCategoryHero(browsingCategory.name)}
              style={{ flex: 1 }}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        presentationStyle="overFullScreen"
        statusBarTranslucent={Platform.OS === 'android'}
        navigationBarTranslucent={Platform.OS === 'android'}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboardView}
          behavior={Platform.OS === 'android' ? 'height' : undefined}
          keyboardVerticalOffset={0}
          contentContainerStyle={styles.modalKeyboardContent}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.sheet,
                isEditing
                  ? editStep === 1
                    ? styles.priceSheet
                    : editStep === 2 && Platform.OS === 'android'
                      ? styles.androidDurationSheet
                      : styles.editSheet
                  : addStep === 1
                    ? styles.priceSheet
                    : Platform.OS === 'android'
                      ? styles.androidDurationSheet
                      : styles.editSheet,
                Platform.OS === 'ios' && keyboardHeight > 0 && { marginBottom: keyboardHeight },
              ]}
            >
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>
                    {isEditing
                      ? editStep === 1
                        ? 'Set the price'
                        : editStep === 2
                          ? 'Choose duration'
                          : 'Availability'
                      : addStep === 1
                        ? 'Set the price'
                        : 'Choose duration'}
                  </Text>
                </View>
                <TouchableOpacity accessibilityLabel="Close" onPress={closeModal} style={styles.closeButton}>
                  <Ionicons name="close" size={23} color={darkBrown} />
                </TouchableOpacity>
              </View>

              <View style={styles.progressTrack}>
                {(isEditing ? [1, 2, 3] : [1, 2]).map(step => (
                  <View
                    key={step}
                    style={[
                      styles.progressSegment,
                      step <= (isEditing ? editStep : addStep) && styles.progressSegmentActive,
                    ]}
                  />
                ))}
              </View>

              {isEditing && editStep === 1 ? (
                <View style={styles.focusedStepContent}>
                  <View style={styles.editServiceSummary}>
                    <Text style={styles.editServiceName}>{editingServiceName}</Text>
                  </View>
                  <Text style={styles.focusedQuestion}>What will you charge?</Text>
                  <View style={[styles.priceInputWrap, styles.largePriceInputWrap]}>
                    <Text style={styles.largeCurrencyPrefix}>€</Text>
                    <TextInput
                      autoFocus
                      style={styles.largePriceInput}
                      value={editForm.price}
                      onChangeText={value => {
                        setEditForm(form => ({ ...form, price: value }));
                        setAddError(null);
                      }}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor="#C8BFB6"
                    />
                  </View>
                </View>
              ) : isEditing && editStep === 2 ? (
                <View style={styles.focusedStepScrollContent}>
                  <View style={styles.editServiceSummary}>
                    <Text style={styles.editServiceName}>{editingServiceName}</Text>
                    <Text style={styles.selectionPrice}>€{parsePrice(editForm.price).toFixed(2)}</Text>
                  </View>
                  <DurationControl
                    value={editForm.durationMinutes}
                    onChange={durationMinutes =>
                      setEditForm(form => ({ ...form, durationMinutes }))
                    }
                    autoFocus
                  />
                </View>
              ) : isEditing ? (
                <View style={styles.focusedStepContent}>
                  <View style={styles.editServiceSummary}>
                    <Text style={styles.editServiceName}>{editingServiceName}</Text>
                  </View>
                  <View style={styles.availabilityStepCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.availabilityTitle}>Available to book</Text>
                      <Text style={styles.availabilityCopy}>Clients can see and book this service.</Text>
                    </View>
                    <Switch
                      value={editForm.isAvailable}
                      onValueChange={value => setEditForm(form => ({ ...form, isAvailable: value }))}
                      trackColor={{ false: beige, true: darkBrown }}
                      thumbColor={white}
                    />
                  </View>
                </View>
              ) : addStep === 1 ? (
                <View style={styles.focusedStepContent}>
                  <View style={styles.selectionSummary}>
                    <Ionicons name="checkmark-circle" size={20} color={green} />
                    <Text style={styles.selectionSummaryText} numberOfLines={2}>
                      {selectedService?.name}
                    </Text>
                  </View>
                  <Text style={styles.focusedQuestion}>What will you charge?</Text>
                  <View style={[styles.priceInputWrap, styles.largePriceInputWrap]}>
                    <Text style={styles.largeCurrencyPrefix}>€</Text>
                    <TextInput
                      autoFocus
                      style={styles.largePriceInput}
                      value={addPrice}
                      onChangeText={value => {
                        setAddPrice(value);
                        setAddError(null);
                      }}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor="#C8BFB6"
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.focusedStepScrollContent}>
                  <View style={styles.selectionSummary}>
                    <Text style={styles.selectionSummaryText} numberOfLines={1}>{selectedService?.name}</Text>
                    <Text style={styles.selectionPrice}>€{addPriceValue.toFixed(2)}</Text>
                  </View>
                  <DurationControl value={addDuration} onChange={setAddDuration} autoFocus />
                </View>
              )}

              {addError && <Text style={styles.addError}>{addError}</Text>}

              <View
                style={[
                  styles.sheetFooter,
                  {
                    paddingBottom: keyboardVisible
                      ? 10
                      : Math.max(insets.bottom, 12) + 8,
                  },
                ]}
              >
                {(!isEditing || editStep > 1) && (
                  <TouchableOpacity
                    onPress={isEditing ? handleEditBack : handleAddBack}
                    style={styles.backButton}
                    disabled={saving}
                  >
                    <Ionicons name="arrow-back" size={20} color={darkBrown} />
                    <Text style={styles.backButtonText}>Back</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={isEditing ? handleEditNext : handleAddNext}
                  disabled={saving}
                  style={[
                    styles.primaryButton,
                    (!isEditing || editStep > 1) &&
                      styles.primaryButtonWithBack,
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator color={white} />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>
                        {isEditing
                          ? editStep === 1
                            ? 'Next: Duration'
                            : editStep === 2
                              ? 'Next: Availability'
                              : 'Save changes'
                          : addStep === 1
                            ? 'Next: Duration'
                            : 'Add service'}
                      </Text>
                      {((isEditing && editStep < 3) || (!isEditing && addStep < 2)) && (
                        <Ionicons name="arrow-forward" size={19} color={white} />
                      )}
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: pageBg,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: pageBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
    minHeight: 62,
  },
  headerCopy: {
    alignItems: 'center',
  },
  pageTitle: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 22,
    lineHeight: 28,
    color: darkBrown,
    textAlign: 'center',
  },
  headerBackButton: {
    position: 'absolute',
    left: 20,
    top: 9,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  addButton: {
    position: 'absolute',
    right: 20,
    top: 9,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: beige,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#FCECE9',
  },
  errorBannerText: {
    flex: 1,
    fontFamily: 'Philosopher-Regular',
    fontSize: 13,
    color: '#8F3838',
  },
  retryText: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 13,
    color: darkBrown,
  },
  listContent: {
    paddingTop: 4,
  },
  categoryGridContent: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 120,
  },
  categoryGrid: {
    flex: 1,
    backgroundColor: white,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryTile: {
    height: 88,
    margin: 6,
    paddingHorizontal: 14,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: beige,
  },
  categoryTileSingle: {
    width: '95%',
    alignSelf: 'center',
  },
  categoryTileText: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 18,
    lineHeight: 23,
    color: darkBrown,
    textAlign: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    top: 8,
    right: 10,
    minWidth: 26,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: white,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: badgeGreen,
  },
  categoryBadgeText: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 13,
    lineHeight: 16,
    color: white,
  },
  categoryServicesScreen: {
    flex: 1,
    backgroundColor: white,
  },
  emptyCategoryAddWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 84,
  },
  emptyCategoryAddButton: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerSectionTitle: {
    textAlign: 'center',
    fontSize: 28,
    color: darkBrown,
    fontFamily: 'Philosopher-Bold',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  pickerCard: {
    backgroundColor: white,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: beige,
    width: 330,
    maxWidth: '90%',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  pickerCardName: {
    fontSize: 20,
    color: darkBrown,
    fontFamily: 'Philosopher-Bold',
  },
  pickerCardDescription: {
    fontSize: 15,
    color: darkBrown,
    fontFamily: 'Philosopher-Bold',
    opacity: 0.6,
    marginTop: 4,
    lineHeight: 20,
  },
  categoryHero: {
    alignItems: 'center',
    paddingBottom: 30,
    marginBottom: 20,
    backgroundColor: beige,
  },
  categoryHeroBlob: {
    position: 'relative',
    width: 320,
    height: 200,
    marginTop: 20,
    borderRadius: 24,
    overflow: 'hidden',
  },
  categoryHeroImage: {
    width: '100%',
    height: '100%',
  },
  categoryHeroTitleOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryHeroTitle: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 40,
    lineHeight: 46,
    color: darkBrown,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  serviceSectionTitle: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 27,
    lineHeight: 32,
    color: darkBrown,
    marginTop: 12,
    marginBottom: 4,
    marginHorizontal: 20,
  },
  serviceCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 24,
    backgroundColor: white,
    borderWidth: 2,
    borderColor: beige,
  },
  serviceCardTop: {
    alignItems: 'stretch',
  },
  serviceTitleWrap: {
    width: '100%',
  },
  categoryLabel: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: muted,
    marginBottom: 3,
  },
  serviceName: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 17,
    lineHeight: 21,
    color: darkBrown,
  },
  servicePrice: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 19,
    color: darkBrown,
    marginTop: 7,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#EFE7DF',
    marginVertical: 14,
  },
  serviceCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: lightBeige,
  },
  durationText: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 12,
    color: muted,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#EAF4ED',
  },
  statusPillInactive: {
    backgroundColor: '#F1EEEA',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: green,
  },
  statusDotInactive: {
    backgroundColor: '#9A9188',
  },
  statusText: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 12,
    color: green,
  },
  statusTextInactive: {
    color: '#756D66',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginLeft: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lightBeige,
  },
  deleteButton: {
    backgroundColor: '#FCECE9',
  },
  emptyStateWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 72,
  },
  emptyStateCard: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 36,
    borderRadius: 24,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: '#E9DED2',
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lightBeige,
    marginBottom: 18,
  },
  emptyTitle: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 21,
    color: darkBrown,
    textAlign: 'center',
  },
  emptyCopy: {
    fontFamily: 'Philosopher-Regular',
    fontSize: 14,
    lineHeight: 21,
    color: muted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 22,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: darkBrown,
  },
  emptyButtonText: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 14,
    color: white,
  },
  modalKeyboardView: {
    flex: 1,
  },
  modalKeyboardContent: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(38, 27, 18, 0.42)',
  },
  sheet: {
    backgroundColor: white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    overflow: 'hidden',
  },
  priceSheet: {
    maxHeight: '82%',
  },
  editSheet: {
    maxHeight: '82%',
    minHeight: 510,
  },
  androidDurationSheet: {
    height: 440,
    maxHeight: '82%',
  },
  sheetHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    backgroundColor: beige,
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  sheetTitle: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 24,
    color: darkBrown,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lightBeige,
    marginLeft: 12,
  },
  progressTrack: {
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E9E1D9',
  },
  progressSegmentActive: {
    backgroundColor: darkBrown,
  },
  noOptionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 14,
    backgroundColor: lightBeige,
  },
  noOptionsText: {
    flex: 1,
    fontFamily: 'Philosopher-Regular',
    fontSize: 13,
    lineHeight: 19,
    color: muted,
  },
  focusedStepContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  focusedStepScrollContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
  },
  selectionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: lightBeige,
    marginBottom: 22,
  },
  selectionSummaryText: {
    flex: 1,
    fontFamily: 'Philosopher-Bold',
    fontSize: 14,
    color: darkBrown,
  },
  selectionPrice: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 18,
    color: darkBrown,
  },
  focusedQuestion: {
    fontFamily: 'Philosopher-Bold',
    marginBottom: 6,
    fontSize: 20,
    color: darkBrown,
  },
  focusedHelp: {
    fontFamily: 'Philosopher-Regular',
    fontSize: 14,
    color: muted,
    marginTop: 5,
    marginBottom: 18,
  },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: beige,
    borderRadius: 15,
    backgroundColor: white,
    paddingHorizontal: 16,
  },
  largePriceInputWrap: {
    minHeight: 76,
    borderRadius: 18,
  },
  currencyPrefix: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 18,
    color: darkBrown,
    marginRight: 8,
  },
  largeCurrencyPrefix: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 27,
    color: darkBrown,
    marginRight: 10,
  },
  priceInput: {
    flex: 1,
    fontFamily: 'Philosopher-Regular',
    fontSize: 18,
    color: darkBrown,
    paddingVertical: 12,
  },
  largePriceInput: {
    flex: 1,
    fontFamily: 'Philosopher-Bold',
    fontSize: 30,
    color: darkBrown,
    paddingVertical: 14,
  },
  durationWheel: {
    flex: 1,
    width: '100%',
    minHeight: DURATION_ITEM_HEIGHT * DURATION_VISIBLE_ROWS,
    overflow: 'hidden',
  },
  durationWheelScroller: {
    flex: 1,
    width: '100%',
  },
  durationWheelContent: {
    flexGrow: 1,
  },
  durationWheelItem: {
    height: DURATION_ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationWheelNumber: {
    fontFamily: 'Philosopher-Regular',
    fontSize: 26,
    color: '#B2A79C',
  },
  durationWheelNumberSelected: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 38,
    color: darkBrown,
  },
  androidDurationInputWrap: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: beige,
    backgroundColor: white,
  },
  androidDurationInput: {
    flex: 1,
    fontFamily: 'Philosopher-Bold',
    fontSize: 28,
    color: darkBrown,
    paddingVertical: 14,
  },
  androidDurationUnit: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 15,
    color: muted,
  },
  androidDurationHint: {
    fontFamily: 'Philosopher-Regular',
    fontSize: 12,
    color: muted,
    marginTop: 8,
  },
  addError: {
    fontFamily: 'Philosopher-Regular',
    fontSize: 13,
    color: '#B44747',
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  sheetFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEE5DC',
    backgroundColor: white,
  },
  backButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: beige,
    backgroundColor: white,
  },
  backButtonText: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 14,
    color: darkBrown,
  },
  primaryButton: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: darkBrown,
  },
  primaryButtonWithBack: {
    flex: 1,
  },
  primaryButtonText: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 15,
    color: white,
  },
  editServiceSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: lightBeige,
    marginBottom: 20,
  },
  editServiceName: {
    flex: 1,
    fontFamily: 'Philosopher-Bold',
    fontSize: 16,
    color: darkBrown,
  },
  availabilityStepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8DDD1',
    backgroundColor: lightBeige,
  },
  availabilityTitle: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 15,
    color: darkBrown,
  },
  availabilityCopy: {
    fontFamily: 'Philosopher-Regular',
    fontSize: 12,
    color: muted,
    marginTop: 2,
  },
});
