import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { rescheduleAll } from './notifications';

const CACHE_KEY = 'agenda.events';
const Ctx = createContext(null);

export function AgendaProvider({ children }) {
  const [events, setEvents] = useState([]);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const eventsRef = useRef(events);

  const commit = useCallback((next) => {
    eventsRef.current = next;
    setEvents(next);
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next)).catch(() => {});
    rescheduleAll(next);
  }, []);

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      commit(await api.list());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }, [commit]);

  useEffect(() => {
    (async () => {
      try {
        const cached = JSON.parse((await AsyncStorage.getItem(CACHE_KEY)) || '[]');
        eventsRef.current = cached;
        setEvents(cached);
      } catch {}
      setReady(true);
      refresh();
    })();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

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
    getEvent: (id) => eventsRef.current.find((e) => e.id === id),
    save: async (data, id) => upsertLocal(id ? await api.update(id, data) : await api.create(data)),
    remove: async (id) => {
      await api.remove(id);
      commit(eventsRef.current.filter((e) => e.id !== id));
    },
    toggleDone: async (id, date) => upsertLocal(await api.toggle(id, date)),
    markDone: async (id, date) => upsertLocal(await api.setDone(id, date)),
    reschedule: () => rescheduleAll(eventsRef.current),
  };

  return createElement(Ctx.Provider, { value }, children);
}

export const useAgenda = () => useContext(Ctx);
