export type GameLanguage = 'en' | 'ru';

export const normalizeGameLanguage = (value: string | undefined): GameLanguage =>
  value?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
