import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAgenda } from '../lib/store';
import { notify } from '../components/Toast';
import { colors, font } from '../lib/theme';

// Se abre con agendapro://done?eventId=...&date=... desde el botón "Ya lo realicé" de la alerta tipo llamada
export default function Done() {
  const { eventId, date } = useLocalSearchParams();
  const { markDone, ready } = useAgenda();
  const started = useRef(false);

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    (async () => {
      if (eventId && date) {
        try {
          await markDone(String(eventId), String(date));
          notify('¡Realizado! Ya no te avisaremos');
        } catch (err) {
          notify(err.message, 'error');
        }
      }
      router.replace('/');
    })();
  }, [ready, eventId, date, markDone]);

  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>Marcando como realizado…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: 14 },
  text: { ...font(700), fontSize: 16, color: colors.text },
});
