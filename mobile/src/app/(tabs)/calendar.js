import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Header } from '../../components/Header';
import { Empty, EventCard, Fab, SectionTitle } from '../../components/ui';
import { useAgenda } from '../../lib/store';
import { allOccurrences } from '../../lib/recurrence';
import { dayKey, formatLongDate, formatMonthYear, fromKey } from '../../lib/dates';
import { CATEGORIES, FONTS, colors, shadow } from '../../lib/theme';

LocaleConfig.locales.es = {
  monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  today: 'Hoy',
};
LocaleConfig.defaultLocale = 'es';

export default function CalendarScreen() {
  const { events, syncing, refresh } = useAgenda();
  const [selected, setSelected] = useState(dayKey(new Date()));
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const occ = useMemo(() => {
    const from = new Date(month.getFullYear(), month.getMonth() - 1, 20);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 12, 23, 59);
    return allOccurrences(events, from, to);
  }, [events, month]);

  const marked = useMemo(() => {
    const m = {};
    for (const o of occ) {
      const entry = (m[o.key] ||= { dots: [] });
      if (entry.dots.length < 4) {
        entry.dots.push({ key: o.id, color: o.done ? colors.faint : (CATEGORIES[o.event.category] || CATEGORIES.otro).color });
      }
    }
    m[selected] = { ...(m[selected] || { dots: [] }), selected: true, selectedColor: colors.primary };
    return m;
  }, [occ, selected]);

  const dayList = occ.filter((o) => o.key === selected);
  const monthPending = occ.filter((o) => !o.done && o.start.getMonth() === month.getMonth()).length;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={refresh} colors={[colors.primary]} />}
      >
        <Header overline={`${monthPending} pendientes este mes`} title={formatMonthYear(month)} />
        <View style={styles.calCard}>
          <Calendar
            current={dayKey(month)}
            markingType="multi-dot"
            markedDates={marked}
            firstDay={1}
            enableSwipeMonths
            onDayPress={(d) => setSelected(d.dateString)}
            onMonthChange={(d) => setMonth(new Date(d.year, d.month - 1, 1))}
            theme={{
              calendarBackground: 'transparent',
              textSectionTitleColor: colors.muted,
              dayTextColor: colors.text,
              todayTextColor: colors.primary,
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: '#fff',
              arrowColor: colors.primary,
              monthTextColor: colors.text,
              textMonthFontWeight: '800',
              textDayFontWeight: '600',
              textDayHeaderFontWeight: '700',
              textDisabledColor: '#C9CCE0',
              textDayFontFamily: FONTS[600],
              textMonthFontFamily: FONTS[800],
              textDayHeaderFontFamily: FONTS[700],
            }}
          />
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <SectionTitle>{formatLongDate(fromKey(selected))}</SectionTitle>
          {dayList.length ? (
            dayList.map((o) => <EventCard key={o.id} occ={o} />)
          ) : (
            <Empty title="Sin actividades" text="Toca + para agendar algo este día." />
          )}
        </View>
      </ScrollView>
      <Fab date={selected} />
    </View>
  );
}

const styles = StyleSheet.create({
  calCard: { backgroundColor: colors.card, marginHorizontal: 16, marginTop: -14, borderRadius: 22, padding: 8, ...shadow },
});
