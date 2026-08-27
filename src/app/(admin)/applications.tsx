import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { API_BASE_URL } from '../../../config/constants';

const darkBrown = '#423120';
const beige = '#D7C3A7';
const lightBeige = '#F4EDE5';
const white = '#FFFFFF';
const green = '#2d7a2d';
const yellow = '#b07d00';
const red = '#c00';

type ProviderStatus =
  | 'NOT_APPLIED' | 'PHASE1_PENDING' | 'PHASE1_APPROVED'
  | 'PHASE2_PENDING' | 'PHASE2_APPROVED'
  | 'ACTIVE' | 'REJECTED';

type Application = {
  id: string;
  userId: string;
  currentPhase: number;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  city: string | null;
  neighbourhood: string | null;
  address: string | null;
  serviceCategories: string[];
  legalName: string | null;
  dateOfBirth: string | null;
  finnishId: string | null;
  nationality: string | null;
  businessName: string | null;
  yTunnus: string | null;
  businessType: string | null;
  bankAccountName: string | null;
  iban: string | null;
  qualificationDocs: string[];
  documentUrls: string[];
  termsAccepted: boolean;
  termsAcceptedAt: string | null;
  adminNotes: string | null;
  rejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    providerStatus: ProviderStatus;
  };
};

type FilterTab = 'all' | '1' | '2' | '3' | 'rejected';

// Phase 3 activates on submission, so only phases 1 and 2 ever await an admin.
const PENDING_STATUSES: ProviderStatus[] = ['PHASE1_PENDING', 'PHASE2_PENDING'];

function isPending(status: ProviderStatus) {
  return PENDING_STATUSES.includes(status);
}

function phaseBadgeColor(phase: number) {
  return phase === 1 ? '#5b7fa6' : phase === 2 ? '#7a5ba6' : '#2d7a2d';
}

function StatusBadge({ status }: { status: ProviderStatus }) {
  const pending = isPending(status);
  const rejected = status === 'REJECTED';
  const active = status === 'ACTIVE';
  const approved = status.includes('APPROVED');

  const color = pending ? yellow : rejected ? red : active || approved ? green : '#888';
  const bg = pending ? '#fffbf0' : rejected ? '#fff0f0' : active || approved ? '#f0fff0' : '#f5f5f5';
  const label = pending ? 'Pending' : rejected ? 'Rejected' : active ? 'Active' : approved ? 'Approved' : status;

  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 11, color }}>{label}</Text>
    </View>
  );
}

export default function AdminApplicationsScreen() {
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [imageViewer, setImageViewer] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<{ type: 'approve' | 'reject'; id: string } | null>(null);
  const [inputText, setInputText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const buildHeaders = async (): Promise<Record<string, string>> => {
    const token = await getTokenRef.current();
    const h: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` };
    if (token) h['X-User-Token'] = token;
    return h;
  };

  const fetchApplications = useCallback(async () => {
    try {
      const headers = await buildHeaders();
      const res = await fetch(`${API_BASE_URL}/admin/applications`, { headers });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setApplications(Array.isArray(data.applications) ? data.applications : []);
    } catch {
      Alert.alert('Error', 'Failed to load applications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchApplications(); }, [fetchApplications]));

  const handleAction = async () => {
    if (!actionModal) return;
    if (actionModal.type === 'reject' && !inputText.trim()) {
      Alert.alert('Required', 'Please enter a rejection reason.');
      return;
    }
    setActionLoading(true);
    const endpoint = `${API_BASE_URL}/admin/applications/${actionModal.id}/${actionModal.type}`;
    console.log(`[Admin] ${actionModal.type === 'approve' ? 'Approving' : 'Rejecting'} application:`, actionModal.id);
    console.log('[Admin] Calling:', endpoint);
    try {
      const headers = await buildHeaders();
      const body = actionModal.type === 'approve'
        ? { notes: inputText.trim() || null }
        : { reason: inputText.trim() };
      console.log('[Admin] Request body:', body);
      const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
      console.log('[Admin] Full response:', {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries((res.headers as any).entries()),
        url: res.url,
      });
      const raw = await res.text();
      let data: any = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
      console.log('[Admin] Response data:', data);
      if (!res.ok) throw new Error(`${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
      setActionModal(null);
      setInputText('');
      await fetchApplications();
    } catch (err: any) {
      console.log(`[Admin] ${actionModal.type} error:`, err?.message ?? err);
      Alert.alert('Error', `Failed to ${actionModal.type} application.\n\n${err?.message ?? ''}`);
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = applications.filter((a) => {
    if (filter === 'rejected') return a.user.providerStatus === 'REJECTED';
    if (filter === 'all') return true;
    return String(a.currentPhase) === filter;
  });

  const pendingCount = applications.filter((a) => isPending(a.user.providerStatus)).length;

  const counts: Record<FilterTab, number> = {
    all: applications.length,
    '1': applications.filter((a) => a.currentPhase === 1 && a.user.providerStatus !== 'REJECTED').length,
    '2': applications.filter((a) => a.currentPhase === 2 && a.user.providerStatus !== 'REJECTED').length,
    '3': applications.filter((a) => a.currentPhase === 3 && a.user.providerStatus !== 'REJECTED').length,
    rejected: applications.filter((a) => a.user.providerStatus === 'REJECTED').length,
  };

  const formatLongDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const renderDetail = (app: Application) => (
    <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4, backgroundColor: white, borderTopWidth: 1, borderTopColor: beige }}>
      {app.currentPhase >= 1 && (
        <View style={{ marginTop: 10 }}>
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            Phase 1 — Expression of Interest
          </Text>
          {[
            ['Phone', app.phone],
            ['City', app.city],
            ['Neighbourhood', app.neighbourhood],
            ['Address', app.address],
            ['Services', app.serviceCategories?.join(', ')],
          ].map(([label, value]) => value ? (
            <View key={label as string} style={{ flexDirection: 'row', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 13, color: darkBrown, width: 110 }}>{label}:</Text>
              <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: '#555', flex: 1 }}>{value as string}</Text>
            </View>
          ) : null)}
        </View>
      )}

      {app.currentPhase >= 2 && app.legalName && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            Phase 2 — Verification
          </Text>
          {[
            ['Legal name', app.legalName],
            ['Bank holder', app.bankAccountName],
            ['IBAN', app.iban],
            ['Date of birth', app.dateOfBirth],
            ['Finnish ID', app.finnishId],
            ['Nationality', app.nationality],
            ['Business', app.businessName],
            ['Y-tunnus', app.yTunnus],
            ['Business type', app.businessType],
            ['Terms accepted', app.termsAcceptedAt ? new Date(app.termsAcceptedAt).toLocaleDateString('fi-FI') : null],
          ].map(([label, value]) => value ? (
            <View key={label as string} style={{ flexDirection: 'row', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 13, color: darkBrown, width: 110 }}>{label}:</Text>
              <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: '#555', flex: 1 }}>{value as string}</Text>
            </View>
          ) : null)}
          {app.qualificationDocs?.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 12, color: '#888', marginBottom: 8 }}>Qualification Documents:</Text>
              <View style={{ gap: 8 }}>
                {app.qualificationDocs.map((url, i) => (
                  <TouchableOpacity key={i} onPress={() => setImageViewer(url)} activeOpacity={0.85}>
                    <Image
                      source={{ uri: url }}
                      style={{ width: '100%', aspectRatio: 2, borderRadius: 10, borderWidth: 1, borderColor: beige }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {app.rejectedReason && (
        <View style={{ marginTop: 10, padding: 10, backgroundColor: '#fff0f0', borderRadius: 8 }}>
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 12, color: red }}>Rejected reason:</Text>
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: red, marginTop: 2 }}>{app.rejectedReason}</Text>
        </View>
      )}

      {app.adminNotes && (
        <View style={{ marginTop: 8, padding: 10, backgroundColor: '#f0f0ff', borderRadius: 8 }}>
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 12, color: '#555' }}>Admin notes:</Text>
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: '#555', marginTop: 2 }}>{app.adminNotes}</Text>
        </View>
      )}

      {isPending(app.user.providerStatus) && (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <TouchableOpacity
            onPress={() => { setActionModal({ type: 'approve', id: app.id }); setInputText(''); }}
            style={{ flex: 1, backgroundColor: green, borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
          >
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: white }}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setActionModal({ type: 'reject', id: app.id }); setInputText(''); }}
            style={{ flex: 1, backgroundColor: white, borderWidth: 1.5, borderColor: red, borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
          >
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: red }}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}

    </View>
  );

  const renderItem = ({ item }: { item: Application; index: number }) => {
    const isExpanded = expanded === item.id;
    const name = item.firstName && item.lastName ? `${item.firstName} ${item.lastName}` : item.user.name ?? item.user.email;
    const date = formatLongDate(item.updatedAt);

    return (
      <View
        style={{
          marginHorizontal: 16,
          marginBottom: 12,
          backgroundColor: white,
          borderRadius: 12,
          overflow: 'hidden',
          // iOS shadow
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          // Android elevation
          elevation: 2,
        }}
      >
        <TouchableOpacity
          onPress={() => setExpanded(isExpanded ? null : item.id)}
          style={{ padding: 16 }}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 18, color: darkBrown }}>{name}</Text>
              <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: '#777', marginTop: 4 }}>{item.user.email}</Text>
              <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: '#999', marginTop: 4 }}>{date}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <View style={{ backgroundColor: phaseBadgeColor(item.currentPhase), paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 11, color: white }}>Phase {item.currentPhase}</Text>
              </View>
              <StatusBadge status={item.user.providerStatus} />
              <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#aaa" style={{ marginTop: 2 }} />
            </View>
          </View>
        </TouchableOpacity>
        {isExpanded && renderDetail(item)}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: white, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={darkBrown} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: lightBeige }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 24, color: darkBrown }}>Applications</Text>
        {pendingCount > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: yellow, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: white }} />
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 13, color: white }}>{pendingCount} pending</Text>
          </View>
        )}
      </View>

      {/* Filter tabs — compact pills with count badges */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
      >
        {([['all', 'All'], ['1', 'Phase 1'], ['2', 'Phase 2'], ['3', 'Phase 3'], ['rejected', 'Rejected']] as [FilterTab, string][]).map(([key, label]) => {
          const active = filter === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setFilter(key)}
              activeOpacity={0.7}
              style={{
                height: 36,
                paddingHorizontal: 14,
                borderRadius: 18,
                backgroundColor: active ? darkBrown : lightBeige,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 13, color: active ? white : darkBrown }}>
                {label}
              </Text>
              <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: active ? white : '#888' }}>
                ({counts[key]})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchApplications(); }} tintColor={darkBrown} />}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 80 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Ionicons name="clipboard-outline" size={48} color={beige} style={{ marginBottom: 12 }} />
            <Text style={{ fontFamily: 'Philosopher-Regular', color: '#888', fontSize: 15 }}>No applications.</Text>
          </View>
        }
      />

      {/* Approve / Reject modal */}
      <Modal visible={!!actionModal} transparent animationType="fade" onRequestClose={() => setActionModal(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: white, borderRadius: 16, padding: 24 }}>
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 18, color: darkBrown, marginBottom: 6 }}>
              {actionModal?.type === 'approve' ? 'Approve application' : 'Reject application'}
            </Text>
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: '#666', marginBottom: 14 }}>
              {actionModal?.type === 'approve' ? 'Add internal notes (optional)' : 'Rejection reason (shown to applicant)'}
            </Text>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder={actionModal?.type === 'approve' ? 'Notes…' : 'Reason…'}
              placeholderTextColor="#aaa"
              multiline
              numberOfLines={3}
              style={{
                fontFamily: 'Philosopher-Regular',
                fontSize: 14,
                color: darkBrown,
                borderWidth: 1.5,
                borderColor: beige,
                borderRadius: 10,
                padding: 12,
                minHeight: 80,
                textAlignVertical: 'top',
                marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setActionModal(null); setInputText(''); }}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: beige, alignItems: 'center' }}
              >
                <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: darkBrown }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAction}
                disabled={actionLoading}
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
                  backgroundColor: actionModal?.type === 'approve' ? green : red,
                }}
              >
                {actionLoading
                  ? <ActivityIndicator color={white} />
                  : <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: white }}>
                      {actionModal?.type === 'approve' ? 'Approve' : 'Reject'}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full-screen image viewer */}
      <Modal visible={!!imageViewer} transparent animationType="fade" onRequestClose={() => setImageViewer(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setImageViewer(null)} style={{ position: 'absolute', top: insets.top + 16, right: 20, zIndex: 10 }}>
            <Ionicons name="close-circle" size={32} color={white} />
          </TouchableOpacity>
          {imageViewer && (
            <Image source={{ uri: imageViewer }} style={{ width: '90%', height: '70%' }} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
