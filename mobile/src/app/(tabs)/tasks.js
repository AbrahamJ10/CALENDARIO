import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { Chip, Empty, EventCard, Fab, SectionTitle } from '../../components/ui';
import { useAgenda } from '../../lib/store';
import { allOccurrences } from '../../lib/recurrence';
import { addDays, relativeDay, startOfDay } from '../../lib/dates';
import { CATEGORIES, colors, shadow, font } from '../../lib/theme';

const FILTERS = [
  { key: 'pending', label: 'Pendientes', icon: 'ellipse-outline' },
  { key: 'all', label: 'Todas', icon: 'albums-outline' },
  { key: 'high', label: 'Prioridad alta', icon: 'flag-outline' },
  { key: 'done', label: 'Realizadas', icon: 'checkmark-done' },
];

export default function Tasks() {
  const { events, syncing, refresh } = useAgenda();
  const [filter, setFilter] = useState('pending');
  const [type, setType] = useState(null);
  const [q, setQ] = useState('');

  const groups = useMemo(() => {
    const today = startOfDay(new Date());
    const term = q.trim().toLowerCase();
    const list = allOccurrences(events, addDays(today, filter === 'done' ? -60 : -30), addDays(today, 60)).filter((o) => {
      if (filter === 'pending' && o.done) return false;
      if (filter === 'done' && !o.done) return false;
      if (filter === 'high' && (o.event.priority !== 'alta' || o.done)) return false;
      if (filter === 'all' && o.start < today && o.done) return false;
      if (type && o.event.category !== type) return false;
      if (term) return `${o.event.title} ${o.event.description} ${o.event.location} ${o.event.phone || ''} ${(o.event.links || []).map((l) => l.label + ' ' + l.url).join(' ')} ${(o.event.checklist || []).map((x) => x.text).join(' ')}`.toLowerCase().includes(term);
      return true;
    });
    if (filter === 'done') list.reverse();
    const out = [];
    for (const o of list) {
      const label = o.start < today ? (filter === 'done' ? relativeDay(o.start) : 'Atrasadas') : relativeDay(o.start);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(o);
      else out.push({ label, items: [o] });
    }
    return out;
  }, [events, filter, q, type]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={refresh} colors={[colors.primary]} />}
      >
        <Header overline="Próximos 60 días" title="Mi agenda">
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Buscar actividad, lugar…"
              placeholderTextColor={colors.faint}
              style={styles.searchInput}
            />
            {!!q && <Ionicons name="close-circle" size={18} color={colors.faint} onPress={() => setQ('')} />}
          </View>
        </Header>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} icon={f.icon} active={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filters, { paddingTop: 10 }]}>
          <Chip label="Todos los tipos" icon="apps" active={!type} onPress={() => setType(null)} color={colors.text} />
          {Object.entries(CATEGORIES)
            .filter(([k]) => events.some((e) => e.category === k))
            .map(([k, c]) => (
              <Chip key={k} label={c.label} icon={c.icon} color={c.color} active={type === k} onPress={() => setType(type === k ? null : k)} />
            ))}
        </ScrollView>
        <View style={{ paddingHorizontal: 16 }}>
          {groups.length ? (
            groups.map((g) => (
              <View key={g.label}>
                <SectionTitle>{g.label}</SectionTitle>
                {g.items.map((o) => <EventCard key={o.id} occ={o} showDate={g.label === 'Atrasadas'} dateLabel={relativeDay(o.start)} />)}
              </View>
            ))
          ) : (
            <Empty icon="checkmark-done-circle-outline" title={q ? 'Sin resultados' : '¡Nada por aquí!'} text={q ? 'Prueba con otra palabra.' : 'No hay actividades con este filtro.'} />
          )}
        </View>
      </ScrollView>
      <Fab />
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16,
    backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 14, height: 48, ...shadow,
  },
  searchInput: { flex: 1, ...font(400), fontSize: 15, color: colors.text },
  filters: { paddingHorizontal: 16, gap: 8, paddingTop: 16 },
});
