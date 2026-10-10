import en from './locales/en.json';

// i18n scaffolding. English ships first; the structure supports Hindi later
// by adding a locale file and registering it here.
export const messages = { en };
export type Locale = keyof typeof messages;
export const defaultLocale: Locale = 'en';
