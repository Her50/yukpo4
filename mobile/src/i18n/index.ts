/**
 * Configuration i18next — Système d'internationalisation moderne
 * 
 * Utilise i18next + react-i18next (standard industriel React/React Native)
 * Compatible avec expo-localization pour détection automatique de la langue
 * 
 * Langues supportées: fr, en, de, es, pt, zh, ja, hi, ar, ru, sw, ha, yo, am, wo, zu, ig, ln, ff, rw, sn, so, ti, mg, ht, pap
 * Langue par défaut: fr (français)
 */
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import af from './locales/af.json';
import am from './locales/am.json';
import ar from './locales/ar.json';
import bas from './locales/bas.json';
import bbj from './locales/bbj.json';
import bci from './locales/bci.json';
import bet from './locales/bet.json';
import bm from './locales/bm.json';
import bn from './locales/bn.json';
import bum from './locales/bum.json';
import de from './locales/de.json';
import dje from './locales/dje.json';
import dua from './locales/dua.json';
import dyu from './locales/dyu.json';
import ee from './locales/ee.json';
import en from './locales/en.json';
import es from './locales/es.json';
import ewo from './locales/ewo.json';
import fan from './locales/fan.json';
import ff from './locales/ff.json';
import fr from './locales/fr.json';
import ha from './locales/ha.json';
import hi from './locales/hi.json';
import ht from './locales/ht.json';
import id from './locales/id.json';
import ig from './locales/ig.json';
import it from './locales/it.json';
import ja from './locales/ja.json';
import kbp from './locales/kbp.json';
import kg from './locales/kg.json';
import ko from './locales/ko.json';
import ln from './locales/ln.json';
import lua from './locales/lua.json';
import mg from './locales/mg.json';
import mos from './locales/mos.json';
import ms from './locales/ms.json';
import nl from './locales/nl.json';
import pap from './locales/pap.json';
import pcm from './locales/pcm.json';
import pl from './locales/pl.json';
import pt from './locales/pt.json';
import rn from './locales/rn.json';
import ru from './locales/ru.json';
import rw from './locales/rw.json';
import sar from './locales/sar.json';
import sg from './locales/sg.json';
import sn from './locales/sn.json';
import so from './locales/so.json';
import srr from './locales/srr.json';
import st from './locales/st.json';
import sw from './locales/sw.json';
import th from './locales/th.json';
import ti from './locales/ti.json';
import tl from './locales/tl.json';
import tr from './locales/tr.json';
import uk from './locales/uk.json';
import vi from './locales/vi.json';
import wo from './locales/wo.json';
import xh from './locales/xh.json';
import yo from './locales/yo.json';
import zh from './locales/zh.json';
import zu from './locales/zu.json';

export const SUPPORTED_LANGUAGES = [
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    // 🌍 Langues africaines formalisées
    { code: 'sw', name: 'Kiswahili', flag: '🇰🇪' },
    { code: 'ha', name: 'Hausa', flag: '🇳🇬' },
    { code: 'yo', name: 'Yorùbá', flag: '🇳🇬' },
    { code: 'am', name: 'አማርኛ', flag: '🇪🇹' },
    { code: 'wo', name: 'Wolof', flag: '🇸🇳' },
    { code: 'zu', name: 'isiZulu', flag: '🇿🇦' },
    { code: 'ig', name: 'Igbo', flag: '🇳🇬' },
    { code: 'ln', name: 'Lingála', flag: '🇨🇩' },
    { code: 'ff', name: 'Fulfulde', flag: '��🇳' },
    { code: 'rw', name: 'Kinyarwanda', flag: '🇷🇼' },
    { code: 'sn', name: 'chiShona', flag: '🇿🇼' },
    { code: 'so', name: 'Soomaali', flag: '🇸🇴' },
    { code: 'ti', name: 'ትግርኛ', flag: '🇪🇷' },
    { code: 'mg', name: 'Malagasy', flag: '🇲🇬' },
    // 🌴 Langues caraïbéennes
    { code: 'ht', name: 'Kreyòl Ayisyen', flag: '🇭🇹' },
    { code: 'pap', name: 'Papiamentu', flag: '🇨🇼' },

    // 🌍 Nouvelles langues (ajoutées automatiquement)
    { code: 'ewo', name: 'Ewondo', flag: '🇨🇲' },
    { code: 'dua', name: 'Duálá', flag: '🇨🇲' },
    { code: 'bbj', name: 'Ghomálá', flag: '🇨🇲' },
    { code: 'bas', name: 'Bassa', flag: '🇨🇲' },
    { code: 'bum', name: 'Bulu', flag: '🇨🇲' },
    { code: 'bci', name: 'Baoulé', flag: '🇨🇮' },
    { code: 'dyu', name: 'Dioula', flag: '🇨🇮' },
    { code: 'bet', name: 'Bété', flag: '🇨🇮' },
    { code: 'pcm', name: 'Naijá (Pidgin)', flag: '🇳🇬' },
    { code: 'mos', name: 'Mooré', flag: '🇧🇫' },
    { code: 'bm', name: 'Bamanankan', flag: '🇲🇱' },
    { code: 'dje', name: 'Zarma', flag: '🇳🇪' },
    { code: 'ee', name: 'Eʋegbe (Éwé)', flag: '🇹🇬' },
    { code: 'kbp', name: 'Kabɩyɛ', flag: '🇹🇬' },
    { code: 'sar', name: 'Sara', flag: '🇹🇩' },
    { code: 'sg', name: 'Sängö', flag: '🇨🇫' },
    { code: 'kg', name: 'Kikongo', flag: '🇨🇩' },
    { code: 'lua', name: 'Tshiluba', flag: '🇨🇩' },
    { code: 'fan', name: 'Fang', flag: '🇬🇦' },
    { code: 'xh', name: 'isiXhosa', flag: '🇿🇦' },
    { code: 'af', name: 'Afrikaans', flag: '🇿🇦' },
    { code: 'st', name: 'Sesotho', flag: '🇿🇦' },
    { code: 'rn', name: 'Ikirundi', flag: '🇧🇮' },
    { code: 'srr', name: 'Seereer', flag: '🇸🇳' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'th', name: 'ภาษาไทย', flag: '🇹🇭' },
    { code: 'bn', name: 'বাংলা', flag: '🇧🇩' },
    { code: 'tl', name: 'Filipino', flag: '🇵🇭' },
    { code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾' },
    { code: 'uk', name: 'Українська', flag: '🇺🇦' },
    { code: 'pl', name: 'Polski', flag: '🇵🇱' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];

const resources = {
    fr: { translation: fr },
    en: { translation: en },
    de: { translation: de },
    es: { translation: es },
    pt: { translation: pt },
    zh: { translation: zh },
    ja: { translation: ja },
    hi: { translation: hi },
    ar: { translation: ar },
    ru: { translation: ru },
    sw: { translation: sw },
    ha: { translation: ha },
    yo: { translation: yo },
    am: { translation: am },
    wo: { translation: wo },
    zu: { translation: zu },
    ig: { translation: ig },
    ln: { translation: ln },
    ff: { translation: ff },
    rw: { translation: rw },
    sn: { translation: sn },
    so: { translation: so },
    ti: { translation: ti },
    mg: { translation: mg },
    ht: { translation: ht },
    pap: { translation: pap },

    ewo: { translation: ewo },
    dua: { translation: dua },
    bbj: { translation: bbj },
    bas: { translation: bas },
    bum: { translation: bum },
    bci: { translation: bci },
    dyu: { translation: dyu },
    bet: { translation: bet },
    pcm: { translation: pcm },
    mos: { translation: mos },
    bm: { translation: bm },
    dje: { translation: dje },
    ee: { translation: ee },
    kbp: { translation: kbp },
    sar: { translation: sar },
    sg: { translation: sg },
    kg: { translation: kg },
    lua: { translation: lua },
    fan: { translation: fan },
    xh: { translation: xh },
    af: { translation: af },
    st: { translation: st },
    rn: { translation: rn },
    srr: { translation: srr },
    ko: { translation: ko },
    tr: { translation: tr },
    id: { translation: id },
    vi: { translation: vi },
    th: { translation: th },
    bn: { translation: bn },
    tl: { translation: tl },
    ms: { translation: ms },
    uk: { translation: uk },
    pl: { translation: pl },
    it: { translation: it },
    nl: { translation: nl },
};

// Détecter la langue du device
const getDeviceLanguage = (): SupportedLanguage => {
    try {
        const locale = Localization.locale?.split('-')[0] || 'fr';
        const supported = SUPPORTED_LANGUAGES.map(l => l.code) as readonly string[];
        return supported.includes(locale) ? (locale as SupportedLanguage) : 'fr';
    } catch {
        return 'fr';
    }
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: getDeviceLanguage(), // ✅ Langue système utilisateur en priorité (fallback: fr)
        fallbackLng: 'fr',
        compatibilityJSON: 'v4',
        interpolation: {
            escapeValue: false, // React gère déjà l'échappement XSS
        },
        react: {
            useSuspense: false, // Éviter les problèmes avec React Native
        },
        returnNull: false,
        returnEmptyString: false,
    });

export default i18n;
export { getDeviceLanguage };
