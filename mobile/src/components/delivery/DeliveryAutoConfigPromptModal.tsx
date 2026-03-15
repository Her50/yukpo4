// ✅ Modal de confirmation pour configurer la livraison automatique après création de produit
import React from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';
import SafeIcon from '../SafeIcon';

interface DeliveryAutoConfigPromptModalProps {
    visible: boolean;
    productName: string;
    onYes: () => void;
    onNo: () => void;
    // ✅ NOUVEAU: Option intelligente pour réutiliser une config existante
    hasExistingConfig?: boolean;
    existingConfigProductName?: string;
    onReuseExisting?: () => void;
}

const DeliveryAutoConfigPromptModal: React.FC<DeliveryAutoConfigPromptModalProps> = ({
    visible,
    productName,
    onYes,
    onNo,
    hasExistingConfig = false,
    existingConfigProductName,
    onReuseExisting,
}) => {
    const { t } = useLanguageSafe();
    const handleYes = () => {
        hapticPress();
        onYes();
    };

    const handleNo = () => {
        hapticPress();
        onNo();
    };

    const handleReuseExisting = () => {
        hapticPress();
        onReuseExisting?.();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onNo}
        >
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <SafeIcon name="truck" size={32} color={modernColors.primary} type="lucide" />
                        </View>
                        <Text style={styles.title}>{t('deliveryPrompt.title')}</Text>
                    </View>

                    <View style={styles.content}>
                        <Text style={styles.question}>
                            {t('deliveryPrompt.question', { productName })}
                        </Text>

                        <View style={styles.advantagesContainer}>
                            <Text style={styles.advantagesTitle}>{t('deliveryPrompt.advantagesTitle')}</Text>
                            <View style={styles.advantageItem}>
                                <SafeIcon name="check-circle" size={16} color={modernColors.success} type="lucide" />
                                <Text style={styles.advantageText}>
                                    {t('deliveryPrompt.advantage1')}
                                </Text>
                            </View>
                            <View style={styles.advantageItem}>
                                <SafeIcon name="check-circle" size={16} color={modernColors.success} type="lucide" />
                                <Text style={styles.advantageText}>
                                    {t('deliveryPrompt.advantage2')}
                                </Text>
                            </View>
                            <View style={styles.advantageItem}>
                                <SafeIcon name="check-circle" size={16} color={modernColors.success} type="lucide" />
                                <Text style={styles.advantageText}>
                                    {t('deliveryPrompt.advantage3')}
                                </Text>
                            </View>
                            <View style={styles.advantageItem}>
                                <SafeIcon name="check-circle" size={16} color={modernColors.success} type="lucide" />
                                <Text style={styles.advantageText}>
                                    {t('deliveryPrompt.advantage4')}
                                </Text>
                            </View>
                        </View>

                        <Text style={styles.note}>
                            {t('deliveryPrompt.note')}
                        </Text>
                    </View>

                    {/* ✅ NOUVEAU: Option intelligente de réutilisation */}
                    {hasExistingConfig && onReuseExisting && (
                        <View style={styles.reuseContainer}>
                            <TouchableOpacity
                                style={[styles.button, styles.buttonReuse]}
                                onPress={handleReuseExisting}
                                activeOpacity={0.7}
                            >
                                <SafeIcon name="copy" size={16} color="#FFFFFF" type="lucide" />
                                <Text style={styles.buttonReuseText}>
                                    {existingConfigProductName ? t('deliveryPrompt.reuseConfig', { name: existingConfigProductName }) : t('deliveryPrompt.reuseConfigDefault')}
                                </Text>
                            </TouchableOpacity>
                            <Text style={styles.reuseHint}>
                                {t('deliveryPrompt.reuseHint')}
                            </Text>
                        </View>
                    )}

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.button, styles.buttonNo]}
                            onPress={handleNo}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.buttonNoText}>{t('deliveryPrompt.noNotApplicable')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.buttonYes]}
                            onPress={handleYes}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.buttonYesText}>{hasExistingConfig ? t('deliveryPrompt.newConfig') : t('deliveryPrompt.yesConfigure')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modal: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    header: {
        alignItems: 'center',
        paddingTop: 24,
        paddingBottom: 16,
        paddingHorizontal: 20,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
        textAlign: 'center',
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    question: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 16,
        textAlign: 'center',
    },
    advantagesContainer: {
        backgroundColor: '#F0FDF4',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    advantagesTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: modernColors.success,
        marginBottom: 12,
    },
    advantageItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8,
        gap: 8,
    },
    advantageText: {
        flex: 1,
        fontSize: 13,
        color: modernColors.text,
        lineHeight: 20,
    },
    note: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
        textAlign: 'center',
        lineHeight: 18,
    },
    actions: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingBottom: 20,
        gap: 12,
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonNo: {
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    buttonYes: {
        backgroundColor: modernColors.primary,
    },
    buttonNoText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    buttonYesText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    buttonReuse: {
        backgroundColor: '#10B981',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        flex: undefined,
        width: '100%',
    },
    buttonReuseText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    reuseContainer: {
        paddingHorizontal: 20,
        paddingBottom: 12,
    },
    reuseHint: {
        fontSize: 11,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginTop: 6,
        fontStyle: 'italic',
    },
});

export default DeliveryAutoConfigPromptModal;



