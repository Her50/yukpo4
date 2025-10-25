/**
 * Fonctions utilitaires pour la gestion des services de santé
 * (Pharmacies, Cliniques, Hôpitaux)
 */

/**
 * Vérifie si une pharmacie est actuellement ouverte
 * @param pharmacie Objet pharmacie avec heures d'ouverture, type, etc.
 * @returns true si la pharmacie est ouverte maintenant
 */
export const isPharmacyOpenNow = (pharmacie: any): boolean => {
    if (!pharmacie) return false;

    const now = new Date();
    const currentDay = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][now.getDay()];
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    // Si permanence nuit (ouverte 24h/24)
    if (pharmacie.typePharmacie === 'Permanence nuit') {
        return true;
    }

    // Vérifier les heures d'ouverture normales
    if (pharmacie.heuresOuverture && pharmacie.heuresFermeture) {
        try {
            const [openH, openM] = pharmacie.heuresOuverture.split(':').map(Number);
            const [closeH, closeM] = pharmacie.heuresFermeture.split(':').map(Number);

            if (!isNaN(openH) && !isNaN(openM) && !isNaN(closeH) && !isNaN(closeM)) {
                const openTime = openH * 60 + openM;
                const closeTime = closeH * 60 + closeM;

                if (currentTime >= openTime && currentTime <= closeTime) {
                    return true;
                }
            }
        } catch (error) {
            console.error('[isPharmacyOpenNow] Erreur parsing heures:', error);
        }
    }

    // Vérifier si de garde ce jour (après 20h ou avant 8h)
    if (pharmacie.joursGarde && typeof pharmacie.joursGarde === 'string') {
        if (pharmacie.joursGarde.includes(currentDay) || pharmacie.joursGarde.includes('Tous les jours')) {
            // Horaires de nuit pour garde
            if (currentHour >= 20 || currentHour < 8) {
                return true;
            }
        }
    }

    return false;
};

/**
 * Retourne le statut de la pharmacie avec un message explicite
 * @param pharmacie Objet pharmacie
 * @returns Objet avec status, message et color
 */
export const getPharmacyStatus = (pharmacie: any): { status: string; message: string; color: string } => {
    if (isPharmacyOpenNow(pharmacie)) {
        return {
            status: 'open',
            message: '🟢 Ouvert maintenant',
            color: '#10B981'
        };
    }

    // Vérifier si de garde aujourd'hui mais pas maintenant
    const now = new Date();
    const currentDay = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][now.getDay()];

    if (pharmacie.joursGarde && pharmacie.joursGarde.includes(currentDay)) {
        return {
            status: 'garde',
            message: '🌙 De garde ce soir',
            color: '#3B82F6'
        };
    }

    return {
        status: 'closed',
        message: '🔴 Fermé actuellement',
        color: '#EF4444'
    };
};

/**
 * Vérifie si une clinique/hôpital offre une prestation à un moment donné
 * @param etablissement Objet établissement de santé
 * @param prestation Nom de la prestation recherchée
 * @param jour Jour de la semaine (ex: 'Lun', 'Mar')
 * @param moment Moment de la journée ('Journée', 'Nuit', '24h/24')
 * @returns true si la prestation est disponible
 */
export const isPrestationAvailable = (
    etablissement: any,
    prestation?: string,
    jour?: string,
    moment?: string
): boolean => {
    if (!etablissement || !etablissement.prestationsMedicales) {
        return false;
    }

    // Vérifier si la prestation existe
    if (prestation && !etablissement.prestationsMedicales.includes(prestation)) {
        return false;
    }

    // Si pas de critères horaires, la prestation est disponible
    if (!jour && !moment) {
        return true;
    }

    // Vérifier le planning de la prestation spécifique
    const planningHebdo = etablissement.planningHebdomadaire;
    if (!planningHebdo || !prestation) {
        return false;
    }

    const prestationPlanning = planningHebdo[prestation];
    if (!prestationPlanning) {
        return false;
    }

    // Vérifier le jour
    if (jour && prestationPlanning.jours) {
        if (!prestationPlanning.jours.includes(jour)) {
            return false;
        }
    }

    // Vérifier le moment
    if (moment && prestationPlanning.moment) {
        // Si 24h/24, toujours disponible
        if (prestationPlanning.moment === '24h/24') {
            return true;
        }
        // Sinon vérifier correspondance exacte
        if (prestationPlanning.moment !== moment) {
            return false;
        }
    }

    return true;
};

/**
 * Filtre les établissements qui offrent une prestation spécifique
 * @param etablissements Liste des établissements
 * @param prestations Liste des prestations recherchées
 * @param jour Jour de la semaine (optionnel)
 * @param moment Moment de la journée (optionnel)
 * @returns Liste filtrée des établissements
 */
export const filterEtablissementsByPrestation = (
    etablissements: any[],
    prestations?: string[],
    jour?: string,
    moment?: string
): any[] => {
    if (!prestations || prestations.length === 0) {
        return etablissements;
    }

    return etablissements.filter(etablissement => {
        // Vérifier si l'établissement offre AU MOINS UNE des prestations recherchées
        return prestations.some(prestation =>
            isPrestationAvailable(etablissement, prestation, jour, moment)
        );
    });
};

/**
 * Retourne le jour actuel en format court (Lun, Mar, etc.)
 */
export const getCurrentDayShort = (): string => {
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    return days[new Date().getDay()];
};

/**
 * Retourne le moment actuel (Journée ou Nuit)
 */
export const getCurrentMoment = (): string => {
    const hour = new Date().getHours();
    // Journée: 6h-20h, Nuit: 20h-6h
    return (hour >= 6 && hour < 20) ? 'Journée' : 'Nuit';
};

/**
 * Formate le planning d'une prestation pour affichage
 * @param planning Objet planning avec jours et moment
 * @returns String formaté pour affichage
 */
export const formatPrestationPlanning = (planning: any): string => {
    if (!planning) return '';

    const parts: string[] = [];

    if (planning.jours) {
        parts.push(`📅 ${planning.jours}`);
    }

    if (planning.moment) {
        if (planning.moment === '24h/24') {
            parts.push('🕐 24h/24');
        } else if (planning.moment === 'Journée') {
            parts.push('☀️ Journée');
        } else if (planning.moment === 'Nuit') {
            parts.push('🌙 Nuit');
        }
    }

    return parts.join(' • ');
};

/**
 * Compte le nombre de prestations disponibles à un moment donné
 * @param etablissement Établissement de santé
 * @param jour Jour de la semaine
 * @param moment Moment de la journée
 * @returns Nombre de prestations disponibles
 */
export const countAvailablePrestations = (
    etablissement: any,
    jour?: string,
    moment?: string
): number => {
    if (!etablissement || !etablissement.prestationsMedicales) {
        return 0;
    }

    return etablissement.prestationsMedicales.filter((prestation: string) =>
        isPrestationAvailable(etablissement, prestation, jour, moment)
    ).length;
};

/**
 * Vérifie si un établissement a des urgences disponibles maintenant
 * @param etablissement Établissement de santé
 * @returns true si urgences disponibles
 */
export const hasEmergencyAvailable = (etablissement: any): boolean => {
    if (!etablissement || !etablissement.prestationsMedicales) {
        return false;
    }

    // Vérifier si "Urgences 24h/24" est dans les prestations
    const hasUrgences = etablissement.prestationsMedicales.includes('Urgences 24h/24');

    if (!hasUrgences) {
        return false;
    }

    // Vérifier le planning des urgences
    const urgencesPlanning = etablissement.planningHebdomadaire?.['Urgences 24h/24'];

    // Si pas de planning défini, supposer que c'est 24h/24
    if (!urgencesPlanning) {
        return hasUrgences;
    }

    // Vérifier si disponible maintenant
    const currentDay = getCurrentDayShort();
    const currentMoment = getCurrentMoment();

    return isPrestationAvailable(etablissement, 'Urgences 24h/24', currentDay, currentMoment);
};

