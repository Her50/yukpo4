/**
 * Utilitaires pour valider la disponibilité des tickets de voyage
 * Gère la désactivation automatique selon date/heure et places disponibles
 */

export interface TicketProduct {
    dateDepart: string; // Format: DD/MM/YYYY
    heureDepart: string; // Format: HH:MM
    seatMap?: Array<{
        status: string;
        type: string;
    }>;
    totalSeats?: number;
}

/**
 * Parse une date et heure de départ au format français
 * @param dateStr Format DD/MM/YYYY
 * @param timeStr Format HH:MM
 * @returns Date object ou null si invalide
 */
function parseDepartureDateTime(dateStr: string, timeStr: string): Date | null {
    try {
        // Parser date DD/MM/YYYY
        const dateParts = dateStr.split('/');
        if (dateParts.length !== 3) return null;
        
        const day = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1; // Mois commence à 0
        const year = parseInt(dateParts[2]);
        
        // Parser heure HH:MM
        const timeParts = timeStr.split(':');
        if (timeParts.length !== 2) return null;
        
        const hours = parseInt(timeParts[0]);
        const minutes = parseInt(timeParts[1]);
        
        // Créer la date
        const departureDate = new Date(year, month, day, hours, minutes);
        
        // Vérifier que la date est valide
        if (isNaN(departureDate.getTime())) return null;
        
        return departureDate;
    } catch (error) {
        console.error('Erreur parse date départ:', error);
        return null;
    }
}

/**
 * Vérifie si un ticket de voyage est encore valide et réservable
 * @returns Object avec status et raison
 */
export function isTicketStillValid(product: TicketProduct): {
    valid: boolean;
    reason?: string;
    daysUntilDeparture?: number;
    availableSeats?: number;
} {
    // Vérifier que les champs requis existent
    if (!product.dateDepart || !product.heureDepart) {
        return {
            valid: false,
            reason: 'Date ou heure de départ manquante'
        };
    }

    // Parser la date de départ
    const departureDate = parseDepartureDateTime(product.dateDepart, product.heureDepart);
    if (!departureDate) {
        return {
            valid: false,
            reason: 'Date ou heure de départ invalide'
        };
    }

    // Vérifier si la date est passée
    const now = new Date();
    if (departureDate <= now) {
        return {
            valid: false,
            reason: 'Le bus est déjà parti ou le départ est imminent'
        };
    }

    // Calculer les jours jusqu'au départ
    const msUntilDeparture = departureDate.getTime() - now.getTime();
    const daysUntilDeparture = Math.ceil(msUntilDeparture / (1000 * 60 * 60 * 24));

    // Compter les places disponibles
    const seatMap = product.seatMap || [];
    const availableSeats = seatMap.filter(
        s => s.status === 'available' && s.type !== 'driver'
    ).length;

    // Vérifier s'il reste des places
    if (availableSeats === 0) {
        return {
            valid: false,
            reason: 'Toutes les places sont réservées',
            daysUntilDeparture,
            availableSeats: 0
        };
    }

    // Ticket valide
    return {
        valid: true,
        daysUntilDeparture,
        availableSeats
    };
}

/**
 * Génère un message d'avertissement si le départ est proche
 */
export function getDepartureWarning(daysUntilDeparture: number): string | null {
    if (daysUntilDeparture === 0) {
        return '⚠️ Départ aujourd\'hui! Réservez vite!';
    } else if (daysUntilDeparture === 1) {
        return '⚠️ Départ demain!';
    } else if (daysUntilDeparture <= 3) {
        return `⚠️ Départ dans ${daysUntilDeparture} jours!`;
    }
    return null;
}

/**
 * Formatte le temps restant jusqu'au départ
 */
export function formatTimeUntilDeparture(dateStr: string, timeStr: string): string {
    const departureDate = parseDepartureDateTime(dateStr, timeStr);
    if (!departureDate) return 'Date invalide';
    
    const now = new Date();
    const msRemaining = departureDate.getTime() - now.getTime();
    
    if (msRemaining <= 0) return 'Départ passé';
    
    const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
    const hoursRemaining = Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (daysRemaining > 0) {
        return `Dans ${daysRemaining}j ${hoursRemaining}h`;
    } else {
        return `Dans ${hoursRemaining}h`;
    }
}

