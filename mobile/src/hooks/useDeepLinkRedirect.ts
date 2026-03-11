import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { handlePendingDeepLink } from '../utils/deepLinkHandler';

/**
 * Hook pour gérer la redirection vers un deep link en attente après connexion/inscription
 * À utiliser dans un composant à l'intérieur de NavigationContainer
 * 
 * Exemple: Ajouter dans HomeScreen ou AppNavigator
 * 
 * ✅ AMÉLIORATION: Gère aussi la redirection automatique des partenaires vers leur écran spécialisé
 */
export const useDeepLinkRedirect = () => {
    // ✅ CORRECTION CRASH: useNavigation doit être appelé inconditionnellement (règle des hooks)
    const navigation = useNavigation();
    const { user } = useAuth();

    useEffect(() => {
        // ✅ CORRECTION CRASH: Vérifier que navigation et navigate existent AVANT d'utiliser
        if (!navigation) {
            console.log('[useDeepLinkRedirect] Navigation non disponible encore');
            return;
        }

        // Vérifier que navigate est une fonction (peut être undefined si NavigationContainer n'est pas prêt)
        const navNavigate = (navigation as any)?.navigate;
        if (typeof navNavigate !== 'function') {
            console.log('[useDeepLinkRedirect] navigation.navigate n\'est pas une fonction, attente...');
            return;
        }

        // ✅ RÉACTIVÉ: Rediriger automatiquement les partenaires vers leur écran spécialisé
        const handlePartnerRedirect = () => {
            if (user?.role === 'partenaire' && user.partner_type) {
                console.log(`[useDeepLinkRedirect] 🏢 Partenaire identifié: type="${user.partner_type}" - Redirection vers écran spécialisé`);

                // Mapping des types de partenaires vers leurs écrans spécialisés (dashboards directs)
                // ✅ FIX: Inclure TOUTES les variantes d'écriture envoyées par le backend
                const partnerTypeToScreen: Record<string, string> = {
                    // ✅ Santé → dashboard dédié (mode dashboard auto-détecté)
                    'pharmacie': 'PharmacieForm',
                    'hopital': 'HopitalForm',
                    'laboratoire': 'LaboratoireForm',
                    'banquesang': 'BanqueSangForm',
                    'banque_sang': 'BanqueSangForm',
                    // ✅ Transport → dashboard dédié (toutes variantes)
                    'agence_voyage': 'AgenceVoyageForm',
                    'agencedevoyage': 'AgenceVoyageForm',
                    'agencevoyage': 'AgenceVoyageForm',
                    'agence_de_voyage': 'AgenceVoyageForm', // AJOUT: normalisation depuis "agence de voyage"
                    'covoiturage': 'CovoiturageForm',
                    'taxi': 'TaxiForm',
                    'chauffeur': 'TaxiForm',
                    // Commerce / Restauration
                    'supermarche': 'SupermarketPartnerDashboard',
                    'restaurant': 'RestaurantDashboard',
                    // Emploi
                    'offre_emploi': 'OffresEmploiHub',
                    'offreemploi': 'OffresEmploiHub',
                    'recruteur': 'OffresEmploiHub',
                    // Assurance (backend utilise 'assureur')
                    'assureur': 'AssuranceDashboard',
                    'assurance': 'AssuranceDashboard',
                    // Éducation
                    'etablissementscolaire': 'OrientationPartnerDashboard',
                    'etablissement_scolaire': 'OrientationPartnerDashboard',
                    'livrescolaire': 'OrientationPartnerDashboard',
                    'livre_scolaire': 'OrientationPartnerDashboard',
                    // Autres types avec espaces (normalisation)
                    'livraison_courses_marche': 'GestionServicesSpecialises', // normalisé depuis "livraison courses marche"
                    'demenagement': 'GestionServicesSpecialises',
                    'transport': 'GestionServicesSpecialises',
                    'telecom': 'GestionServicesSpecialises',
                    'immobilier': 'ImmobilierForm',
                    // Génériques
                    'ecommerce': 'GestionServicesSpecialises',
                    'prestataire': 'GestionServicesSpecialises',
                    'service': 'GestionServicesSpecialises',
                };

                // ✅ FIX: Normaliser le partner_type (lowercase, supprimer espaces → underscore)
                const normalizedType = user.partner_type.toLowerCase().trim().replace(/\s+/g, '');
                const targetScreen = partnerTypeToScreen[user.partner_type] || partnerTypeToScreen[normalizedType];

                console.log(`[useDeepLinkRedirect] 🔍 Debug partenaire:`);
                console.log(`  - partner_type brut: "${user.partner_type}"`);
                console.log(`  - normalizedType: "${normalizedType}"`);
                console.log(`  - targetScreen: "${targetScreen}"`);
                console.log(`  - mapping direct: "${partnerTypeToScreen[user.partner_type]}"`);
                console.log(`  - mapping normalisé: "${partnerTypeToScreen[normalizedType]}"`);

                if (targetScreen) {
                    console.log(`[useDeepLinkRedirect] � Redirection partenaire ${user.partner_type} → ${targetScreen}`);
                    navNavigate(targetScreen as any);
                    return true; // Redirection effectuée
                } else {
                    console.warn(`[useDeepLinkRedirect] ⚠️ Type partenaire non mappé: ${user.partner_type}, redirection vers GestionServicesSpecialises`);
                    navNavigate('GestionServicesSpecialises' as any);
                    return true;
                }
            }
            return false; // Pas de redirection nécessaire
        };

        // Vérifier s'il y a un deep link en attente seulement si l'utilisateur vient de se connecter
        if (user) {
            const checkDeepLink = async () => {
                try {
                    const redirected = await handlePendingDeepLink(navigation);
                    if (redirected) {
                        console.log('✅ Redirection vers deep link en attente effectuée');
                    } else {
                        // ✅ Si pas de deep link, vérifier si c'est un partenaire à rediriger
                        const partnerRedirected = handlePartnerRedirect();
                        if (!partnerRedirected) {
                            console.log('[useDeepLinkRedirect] ℹ️ Utilisateur connecté, pas de deep link ni redirection partenaire nécessaire');
                        }
                    }
                } catch (error) {
                    console.error('❌ Erreur redirection deep link:', error);
                    // ✅ En cas d'erreur, essayer quand même la redirection partenaire
                    const partnerRedirected = handlePartnerRedirect();
                    if (!partnerRedirected) {
                        console.log('[useDeepLinkRedirect] ⚠️ Erreur deep link et pas de redirection partenaire possible');
                    }
                }
            };

            // Attendre que la navigation soit prête (délai minimal car on est déjà dans NavigationContainer)
            const timer = setTimeout(() => {
                const nav = navigation as any;
                if (nav && typeof nav?.navigate === 'function') {
                    checkDeepLink().catch(error => {
                        console.error('[useDeepLinkRedirect] Erreur checkDeepLink:', error);
                    });
                } else {
                    console.warn('[useDeepLinkRedirect] Navigation non disponible après délai');
                }
            }, 50);

            return () => clearTimeout(timer);
        }
        // ✅ CRITIQUE: Retourner explicitement undefined si user n'existe pas
        return undefined;
    }, [user, navigation]);
};

