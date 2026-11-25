import React, { useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, Modal, TextInput, Platform, Alert, Dimensions,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { adminRequest, useAdminStore, isAwaitingReview, applicantName } from '@/lib/admin-api';
import { formatIban, maskIban } from '@/lib/earnings';
import {
  SubpageHeader, Card, SectionLabel, InfoRow, Avatar, Chip, Button, PhaseDots, Segmented, BottomSheet, FormField,
  formInputStyle, colors, relativeDay,
} from '@/components/admin/AdminUI';
import { usePageBottomSpace } from '@/lib/layout';
import RemoteImage from '@/components/RemoteImage';
import { useT, type TKey } from '@/i18n';
import { translateServerMessage } from '@/i18n/server-messages';

const DOC_TITLES: TKey[] = ['adetail.doc0', 'adetail.doc1', 'adetail.doc2'];
const DOC_HEIGHT = Math.round((Dimensions.get('window').width - 32) * 0.6);

type Section = 'profile' | 'bank' | 'documents';

export default function ApplicationDetailScreen() {
  const { t, locale } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pageBottom = usePageBottomSpace();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const app = useAdminStore(s => s.applications.find(a => a.id === id));
  const loadApplications = useAdminStore(s => s.loadApplications);

  const [section, setSection] = useState<Section>('profile');
  const [showIban, setShowIban] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (!app) {
    return (
      <SafeAreaView edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined} style={{ flex: 1, backgroundColor: colors.sand }}>
        <SubpageHeader title={t('adetail.application')} />
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 30 }}>
          {t('adetail.appNotFound')}
        </Text>
      </SafeAreaView>
    );
  }

  const name = applicantName(app);
  const docs = app.qualificationDocs ?? [];
  const hasBank = app.currentPhase >= 2 && !!app.legalName;
  const status = app.user.providerStatus;
  const waiting = isAwaitingReview(status);
  const statusChip = waiting
    ? <Chip label={t('adetail.phaseReview', { phase: app.currentPhase })} tone="amber" />
    : status === 'ACTIVE' ? <Chip label={t('adetail.activeProvider')} tone="green" />
    : status === 'REJECTED' ? <Chip label={t('adetail.rejected')} tone="red" />
    : <Chip label={t('adetail.phaseApproved', { phase: app.currentPhase })} />;

  const submit = async () => {
    if (!action) return;
    if (action === 'reject' && !note.trim()) {
      Alert.alert(t('adetail.reasonNeeded'), t('adetail.reasonNeededBody'));
      return;
    }
    setBusy(true);
    try {
      await adminRequest(() => getTokenRef.current(), `/admin/applications/${app.id}/${action}`, {
        method: 'POST',
        body: action === 'approve' ? { notes: note.trim() || null } : { reason: note.trim() },
      });
      setAction(null);
      setNote('');
      await loadApplications(() => getTokenRef.current()).catch(() => undefined);
      router.back();
    } catch (e: any) {
      Alert.alert(action === 'approve' ? t('adetail.approveFailed') : t('adetail.rejectFailed'), e?.message ? translateServerMessage(e.message) : t('adetail.tryAgain'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined} style={{ flex: 1, backgroundColor: colors.sand }}>
      <SubpageHeader title={t('adetail.application')} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: waiting ? 24 : pageBottom }} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <Card style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Avatar name={name} size={56} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontFamily: 'Philosopher-Bold', fontSize: 20, color: colors.dark }}>{name}</Text>
              <Text selectable numberOfLines={1} style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.muted, marginTop: 1 }}>
                {app.user.email}
              </Text>
            </View>
          </View>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line,
          }}>
            {statusChip}
            <View style={{ alignItems: 'flex-end', gap: 5 }}>
              <PhaseDots phase={app.currentPhase} waiting={waiting} rejected={status === 'REJECTED'} />
              <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: colors.muted }}>
                Updated {relativeDay(app.updatedAt)}
              </Text>
            </View>
          </View>
        </Card>

        {app.rejectedReason ? (
          <Card style={{ padding: 16, marginTop: 12, backgroundColor: colors.redBg, borderColor: colors.redBg }}>
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: colors.red }}>{t('more.rejected')}</Text>
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.red, marginTop: 2 }}>{app.rejectedReason}</Text>
          </Card>
        ) : null}

        <Segmented
          style={{ marginTop: 16, marginBottom: 4 }}
          value={section}
          onChange={setSection}
          options={[
            { key: 'profile', label: t('adetail.profile') },
            ...(hasBank ? [{ key: 'bank' as const, label: t('adetail.bank') }] : []),
            ...(docs.length > 0 ? [{ key: 'documents' as const, label: t('adetail.documents', { count: docs.length }) }] : []),
          ]}
        />

        {section === 'profile' && (
          <>
            <SectionLabel>{t('adetail.contact')}</SectionLabel>
            <Card>
              <InfoRow label={t('adetail.phone')} value={app.phone} />
              <InfoRow label={t('adetail.email')} value={app.user.email} last />
            </Card>

            <SectionLabel>{t('adetail.location')}</SectionLabel>
            <Card>
              <InfoRow label={t('adetail.city')} value={app.city} />
              <InfoRow label={t('adetail.neighbourhood')} value={app.neighbourhood} />
              <InfoRow label={t('adetail.address')} value={app.address} last />
            </Card>

            {app.serviceCategories?.length > 0 && (
              <>
                <SectionLabel>{t('adetail.servicesOffered')}</SectionLabel>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {app.serviceCategories.map(c => (
                    <View key={c} style={{ paddingHorizontal: 14, height: 34, justifyContent: 'center', borderRadius: 17, backgroundColor: colors.white }}>
                      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: colors.dark }}>{c}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {app.adminNotes ? (
              <>
                <SectionLabel>{t('adetail.adminNotes')}</SectionLabel>
                <Card style={{ padding: 16 }}>
                  <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.dark, lineHeight: 20 }}>{app.adminNotes}</Text>
                </Card>
              </>
            ) : null}
          </>
        )}

        {section === 'bank' && hasBank && (
          <>
            <SectionLabel>{t('adetail.identity')}</SectionLabel>
            <Card>
              <InfoRow label={t('adetail.legalName')} value={app.legalName} />
              <InfoRow label={t('adetail.dob')} value={app.dateOfBirth} last />
            </Card>

            <SectionLabel>{t('adetail.payoutAccount')}</SectionLabel>
            <Card>
              <InfoRow label={t('adetail.holder')} value={app.bankAccountName} />
              {app.iban ? (
                <InfoRow
                  label="IBAN"
                  value={showIban ? formatIban(app.iban) : maskIban(app.iban)}
                  last
                  right={
                    <TouchableOpacity
                      onPress={() => setShowIban(v => !v)}
                      accessibilityLabel={showIban ? t('adetail.hideIban') : t('adetail.showIban')}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name={showIban ? 'eye-off-outline' : 'eye-outline'} size={19} color={colors.muted} />
                    </TouchableOpacity>
                  }
                />
              ) : null}
            </Card>

            {app.termsAcceptedAt ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginLeft: 4 }}>
                <Ionicons name="checkmark-circle" size={17} color={colors.green} />
                <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.muted }}>
                  {t('adetail.acceptedTerms', { date: new Date(app.termsAcceptedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) })}
                </Text>
              </View>
            ) : null}
          </>
        )}

        {section === 'documents' && docs.length > 0 && (
          <View style={{ gap: 12, marginTop: 14 }}>
            {docs.map((url, i) => (
              <TouchableOpacity key={`${url}-${i}`} activeOpacity={0.85} onPress={() => setViewer(url)}>
                <Card style={{ overflow: 'hidden' }}>
                  <RemoteImage source={{ uri: url }} style={{ width: '100%', height: DOC_HEIGHT, backgroundColor: colors.light }} resizeMode="cover" />
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
                    <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: colors.dark }}>{DOC_TITLES[i] ? t(DOC_TITLES[i]) : t('adetail.document', { n: i + 1 })}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="expand-outline" size={15} color={colors.muted} />
                      <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: colors.muted }}>{t('adetail.view')}</Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {waiting && (
        <View style={{
          flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          borderTopWidth: 1, borderTopColor: 'rgba(66,49,32,0.08)', backgroundColor: colors.sand,
        }}>
          <Button label={t('adetail.reject')} variant="danger" style={{ flex: 1 }} onPress={() => { setNote(''); setAction('reject'); }} />
          <Button label={t('adetail.approvePhase', { phase: app.currentPhase })} style={{ flex: 1.4 }} onPress={() => { setNote(''); setAction('approve'); }} />
        </View>
      )}

      {/* Confirm approve / reject */}
      <BottomSheet
        visible={action !== null}
        onClose={() => !busy && setAction(null)}
        title={action === 'approve' ? t('adetail.approveName', { name }) : t('adetail.rejectName', { name })}
        footer={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label={t('adetail.cancel')} variant="outline" style={{ flex: 1 }} onPress={() => setAction(null)} disabled={busy} />
            <Button
              label={action === 'approve' ? t('adetail.approve') : t('adetail.reject')}
              variant={action === 'approve' ? 'primary' : 'danger'}
              style={{ flex: 1 }}
              onPress={submit}
              loading={busy}
              disabled={action === 'reject' && !note.trim()}
            />
          </View>
        }
      >
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 15, color: colors.muted, marginBottom: 14, lineHeight: 21 }}>
          {action === 'approve'
            ? t('adetail.approveInfo', { phase: Math.min(app.currentPhase + 1, 3) })
            : t('adetail.rejectInfo')}
        </Text>
        <FormField label={action === 'approve' ? t('adetail.noteOptional') : t('adetail.reason')}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={action === 'approve' ? t('adetail.notePh') : t('adetail.reasonPh')}
            placeholderTextColor={colors.muted}
            multiline
            style={[formInputStyle, { minHeight: 96, maxHeight: 160, textAlignVertical: 'top' }]}
          />
        </FormField>
      </BottomSheet>

      {/* Full-screen document viewer */}
      <Modal visible={viewer !== null} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' }}>
          {viewer && <RemoteImage source={{ uri: viewer }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
          <TouchableOpacity
            onPress={() => setViewer(null)}
            accessibilityLabel={t('adetail.closeDoc')}
            style={{
              position: 'absolute', top: insets.top + 12, right: 16, width: 44, height: 44, borderRadius: 22,
              alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)',
            }}
          >
            <Ionicons name="close" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
