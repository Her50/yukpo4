// ✅ Hook pour vérifier et récupérer les moyens de paiement de l'utilisateur
// Utilisé avant paiement, reversement, recharge tokens, mise en vente livre, etc.
import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '../services/api';

export interface PaymentMethodsInfo {
    payment_methods: any;
    has_payment_method: boolean;
    has_mtn_money: boolean;
    has_orange_money: boolean;
    has_bank_card: boolean;
    mtn_phone?: string;
    orange_phone?: string;
}

const EMPTY: PaymentMethodsInfo = {
    payment_methods: {},
    has_payment_method: false,
    has_mtn_money: false,
    has_orange_money: false,
    has_bank_card: false,
};

export function usePaymentMethodCheck() {
    const [info, setInfo] = useState<PaymentMethodsInfo>(EMPTY);
    const [loading, setLoading] = useState(false);
    const [checked, setChecked] = useState(false);

    const fetchPaymentMethods = useCallback(async (): Promise<PaymentMethodsInfo> => {
        try {
            setLoading(true);
            const response = await apiGet<any>('/api/user/payment-methods');
            const data = (response?.data ?? response) as any;
            if (data?.success) {
                const result: PaymentMethodsInfo = {
                    payment_methods: data.payment_methods || {},
                    has_payment_method: !!data.has_payment_method,
                    has_mtn_money: !!data.has_mtn_money,
                    has_orange_money: !!data.has_orange_money,
                    has_bank_card: !!data.has_bank_card,
                    mtn_phone: data.payment_methods?.mtn_money?.phone,
                    orange_phone: data.payment_methods?.orange_money?.phone,
                };
                setInfo(result);
                setChecked(true);
                return result;
            }
        } catch (err) {
            console.warn('[usePaymentMethodCheck] Error fetching payment methods:', err);
        } finally {
            setLoading(false);
        }
        setChecked(true);
        return EMPTY;
    }, []);

    // Vérifier si l'utilisateur doit fournir un moyen de paiement
    // Retourne true si un moyen est manquant (= besoin de prompt)
    const checkAndPrompt = useCallback(async (): Promise<boolean> => {
        const result = await fetchPaymentMethods();
        return !result.has_payment_method;
    }, [fetchPaymentMethods]);

    return {
        ...info,
        loading,
        checked,
        fetchPaymentMethods,
        checkAndPrompt,
        refresh: fetchPaymentMethods,
    };
}
