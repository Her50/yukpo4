import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import DeliveryParcelFlowNew from './DeliveryParcelFlowNew';

const DeliveryParcelFlowNewScreen: React.FC = () => {
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
        <DeliveryParcelFlowNew
            visible={visible}
            onClose={handleClose}
            onSuccess={handleSuccess}
        />
    );
};

export default DeliveryParcelFlowNewScreen;


