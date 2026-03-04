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

        // ✅ NOUVEAU: Gérer la redirection des partenaires vers leur écran spécialisé
        const handlePartnerRedirect = () => {
            if (user?.role === 'partenaire') {
                if (user.partner_type) {
                    console.log(`[useDeepLinkRedirect] 🏢 Partenaire identifié: type="${user.partner_type}"`);
                    // ✅ NOUVEAU: Mapping complet de tous les types de partenaires vers leurs écrans
                    const partnerTypeToScreen: Record<string, string> = {
                        'banquesang': 'BanqueSangForm',
                        'pharmacie': 'PharmacieForm',
                        'hopital': 'HopitalForm',
                        'laboratoire': 'LaboratoireForm',
                        'agence de voyage': 'AgenceVoyageForm',
                        'hotel': 'ImmobilierForm',
                        'meuble': 'ImmobilierForm',
                        'chauffeur': 'TaxiForm',
                        'supermarche': 'SupermarketHome',
                        'livraison_courses_marche': 'MesServicesSpecialises',
                        'etablissementscolaire': 'MesServicesSpecialises',
                        'demenagement': 'MesServicesSpecialises',
                        'transport': 'MesServicesSpecialises',
                        'assureur': 'MesServicesSpecialises',
                        'telecom': 'MesServicesSpecialises',
                        'livraison': 'MesServicesSpecialises',
                    };

                    const targetScreen = partnerTypeToScreen[user.partner_type];
                    if (targetScreen) {
                        try {
                            const nav = navigation as any;
                            if (nav && typeof nav?.navigate === 'function') {
                                console.log(`[useDeepLinkRedirect] ✅ Redirection partenaire "${user.partner_type}" vers ${targetScreen}`);
                                nav.navigate(targetScreen);
                            }
                        } catch (error) {
                            console.error('[useDeepLinkRedirect] ❌ Erreur redirection partenaire:', error);
                        }
                    } else {
                        console.warn(`[useDeepLinkRedirect] ⚠️ Type partenaire "${user.partner_type}" non mappé, redirection vers sélecteur de services`);
                        try {
                            const nav = navigation as any;
                            if (nav && typeof nav?.navigate === 'function') {
                                nav.navigate('MesServicesSpecialises');
                            }
                        } catch (error) {
                            console.error('[useDeepLinkRedirect] ❌ Erreur redirection sélecteur:', error);
                        }
                    }
                } else {
                    console.warn('[useDeepLinkRedirect] ⚠️ Partenaire sans type - redirection vers sélecteur de services');
                    try {
                        const nav = navigation as any;
                        if (nav && typeof nav?.navigate === 'function') {
                            nav.navigate('MesServicesSpecialises');
                        }
                    } catch (error) {
                        console.error('[useDeepLinkRedirect] ❌ Erreur redirection sélecteur:', error);
                    }
                }
            }
        };

        // Vérifier s'il y a un deep link en attente seulement si l'utilisateur vient de se connecter
        if (user) {
            const checkDeepLink = async () => {
                try {
                    const redirected = await handlePendingDeepLink(navigation);
                    if (redirected) {
                        console.log('✅ Redirection vers deep link en attente effectuée');
                    } else {
                        // ✅ NOUVEAU: Si pas de deep link, vérifier si c'est un partenaire à rediriger
                        handlePartnerRedirect();
                    }
                } catch (error) {
                    console.error('❌ Erreur redirection deep link:', error);
                    // ✅ NOUVEAU: En cas d'erreur, essayer quand même la redirection partenaire
                    handlePartnerRedirect();
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

