import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { gradient, font } from '../lib/theme';
import { useAgenda } from '../lib/store';

export function Header({ overline, title, children }) {
  const insets = useSafeAreaInsets();
  const { error, syncing } = useAgenda();
  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.wrap, { paddingTop: insets.top + 14 }]}>
      <View style={styles.circle1} />
      <View style={styles.circle2} />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          {overline && <Text style={styles.overline}>{overline}</Text>}
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={[styles.status, error && { backgroundColor: 'rgba(239,68,68,0.9)' }]}>
          <Ionicons name={error ? 'cloud-offline' : syncing ? 'sync' : 'cloud-done'} size={14} color="#fff" />
          <Text style={styles.statusText}>{error ? 'Sin conexión' : syncing ? 'Sincronizando' : 'Al día'}</Text>
        </View>
      </View>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  circle1: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.08)', top: -80, right: -60 },
  circle2: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.06)', bottom: -60, left: -30 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  overline: { color: 'rgba(255,255,255,0.75)', fontSize: 14, ...font(600) },
  title: { color: '#fff', fontSize: 24, ...font(800), marginTop: 2 },
  status: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
  },
  statusText: { color: '#fff', fontSize: 11, ...font(700) },
});
