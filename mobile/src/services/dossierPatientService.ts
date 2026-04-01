import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiGet, apiPost } from './api';

const CACHE_KEY = '@yukpo_dossier_patient';

export interface DossierPatient {
    groupe_sanguin?: string;
    allergies: string[];
    antecedents: string;
    traitements_en_cours: string;
    contact_urgence_nom?: string;
    contact_urgence_telephone?: string;
    partage_avec_medecin: boolean;
    updated_at?: string;
}

const defaultDossier: DossierPatient = {
    groupe_sanguin: '',
    allergies: [],
    antecedents: '',
    traitements_en_cours: '',
    contact_urgence_nom: '',
    contact_urgence_telephone: '',
    partage_avec_medecin: false,
};

export const dossierPatientService = {
    getDossier: async (): Promise<DossierPatient> => {
        try {
            const [local, remote] = await Promise.allSettled([
                AsyncStorage.getItem(CACHE_KEY),
                apiGet('/api/users/patient-profile'),
            ]);
            if (remote.status === 'fulfilled' && remote.value?.data) {
                const d = remote.value.data;
                await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(d));
                return d;
            }
            if (local.status === 'fulfilled' && local.value) return JSON.parse(local.value);
        } catch { /* ignore */ }
        return defaultDossier;
    },

    updateDossier: async (data: Partial<DossierPatient>): Promise<void> => {
        const current = await dossierPatientService.getDossier();
        const updated = { ...current, ...data, updated_at: new Date().toISOString() };
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updated));
        try { await apiPost('/api/users/patient-profile', updated); } catch { /* best effort */ }
    },

    clearDossier: async (): Promise<void> => {
        await AsyncStorage.removeItem(CACHE_KEY);
    },
};
