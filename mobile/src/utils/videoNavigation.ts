import { Alert } from 'react-native';

export interface VideoWizardParams {
    serviceId: number;
    productIndex: number;
    productName?: string;
    serviceName?: string;
}

/**
 * Navigue vers VideoCreationWizard avec validation des paramètres
 */
export const navigateToVideoWizard = (
    navigation: any,
    params: VideoWizardParams
): boolean => {
    // ✅ Validation améliorée
    if (!params.serviceId || params.serviceId === 0 || typeof params.serviceId !== 'number') {
        Alert.alert(
            'Service requis',
            'Un service est nécessaire pour créer une vidéo. Veuillez créer un service avec au moins un produit.',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Aller à Mes Services',
                    onPress: () => {
                        try {
                            const parent = navigation.getParent ? navigation.getParent() : null;
                            if (parent) {
                                parent.navigate('Services');
                            } else {
                                navigation.navigate('Services' as never);
                            }
                        } catch (error) {
                            console.error('[navigateToVideoWizard] Erreur navigation vers Services:', error);
                        }
                    }
                }
            ]
        );
        return false;
    }

    // ✅ Validation améliorée: productIndex doit être un nombre >= 0
    if (typeof params.productIndex !== 'number' || params.productIndex < 0) {
        Alert.alert(
            'Produit requis',
            'Un produit est nécessaire pour créer une vidéo. Veuillez sélectionner un produit.',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Aller à Mes Services',
                    onPress: () => {
                        try {
                            const parent = navigation.getParent ? navigation.getParent() : null;
                            if (parent) {
                                parent.navigate('Services');
                            } else {
                                navigation.navigate('Services' as never);
                            }
                        } catch (error) {
                            console.error('[navigateToVideoWizard] Erreur navigation vers Services:', error);
                        }
                    }
                }
            ]
        );
        return false;
    }

    // ✅ CORRIGÉ: Naviguer vers VideoCreationIntro au lieu de VideoCreationWizard
    // VideoCreationIntroScreen ouvre directement ProductVideoCreationModal avec les produits
    try {
        const parent = navigation.getParent ? navigation.getParent() : null;
        if (parent) {
            parent.navigate('VideoCreationIntro', params);
            return true;
        } else {
            navigation.navigate('VideoCreationIntro' as never, params as never);
            return true;
        }
    } catch (error) {
        console.error('[navigateToVideoWizard] Erreur navigation:', error);
        Alert.alert('Erreur', 'Impossible d\'ouvrir l\'éditeur de vidéo');
        return false;
    }
};

