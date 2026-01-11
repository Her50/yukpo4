// ✅ Modal de confirmation pour configurer la livraison automatique après création de produit
import React from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeButton } from '../SafeNativeDesign';
import SafeIcon from '../SafeIcon';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

interface DeliveryAutoConfigPromptModalProps {
    visible: boolean;
    productName: string;
    onYes: () => void;
    onNo: () => void;
}

const DeliveryAutoConfigPromptModal: React.FC<DeliveryAutoConfigPromptModalProps> = ({
    visible,
    productName,
    onYes,
    onNo,
}) => {
    const handleYes = () => {
        hapticPress();
        onYes();
    };

    const handleNo = () => {
        hapticPress();
        onNo();
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
                        <Text style={styles.title}>Livraison automatique Yukpo</Text>
                    </View>

                    <View style={styles.content}>
                        <Text style={styles.question}>
                            Souhaitez-vous configurer la livraison automatique pour "{productName}" ?
                        </Text>

                        <View style={styles.advantagesContainer}>
                            <Text style={styles.advantagesTitle}>✅ Avantages :</Text>
                            <View style={styles.advantageItem}>
                                <SafeIcon name="check-circle" size={16} color={modernColors.success} type="lucide" />
                                <Text style={styles.advantageText}>
                                    Vos clients pourront commander directement avec livraison
                                </Text>
                            </View>
                            <View style={styles.advantageItem}>
                                <SafeIcon name="check-circle" size={16} color={modernColors.success} type="lucide" />
                                <Text style={styles.advantageText}>
                                    Gestion automatique des commandes et livraisons
                                </Text>
                            </View>
                            <View style={styles.advantageItem}>
                                <SafeIcon name="check-circle" size={16} color={modernColors.success} type="lucide" />
                                <Text style={styles.advantageText}>
                                    Augmentation de vos ventes grâce à la facilité de commande
                                </Text>
                            </View>
                            <View style={styles.advantageItem}>
                                <SafeIcon name="check-circle" size={16} color={modernColors.success} type="lucide" />
                                <Text style={styles.advantageText}>
                                    Suivi en temps réel des livraisons
                                </Text>
                            </View>
                        </View>

                        <Text style={styles.note}>
                            💡 Si votre produit n'est pas livrable (ex: vente de voiture, service sur place), 
                            vous pouvez cliquer sur "Non, pas applicable".
                        </Text>
                    </View>

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.button, styles.buttonNo]}
                            onPress={handleNo}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.buttonNoText}>Non, pas applicable</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.buttonYes]}
                            onPress={handleYes}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.buttonYesText}>Oui, configurer</Text>
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
        backgroundColor: modernColors.primaryLight,
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
        backgroundColor: modernColors.successLight,
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
});

export default DeliveryAutoConfigPromptModal;



