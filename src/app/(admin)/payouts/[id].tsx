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

type SheetKind = 'sent' | 'arrived' | 'failed' | null;

export default function AdminPayoutDetailScreen() {
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
        <SubpageHeader title="Payout" />
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 30 }}>
          This payout couldn't be found.
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
      if (sheet === 'failed') body.failureReason = text.trim() || 'Transfer failed';
      await adminRequest(() => getTokenRef.current(), `/admin/payouts/${payout.id}`, { method: 'PATCH', body });
      await loadPayouts(() => getTokenRef.current());
      setSheet(null);
    } catch (e: any) {
      setError(e?.message ?? "Couldn't update the payout. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const canSend = payout.status === 'scheduled';
  const canArrive = payout.status === 'sent';
  const open = canSend || canArrive;

  const SHEET_COPY: Record<Exclude<SheetKind, null>, { title: string; body: string; button: string }> = {
    sent: {
      title: 'Mark as sent?',
      body: `Confirm you've transferred ${formatEur(payout.amount)} to ${payout.bankAccountName || 'the provider'}. They'll get a notification.`,
      button: 'Mark as sent',
    },
    arrived: {
      title: 'Mark as arrived?',
      body: 'Confirm the money has reached the provider’s account.',
      button: 'Mark as arrived',
    },
    failed: {
      title: 'Mark as failed?',
      body: 'The bookings go back into the provider’s balance and are included in the next payout run.',
      button: 'Mark as failed',
    },
  };

  return (
    <SafeAreaView edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined} style={{ flex: 1, backgroundColor: colors.sand }}>
      <SubpageHeader title="Payout" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: open ? 24 : pageBottom }}>
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 40, color: colors.dark }}>{formatEur(payout.amount)}</Text>
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: 10 }}>
            {payout.user.name || payout.user.email} · {formatDate(new Date(payout.scheduledFor))}
          </Text>
          <StatusChip status={payout.status} />
        </View>

        <SectionLabel>Send to</SectionLabel>
        <Card>
          <InfoRow label="Account holder" value={payout.bankAccountName || '—'} />
          <InfoRow label="IBAN" value={formatIban(payout.iban)} right={<CopyButton value={payout.iban.replace(/\s+/g, '')} label="Copy IBAN" />} />
          <InfoRow label="Amount" value={formatEur(payout.amount)} right={<CopyButton value={payout.amount.toFixed(2)} label="Copy amount" />} />
          <InfoRow label="Email" value={payout.user.email} last />
        </Card>

        <SectionLabel>Breakdown</SectionLabel>
        <Card style={{ paddingHorizontal: 18, paddingVertical: 10 }}>
          <AmountRow label={`${payout._count.bookings} bookings`} value={formatEur(payout.gross)} />
          <AmountRow label="Platform fee" value={`− ${formatEur(payout.fee)}`} />
          <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 6 }} />
          <AmountRow label="Provider receives" value={formatEur(payout.amount)} strong />
        </Card>

        <SectionLabel>Timeline</SectionLabel>
        <Card>
          <InfoRow label="Scheduled" value={formatDay(new Date(payout.scheduledFor))} />
          <InfoRow label="Sent" value={payout.sentAt ? formatDay(new Date(payout.sentAt)) : '—'} />
          <InfoRow label="Arrived" value={payout.arrivedAt ? formatDay(new Date(payout.arrivedAt)) : '—'} />
          {payout.failedAt ? (
            <InfoRow label="Failed" value={`${formatDay(new Date(payout.failedAt))}${payout.failureReason ? ` · ${payout.failureReason}` : ''}`} />
          ) : null}
          <InfoRow label="Reference" value={payout.reference || '—'} last />
        </Card>
      </ScrollView>

      {open && (
        <View style={{
          flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12,
          borderTopWidth: 1, borderTopColor: 'rgba(66,49,32,0.08)',
        }}>
          <Button label="Failed" variant="danger" style={{ flex: 1 }} onPress={() => openSheet('failed')} />
          <Button
            label={canSend ? 'Mark as sent' : 'Mark as arrived'}
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
            <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setSheet(null)} disabled={busy} />
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
          <FormField label="Bank reference · optional">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="e.g. transfer ID from your bank"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              style={formInputStyle}
            />
          </FormField>
        )}
        {sheet === 'failed' && (
          <FormField label="What went wrong · optional">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="e.g. IBAN rejected by the bank"
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
    <TouchableOpacity onPress={onPress} accessibilityLabel={copied ? 'Copied' : label} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={copied ? colors.green : colors.muted} />
    </TouchableOpacity>
  );
}
