import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../../config/constants';

const darkBrown = '#423120';
const beige = '#D7C3A7';
const lightBeige = '#F4EDE5';
const white = '#FFFFFF';

const WORK_TYPES = ['UUDET', 'POISTO', 'HUOLTO', 'EI_LISAKKEITA', 'LYHYET', 'KESKIPITKAT', 'PITKAT'] as const;
type WorkType = typeof WORK_TYPES[number];

// ─── Types ────────────────────────────────────────────────────────────────────
type Category = { id: string; name: string; popular: boolean };

type Service = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  parentServiceId: string | null;
  workTypes: WorkType[];
  category: { name: string };
  parentService: { id: string; name: string } | null;
  subServices: { id: string; name: string }[];
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminCatalogScreen() {
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<'categories' | 'services'>('categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Category modal
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catPopular, setCatPopular] = useState(false);
  const [catSaving, setCatSaving] = useState(false);

  // Service modal
  const [svcModalVisible, setSvcModalVisible] = useState(false);
  const [editingSvc, setEditingSvc] = useState<Service | null>(null);
  const [svcName, setSvcName] = useState('');
  const [svcDesc, setSvcDesc] = useState('');
  const [svcCategoryId, setSvcCategoryId] = useState('');
  const [svcParentId, setSvcParentId] = useState('');
  const [svcWorkTypes, setSvcWorkTypes] = useState<WorkType[]>([]);
  const [svcSaving, setSvcSaving] = useState(false);

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getToken();
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
    };
    if (token) h['X-User-Token'] = token;
    return h;
  }, [getToken]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      const headers = await authHeaders();
      const [catRes, svcRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/categories`, { headers }),
        fetch(`${API_BASE_URL}/admin/services`, { headers }),
      ]);
      if (catRes.ok) setCategories(await catRes.json());
      if (svcRes.ok) setServices(await svcRes.json());
      if (!catRes.ok && !svcRes.ok) throw new Error();
    } catch {
      setError('Failed to load catalog.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authHeaders]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ══════════════════════════════════════════════════════════════
  // CATEGORY CRUD
  // ══════════════════════════════════════════════════════════════

  const openAddCat = () => {
    setEditingCat(null);
    setCatName('');
    setCatPopular(false);
    setCatModalVisible(true);
  };

  const openEditCat = (cat: Category) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatPopular(cat.popular);
    setCatModalVisible(true);
  };

  const saveCat = async () => {
    if (!catName.trim()) return Alert.alert('Required', 'Category name is required.');
    setCatSaving(true);
    try {
      const headers = await authHeaders();
      if (editingCat) {
        const res = await fetch(`${API_BASE_URL}/admin/categories/${editingCat.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ name: catName.trim(), popular: catPopular }),
        });
        if (!res.ok) throw new Error(await res.text());
        const updated: Category = await res.json();
        setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        const res = await fetch(`${API_BASE_URL}/admin/categories`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: catName.trim(), popular: catPopular }),
        });
        if (!res.ok) throw new Error(await res.text());
        const created: Category = await res.json();
        setCategories((prev) => [created, ...prev]);
      }
      setCatModalVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save category.');
    } finally {
      setCatSaving(false);
    }
  };

  const deleteCat = (cat: Category) => {
    Alert.alert('Delete Category', `Delete "${cat.name}"? This fails if services exist under it.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const headers = await authHeaders();
            const res = await fetch(`${API_BASE_URL}/admin/categories/${cat.id}`, {
              method: 'DELETE',
              headers,
            });
            if (res.status === 400) {
              Alert.alert('Cannot Delete', 'Remove all services in this category first.');
              return;
            }
            if (!res.ok) throw new Error();
            setCategories((prev) => prev.filter((c) => c.id !== cat.id));
          } catch {
            Alert.alert('Error', 'Failed to delete category.');
          }
        },
      },
    ]);
  };

  // ══════════════════════════════════════════════════════════════
  // SERVICE CRUD
  // ══════════════════════════════════════════════════════════════

  const openAddSvc = () => {
    setEditingSvc(null);
    setSvcName('');
    setSvcDesc('');
    setSvcCategoryId(categories[0]?.id ?? '');
    setSvcParentId('');
    setSvcWorkTypes([]);
    setSvcModalVisible(true);
  };

  const openEditSvc = (svc: Service) => {
    setEditingSvc(svc);
    setSvcName(svc.name);
    setSvcDesc(svc.description ?? '');
    setSvcCategoryId(svc.categoryId);
    setSvcParentId(svc.parentServiceId ?? '');
    setSvcWorkTypes(svc.workTypes ?? []);
    setSvcModalVisible(true);
  };

  const saveSvc = async () => {
    if (!svcName.trim()) return Alert.alert('Required', 'Service name is required.');
    if (!editingSvc && !svcCategoryId) return Alert.alert('Required', 'Select a category.');
    setSvcSaving(true);
    try {
      const headers = await authHeaders();
      if (editingSvc) {
        const res = await fetch(`${API_BASE_URL}/admin/services/${editingSvc.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            name: svcName.trim(),
            description: svcDesc.trim() || null,
            workTypes: svcWorkTypes.length > 0 ? svcWorkTypes : undefined,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const updated: Service = await res.json();
        // Merge back relations from local state
        const merged = {
          ...updated,
          category: editingSvc.category,
          parentService: editingSvc.parentService,
          subServices: editingSvc.subServices,
        };
        setServices((prev) => prev.map((s) => (s.id === merged.id ? merged : s)));
      } else {
        const body: Record<string, any> = {
          name: svcName.trim(),
          categoryId: svcCategoryId,
          description: svcDesc.trim() || null,
        };
        if (svcParentId) {
          body.parentServiceId = svcParentId;
          if (svcWorkTypes.length > 0) body.workTypes = svcWorkTypes;
        }
        const res = await fetch(`${API_BASE_URL}/admin/services`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        // Re-fetch to get relations
        const svcRes = await fetch(`${API_BASE_URL}/admin/services`, { headers });
        if (svcRes.ok) setServices(await svcRes.json());
      }
      setSvcModalVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save service.');
    } finally {
      setSvcSaving(false);
    }
  };

  const deleteSvc = (svc: Service) => {
    const hasChildren = svc.subServices?.length > 0;
    if (hasChildren) {
      return Alert.alert('Cannot Delete', `"${svc.name}" has sub-services. Delete them first.`);
    }
    Alert.alert('Delete Service', `Delete "${svc.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setServices((prev) => prev.filter((s) => s.id !== svc.id));
          try {
            const headers = await authHeaders();
            const res = await fetch(`${API_BASE_URL}/admin/services/${svc.id}`, {
              method: 'DELETE',
              headers,
            });
            if (!res.ok) {
              const msg = await res.text();
              setServices((prev) => [...prev, svc]);
              Alert.alert('Cannot Delete', msg || 'Service has existing bookings or references.');
            }
          } catch {
            setServices((prev) => [...prev, svc]);
            Alert.alert('Error', 'Failed to delete service.');
          }
        },
      },
    ]);
  };

  const toggleWorkType = (wt: WorkType) => {
    setSvcWorkTypes((prev) =>
      prev.includes(wt) ? prev.filter((w) => w !== wt) : [...prev, wt]
    );
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  // Parent services for the current selected category (for sub-service picker)
  const parentServicesForCat = services.filter(
    (s) => s.categoryId === svcCategoryId && s.parentServiceId === null
  );

  // Group services: parent → children
  const parentServices = services.filter((s) => s.parentServiceId === null);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: white, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={darkBrown} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: white }}>
      {/* ── Header ── */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: beige,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 22, color: darkBrown }}>Catalog</Text>
        <TouchableOpacity
          onPress={tab === 'categories' ? openAddCat : openAddSvc}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: darkBrown,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 20,
            gap: 6,
          }}
        >
          <Ionicons name="add" size={18} color={white} />
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 13, color: white }}>
            {tab === 'categories' ? 'Add Category' : 'Add Service'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Tab toggle ── */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 10, gap: 8 }}>
        {(['categories', 'services'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={{
              paddingHorizontal: 18,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: tab === t ? darkBrown : lightBeige,
            }}
          >
            <Text
              style={{
                fontFamily: 'Philosopher-Bold',
                fontSize: 13,
                color: tab === t ? white : darkBrown,
                textTransform: 'capitalize',
              }}
            >
              {t} ({t === 'categories' ? categories.length : parentServices.length})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <Text style={{ color: '#c00', fontFamily: 'Philosopher-Regular', fontSize: 13 }}>{error}</Text>
        </View>
      )}

      {/* ══════════════════════════════════
          CATEGORIES TAB
      ══════════════════════════════════ */}
      {tab === 'categories' && (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 80 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchAll(); }}
              tintColor={darkBrown}
            />
          }
        >
          {categories.length === 0 ? (
            <View style={{ marginTop: 24, padding: 24, borderWidth: 2, borderColor: beige, borderRadius: 12, alignItems: 'center' }}>
              <Ionicons name="grid-outline" size={28} color={beige} style={{ marginBottom: 8 }} />
              <Text style={{ fontFamily: 'Philosopher-Regular', color: '#888', fontSize: 14 }}>
                No categories yet.
              </Text>
            </View>
          ) : (
            <View style={{ borderWidth: 2, borderColor: beige, borderRadius: 12, overflow: 'hidden', marginTop: 8 }}>
              {categories.map((cat, i) => (
                <View
                  key={cat.id}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderBottomWidth: i < categories.length - 1 ? 1 : 0,
                    borderBottomColor: beige,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: darkBrown }}>
                      {cat.name}
                    </Text>
                    {cat.popular && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 4 }}>
                        <Ionicons name="star" size={11} color="#b87a00" />
                        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 11, color: '#b87a00' }}>
                          Featured
                        </Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => openEditCat(cat)} style={{ padding: 6, marginRight: 4 }}>
                    <Ionicons name="pencil-outline" size={18} color={darkBrown} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteCat(cat)} style={{ padding: 6 }}>
                    <Ionicons name="trash-outline" size={18} color="#c00" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ══════════════════════════════════
          SERVICES TAB
      ══════════════════════════════════ */}
      {tab === 'services' && (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 80 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchAll(); }}
              tintColor={darkBrown}
            />
          }
        >
          {parentServices.length === 0 ? (
            <View style={{ marginTop: 24, padding: 24, borderWidth: 2, borderColor: beige, borderRadius: 12, alignItems: 'center' }}>
              <Ionicons name="list-outline" size={28} color={beige} style={{ marginBottom: 8 }} />
              <Text style={{ fontFamily: 'Philosopher-Regular', color: '#888', fontSize: 14 }}>
                No services yet.
              </Text>
            </View>
          ) : (
            parentServices.map((parent) => {
              const children = services.filter((s) => s.parentServiceId === parent.id);
              return (
                <View key={parent.id} style={{ marginTop: 16 }}>
                  {/* Category label */}
                  <Text
                    style={{
                      fontFamily: 'Philosopher-Bold',
                      fontSize: 11,
                      color: '#aaa',
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                      marginBottom: 6,
                    }}
                  >
                    {parent.category.name}
                  </Text>

                  <View style={{ borderWidth: 2, borderColor: beige, borderRadius: 12, overflow: 'hidden' }}>
                    {/* Parent service row */}
                    <ServiceRow
                      service={parent}
                      isParent
                      onEdit={() => openEditSvc(parent)}
                      onDelete={() => deleteSvc(parent)}
                    />

                    {/* Sub-services */}
                    {children.map((child, ci) => (
                      <View
                        key={child.id}
                        style={{
                          borderTopWidth: 1,
                          borderTopColor: beige,
                          backgroundColor: lightBeige,
                        }}
                      >
                        <ServiceRow
                          service={child}
                          isParent={false}
                          onEdit={() => openEditSvc(child)}
                          onDelete={() => deleteSvc(child)}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ══════════════════════════════════════════════════════════
          CATEGORY MODAL
      ══════════════════════════════════════════════════════════ */}
      <Modal visible={catModalVisible} animationType="slide" transparent presentationStyle="overFullScreen">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
            <View
              style={{
                backgroundColor: white,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 20,
                paddingBottom: insets.bottom + 20,
              }}
            >
              <ModalHandle />
              <ModalTitle
                title={editingCat ? 'Edit Category' : 'New Category'}
                onClose={() => setCatModalVisible(false)}
              />

              <FieldLabel>Name *</FieldLabel>
              <TextInput
                style={inputStyle}
                value={catName}
                onChangeText={setCatName}
                placeholder="e.g. Nails, Hair, Massage"
                placeholderTextColor="#bbb"
                autoFocus
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 24 }}>
                <FieldLabel>Featured (shown on home screen)</FieldLabel>
                <Switch
                  value={catPopular}
                  onValueChange={setCatPopular}
                  trackColor={{ false: beige, true: darkBrown }}
                  thumbColor={white}
                />
              </View>

              <SaveButton label={editingCat ? 'Save Changes' : 'Create Category'} saving={catSaving} onPress={saveCat} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════
          SERVICE MODAL
      ══════════════════════════════════════════════════════════ */}
      <Modal visible={svcModalVisible} animationType="slide" transparent presentationStyle="overFullScreen">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
            <View
              style={{
                backgroundColor: white,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 20,
                paddingBottom: insets.bottom + 20,
                maxHeight: '90%',
              }}
            >
              <ModalHandle />
              <ModalTitle
                title={editingSvc ? 'Edit Service' : 'New Service'}
                onClose={() => setSvcModalVisible(false)}
              />

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Name */}
                <FieldLabel>Name *</FieldLabel>
                <TextInput
                  style={[inputStyle, { marginBottom: 16 }]}
                  value={svcName}
                  onChangeText={setSvcName}
                  placeholder="Service name"
                  placeholderTextColor="#bbb"
                />

                {/* Description */}
                <FieldLabel>Description</FieldLabel>
                <TextInput
                  style={[inputStyle, { height: 70, textAlignVertical: 'top', marginBottom: 16 }]}
                  value={svcDesc}
                  onChangeText={setSvcDesc}
                  placeholder="Optional description"
                  placeholderTextColor="#bbb"
                  multiline
                />

                {/* Category picker (add only) */}
                {!editingSvc && (
                  <>
                    <FieldLabel>Category *</FieldLabel>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                      {categories.map((cat) => (
                        <TouchableOpacity
                          key={cat.id}
                          onPress={() => { setSvcCategoryId(cat.id); setSvcParentId(''); }}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 7,
                            marginRight: 8,
                            borderRadius: 16,
                            backgroundColor: svcCategoryId === cat.id ? darkBrown : lightBeige,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: 'Philosopher-Bold',
                              fontSize: 12,
                              color: svcCategoryId === cat.id ? white : darkBrown,
                            }}
                          >
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}

                {/* Parent service picker (add only, optional) */}
                {!editingSvc && svcCategoryId && parentServicesForCat.length > 0 && (
                  <>
                    <FieldLabel>Parent Service (leave empty for top-level)</FieldLabel>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                      {/* None option */}
                      <TouchableOpacity
                        onPress={() => setSvcParentId('')}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 7,
                          marginRight: 8,
                          borderRadius: 16,
                          backgroundColor: svcParentId === '' ? darkBrown : lightBeige,
                        }}
                      >
                        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 12, color: svcParentId === '' ? white : darkBrown }}>
                          None
                        </Text>
                      </TouchableOpacity>
                      {parentServicesForCat.map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          onPress={() => setSvcParentId(p.id)}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 7,
                            marginRight: 8,
                            borderRadius: 16,
                            backgroundColor: svcParentId === p.id ? darkBrown : lightBeige,
                          }}
                        >
                          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 12, color: svcParentId === p.id ? white : darkBrown }}>
                            {p.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}

                {/* workTypes — only for sub-services */}
                {(svcParentId || editingSvc?.parentServiceId) && (
                  <>
                    <FieldLabel>Work Types (optional)</FieldLabel>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                      {WORK_TYPES.map((wt) => (
                        <TouchableOpacity
                          key={wt}
                          onPress={() => toggleWorkType(wt)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 16,
                            backgroundColor: svcWorkTypes.includes(wt) ? darkBrown : lightBeige,
                            borderWidth: 1.5,
                            borderColor: svcWorkTypes.includes(wt) ? darkBrown : beige,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: 'Philosopher-Bold',
                              fontSize: 11,
                              color: svcWorkTypes.includes(wt) ? white : darkBrown,
                            }}
                          >
                            {wt}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                <SaveButton label={editingSvc ? 'Save Changes' : 'Create Service'} saving={svcSaving} onPress={saveSvc} />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ServiceRow({
  service,
  isParent,
  onEdit,
  onDelete,
}: {
  service: Service;
  isParent: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {!isParent && (
        <Ionicons name="return-down-forward-outline" size={14} color="#bbb" style={{ marginRight: 8 }} />
      )}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: isParent ? 'Philosopher-Bold' : 'Philosopher-Regular',
            fontSize: isParent ? 15 : 14,
            color: darkBrown,
          }}
        >
          {service.name}
        </Text>
        {service.workTypes?.length > 0 && (
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 11, color: '#aaa', marginTop: 2 }}>
            {service.workTypes.join(' · ')}
          </Text>
        )}
        {service.description && (
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: '#999', marginTop: 1 }} numberOfLines={1}>
            {service.description}
          </Text>
        )}
        {isParent && service.subServices?.length > 0 && (
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 11, color: '#bbb', marginTop: 2 }}>
            {service.subServices.length} sub-service{service.subServices.length > 1 ? 's' : ''}
          </Text>
        )}
      </View>
      <TouchableOpacity onPress={onEdit} style={{ padding: 6, marginRight: 2 }}>
        <Ionicons name="pencil-outline" size={17} color={darkBrown} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete} style={{ padding: 6 }}>
        <Ionicons name="trash-outline" size={17} color="#c00" />
      </TouchableOpacity>
    </View>
  );
}

function ModalHandle() {
  return (
    <View
      style={{
        width: 40,
        height: 4,
        backgroundColor: beige,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
      }}
    />
  );
}

function ModalTitle({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 20, color: darkBrown }}>{title}</Text>
      <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
        <Ionicons name="close" size={24} color={darkBrown} />
      </TouchableOpacity>
    </View>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: 'Philosopher-Bold',
        fontSize: 13,
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
      }}
    >
      {children}
    </Text>
  );
}

function SaveButton({ label, saving, onPress }: { label: string; saving: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={saving}
      style={{
        backgroundColor: darkBrown,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 4,
        marginBottom: 8,
      }}
    >
      {saving ? (
        <ActivityIndicator color={white} />
      ) : (
        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: white }}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

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
