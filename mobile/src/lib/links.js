import { Linking, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { formatShortDate, formatTime } from './dates';

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"']+)/gi;

/** "sis.gob.pe/convocatoria" → "https://sis.gob.pe/convocatoria". Devuelve '' si no parece un enlace. */
export function normalizeUrl(raw) {
  const url = String(raw || '').trim();
  if (!url || /\s/.test(url)) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  if (!/\.[a-z]{2,}/i.test(url)) return '';
  return `https://${url}`;
}

export function hostOf(url) {
  return url.replace(/^[a-z]+:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0];
}

/** Separa un texto en trozos de texto normal y enlaces, para mostrarlos tocables. */
export function splitLinks(text) {
  const parts = [];
  let last = 0;
  for (const m of String(text || '').matchAll(URL_RE)) {
    // Quita puntuación final pegada al enlace ("…pe/convocatoria.")
    const url = m[1].replace(/[.,;:!?)\]]+$/, '');
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ text: url, url: normalizeUrl(url) });
    last = m.index + url.length;
  }
  if (last < String(text || '').length) parts.push({ text: text.slice(last) });
  return parts;
}

export async function openUrl(url) {
  try {
    await Linking.openURL(normalizeUrl(url) || url);
    return true;
  } catch {
    return false;
  }
}

export const copyText = (text) => Clipboard.setStringAsync(text);

export const openMaps = (place) =>
  openUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`);

export const callPhone = (phone) => openUrl(`tel:${phone.replace(/\s/g, '')}`);

/** WhatsApp necesita el número con código de país; si tiene 9 dígitos se asume Perú (+51). */
export function openWhatsApp(phone) {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 9) digits = `51${digits}`;
  return openUrl(`https://wa.me/${digits}`);
}

export function shareEvent(event, start) {
  const lines = [`📌 ${event.title}`];
  lines.push(`🗓 ${formatShortDate(start)}${event.all_day ? ' (todo el día)' : ` a las ${formatTime(start)}`}`);
  if (event.location) lines.push(`📍 ${event.location}`);
  if (event.phone) lines.push(`📞 ${event.phone}`);
  if (event.description) lines.push('', event.description);
  if (event.checklist?.length) {
    lines.push('', 'Pasos:');
    event.checklist.forEach((c) => lines.push(`${c.done ? '✅' : '⬜'} ${c.text}`));
  }
  if (event.links?.length) {
    lines.push('', 'Enlaces:');
    event.links.forEach((l) => lines.push(l.label ? `🔗 ${l.label}: ${l.url}` : `🔗 ${l.url}`));
  }
  return Share.share({ message: lines.join('\n') });
}
