import { useEffect, useRef } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Inter_900Black,
} from '@expo-google-fonts/inter';
import { AgendaProvider, useAgenda } from '../lib/store';
import { ACTION_DONE, ACTION_SNOOZE, setupNotifications, snooze } from '../lib/notifications';
import { ToastHost, notify } from '../components/Toast';
import { colors } from '../lib/theme';

function NotificationResponses() {
  const { markDone, ready } = useAgenda();
  const handled = useRef(new Set());

  useEffect(() => {
    if (!ready) return;
    const handle = async (response) => {
      if (!response) return;
      const id = `${response.notification.request.identifier}:${response.actionIdentifier}`;
      if (handled.current.has(id)) return;
      handled.current.add(id);
      const { eventId, date } = response.notification.request.content.data || {};

      if (response.actionIdentifier === ACTION_SNOOZE) {
        await snooze(response.notification, 10);
      } else if (response.actionIdentifier === ACTION_DONE && eventId) {
        try {
          await markDone(eventId, date);
          notify('¡Marcado como realizado!');
        } catch (err) {
          notify(err.message, 'error');
        }
      } else if (eventId) {
        router.push({ pathname: '/event/[id]', params: { id: eventId, date } });
      }
      Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});
    };

    Notifications.getLastNotificationResponseAsync().then(handle);
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [ready, markDone]);

  return null;
}

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Inter_900Black,
  });

  useEffect(() => {
    setupNotifications().catch(() => {});
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <AgendaProvider>
      <StatusBar style="light" />
      <NotificationResponses />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="event/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      <ToastHost />
    </AgendaProvider>
  );
}
