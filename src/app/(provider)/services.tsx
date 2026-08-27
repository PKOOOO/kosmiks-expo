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
  Platform,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../../config/constants';

const darkBrown = '#423120';
const beige = '#D7C3A7';
const lightBeige = '#F4EDE5';
const white = '#FFFFFF';
const DURATIONS = [15, 30, 45, 60, 90, 120];

const labelStyle = {
  fontFamily: 'Philosopher-Bold' as const,
  fontSize: 13,
  color: '#888',
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
  marginBottom: 6,
};

const inputStyle = {
  borderWidth: 1.5,
  borderColor: beige,
  borderRadius: 10,
  paddingHorizontal: 14,
  paddingVertical: 10,
  fontFamily: 'Philosopher-Regular' as const,
  fontSize: 15,
  color: darkBrown,
};

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

const EMPTY_EDIT: EditForm = { serviceId: '', price: '', durationMinutes: 30, isAvailable: true };

export default function ProviderServicesScreen() {
  const { getToken } = useAuth();
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

  const openAdd = () => {
    setIsEditing(false);
    setSelectedServiceId('');
    setAddPrice('');
    setAddDuration(30);
    setActiveCategoryId(categories[0]?.id ?? null);
    setExpandedParentId(null);
    setModalVisible(true);
  };

  // Switching category clears any in-progress selection/expansion so the
  // hidden selection from another tab can't be saved by accident.
  const selectCategory = (catId: string) => {
    setActiveCategoryId(catId);
    setExpandedParentId(null);
    setSelectedServiceId('');
  };

  const openEdit = (svc: SaloonService) => {
    setIsEditing(true);
    setEditForm({
      serviceId: svc.serviceId,
      price: String(svc.price),
      durationMinutes: svc.durationMinutes,
      isAvailable: svc.isAvailable,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!saloonId) return;
    setSaving(true);
    try {
      const headers = await authHeaders();
      if (isEditing) {
        const price = parseFloat(editForm.price);
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
        const price = parseFloat(addPrice);
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
      setModalVisible(false);
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

  const renderLeaf = (svc: GlobalService, indented: boolean) => {
    const selected = selectedServiceId === svc.id;
    return (
      <TouchableOpacity
        key={svc.id}
        activeOpacity={0.85}
        onPress={() => setSelectedServiceId(svc.id)}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          paddingVertical: 14,
          paddingRight: 14,
          paddingLeft: indented ? 34 : 14,
          borderRadius: 12,
          marginBottom: 4,
          backgroundColor: selected ? lightBeige : white,
        }}
      >
        <Ionicons
          name={selected ? 'radio-button-on' : 'radio-button-off'}
          size={20}
          color={darkBrown}
          style={{ marginRight: 12, marginTop: 1 }}
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

  const renderService = ({ item, index }: { item: SaloonService; index: number }) => (
    <View style={{
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: index < services.length - 1 ? 1 : 0,
      borderBottomColor: beige,
    }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: darkBrown }}>
          {item.service?.name ?? 'Service'}
        </Text>
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: '#888', marginTop: 2 }}>
          {item.durationMinutes} min · {item.isAvailable ? 'Active' : 'Inactive'}
        </Text>
      </View>
      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: darkBrown, marginRight: 12 }}>
        €{Number(item.price).toFixed(2)}
      </Text>
      <TouchableOpacity onPress={() => openEdit(item)} style={{ padding: 6, marginRight: 4 }}>
        <Ionicons name="pencil-outline" size={18} color={darkBrown} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => handleDelete(item)} style={{ padding: 6 }}>
        <Ionicons name="trash-outline" size={18} color="#c00" />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: white, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={darkBrown} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: white }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: beige,
      }}>
        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 22, color: darkBrown }}>My Services</Text>
        <TouchableOpacity
          onPress={openAdd}
          style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: darkBrown, paddingHorizontal: 14, paddingVertical: 8,
            borderRadius: 20, gap: 6,
          }}
        >
          <Ionicons name="add" size={18} color={white} />
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 13, color: white }}>Add Service</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
          <Text style={{ color: '#c00', fontFamily: 'Philosopher-Regular', fontSize: 13 }}>{error}</Text>
        </View>
      )}

      {services.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Ionicons name="cut-outline" size={48} color={beige} style={{ marginBottom: 12 }} />
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: darkBrown, textAlign: 'center' }}>
            No services yet
          </Text>
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: '#888', textAlign: 'center', marginTop: 6 }}>
            Tap "Add Service" to start building your menu.
          </Text>
        </View>
      ) : (
        <FlatList
          data={services}
          keyExtractor={item => item.serviceId}
          renderItem={renderService}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchData(); }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          style={{ flex: 1 }}
          ListHeaderComponent={
            <View style={{ borderWidth: 2, borderColor: beige, borderRadius: 12, marginHorizontal: 20, marginTop: 16, overflow: 'hidden' }} />
          }
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent presentationStyle="overFullScreen">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
            <View style={{
              backgroundColor: white,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              paddingTop: 16, maxHeight: '92%', flex: 1,
            }}>
              {/* Handle */}
              <View style={{ width: 40, height: 4, backgroundColor: beige, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />

              {/* Title + close */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 20 }}>
                <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 20, color: darkBrown }}>
                  {isEditing ? 'Edit Service' : 'Add Services'}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 4 }}>
                  <Ionicons name="close" size={24} color={darkBrown} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
                {/* Service picker — add mode */}
                {!isEditing && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={labelStyle}>Services *</Text>

                    {/* Category tabs */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
                      {categories.map(cat => (
                        <TouchableOpacity
                          key={cat.id}
                          activeOpacity={0.85}
                          onPress={() => selectCategory(cat.id)}
                          style={{
                            height: 44,
                            paddingHorizontal: 16,
                            justifyContent: 'center',
                            borderRadius: 22,
                            backgroundColor: activeCategoryId === cat.id ? darkBrown : lightBeige,
                            borderWidth: 1.5,
                            borderColor: activeCategoryId === cat.id ? darkBrown : beige,
                          }}
                        >
                          <Text style={{
                            fontFamily: 'Philosopher-Bold',
                            fontSize: 15,
                            color: activeCategoryId === cat.id ? white : darkBrown,
                          }}>
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    {/* Service tree — parents expand to reveal their sub-services */}
                    {topLevelServices.length === 0 ? (
                      <Text style={{ fontFamily: 'Philosopher-Regular', color: '#888', fontSize: 13, paddingVertical: 8 }}>
                        No services in this category.
                      </Text>
                    ) : (
                      <View>
                        {topLevelServices.map(node => {
                          const children = childrenByParent.get(node.id) ?? [];

                          // Standalone bookable service (no sub-services)
                          if (children.length === 0) {
                            if (addedServiceIds.has(node.id)) return null;
                            return renderLeaf(node, false);
                          }

                          // Parent group — expandable header, sub-services inside
                          const remaining = children.filter(c => !addedServiceIds.has(c.id));
                          const expanded = expandedParentId === node.id;
                          return (
                            <View key={node.id} style={{ marginBottom: 4 }}>
                              <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => setExpandedParentId(expanded ? null : node.id)}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  paddingVertical: 14,
                                  paddingHorizontal: 14,
                                  borderRadius: 12,
                                  backgroundColor: lightBeige,
                                }}
                              >
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: darkBrown }}>
                                    {node.name}
                                  </Text>
                                  <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: '#888', marginTop: 2 }}>
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
                                <View style={{ marginTop: 4 }}>
                                  {remaining.length === 0 ? (
                                    <Text style={{ fontFamily: 'Philosopher-Regular', color: '#888', fontSize: 13, paddingVertical: 8, paddingLeft: 34 }}>
                                      All options here are already added.
                                    </Text>
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
                  </View>
                )}

                {/* Service name — edit mode */}
                {isEditing && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={labelStyle}>Service</Text>
                    <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: darkBrown, paddingVertical: 8 }}>
                      {services.find(s => s.serviceId === editForm.serviceId)?.service?.name ?? '—'}
                    </Text>
                  </View>
                )}

                {/* Price */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={labelStyle}>Price (€) *</Text>
                  <TextInput
                    style={inputStyle}
                    value={isEditing ? editForm.price : addPrice}
                    onChangeText={v => isEditing ? setEditForm(f => ({ ...f, price: v })) : setAddPrice(v)}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#bbb"
                  />
                </View>

                {/* Duration */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={labelStyle}>Duration (minutes) *</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    {DURATIONS.map(d => {
                      const active = isEditing ? editForm.durationMinutes === d : addDuration === d;
                      return (
                        <TouchableOpacity
                          key={d}
                          onPress={() => isEditing ? setEditForm(f => ({ ...f, durationMinutes: d })) : setAddDuration(d)}
                          style={{
                            paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                            backgroundColor: active ? darkBrown : lightBeige,
                            borderWidth: 1.5, borderColor: active ? darkBrown : beige,
                          }}
                        >
                          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 13, color: active ? white : darkBrown }}>
                            {d}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Active toggle — edit only */}
                {isEditing && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <Text style={labelStyle}>Active</Text>
                    <Switch
                      value={editForm.isAvailable}
                      onValueChange={v => setEditForm(f => ({ ...f, isAvailable: v }))}
                      trackColor={{ false: beige, true: darkBrown }}
                      thumbColor={white}
                    />
                  </View>
                )}
              </ScrollView>

              {/* Save button */}
              <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 16, borderTopWidth: 1, borderTopColor: beige, backgroundColor: white }}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSave}
                  disabled={saving}
                  style={{ backgroundColor: darkBrown, borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}
                >
                  {saving
                    ? <ActivityIndicator color={white} />
                    : <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: white }}>
                        {isEditing ? 'Save Changes' : 'Add Service'}
                      </Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
