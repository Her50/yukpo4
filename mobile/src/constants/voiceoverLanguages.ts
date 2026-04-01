/**
 * Langues voix-off / sous-titres Studio vidéo — alignées sur les 62 langues UI (SUPPORTED_LANGUAGES).
 * Les codes sont passés au backend (`voiceover_lang`, `subtitle_lang`) ; TTS / IA utilisent le texte + la langue.
 */
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n';

/** Option affichable (liste complète, recherche) */
export type StudioVoiceLangOption = {
    /** Code ISO / BCP-47 court (ex. fr, zh, en, ewo) */
    value: string;
    /** Libellé natif depuis SUPPORTED_LANGUAGES */
    label: string;
};

/** Les 62 langues — une entrée par locale Yukpo */
export const STUDIO_VOICE_LANG_OPTIONS: StudioVoiceLangOption[] = SUPPORTED_LANGUAGES.map((l) => ({
    value: l.code,
    label: `${l.flag} ${l.name}`,
}));

const norm = (c: string) => c.split('-')[0].toLowerCase();

/**
 * Indices région (ISO 3166-1 alpha-2) → langues souvent utiles en complément (hors langue UI).
 * Sert à proposer max 3 choix pertinents sans afficher les 62 tout le temps.
 */
/** Uniquement des codes présents dans SUPPORTED_LANGUAGES */
const REGION_VOICE_HINTS: Record<string, string[]> = {
    CM: ['fr', 'en', 'ewo'],
    CI: ['fr', 'en', 'bci'],
    SN: ['fr', 'wo', 'en'],
    TG: ['fr', 'ee', 'en'],
    BJ: ['fr', 'en', 'dyu'],
    NE: ['fr', 'ha', 'en'],
    ML: ['fr', 'bm', 'en'],
    BF: ['fr', 'mos', 'en'],
    GA: ['fr', 'en'],
    CG: ['fr', 'ln', 'en'],
    CD: ['fr', 'ln', 'sw'],
    NG: ['en', 'pcm', 'ha'],
    ZA: ['en', 'zu', 'af'],
    MA: ['ar', 'fr', 'en'],
    DZ: ['ar', 'fr', 'en'],
    TN: ['ar', 'fr', 'en'],
    EG: ['ar', 'en'],
    SA: ['ar', 'en'],
    AE: ['ar', 'en'],
    FR: ['fr', 'en', 'de'],
    BE: ['fr', 'nl', 'en'],
    CH: ['de', 'fr', 'it'],
    DE: ['de', 'en', 'tr'],
    AT: ['de', 'en'],
    US: ['en', 'es', 'zh'],
    CA: ['en', 'fr', 'zh'],
    BR: ['pt', 'en', 'es'],
    MX: ['es', 'en'],
    CN: ['zh', 'en', 'ja'],
    TW: ['zh', 'en', 'ja'],
    HK: ['zh', 'en', 'ja'],
    JP: ['ja', 'en', 'zh'],
    KR: ['ko', 'en', 'ja'],
    IN: ['hi', 'en', 'bn'],
    GB: ['en', 'fr', 'pl'],
    RU: ['ru', 'en', 'uk'],
    UA: ['uk', 'ru', 'en'],
    TR: ['tr', 'en', 'ar'],
    PL: ['pl', 'en', 'de'],
    IT: ['it', 'en', 'fr'],
    ES: ['es', 'en', 'fr'],
    PT: ['pt', 'en', 'fr'],
    NL: ['nl', 'en', 'de'],
    AU: ['en', 'zh', 'ar'],
    AR: ['es', 'en', 'it'],
    CL: ['es', 'en'],
    CO: ['es', 'en'],
};

const GLOBAL_FALLBACK = ['en', 'fr', 'es'] as const;

function optionForCode(code: string): StudioVoiceLangOption | undefined {
    const n = norm(code);
    return STUDIO_VOICE_LANG_OPTIONS.find((o) => norm(o.value) === n);
}

/**
 * Jusqu'à 3 codes langue pertinents : langue UI d'abord, puis indices zone, puis repli global.
 */
export function getSuggestedVoiceoverLanguageCodes(
    i18nLanguage: string,
    regionCode?: string | null,
): string[] {
    const base = norm(i18nLanguage || 'fr');
    const out: string[] = [];

    const primary = optionForCode(base)?.value ?? optionForCode('en')!.value;
    out.push(primary);

    const hints = (regionCode && REGION_VOICE_HINTS[regionCode.toUpperCase()]) || [...GLOBAL_FALLBACK];
    for (const h of hints) {
        const opt = optionForCode(h);
        if (opt && !out.some((x) => norm(x) === norm(opt.value))) {
            out.push(opt.value);
        }
        if (out.length >= 3) {
            return out;
        }
    }

    for (const g of GLOBAL_FALLBACK) {
        const opt = optionForCode(g);
        if (opt && !out.some((x) => norm(x) === norm(opt.value))) {
            out.push(opt.value);
        }
        if (out.length >= 3) {
            return out;
        }
    }

    for (const o of STUDIO_VOICE_LANG_OPTIONS) {
        if (out.length >= 3) {
            break;
        }
        if (!out.some((x) => norm(x) === norm(o.value))) {
            out.push(o.value);
        }
    }

    return out.slice(0, 3);
}

/**
 * Une langue « populaire dans la zone » pour sous-titre traduit (≠ langue principale).
 */
export function getSuggestedSubtitleTranslationLang(
    primarySubtitleLang: string,
    i18nLanguage: string,
    regionCode?: string | null,
): string | null {
    const primary = norm(primarySubtitleLang);
    const hints = (regionCode && REGION_VOICE_HINTS[regionCode.toUpperCase()]) || [...GLOBAL_FALLBACK];
    for (const h of hints) {
        const n = norm(h);
        if (n === primary) {
            continue;
        }
        const opt = optionForCode(h);
        if (opt) {
            return opt.value;
        }
    }
    const ui = norm(i18nLanguage);
    if (ui !== primary && optionForCode(ui)) {
        return optionForCode(ui)!.value;
    }
    const en = optionForCode('en');
    if (en && norm(en.value) !== primary) {
        return en.value;
    }
    const fr = optionForCode('fr');
    if (fr && norm(fr.value) !== primary) {
        return fr.value;
    }
    return null;
}

/** Alias — même liste que STUDIO_VOICE_LANG_OPTIONS */
export const VOICEOVER_LANG_OPTIONS = STUDIO_VOICE_LANG_OPTIONS;

export type VoiceoverLangCode = SupportedLanguage;
