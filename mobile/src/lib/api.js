import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'agenda.settings';

export const defaultSettings = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.5:3000',
  apiKey: process.env.EXPO_PUBLIC_API_KEY || '',
};

let settings = { ...defaultSettings };

export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) settings = { ...defaultSettings, ...JSON.parse(raw) };
  } catch {}
  return settings;
}

export async function saveSettings(next) {
  settings = { ...settings, ...next, apiUrl: (next.apiUrl ?? settings.apiUrl).trim().replace(/\/+$/, '') };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  return settings;
}

export const getSettings = () => settings;

async function request(path, { method = 'GET', body, timeout = 12000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${settings.apiUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-api-key': settings.apiKey },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  } catch (err) {
    if (err.name === 'AbortError' || err.message === 'Network request failed') {
      throw new Error('No hay conexión con el servidor');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  health: () => request('/health', { timeout: 6000 }),
  list: () => request('/events'),
  create: (e) => request('/events', { method: 'POST', body: e }),
  update: (id, e) => request(`/events/${id}`, { method: 'PUT', body: e }),
  remove: (id) => request(`/events/${id}`, { method: 'DELETE' }),
  toggle: (id, date) => request(`/events/${id}/toggle`, { method: 'POST', body: { date } }),
};
