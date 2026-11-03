import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setOwner } from './api';
import { rescheduleAll } from './notifications';
import { addProfile, forgetProfile, loadProfiles, switchProfile } from './profile';

// Cada usuario tiene su propia copia local de la agenda
const cacheKey = (owner) => `agenda.events.${owner}`;
const Ctx = createContext(null);

export function AgendaProvider({ children }) {
  const [events, setEvents] = useState([]);
  const [profiles, setProfiles] = useState({ current: null, list: [] });
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const eventsRef = useRef(events);
  const ownerRef = useRef(null);

  const commit = useCallback((next) => {
    eventsRef.current = next;
    setEvents(next);
    if (ownerRef.current) AsyncStorage.setItem(cacheKey(ownerRef.current), JSON.stringify(next)).catch(() => {});
    rescheduleAll(next);
  }, []);

  const refresh = useCallback(async () => {
    if (!ownerRef.current) return;
    const owner = ownerRef.current;
    setSyncing(true);
    try {
      const list = await api.list();
      // Si mientras tanto se cambió de usuario, se descarta la respuesta
      if (ownerRef.current === owner) commit(list);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }, [commit]);

  /** Activa un usuario: carga su copia local al instante y luego sincroniza con la nube. */
  const activate = useCallback(async (data) => {
    setProfiles(data);
    ownerRef.current = data.current;
    setOwner(data.current);
    let cached = [];
    if (data.current) {
      try {
        cached = JSON.parse((await AsyncStorage.getItem(cacheKey(data.current))) || '[]');
      } catch {}
    }
    commit(cached);
    setError(null);
    refresh();
  }, [commit, refresh]);

  useEffect(() => {
    (async () => {
      await activate(await loadProfiles());
      setReady(true);
    })();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [activate, refresh]);

  const upsertLocal = (saved) => {
    const list = eventsRef.current;
    const exists = list.some((e) => e.id === saved.id);
    commit(exists ? list.map((e) => (e.id === saved.id ? saved : e)) : [...list, saved]);
    return saved;
  };

  const value = {
    events,
    ready,
    syncing,
    error,
    refresh,
    profiles,
    user: profiles.list.find((p) => p.key === profiles.current) || null,
    login: async (name) => activate(await addProfile(name)),
    switchUser: async (key) => activate(await switchProfile(key)),
    forgetUser: async (key) => activate(await forgetProfile(key)),
    getEvent: (id) => eventsRef.current.find((e) => e.id === id),
    save: async (data, id) => upsertLocal(id ? await api.update(id, data) : await api.create(data)),
    remove: async (id) => {
      await api.remove(id);
      commit(eventsRef.current.filter((e) => e.id !== id));
    },
    toggleDone: async (id, date) => upsertLocal(await api.toggle(id, date)),
    markDone: async (id, date) => upsertLocal(await api.setDone(id, date)),
    setChecklist: async (id, checklist) => upsertLocal(await api.setChecklist(id, checklist)),
    reschedule: () => rescheduleAll(eventsRef.current),
  };

  return createElement(Ctx.Provider, { value }, children);
}

export const useAgenda = () => useContext(Ctx);
