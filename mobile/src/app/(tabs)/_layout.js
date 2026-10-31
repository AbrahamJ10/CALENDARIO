import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../../lib/theme';

const icon = (name) => ({ color, focused, size }) => (
  <Ionicons name={focused ? name : `${name}-outline`} size={size} color={color} />
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontSize: 11, ...font(700) },
        tabBarStyle: { borderTopWidth: 0, elevation: 16, shadowOpacity: 0.08, shadowRadius: 12, backgroundColor: colors.card },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Hoy', tabBarIcon: icon('today') }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendario', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="tasks" options={{ title: 'Agenda', tabBarIcon: icon('list') }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes', tabBarIcon: icon('settings') }} />
    </Tabs>
  );
}
