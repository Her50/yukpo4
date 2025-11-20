import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import DeliveryShoppingFlow from './DeliveryShoppingFlow';

const DeliveryShoppingFlowScreen: React.FC = () => {
    const navigation = useNavigation();
    const [visible, setVisible] = useState(true);

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
        />
    );
};

export default DeliveryShoppingFlowScreen;

