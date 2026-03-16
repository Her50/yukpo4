// @ts-nocheck
// ✅ Modal/Prompt réutilisable pour demander les coordonnées de paiement
// S'affiche automatiquement quand l'utilisateur n'a pas de moyen de paiement configuré
// Contextes: paiement, reversement, recharge tokens, mise en vente livre, création partenaire
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { apiCall, apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { validatePhoneNumber } from '../utils/paymentValidation';
import SafeIcon from './SafeIcon';
import { NativeInput } from './SafeNativeDesign';

export interface PaymentMethodPromptProps {
    visible: boolean;
    onClose: () => void;
    onSaved: (methods: any) => void;
    context?: 'payment' | 'payout' | 'recharge' | 'book_sell' | 'partner';
}

const PaymentMethodPrompt: React.FC<PaymentMethodPromptProps> = ({
    visible,
    onClose,
    onSaved,
    context = 'payment',
}) => {
    const { t } = useLanguageSafe();
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    // MTN
    const [mtnEnabled, setMtnEnabled] = useState(false);
    const [mtnPhone, setMtnPhone] = useState('');
    const [mtnError, setMtnError] = useState<string | null>(null);

    // Orange
    const [orangeEnabled, setOrangeEnabled] = useState(false);
    const [orangePhone, setOrangePhone] = useState('');
    const [orangeError, setOrangeError] = useState<string | null>(null);

    // Charger les moyens existants au montage
    useEffect(() => {
        if (visible) {
            loadExisting();
        }
    }, [visible]);

    const loadExisting = async () => {
        try {
            setLoading(true);
            const response = await apiGet<any>('/api/user/payment-methods');
            const data = (response?.data ?? response) as any;
            if (data?.success && data.payment_methods) {
                const pm = data.payment_methods;
                if (pm.mtn_money?.phone) {
                    setMtnEnabled(true);
                    setMtnPhone(pm.mtn_money.phone);
                }
                if (pm.orange_money?.phone) {
                    setOrangeEnabled(true);
                    setOrangePhone(pm.orange_money.phone);
                }
            }
        } catch (err) {
            console.warn('[PaymentMethodPrompt] Error loading:', err);
        } finally {
            setLoading(false);
        }
    };

    const cleanPhone = (text: string) => text.replace(/[^\d\s]/g, '');

    const validate = (): boolean => {
        let valid = false;
        setMtnError(null);
        setOrangeError(null);

        if (mtnEnabled && mtnPhone.trim()) {
            const result = validatePhoneNumber(mtnPhone);
            if (!result.valid) {
                setMtnError(result.error || t('payment.security.invalidPhone') || t('paymentMethodPrompt.numeroInvalide'));
            } else {
                valid = true;
            }
        }

        if (orangeEnabled && orangePhone.trim()) {
            const result = validatePhoneNumber(orangePhone);
            if (!result.valid) {
                setOrangeError(result.error || t('payment.security.invalidPhone') || t('paymentMethodPrompt.numeroInvalide'));
            } else {
                valid = true;
            }
        }

        // Au moins un moyen valide
        if (!mtnEnabled && !orangeEnabled) {
            setMtnError(t('paymentPrompt.selectAtLeastOne') || 'Activez au moins un moyen de paiement');
            return false;
        }

        return valid;
    };

    const handleSave = async () => {
        if (!validate()) return;

        try {
            setSaving(true);
            const paymentMethods: any = {};

            if (mtnEnabled && mtnPhone.trim()) {
                const result = validatePhoneNumber(mtnPhone);
                paymentMethods.mtn_money = {
                    phone: result.formattedNumber || mtnPhone.trim(),
                    verified: false,
                };
            }

            if (orangeEnabled && orangePhone.trim()) {
                const result = validatePhoneNumber(orangePhone);
                paymentMethods.orange_money = {
                    phone: result.formattedNumber || orangePhone.trim(),
                    verified: false,
                };
            }

            // Sauvegarder via API
            await apiCall('/api/user/payment-methods', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payment_methods: paymentMethods }),
            });

            onSaved(paymentMethods);
            onClose();
        } catch (err) {
            console.error('[PaymentMethodPrompt] Error saving:', err);
            setMtnError(t('paymentPrompt.saveError') || t('paymentMethodPrompt.erreurDeSauvegardeReessayez'));
        } finally {
            setSaving(false);
        }
    };

    const getContextMessage = () => {
        switch (context) {
            case 'payout':
                return t('paymentPrompt.contextPayout') || 'Pour recevoir vos reversements, veuillez renseigner un moyen de paiement.';
            case 'recharge':
                return t('paymentPrompt.contextRecharge') || t('paymentMethodPrompt.pourRechargerVotreCompteVeuillez');
            case 'book_sell':
                return t('paymentPrompt.contextBookSell') || 'Pour vendre vos livres et recevoir le paiement, veuillez configurer un moyen de paiement.';
            case 'partner':
                return t('paymentPrompt.contextPartner') || t('paymentMethodPrompt.enTantQuePartenaireConfigurez');
            default:
                return t('paymentPrompt.contextDefault') || t('paymentMethodPrompt.pourEffectuerCetteOperationVeuillez');
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerIcon}>
                            <SafeIcon name="wallet" size={24} color={modernColors.primary} />
                        </View>
                        <Text style={styles.title}>
                            {t('paymentPrompt.title') || t('paymentMethodPrompt.coordonneesDePaiement')}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <SafeIcon name="x" size={22} color={modernColors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Context message */}
                    <View style={styles.contextBox}>
                        <SafeIcon name="info" size={18} color={modernColors.info} />
                        <Text style={styles.contextText}>{getContextMessage()}</Text>
                    </View>

                    {loading ? (
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="small" color={modernColors.primary} />
                            <Text style={styles.loadingText}>
                                {t('paymentPrompt.loading') || 'Chargement...'}
                            </Text>
                        </View>
                    ) : (
                        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                            {/* MTN Money */}
                            <View style={[styles.providerSection, mtnEnabled && styles.providerActive]}>
                                <View style={styles.providerHeader}>
                                    <View style={styles.providerTitleRow}>
                                        <Text style={styles.providerEmoji}>📱</Text>
                                        <Text style={[styles.providerTitle, mtnEnabled && { color: '#B45309' }]}>
                                            MTN Mobile Money
                                        </Text>
                                    </View>
                                    <Switch
                                        value={mtnEnabled}
                                        onValueChange={setMtnEnabled}
                                        trackColor={{ false: '#E5E7EB', true: '#FBBF24' }}
                                        thumbColor={mtnEnabled ? '#F59E0B' : '#9CA3AF'}
                                    />
                                </View>
                                {mtnEnabled && (
                                    <View style={styles.formSection}>
                                        <Text style={styles.formLabel}>
                                            {t('paymentPrompt.mtnNumber') || t('paymentMethodPrompt.numeroMtnMoney')}
                                        </Text>
                                        <NativeInput
                                            placeholder="6XX XX XX XX"
                                            value={mtnPhone}
                                            onChangeText={(text) => { setMtnPhone(cleanPhone(text)); setMtnError(null); }}
                                            keyboardType="phone-pad"
                                            maxLength={15}
                                            style={[styles.input, mtnError && styles.inputError]}
                                        />
                                        {mtnError && (
                                            <View style={styles.errorRow}>
                                                <SafeIcon name="alert-circle" size={14} color={modernColors.error} />
                                                <Text style={styles.errorText}>{mtnError}</Text>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>

                            {/* Orange Money */}
                            <View style={[styles.providerSection, orangeEnabled && styles.providerActiveOrange]}>
                                <View style={styles.providerHeader}>
                                    <View style={styles.providerTitleRow}>
                                        <Text style={styles.providerEmoji}>📱</Text>
                                        <Text style={[styles.providerTitle, orangeEnabled && { color: '#C2410C' }]}>
                                            Orange Money
                                        </Text>
                                    </View>
                                    <Switch
                                        value={orangeEnabled}
                                        onValueChange={setOrangeEnabled}
                                        trackColor={{ false: '#E5E7EB', true: '#FDBA74' }}
                                        thumbColor={orangeEnabled ? '#F97316' : '#9CA3AF'}
                                    />
                                </View>
                                {orangeEnabled && (
                                    <View style={styles.formSection}>
                                        <Text style={styles.formLabel}>
                                            {t('paymentPrompt.orangeNumber') || t('paymentMethodPrompt.numeroOrangeMoney')}
                                        </Text>
                                        <NativeInput
                                            placeholder="6XX XX XX XX"
                                            value={orangePhone}
                                            onChangeText={(text) => { setOrangePhone(cleanPhone(text)); setOrangeError(null); }}
                                            keyboardType="phone-pad"
                                            maxLength={15}
                                            style={[styles.input, orangeError && styles.inputError]}
                                        />
                                        {orangeError && (
                                            <View style={styles.errorRow}>
                                                <SafeIcon name="alert-circle" size={14} color={modernColors.error} />
                                                <Text style={styles.errorText}>{orangeError}</Text>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>

                            {/* Security notice */}
                            <View style={styles.securityBanner}>
                                <SafeIcon name="shield" size={16} color={modernColors.success} />
                                <Text style={styles.securityText}>
                                    {t('paymentPrompt.security') || t('paymentMethodPrompt.vosInformationsSontSecuriseesEt')}
                                </Text>
                            </View>
                        </ScrollView>
                    )}

                    {/* Actions */}
                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                            <Text style={styles.cancelText}>{t('common.cancel') || 'Annuler'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <SafeIcon name="check" size={18} color="#fff" />
                                    <Text style={styles.saveText}>
                                        {t('paymentPrompt.save') || 'Enregistrer'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: modernColors.background,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        maxHeight: '85%', paddingBottom: 30,
    },
    header: {
        flexDirection: 'row', alignItems: 'center', padding: 16,
        borderBottomWidth: 1, borderBottomColor: modernColors.border,
    },
    headerIcon: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: modernColors.primary + '15',
        justifyContent: 'center', alignItems: 'center', marginRight: 10,
    },
    title: { flex: 1, fontSize: 18, fontWeight: '700', color: modernColors.text },
    closeBtn: { padding: 8 },

    contextBox: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        margin: 16, padding: 12, borderRadius: 10,
        backgroundColor: modernColors.info + '10',
        borderWidth: 1, borderColor: modernColors.info + '25',
    },
    contextText: { flex: 1, fontSize: 13, color: modernColors.text, lineHeight: 18 },

    loadingBox: {
        padding: 40, alignItems: 'center', gap: 12,
    },
    loadingText: { fontSize: 14, color: modernColors.textSecondary },

    scroll: { paddingHorizontal: 16, maxHeight: 350 },

    providerSection: {
        backgroundColor: modernColors.surface,
        borderWidth: 1.5, borderColor: modernColors.border,
        borderRadius: 14, padding: 14, marginBottom: 12,
    },
    providerActive: { borderColor: '#FBBF24', backgroundColor: '#FFFBEB' },
    providerActiveOrange: { borderColor: '#F97316', backgroundColor: '#FFF7ED' },

    providerHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    providerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    providerEmoji: { fontSize: 24 },
    providerTitle: { fontSize: 15, fontWeight: '700', color: modernColors.textSecondary },

    formSection: { marginTop: 10, gap: 6 },
    formLabel: { fontSize: 13, fontWeight: '600', color: modernColors.text },
    input: {
        borderWidth: 1, borderColor: modernColors.border, borderRadius: 8,
        padding: 12, fontSize: 16, color: modernColors.text,
        backgroundColor: modernColors.surface,
    },
    inputError: { borderColor: modernColors.error, backgroundColor: modernColors.error + '10' },

    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    errorText: { fontSize: 12, color: modernColors.error, flex: 1 },

    securityBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: modernColors.success + '12', padding: 10,
        borderRadius: 8, marginTop: 4, marginBottom: 8,
    },
    securityText: { fontSize: 12, color: modernColors.success, fontWeight: '500' },

    actions: {
        flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 12,
        borderTopWidth: 1, borderTopColor: modernColors.border,
    },
    cancelBtn: {
        flex: 1, paddingVertical: 14, borderRadius: 12,
        borderWidth: 1.5, borderColor: modernColors.border, alignItems: 'center',
    },
    cancelText: { fontSize: 15, fontWeight: '600', color: modernColors.textSecondary },
    saveBtn: {
        flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 14, borderRadius: 12,
        backgroundColor: modernColors.primary,
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

export default PaymentMethodPrompt;
