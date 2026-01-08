import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import DeliveryShoppingFlow from './DeliveryShoppingFlow';

const DeliveryShoppingFlowScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const [visible, setVisible] = useState(true);

    // ✅ Récupérer le supermarché pré-sélectionné depuis les paramètres de navigation
    const routeParams = route.params as any;
    const selectedSupermarket = routeParams?.selectedSupermarket || null;

    const handleClose = () => {
        setVisible(false);
        if (navigation.canGoBack()) {
            navigation.goBack();
        }
    };

    const handleSuccess = (deliveryId: string) => {
        // Navigation vers le tracking après création
        (navigation as any).navigate('DeliveryShoppingTracking', { deliveryId });
    };

    return (
        <DeliveryShoppingFlow
            visible={visible}
            onClose={handleClose}
            onSuccess={handleSuccess}
            initialSupermarket={selectedSupermarket}
        />
    );
};

export default DeliveryShoppingFlowScreen;

