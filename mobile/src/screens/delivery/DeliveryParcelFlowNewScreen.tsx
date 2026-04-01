import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { deliveryApi } from '../../services/api';
import DeliveryParcelFlowNew from './DeliveryParcelFlowNew';

const DeliveryParcelFlowNewScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const routeParams = (route?.params ?? {}) as { mode?: 'create' | 'edit'; deliveryId?: string | number };
    const mode = routeParams?.mode === 'edit' ? 'edit' : 'create';
    const deliveryId = routeParams?.deliveryId != null ? String(routeParams.deliveryId) : '';
    const [visible, setVisible] = useState(true);
    const [initialDeliveryData, setInitialDeliveryData] = useState<any | null>(null);

    useEffect(() => {
        let mounted = true;

        const loadDeliveryForEdit = async () => {
            if (mode !== 'edit' || !deliveryId) return;
            try {
                const response = await deliveryApi.getDeliveryById(deliveryId);
                const delivery = (response as any)?.data?.delivery ?? (response as any)?.data;
                if (mounted && delivery) {
                    setInitialDeliveryData(delivery);
                }
            } catch (error) {
                console.error('[DeliveryParcelFlowNewScreen] prefill edit error:', error);
            }
        };

        loadDeliveryForEdit();
        return () => {
            mounted = false;
        };
    }, [deliveryId, mode]);

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
            mode={mode}
            deliveryId={deliveryId || undefined}
            initialDeliveryData={initialDeliveryData}
        />
    );
};

export default DeliveryParcelFlowNewScreen;






