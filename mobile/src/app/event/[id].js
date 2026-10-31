import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Chip } from '../../components/ui';
import { notify } from '../../components/Toast';
import { useAgenda } from '../../lib/store';
import { dayKey, formatShortDate, formatTime, fromKey, relativeDay } from '../../lib/dates';
import { CATEGORIES, NAG_OPTIONS, PRIORITIES, REMINDER_OPTIONS, REPEAT_OPTIONS, colors, shadow, font } from '../../lib/theme';

function defaultStart(dateParam) {
  const now = new Date();
  const d = dateParam ? fromKey(dateParam) : new Date(now);
  if (dateParam && dayKey(d) !== dayKey(now)) d.setHours(9, 0, 0, 0);
  else d.setHours(now.getHours() + 1, 0, 0, 0);
  return d;
}

export default function EventScreen() {
  const { id, date } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { getEvent, save, remove, toggleDone } = useAgenda();
  const isNew = id === 'new';
  const existing = isNew ? null : getEvent(id);

  const [form, setForm] = useState(() => existing
    ? {
        ...existing,
        start: new Date(existing.start_at),
        end: existing.end_at ? new Date(existing.end_at) : null,
      }
    : {
        title: '', description: '', location: '', category: 'personal', priority: 'media',
        start: defaultStart(date), end: null, all_day: false,
        reminders: [1440, 60, 0], nag_every: 60, repeat: 'none',
      });
  const [saving, setSaving] = useState(false);
  const [iosPicker, setIosPicker] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const occDone = useMemo(() => !!(existing && date && existing.done_dates?.includes(date)), [existing, date]);

  if (!isNew && !existing) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.label}>Esta actividad ya no existe.</Text>
        <Pressable onPress={() => router.back()} style={[styles.saveBtn, { marginTop: 16 }]}><Text style={styles.saveText}>Volver</Text></Pressable>
      </View>
    );
  }

  const pick = (field, mode) => {
    const current = form[field] || form.start;
    const apply = (picked) => {
      const base = new Date(field === 'end' ? form.start : current);
      if (mode === 'date') base.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
      else base.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
      if (field === 'start' && form.end) {
        const duration = form.end - form.start;
        set({ start: base, end: new Date(base.getTime() + Math.max(duration, 0)) });
      } else {
        set({ [field]: base });
      }
    };
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: current, mode, is24Hour: true, onValueChange: (_e, d) => d && apply(d) });
    } else {
      setIosPicker({ field, mode, value: current, apply });
    }
  };

  const toggleReminder = (v) =>
    set({ reminders: form.reminders.includes(v) ? form.reminders.filter((r) => r !== v) : [...form.reminders, v].sort((a, b) => b - a) });

  const onSave = async () => {
    if (!form.title.trim()) return notify('Escribe un título', 'error');
    let end = form.end;
    if (end && end <= form.start) end = new Date(end.getTime() + 86400000);
    const start = new Date(form.start);
    if (form.all_day) start.setHours(0, 0, 0, 0);
    setSaving(true);
    try {
      await save({
        title: form.title.trim(), description: form.description, location: form.location,
        category: form.category, priority: form.priority, start_at: start.toISOString(),
        end_at: form.all_day || !end ? null : end.toISOString(), all_day: form.all_day,
        reminders: form.reminders, nag_every: form.nag_every, repeat: form.repeat,
      }, isNew ? undefined : id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      notify(isNew ? 'Actividad agendada' : 'Cambios guardados');
      router.back();
    } catch (err) {
      notify(err.message, 'error');
      setSaving(false);
    }
  };

  const onDelete = () => {
    Alert.alert('Eliminar actividad', form.repeat !== 'none' ? 'Se eliminarán todas las repeticiones.' : '¿Seguro que quieres eliminarla?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            await remove(id);
            notify('Actividad eliminada');
            router.back();
          } catch (err) {
            notify(err.message, 'error');
          }
        },
      },
    ]);
  };

  const onToggleDone = async () => {
    try {
      await toggleDone(id, date);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      notify(occDone ? 'Marcada como pendiente' : '¡Realizada! Ya no te avisaremos');
      if (!occDone) router.back();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.top, { paddingTop: Platform.OS === 'ios' ? 14 : insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>{isNew ? 'Nueva actividad' : 'Editar actividad'}</Text>
        {!isNew ? (
          <Pressable onPress={onDelete} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </Pressable>
        ) : <View style={styles.iconBtn} />}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
        {!isNew && date && (
          <Pressable onPress={onToggleDone} style={[styles.doneBanner, occDone && { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
            <Ionicons name={occDone ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={occDone ? colors.success : colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.doneTitle}>{occDone ? 'Realizada' : 'Marcar como realizada'}</Text>
              <Text style={styles.doneSub}>{relativeDay(fromKey(date))}{occDone ? ' · toca para desmarcar' : ' · detiene los avisos'}</Text>
            </View>
          </Pressable>
        )}

        <View style={styles.card}>
          <TextInput
            value={form.title}
            onChangeText={(t) => set({ title: t })}
            placeholder="¿Qué tienes que hacer?"
            placeholderTextColor={colors.faint}
            style={styles.titleInput}
            autoFocus={isNew}
          />
          <View style={styles.divider} />
          <Field icon="location-outline">
            <TextInput value={form.location} onChangeText={(t) => set({ location: t })} placeholder="Lugar (opcional)" placeholderTextColor={colors.faint} style={styles.input} />
          </Field>
          <Field icon="document-text-outline">
            <TextInput value={form.description} onChangeText={(t) => set({ description: t })} placeholder="Notas (opcional)" placeholderTextColor={colors.faint} style={[styles.input, { minHeight: 44 }]} multiline />
          </Field>
        </View>

        <Text style={styles.label}>Fecha y hora</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <Ionicons name="sunny-outline" size={20} color={colors.primary} />
            <Text style={styles.switchLabel}>Todo el día</Text>
            <Switch value={form.all_day} onValueChange={(v) => set({ all_day: v })} trackColor={{ true: colors.primary }} thumbColor="#fff" />
          </View>
          <View style={styles.pickRow}>
            <PickBtn icon="calendar-outline" text={formatShortDate(form.start)} onPress={() => pick('start', 'date')} />
            {!form.all_day && <PickBtn icon="time-outline" text={formatTime(form.start)} onPress={() => pick('start', 'time')} />}
          </View>
          {!form.all_day && (
            <View style={styles.pickRow}>
              <PickBtn
                icon="flag-outline"
                text={form.end ? `Termina ${formatTime(form.end)}` : 'Añadir hora de fin'}
                onPress={() => (form.end ? pick('end', 'time') : set({ end: new Date(form.start.getTime() + 3600000) }))}
              />
              {form.end && (
                <Pressable onPress={() => set({ end: null })} style={styles.clearBtn}>
                  <Ionicons name="close" size={18} color={colors.muted} />
                </Pressable>
              )}
            </View>
          )}
          {iosPicker && (
            <View>
              <DateTimePicker
                value={iosPicker.value}
                mode={iosPicker.mode}
                display={iosPicker.mode === 'date' ? 'inline' : 'spinner'}
                locale="es-ES"
                accentColor={colors.primary}
                onValueChange={(_e, d) => { if (d) { iosPicker.apply(d); setIosPicker({ ...iosPicker, value: d }); } }}
              />
              <Pressable onPress={() => setIosPicker(null)} style={styles.okBtn}><Text style={styles.okText}>Listo</Text></Pressable>
            </View>
          )}
          <Text style={styles.subLabel}>Repetir</Text>
          <Chips options={REPEAT_OPTIONS} isActive={(v) => form.repeat === v} onPress={(v) => set({ repeat: v })} />
        </View>

        <Text style={styles.label}>🔔 Recordatorios</Text>
        <View style={styles.card}>
          <Text style={styles.hint}>Elige todos los avisos que quieras antes de la actividad.</Text>
          <Chips options={REMINDER_OPTIONS} isActive={(v) => form.reminders.includes(v)} onPress={toggleReminder} />
          <Text style={styles.subLabel}>Insistir hasta que la marque como realizada</Text>
          <Text style={styles.hint}>Después de la hora te seguirá avisando (de 7:00 a 22:00) hasta que toques ✅ Realizado.</Text>
          <Chips options={NAG_OPTIONS} isActive={(v) => form.nag_every === v} onPress={(v) => set({ nag_every: v })} color={colors.warning} />
        </View>

        <Text style={styles.label}>Categoría</Text>
        <View style={styles.chips}>
          {Object.entries(CATEGORIES).map(([k, c]) => (
            <Chip key={k} label={c.label} icon={c.icon} color={c.color} active={form.category === k} onPress={() => set({ category: k })} />
          ))}
        </View>

        <Text style={styles.label}>Prioridad</Text>
        <View style={styles.chips}>
          {Object.entries(PRIORITIES).map(([k, p]) => (
            <Chip key={k} label={p.label} icon="flag" color={p.color} active={form.priority === k} onPress={() => set({ priority: k })} />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable onPress={onSave} disabled={saving} style={({ pressed }) => [styles.saveBtn, (pressed || saving) && { opacity: 0.8 }]}>
          <Ionicons name={saving ? 'hourglass-outline' : 'checkmark'} size={20} color="#fff" />
          <Text style={styles.saveText}>{saving ? 'Guardando…' : isNew ? 'Agendar' : 'Guardar cambios'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ icon, children }) {
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={20} color={colors.muted} style={{ marginTop: 12 }} />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function PickBtn({ icon, text, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pickBtn, pressed && { backgroundColor: colors.primarySoft }]}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.pickText}>{text}</Text>
    </Pressable>
  );
}

function Chips({ options, isActive, onPress, color }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} color={color} active={isActive(o.value)} onPress={() => onPress(o.value)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, backgroundColor: colors.bg },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, ...font(800), color: colors.text },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 16, ...shadow },
  titleInput: { fontSize: 22, ...font(800), color: colors.text, paddingVertical: 4 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  field: { flexDirection: 'row', gap: 10 },
  input: { ...font(400), fontSize: 15, color: colors.text, paddingVertical: 10 },
  label: { fontSize: 13, ...font(800), color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 22, marginBottom: 10, marginLeft: 4 },
  subLabel: { fontSize: 14, ...font(800), color: colors.text, marginTop: 18, marginBottom: 4 },
  hint: { ...font(400), fontSize: 12, color: colors.muted, marginBottom: 10, lineHeight: 17 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  switchLabel: { flex: 1, fontSize: 15, ...font(700), color: colors.text },
  pickRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  pickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 13,
    borderRadius: 14, backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.border,
  },
  pickText: { fontSize: 15, ...font(700), color: colors.text },
  clearBtn: { width: 48, borderRadius: 14, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  okBtn: { alignSelf: 'flex-end', paddingHorizontal: 18, paddingVertical: 8, backgroundColor: colors.primary, borderRadius: 10 },
  okText: { color: '#fff', ...font(800) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  doneBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, marginBottom: 14,
    backgroundColor: colors.primarySoft, borderWidth: 1.5, borderColor: colors.primary,
  },
  doneTitle: { fontSize: 16, ...font(800), color: colors.text },
  doneSub: { ...font(400), fontSize: 12, color: colors.muted, marginTop: 2 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.bg },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, borderRadius: 18,
    backgroundColor: colors.primary, paddingHorizontal: 24,
    shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  saveText: { color: '#fff', fontSize: 17, ...font(800) },
});
