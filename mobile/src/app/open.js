import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAgenda } from '../lib/store';
import { colors, font } from '../lib/theme';

// Se abre con agendapro://open?eventId=...&date=... desde el botón "Ver detalles" de la alerta tipo llamada
export default function Open() {
  const { eventId, date } = useLocalSearchParams();
  const { ready } = useAgenda();
  const started = useRef(false);

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    // Primero la pantalla de inicio, para que "atrás" desde el detalle vuelva a la agenda
    router.replace('/');
    if (eventId) {
      setTimeout(() => router.push({ pathname: '/event/[id]', params: { id: String(eventId), date: date ? String(date) : undefined } }), 50);
    }
  }, [ready, eventId, date]);

  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>Abriendo actividad…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: 14 },
  text: { ...font(700), fontSize: 16, color: colors.text },
});
