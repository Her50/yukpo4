/**
 * Service d'internationalisation (i18n)
 * Support multi-langues
 */

// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import * as Localization from 'expo-localization';
import { I18n } from 'i18n-js';
import SafeStorage from '../utils/safeStorage';

const STORAGE_KEY = 'user_language';

// Traductions
const translations = {
    fr: {
        // Navigation
        home: 'Accueil',
        search: 'Rechercher',
        tickets: 'Mes tickets',
        profile: 'Profil',

        // Recherche
        departure_city: 'Ville de départ',
        arrival_city: 'Ville d\'arrivée',
        departure_date: 'Date de départ',
        search_tickets: 'Rechercher des tickets',
        round_trip: 'Aller-retour',

        // Résultats
        available_seats: 'Places disponibles',
        price: 'Prix',
        duration: 'Durée',
        distance: 'Distance',
        book_now: 'Réserver maintenant',

        // Réservation
        select_seats: 'Sélectionner les places',
        total: 'Total',
        confirm_booking: 'Confirmer la réservation',

        // Tickets
        my_tickets: 'Mes tickets',
        upcoming: 'À venir',
        past: 'Passés',
        cancelled: 'Annulés',
        view_ticket: 'Voir le ticket',
        share_ticket: 'Partager',

        // Messages
        booking_success: 'Réservation confirmée !',
        booking_error: 'Erreur lors de la réservation',
        loading: 'Chargement...',
        no_results: 'Aucun résultat trouvé',

        // Fidélité
        loyalty_points: 'Points de fidélité',
        level: 'Niveau',
        redeem_points: 'Échanger des points',
        available_rewards: 'Récompenses disponibles',
    },
    en: {
        // Navigation
        home: 'Home',
        search: 'Search',
        tickets: 'My tickets',
        profile: 'Profile',

        // Recherche
        departure_city: 'Departure city',
        arrival_city: 'Arrival city',
        departure_date: 'Departure date',
        search_tickets: 'Search tickets',
        round_trip: 'Round trip',

        // Résultats
        available_seats: 'Available seats',
        price: 'Price',
        duration: 'Duration',
        distance: 'Distance',
        book_now: 'Book now',

        // Réservation
        select_seats: 'Select seats',
        total: 'Total',
        confirm_booking: 'Confirm booking',

        // Tickets
        my_tickets: 'My tickets',
        upcoming: 'Upcoming',
        past: 'Past',
        cancelled: 'Cancelled',
        view_ticket: 'View ticket',
        share_ticket: 'Share',

        // Messages
        booking_success: 'Booking confirmed!',
        booking_error: 'Booking error',
        loading: 'Loading...',
        no_results: 'No results found',

        // Fidélité
        loyalty_points: 'Loyalty points',
        level: 'Level',
        redeem_points: 'Redeem points',
        available_rewards: 'Available rewards',
    },
    es: {
        // Navigation
        home: 'Inicio',
        search: 'Buscar',
        tickets: 'Mis billetes',
        profile: 'Perfil',

        // Recherche
        departure_city: 'Ciudad de salida',
        arrival_city: 'Ciudad de llegada',
        departure_date: 'Fecha de salida',
        search_tickets: 'Buscar billetes',
        round_trip: 'Ida y vuelta',

        // Résultats
        available_seats: 'Asientos disponibles',
        price: 'Precio',
        duration: 'Duración',
        distance: 'Distancia',
        book_now: 'Reservar ahora',

        // Réservation
        select_seats: 'Seleccionar asientos',
        total: 'Total',
        confirm_booking: 'Confirmar reserva',

        // Tickets
        my_tickets: 'Mis billetes',
        upcoming: 'Próximos',
        past: 'Pasados',
        cancelled: 'Cancelados',
        view_ticket: 'Ver billete',
        share_ticket: 'Compartir',

        // Messages
        booking_success: '¡Reserva confirmada!',
        booking_error: 'Error en la reserva',
        loading: 'Cargando...',
        no_results: 'No se encontraron resultados',

        // Fidélité
        loyalty_points: 'Puntos de fidelidad',
        level: 'Nivel',
        redeem_points: 'Canjear puntos',
        available_rewards: 'Recompensas disponibles',
    },
};

const i18n = new I18n(translations);

// Langue par défaut
i18n.defaultLocale = 'fr';
i18n.enableFallback = true;

class I18nService {
    private currentLocale: string = 'fr';

    constructor() {
        this.init();
    }

    private async init() {
        // Charger la langue sauvegardée
        const savedLanguage = await SafeStorage.getItem(STORAGE_KEY);
        if (savedLanguage) {
            this.setLocale(savedLanguage);
        } else {
            // Utiliser la langue du système
            const systemLocale = Localization.locale.split('-')[0];
            this.setLocale(systemLocale);
        }
    }

    /**
     * Définir la langue
     */
    async setLocale(locale: string) {
        if (translations[locale as keyof typeof translations]) {
            this.currentLocale = locale;
            i18n.locale = locale;
            await SafeStorage.setItem(STORAGE_KEY, locale);
        }
    }

    /**
     * Obtenir la langue actuelle
     */
    getLocale(): string {
        return this.currentLocale;
    }

    /**
     * Traduire une clé
     */
    t(key: string, params?: { [key: string]: any }): string {
        return i18n.t(key, params);
    }

    /**
     * Obtenir toutes les langues disponibles
     */
    getAvailableLocales(): string[] {
        return Object.keys(translations);
    }

    /**
     * Obtenir le nom de la langue
     */
    getLocaleName(locale: string): string {
        const names: { [key: string]: string } = {
            fr: 'Français',
            en: 'English',
            es: 'Español',
        };
        return names[locale] || locale;
    }
}

export const i18nService = new I18nService();
export const t = (key: string, params?: { [key: string]: any }) => i18nService.t(key, params);
export default i18nService;


