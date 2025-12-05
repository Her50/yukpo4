/**
 * Écran pour afficher les réservations de covoiturage de l'utilisateur
 * Réutilise MesReservationsScreen avec filtre covoiturage
 */

import { useNavigation } from '@react-navigation/native';
import React from 'react';
import MesReservationsScreen from './MesReservationsScreen';

const MesReservationsCovoiturageScreen: React.FC = () => {
    const navigation = useNavigation();

    // Passer le type de service comme paramètre
    return (
        <MesReservationsScreen
            route={{
                params: { serviceType: 'covoiturage' }
            } as any}
            navigation={navigation as any}
        />
    );
};

export default MesReservationsCovoiturageScreen;

