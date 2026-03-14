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
    const ScreenComponent = MesReservationsScreen as any;
    return (
        <ScreenComponent
            route={{
                params: { serviceType: 'covoiturage' }
            }}
            navigation={navigation}
        />
    );
};

export default MesReservationsCovoiturageScreen;

