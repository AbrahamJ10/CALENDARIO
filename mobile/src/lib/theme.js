export const colors = {
  bg: '#F3F4FA',
  card: '#FFFFFF',
  text: '#151834',
  muted: '#6B7091',
  faint: '#A3A7C2',
  border: '#E6E8F2',
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  primarySoft: '#EEF0FF',
  accent: '#8B5CF6',
  success: '#10B981',
  successSoft: '#E7F8F1',
  danger: '#EF4444',
  dangerSoft: '#FDECEC',
  warning: '#F59E0B',
};

export const gradient = ['#4F46E5', '#7C3AED'];

export const CATEGORIES = {
  trabajo: { label: 'Trabajo', icon: 'briefcase', color: '#4F46E5' },
  reunion: { label: 'Reunión', icon: 'people', color: '#0EA5E9' },
  personal: { label: 'Personal', icon: 'person', color: '#8B5CF6' },
  salud: { label: 'Salud', icon: 'medkit', color: '#10B981' },
  pago: { label: 'Pagos', icon: 'card', color: '#F59E0B' },
  estudio: { label: 'Estudio', icon: 'school', color: '#EC4899' },
  otro: { label: 'Otro', icon: 'ellipsis-horizontal-circle', color: '#64748B' },
};

export const PRIORITIES = {
  alta: { label: 'Alta', color: '#EF4444', soft: '#FDECEC' },
  media: { label: 'Media', color: '#F59E0B', soft: '#FEF5E6' },
  baja: { label: 'Baja', color: '#10B981', soft: '#E7F8F1' },
};

export const REMINDER_OPTIONS = [
  { value: 2880, label: '2 días antes' },
  { value: 1440, label: '1 día antes' },
  { value: 180, label: '3 h antes' },
  { value: 60, label: '1 h antes' },
  { value: 30, label: '30 min antes' },
  { value: 15, label: '15 min antes' },
  { value: 5, label: '5 min antes' },
  { value: 0, label: 'A la hora' },
];

export const NAG_OPTIONS = [
  { value: 0, label: 'No' },
  { value: 15, label: 'Cada 15 min' },
  { value: 30, label: 'Cada 30 min' },
  { value: 60, label: 'Cada hora' },
  { value: 120, label: 'Cada 2 h' },
  { value: 180, label: 'Cada 3 h' },
];

export const REPEAT_OPTIONS = [
  { value: 'none', label: 'No se repite' },
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'yearly', label: 'Anual' },
];

export const shadow = {
  shadowColor: '#1E1B4B',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

export const FONTS = {
  400: 'Inter_400Regular',
  500: 'Inter_500Medium',
  600: 'Inter_600SemiBold',
  700: 'Inter_700Bold',
  800: 'Inter_800ExtraBold',
  900: 'Inter_900Black',
};

/** Usa la fuente Inter con el grosor indicado (en Android fontWeight no cambia de archivo de fuente). */
export const font = (weight = 400) => ({ fontFamily: FONTS[weight] });
