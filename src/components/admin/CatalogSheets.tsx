import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch } from 'react-native';
import { BottomSheet, FormField, formInputStyle, Button, colors } from '@/components/admin/AdminUI';
import { WORK_TYPES, type Category, type Service, type ServiceInput, type WorkType } from '@/lib/admin-catalog';

// Readable names for the stored work-type codes.
const WORK_TYPE_LABELS: Record<WorkType, string> = {
  UUDET: 'Uudet',
  POISTO: 'Poisto',
  HUOLTO: 'Huolto',
  EI_LISAKKEITA: 'Ei lisäkkeitä',
  LYHYET: 'Lyhyet',
  KESKIPITKAT: 'Keskipitkät',
  PITKAT: 'Pitkät',
};

function DeleteLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ alignSelf: 'center', marginTop: 12, paddingVertical: 6, paddingHorizontal: 12 }}>
      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: colors.red }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Category ────────────────────────────────────────────────────────────────

export function CategorySheet(props: {
  visible: boolean;
  category: Category | null;
  onClose: () => void;
  onSave: (input: { name: string; popular: boolean }) => Promise<void>;
  onDelete?: () => void;
}) {
  // Remount the form each time it opens so it starts with the right values —
  // no empty first frame.
  return props.visible ? <CategoryForm key={props.category?.id ?? 'new'} {...props} /> : null;
}

function CategoryForm({
  category, onClose, onSave, onDelete,
}: {
  category: Category | null;
  onClose: () => void;
  onSave: (input: { name: string; popular: boolean }) => Promise<void>;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [popular, setPopular] = useState(category?.popular ?? false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try { await onSave({ name, popular }); } finally { setSaving(false); }
  };

  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={category ? 'Edit category' : 'New category'}
      footer={
        <>
          <Button label={category ? 'Save changes' : 'Create category'} onPress={save} loading={saving} disabled={!name.trim()} />
          {category && onDelete ? <DeleteLink label="Delete category" onPress={onDelete} /> : null}
        </>
      }
    >
      <FormField label="Name">
        <TextInput
          style={formInputStyle}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Nails"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
        />
      </FormField>
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 16, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E8D9C8',
      }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: colors.dark }}>Featured</Text>
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: colors.muted, marginTop: 1 }}>Shown on the customer home screen</Text>
        </View>
        <Switch value={popular} onValueChange={setPopular} trackColor={{ false: colors.beige, true: colors.dark }} thumbColor={colors.white} />
      </View>
    </BottomSheet>
  );
}

// ─── Service / option ────────────────────────────────────────────────────────

type ServiceSheetProps = {
  visible: boolean;
  /** Existing service to edit, or null to create. */
  service: Service | null;
  categoryId: string;
  /** Set when creating an option under a service. */
  parentServiceId: string | null;
  parentName?: string;
  onClose: () => void;
  onSave: (input: ServiceInput) => Promise<void>;
  onDelete?: () => void;
};

export function ServiceSheet(props: ServiceSheetProps) {
  return props.visible
    ? <ServiceForm key={props.service?.id ?? `new-${props.parentServiceId ?? 'top'}`} {...props} />
    : null;
}

function ServiceForm({
  service, categoryId, parentServiceId, parentName, onClose, onSave, onDelete,
}: ServiceSheetProps) {
  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [workTypes, setWorkTypes] = useState<WorkType[]>(service?.workTypes ?? []);
  const [saving, setSaving] = useState(false);

  const isOption = !!(service?.parentServiceId ?? parentServiceId);
  const title = service ? (isOption ? 'Edit option' : 'Edit service') : isOption ? 'New option' : 'New service';

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name,
        description: description || null,
        categoryId: service?.categoryId ?? categoryId,
        parentServiceId: service?.parentServiceId ?? parentServiceId,
        workTypes,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button label={service ? 'Save changes' : 'Create'} onPress={save} loading={saving} disabled={!name.trim()} />
          {service && onDelete ? <DeleteLink label={isOption ? 'Delete option' : 'Delete service'} onPress={onDelete} /> : null}
        </>
      }
    >
      {!service && parentName ? (
        <View style={{ alignSelf: 'flex-start', paddingHorizontal: 12, height: 30, justifyContent: 'center', borderRadius: 15, backgroundColor: colors.sand, marginBottom: 14 }}>
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: colors.dark }}>
            Option of <Text style={{ fontFamily: 'Philosopher-Bold' }}>{parentName}</Text>
          </Text>
        </View>
      ) : null}

      <FormField label="Name">
        <TextInput
          style={formInputStyle}
          value={name}
          onChangeText={setName}
          placeholder={isOption ? 'Option name' : 'Service name'}
          placeholderTextColor={colors.muted}
        />
      </FormField>

      <FormField label="Description">
        <TextInput
          style={[formInputStyle, { minHeight: 96, textAlignVertical: 'top' }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Shown to customers · optional"
          placeholderTextColor={colors.muted}
          multiline
        />
      </FormField>

      {isOption && (
        <FormField label="Work types · optional">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {WORK_TYPES.map(wt => {
              const on = workTypes.includes(wt);
              return (
                <TouchableOpacity
                  key={wt}
                  activeOpacity={0.8}
                  onPress={() => setWorkTypes(prev => (on ? prev.filter(w => w !== wt) : [...prev, wt]))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={{
                    paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: 18,
                    backgroundColor: on ? colors.dark : colors.white, borderWidth: 1, borderColor: on ? colors.dark : '#E8D9C8',
                  }}
                >
                  <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: on ? colors.white : colors.dark }}>{WORK_TYPE_LABELS[wt]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </FormField>
      )}
    </BottomSheet>
  );
}
