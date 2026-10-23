import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAdminStore, isAwaitingReview, applicantName, type Application, type ProviderStatus } from '@/lib/admin-api';
import { FilterPills, Card, Avatar, EmptyState, PhaseDots, colors, relativeDay } from '@/components/admin/AdminUI';
import BrandHeader from '@/components/BrandHeader';
import { useTabBarSpace } from '@/lib/layout';

type Filter = 'review' | 'progress' | 'active' | 'rejected';

const groupOf = (s: ProviderStatus): Filter =>
  isAwaitingReview(s) ? 'review' : s === 'ACTIVE' ? 'active' : s === 'REJECTED' ? 'rejected' : 'progress';

const EMPTY: Record<Filter, { title: string; body: string }> = {
  review: { title: 'Nothing to review', body: 'New applications will show up here.' },
  progress: { title: 'No one in progress', body: 'Approved applicants finishing their next step appear here.' },
  active: { title: 'No active providers yet', body: '' },
  rejected: { title: 'No rejected applications', body: '' },
};

export default function AdminApplicationsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const tabBarSpace = useTabBarSpace();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const applications = useAdminStore(s => s.applications);
  const loaded = useAdminStore(s => s.applicationsLoaded);
  const loadApplications = useAdminStore(s => s.loadApplications);
  const [filter, setFilter] = useState<Filter | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      await loadApplications(() => getTokenRef.current());
    } catch {
      setError("Couldn't load applications.");
    } finally {
      setRefreshing(false);
    }
  }, [loadApplications]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { review: 0, progress: 0, active: 0, rejected: 0 };
    for (const a of applications) c[groupOf(a.user.providerStatus)]++;
    return c;
  }, [applications]);

  // Open on "Needs review" when something is waiting, otherwise on active providers.
  const active: Filter = filter ?? (counts.review > 0 ? 'review' : 'active');
  const list = applications
    .filter(a => groupOf(a.user.providerStatus) === active)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <SafeAreaView edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined} style={{ flex: 1, backgroundColor: colors.sand }}>
      <BrandHeader />
      <FilterPills
        value={active}
        onChange={setFilter}
        options={[
          { key: 'review', label: 'Needs review', count: counts.review },
          { key: 'progress', label: 'In progress', count: counts.progress },
          { key: 'active', label: 'Active', count: counts.active },
          { key: 'rejected', label: 'Rejected', count: counts.rejected },
        ]}
      />

      {!loaded ? (
        <ActivityIndicator size="large" color={colors.dark} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={a => a.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: tabBarSpace }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.dark} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={<EmptyState icon="document-text-outline" title={error ?? EMPTY[active].title} body={error ? undefined : EMPTY[active].body} />}
          renderItem={({ item }) => (
            <ApplicationCard item={item} onPress={() => router.push(`/(admin)/applications/${item.id}` as any)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function ApplicationCard({ item, onPress }: { item: Application; onPress: () => void }) {
  const name = applicantName(item);
  const waiting = isAwaitingReview(item.user.providerStatus);
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      <Card style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar name={name} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: colors.dark }}>{name}</Text>
          <Text numberOfLines={1} style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: colors.muted, marginTop: 1 }}>
            {item.user.email}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <PhaseDots phase={item.currentPhase} waiting={waiting} rejected={item.user.providerStatus === 'REJECTED'} />
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: colors.muted }}>
              {waiting ? `Phase ${item.currentPhase} · ` : ''}{relativeDay(item.updatedAt)}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.beige} />
      </Card>
    </TouchableOpacity>
  );
}

