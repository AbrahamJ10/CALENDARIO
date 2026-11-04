import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Clipboard from 'expo-clipboard';
import { Chip } from '../../components/ui';
import { notify } from '../../components/Toast';
import { useAgenda } from '../../lib/store';
import { addDays, dayKey, formatShortDate, formatTime, fromKey, relativeDay } from '../../lib/dates';
import { callPhone, copyText, hostOf, normalizeUrl, openMaps, openUrl, openWhatsApp, shareEvent, splitLinks } from '../../lib/links';
import { CATEGORIES, NAG_OPTIONS, PRIORITIES, REMINDER_OPTIONS, REPEAT_OPTIONS, colors, shadow, font } from '../../lib/theme';

function defaultStart(dateParam) {
  const now = new Date();
  const d = dateParam ? fromKey(dateParam) : new Date(now);
  if (dateParam && dayKey(d) !== dayKey(now)) d.setHours(9, 0, 0, 0);
  else d.setHours(now.getHours() + 1, 0, 0, 0);
  return d;
}

export default function EventScreen() {
  const { id, date, copyOf } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { getEvent, save, remove, toggleDone, setChecklist } = useAgenda();
  const isNew = id === 'new';
  const existing = isNew ? null : getEvent(id);
  // "Duplicar" abre una actividad nueva con los datos de otra
  const source = existing || (copyOf ? getEvent(copyOf) : null);

  const initialForm = () => source
    ? {
        ...source,
        start: new Date(source.start_at),
        end: source.end_at ? new Date(source.end_at) : null,
        links: source.links || [],
        checklist: isNew ? (source.checklist || []).map((c) => ({ ...c, done: false })) : source.checklist || [],
        phone: source.phone || '',
      }
    : {
        title: '', description: '', location: '', category: 'personal', priority: 'media',
        start: defaultStart(date), end: null, all_day: false,
        reminders: [1440, 60, 0], nag_every: 60, repeat: 'none',
        links: [], checklist: [], phone: '',
      };
  const [form, setForm] = useState(initialForm);
  // Una actividad guardada se abre solo para ver; se edita al tocar "Editar"
  const [editing, setEditing] = useState(isNew);
  const [newLink, setNewLink] = useState({ url: '', label: '' });
  const [newStep, setNewStep] = useState('');
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

  /** Cambia el día manteniendo la hora (atajos Hoy / Mañana / Lunes / 1 semana). */
  const setDay = (day) => {
    const next = new Date(day);
    next.setHours(form.start.getHours(), form.start.getMinutes(), 0, 0);
    const duration = form.end ? form.end - form.start : null;
    set({ start: next, end: duration != null ? new Date(next.getTime() + duration) : null });
  };
  const today = new Date();
  const nextMonday = addDays(today, ((8 - today.getDay()) % 7) || 7);
  const QUICK_DAYS = [
    { label: 'Hoy', day: today },
    { label: 'Mañana', day: addDays(today, 1) },
    { label: 'Próx. lunes', day: nextMonday },
    { label: 'En 1 semana', day: addDays(today, 7) },
  ];

  const addLink = () => {
    const url = normalizeUrl(newLink.url);
    if (!url) return notify('Ese enlace no es válido', 'error');
    set({ links: [...form.links, { url, label: newLink.label.trim() }] });
    setNewLink({ url: '', label: '' });
  };

  const pasteLink = async () => {
    const text = (await Clipboard.getStringAsync()).trim();
    if (!text) return notify('No hay nada copiado', 'error');
    setNewLink((l) => ({ ...l, url: text }));
  };

  const copy = async (text, what = 'Enlace copiado') => {
    await copyText(text);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    notify(what);
  };

  const open = async (url) => {
    if (!(await openUrl(url))) notify('No se pudo abrir el enlace', 'error');
  };

  const addStep = () => {
    if (!newStep.trim()) return;
    set({ checklist: [...form.checklist, { text: newStep.trim(), done: false }] });
    setNewStep('');
  };

  // En una actividad ya guardada, marcar un paso se guarda al momento
  const toggleStep = async (i) => {
    const checklist = form.checklist.map((c, j) => (j === i ? { ...c, done: !c.done } : c));
    set({ checklist });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!isNew) {
      try {
        await setChecklist(id, checklist);
      } catch (err) {
        notify(err.message, 'error');
      }
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
        links: form.links, checklist: form.checklist, phone: form.phone,
      }, isNew ? undefined : id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      notify(isNew ? 'Actividad agendada' : 'Cambios guardados');
      if (isNew) return router.back();
      setSaving(false);
      setEditing(false);
    } catch (err) {
      notify(err.message, 'error');
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setForm(initialForm());
    setNewLink({ url: '', label: '' });
    setNewStep('');
    setIosPicker(null);
    setEditing(false);
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

  const topBar = (
    <View style={[styles.top, { paddingTop: Platform.OS === 'ios' ? 14 : insets.top + 8 }]}>
      <Pressable onPress={editing && !isNew ? cancelEdit : () => router.back()} hitSlop={10} style={styles.iconBtn}>
        <Ionicons name={editing && !isNew ? 'arrow-back' : 'close'} size={24} color={colors.text} />
      </Pressable>
      <Text style={styles.topTitle}>
        {isNew ? (copyOf ? 'Duplicar actividad' : 'Nueva actividad') : editing ? 'Editar actividad' : 'Detalle'}
      </Text>
      {!editing ? (
          <View style={{ flexDirection: 'row' }}>
            <Pressable onPress={() => shareEvent(existing, date ? fromKey(date) : new Date(existing.start_at))} hitSlop={6} style={styles.iconBtn}>
              <Ionicons name="share-social-outline" size={22} color={colors.primary} />
            </Pressable>
            <Pressable onPress={() => router.replace({ pathname: '/event/[id]', params: { id: 'new', copyOf: id } })} hitSlop={6} style={styles.iconBtn}>
              <Ionicons name="copy-outline" size={21} color={colors.primary} />
            </Pressable>
            <Pressable onPress={onDelete} hitSlop={6} style={styles.iconBtn}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Pressable>
          </View>
      ) : <View style={styles.iconBtn} />}
    </View>
  );

  if (!editing) {
    const cat = CATEGORIES[form.category] || CATEGORIES.otro;
    const prio = PRIORITIES[form.priority] || PRIORITIES.media;
    // Si se abrió una repetición concreta, se muestra su fecha
    const when = new Date(form.start);
    if (date) {
      const d = fromKey(date);
      when.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    }
    const reminders = REMINDER_OPTIONS.filter((o) => form.reminders.includes(o.value)).map((o) => o.label);
    const nag = NAG_OPTIONS.find((o) => o.value === form.nag_every);
    const repeat = REPEAT_OPTIONS.find((o) => o.value === form.repeat);
    const noteLinks = splitLinks(form.description).filter((p) => p.url);

    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {topBar}
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130 }}>
          {date && (
            <Pressable onPress={onToggleDone} style={[styles.doneBanner, occDone && { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
              <Ionicons name={occDone ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={occDone ? colors.success : colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.doneTitle}>{occDone ? 'Realizada' : 'Marcar como realizada'}</Text>
                <Text style={styles.doneSub}>{relativeDay(fromKey(date))}{occDone ? ' · toca para desmarcar' : ' · detiene los avisos'}</Text>
              </View>
            </Pressable>
          )}

          <View style={styles.card}>
            <View style={styles.chips}>
              <View style={[styles.badge, { backgroundColor: cat.color }]}>
                <Ionicons name={cat.icon} size={14} color="#fff" />
                <Text style={styles.badgeText}>{cat.label}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: prio.soft }]}>
                <Ionicons name="flag" size={13} color={prio.color} />
                <Text style={[styles.badgeText, { color: prio.color }]}>Prioridad {prio.label.toLowerCase()}</Text>
              </View>
            </View>
            <Text style={styles.viewTitle} selectable>{form.title}</Text>
            <View style={styles.viewRow}>
              <Ionicons name="calendar-outline" size={19} color={colors.primary} />
              <Text style={styles.viewText}>
                {relativeDay(when)} · {formatShortDate(when)}
              </Text>
            </View>
            <View style={styles.viewRow}>
              <Ionicons name="time-outline" size={19} color={colors.primary} />
              <Text style={styles.viewText}>
                {form.all_day ? 'Todo el día' : `${formatTime(form.start)}${form.end ? ` – ${formatTime(form.end)}` : ''}`}
              </Text>
            </View>
            {form.repeat !== 'none' && (
              <View style={styles.viewRow}>
                <Ionicons name="repeat" size={19} color={colors.primary} />
                <Text style={styles.viewText}>{repeat?.label}</Text>
              </View>
            )}
          </View>

          {(!!form.location.trim() || !!form.phone.trim() || !!form.description.trim()) && (
            <View style={[styles.card, { marginTop: 14 }]}>
              {!!form.location.trim() && (
                <View style={styles.viewRow}>
                  <Ionicons name="location-outline" size={19} color={colors.muted} />
                  <Text style={[styles.viewText, { flex: 1 }]} selectable>{form.location}</Text>
                  <MiniBtn icon="map" label="Mapa" onPress={() => openMaps(form.location)} />
                </View>
              )}
              {!!form.phone.trim() && (
                <View style={styles.viewRow}>
                  <Ionicons name="call-outline" size={19} color={colors.muted} />
                  <Text style={[styles.viewText, { flex: 1 }]} selectable>{form.phone}</Text>
                  <MiniBtn icon="call" onPress={() => callPhone(form.phone)} />
                  <MiniBtn icon="logo-whatsapp" color="#16A34A" onPress={() => openWhatsApp(form.phone)} />
                </View>
              )}
              {!!form.description.trim() && (
                <View style={[styles.viewRow, { alignItems: 'flex-start' }]}>
                  <Ionicons name="document-text-outline" size={19} color={colors.muted} style={{ marginTop: 2 }} />
                  <Text style={[styles.viewText, { flex: 1, ...font(400) }]} selectable>
                    {splitLinks(form.description).map((p, i) => (p.url
                      ? <Text key={i} style={styles.inlineLink} onPress={() => open(p.url)} onLongPress={() => copy(p.url)}>{p.text}</Text>
                      : p.text))}
                  </Text>
                </View>
              )}
              {noteLinks.length > 0 && <Text style={[styles.hint, { marginTop: 4, marginBottom: 0 }]}>Toca un enlace para abrirlo; mantenlo presionado para copiarlo.</Text>}
            </View>
          )}

          {form.links.length > 0 && (
            <>
              <Text style={styles.label}>🔗 Enlaces</Text>
              <View style={styles.card}>
                {form.links.map((l, i) => (
                  <View key={i} style={[styles.linkRow, i > 0 && styles.rowBorder]}>
                    <Pressable onPress={() => open(l.url)} style={styles.linkMain}>
                      <View style={styles.linkIcon}><Ionicons name="globe-outline" size={18} color={colors.primary} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.linkTitle} numberOfLines={1}>{l.label || hostOf(l.url)}</Text>
                        <Text style={styles.linkUrl} numberOfLines={1}>{l.url}</Text>
                      </View>
                    </Pressable>
                    <MiniBtn icon="open-outline" label="Abrir" onPress={() => open(l.url)} />
                    <MiniBtn icon="copy-outline" onPress={() => copy(l.url)} />
                  </View>
                ))}
              </View>
            </>
          )}

          {form.checklist.length > 0 && (
            <>
              <Text style={styles.label}>☑️ Lista de pasos</Text>
              <View style={styles.card}>
                <Text style={styles.hint}>{form.checklist.filter((c) => c.done).length} de {form.checklist.length} pasos hechos · toca para marcar</Text>
                {form.checklist.map((c, i) => (
                  <Pressable key={i} onPress={() => toggleStep(i)} style={styles.stepRow}>
                    <View style={[styles.stepCheck, c.done && styles.stepCheckOn]}>
                      {c.done && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                    <Text style={[styles.stepText, c.done && styles.stepDone]}>{c.text}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <Text style={styles.label}>🔔 Avisos</Text>
          <View style={styles.card}>
            <View style={styles.viewRow}>
              <Ionicons name="notifications-outline" size={19} color={colors.primary} />
              <Text style={[styles.viewText, { flex: 1 }]}>{reminders.length ? reminders.join(' · ') : 'Sin recordatorios'}</Text>
            </View>
            <View style={styles.viewRow}>
              <Ionicons name="alarm-outline" size={19} color={colors.warning} />
              <Text style={[styles.viewText, { flex: 1 }]}>
                {form.nag_every ? `Insiste ${nag?.label.toLowerCase() || `cada ${form.nag_every} min`} hasta que la marques` : 'No insiste después de la hora'}
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={() => setEditing(true)} style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}>
            <Ionicons name="create-outline" size={20} color="#fff" />
            <Text style={styles.saveText}>Editar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {topBar}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
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
            <View style={styles.inlineRow}>
              <TextInput value={form.location} onChangeText={(t) => set({ location: t })} placeholder="Lugar (opcional)" placeholderTextColor={colors.faint} style={[styles.input, { flex: 1 }]} />
              {!!form.location.trim() && <MiniBtn icon="map" label="Mapa" onPress={() => openMaps(form.location)} />}
            </View>
          </Field>
          <Field icon="call-outline">
            <View style={styles.inlineRow}>
              <TextInput value={form.phone} onChangeText={(t) => set({ phone: t })} placeholder="Teléfono de contacto (opcional)" placeholderTextColor={colors.faint} style={[styles.input, { flex: 1 }]} keyboardType="phone-pad" />
              {form.phone.replace(/\D/g, '').length >= 6 && (
                <>
                  <MiniBtn icon="call" onPress={() => callPhone(form.phone)} />
                  <MiniBtn icon="logo-whatsapp" color="#16A34A" onPress={() => openWhatsApp(form.phone)} />
                </>
              )}
            </View>
          </Field>
          <Field icon="document-text-outline">
            <TextInput value={form.description} onChangeText={(t) => set({ description: t })} placeholder="Notas (opcional)" placeholderTextColor={colors.faint} style={[styles.input, { minHeight: 44 }]} multiline />
          </Field>
          {splitLinks(form.description).some((p) => p.url) && (
            <View style={[styles.chips, { marginTop: 6 }]}>
              {splitLinks(form.description).filter((p) => p.url).map((p, i) => (
                <Pressable key={i} onPress={() => open(p.url)} onLongPress={() => copy(p.url)} style={styles.noteLink}>
                  <Ionicons name="link" size={13} color={colors.primary} />
                  <Text style={styles.noteLinkText} numberOfLines={1}>{hostOf(p.url)}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <Text style={styles.label}>Fecha y hora</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <Ionicons name="sunny-outline" size={20} color={colors.primary} />
            <Text style={styles.switchLabel}>Todo el día</Text>
            <Switch value={form.all_day} onValueChange={(v) => set({ all_day: v })} trackColor={{ true: colors.primary }} thumbColor="#fff" />
          </View>
          <View style={[styles.chips, { marginTop: 4 }]}>
            {QUICK_DAYS.map((q) => (
              <Chip key={q.label} label={q.label} active={dayKey(q.day) === dayKey(form.start)} onPress={() => setDay(q.day)} />
            ))}
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

        <Text style={styles.label}>🔗 Enlaces</Text>
        <View style={styles.card}>
          {form.links.map((l, i) => (
            <View key={i} style={[styles.linkRow, i > 0 && styles.rowBorder]}>
              <Pressable onPress={() => open(l.url)} style={styles.linkMain}>
                <View style={styles.linkIcon}><Ionicons name="globe-outline" size={18} color={colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.linkTitle} numberOfLines={1}>{l.label || hostOf(l.url)}</Text>
                  <Text style={styles.linkUrl} numberOfLines={1}>{l.url}</Text>
                </View>
              </Pressable>
              <MiniBtn icon="open-outline" onPress={() => open(l.url)} />
              <MiniBtn icon="copy-outline" onPress={() => copy(l.url)} />
              <MiniBtn icon="close" color={colors.danger} onPress={() => set({ links: form.links.filter((_, j) => j !== i) })} />
            </View>
          ))}
          <View style={[styles.addBox, form.links.length > 0 && { marginTop: 12 }]}>
            <View style={styles.inlineRow}>
              <TextInput
                value={newLink.url}
                onChangeText={(t) => setNewLink((l) => ({ ...l, url: t }))}
                placeholder="Pega o escribe un enlace (https://…)"
                placeholderTextColor={colors.faint}
                style={[styles.input, { flex: 1 }]}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <MiniBtn icon="clipboard-outline" label="Pegar" onPress={pasteLink} />
            </View>
            {!!newLink.url.trim() && (
              <>
                <TextInput
                  value={newLink.label}
                  onChangeText={(t) => setNewLink((l) => ({ ...l, label: t }))}
                  placeholder="Nombre del enlace (opcional, ej. Bases SIS)"
                  placeholderTextColor={colors.faint}
                  style={styles.input}
                />
                <Pressable onPress={addLink} style={styles.addBtn}>
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.addBtnText}>Agregar enlace</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        <Text style={styles.label}>☑️ Lista de pasos</Text>
        <View style={styles.card}>
          {form.checklist.length > 0 && (
            <Text style={styles.hint}>{form.checklist.filter((c) => c.done).length} de {form.checklist.length} pasos hechos</Text>
          )}
          {form.checklist.map((c, i) => (
            <View key={i} style={styles.stepRow}>
              <Pressable onPress={() => toggleStep(i)} hitSlop={8} style={[styles.stepCheck, c.done && styles.stepCheckOn]}>
                {c.done && <Ionicons name="checkmark" size={16} color="#fff" />}
              </Pressable>
              <Text style={[styles.stepText, c.done && styles.stepDone]}>{c.text}</Text>
              <Pressable onPress={() => set({ checklist: form.checklist.filter((_, j) => j !== i) })} hitSlop={8}>
                <Ionicons name="close" size={18} color={colors.faint} />
              </Pressable>
            </View>
          ))}
          <View style={styles.inlineRow}>
            <TextInput
              value={newStep}
              onChangeText={setNewStep}
              placeholder="Agregar paso (ej. Escanear DNI)"
              placeholderTextColor={colors.faint}
              style={[styles.input, { flex: 1 }]}
              returnKeyType="done"
              onSubmitEditing={addStep}
              blurOnSubmit={false}
            />
            {!!newStep.trim() && <MiniBtn icon="add" label="Añadir" onPress={addStep} />}
          </View>
        </View>

        <Text style={styles.label}>🔔 Recordatorios</Text>
        <View style={styles.card}>
          <Text style={styles.hint}>Elige todos los avisos que quieras antes de la actividad.</Text>
          <Chips options={REMINDER_OPTIONS} isActive={(v) => form.reminders.includes(v)} onPress={toggleReminder} />
          <Text style={styles.subLabel}>Insistir hasta que la marque como realizada</Text>
          <Text style={styles.hint}>Después de la hora te seguirá avisando (de 7:00 a 22:00) hasta que toques ✅ Realizado.</Text>
          <Chips options={NAG_OPTIONS} isActive={(v) => form.nag_every === v} onPress={(v) => set({ nag_every: v })} color={colors.warning} />
        </View>

        <Text style={styles.label}>Tipo de actividad</Text>
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

function MiniBtn({ icon, label, onPress, color = colors.primary }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => [styles.miniBtn, label && { paddingHorizontal: 10 }, pressed && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={17} color={color} />
      {label && <Text style={[styles.miniBtnText, { color }]}>{label}</Text>}
    </Pressable>
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
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeText: { ...font(800), fontSize: 12, color: '#fff' },
  viewTitle: { fontSize: 24, ...font(800), color: colors.text, marginTop: 12, marginBottom: 6, lineHeight: 30 },
  viewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  viewText: { ...font(600), fontSize: 15, color: colors.text, lineHeight: 21 },
  inlineLink: { ...font(700), color: colors.primary, textDecorationLine: 'underline' },
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
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, minWidth: 36, paddingHorizontal: 8,
    borderRadius: 10, backgroundColor: colors.primarySoft, justifyContent: 'center',
  },
  miniBtnText: { ...font(700), fontSize: 13 },
  noteLink: {
    flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.primarySoft,
  },
  noteLinkText: { ...font(700), fontSize: 12, color: colors.primary },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  linkMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  linkTitle: { ...font(700), fontSize: 15, color: colors.text },
  linkUrl: { ...font(400), fontSize: 12, color: colors.primary, marginTop: 1 },
  addBox: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 12,
    backgroundColor: colors.primary, marginBottom: 10,
  },
  addBtnText: { ...font(800), fontSize: 14, color: '#fff' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  stepCheck: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepCheckOn: { backgroundColor: colors.success, borderColor: colors.success },
  stepText: { ...font(600), flex: 1, fontSize: 15, color: colors.text },
  stepDone: { textDecorationLine: 'line-through', color: colors.faint },
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
