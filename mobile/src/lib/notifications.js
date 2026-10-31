import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { allOccurrences } from './recurrence';
import { addDays, formatTime, relativeDay, reminderLabel } from './dates';

export const CHANNEL_ID = 'recordatorios';
export const CATEGORY_ID = 'agenda-recordatorio';
export const ACTION_DONE = 'done';
export const ACTION_SNOOZE = 'snooze';

// Las insistencias solo suenan en este horario para no despertarte de madrugada
const NAG_FROM_HOUR = 7;
const NAG_TO_HOUR = 22;
// Cuántos días seguir insistiendo con algo pendiente
const NAG_DAYS = 3;
const HORIZON_DAYS = 21;
// iOS permite 64 notificaciones programadas; Android ~500 alarmas por app
const MAX_SCHEDULED = Platform.OS === 'ios' ? 60 : 300;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Recordatorios de agenda',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 200, 300],
      lightColor: '#4F46E5',
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    { identifier: ACTION_DONE, buttonTitle: '✅ Realizado', options: { opensAppToForeground: true } },
    { identifier: ACTION_SNOOZE, buttonTitle: '⏰ Recordar en 10 min', options: { opensAppToForeground: false } },
  ]);
  return requestPermission();
}

export async function requestPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: true },
  });
  return asked.granted;
}

function content(occ, title, body) {
  return {
    title,
    body,
    sound: 'default',
    priority: Notifications.AndroidNotificationPriority.MAX,
    categoryIdentifier: CATEGORY_ID,
    data: { eventId: occ.event.id, date: occ.key },
  };
}

/** Calcula todos los avisos futuros de las tareas pendientes. */
export function planReminders(events, now = new Date()) {
  const from = addDays(now, -NAG_DAYS);
  const to = addDays(now, HORIZON_DAYS);
  const plan = [];

  for (const occ of allOccurrences(events, from, to)) {
    if (occ.done) continue;
    const { event, start } = occ;
    const when = event.all_day ? relativeDay(start) : `${relativeDay(start)} a las ${formatTime(start)}`;
    const place = event.location ? ` · 📍 ${event.location}` : '';

    for (const min of event.reminders || []) {
      const at = new Date(start.getTime() - min * 60000);
      if (at <= now) continue;
      const title = min === 0 ? `🔔 ${event.title}` : `⏳ ${reminderLabel(min)}: ${event.title}`;
      plan.push({ at, content: content(occ, title, `${when}${place}`) });
    }

    const every = event.nag_every || 0;
    if (every > 0) {
      const limit = start.getTime() + NAG_DAYS * 86400000;
      for (let t = start.getTime() + every * 60000; t <= limit; t += every * 60000) {
        const at = new Date(t);
        if (at <= now) continue;
        const h = at.getHours();
        if (h < NAG_FROM_HOUR || h >= NAG_TO_HOUR) continue;
        plan.push({
          at,
          content: content(occ, `⚠️ Pendiente: ${event.title}`, `Era para ${when.toLowerCase()}. ¿Ya lo realizaste? Márcalo como realizado.`),
        });
      }
    }
  }

  return plan.sort((a, b) => a.at - b.at).slice(0, MAX_SCHEDULED);
}

const SNOOZE_KEY = 'agenda.snoozes';

async function pendingSnoozes(events) {
  try {
    const now = Date.now();
    const list = JSON.parse((await AsyncStorage.getItem(SNOOZE_KEY)) || '[]').filter((s) => {
      const ev = events.find((e) => e.id === s.content.data?.eventId);
      return s.at > now && ev && !ev.done_dates?.includes(s.content.data.date);
    });
    await AsyncStorage.setItem(SNOOZE_KEY, JSON.stringify(list));
    return list.map((s) => ({ at: new Date(s.at), content: s.content }));
  } catch {
    return [];
  }
}

let scheduling = Promise.resolve();

/** Borra y vuelve a programar todos los avisos. Se llama tras cualquier cambio. */
export function rescheduleAll(events) {
  scheduling = scheduling.then(async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const plan = [...(await pendingSnoozes(events)), ...planReminders(events)]
      .sort((a, b) => a.at - b.at)
      .slice(0, MAX_SCHEDULED);
    for (const item of plan) {
      await Notifications.scheduleNotificationAsync({
        content: item.content,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.at, channelId: CHANNEL_ID },
      });
    }
    return plan.length;
  }).catch((err) => {
    console.warn('No se pudieron programar los avisos', err);
    return 0;
  });
  return scheduling;
}

export async function snooze(notification, minutes = 10) {
  const { title, body, data } = notification.request.content;
  const item = {
    at: Date.now() + minutes * 60000,
    content: { title, body, data, sound: 'default', categoryIdentifier: CATEGORY_ID, priority: Notifications.AndroidNotificationPriority.MAX },
  };
  const list = JSON.parse((await AsyncStorage.getItem(SNOOZE_KEY).catch(() => null)) || '[]');
  await AsyncStorage.setItem(SNOOZE_KEY, JSON.stringify([...list, item]));
  await Notifications.scheduleNotificationAsync({
    content: item.content,
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(item.at), channelId: CHANNEL_ID },
  });
}

export async function sendTest() {
  await Notifications.scheduleNotificationAsync({
    content: { title: '🔔 Agenda Pro', body: 'Las notificaciones funcionan correctamente.', sound: 'default' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: CHANNEL_ID },
  });
}

export const scheduledCount = async () => (await Notifications.getAllScheduledNotificationsAsync()).length;
