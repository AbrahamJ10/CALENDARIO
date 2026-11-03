import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAgenda } from '../lib/store';
import { colors, font, gradient, shadow } from '../lib/theme';
import { notify } from './Toast';

const AVATAR_COLORS = ['#4F46E5', '#EC4899', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6'];
export const avatarColor = (key = '') => AVATAR_COLORS[[...key].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

export function Avatar({ profile, size = 44 }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(profile.key) }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>{profile.name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

/**
 * Elegir o crear usuario. Sin `onClose` es la bienvenida (primera vez);
 * con `onClose` es el selector que se abre desde Ajustes.
 */
export function Welcome({ onClose }) {
  const insets = useSafeAreaInsets();
  const { profiles, login, switchUser, forgetUser } = useAgenda();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const firstTime = profiles.list.length === 0;

  const done = (msg) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    notify(msg);
    onClose?.();
  };

  const create = async () => {
    if (!name.trim()) return notify('Escribe tu nombre', 'error');
    setBusy(true);
    try {
      await login(name);
      done(`Hola, ${name.trim()} 👋`);
    } catch (err) {
      notify(err.message, 'error');
      setBusy(false);
    }
  };

  const pick = async (p) => {
    await switchUser(p.key);
    done(`Agenda de ${p.name}`);
  };

  const forget = (p) => {
    Alert.alert(
      `Quitar a ${p.name}`,
      'Se quitará de este celular. Sus actividades NO se borran: si vuelve a escribir su nombre, las recupera.',
      [{ text: 'Cancelar', style: 'cancel' }, { text: 'Quitar', style: 'destructive', onPress: () => forgetUser(p.key) }],
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 24 }]}>
          <View style={styles.circle} />
          {onClose && (
            <Pressable onPress={onClose} hitSlop={10} style={[styles.close, { top: insets.top + 12 }]}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          )}
          <View style={styles.logo}>
            <Ionicons name="calendar" size={38} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>{firstTime ? 'Bienvenido a\nAgenda Pro' : '¿Quién está usando\nla agenda?'}</Text>
          <Text style={styles.heroSub}>
            {firstTime
              ? 'Cada persona tiene su propia agenda y sus propias alertas.'
              : 'Cada usuario ve solo sus actividades.'}
          </Text>
        </LinearGradient>

        <View style={styles.body}>
          {!firstTime && (
            <>
              <Text style={styles.label}>Usuarios en este celular</Text>
              <View style={styles.card}>
                {profiles.list.map((p, i) => {
                  const active = p.key === profiles.current;
                  return (
                    <Pressable
                      key={p.key}
                      onPress={() => pick(p)}
                      onLongPress={() => forget(p)}
                      style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { opacity: 0.7 }]}
                    >
                      <Avatar profile={p} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowName}>{p.name}</Text>
                        {active && <Text style={styles.rowActive}>Usando ahora</Text>}
                      </View>
                      {active
                        ? <Ionicons name="checkmark-circle" size={26} color={colors.success} />
                        : <Ionicons name="chevron-forward" size={20} color={colors.faint} />}
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.hint}>Mantén presionado un usuario para quitarlo de este celular.</Text>
            </>
          )}

          <Text style={styles.label}>{firstTime ? '¿Cómo te llamas?' : 'Agregar otro usuario'}</Text>
          <View style={styles.card}>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={20} color={colors.muted} />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Tu nombre"
                placeholderTextColor={colors.faint}
                style={styles.input}
                autoCapitalize="words"
                autoFocus={firstTime}
                returnKeyType="done"
                onSubmitEditing={create}
                maxLength={40}
              />
            </View>
            <Pressable onPress={create} disabled={busy} style={({ pressed }) => [styles.button, (pressed || busy) && { opacity: 0.8 }]}>
              <Text style={styles.buttonText}>{busy ? 'Entrando…' : firstTime ? 'Comenzar' : 'Entrar con este nombre'}</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </Pressable>
          </View>
          <Text style={styles.hint}>
            Tu nombre se guarda en este celular. Si ya usabas Agenda Pro en otro celular, escribe el mismo nombre y verás tu agenda.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 24, paddingBottom: 34, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden' },
  circle: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.08)', top: -90, right: -70 },
  close: { position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  logo: { width: 72, height: 72, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 20, ...shadow },
  heroTitle: { ...font(800), fontSize: 30, color: '#fff', marginTop: 22, lineHeight: 37 },
  heroSub: { ...font(400), fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: 10, lineHeight: 21 },
  body: { paddingHorizontal: 16 },
  label: { ...font(800), fontSize: 13, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 26, marginBottom: 10, marginLeft: 4 },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 16, ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowName: { ...font(700), fontSize: 17, color: colors.text },
  rowActive: { ...font(600), fontSize: 12, color: colors.success, marginTop: 2 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...font(800), color: '#fff' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: 14, paddingHorizontal: 14, backgroundColor: colors.bg,
  },
  input: { ...font(600), flex: 1, fontSize: 17, color: colors.text, paddingVertical: 14 },
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, height: 54,
    borderRadius: 16, backgroundColor: colors.primary,
  },
  buttonText: { ...font(800), fontSize: 16, color: '#fff' },
  hint: { ...font(400), fontSize: 12, color: colors.muted, marginTop: 10, marginHorizontal: 4, lineHeight: 17 },
});
