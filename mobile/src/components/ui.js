import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { CATEGORIES, PRIORITIES, colors, shadow, font } from '../lib/theme';
import { formatTime } from '../lib/dates';
import { useAgenda } from '../lib/store';
import { notify } from './Toast';

export function EventCard({ occ, showDate = false, dateLabel }) {
  const { toggleDone } = useAgenda();
  const { event, start, end, done } = occ;
  const cat = CATEGORIES[event.category] || CATEGORIES.otro;
  const pri = PRIORITIES[event.priority] || PRIORITIES.media;
  const overdue = !done && start < new Date() && !(end && end > new Date());

  const onToggle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await toggleDone(event.id, occ.key);
      if (!done) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id, date: occ.key } })}
      style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.985 }] }]}
    >
      <View style={[styles.stripe, { backgroundColor: cat.color }]} />
      <View style={styles.time}>
        <Text style={[styles.timeText, done && styles.doneText]}>{event.all_day ? 'Todo' : formatTime(start)}</Text>
        <Text style={styles.timeSub}>{event.all_day ? 'el día' : end ? formatTime(end) : ''}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[styles.title, done && styles.doneText]}>{event.title}</Text>
        <View style={styles.metaRow}>
          <View style={[styles.badge, { backgroundColor: cat.color + '18' }]}>
            <Ionicons name={cat.icon} size={11} color={cat.color} />
            <Text style={[styles.badgeText, { color: cat.color }]}>{cat.label}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: pri.soft }]}>
            <Text style={[styles.badgeText, { color: pri.color }]}>● {pri.label}</Text>
          </View>
          {event.repeat !== 'none' && <Ionicons name="repeat" size={13} color={colors.faint} />}
          {overdue && <Text style={styles.overdue}>Vencida</Text>}
        </View>
        {(showDate || !!event.location) && (
          <Text numberOfLines={1} style={styles.sub}>
            {showDate ? dateLabel : ''}
            {showDate && event.location ? ' · ' : ''}
            {event.location ? `📍 ${event.location}` : ''}
          </Text>
        )}
      </View>
      <Pressable onPress={onToggle} hitSlop={12} style={[styles.check, done && styles.checkOn]}>
        {done && <Ionicons name="checkmark" size={18} color="#fff" />}
      </Pressable>
    </Pressable>
  );
}

export function Chip({ label, active, onPress, color = colors.primary, icon }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
    >
      {icon && <Ionicons name={icon} size={14} color={active ? '#fff' : color} />}
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Fab({ date }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        router.push({ pathname: '/event/[id]', params: { id: 'new', ...(date ? { date } : {}) } });
      }}
      style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
    >
      <Ionicons name="add" size={30} color="#fff" />
    </Pressable>
  );
}

export function Empty({ icon = 'calendar-clear-outline', title, text }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={34} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {text && <Text style={styles.emptyText}>{text}</Text>}
    </View>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{children}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 18,
    paddingVertical: 14,
    paddingRight: 14,
    marginBottom: 10,
    overflow: 'hidden',
    ...shadow,
  },
  stripe: { width: 5, alignSelf: 'stretch', borderRadius: 3, marginRight: 12, marginLeft: 0 },
  time: { width: 50, alignItems: 'flex-start' },
  timeText: { fontSize: 15, ...font(800), color: colors.text },
  timeSub: { ...font(400), fontSize: 11, color: colors.faint, marginTop: 2 },
  title: { fontSize: 16, ...font(700), color: colors.text },
  doneText: { textDecorationLine: 'line-through', color: colors.faint },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, ...font(700) },
  overdue: { fontSize: 11, ...font(800), color: colors.danger },
  sub: { ...font(400), fontSize: 12, color: colors.muted, marginTop: 6 },
  check: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginLeft: 10,
  },
  checkOn: { backgroundColor: colors.success, borderColor: colors.success },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card,
  },
  chipText: { fontSize: 13, ...font(700), color: colors.text },
  fab: {
    position: 'absolute', right: 20, bottom: 20, width: 62, height: 62, borderRadius: 31,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, ...font(800), color: colors.text, textAlign: 'center' },
  emptyText: { ...font(400), fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 10 },
  section: { fontSize: 13, ...font(800), color: colors.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
});
