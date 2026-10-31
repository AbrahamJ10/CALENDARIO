import { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { Header } from '../../components/Header';
import { SectionTitle } from '../../components/ui';
import { notify } from '../../components/Toast';
import { api } from '../../lib/api';
import { requestPermission, scheduledCount, sendTest } from '../../lib/notifications';
import { useAgenda } from '../../lib/store';
import { colors, shadow, font } from '../../lib/theme';

export default function Settings() {
  const { refresh, events, error } = useAgenda();
  const [status, setStatus] = useState({ perm: null, exact: null, count: 0 });
  const [testing, setTesting] = useState(false);

  const loadStatus = useCallback(async () => {
    const perm = (await Notifications.getPermissionsAsync()).granted;
    let exact = null;
    if (Platform.OS === 'android' && Notifications.getExactAlarmPermissionsAsync) {
      exact = (await Notifications.getExactAlarmPermissionsAsync().catch(() => ({ granted: null }))).granted;
    }
    setStatus({ perm, exact, count: await scheduledCount() });
  }, []);

  useFocusEffect(useCallback(() => {
    loadStatus();
  }, [loadStatus]));

  const test = async () => {
    setTesting(true);
    try {
      await api.health();
      await refresh();
      notify('Conectado con la base de datos');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setTesting(false);
    }
  };

  const askPerm = async () => {
    if (!(await requestPermission())) Linking.openSettings();
    loadStatus();
  };

  const askExact = async () => {
    await Notifications.requestExactAlarmPermissionsAsync?.().catch(() => Linking.openSettings());
    loadStatus();
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Header overline="Agenda Pro" title="Ajustes" />
      <View style={styles.body}>
        <SectionTitle>Notificaciones</SectionTitle>
        <View style={styles.card}>
          <Row icon="notifications" label="Permiso de notificaciones" ok={status.perm} action={!status.perm ? ['Activar', askPerm] : null} />
          {Platform.OS === 'android' && (
            <Row icon="alarm" label="Alarmas exactas (avisos puntuales)" ok={status.exact} action={status.exact === false ? ['Permitir', askExact] : null} />
          )}
          <Row icon="time" label="Avisos programados" value={String(status.count)} />
          <Pressable style={styles.button} onPress={async () => { await sendTest(); notify('Llegará en 3 segundos'); setTimeout(loadStatus, 4000); }}>
            <Ionicons name="paper-plane" size={16} color="#fff" />
            <Text style={styles.buttonText}>Enviar notificación de prueba</Text>
          </Pressable>
        </View>
        <Text style={styles.help}>
          Cada actividad te avisa según los recordatorios que elijas (por ejemplo, un día antes y una hora antes). Si activas “Insistir”, te seguirá avisando durante el día (de 7:00 a 22:00) hasta que la marques como realizada, directamente desde la notificación con el botón ✅ Realizado.
        </Text>

        <SectionTitle>Base de datos</SectionTitle>
        <View style={styles.card}>
          <Row icon="cloud" label="Neon (PostgreSQL)" ok={error ? false : true} />
          <Row icon="albums" label="Actividades guardadas" value={String(events.length)} />
          <Pressable style={[styles.button, testing && { opacity: 0.6 }]} onPress={test} disabled={testing}>
            <Ionicons name="sync" size={16} color="#fff" />
            <Text style={styles.buttonText}>{testing ? 'Probando…' : 'Probar conexión y sincronizar'}</Text>
          </Pressable>
        </View>
        <Text style={styles.help}>Tus actividades se guardan en la nube y también en el celular, así puedes verlas aunque no tengas internet.</Text>
      </View>
    </ScrollView>
  );
}

function Row({ icon, label, ok, value, action }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={17} color={colors.primary} /></View>
      <Text style={styles.rowLabel}>{label}</Text>
      {action ? (
        <Pressable onPress={action[1]} style={styles.smallBtn}><Text style={styles.smallBtnText}>{action[0]}</Text></Pressable>
      ) : value != null ? (
        <Text style={styles.rowValue}>{value}</Text>
      ) : ok == null ? (
        <Text style={styles.rowValue}>—</Text>
      ) : (
        <Ionicons name={ok ? 'checkmark-circle' : 'close-circle'} size={22} color={ok ? colors.success : colors.danger} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16 },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 16, ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15, ...font(600), color: colors.text },
  rowValue: { fontSize: 15, ...font(800), color: colors.primary },
  smallBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  smallBtnText: { color: '#fff', ...font(800), fontSize: 12 },
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14,
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14,
  },
  buttonText: { color: '#fff', ...font(800), fontSize: 15 },
  label: { fontSize: 12, ...font(800), color: colors.muted, marginBottom: 6, marginTop: 6, textTransform: 'uppercase' },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    ...font(400), fontSize: 15, color: colors.text, marginBottom: 8, backgroundColor: colors.bg,
  },
  help: { ...font(400), fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 10, paddingHorizontal: 4 },
});
