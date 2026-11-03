import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Header } from '../../components/Header';
import { Empty, EventCard, Fab, SectionTitle } from '../../components/ui';
import { useAgenda } from '../../lib/store';
import { allOccurrences } from '../../lib/recurrence';
import { addDays, formatLongDate, greeting, relativeDay, sameDay, startOfDay } from '../../lib/dates';
import { colors, font } from '../../lib/theme';

export default function Today() {
  const { events, syncing, refresh, error, user } = useAgenda();
  const now = new Date();
  const today = startOfDay(now);

  const { overdue, todayList, tomorrow, upcoming } = useMemo(() => {
    const occ = allOccurrences(events, addDays(today, -30), addDays(today, 8));
    const tomorrowDate = addDays(today, 1);
    return {
      overdue: occ.filter((o) => !o.done && o.start < today),
      todayList: occ.filter((o) => sameDay(o.start, today)),
      tomorrow: occ.filter((o) => sameDay(o.start, tomorrowDate)),
      upcoming: occ.filter((o) => o.start >= addDays(today, 2)).slice(0, 8),
    };
  }, [events, today.getTime()]);

  const done = todayList.filter((o) => o.done).length;
  const pct = todayList.length ? done / todayList.length : 0;
  const nextOne = todayList.find((o) => !o.done && o.start >= now);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={refresh} colors={[colors.primary]} />}
      >
        <Header overline={`${greeting()}, ${user?.name ?? ''} 👋`} title={formatLongDate(now)}>
          <View style={styles.progressCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.progressTitle}>
                {todayList.length === 0 ? 'Día libre' : `${done} de ${todayList.length} realizadas`}
              </Text>
              <Text style={styles.progressSub} numberOfLines={1}>
                {nextOne ? `Siguiente: ${nextOne.event.title}` : todayList.length ? (done === todayList.length ? '¡Todo listo por hoy! 🎉' : 'Tienes pendientes por marcar') : 'No hay nada agendado hoy'}
              </Text>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
              </View>
            </View>
            <View style={styles.pctCircle}>
              <Text style={styles.pctText}>{Math.round(pct * 100)}%</Text>
            </View>
          </View>
        </Header>

        <View style={styles.body}>
          {error && events.length === 0 && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>No se pudo conectar. Revisa tu conexión a internet y desliza hacia abajo para reintentar.</Text>
            </View>
          )}

          {overdue.length > 0 && (
            <>
              <SectionTitle right={<Text style={styles.badgeDanger}>{overdue.length}</Text>}>⚠️ Pendientes atrasadas</SectionTitle>
              {overdue.map((o) => <EventCard key={o.id} occ={o} showDate dateLabel={relativeDay(o.start)} />)}
            </>
          )}

          <SectionTitle>Hoy</SectionTitle>
          {todayList.length ? (
            todayList.map((o) => <EventCard key={o.id} occ={o} />)
          ) : (
            <Empty icon="sunny-outline" title="Nada para hoy" text="Toca el botón + para agendar una actividad, cita o pago." />
          )}

          {tomorrow.length > 0 && (
            <>
              <SectionTitle>Mañana</SectionTitle>
              {tomorrow.map((o) => <EventCard key={o.id} occ={o} />)}
            </>
          )}

          {upcoming.length > 0 && (
            <>
              <SectionTitle>Próximos días</SectionTitle>
              {upcoming.map((o) => <EventCard key={o.id} occ={o} showDate dateLabel={relativeDay(o.start)} />)}
            </>
          )}
        </View>
      </ScrollView>
      <Fab />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16 },
  progressCard: {
    flexDirection: 'row', alignItems: 'center', marginTop: 18, padding: 16, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  progressTitle: { color: '#fff', fontSize: 17, ...font(800) },
  progressSub: { color: 'rgba(255,255,255,0.85)', ...font(400), fontSize: 13, marginTop: 3 },
  bar: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 12, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: '#fff' },
  pctCircle: {
    width: 58, height: 58, borderRadius: 29, marginLeft: 14, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  pctText: { color: colors.primary, ...font(900), fontSize: 16 },
  badgeDanger: {
    backgroundColor: colors.danger, color: '#fff', ...font(800), fontSize: 12,
    paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999, overflow: 'hidden',
  },
  errorBox: { backgroundColor: colors.dangerSoft, padding: 14, borderRadius: 14, marginTop: 16 },
  errorText: { color: colors.danger, ...font(600) },
});
