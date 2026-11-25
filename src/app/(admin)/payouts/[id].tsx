import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Platform } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { adminRequest, useAdminStore, type AdminPayout } from '@/lib/admin-api';
import { formatEur, formatDate, formatDay, formatIban } from '@/lib/earnings';
import {
  SubpageHeader, Card, SectionLabel, AmountRow, InfoRow, Button, BottomSheet, FormField, formInputStyle, colors,
} from '@/components/admin/AdminUI';
import { StatusChip } from '@/components/earnings/EarningsUI';
import { usePageBottomSpace } from '@/lib/layout';
import { useT } from '@/i18n';
import { translateServerMessage } from '@/i18n/server-messages';

type SheetKind = 'sent' | 'arrived' | 'failed' | null;

export default function AdminPayoutDetailScreen() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();
  const pageBottom = usePageBottomSpace();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const payout = useAdminStore(s => s.payouts.find(p => p.id === id));
  const loadPayouts = useAdminStore(s => s.loadPayouts);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!payout) {
    return (
      <SafeAreaView edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined} style={{ flex: 1, backgroundColor: colors.sand }}>
        <SubpageHeader title={t('adetail.payout')} />
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 30 }}>
          {t('adetail.payoutNotFound')}
        </Text>
      </SafeAreaView>
    );
  }

  const openSheet = (kind: Exclude<SheetKind, null>) => {
    setText(kind === 'sent' ? payout.reference ?? '' : '');
    setError(null);
    setSheet(kind);
  };

  const confirm = async () => {
    if (!sheet) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, string> = { status: sheet };
      if (sheet === 'sent' && text.trim()) body.reference = text.trim();
      if (sheet === 'failed') body.failureReason = text.trim() || t('adetail.transferFailed');
      await adminRequest(() => getTokenRef.current(), `/admin/payouts/${payout.id}`, { method: 'PATCH', body });
      await loadPayouts(() => getTokenRef.current());
      setSheet(null);
    } catch (e: any) {
      setError(e?.message ? translateServerMessage(e.message) : t('adetail.updateFailed'));
    } finally {
      setBusy(false);
    }
  };

  const canSend = payout.status === 'scheduled';
  const canArrive = payout.status === 'sent';
  const open = canSend || canArrive;

  const SHEET_COPY: Record<Exclude<SheetKind, null>, { title: string; body: string; button: string }> = {
    sent: {
      title: t('adetail.sentTitle'),
      body: t('adetail.sentBody', { amount: formatEur(payout.amount), holder: payout.bankAccountName || t('adetail.theProvider') }),
      button: t('adetail.markSent'),
    },
    arrived: {
      title: t('adetail.arrivedTitle'),
      body: t('adetail.arrivedBody'),
      button: t('adetail.markArrived'),
    },
    failed: {
      title: t('adetail.failedTitle'),
      body: t('adetail.failedBody'),
      button: t('adetail.markFailed'),
    },
  };

  return (
    <SafeAreaView edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined} style={{ flex: 1, backgroundColor: colors.sand }}>
      <SubpageHeader title={t('adetail.payout')} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: open ? 24 : pageBottom }}>
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 40, color: colors.dark }}>{formatEur(payout.amount)}</Text>
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: 10 }}>
            {payout.user.name || payout.user.email} · {formatDate(new Date(payout.scheduledFor))}
          </Text>
          <StatusChip status={payout.status} />
        </View>

        <SectionLabel>{t('adetail.sendTo')}</SectionLabel>
        <Card>
          <InfoRow label={t('adetail.accountHolder')} value={payout.bankAccountName || '—'} />
          {payout.iban ? (
            <InfoRow label="IBAN" value={formatIban(payout.iban)} right={<CopyButton value={payout.iban.replace(/\s+/g, '')} label={t('adetail.copyIban')} />} />
          ) : (
            <InfoRow label={t('adetail.paidTo')} value={payout.stripeAccountId ? `Stripe ${payout.stripeAccountId}` : 'Stripe'} />
          )}
          <InfoRow label={t('adetail.amount')} value={formatEur(payout.amount)} right={<CopyButton value={payout.amount.toFixed(2)} label={t('adetail.copyAmount')} />} />
          <InfoRow label={t('adetail.email')} value={payout.user.email} last />
        </Card>

        <SectionLabel>{t('adetail.breakdown')}</SectionLabel>
        <Card style={{ paddingHorizontal: 18, paddingVertical: 10 }}>
          <AmountRow label={t('adetail.bookingsCount', { count: payout._count.bookings })} value={formatEur(payout.gross)} />
          <AmountRow label={t('adetail.platformFee')} value={`− ${formatEur(payout.fee)}`} />
          <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 6 }} />
          <AmountRow label={t('adetail.providerReceives')} value={formatEur(payout.amount)} strong />
        </Card>

        <SectionLabel>{t('adetail.timeline')}</SectionLabel>
        <Card>
          <InfoRow label={t('adetail.scheduled')} value={formatDay(new Date(payout.scheduledFor))} />
          <InfoRow label={t('adetail.sent')} value={payout.sentAt ? formatDay(new Date(payout.sentAt)) : '—'} />
          <InfoRow label={t('adetail.arrived')} value={payout.arrivedAt ? formatDay(new Date(payout.arrivedAt)) : '—'} />
          {payout.failedAt ? (
            <InfoRow label={t('adetail.failed')} value={`${formatDay(new Date(payout.failedAt))}${payout.failureReason ? ` · ${payout.failureReason}` : ''}`} />
          ) : null}
          <InfoRow label={t('adetail.reference')} value={payout.reference || '—'} last />
        </Card>
      </ScrollView>

      {open && (
        <View style={{
          flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12,
          borderTopWidth: 1, borderTopColor: 'rgba(66,49,32,0.08)',
        }}>
          <Button label={t('adetail.failed')} variant="danger" style={{ flex: 1 }} onPress={() => openSheet('failed')} />
          <Button
            label={canSend ? t('adetail.markSent') : t('adetail.markArrived')}
            icon={canSend ? 'paper-plane-outline' : 'checkmark-done'}
            style={{ flex: 1.6 }}
            onPress={() => openSheet(canSend ? 'sent' : 'arrived')}
          />
        </View>
      )}

      <BottomSheet
        visible={sheet !== null}
        onClose={() => !busy && setSheet(null)}
        title={sheet ? SHEET_COPY[sheet].title : ''}
        footer={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label={t('adetail.cancel')} variant="outline" style={{ flex: 1 }} onPress={() => setSheet(null)} disabled={busy} />
            <Button
              label={sheet ? SHEET_COPY[sheet].button : ''}
              variant={sheet === 'failed' ? 'danger' : 'primary'}
              style={{ flex: 1.3 }}
              onPress={confirm}
              loading={busy}
            />
          </View>
        }
      >
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 15, color: colors.muted, lineHeight: 21, marginBottom: 14 }}>
          {sheet ? SHEET_COPY[sheet].body : ''}
        </Text>
        {sheet === 'sent' && (
          <FormField label={t('adetail.bankRefOptional')}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('adetail.bankRefPh')}
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              style={formInputStyle}
            />
          </FormField>
        )}
        {sheet === 'failed' && (
          <FormField label={t('adetail.whatWrong')}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('adetail.whatWrongPh')}
              placeholderTextColor={colors.muted}
              style={formInputStyle}
            />
          </FormField>
        )}
        {error ? (
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.red, marginBottom: 6 }}>{error}</Text>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}

// Copies quietly and flips to a check mark — no popup.
function CopyButton({ value, label }: { value: string; label: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const onPress = async () => {
    try {
      // expo-clipboard is native; a build that predates it just does nothing.
      const Clipboard = require('expo-clipboard');
      await Clipboard.setStringAsync(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <TouchableOpacity onPress={onPress} accessibilityLabel={copied ? t('adetail.copied') : label} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={copied ? colors.green : colors.muted} />
    </TouchableOpacity>
  );
}
