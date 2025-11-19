// 🌍 Context de Langue - Gestion globale de la langue de l'application
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface LanguageContextType {
    language: string;
    setLanguage: (lang: string) => void;
    t: (key: string, params?: Record<string, string | number>) => string; // Fonction de traduction
}

const LanguageContext = createContext<LanguageContextType>({
    language: 'fr',
    setLanguage: () => { },
    t: (key) => key,
});

const interpolate = (template: string, params?: Record<string, string | number>): string => {
    if (!params) {
        return template;
    }

    return Object.entries(params).reduce((acc, [paramKey, value]) => {
        const pattern = new RegExp(`{{\\s*${paramKey}\\s*}}`, 'g');
        return acc.replace(pattern, String(value));
    }, template);
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};

// ✅ HOOK SAFE: Fonctionne avec ou sans provider (ne crash jamais)
export const useLanguageSafe = () => {
    try {
        const context = useContext(LanguageContext);
        if (context) {
            return context;
        }
    } catch (error) {
        console.warn('[LanguageContext] Provider non disponible, utilisation du fallback français');
    }

    // Fallback si le provider n'existe pas
    return {
        language: 'fr',
        setLanguage: (lang: string) => {
            console.log('[LanguageContext] Fallback: setLanguage appelé mais provider absent:', lang);
        },
        t: (key: string, params?: Record<string, string | number>) => {
            // Retourner les traductions françaises par défaut
            const template = translations['fr']?.[key] || key;
            return interpolate(template, params);
        }
    };
};

interface LanguageProviderProps {
    children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
    const [language, setLanguageState] = useState<string>('fr');

    // Charger la langue sauvegardée au démarrage - VERSION SIMPLIFIÉE
    useEffect(() => {
        loadLanguage();
    }, []);

    const loadLanguage = async () => {
        try {
            const savedLanguage = await AsyncStorage.getItem('app_language');
            if (savedLanguage) {
                setLanguageState(savedLanguage);
            } else {
                // Par défaut français pour éviter les problèmes de GPS
                setLanguageState('fr');
                await AsyncStorage.setItem('app_language', 'fr');
            }
        } catch (error) {
            console.error('Erreur chargement langue:', error);
            // Fallback en cas d'erreur
            setLanguageState('fr');
        }
    };

    const detectLanguageFromGPS = async () => {
        try {
            console.log('[Language] 🛰️ Détection GPS activée - Démarrage...');

            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status === 'granted') {
                // ✅ CORRECTION: Timeout réduit pour éviter les blocages
                const locationPromise = Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced, // Moins précis mais plus rapide
                });

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('GPS timeout')), 8000) // Timeout réduit
                );

                const location = await Promise.race([locationPromise, timeoutPromise]) as any;
                const { latitude, longitude } = location.coords;
                console.log('[Language] 🛰️ GPS coordonnées:', latitude, longitude);

                // Déterminer la langue basée sur la région
                let detectedLang = 'fr'; // Par défaut français

                // Afrique francophone (Cameroun, Côte d'Ivoire, Sénégal, etc.)
                if (latitude >= -5 && latitude <= 20 && longitude >= -18 && longitude <= 20) {
                    detectedLang = 'fr';
                }
                // Afrique anglophone (Nigeria, Ghana, Kenya, etc.)
                else if (latitude >= -5 && latitude <= 15 && longitude >= 0 && longitude <= 45) {
                    detectedLang = 'en';
                }
                // Europe francophone
                else if (latitude >= 42 && latitude <= 51 && longitude >= -5 && longitude <= 10) {
                    detectedLang = 'fr';
                }
                // Europe anglophone
                else if (latitude >= 50 && latitude <= 60 && longitude >= -8 && longitude <= 2) {
                    detectedLang = 'en';
                }
                // Amérique du Nord
                else if (latitude >= 25 && latitude <= 50 && longitude >= -125 && longitude <= -65) {
                    detectedLang = 'en';
                }
                // Amérique Latine
                else if (latitude >= -55 && latitude <= 25 && longitude >= -120 && longitude <= -35) {
                    detectedLang = 'es';
                }

                console.log('[Language] 🌍 Langue détectée via GPS:', detectedLang);
                await setLanguage(detectedLang);
            } else {
                console.log('[Language] ⚠️ Permission GPS refusée, utilisation du français par défaut');
                await setLanguage('fr');
            }
        } catch (error) {
            console.error('[Language] ❌ Erreur détection GPS:', error);
            // Langue par défaut si erreur
            await setLanguage('fr');
        }
    };

    const setLanguage = async (lang: string) => {
        try {
            setLanguageState(lang);
            await AsyncStorage.setItem('app_language', lang);
            console.log('[Language] Langue changée:', lang);
        } catch (error) {
            console.error('Erreur sauvegarde langue:', error);
        }
    };

    // Fonction de traduction simple (à améliorer avec i18n)
    const t = (key: string, params?: Record<string, string | number>): string => {
        // TODO: Implémenter la vraie traduction avec i18n
        // Pour l'instant, retourne la clé
        const template = translations[language]?.[key] || translations['fr']?.[key] || key;
        return interpolate(template, params);
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

// Traductions complètes
const translations: { [lang: string]: { [key: string]: string } } = {
    fr: {
        // Navigation
        'home.title': 'Accueil',
        'home.welcome': 'Bienvenue',
        'services.title': 'Boutique | Services', // ✅ Modifié
        'activity.title': 'Activités',
        'activity.list_view': 'Liste',
        'activity.dashboard_view': 'Dashboard',
        'activity.all_services': 'Tous mes services',
        'interactions.title': 'Mes Interactions',
        'account.title': 'Mon Compte',

        // Périodes
        'period.7d': '7j',
        'period.30d': '30j',
        'period.90d': '90j',

        // Recherche
        'search.placeholder': 'Rechercher un service...',
        'search.create': 'Créer un service',
        'search.find': 'Rechercher',
        'search.results': 'Résultats de recherche',

        // Pages
        'settings.title': 'Paramètres',
        'contact.title': 'Contact',
        'services.catalog': 'Catalogue Services',
        'tokens.recharge': 'Recharger Tokens',
        'tokens.history': 'Historique de Consommation',
        'service.shared': 'Service partagé',

        // Boutons
        'button.create': 'Créer',
        'button.save': 'Enregistrer',
        'button.cancel': 'Annuler',
        'video.intro.title': 'Vidéo immersive Yukpo',
        'video.intro.subtitle': "Transforme ton service en spot viral en moins de 5 minutes grâce à Yukpo.",
        'video.intro.heroTitle': 'Création assistée',
        'video.intro.heroDescription': 'Templates TikTok-ready, b-roll IA, mastering audio premium — tout en un.',
        'video.intro.benefit.timeline': 'Timeline Remotion 9:16 ultra fluide',
        'video.intro.benefit.broll': 'B-roll IA & transitions 3D automatiques',
        'video.intro.benefit.audio': 'Mastering Dolby & SFX dynamiques',
        'video.intro.createButton': '🎬 Créer ma vidéo',
        'video.intro.exampleButton': 'Voir un exemple',
        'videoWizard.defaultProduct': 'Votre produit',
        'videoWizard.errors.serviceFetch': 'Impossible de charger le service.',
        'videoWizard.errors.invalidContext': 'Service ou produit manquant.',
        'videoWizard.errors.costEstimation': 'Impossible de valider le budget.',
        'videoWizard.errors.launchFailed': 'Échec du lancement de la génération',
        'videoWizard.errors.rendering': 'Impossible de lancer la génération.',
        'videoWizard.notifications.costReady': 'Budget validé ✅',
        'videoWizard.notifications.rendering': 'Génération en cours...',
        'videoWizard.notifications.renderComplete': 'Vidéo générée 🎬',
        'videoWizard.notifications.mediaReady': 'La vidéo est disponible dans ta médiathèque.',
        'videoWizard.notifications.noMedia': 'Ajoute des visuels dans ta médiathèque pour profiter du mode expert.',
        'videoWizard.alert.missingInfoTitle': 'Information manquante',
        'videoWizard.alert.serviceUnknown': 'Impossible de déterminer le service associé.',
        'videoWizard.alert.productUnknown': 'Produit introuvable pour cette vidéo.',
        'videoWizard.alert.estimationFailedTitle': 'Estimation impossible',
        'videoWizard.alert.retrySoon': 'Réessaie dans un instant.',
        'videoWizard.alert.serverError': 'Erreur côté serveur',
        'videoWizard.alert.renderDoneTitle': 'Rendu terminé',
        'videoWizard.alert.renderDoneMessage': 'La vidéo a été générée.',
        'videoWizard.alert.renderFailedTitle': 'Rendu impossible',
        'videoWizard.alert.renderFailedMessage': 'Veuillez réessayer.',
        'videoWizard.hero.title': 'Studio vidéo immersif Yukpo',
        'videoWizard.hero.subtitle': 'Compose des spots dignes de TikTok/Reels : timeline IA, b-roll génératif, mix audio Dolby et signature Yukpo intégrée.',
        'videoWizard.meta.service': 'Service',
        'videoWizard.meta.step': 'Étape',
        'videoWizard.meta.stepCounter': 'Étape {{step}}/3 · {{label}}',
        'videoWizard.meta.stepCountShort': 'Étape {{step}}/3',
        'videoWizard.inputs.serviceId': 'ID service',
        'videoWizard.inputs.productIndex': 'Index produit',
        'videoWizard.inputs.voiceover': 'Voix off',
        'videoWizard.inputs.music': 'Musique',
        'videoWizard.inputs.voicePremium': 'Voix premium',
        'videoWizard.sections.describe': 'Décris ton spot',
        'videoWizard.sections.style': 'Style & IA',
        'videoWizard.sections.audio': 'Musique & voix',
        'videoWizard.sections.media': 'Médias sélectionnés',
        'videoWizard.sections.epilogue': 'Avant-première & publication',
        'videoWizard.sections.summary': 'Résumé',
        'videoWizard.sections.context': 'Ton contexte',
        'videoWizard.sections.mode': 'Mode IA',
        'videoWizard.sections.publication': 'Publication',
        'videoWizard.steps.describe': 'Décris ta vidéo',
        'videoWizard.steps.assets': 'Sélectionne les assets',
        'videoWizard.steps.preview': 'Prévisualise et lance',
        'videoWizard.placeholders.brief': 'Ex : Promo de rentrée, 50% sur la formule premium',
        'videoWizard.placeholders.headline': 'Titre accrocheur (optionnel)',
        'videoWizard.placeholders.cta': 'Call-to-action (optionnel)',
        'videoWizard.placeholders.voiceLang': 'Langue (fr, en...)',
        'videoWizard.controls.storyboard': 'Storyboard IA',
        'videoWizard.controls.storyboardHint': 'Laisse Yukpo proposer 6 plans optimisés.',
        'videoWizard.controls.voiceover': 'Voix Yukpo',
        'videoWizard.controls.voiceoverHint': 'Narration générée avec tonalité naturelle & filtres Dolby.',
        'videoWizard.mode.standardTitle': 'Mode Créateur',
        'videoWizard.mode.standardDesc': 'Idéal si tu as déjà des visuels percutants.',
        'videoWizard.mode.expertTitle': 'Mode Expert IA',
        'videoWizard.mode.expertDesc': 'B-roll IA, LUT ciné, SFX synchronisés inclus.',
        'videoWizard.buttons.nextStep': 'Valider le budget',
        'videoWizard.buttons.prevStep': 'Retour étape {{step}}',
        'videoWizard.buttons.previewTimeline': 'Prévisualiser la timeline',
        'videoWizard.buttons.estimating': 'Estimation...',
        'videoWizard.buttons.rendering': 'Rendu en cours...',
        'videoWizard.buttons.launchRender': 'Lancer le rendu',
        'videoWizard.buttons.prevStepShort': 'Étape précédente',
        'videoWizard.buttons.nextStepGeneric': 'Étape suivante',
        'videoWizard.summary.service': 'Service',
        'videoWizard.summary.product': 'Produit',
        'videoWizard.summary.style': 'Style',
        'videoWizard.summary.mode': 'Mode',
        'videoWizard.summary.totalLocal': 'Total local',
        'videoWizard.summary.tokens': 'Tokens IA',
        'videoWizard.summary.breakdown': 'IA : {{tokens}} • Audio : {{audio}} • B-roll : {{broll}}',
        'videoWizard.summary.margin': 'Marge appliquée',
        'videoWizard.summary.affordable': 'Solde suffisant ✅',
        'videoWizard.summary.notAffordable': 'Solde insuffisant ❌',
        'videoWizard.summary.noCost': 'Valide d’abord le budget pour débloquer la prévisualisation.',
        'videoWizard.summary.finalConfirm': 'Prêt à mettre Yukpo en lumière ?',
        'videoWizard.summary.finalHint': 'Le rendu dure environ 30 à 90 secondes selon les assets IA.',
        'videoWizard.summary.mediaSelected': 'Médias sélectionnés',
        'videoWizard.summary.costTitle': 'Coût estimé',
        'videoWizard.summary.costLine': '~ {{usd}} $ / marge x{{multiplier}}',
        'videoWizard.progress.title': 'Progression du rendu',
        'videoWizard.progress.completed': 'Terminé',
        'videoWizard.progress.running': 'En cours',
        'videoWizard.progress.pending': 'À venir',
        'videoWizard.progress.jobId': 'Job ID : {{jobId}}',
        'videoWizard.progress.jobIdle': 'Lance un rendu pour suivre la timeline.',
        'videoWizard.result.title': 'Vidéo générée',
        'videoWizard.result.duration': 'Durée',
        'videoWizard.result.style': 'Style',
        'videoWizard.result.headline': 'Headline',
        'videoWizard.result.cta': 'CTA',
        'videoWizard.result.viewInNewTab': 'Ouvrir dans un nouvel onglet',
        'videoWizard.result.goToLibrary': 'Voir la médiathèque',
        'videoWizard.channels.chat': 'Chat Commerce',
        'videoWizard.channels.product': 'Carte Service',
        'videoWizard.channels.shorts': 'Shorts / Reels',
        'videoWizard.modal.title': 'Génération en cours',
        'videoWizard.modal.subtitle': 'Ton spot immersif est en préparation ✨',
        'button.edit': 'Modifier',
        'button.delete': 'Supprimer',
        'button.add': 'Ajouter',
        'button.close': 'Fermer',
        'button.back': 'Retour',
        'button.next': 'Suivant',
        'button.previous': 'Précédent',
        'button.confirm': 'Confirmer',
        'button.yes': 'Oui',
        'button.no': 'Non',

        // Produits
        'product.title': 'Produit',
        'product.name': 'Nom du produit',
        'product.price': 'Prix',
        'product.description': 'Description',
        'product.category': 'Catégorie',
        'product.images': 'Images',
        'product.videos': 'Vidéos',
        'product.add': 'Ajouter un produit',
        'product.edit': 'Modifier le produit',
        'product.delete': 'Supprimer le produit',
        'product.new': 'Nouveau produit',

        // Services
        'service.title': 'Service',
        'service.create': 'Créer un service',
        'service.edit': 'Modifier le service',
        'service.delete': 'Supprimer le service',
        'service.name': 'Nom du service',
        'service.description': 'Description du service',
        'service.category': 'Catégorie du service',

        // Messages
        'message.success': 'Succès',
        'message.error': 'Erreur',
        'message.loading': 'Chargement...',
        'message.no_data': 'Aucune donnée',
        'message.confirm_delete': 'Êtes-vous sûr de vouloir supprimer ?',

        // Formulaires
        'form.required': 'Ce champ est obligatoire',
        'form.invalid': 'Format invalide',
        'form.save_success': 'Enregistré avec succès',
        'form.save_error': 'Erreur lors de l\'enregistrement',

        // Géolocalisation
        'location.title': 'Localisation',
        'location.select': 'Sélectionner la localisation',
        'location.current': 'Position actuelle',
        'location.search': 'Rechercher un lieu',

        // Paiement
        'payment.title': 'Paiement',
        'payment.method': 'Méthode de paiement',
        'payment.mobile_money': 'Mobile Money',
        'payment.orange_money': 'Orange Money',
        'payment.visa': 'Carte Visa',
        'payment.phone': 'Numéro de téléphone',
        'payment.card_number': 'Numéro de carte',
        'payment.expiry': 'Date d\'expiration',

        // Chat
        'chat.title': 'Chat',
        'chat.message': 'Message',
        'chat.send': 'Envoyer',
        'chat.typing': 'En train d\'écrire...',
        'chat.online': 'En ligne',
        'chat.offline': 'Hors ligne',

        // Profil
        'profile.title': 'Profil',
        'profile.edit': 'Modifier le profil',
        'profile.name': 'Nom',
        'profile.email': 'Email',
        'profile.phone': 'Téléphone',
        'profile.address': 'Adresse',
        'profile.avatar': 'Photo de profil',

        // Statistiques
        'stats.title': 'Statistiques',
        'stats.views': 'Vues',
        'stats.interactions': 'Interactions',
        'stats.balance': 'Solde',
        'stats.budget': 'Budget',
        'stats.total': 'Total',

        // Video Analytics
        'video.analytics.title': 'Performance du flux vidéo',
        'video.analytics.subtitle': 'Derniers {{days}} jours — priorise les contenus ayant généré des interactions significatives.',
        'video.analytics.loader': 'Chargement des analytics...',
        'video.analytics.tabs.content': 'Contenus',
        'video.analytics.tabs.live': 'Lives',
        'video.analytics.errors.serverNoAnalytics': 'Le serveur n\'a pas pu fournir les analytics.',
        'video.analytics.errors.contentUnavailable': 'Impossible de récupérer les analytics.',
        'video.analytics.errors.liveUnavailable': 'Impossible de récupérer les analytics des lives.',
        'video.analytics.errors.overviewUnavailable': 'Impossible de récupérer la synthèse vidéo.',
        'video.analytics.errors.unexpected': 'Erreur inattendue lors du chargement des analytics.',
        'video.analytics.overview.title': 'Synthèse vidéo IA',
        'video.analytics.overview.horizon': 'Horizon {{days}} jours',
        'video.analytics.overview.generated': 'Vidéos générées',
        'video.analytics.overview.views': 'Vues totales',
        'video.analytics.overview.shares': 'Partages',
        'video.analytics.overview.qualityLabel': 'Score qualité moyen',
        'video.analytics.overview.distributionLabel': 'Distribution',
        'video.analytics.overview.successRate': '{{percent}}% ok',
        'video.analytics.overview.published': '{{count}} publiées',
        'video.analytics.overview.pending': '{{count}} en file',
        'video.analytics.overview.unexpected': 'Réponse inattendue pour la synthèse vidéo.',
        'video.analytics.summary.impressions': 'Impressions',
        'video.analytics.summary.clicks': 'Clics',
        'video.analytics.summary.ctr': 'CTR',
        'video.analytics.summary.avgDuration': 'Durée moyenne',
        'video.analytics.breakdown.title': 'Répartition par type',
        'video.analytics.breakdown.type.paid': 'Sponsorisé',
        'video.analytics.breakdown.type.organic': 'Organique',
        'video.analytics.breakdown.impressions': 'Impressions',
        'video.analytics.breakdown.ctr': 'CTR',
        'video.analytics.breakdown.avgDuration': 'Durée moyenne',
        'video.analytics.top.title': 'Top contenus',
        'video.analytics.top.seenAt': 'Vu le {{date}}',
        'video.analytics.top.labels.impressions': 'Impressions',
        'video.analytics.top.labels.ctr': 'CTR',
        'video.analytics.top.labels.duration': 'Durée',
        'video.analytics.top.labels.likes': 'Likes',
        'video.analytics.top.labels.saves': 'Enregistrements',
        'video.analytics.top.labels.clicks': 'Clics',
        'video.analytics.live.title': 'Lives récents',
        'video.analytics.live.empty': 'Aucun live analysé pour l’instant.',
        'video.analytics.live.emptyHint': 'Lancez un live pour voir ses performances ici.',
        'video.analytics.live.status.live': 'En direct',
        'video.analytics.live.status.scheduled': 'Planifié',
        'video.analytics.live.status.replayReady': 'Replay prêt',
        'video.analytics.live.status.ended': 'Terminé',
        'video.analytics.live.status.unknown': 'Inconnu',
        'video.analytics.live.metrics.audienceTotal': 'Audience totale',
        'video.analytics.live.metrics.hls': 'HLS',
        'video.analytics.live.metrics.webrtc': 'WebRTC',
        'video.analytics.live.metrics.totalWatchTime': 'Durée cumulée',
        'video.analytics.live.metrics.avgWatchTime': 'Durée moyenne',
        'video.analytics.live.metrics.conversions': 'Conversions',
        'video.analytics.live.metrics.revenue': 'Revenus',
        'video.analytics.marketing.title.generic': 'Promotion IA',
        'video.analytics.marketing.title.teaser': 'Teaser promotionnel',
        'video.analytics.marketing.title.invites': 'Invitations multi-canaux',
        'video.analytics.marketing.title.followup': 'Compte-rendu & suivi',
        'video.analytics.marketing.loading': 'Génération en cours...',
        'video.analytics.marketing.ready': 'Prêt à générer une campagne IA pour ce live.',
        'video.analytics.marketing.promptSelection': 'Sélectionnez un live pour générer une campagne IA.',
        'video.analytics.marketing.error.default': 'Impossible de générer la promotion IA.',
        'video.analytics.marketing.error.unexpected': 'Erreur inattendue lors de la génération IA.',
        'video.analytics.marketing.labels.hook': 'Accroche',
        'video.analytics.marketing.labels.teaserScript': 'Script teaser',
        'video.analytics.marketing.labels.cta': 'Appel à l’action',
        'video.analytics.marketing.labels.pushNotification': 'Notification push',
        'video.analytics.marketing.labels.emailSubject': 'Sujet email',
        'video.analytics.marketing.labels.emailBody': 'Email',
        'video.analytics.marketing.labels.visualDirection': 'Direction visuelle',
        'video.analytics.marketing.labels.hashtags': 'Hashtags',
        'video.analytics.marketing.labels.talkingPoints': 'Points à aborder',
        'video.analytics.marketing.labels.checklist': 'Checklist préparation',
        'video.analytics.marketing.labels.sms': 'SMS',
        'video.analytics.marketing.labels.socialPost': 'Publication sociale',
        'video.analytics.marketing.labels.executiveSummary': 'Résumé exécutif',
        'video.analytics.marketing.labels.moments': 'Moments forts',
        'video.analytics.marketing.labels.followupEmail': 'Email de suivi',
        'video.analytics.marketing.labels.recommendedActions': 'Actions recommandées',
        'video.analytics.marketing.labels.productFocus': 'Produit à mettre en avant',
        'video.analytics.marketing.buttons.teaser': 'Teaser IA',
        'video.analytics.marketing.buttons.invites': 'Invitations IA',
        'video.analytics.marketing.buttons.followup': 'Follow-up IA',
        'video.analytics.units.secondsShort': 's',
        'video.analytics.units.minutesShort': 'min',
        'video.analytics.units.hoursShort': 'h',
        'video.analytics.units.cfa': 'CFA',

        // Langues
        'language.title': 'Langue',
        'language.french': 'Français',
        'language.english': 'English',
        'language.spanish': 'Español',
        'language.chinese': '中文',
        'language.hindi': 'हिन्दी',
        'language.arabic': 'العربية',
        'language.russian': 'Русский',

        // Électricien
        'electrician.prestation_type': 'Type de prestation',
        'electrician.specialties': 'Spécialités',
        'electrician.equipment': 'Équipements concernés',
        'electrician.availability': 'Disponibilité',
        'electrician.guarantee': 'Garantie travaux',
        'electrician.certifications': 'Certifications',
        'electrician.emergency_24h': 'Urgence 24h/24',
        'electrician.free_quote': 'Devis gratuit',
        'electrician.work_zone': 'Zones d\'intervention',
        'electrician.types.installation': 'Installation',
        'electrician.types.repair': 'Réparation',
        'electrician.types.emergency': 'Dépannage',
        'electrician.types.standards': 'Mise aux normes',
        'electrician.types.diagnostic': 'Diagnostic',
        'electrician.types.renovation': 'Rénovation',

        // Publicité
        'publicite.create': 'Créer une publicité',
        'publicite.title': 'Titre de la publicité',
        'publicite.description': 'Description',
        'publicite.products': 'Produits à promouvoir',
        'publicite.videos': 'Vidéos promotionnelles',
        'publicite.duration': 'Durée (jours)',
        'publicite.zone': 'Zone géographique',
        'publicite.zone.select': 'Sélectionner la zone d\'impact',
        'publicite.zone.local': 'Local (ville)',
        'publicite.zone.regional': 'Régional (pays)',
        'publicite.zone.international': 'International',
        'publicite.pricing': 'Tarification',
        'publicite.price_per_day': '500 FCFA par jour',
        'publicite.total_cost': 'Coût total',
        'publicite.summary': 'Résumé et facturation',
        'publicite.products_selected': 'Produits sélectionnés',
        'publicite.videos_added': 'Vidéos ajoutées',
        'publicite.balance_insufficient': 'Solde insuffisant',
        'publicite.recharge_account': 'Veuillez recharger votre compte',
        'publicite.create_success': 'Publicité créée avec succès',
        'publicite.dashboard': 'Tableau de bord publicité',
        'publicite.analytics': 'Analytics',
        'publicite.views': 'Vues',
        'publicite.clicks': 'Clics',
        'publicite.conversion_rate': 'Taux de conversion',
        'publicite.active': 'Active',
        'publicite.expired': 'Expirée',
        'publicite.promotions': 'Promotions du moment',
        'publicite.selected_for_you': 'Sélectionnées pour vous',
        'publicite.discover_offers': 'Découvrez les offres',
    },
    en: {
        // Navigation
        'home.title': 'Home',
        'home.welcome': 'Welcome',
        'services.title': 'Shop | Services', // ✅ Modifié
        'activity.title': 'Activity',
        'activity.list_view': 'List',
        'activity.dashboard_view': 'Dashboard',
        'activity.all_services': 'All my services',
        'interactions.title': 'My Interactions',
        'account.title': 'My Account',

        // Periods
        'period.7d': '7d',
        'period.30d': '30d',
        'period.90d': '90d',

        // Search
        'search.placeholder': 'Search for a service...',
        'search.create': 'Create a service',
        'search.find': 'Search',
        'search.results': 'Search results',

        // Pages
        'settings.title': 'Settings',
        'contact.title': 'Contact',
        'services.catalog': 'Services Catalog',
        'tokens.recharge': 'Recharge Tokens',
        'tokens.history': 'Consumption History',
        'service.shared': 'Shared service',

        // Buttons
        'button.create': 'Create',
        'button.save': 'Save',
        'button.cancel': 'Cancel',
        'video.intro.title': 'Yukpo immersive video',
        'video.intro.subtitle': 'Turn your service into a viral spot in under 5 minutes with AI.',
        'video.intro.heroTitle': 'Guided creation',
        'video.intro.heroDescription': 'TikTok-ready templates, AI b-roll, premium audio mastering — all-in-one.',
        'video.intro.benefit.timeline': 'Ultra-smooth 9:16 Remotion timeline',
        'video.intro.benefit.broll': 'AI b-roll & 3D transitions',
        'video.intro.benefit.audio': 'Dolby mastering & dynamic SFX',
        'video.intro.createButton': '🎬 Create my video',
        'video.intro.exampleButton': 'See an example',
        'videoWizard.defaultProduct': 'Your product',
        'videoWizard.errors.serviceFetch': 'Unable to load service.',
        'videoWizard.errors.invalidContext': 'Missing service or product.',
        'videoWizard.errors.costEstimation': 'Budget validation failed.',
        'videoWizard.errors.launchFailed': 'Failed to start generation',
        'videoWizard.errors.rendering': 'Unable to start the rendering.',
        'videoWizard.notifications.costReady': 'Budget validated ✅',
        'videoWizard.notifications.rendering': 'Generation in progress...',
        'videoWizard.notifications.renderComplete': 'Video generated 🎬',
        'videoWizard.notifications.mediaReady': 'The video is available in your media library.',
        'videoWizard.notifications.noMedia': 'Add visuals to your library to enjoy expert mode.',
        'videoWizard.alert.missingInfoTitle': 'Missing information',
        'videoWizard.alert.serviceUnknown': 'Unable to determine the related service.',
        'videoWizard.alert.productUnknown': 'Product not found for this video.',
        'videoWizard.alert.estimationFailedTitle': 'Estimation failed',
        'videoWizard.alert.retrySoon': 'Try again in a moment.',
        'videoWizard.alert.serverError': 'Server error',
        'videoWizard.alert.renderDoneTitle': 'Render complete',
        'videoWizard.alert.renderDoneMessage': 'The video has been generated.',
        'videoWizard.alert.renderFailedTitle': 'Render failed',
        'videoWizard.alert.renderFailedMessage': 'Please try again.',
        'videoWizard.hero.title': 'Yukpo Immersive Video Studio',
        'videoWizard.hero.subtitle': 'Create TikTok/Reels-level clips: AI timeline, generative b-roll, Dolby mix, and Yukpo signature.',
        'videoWizard.meta.service': 'Service',
        'videoWizard.meta.step': 'Step',
        'videoWizard.meta.stepCounter': 'Step {{step}}/3 · {{label}}',
        'videoWizard.meta.stepCountShort': 'Step {{step}}/3',
        'videoWizard.inputs.serviceId': 'Service ID',
        'videoWizard.inputs.productIndex': 'Product index',
        'videoWizard.inputs.voiceover': 'Voice-over',
        'videoWizard.inputs.music': 'Music',
        'videoWizard.inputs.voicePremium': 'Premium voice',
        'videoWizard.sections.describe': 'Describe your spot',
        'videoWizard.sections.style': 'Style & AI',
        'videoWizard.sections.audio': 'Music & voice',
        'videoWizard.sections.media': 'Selected media',
        'videoWizard.sections.epilogue': 'Preview & publishing',
        'videoWizard.sections.summary': 'Summary',
        'videoWizard.sections.context': 'Your context',
        'videoWizard.sections.mode': 'AI mode',
        'videoWizard.sections.publication': 'Distribution',
        'videoWizard.steps.describe': 'Describe your video',
        'videoWizard.steps.assets': 'Select assets',
        'videoWizard.steps.preview': 'Preview & launch',
        'videoWizard.placeholders.brief': 'Ex: Limited edition launch, wow effect, CTA Instagram DM',
        'videoWizard.placeholders.headline': 'Catchy headline (optional)',
        'videoWizard.placeholders.cta': 'Call-to-action (optional)',
        'videoWizard.placeholders.voiceLang': 'Language (fr, en...)',
        'videoWizard.controls.storyboard': 'AI Storyboard',
        'videoWizard.controls.storyboardHint': 'Let Yukpo suggest 6 optimized shots.',
        'videoWizard.controls.voiceover': 'Yukpo Voice',
        'videoWizard.controls.voiceoverHint': 'Narration generated with natural tone and Dolby filters.',
        'videoWizard.mode.standardTitle': 'Creator Mode',
        'videoWizard.mode.standardDesc': 'Perfect if you already have strong visuals.',
        'videoWizard.mode.expertTitle': 'AI Expert Mode',
        'videoWizard.mode.expertDesc': 'Includes AI b-roll, cinema LUTs, synchronized SFX.',
        'videoWizard.buttons.nextStep': 'Validate budget',
        'videoWizard.buttons.prevStep': 'Back to step {{step}}',
        'videoWizard.buttons.previewTimeline': 'Preview timeline',
        'videoWizard.buttons.estimating': 'Estimating...',
        'videoWizard.buttons.rendering': 'Rendering...',
        'videoWizard.buttons.launchRender': 'Launch render',
        'videoWizard.buttons.prevStepShort': 'Previous step',
        'videoWizard.buttons.nextStepGeneric': 'Next step',
        'videoWizard.summary.service': 'Service',
        'videoWizard.summary.product': 'Product',
        'videoWizard.summary.style': 'Style',
        'videoWizard.summary.mode': 'Mode',
        'videoWizard.summary.totalLocal': 'Local total',
        'videoWizard.summary.tokens': 'AI tokens',
        'videoWizard.summary.breakdown': 'AI: {{tokens}} • Audio: {{audio}} • B-roll: {{broll}}',
        'videoWizard.summary.margin': 'Applied margin',
        'videoWizard.summary.affordable': 'Enough balance ✅',
        'videoWizard.summary.notAffordable': 'Insufficient balance ❌',
        'videoWizard.summary.noCost': 'Validate the budget first to unlock preview.',
        'videoWizard.summary.finalConfirm': 'Ready to spotlight Yukpo?',
        'videoWizard.summary.finalHint': 'Rendering takes 30 to 90 seconds depending on AI assets.',
        'videoWizard.summary.mediaSelected': 'Selected media',
        'videoWizard.summary.costTitle': 'Estimated cost',
        'videoWizard.summary.costLine': '~ {{usd}} $ / margin x{{multiplier}}',
        'videoWizard.progress.title': 'Render progress',
        'videoWizard.progress.completed': 'Completed',
        'videoWizard.progress.running': 'In progress',
        'videoWizard.progress.pending': 'Upcoming',
        'videoWizard.progress.jobId': 'Job ID: {{jobId}}',
        'videoWizard.progress.jobIdle': 'Start a render to follow the timeline.',
        'videoWizard.result.title': 'Generated video',
        'videoWizard.result.duration': 'Duration',
        'videoWizard.result.style': 'Style',
        'videoWizard.result.headline': 'Headline',
        'videoWizard.result.cta': 'CTA',
        'videoWizard.result.viewInNewTab': 'Open in new tab',
        'videoWizard.result.goToLibrary': 'Go to media library',
        'videoWizard.channels.chat': 'Chat Commerce',
        'videoWizard.channels.product': 'Service card',
        'videoWizard.channels.shorts': 'Shorts / Reels',
        'videoWizard.modal.title': 'Rendering in progress',
        'videoWizard.modal.subtitle': 'Your immersive spot is being assembled ✨',
        'button.edit': 'Edit',
        'button.delete': 'Delete',
        'button.add': 'Add',
        'button.close': 'Close',
        'button.back': 'Back',
        'button.next': 'Next',
        'button.previous': 'Previous',
        'button.confirm': 'Confirm',
        'button.yes': 'Yes',
        'button.no': 'No',

        // Products
        'product.title': 'Product',
        'product.name': 'Product name',
        'product.price': 'Price',
        'product.description': 'Description',
        'product.category': 'Category',
        'product.images': 'Images',
        'product.videos': 'Videos',
        'product.add': 'Add product',
        'product.edit': 'Edit product',
        'product.delete': 'Delete product',
        'product.new': 'New product',

        // Services
        'service.title': 'Service',
        'service.create': 'Create service',
        'service.edit': 'Edit service',
        'service.delete': 'Delete service',
        'service.name': 'Service name',
        'service.description': 'Service description',
        'service.category': 'Service category',

        // Messages
        'message.success': 'Success',
        'message.error': 'Error',
        'message.loading': 'Loading...',
        'message.no_data': 'No data',
        'message.confirm_delete': 'Are you sure you want to delete?',

        // Forms
        'form.required': 'This field is required',
        'form.invalid': 'Invalid format',
        'form.save_success': 'Saved successfully',
        'form.save_error': 'Error saving',

        // Location
        'location.title': 'Location',
        'location.select': 'Select location',
        'location.current': 'Current position',
        'location.search': 'Search place',

        // Payment
        'payment.title': 'Payment',
        'payment.method': 'Payment method',
        'payment.mobile_money': 'Mobile Money',
        'payment.orange_money': 'Orange Money',
        'payment.visa': 'Visa Card',
        'payment.phone': 'Phone number',
        'payment.card_number': 'Card number',
        'payment.expiry': 'Expiry date',

        // Chat
        'chat.title': 'Chat',
        'chat.message': 'Message',
        'chat.send': 'Send',
        'chat.typing': 'Typing...',
        'chat.online': 'Online',
        'chat.offline': 'Offline',

        // Profile
        'profile.title': 'Profile',
        'profile.edit': 'Edit profile',
        'profile.name': 'Name',
        'profile.email': 'Email',
        'profile.phone': 'Phone',
        'profile.address': 'Address',
        'profile.avatar': 'Profile picture',

        // Statistics
        'stats.title': 'Statistics',
        'stats.views': 'Views',
        'stats.interactions': 'Interactions',
        'stats.balance': 'Balance',
        'stats.budget': 'Budget',
        'stats.total': 'Total',

        // Video Analytics
        'video.analytics.title': 'Video performance',
        'video.analytics.subtitle': 'Last {{days}} days — highlights content driving meaningful interactions.',
        'video.analytics.loader': 'Loading analytics...',
        'video.analytics.tabs.content': 'Content',
        'video.analytics.tabs.live': 'Live',
        'video.analytics.errors.serverNoAnalytics': 'The server could not provide analytics.',
        'video.analytics.errors.contentUnavailable': 'Unable to fetch analytics.',
        'video.analytics.errors.liveUnavailable': 'Unable to fetch live analytics.',
        'video.analytics.errors.overviewUnavailable': 'Unable to fetch the video overview.',
        'video.analytics.errors.unexpected': 'Unexpected error while loading analytics.',
        'video.analytics.overview.title': 'AI video overview',
        'video.analytics.overview.horizon': '{{days}}-day horizon',
        'video.analytics.overview.generated': 'Videos generated',
        'video.analytics.overview.views': 'Total views',
        'video.analytics.overview.shares': 'Shares',
        'video.analytics.overview.qualityLabel': 'Average quality score',
        'video.analytics.overview.distributionLabel': 'Distribution',
        'video.analytics.overview.successRate': '{{percent}}% ok',
        'video.analytics.overview.published': '{{count}} published',
        'video.analytics.overview.pending': '{{count}} queued',
        'video.analytics.overview.unexpected': 'Unexpected response for the video overview.',
        'video.analytics.summary.impressions': 'Impressions',
        'video.analytics.summary.clicks': 'Clicks',
        'video.analytics.summary.ctr': 'CTR',
        'video.analytics.summary.avgDuration': 'Average duration',
        'video.analytics.breakdown.title': 'Breakdown by type',
        'video.analytics.breakdown.type.paid': 'Sponsored',
        'video.analytics.breakdown.type.organic': 'Organic',
        'video.analytics.breakdown.impressions': 'Impressions',
        'video.analytics.breakdown.ctr': 'CTR',
        'video.analytics.breakdown.avgDuration': 'Average duration',
        'video.analytics.top.title': 'Top content',
        'video.analytics.top.seenAt': 'Seen on {{date}}',
        'video.analytics.top.labels.impressions': 'Impressions',
        'video.analytics.top.labels.ctr': 'CTR',
        'video.analytics.top.labels.duration': 'Duration',
        'video.analytics.top.labels.likes': 'Likes',
        'video.analytics.top.labels.saves': 'Saves',
        'video.analytics.top.labels.clicks': 'Clicks',
        'video.analytics.live.title': 'Recent lives',
        'video.analytics.live.empty': 'No live has been analysed yet.',
        'video.analytics.live.emptyHint': 'Start a live session to monitor its performance here.',
        'video.analytics.live.status.live': 'Live',
        'video.analytics.live.status.scheduled': 'Scheduled',
        'video.analytics.live.status.replayReady': 'Replay ready',
        'video.analytics.live.status.ended': 'Ended',
        'video.analytics.live.status.unknown': 'Unknown',
        'video.analytics.live.metrics.audienceTotal': 'Total audience',
        'video.analytics.live.metrics.hls': 'HLS',
        'video.analytics.live.metrics.webrtc': 'WebRTC',
        'video.analytics.live.metrics.totalWatchTime': 'Total watch time',
        'video.analytics.live.metrics.avgWatchTime': 'Average watch time',
        'video.analytics.live.metrics.conversions': 'Conversions',
        'video.analytics.live.metrics.revenue': 'Revenue',
        'video.analytics.marketing.title.generic': 'AI promotion',
        'video.analytics.marketing.title.teaser': 'Promotional teaser',
        'video.analytics.marketing.title.invites': 'Multi-channel invites',
        'video.analytics.marketing.title.followup': 'Follow-up & recap',
        'video.analytics.marketing.loading': 'Generating...',
        'video.analytics.marketing.ready': 'Ready to generate an AI campaign for this live.',
        'video.analytics.marketing.promptSelection': 'Select a live session to generate an AI campaign.',
        'video.analytics.marketing.error.default': 'Unable to generate the AI promotion.',
        'video.analytics.marketing.error.unexpected': 'Unexpected error while generating the AI campaign.',
        'video.analytics.marketing.labels.hook': 'Hook',
        'video.analytics.marketing.labels.teaserScript': 'Teaser script',
        'video.analytics.marketing.labels.cta': 'Call-to-action',
        'video.analytics.marketing.labels.pushNotification': 'Push notification',
        'video.analytics.marketing.labels.emailSubject': 'Email subject',
        'video.analytics.marketing.labels.emailBody': 'Email',
        'video.analytics.marketing.labels.visualDirection': 'Visual direction',
        'video.analytics.marketing.labels.hashtags': 'Hashtags',
        'video.analytics.marketing.labels.talkingPoints': 'Talking points',
        'video.analytics.marketing.labels.checklist': 'Preparation checklist',
        'video.analytics.marketing.labels.sms': 'SMS',
        'video.analytics.marketing.labels.socialPost': 'Social post',
        'video.analytics.marketing.labels.executiveSummary': 'Executive summary',
        'video.analytics.marketing.labels.moments': 'Highlights',
        'video.analytics.marketing.labels.followupEmail': 'Follow-up email',
        'video.analytics.marketing.labels.recommendedActions': 'Recommended actions',
        'video.analytics.marketing.labels.productFocus': 'Product to highlight',
        'video.analytics.marketing.buttons.teaser': 'AI teaser',
        'video.analytics.marketing.buttons.invites': 'AI invites',
        'video.analytics.marketing.buttons.followup': 'AI follow-up',
        'video.analytics.units.secondsShort': 's',
        'video.analytics.units.minutesShort': 'min',
        'video.analytics.units.hoursShort': 'h',
        'video.analytics.units.cfa': 'CFA',

        // Electrician
        'electrician.prestation_type': 'Service type',
        'electrician.specialties': 'Specialties',
        'electrician.equipment': 'Equipment concerned',
        'electrician.availability': 'Availability',
        'electrician.guarantee': 'Work guarantee',
        'electrician.certifications': 'Certifications',
        'electrician.emergency_24h': 'Emergency 24/7',
        'electrician.free_quote': 'Free quote',
        'electrician.work_zone': 'Coverage area',
        'electrician.types.installation': 'Installation',
        'electrician.types.repair': 'Repair',
        'electrician.types.emergency': 'Emergency',
        'electrician.types.standards': 'Standards compliance',
        'electrician.types.diagnostic': 'Diagnostic',
        'electrician.types.renovation': 'Renovation',

        // Languages
        'language.title': 'Language',
        'language.french': 'Français',
        'language.english': 'English',
        'language.spanish': 'Español',
        'language.chinese': '中文',
        'language.hindi': 'हिन्दी',
        'language.arabic': 'العربية',
        'language.russian': 'Русский',

        // Advertisement
        'publicite.create': 'Create advertisement',
        'publicite.title': 'Advertisement title',
        'publicite.description': 'Description',
        'publicite.products': 'Products to promote',
        'publicite.videos': 'Promotional videos',
        'publicite.duration': 'Duration (days)',
        'publicite.zone': 'Geographic zone',
        'publicite.zone.select': 'Select impact zone',
        'publicite.zone.local': 'Local (city)',
        'publicite.zone.regional': 'Regional (country)',
        'publicite.zone.international': 'International',
        'publicite.pricing': 'Pricing',
        'publicite.price_per_day': '500 FCFA per day',
        'publicite.total_cost': 'Total cost',
        'publicite.summary': 'Summary and billing',
        'publicite.products_selected': 'Products selected',
        'publicite.videos_added': 'Videos added',
        'publicite.balance_insufficient': 'Insufficient balance',
        'publicite.recharge_account': 'Please recharge your account',
        'publicite.create_success': 'Advertisement created successfully',
        'publicite.dashboard': 'Advertisement dashboard',
        'publicite.analytics': 'Analytics',
        'publicite.views': 'Views',
        'publicite.clicks': 'Clicks',
        'publicite.conversion_rate': 'Conversion rate',
        'publicite.active': 'Active',
        'publicite.expired': 'Expired',
        'publicite.promotions': 'Current promotions',
        'publicite.selected_for_you': 'Selected for you',
        'publicite.discover_offers': 'Discover offers',
    },
    es: {
        // Navigation
        'home.title': 'Inicio',
        'home.welcome': 'Bienvenido',
        'services.title': 'Tienda | Servicios', // ✅ Modifié
        'activity.title': 'Actividad',
        'activity.list_view': 'Lista',
        'activity.dashboard_view': 'Panel',
        'activity.all_services': 'Todos mis servicios',
        'interactions.title': 'Mis Interacciones',
        'account.title': 'Mi Cuenta',

        // Períodos
        'period.7d': '7d',
        'period.30d': '30d',
        'period.90d': '90d',

        // Search
        'search.placeholder': 'Buscar un servicio...',
        'search.create': 'Crear un servicio',
        'search.find': 'Buscar',
        'search.results': 'Resultados de búsqueda',

        // Pages
        'settings.title': 'Configuración',
        'contact.title': 'Contacto',
        'services.catalog': 'Catálogo de Servicios',
        'tokens.recharge': 'Recargar Tokens',
        'tokens.history': 'Historial de Consumo',
        'service.shared': 'Servicio compartido',

        // Buttons
        'button.create': 'Crear',
        'button.save': 'Guardar',
        'button.cancel': 'Cancelar',
        'button.edit': 'Editar',
        'button.delete': 'Eliminar',
        'button.add': 'Agregar',
        'button.close': 'Cerrar',
        'button.back': 'Atrás',
        'button.next': 'Siguiente',
        'button.previous': 'Anterior',
        'button.confirm': 'Confirmar',
        'button.yes': 'Sí',
        'button.no': 'No',

        // Products
        'product.title': 'Producto',
        'product.name': 'Nombre del producto',
        'product.price': 'Precio',
        'product.description': 'Descripción',
        'product.category': 'Categoría',
        'product.images': 'Imágenes',
        'product.videos': 'Videos',
        'product.add': 'Agregar producto',
        'product.edit': 'Editar producto',
        'product.delete': 'Eliminar producto',
        'product.new': 'Nuevo producto',

        // Services
        'service.title': 'Servicio',
        'service.create': 'Crear servicio',
        'service.edit': 'Editar servicio',
        'service.delete': 'Eliminar servicio',
        'service.name': 'Nombre del servicio',
        'service.description': 'Descripción del servicio',
        'service.category': 'Categoría del servicio',

        // Messages
        'message.success': 'Éxito',
        'message.error': 'Error',
        'message.loading': 'Cargando...',
        'message.no_data': 'Sin datos',
        'message.confirm_delete': '¿Estás seguro de que quieres eliminar?',

        // Forms
        'form.required': 'Este campo es obligatorio',
        'form.invalid': 'Formato inválido',
        'form.save_success': 'Guardado exitosamente',
        'form.save_error': 'Error al guardar',

        // Location
        'location.title': 'Ubicación',
        'location.select': 'Seleccionar ubicación',
        'location.current': 'Posición actual',
        'location.search': 'Buscar lugar',

        // Payment
        'payment.title': 'Pago',
        'payment.method': 'Método de pago',
        'payment.mobile_money': 'Mobile Money',
        'payment.orange_money': 'Orange Money',
        'payment.visa': 'Tarjeta Visa',
        'payment.phone': 'Número de teléfono',
        'payment.card_number': 'Número de tarjeta',
        'payment.expiry': 'Fecha de vencimiento',

        // Chat
        'chat.title': 'Chat',
        'chat.message': 'Mensaje',
        'chat.send': 'Enviar',
        'chat.typing': 'Escribiendo...',
        'chat.online': 'En línea',
        'chat.offline': 'Desconectado',

        // Profile
        'profile.title': 'Perfil',
        'profile.edit': 'Editar perfil',
        'profile.name': 'Nombre',
        'profile.email': 'Email',
        'profile.phone': 'Teléfono',
        'profile.address': 'Dirección',
        'profile.avatar': 'Foto de perfil',

        // Statistics
        'stats.title': 'Estadísticas',
        'stats.views': 'Vistas',
        'stats.interactions': 'Interacciones',
        'stats.balance': 'Saldo',
        'stats.budget': 'Presupuesto',
        'stats.total': 'Total',

        // Languages
        'language.title': 'Idioma',
        'language.french': 'Français',
        'language.english': 'English',
        'language.spanish': 'Español',
        'language.chinese': '中文',
        'language.hindi': 'हिन्दी',
        'language.arabic': 'العربية',
        'language.russian': 'Русский',

        // Publicidad
        'publicite.create': 'Crear anuncio',
        'publicite.title': 'Título del anuncio',
        'publicite.description': 'Descripción',
        'publicite.products': 'Productos a promover',
        'publicite.videos': 'Videos promocionales',
        'publicite.duration': 'Duración (días)',
        'publicite.zone': 'Zona geográfica',
        'publicite.zone.select': 'Seleccionar zona de impacto',
        'publicite.zone.local': 'Local (ciudad)',
        'publicite.zone.regional': 'Regional (país)',
        'publicite.zone.international': 'Internacional',
        'publicite.pricing': 'Precio',
        'publicite.price_per_day': '500 FCFA por día',
        'publicite.total_cost': 'Costo total',
        'publicite.summary': 'Resumen y facturación',
        'publicite.products_selected': 'Productos seleccionados',
        'publicite.videos_added': 'Videos agregados',
        'publicite.balance_insufficient': 'Saldo insuficiente',
        'publicite.recharge_account': 'Por favor recargue su cuenta',
        'publicite.create_success': 'Anuncio creado exitosamente',
        'publicite.dashboard': 'Panel de anuncios',
        'publicite.analytics': 'Analíticas',
        'publicite.views': 'Vistas',
        'publicite.clicks': 'Clics',
        'publicite.conversion_rate': 'Tasa de conversión',
        'publicite.active': 'Activo',
        'publicite.expired': 'Expirado',
        'publicite.promotions': 'Promociones actuales',
        'publicite.selected_for_you': 'Seleccionadas para ti',
        'publicite.discover_offers': 'Descubre ofertas',
    },
    zh: {
        // Navigation
        'home.title': '首页',
        'home.welcome': '欢迎',
        'services.title': '我的服务',
        'activity.title': '商店 | 服务',
        'activity.list_view': '列表',
        'activity.dashboard_view': '仪表板',
        'activity.all_services': '所有服务',
        'interactions.title': '我的互动',
        'account.title': '我的账户',

        // Search
        'search.placeholder': '搜索服务...',
        'search.create': '创建服务',
        'search.find': '搜索',

        // Buttons
        'button.create': '创建',
        'button.save': '保存',
        'button.cancel': '取消',
        'button.edit': '编辑',
        'button.delete': '删除',
        'button.add': '添加',
        'button.close': '关闭',
        'button.back': '返回',
        'button.next': '下一步',
        'button.previous': '上一步',
        'button.confirm': '确认',
        'button.yes': '是',
        'button.no': '否',

        // Products
        'product.title': '产品',
        'product.name': '产品名称',
        'product.price': '价格',
        'product.description': '描述',
        'product.category': '类别',
        'product.images': '图片',
        'product.videos': '视频',
        'product.add': '添加产品',
        'product.edit': '编辑产品',
        'product.delete': '删除产品',
        'product.new': '新产品',

        // Services
        'service.title': '服务',
        'service.create': '创建服务',
        'service.edit': '编辑服务',
        'service.delete': '删除服务',
        'service.name': '服务名称',
        'service.description': '服务描述',
        'service.category': '服务类别',

        // Messages
        'message.success': '成功',
        'message.error': '错误',
        'message.loading': '加载中...',
        'message.no_data': '无数据',
        'message.confirm_delete': '确定要删除吗？',

        // Forms
        'form.required': '此字段为必填项',
        'form.invalid': '格式无效',
        'form.save_success': '保存成功',
        'form.save_error': '保存错误',

        // Location
        'location.title': '位置',
        'location.select': '选择位置',
        'location.current': '当前位置',
        'location.search': '搜索地点',

        // Payment
        'payment.title': '支付',
        'payment.method': '支付方式',
        'payment.mobile_money': '移动支付',
        'payment.orange_money': 'Orange Money',
        'payment.visa': 'Visa卡',
        'payment.phone': '电话号码',
        'payment.card_number': '卡号',
        'payment.expiry': '有效期',

        // Chat
        'chat.title': '聊天',
        'chat.message': '消息',
        'chat.send': '发送',
        'chat.typing': '正在输入...',
        'chat.online': '在线',
        'chat.offline': '离线',

        // Profile
        'profile.title': '个人资料',
        'profile.edit': '编辑资料',
        'profile.name': '姓名',
        'profile.email': '邮箱',
        'profile.phone': '电话',
        'profile.address': '地址',
        'profile.avatar': '头像',

        // Statistics
        'stats.title': '统计',
        'stats.views': '浏览量',
        'stats.interactions': '互动',
        'stats.balance': '余额',
        'stats.budget': '预算',
        'stats.total': '总计',

        // Languages
        'language.title': '语言',
        'language.french': 'Français',
        'language.english': 'English',
        'language.spanish': 'Español',
        'language.chinese': '中文',
        'language.hindi': 'हिन्दी',
        'language.arabic': 'العربية',
        'language.russian': 'Русский',

        // Advertisement
        'publicite.create': '创建广告',
        'publicite.title': '广告标题',
        'publicite.description': '描述',
        'publicite.products': '推广产品',
        'publicite.videos': '促销视频',
        'publicite.duration': '持续时间（天）',
        'publicite.zone': '地理区域',
        'publicite.zone.select': '选择影响区域',
        'publicite.zone.local': '本地（城市）',
        'publicite.zone.regional': '区域（国家）',
        'publicite.zone.international': '国际',
        'publicite.pricing': '定价',
        'publicite.price_per_day': '每天500非洲法郎',
        'publicite.total_cost': '总成本',
        'publicite.summary': '摘要和账单',
        'publicite.products_selected': '已选产品',
        'publicite.videos_added': '已添加视频',
        'publicite.balance_insufficient': '余额不足',
        'publicite.recharge_account': '请充值账户',
        'publicite.create_success': '广告创建成功',
        'publicite.dashboard': '广告仪表板',
        'publicite.analytics': '分析',
        'publicite.views': '浏览量',
        'publicite.clicks': '点击',
        'publicite.conversion_rate': '转化率',
        'publicite.active': '活跃',
        'publicite.expired': '已过期',
        'publicite.promotions': '当前促销',
        'publicite.selected_for_you': '为您精选',
        'publicite.discover_offers': '发现优惠',
    },
    hi: {
        // Navigation
        'home.title': 'होम',
        'home.welcome': 'स्वागत',
        'services.title': 'मेरी सेवाएं',
        'activity.title': 'दुकान | सेवाएं',
        'activity.list_view': 'सूची',
        'activity.dashboard_view': 'डैशबोर्ड',
        'activity.all_services': 'सभी सेवाएं',
        'interactions.title': 'मेरे इंटरैक्शन',
        'account.title': 'मेरा खाता',

        // Search
        'search.placeholder': 'सेवा खोजें...',
        'search.create': 'सेवा बनाएं',
        'search.find': 'खोजें',

        // Buttons
        'button.create': 'बनाएं',
        'button.save': 'सहेजें',
        'button.cancel': 'रद्द करें',
        'button.edit': 'संपादित करें',
        'button.delete': 'हटाएं',
        'button.add': 'जोड़ें',
        'button.close': 'बंद करें',
        'button.back': 'वापस',
        'button.next': 'अगला',
        'button.previous': 'पिछला',
        'button.confirm': 'पुष्टि करें',
        'button.yes': 'हां',
        'button.no': 'नहीं',

        // Products
        'product.title': 'उत्पाद',
        'product.name': 'उत्पाद का नाम',
        'product.price': 'कीमत',
        'product.description': 'विवरण',
        'product.category': 'श्रेणी',
        'product.images': 'छवियां',
        'product.videos': 'वीडियो',
        'product.add': 'उत्पाद जोड़ें',
        'product.edit': 'उत्पाद संपादित करें',
        'product.delete': 'उत्पाद हटाएं',
        'product.new': 'नया उत्पाद',

        // Services
        'service.title': 'सेवा',
        'service.create': 'सेवा बनाएं',
        'service.edit': 'सेवा संपादित करें',
        'service.delete': 'सेवा हटाएं',
        'service.name': 'सेवा का नाम',
        'service.description': 'सेवा का विवरण',
        'service.category': 'सेवा श्रेणी',

        // Messages
        'message.success': 'सफलता',
        'message.error': 'त्रुटि',
        'message.loading': 'लोड हो रहा है...',
        'message.no_data': 'कोई डेटा नहीं',
        'message.confirm_delete': 'क्या आप वाकई हटाना चाहते हैं?',

        // Forms
        'form.required': 'यह फ़ील्ड आवश्यक है',
        'form.invalid': 'अमान्य प्रारूप',
        'form.save_success': 'सफलतापूर्वक सहेजा गया',
        'form.save_error': 'सहेजने में त्रुटि',

        // Location
        'location.title': 'स्थान',
        'location.select': 'स्थान चुनें',
        'location.current': 'वर्तमान स्थिति',
        'location.search': 'स्थान खोजें',

        // Payment
        'payment.title': 'भुगतान',
        'payment.method': 'भुगतान विधि',
        'payment.mobile_money': 'मोबाइल मनी',
        'payment.orange_money': 'ऑरेंज मनी',
        'payment.visa': 'वीज़ा कार्ड',
        'payment.phone': 'फोन नंबर',
        'payment.card_number': 'कार्ड नंबर',
        'payment.expiry': 'समाप्ति तिथि',

        // Chat
        'chat.title': 'चैट',
        'chat.message': 'संदेश',
        'chat.send': 'भेजें',
        'chat.typing': 'टाइप कर रहे हैं...',
        'chat.online': 'ऑनलाइन',
        'chat.offline': 'ऑफलाइन',

        // Profile
        'profile.title': 'प्रोफ़ाइल',
        'profile.edit': 'प्रोफ़ाइल संपादित करें',
        'profile.name': 'नाम',
        'profile.email': 'ईमेल',
        'profile.phone': 'फोन',
        'profile.address': 'पता',
        'profile.avatar': 'प्रोफ़ाइल चित्र',

        // Statistics
        'stats.title': 'आंकड़े',
        'stats.views': 'दृश्य',
        'stats.interactions': 'इंटरैक्शन',
        'stats.balance': 'बैलेंस',
        'stats.budget': 'बजट',
        'stats.total': 'कुल',

        // Languages
        'language.title': 'भाषा',
        'language.french': 'Français',
        'language.english': 'English',
        'language.spanish': 'Español',
        'language.chinese': '中文',
        'language.hindi': 'हिन्दी',
        'language.arabic': 'العربية',
        'language.russian': 'Русский',

        // Advertisement
        'publicite.create': 'विज्ञापन बनाएं',
        'publicite.title': 'विज्ञापन शीर्षक',
        'publicite.description': 'विवरण',
        'publicite.products': 'प्रचार उत्पाद',
        'publicite.videos': 'प्रचार वीडियो',
        'publicite.duration': 'अवधि (दिन)',
        'publicite.zone': 'भौगोलिक क्षेत्र',
        'publicite.zone.select': 'प्रभाव क्षेत्र चुनें',
        'publicite.zone.local': 'स्थानीय (शहर)',
        'publicite.zone.regional': 'क्षेत्रीय (देश)',
        'publicite.zone.international': 'अंतर्राष्ट्रीय',
        'publicite.pricing': 'मूल्य निर्धारण',
        'publicite.price_per_day': 'प्रति दिन 500 FCFA',
        'publicite.total_cost': 'कुल लागत',
        'publicite.summary': 'सारांश और बिलिंग',
        'publicite.products_selected': 'चयनित उत्पाद',
        'publicite.videos_added': 'जोड़े गए वीडियो',
        'publicite.balance_insufficient': 'अपर्याप्त शेष',
        'publicite.recharge_account': 'कृपया अपना खाता रिचार्ज करें',
        'publicite.create_success': 'विज्ञापन सफलतापूर्वक बनाया गया',
        'publicite.dashboard': 'विज्ञापन डैशबोर्ड',
        'publicite.analytics': 'विश्लेषण',
        'publicite.views': 'दृश्य',
        'publicite.clicks': 'क्लिक',
        'publicite.conversion_rate': 'रूपांतरण दर',
        'publicite.active': 'सक्रिय',
        'publicite.expired': 'समाप्त',
        'publicite.promotions': 'वर्तमान प्रचार',
        'publicite.selected_for_you': 'आपके लिए चयनित',
        'publicite.discover_offers': 'ऑफ़र खोजें',
    },
    ar: {
        // Navigation
        'home.title': 'الرئيسية',
        'home.welcome': 'مرحبا',
        'services.title': 'خدماتي',
        'activity.title': 'متجر | خدمات',
        'activity.list_view': 'قائمة',
        'activity.dashboard_view': 'لوحة التحكم',
        'activity.all_services': 'جميع الخدمات',
        'interactions.title': 'تفاعلاتي',
        'account.title': 'حسابي',

        // Search
        'search.placeholder': 'البحث عن خدمة...',
        'search.create': 'إنشاء خدمة',
        'search.find': 'بحث',

        // Buttons
        'button.create': 'إنشاء',
        'button.save': 'حفظ',
        'button.cancel': 'إلغاء',
        'button.edit': 'تعديل',
        'button.delete': 'حذف',
        'button.add': 'إضافة',
        'button.close': 'إغلاق',
        'button.back': 'رجوع',
        'button.next': 'التالي',
        'button.previous': 'السابق',
        'button.confirm': 'تأكيد',
        'button.yes': 'نعم',
        'button.no': 'لا',

        // Products
        'product.title': 'منتج',
        'product.name': 'اسم المنتج',
        'product.price': 'السعر',
        'product.description': 'الوصف',
        'product.category': 'الفئة',
        'product.images': 'الصور',
        'product.videos': 'الفيديوهات',
        'product.add': 'إضافة منتج',
        'product.edit': 'تعديل المنتج',
        'product.delete': 'حذف المنتج',
        'product.new': 'منتج جديد',

        // Services
        'service.title': 'خدمة',
        'service.create': 'إنشاء خدمة',
        'service.edit': 'تعديل الخدمة',
        'service.delete': 'حذف الخدمة',
        'service.name': 'اسم الخدمة',
        'service.description': 'وصف الخدمة',
        'service.category': 'فئة الخدمة',

        // Messages
        'message.success': 'نجح',
        'message.error': 'خطأ',
        'message.loading': 'جاري التحميل...',
        'message.no_data': 'لا توجد بيانات',
        'message.confirm_delete': 'هل أنت متأكد من الحذف؟',

        // Forms
        'form.required': 'هذا الحقل مطلوب',
        'form.invalid': 'تنسيق غير صحيح',
        'form.save_success': 'تم الحفظ بنجاح',
        'form.save_error': 'خطأ في الحفظ',

        // Location
        'location.title': 'الموقع',
        'location.select': 'اختيار الموقع',
        'location.current': 'الموقع الحالي',
        'location.search': 'البحث عن مكان',

        // Payment
        'payment.title': 'الدفع',
        'payment.method': 'طريقة الدفع',
        'payment.mobile_money': 'المال المحمول',
        'payment.orange_money': 'Orange Money',
        'payment.visa': 'بطاقة فيزا',
        'payment.phone': 'رقم الهاتف',
        'payment.card_number': 'رقم البطاقة',
        'payment.expiry': 'تاريخ الانتهاء',

        // Chat
        'chat.title': 'الدردشة',
        'chat.message': 'رسالة',
        'chat.send': 'إرسال',
        'chat.typing': 'يكتب...',
        'chat.online': 'متصل',
        'chat.offline': 'غير متصل',

        // Profile
        'profile.title': 'الملف الشخصي',
        'profile.edit': 'تعديل الملف الشخصي',
        'profile.name': 'الاسم',
        'profile.email': 'البريد الإلكتروني',
        'profile.phone': 'الهاتف',
        'profile.address': 'العنوان',
        'profile.avatar': 'صورة الملف الشخصي',

        // Statistics
        'stats.title': 'الإحصائيات',
        'stats.views': 'المشاهدات',
        'stats.interactions': 'التفاعلات',
        'stats.balance': 'الرصيد',
        'stats.budget': 'الميزانية',
        'stats.total': 'المجموع',

        // Languages
        'language.title': 'اللغة',
        'language.french': 'Français',
        'language.english': 'English',
        'language.spanish': 'Español',
        'language.chinese': '中文',
        'language.hindi': 'हिन्दी',
        'language.arabic': 'العربية',
        'language.russian': 'Русский',

        // Advertisement
        'publicite.create': 'إنشاء إعلان',
        'publicite.title': 'عنوان الإعلان',
        'publicite.description': 'الوصف',
        'publicite.products': 'المنتجات للترويج',
        'publicite.videos': 'فيديوهات ترويجية',
        'publicite.duration': 'المدة (أيام)',
        'publicite.zone': 'المنطقة الجغرافية',
        'publicite.zone.select': 'اختر منطقة التأثير',
        'publicite.zone.local': 'محلي (مدينة)',
        'publicite.zone.regional': 'إقليمي (بلد)',
        'publicite.zone.international': 'دولي',
        'publicite.pricing': 'التسعير',
        'publicite.price_per_day': '500 فرنك أفريقي في اليوم',
        'publicite.total_cost': 'التكلفة الإجمالية',
        'publicite.summary': 'الملخص والفواتير',
        'publicite.products_selected': 'المنتجات المحددة',
        'publicite.videos_added': 'الفيديوهات المضافة',
        'publicite.balance_insufficient': 'رصيد غير كاف',
        'publicite.recharge_account': 'يرجى إعادة شحن حسابك',
        'publicite.create_success': 'تم إنشاء الإعلان بنجاح',
        'publicite.dashboard': 'لوحة الإعلانات',
        'publicite.analytics': 'التحليلات',
        'publicite.views': 'المشاهدات',
        'publicite.clicks': 'النقرات',
        'publicite.conversion_rate': 'معدل التحويل',
        'publicite.active': 'نشط',
        'publicite.expired': 'منتهي',
        'publicite.promotions': 'العروض الحالية',
        'publicite.selected_for_you': 'مختارة لك',
        'publicite.discover_offers': 'اكتشف العروض',
    },
    ru: {
        // Navigation
        'home.title': 'Главная',
        'home.welcome': 'Добро пожаловать',
        'services.title': 'Мои Услуги',
        'activity.title': 'Магазин | Услуги',
        'activity.list_view': 'Список',
        'activity.dashboard_view': 'Панель',
        'activity.all_services': 'Все услуги',
        'interactions.title': 'Мои Взаимодействия',
        'account.title': 'Мой Аккаунт',

        // Search
        'search.placeholder': 'Поиск услуги...',
        'search.create': 'Создать услугу',
        'search.find': 'Поиск',

        // Buttons
        'button.create': 'Создать',
        'button.save': 'Сохранить',
        'button.cancel': 'Отмена',
        'button.edit': 'Редактировать',
        'button.delete': 'Удалить',
        'button.add': 'Добавить',
        'button.close': 'Закрыть',
        'button.back': 'Назад',
        'button.next': 'Далее',
        'button.previous': 'Предыдущий',
        'button.confirm': 'Подтвердить',
        'button.yes': 'Да',
        'button.no': 'Нет',

        // Products
        'product.title': 'Продукт',
        'product.name': 'Название продукта',
        'product.price': 'Цена',
        'product.description': 'Описание',
        'product.category': 'Категория',
        'product.images': 'Изображения',
        'product.videos': 'Видео',
        'product.add': 'Добавить продукт',
        'product.edit': 'Редактировать продукт',
        'product.delete': 'Удалить продукт',
        'product.new': 'Новый продукт',

        // Services
        'service.title': 'Услуга',
        'service.create': 'Создать услугу',
        'service.edit': 'Редактировать услугу',
        'service.delete': 'Удалить услугу',
        'service.name': 'Название услуги',
        'service.description': 'Описание услуги',
        'service.category': 'Категория услуги',

        // Messages
        'message.success': 'Успех',
        'message.error': 'Ошибка',
        'message.loading': 'Загрузка...',
        'message.no_data': 'Нет данных',
        'message.confirm_delete': 'Вы уверены, что хотите удалить?',

        // Forms
        'form.required': 'Это поле обязательно',
        'form.invalid': 'Неверный формат',
        'form.save_success': 'Успешно сохранено',
        'form.save_error': 'Ошибка сохранения',

        // Location
        'location.title': 'Местоположение',
        'location.select': 'Выбрать местоположение',
        'location.current': 'Текущее местоположение',
        'location.search': 'Поиск места',

        // Payment
        'payment.title': 'Платеж',
        'payment.method': 'Способ оплаты',
        'payment.mobile_money': 'Мобильные деньги',
        'payment.orange_money': 'Orange Money',
        'payment.visa': 'Карта Visa',
        'payment.phone': 'Номер телефона',
        'payment.card_number': 'Номер карты',
        'payment.expiry': 'Срок действия',

        // Chat
        'chat.title': 'Чат',
        'chat.message': 'Сообщение',
        'chat.send': 'Отправить',
        'chat.typing': 'Печатает...',
        'chat.online': 'В сети',
        'chat.offline': 'Не в сети',

        // Profile
        'profile.title': 'Профиль',
        'profile.edit': 'Редактировать профиль',
        'profile.name': 'Имя',
        'profile.email': 'Электронная почта',
        'profile.phone': 'Телефон',
        'profile.address': 'Адрес',
        'profile.avatar': 'Фото профиля',

        // Statistics
        'stats.title': 'Статистика',
        'stats.views': 'Просмотры',
        'stats.interactions': 'Взаимодействия',
        'stats.balance': 'Баланс',
        'stats.budget': 'Бюджет',
        'stats.total': 'Всего',

        // Languages
        'language.title': 'Язык',
        'language.french': 'Français',
        'language.english': 'English',
        'language.spanish': 'Español',
        'language.chinese': '中文',
        'language.hindi': 'हिन्दी',
        'language.arabic': 'العربية',
        'language.russian': 'Русский',

        // Advertisement
        'publicite.create': 'Создать рекламу',
        'publicite.title': 'Заголовок рекламы',
        'publicite.description': 'Описание',
        'publicite.products': 'Продукты для продвижения',
        'publicite.videos': 'Рекламные видео',
        'publicite.duration': 'Продолжительность (дни)',
        'publicite.zone': 'Географическая зона',
        'publicite.zone.select': 'Выберите зону воздействия',
        'publicite.zone.local': 'Локальная (город)',
        'publicite.zone.regional': 'Региональная (страна)',
        'publicite.zone.international': 'Международная',
        'publicite.pricing': 'Ценообразование',
        'publicite.price_per_day': '500 FCFA в день',
        'publicite.total_cost': 'Общая стоимость',
        'publicite.summary': 'Резюме и выставление счетов',
        'publicite.products_selected': 'Выбранные продукты',
        'publicite.videos_added': 'Добавленные видео',
        'publicite.balance_insufficient': 'Недостаточно средств',
        'publicite.recharge_account': 'Пожалуйста, пополните счет',
        'publicite.create_success': 'Реклама успешно создана',
        'publicite.dashboard': 'Панель рекламы',
        'publicite.analytics': 'Аналитика',
        'publicite.views': 'Просмотры',
        'publicite.clicks': 'Клики',
        'publicite.conversion_rate': 'Коэффициент конверсии',
        'publicite.active': 'Активна',
        'publicite.expired': 'Истекла',
        'publicite.promotions': 'Текущие акции',
        'publicite.selected_for_you': 'Выбрано для вас',
        'publicite.discover_offers': 'Откройте предложения',
    },
};

