import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font } from '../lib/theme';

let show = () => {};

/** Muestra un aviso breve en pantalla. type: 'ok' | 'error' */
export const notify = (message, type = 'ok') => show(message, type);

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef();

  useEffect(() => {
    show = (message, type) => {
      clearTimeout(timer.current);
      setMsg({ message, type });
      Animated.spring(anim, { toValue: 1, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMsg(null));
      }, 2600);
    };
    return () => clearTimeout(timer.current);
  }, [anim]);

  if (!msg) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        { top: insets.top + 10, backgroundColor: msg.type === 'error' ? colors.danger : colors.text },
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }] },
      ]}
    >
      <Text style={styles.text}>{msg.type === 'error' ? '⚠️ ' : '✓ '}{msg.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', left: 16, right: 16, zIndex: 999,
    paddingVertical: 14, paddingHorizontal: 18, borderRadius: 16,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 10,
  },
  text: { color: '#fff', ...font(700), fontSize: 14 },
});
