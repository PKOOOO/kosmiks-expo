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
  SafeAreaView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  StyleSheet,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '@/config/constants';

const darkBrown = '#423120';
const beige = '#D7C3A7';
const lightBeige = '#F4EDE5';
const pageBg = '#F8F4EF';
const muted = '#85786B';
const green = '#3D7652';
const white = '#FFFFFF';
const DURATIONS = [15, 30, 45, 60, 90, 120];

type GlobalService = { id: string; name: string; description?: string; parentServiceId?: string | null };
type GlobalCategory = { id: string; name: string; services: GlobalService[] };
type SaloonService = {
  serviceId: string;
  saloonId: string;
  price: number;
  durationMinutes: number;
  isAvailable: boolean;
  service: { id: string; name: string; description?: string; category?: { name: string } };
};
type EditForm = { serviceId: string; price: string; durationMinutes: number; isAvailable: boolean };
type AddStep = 1 | 2 | 3 | 4;

const EMPTY_EDIT: EditForm = { serviceId: '', price: '', durationMinutes: 30, isAvailable: true };

export default function ProviderServicesScreen() {
  const { getToken } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [saloonId, setSaloonId] = useState<string | null>(null);
  const [services, setServices] = useState<SaloonService[]>([]);
  const [categories, setCategories] = useState<GlobalCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT);
  const [saving, setSaving] = useState(false);

  // Add-mode state
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [expandedParentId, setExpandedParentId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [addDuration, setAddDuration] = useState(30);
  const [addStep, setAddStep] = useState<AddStep>(1);
  const [addError, setAddError] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

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
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    navigation.setOptions({
      tabBarStyle: modalVisible
        ? { display: 'none' }
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

  const openAdd = () => {
    setIsEditing(false);
    setSelectedServiceId('');
    setAddPrice('');
    setAddDuration(30);
    setAddStep(1);
    setAddError(null);
    setActiveCategoryId(null);
    setExpandedParentId(null);
    setModalVisible(true);
  };

  // Switching category clears any in-progress selection/expansion so the
  // hidden selection from another tab can't be saved by accident.
  const selectCategory = (catId: string) => {
    setActiveCategoryId(catId);
    setExpandedParentId(null);
    setSelectedServiceId('');
    setAddError(null);
  };

  const closeModal = () => {
    Keyboard.dismiss();
    setModalVisible(false);
    setAddError(null);
  };

  const openEdit = (svc: SaloonService) => {
    setIsEditing(true);
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
      if (!activeCategoryId) {
        setAddError('Choose a treatment category to continue.');
        return;
      }
      setAddStep(2);
      return;
    }

    if (addStep === 2) {
      if (!selectedServiceId) {
        setAddError('Choose a service to continue.');
        return;
      }
      setAddStep(3);
      return;
    }

    if (addStep === 3) {
      const price = parsePrice(addPrice);
      if (!Number.isFinite(price) || price <= 0) {
        setAddError('Enter a valid price to continue.');
        return;
      }
      Keyboard.dismiss();
      setAddStep(4);
      return;
    }

    handleSave();
  };

  const handleAddBack = () => {
    Keyboard.dismiss();
    setAddError(null);
    setAddStep(step => Math.max(1, step - 1) as AddStep);
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
  const visibleTopLevelServices = topLevelServices.filter(service => {
    const children = childrenByParent.get(service.id) ?? [];
    return children.length > 0 || !addedServiceIds.has(service.id);
  });
  const selectedService = categories
    .flatMap(category => category.services)
    .find(service => service.id === selectedServiceId);
  const selectedCategory = categories.find(category => category.id === activeCategoryId);
  const activeServiceCount = services.filter(service => service.isAvailable).length;
  const addPriceValue = parsePrice(addPrice);

  const renderLeaf = (svc: GlobalService, indented: boolean) => {
    const selected = selectedServiceId === svc.id;
    return (
      <TouchableOpacity
        key={svc.id}
        activeOpacity={0.85}
        onPress={() => {
          setSelectedServiceId(svc.id);
          setAddError(null);
        }}
        style={[
          styles.serviceOption,
          indented && styles.serviceOptionIndented,
          selected && styles.serviceOptionSelected,
        ]}
      >
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={selected ? darkBrown : beige}
          style={styles.optionIcon}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: darkBrown }}>
            {svc.name}
          </Text>
          {svc.description ? (
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: '#666', marginTop: 3, lineHeight: 19 }}>
              {svc.description}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderService = ({ item }: { item: SaloonService }) => (
    <View style={styles.serviceCard}>
      <View style={styles.serviceCardTop}>
        <View style={styles.serviceIconWrap}>
          <Ionicons name="cut-outline" size={21} color={darkBrown} />
        </View>
        <View style={styles.serviceTitleWrap}>
          {item.service?.category?.name ? (
            <Text style={styles.categoryLabel}>{item.service.category.name}</Text>
          ) : null}
          <Text style={styles.serviceName} numberOfLines={2}>
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
          <View style={[styles.statusPill, !item.isAvailable && styles.statusPillInactive]}>
            <View style={[styles.statusDot, !item.isAvailable && styles.statusDotInactive]} />
            <Text style={[styles.statusText, !item.isAvailable && styles.statusTextInactive]}>
              {item.isAvailable ? 'Active' : 'Inactive'}
            </Text>
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
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={darkBrown} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>YOUR MENU</Text>
          <Text style={styles.pageTitle}>My Services</Text>
          <Text style={styles.pageSubtitle}>
            {services.length === 0
              ? 'Build the menu your clients can book.'
              : `${services.length} service${services.length === 1 ? '' : 's'} · ${activeServiceCount} active`}
          </Text>
        </View>
        <TouchableOpacity
          onPress={openAdd}
          activeOpacity={0.85}
          style={styles.addButton}
        >
          <Ionicons name="add" size={20} color={white} />
          <Text style={styles.addButtonText}>Add service</Text>
        </TouchableOpacity>
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

      {services.length === 0 ? (
        <View style={styles.emptyStateWrap}>
          <View style={styles.emptyStateCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="sparkles-outline" size={30} color={darkBrown} />
            </View>
            <Text style={styles.emptyTitle}>Create your service menu</Text>
            <Text style={styles.emptyCopy}>
              Add the treatments clients can book, then choose a price and duration for each one.
            </Text>
            <TouchableOpacity onPress={openAdd} activeOpacity={0.85} style={styles.emptyButton}>
              <Ionicons name="add" size={19} color={white} />
              <Text style={styles.emptyButtonText}>Add your first service</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={services}
          keyExtractor={item => item.serviceId}
          renderItem={renderService}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchData(); }}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          style={{ flex: 1 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboardView}
          behavior="position"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 14 : 18}
          contentContainerStyle={styles.modalKeyboardContent}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.sheet,
                isEditing
                  ? styles.editSheet
                  : addStep === 3
                    ? styles.priceSheet
                    : styles.tallSheet,
              ]}
            >
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHeader}>
                <View style={{ flex: 1 }}>
                  {!isEditing && <Text style={styles.stepCount}>STEP {addStep} OF 4</Text>}
                  <Text style={styles.sheetTitle}>
                    {isEditing
                      ? 'Edit service'
                      : addStep === 1
                        ? 'Select a treatment'
                        : addStep === 2
                          ? 'Choose a service'
                          : addStep === 3
                            ? 'Set the price'
                            : 'Choose duration'}
                  </Text>
                </View>
                <TouchableOpacity accessibilityLabel="Close" onPress={closeModal} style={styles.closeButton}>
                  <Ionicons name="close" size={23} color={darkBrown} />
                </TouchableOpacity>
              </View>

              {!isEditing && (
                <View style={styles.progressTrack}>
                  {[1, 2, 3, 4].map(step => (
                    <View
                      key={step}
                      style={[styles.progressSegment, step <= addStep && styles.progressSegmentActive]}
                    />
                  ))}
                </View>
              )}

              {isEditing ? (
                <ScrollView
                  style={styles.stepScroll}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.editContent}
                >
                  <View style={styles.editServiceSummary}>
                    <View style={styles.serviceIconWrap}>
                      <Ionicons name="cut-outline" size={20} color={darkBrown} />
                    </View>
                    <Text style={styles.editServiceName}>
                      {services.find(s => s.serviceId === editForm.serviceId)?.service?.name ?? '—'}
                    </Text>
                  </View>

                  <Text style={styles.fieldLabel}>PRICE (€)</Text>
                  <View style={styles.priceInputWrap}>
                    <Text style={styles.currencyPrefix}>€</Text>
                    <TextInput
                      style={styles.priceInput}
                      value={editForm.price}
                      onChangeText={value => setEditForm(form => ({ ...form, price: value }))}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor="#B9AFA5"
                    />
                  </View>

                  <Text style={styles.fieldLabel}>DURATION</Text>
                  <View style={styles.durationGrid}>
                    {DURATIONS.map(duration => {
                      const active = editForm.durationMinutes === duration;
                      return (
                        <TouchableOpacity
                          key={duration}
                          activeOpacity={1}
                          onPress={() => setEditForm(form => ({ ...form, durationMinutes: duration }))}
                          style={[styles.durationOption, active && styles.durationOptionActive]}
                        >
                          <Text style={[styles.durationOptionNumber, active && styles.durationOptionTextActive]}>
                            {duration}
                          </Text>
                          <Text style={[styles.durationOptionUnit, active && styles.durationOptionTextActive]}>min</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={styles.availabilityRow}>
                    <View>
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
                </ScrollView>
              ) : addStep === 1 ? (
                <ScrollView
                  style={styles.stepScroll}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.treatmentStepContent}
                >
                  <Text style={styles.stepHelp}>What kind of treatment would you like to add?</Text>
                  <View style={styles.treatmentGrid}>
                    {categories.map((category, index) => {
                      const active = activeCategoryId === category.id;
                      const bookableCount = category.services.filter(service =>
                        !category.services.some(child => child.parentServiceId === service.id)
                      ).length;
                      const icons = ['sparkles-outline', 'eye-outline', 'color-palette-outline', 'heart-outline'];

                      return (
                        <TouchableOpacity
                          key={category.id}
                          activeOpacity={0.85}
                          onPress={() => selectCategory(category.id)}
                          style={[styles.treatmentCard, active && styles.treatmentCardActive]}
                        >
                          <View style={[styles.treatmentIcon, active && styles.treatmentIconActive]}>
                            <Ionicons
                              name={icons[index % icons.length] as any}
                              size={22}
                              color={active ? white : darkBrown}
                            />
                          </View>
                          <Text
                            numberOfLines={2}
                            style={[styles.treatmentName, active && styles.treatmentNameActive]}
                          >
                            {category.name}
                          </Text>
                          <Text style={[styles.treatmentCount, active && styles.treatmentCountActive]}>
                            {bookableCount} service{bookableCount === 1 ? '' : 's'}
                          </Text>
                          <View style={[styles.treatmentCheck, active && styles.treatmentCheckActive]}>
                            {active && <Ionicons name="checkmark" size={15} color={darkBrown} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              ) : addStep === 2 ? (
                <ScrollView
                  style={styles.stepScroll}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.serviceStepContent}
                >
                  <View style={styles.selectionSummary}>
                    <Ionicons name="sparkles-outline" size={19} color={darkBrown} />
                    <Text style={styles.selectionSummaryText} numberOfLines={2}>
                      {selectedCategory?.name}
                    </Text>
                  </View>
                  <Text style={styles.stepHelp}>Now select the exact service clients will book.</Text>

                  {visibleTopLevelServices.length === 0 ? (
                    <View style={styles.noOptionsCard}>
                      <Ionicons name="checkmark-circle-outline" size={24} color={muted} />
                      <Text style={styles.noOptionsText}>No more services are available in this category.</Text>
                    </View>
                  ) : (
                    <View style={styles.serviceTree}>
                      {visibleTopLevelServices.map(node => {
                        const children = childrenByParent.get(node.id) ?? [];

                        if (children.length === 0) {
                          if (addedServiceIds.has(node.id)) return null;
                          return renderLeaf(node, false);
                        }

                        const remaining = children.filter(child => !addedServiceIds.has(child.id));
                        const expanded = expandedParentId === node.id;
                        return (
                          <View key={node.id} style={styles.serviceGroup}>
                            <TouchableOpacity
                              activeOpacity={0.85}
                              onPress={() => setExpandedParentId(expanded ? null : node.id)}
                              style={styles.serviceGroupHeader}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={styles.serviceGroupTitle}>{node.name}</Text>
                                <Text style={styles.serviceGroupCount}>
                                  {remaining.length > 0
                                    ? `${remaining.length} option${remaining.length === 1 ? '' : 's'}`
                                    : 'All added'}
                                </Text>
                              </View>
                              <Ionicons
                                name={expanded ? 'chevron-up' : 'chevron-down'}
                                size={20}
                                color={darkBrown}
                              />
                            </TouchableOpacity>

                            {expanded && (
                              <View style={styles.serviceGroupChildren}>
                                {remaining.length === 0 ? (
                                  <Text style={styles.allAddedText}>All options here are already in your menu.</Text>
                                ) : (
                                  remaining.map(child => renderLeaf(child, true))
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </ScrollView>
              ) : addStep === 3 ? (
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
                <ScrollView
                  style={styles.stepScroll}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.focusedStepScrollContent}
                >
                  <View style={styles.selectionSummary}>
                    <Ionicons name="cut-outline" size={18} color={darkBrown} />
                    <Text style={styles.selectionSummaryText} numberOfLines={1}>{selectedService?.name}</Text>
                    <Text style={styles.selectionPrice}>€{addPriceValue.toFixed(2)}</Text>
                  </View>
                  <Text style={styles.focusedQuestion}>How long does it take?</Text>
                  <View style={styles.durationGrid}>
                    {DURATIONS.map(duration => {
                      const active = addDuration === duration;
                      return (
                        <TouchableOpacity
                          key={duration}
                          activeOpacity={1}
                          onPress={() => setAddDuration(duration)}
                          style={[styles.durationOption, active && styles.durationOptionActive]}
                        >
                          <Text style={[styles.durationOptionNumber, active && styles.durationOptionTextActive]}>
                            {duration}
                          </Text>
                          <Text style={[styles.durationOptionUnit, active && styles.durationOptionTextActive]}>min</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
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
                {!isEditing && addStep > 1 && (
                  <TouchableOpacity onPress={handleAddBack} style={styles.backButton} disabled={saving}>
                    <Ionicons name="arrow-back" size={20} color={darkBrown} />
                    <Text style={styles.backButtonText}>Back</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={isEditing ? handleSave : handleAddNext}
                  disabled={saving}
                  style={[
                    styles.primaryButton,
                    !isEditing && addStep > 1 && styles.primaryButtonWithBack,
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator color={white} />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>
                        {isEditing
                          ? 'Save changes'
                          : addStep === 1
                            ? 'Next: Services'
                            : addStep === 2
                              ? 'Next: Price'
                              : addStep === 3
                                ? 'Next: Duration'
                                : 'Add service'}
                      </Text>
                      {!isEditing && addStep < 4 && <Ionicons name="arrow-forward" size={19} color={white} />}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  eyebrow: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    color: muted,
    marginBottom: 4,
  },
  pageTitle: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 29,
    lineHeight: 34,
    color: darkBrown,
  },
  pageSubtitle: {
    fontFamily: 'Philosopher-Regular',
    fontSize: 13,
    lineHeight: 19,
    color: muted,
    marginTop: 3,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 44,
    paddingHorizontal: 15,
    borderRadius: 22,
    backgroundColor: darkBrown,
    shadowColor: darkBrown,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
  addButtonText: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 14,
    color: white,
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
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  serviceCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: '#E9DED2',
    shadowColor: '#5A4027',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  serviceCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lightBeige,
  },
  serviceTitleWrap: {
    flex: 1,
    paddingHorizontal: 12,
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
  tallSheet: {
    height: '90%',
  },
  priceSheet: {
    maxHeight: '82%',
  },
  editSheet: {
    maxHeight: '82%',
    minHeight: 510,
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
  stepCount: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: muted,
    marginBottom: 3,
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
  stepScroll: {
    flex: 1,
  },
  treatmentStepContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  treatmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  treatmentCard: {
    position: 'relative',
    width: '48.2%',
    minHeight: 150,
    justifyContent: 'flex-end',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E3D5C4',
    backgroundColor: lightBeige,
  },
  treatmentCardActive: {
    borderColor: darkBrown,
    backgroundColor: darkBrown,
  },
  treatmentIcon: {
    position: 'absolute',
    top: 15,
    left: 15,
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: white,
  },
  treatmentIconActive: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  treatmentName: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 17,
    lineHeight: 21,
    color: darkBrown,
    paddingRight: 4,
  },
  treatmentNameActive: {
    color: white,
  },
  treatmentCount: {
    fontFamily: 'Philosopher-Regular',
    fontSize: 12,
    color: muted,
    marginTop: 5,
  },
  treatmentCountActive: {
    color: 'rgba(255,255,255,0.72)',
  },
  treatmentCheck: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#CDBDAA',
  },
  treatmentCheckActive: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: white,
    backgroundColor: white,
  },
  serviceStepContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  stepHelp: {
    fontFamily: 'Philosopher-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: muted,
    marginBottom: 14,
  },
  serviceTree: {
    gap: 8,
  },
  serviceGroup: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  serviceGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: lightBeige,
  },
  serviceGroupTitle: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 16,
    color: darkBrown,
  },
  serviceGroupCount: {
    fontFamily: 'Philosopher-Regular',
    fontSize: 12,
    color: muted,
    marginTop: 2,
  },
  serviceGroupChildren: {
    paddingTop: 5,
    backgroundColor: '#FCFAF8',
  },
  allAddedText: {
    fontFamily: 'Philosopher-Regular',
    fontSize: 13,
    lineHeight: 19,
    color: muted,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  serviceOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEE6DE',
    backgroundColor: white,
    marginBottom: 6,
  },
  serviceOptionIndented: {
    marginLeft: 12,
  },
  serviceOptionSelected: {
    borderColor: darkBrown,
    backgroundColor: '#F7F0E8',
  },
  optionIcon: {
    marginRight: 11,
    marginTop: 1,
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
    flexGrow: 1,
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
    fontSize: 14,
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
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 4,
  },
  durationOption: {
    width: '31%',
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: beige,
    backgroundColor: lightBeige,
    paddingVertical: 15,
  },
  durationOptionActive: {
    borderColor: darkBrown,
    backgroundColor: darkBrown,
  },
  durationOptionNumber: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 18,
    color: darkBrown,
  },
  durationOptionUnit: {
    fontFamily: 'Philosopher-Regular',
    fontSize: 11,
    color: muted,
  },
  durationOptionTextActive: {
    color: white,
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
  editContent: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 22,
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
  fieldLabel: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 11,
    letterSpacing: 1,
    color: muted,
    marginBottom: 8,
    marginTop: 3,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#EEE5DC',
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
