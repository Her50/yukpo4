import SafeStorage from '../utils/safeStorage';

/** Son complet pour le Coach IA (navigation). Si false → visuel + vibration uniquement. */
const COACH_IA_SOUND_FULL_KEY = 'coaching_ia_sound_full';
/** Types dont le son est coupé (cloche + préférences par notification). JSON string[] */
const MUTED_SOUND_KEYS_KEY = 'notification_muted_sound_keys';

const parseKeys = (raw: string | null): string[] => {
    if (!raw) return [];
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
    } catch {
        return [];
    }
};

export const notificationUiPreferences = {
    /**
     * Son des notifs Coach IA (navigation) : **true** par défaut (pas de clé = son activé).
     * Désinstallation de l’app → AsyncStorage vidé → retour à ce défaut.
     */
    async getCoachIaSoundFull(): Promise<boolean> {
        const v = await SafeStorage.getItem(COACH_IA_SOUND_FULL_KEY).catch(() => null);
        if (v === null || v === undefined) return true;
        const s = String(v).trim().toLowerCase();
        if (s === '' || s === 'true' || s === '1') return true;
        if (s === 'false' || s === '0') return false;
        return true;
    },

    async setCoachIaSoundFull(enabled: boolean): Promise<void> {
        await SafeStorage.setItem(COACH_IA_SOUND_FULL_KEY, enabled ? 'true' : 'false');
    },

    async getMutedSoundKeys(): Promise<string[]> {
        const raw = await SafeStorage.getItem(MUTED_SOUND_KEYS_KEY).catch(() => null);
        return parseKeys(raw);
    },

    async muteSoundKey(key: string): Promise<void> {
        const k = String(key || '').trim();
        if (!k) return;
        const cur = await this.getMutedSoundKeys();
        if (cur.includes(k)) return;
        cur.push(k);
        await SafeStorage.setItem(MUTED_SOUND_KEYS_KEY, JSON.stringify(cur));
    },

    async unmuteSoundKey(key: string): Promise<void> {
        const k = String(key || '').trim();
        if (!k) return;
        const cur = (await this.getMutedSoundKeys()).filter((x) => x !== k);
        await SafeStorage.setItem(MUTED_SOUND_KEYS_KEY, JSON.stringify(cur));
    },

    coachSubtypeKey(subtype: string): string {
        return `coach:${String(subtype || '').trim()}`;
    },

    backendTypeKey(notificationType: string): string {
        return `backend:${String(notificationType || '').trim()}`;
    },

    async isCoachSubtypeSoundMuted(subtype: string): Promise<boolean> {
        const keys = await this.getMutedSoundKeys();
        return keys.includes(this.coachSubtypeKey(subtype));
    },

    async isBackendTypeSoundMuted(notificationType: string): Promise<boolean> {
        const keys = await this.getMutedSoundKeys();
        return keys.includes(this.backendTypeKey(notificationType));
    },
};
