/**
 * Service de détection intelligente de la langue basée sur la position GPS.
 * 
 * - Détecte le pays via GPS (bounding boxes) ou géocodage inverse
 * - Propose les langues les plus utilisées dans ce pays (max 10)
 * - Inclut les langues locales/régionales (ewondo, duala, bassa, etc.)
 * - Suggère la langue officielle par défaut
 */
import * as Location from 'expo-location';
import SafeStorage from '../utils/safeStorage';

// ============================================================
// MAPPING : Code pays ISO → langues courantes (max 10 par pays)
// Ordre : langue officielle en 1er, puis langues locales par usage
// ============================================================
export interface GeoLanguage {
    code: string;
    name: string;
    nativeName: string;
    flag: string;
    isOfficial: boolean;
    isLocal: boolean;
}

type CountryLanguageMap = Record<string, {
    defaultLang: string;
    languages: GeoLanguage[];
}>;

export const COUNTRY_LANGUAGES: CountryLanguageMap = {
    // ========== AFRIQUE CENTRALE (CEMAC) ==========
    CM: {
        defaultLang: 'fr',
        languages: [
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: true, isLocal: false },
            { code: 'ewo', name: 'Ewondo', nativeName: 'Ewondo', flag: '\uD83C\uDDE8\uD83C\uDDF2', isOfficial: false, isLocal: true },
            { code: 'dua', name: 'Duala', nativeName: 'Duálá', flag: '\uD83C\uDDE8\uD83C\uDDF2', isOfficial: false, isLocal: true },
            { code: 'bbj', name: 'Ghomala', nativeName: "Ghomálá'", flag: '\uD83C\uDDE8\uD83C\uDDF2', isOfficial: false, isLocal: true },
            { code: 'bas', name: 'Bassa', nativeName: 'Bassa', flag: '\uD83C\uDDE8\uD83C\uDDF2', isOfficial: false, isLocal: true },
            { code: 'bum', name: 'Bulu', nativeName: 'Bulu', flag: '\uD83C\uDDE8\uD83C\uDDF2', isOfficial: false, isLocal: true },
            { code: 'ff', name: 'Fulfulde', nativeName: 'Fufulde / Fulfulde', flag: '\uD83C\uDDE8\uD83C\uDDF2', isOfficial: false, isLocal: true },
            { code: 'pcm', name: 'Pidgin', nativeName: 'Naijá (Pidgin)', flag: '\uD83C\uDDE8\uD83C\uDDF2', isOfficial: false, isLocal: true },
            { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '\uD83C\uDDF8\uD83C\uDDE6', isOfficial: false, isLocal: false },
        ],
    },
    GA: {
        defaultLang: 'fr',
        languages: [
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'fan', name: 'Fang', nativeName: 'Fang', flag: '\uD83C\uDDEC\uD83C\uDDE6', isOfficial: false, isLocal: true },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
        ],
    },
    CG: {
        defaultLang: 'fr',
        languages: [
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'kg', name: 'Kikongo', nativeName: 'Kikongo', flag: '\uD83C\uDDE8\uD83C\uDDEC', isOfficial: false, isLocal: true },
            { code: 'ln', name: 'Lingala', nativeName: 'Lingála', flag: '\uD83C\uDDE8\uD83C\uDDEC', isOfficial: false, isLocal: true },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
        ],
    },
    CD: {
        defaultLang: 'fr',
        languages: [
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'ln', name: 'Lingala', nativeName: 'Lingála', flag: '\uD83C\uDDE8\uD83C\uDDE9', isOfficial: false, isLocal: true },
            { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', flag: '\uD83C\uDDE8\uD83C\uDDE9', isOfficial: false, isLocal: true },
            { code: 'kg', name: 'Kikongo', nativeName: 'Kikongo', flag: '\uD83C\uDDE8\uD83C\uDDE9', isOfficial: false, isLocal: true },
            { code: 'lua', name: 'Tshiluba', nativeName: 'Tshiluba', flag: '\uD83C\uDDE8\uD83C\uDDE9', isOfficial: false, isLocal: true },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
        ],
    },
    TD: {
        defaultLang: 'fr',
        languages: [
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '\uD83C\uDDF9\uD83C\uDDE9', isOfficial: true, isLocal: false },
            { code: 'sar', name: 'Sara', nativeName: 'Sara', flag: '\uD83C\uDDF9\uD83C\uDDE9', isOfficial: false, isLocal: true },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
        ],
    },
    CF: {
        defaultLang: 'fr',
        languages: [
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'sg', name: 'Sango', nativeName: 'Sängö', flag: '\uD83C\uDDE8\uD83C\uDDEB', isOfficial: true, isLocal: true },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
        ],
    },
    GQ: {
        defaultLang: 'es',
        languages: [
            { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '\uD83C\uDDEA\uD83C\uDDF8', isOfficial: true, isLocal: false },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '\uD83C\uDDE7\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'fan', name: 'Fang', nativeName: 'Fang', flag: '\uD83C\uDDEC\uD83C\uDDF6', isOfficial: false, isLocal: true },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
        ],
    },

    // ========== AFRIQUE DE L'OUEST (CEDEAO) ==========
    CI: {
        defaultLang: 'fr',
        languages: [
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'bci', name: 'Baoulé', nativeName: 'Baoulé', flag: '\uD83C\uDDE8\uD83C\uDDEE', isOfficial: false, isLocal: true },
            { code: 'dyu', name: 'Dioula', nativeName: 'Dioula', flag: '\uD83C\uDDE8\uD83C\uDDEE', isOfficial: false, isLocal: true },
            { code: 'bet', name: 'Bété', nativeName: 'Bété', flag: '\uD83C\uDDE8\uD83C\uDDEE', isOfficial: false, isLocal: true },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
        ],
    },
    SN: {
        defaultLang: 'fr',
        languages: [
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'wo', name: 'Wolof', nativeName: 'Wolof', flag: '\uD83C\uDDF8\uD83C\uDDF3', isOfficial: false, isLocal: true },
            { code: 'srr', name: 'Seereer', nativeName: 'Seereer', flag: '\uD83C\uDDF8\uD83C\uDDF3', isOfficial: false, isLocal: true },
            { code: 'ff', name: 'Fulfulde', nativeName: 'Pulaar', flag: '\uD83C\uDDF8\uD83C\uDDF3', isOfficial: false, isLocal: true },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
        ],
    },
    ML: {
        defaultLang: 'fr',
        languages: [
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'bm', name: 'Bambara', nativeName: 'Bamanankan', flag: '\uD83C\uDDF2\uD83C\uDDF1', isOfficial: false, isLocal: true },
            { code: 'ff', name: 'Fulfulde', nativeName: 'Fulfulde', flag: '\uD83C\uDDF2\uD83C\uDDF1', isOfficial: false, isLocal: true },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
        ],
    },
    BF: {
        defaultLang: 'fr',
        languages: [
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'mos', name: 'Mooré', nativeName: 'Mooré', flag: '\uD83C\uDDE7\uD83C\uDDEB', isOfficial: false, isLocal: true },
            { code: 'dyu', name: 'Dioula', nativeName: 'Dioula', flag: '\uD83C\uDDE7\uD83C\uDDEB', isOfficial: false, isLocal: true },
            { code: 'ff', name: 'Fulfulde', nativeName: 'Fulfulde', flag: '\uD83C\uDDE7\uD83C\uDDEB', isOfficial: false, isLocal: true },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
        ],
    },
    NE: {
        defaultLang: 'fr',
        languages: [
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'ha', name: 'Hausa', nativeName: 'Hausa', flag: '\uD83C\uDDF3\uD83C\uDDEA', isOfficial: false, isLocal: true },
            { code: 'dje', name: 'Zarma', nativeName: 'Zarma', flag: '\uD83C\uDDF3\uD83C\uDDEA', isOfficial: false, isLocal: true },
            { code: 'ff', name: 'Fulfulde', nativeName: 'Fulfulde', flag: '\uD83C\uDDF3\uD83C\uDDEA', isOfficial: false, isLocal: true },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
        ],
    },
    TG: {
        defaultLang: 'fr',
        languages: [
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'ee', name: 'Éwé', nativeName: 'Eʋegbe', flag: '\uD83C\uDDF9\uD83C\uDDEC', isOfficial: false, isLocal: true },
            { code: 'kbp', name: 'Kabiyè', nativeName: 'Kabɩyɛ', flag: '\uD83C\uDDF9\uD83C\uDDEC', isOfficial: false, isLocal: true },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
        ],
    },
    BJ: {
        defaultLang: 'fr',
        languages: [
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá', flag: '\uD83C\uDDE7\uD83C\uDDEF', isOfficial: false, isLocal: true },
            { code: 'ff', name: 'Fulfulde', nativeName: 'Fulfulde', flag: '\uD83C\uDDE7\uD83C\uDDEF', isOfficial: false, isLocal: true },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
        ],
    },
    NG: {
        defaultLang: 'en',
        languages: [
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: true, isLocal: false },
            { code: 'ha', name: 'Hausa', nativeName: 'Hausa', flag: '\uD83C\uDDF3\uD83C\uDDEC', isOfficial: false, isLocal: true },
            { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá', flag: '\uD83C\uDDF3\uD83C\uDDEC', isOfficial: false, isLocal: true },
            { code: 'ig', name: 'Igbo', nativeName: 'Igbo', flag: '\uD83C\uDDF3\uD83C\uDDEC', isOfficial: false, isLocal: true },
            { code: 'pcm', name: 'Pidgin', nativeName: 'Naijá (Pidgin)', flag: '\uD83C\uDDF3\uD83C\uDDEC', isOfficial: false, isLocal: true },
            { code: 'ff', name: 'Fulfulde', nativeName: 'Fulfulde', flag: '\uD83C\uDDF3\uD83C\uDDEC', isOfficial: false, isLocal: true },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: false, isLocal: false },
        ],
    },
    GH: {
        defaultLang: 'en',
        languages: [
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: true, isLocal: false },
            { code: 'ee', name: 'Éwé', nativeName: 'Eʋegbe', flag: '\uD83C\uDDEC\uD83C\uDDED', isOfficial: false, isLocal: true },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: false, isLocal: false },
        ],
    },

    // ========== AFRIQUE DE L'EST ==========
    KE: {
        defaultLang: 'en',
        languages: [
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: true, isLocal: false },
            { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', flag: '\uD83C\uDDF0\uD83C\uDDEA', isOfficial: true, isLocal: true },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: false, isLocal: false },
        ],
    },
    TZ: {
        defaultLang: 'sw',
        languages: [
            { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', flag: '\uD83C\uDDF9\uD83C\uDDFF', isOfficial: true, isLocal: true },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: true, isLocal: false },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: false, isLocal: false },
        ],
    },
    RW: {
        defaultLang: 'rw',
        languages: [
            { code: 'rw', name: 'Kinyarwanda', nativeName: 'Kinyarwanda', flag: '\uD83C\uDDF7\uD83C\uDDFC', isOfficial: true, isLocal: true },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: true, isLocal: false },
            { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', flag: '\uD83C\uDDF7\uD83C\uDDFC', isOfficial: true, isLocal: false },
        ],
    },
    BI: {
        defaultLang: 'rn',
        languages: [
            { code: 'rn', name: 'Kirundi', nativeName: 'Ikirundi', flag: '\uD83C\uDDE7\uD83C\uDDEE', isOfficial: true, isLocal: true },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: true, isLocal: false },
        ],
    },
    ET: {
        defaultLang: 'am',
        languages: [
            { code: 'am', name: 'Amharic', nativeName: 'አማርኛ', flag: '\uD83C\uDDEA\uD83C\uDDF9', isOfficial: true, isLocal: true },
            { code: 'ti', name: 'Tigrinya', nativeName: 'ትግርኛ', flag: '\uD83C\uDDEA\uD83C\uDDF9', isOfficial: false, isLocal: true },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: false, isLocal: false },
        ],
    },
    SO: {
        defaultLang: 'so',
        languages: [
            { code: 'so', name: 'Somali', nativeName: 'Soomaali', flag: '\uD83C\uDDF8\uD83C\uDDF4', isOfficial: true, isLocal: true },
            { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '\uD83C\uDDF8\uD83C\uDDE6', isOfficial: true, isLocal: false },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
        ],
    },
    MG: {
        defaultLang: 'mg',
        languages: [
            { code: 'mg', name: 'Malagasy', nativeName: 'Malagasy', flag: '\uD83C\uDDF2\uD83C\uDDEC', isOfficial: true, isLocal: true },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
        ],
    },

    // ========== AFRIQUE AUSTRALE ==========
    ZA: {
        defaultLang: 'en',
        languages: [
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: true, isLocal: false },
            { code: 'zu', name: 'Zulu', nativeName: 'isiZulu', flag: '\uD83C\uDDFF\uD83C\uDDE6', isOfficial: true, isLocal: true },
            { code: 'xh', name: 'Xhosa', nativeName: 'isiXhosa', flag: '\uD83C\uDDFF\uD83C\uDDE6', isOfficial: true, isLocal: true },
            { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', flag: '\uD83C\uDDFF\uD83C\uDDE6', isOfficial: true, isLocal: true },
            { code: 'st', name: 'Sesotho', nativeName: 'Sesotho', flag: '\uD83C\uDDFF\uD83C\uDDE6', isOfficial: true, isLocal: true },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: false, isLocal: false },
        ],
    },
    ZW: {
        defaultLang: 'en',
        languages: [
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: true, isLocal: false },
            { code: 'sn', name: 'Shona', nativeName: 'chiShona', flag: '\uD83C\uDDFF\uD83C\uDDFC', isOfficial: true, isLocal: true },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: false, isLocal: false },
        ],
    },

    // ========== MAGHREB ==========
    MA: {
        defaultLang: 'ar',
        languages: [
            { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '\uD83C\uDDF2\uD83C\uDDE6', isOfficial: true, isLocal: false },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: false, isLocal: false },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
            { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '\uD83C\uDDEA\uD83C\uDDF8', isOfficial: false, isLocal: false },
        ],
    },
    DZ: {
        defaultLang: 'ar',
        languages: [
            { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '\uD83C\uDDE9\uD83C\uDDFF', isOfficial: true, isLocal: false },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: false, isLocal: false },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
        ],
    },
    TN: {
        defaultLang: 'ar',
        languages: [
            { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '\uD83C\uDDF9\uD83C\uDDF3', isOfficial: true, isLocal: false },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: false, isLocal: false },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
        ],
    },

    // ========== CARAÏBES ==========
    HT: {
        defaultLang: 'ht',
        languages: [
            { code: 'ht', name: 'Créole haïtien', nativeName: 'Kreyòl Ayisyen', flag: '\uD83C\uDDED\uD83C\uDDF9', isOfficial: true, isLocal: true },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
            { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '\uD83C\uDDEA\uD83C\uDDF8', isOfficial: false, isLocal: false },
        ],
    },

    // ========== EUROPE ==========
    FR: {
        defaultLang: 'fr',
        languages: [
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
            { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '\uD83C\uDDE9\uD83C\uDDEA', isOfficial: false, isLocal: false },
            { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '\uD83C\uDDEA\uD83C\uDDF8', isOfficial: false, isLocal: false },
            { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '\uD83C\uDDF8\uD83C\uDDE6', isOfficial: false, isLocal: false },
        ],
    },
    BE: {
        defaultLang: 'fr',
        languages: [
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '\uD83C\uDDF3\uD83C\uDDF1', isOfficial: true, isLocal: false },
            { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '\uD83C\uDDE9\uD83C\uDDEA', isOfficial: true, isLocal: false },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
        ],
    },
    CH: {
        defaultLang: 'fr',
        languages: [
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '\uD83C\uDDE9\uD83C\uDDEA', isOfficial: true, isLocal: false },
            { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '\uD83C\uDDEE\uD83C\uDDF9', isOfficial: true, isLocal: false },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
        ],
    },
    DE: {
        defaultLang: 'de',
        languages: [
            { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '\uD83C\uDDE9\uD83C\uDDEA', isOfficial: true, isLocal: false },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: false, isLocal: false },
            { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '\uD83C\uDDF9\uD83C\uDDF7', isOfficial: false, isLocal: false },
        ],
    },
    GB: {
        defaultLang: 'en',
        languages: [
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: true, isLocal: false },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: false, isLocal: false },
            { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '\uD83C\uDDEA\uD83C\uDDF8', isOfficial: false, isLocal: false },
        ],
    },

    // ========== AMÉRIQUES ==========
    US: {
        defaultLang: 'en',
        languages: [
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDFA\uD83C\uDDF8', isOfficial: true, isLocal: false },
            { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '\uD83C\uDDEA\uD83C\uDDF8', isOfficial: false, isLocal: false },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: false, isLocal: false },
            { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '\uD83C\uDDE8\uD83C\uDDF3', isOfficial: false, isLocal: false },
        ],
    },
    CA: {
        defaultLang: 'en',
        languages: [
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDE8\uD83C\uDDE6', isOfficial: true, isLocal: false },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: true, isLocal: false },
        ],
    },
    BR: {
        defaultLang: 'pt',
        languages: [
            { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '\uD83C\uDDE7\uD83C\uDDF7', isOfficial: true, isLocal: false },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
            { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '\uD83C\uDDEA\uD83C\uDDF8', isOfficial: false, isLocal: false },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: false, isLocal: false },
        ],
    },

    // ========== ASIE ==========
    CN: {
        defaultLang: 'zh',
        languages: [
            { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '\uD83C\uDDE8\uD83C\uDDF3', isOfficial: true, isLocal: false },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: false, isLocal: false },
        ],
    },
    IN: {
        defaultLang: 'hi',
        languages: [
            { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '\uD83C\uDDEE\uD83C\uDDF3', isOfficial: true, isLocal: false },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: true, isLocal: false },
            { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '\uD83C\uDDEE\uD83C\uDDF3', isOfficial: false, isLocal: true },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: false, isLocal: false },
        ],
    },
    JP: {
        defaultLang: 'ja',
        languages: [
            { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '\uD83C\uDDEF\uD83C\uDDF5', isOfficial: true, isLocal: false },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: false, isLocal: false },
        ],
    },

    // ========== MOYEN ORIENT ==========
    AE: {
        defaultLang: 'ar',
        languages: [
            { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '\uD83C\uDDE6\uD83C\uDDEA', isOfficial: true, isLocal: false },
            { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7', isOfficial: false, isLocal: false },
            { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '\uD83C\uDDEE\uD83C\uDDF3', isOfficial: false, isLocal: false },
            { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7', isOfficial: false, isLocal: false },
        ],
    },
};

// ============================================================
// Bounding boxes par pays (lat/lng)
// ============================================================
const COUNTRY_BOUNDS: Record<string, { lat: [number, number]; lng: [number, number] }> = {
    CM: { lat: [1.65, 13.08], lng: [8.49, 16.20] },
    CI: { lat: [4.36, 10.74], lng: [-8.60, -2.49] },
    SN: { lat: [12.30, 16.69], lng: [-17.54, -11.34] },
    BF: { lat: [9.40, 15.08], lng: [-5.51, 2.40] },
    ML: { lat: [10.15, 25.00], lng: [-12.24, 4.27] },
    TG: { lat: [6.14, 11.14], lng: [0.14, 1.81] },
    BJ: { lat: [6.23, 12.42], lng: [0.77, 3.84] },
    NE: { lat: [11.69, 23.52], lng: [0.17, 15.99] },
    CD: { lat: [-13.45, 5.39], lng: [12.04, 31.31] },
    CG: { lat: [-5.04, 3.70], lng: [11.20, 18.65] },
    GA: { lat: [-3.98, 2.32], lng: [8.69, 14.50] },
    TD: { lat: [7.44, 23.45], lng: [13.47, 24.00] },
    CF: { lat: [2.26, 11.00], lng: [14.41, 27.45] },
    GQ: { lat: [-1.46, 3.79], lng: [5.63, 11.33] },
    NG: { lat: [4.27, 13.89], lng: [2.69, 14.68] },
    GH: { lat: [4.74, 11.17], lng: [-3.26, 1.19] },
    KE: { lat: [-4.68, 5.02], lng: [33.91, 41.90] },
    TZ: { lat: [-11.75, -0.99], lng: [29.33, 40.44] },
    RW: { lat: [-2.84, -1.05], lng: [28.86, 30.90] },
    BI: { lat: [-4.47, -2.31], lng: [29.00, 30.85] },
    ET: { lat: [3.40, 14.89], lng: [32.99, 47.99] },
    SO: { lat: [-1.67, 11.98], lng: [40.99, 51.39] },
    MG: { lat: [-25.60, -11.95], lng: [43.25, 50.48] },
    ZA: { lat: [-34.83, -22.13], lng: [16.45, 32.89] },
    ZW: { lat: [-22.42, -15.61], lng: [25.24, 33.07] },
    MA: { lat: [27.67, 35.92], lng: [-13.17, -1.01] },
    DZ: { lat: [18.97, 37.09], lng: [-8.67, 11.98] },
    TN: { lat: [30.24, 37.34], lng: [7.52, 11.60] },
    HT: { lat: [18.02, 20.09], lng: [-74.48, -71.62] },
    FR: { lat: [41.37, 51.09], lng: [-5.14, 9.56] },
    BE: { lat: [49.50, 51.50], lng: [2.55, 6.40] },
    CH: { lat: [45.82, 47.81], lng: [5.96, 10.49] },
    DE: { lat: [47.27, 55.06], lng: [5.87, 15.04] },
    GB: { lat: [49.96, 58.64], lng: [-7.57, 1.68] },
    US: { lat: [24.52, 49.38], lng: [-124.77, -66.95] },
    CA: { lat: [41.68, 83.11], lng: [-141.00, -52.62] },
    BR: { lat: [-33.75, 5.27], lng: [-73.99, -34.79] },
    CN: { lat: [18.17, 53.56], lng: [73.50, 134.77] },
    IN: { lat: [6.75, 35.50], lng: [68.17, 97.40] },
    JP: { lat: [24.25, 45.52], lng: [122.93, 153.99] },
    AE: { lat: [22.63, 26.08], lng: [51.58, 56.38] },
};

/**
 * Détecte le code pays ISO à partir de coordonnées GPS (bounding boxes)
 */
export function getCountryFromCoords(lat: number, lng: number): string | null {
    for (const [code, bounds] of Object.entries(COUNTRY_BOUNDS)) {
        if (lat >= bounds.lat[0] && lat <= bounds.lat[1] &&
            lng >= bounds.lng[0] && lng <= bounds.lng[1]) {
            return code;
        }
    }
    return null;
}

/**
 * Détecte le pays de l'utilisateur via GPS + géocodage inverse
 * Priorité : cache → GPS bounding box → reverseGeocode → device locale → 'CM'
 */
export async function detectUserCountry(): Promise<string> {
    try {
        // 1. Cache
        const cached = await SafeStorage.getItem('geo_detected_country');
        if (cached && COUNTRY_LANGUAGES[cached]) {
            return cached;
        }

        // 2. GPS
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            return _fallbackCountry();
        }

        const location = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000)),
        ]);

        const { latitude, longitude } = (location as Location.LocationObject).coords;

        // Bounding box match
        const bbCountry = getCountryFromCoords(latitude, longitude);
        if (bbCountry && COUNTRY_LANGUAGES[bbCountry]) {
            await SafeStorage.setItem('geo_detected_country', bbCountry);
            return bbCountry;
        }

        // Reverse geocode
        try {
            const results = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (results?.[0]?.isoCountryCode) {
                const iso = results[0].isoCountryCode.toUpperCase();
                if (COUNTRY_LANGUAGES[iso]) {
                    await SafeStorage.setItem('geo_detected_country', iso);
                    return iso;
                }
            }
        } catch (e) {
            console.warn('[GeoLang] reverseGeocode failed:', e);
        }

        return _fallbackCountry();
    } catch (e) {
        console.warn('[GeoLang] detectUserCountry error:', e);
        return _fallbackCountry();
    }
}

async function _fallbackCountry(): Promise<string> {
    // Try device locale
    try {
        const Localization = require('expo-localization');
        const region = Localization.region; // e.g. 'CM', 'FR', 'US'
        if (region && COUNTRY_LANGUAGES[region]) {
            return region;
        }
    } catch {}
    return 'CM';
}

/**
 * Retourne les langues suggérées pour un pays donné (max 10, avec locales)
 */
export function getLanguagesForCountry(countryCode: string): GeoLanguage[] {
    const entry = COUNTRY_LANGUAGES[countryCode];
    if (!entry) {
        // Fallback : langues internationales courantes
        return COUNTRY_LANGUAGES['CM'].languages;
    }
    return entry.languages.slice(0, 10);
}

/**
 * Retourne la langue par défaut suggérée pour un pays
 */
export function getDefaultLanguageForCountry(countryCode: string): string {
    const entry = COUNTRY_LANGUAGES[countryCode];
    return entry?.defaultLang || 'fr';
}

/**
 * Détecte et retourne tout : pays, langue par défaut, langues suggérées
 */
export async function detectGeoLanguageContext(): Promise<{
    countryCode: string;
    defaultLanguage: string;
    suggestedLanguages: GeoLanguage[];
}> {
    const countryCode = await detectUserCountry();
    return {
        countryCode,
        defaultLanguage: getDefaultLanguageForCountry(countryCode),
        suggestedLanguages: getLanguagesForCountry(countryCode),
    };
}
