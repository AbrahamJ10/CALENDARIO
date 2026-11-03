import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILES_KEY = 'agenda.profiles';

/** Clave del dueño en la base de datos: "  Melanie  " y "melanie" son la misma agenda. */
export const ownerKey = (name) => name.trim().replace(/\s+/g, ' ').toLowerCase();

const cleanName = (name) => {
  const n = name.trim().replace(/\s+/g, ' ');
  return n.charAt(0).toUpperCase() + n.slice(1);
};

/** { current: 'abraham' | null, list: [{ key, name }] } guardado solo en este celular. */
export async function loadProfiles() {
  try {
    const data = JSON.parse((await AsyncStorage.getItem(PROFILES_KEY)) || 'null');
    if (data && Array.isArray(data.list)) return data;
  } catch {}
  return { current: null, list: [] };
}

async function saveProfiles(data) {
  await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(data));
  return data;
}

export async function addProfile(name) {
  const display = cleanName(name);
  const key = ownerKey(display);
  if (!key) throw new Error('Escribe tu nombre');
  const data = await loadProfiles();
  const list = data.list.some((p) => p.key === key) ? data.list : [...data.list, { key, name: display }];
  return saveProfiles({ current: key, list });
}

export async function switchProfile(key) {
  const data = await loadProfiles();
  if (!data.list.some((p) => p.key === key)) throw new Error('Ese usuario no está en este celular');
  return saveProfiles({ ...data, current: key });
}

/** Quita el usuario de este celular. Sus actividades siguen guardadas en la base de datos. */
export async function forgetProfile(key) {
  const data = await loadProfiles();
  const list = data.list.filter((p) => p.key !== key);
  return saveProfiles({ current: data.current === key ? list[0]?.key ?? null : data.current, list });
}
