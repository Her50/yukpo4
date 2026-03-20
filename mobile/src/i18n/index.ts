/**
 * Configuration i18next — Système d'internationalisation moderne
 * 
 * OPTIMISATION: Seule la langue par défaut (fr) est chargée au démarrage (~800 KB).
 * Les autres langues (~750 KB chacune) sont chargées à la demande via loadLanguage().
 * Avant: ~46 MB parsés au démarrage (62 fichiers). Après: ~800 KB.
 */
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import fr from './locales/fr.json';

export const SUPPORTED_LANGUAGES = [
    { code: 'fr', name: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7' },
    { code: 'en', name: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7' },
    { code: 'de', name: 'Deutsch', flag: '\uD83C\uDDE9\uD83C\uDDEA' },
    { code: 'es', name: 'Español', flag: '\uD83C\uDDEA\uD83C\uDDF8' },
    { code: 'pt', name: 'Português', flag: '\uD83C\uDDE7\uD83C\uDDF7' },
    { code: 'zh', name: '中文', flag: '\uD83C\uDDE8\uD83C\uDDF3' },
    { code: 'ja', name: '日本語', flag: '\uD83C\uDDEF\uD83C\uDDF5' },
    { code: 'hi', name: 'हिन्दी', flag: '\uD83C\uDDEE\uD83C\uDDF3' },
    { code: 'ar', name: 'العربية', flag: '\uD83C\uDDF8\uD83C\uDDE6' },
    { code: 'ru', name: 'Русский', flag: '\uD83C\uDDF7\uD83C\uDDFA' },
    // \uD83C\uDF0D Langues africaines formalisées
    { code: 'sw', name: 'Kiswahili', flag: '\uD83C\uDDF0\uD83C\uDDEA' },
    { code: 'ha', name: 'Hausa', flag: '\uD83C\uDDF3\uD83C\uDDEC' },
    { code: 'yo', name: 'Yorùbá', flag: '\uD83C\uDDF3\uD83C\uDDEC' },
    { code: 'am', name: 'አማርኛ', flag: '\uD83C\uDDEA\uD83C\uDDF9' },
    { code: 'wo', name: 'Wolof', flag: '\uD83C\uDDF8\uD83C\uDDF3' },
    { code: 'zu', name: 'isiZulu', flag: '\uD83C\uDDFF\uD83C\uDDE6' },
    { code: 'ig', name: 'Igbo', flag: '\uD83C\uDDF3\uD83C\uDDEC' },
    { code: 'ln', name: 'Lingála', flag: '\uD83C\uDDE8\uD83C\uDDE9' },
    { code: 'ff', name: 'Foufouldé (Fulfulde)', flag: '\uD83C\uDDE8\uD83C\uDDF2' },
    { code: 'rw', name: 'Kinyarwanda', flag: '\uD83C\uDDF7\uD83C\uDDFC' },
    { code: 'sn', name: 'chiShona', flag: '\uD83C\uDDFF\uD83C\uDDFC' },
    { code: 'so', name: 'Soomaali', flag: '\uD83C\uDDF8\uD83C\uDDF4' },
    { code: 'ti', name: 'ትግርኛ', flag: '\uD83C\uDDEA\uD83C\uDDF7' },
    { code: 'mg', name: 'Malagasy', flag: '\uD83C\uDDF2\uD83C\uDDEC' },
    // \uD83C\uDF34 Langues caraïbéennes
    { code: 'ht', name: 'Kreyòl Ayisyen', flag: '\uD83C\uDDED\uD83C\uDDF9' },
    { code: 'pap', name: 'Papiamentu', flag: '\uD83C\uDDE8\uD83C\uDDFC' },

    // \uD83C\uDF0D Nouvelles langues (ajoutées automatiquement)
    { code: 'ewo', name: 'Ewondo', flag: '\uD83C\uDDE8\uD83C\uDDF2' },
    { code: 'dua', name: 'Duálá', flag: '\uD83C\uDDE8\uD83C\uDDF2' },
    { code: 'bbj', name: 'Ghomálá', flag: '\uD83C\uDDE8\uD83C\uDDF2' },
    { code: 'bas', name: 'Bassa', flag: '\uD83C\uDDE8\uD83C\uDDF2' },
    { code: 'bum', name: 'Bulu', flag: '\uD83C\uDDE8\uD83C\uDDF2' },
    { code: 'bci', name: 'Baoulé', flag: '\uD83C\uDDE8\uD83C\uDDEE' },
    { code: 'dyu', name: 'Dioula', flag: '\uD83C\uDDE8\uD83C\uDDEE' },
    { code: 'bet', name: 'Bété', flag: '\uD83C\uDDE8\uD83C\uDDEE' },
    { code: 'pcm', name: 'Naijá (Pidgin)', flag: '\uD83C\uDDF3\uD83C\uDDEC' },
    { code: 'mos', name: 'Mooré', flag: '\uD83C\uDDE7\uD83C\uDDEB' },
    { code: 'bm', name: 'Bamanankan', flag: '\uD83C\uDDF2\uD83C\uDDF1' },
    { code: 'dje', name: 'Zarma', flag: '\uD83C\uDDF3\uD83C\uDDEA' },
    { code: 'ee', name: 'Eʋegbe (Éwé)', flag: '\uD83C\uDDF9\uD83C\uDDEC' },
    { code: 'kbp', name: 'Kabɩyɛ', flag: '\uD83C\uDDF9\uD83C\uDDEC' },
    { code: 'sar', name: 'Sara', flag: '\uD83C\uDDF9\uD83C\uDDE9' },
    { code: 'sg', name: 'Sängö', flag: '\uD83C\uDDE8\uD83C\uDDEB' },
    { code: 'kg', name: 'Kikongo', flag: '\uD83C\uDDE8\uD83C\uDDE9' },
    { code: 'lua', name: 'Tshiluba', flag: '\uD83C\uDDE8\uD83C\uDDE9' },
    { code: 'fan', name: 'Fang', flag: '\uD83C\uDDEC\uD83C\uDDE6' },
    { code: 'xh', name: 'isiXhosa', flag: '\uD83C\uDDFF\uD83C\uDDE6' },
    { code: 'af', name: 'Afrikaans', flag: '\uD83C\uDDFF\uD83C\uDDE6' },
    { code: 'st', name: 'Sesotho', flag: '\uD83C\uDDFF\uD83C\uDDE6' },
    { code: 'rn', name: 'Ikirundi', flag: '\uD83C\uDDE7\uD83C\uDDEE' },
    { code: 'srr', name: 'Seereer', flag: '\uD83C\uDDF8\uD83C\uDDF3' },
    { code: 'ko', name: '한국어', flag: '\uD83C\uDDF0\uD83C\uDDF7' },
    { code: 'tr', name: 'Türkçe', flag: '\uD83C\uDDF9\uD83C\uDDF7' },
    { code: 'id', name: 'Bahasa Indonesia', flag: '\uD83C\uDDEE\uD83C\uDDE9' },
    { code: 'vi', name: 'Tiếng Việt', flag: '\uD83C\uDDFB\uD83C\uDDF3' },
    { code: 'th', name: 'ภาษาไทย', flag: '\uD83C\uDDF9\uD83C\uDDED' },
    { code: 'bn', name: 'বাংলা', flag: '\uD83C\uDDE7\uD83C\uDDE9' },
    { code: 'tl', name: 'Filipino', flag: '\uD83C\uDDF5\uD83C\uDDED' },
    { code: 'ms', name: 'Bahasa Melayu', flag: '\uD83C\uDDF2\uD83C\uDDFE' },
    { code: 'uk', name: 'Українська', flag: '\uD83C\uDDFA\uD83C\uDDE6' },
    { code: 'pl', name: 'Polski', flag: '\uD83C\uDDF5\uD83C\uDDF1' },
    { code: 'it', name: 'Italiano', flag: '\uD83C\uDDEE\uD83C\uDDF9' },
    { code: 'nl', name: 'Nederlands', flag: '\uD83C\uDDF3\uD83C\uDDF1' },
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];

// Lazy loaders: require() inside functions defers JSON parsing until called
const localeLoaders: Record<string, () => any> = {
    fr: () => fr,
    en: () => require('./locales/en.json'),
    de: () => require('./locales/de.json'),
    es: () => require('./locales/es.json'),
    pt: () => require('./locales/pt.json'),
    zh: () => require('./locales/zh.json'),
    ja: () => require('./locales/ja.json'),
    hi: () => require('./locales/hi.json'),
    ar: () => require('./locales/ar.json'),
    ru: () => require('./locales/ru.json'),
    sw: () => require('./locales/sw.json'),
    ha: () => require('./locales/ha.json'),
    yo: () => require('./locales/yo.json'),
    am: () => require('./locales/am.json'),
    wo: () => require('./locales/wo.json'),
    zu: () => require('./locales/zu.json'),
    ig: () => require('./locales/ig.json'),
    ln: () => require('./locales/ln.json'),
    ff: () => require('./locales/ff.json'),
    rw: () => require('./locales/rw.json'),
    sn: () => require('./locales/sn.json'),
    so: () => require('./locales/so.json'),
    ti: () => require('./locales/ti.json'),
    mg: () => require('./locales/mg.json'),
    ht: () => require('./locales/ht.json'),
    pap: () => require('./locales/pap.json'),
    ewo: () => require('./locales/ewo.json'),
    dua: () => require('./locales/dua.json'),
    bbj: () => require('./locales/bbj.json'),
    bas: () => require('./locales/bas.json'),
    bum: () => require('./locales/bum.json'),
    bci: () => require('./locales/bci.json'),
    dyu: () => require('./locales/dyu.json'),
    bet: () => require('./locales/bet.json'),
    pcm: () => require('./locales/pcm.json'),
    mos: () => require('./locales/mos.json'),
    bm: () => require('./locales/bm.json'),
    dje: () => require('./locales/dje.json'),
    ee: () => require('./locales/ee.json'),
    kbp: () => require('./locales/kbp.json'),
    sar: () => require('./locales/sar.json'),
    sg: () => require('./locales/sg.json'),
    kg: () => require('./locales/kg.json'),
    lua: () => require('./locales/lua.json'),
    fan: () => require('./locales/fan.json'),
    xh: () => require('./locales/xh.json'),
    af: () => require('./locales/af.json'),
    st: () => require('./locales/st.json'),
    rn: () => require('./locales/rn.json'),
    srr: () => require('./locales/srr.json'),
    ko: () => require('./locales/ko.json'),
    tr: () => require('./locales/tr.json'),
    id: () => require('./locales/id.json'),
    vi: () => require('./locales/vi.json'),
    th: () => require('./locales/th.json'),
    bn: () => require('./locales/bn.json'),
    tl: () => require('./locales/tl.json'),
    ms: () => require('./locales/ms.json'),
    uk: () => require('./locales/uk.json'),
    pl: () => require('./locales/pl.json'),
    it: () => require('./locales/it.json'),
    nl: () => require('./locales/nl.json'),
};

/**
 * Load a language bundle on demand and register it with i18next.
 * No-op if the language is already loaded.
 */
export const loadLanguage = (lang: string): void => {
    if (i18n.hasResourceBundle(lang, 'translation')) return;
    const loader = localeLoaders[lang];
    if (!loader) return;
    try {
        const data = loader();
        i18n.addResourceBundle(lang, 'translation', data, true, true);
        console.log(`[i18n] Language "${lang}" loaded on demand`);
    } catch (error) {
        console.warn(`[i18n] Failed to load language "${lang}":`, error);
    }
};

const getDeviceLanguage = (): SupportedLanguage => {
    try {
        const locale = Localization.locale?.split('-')[0] || 'fr';
        const supported = SUPPORTED_LANGUAGES.map(l => l.code) as readonly string[];
        return supported.includes(locale) ? (locale as SupportedLanguage) : 'fr';
    } catch {
        return 'fr';
    }
};

const deviceLang = getDeviceLanguage();

// Load device language if different from fallback
if (deviceLang !== 'fr') {
    loadLanguage(deviceLang);
}

i18n
    .use(initReactI18next)
    .init({
        resources: {
            fr: { translation: fr },
        },
        lng: deviceLang,
        fallbackLng: 'fr',
        compatibilityJSON: 'v4',
        interpolation: {
            escapeValue: false,
        },
        react: {
            useSuspense: false,
        },
        returnNull: false,
        returnEmptyString: false,
    });

// Intercept changeLanguage to auto-load bundles
const _originalChangeLanguage = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = (lang?: string, ...args: any[]) => {
    if (lang) loadLanguage(lang);
    return _originalChangeLanguage(lang, ...args);
};

export default i18n;
export { getDeviceLanguage };
