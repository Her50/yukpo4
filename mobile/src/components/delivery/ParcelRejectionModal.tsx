// ✅ Phase 9 - Amélioration : Modal pour sélectionner la raison de refus d'un colis (Mobile)
import React, { useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import { ParcelRejectionReason } from '../../types/delivery';
import { NativeButton, NativeCard } from '../NativeDesign';
import SafeIcon from '../SafeIcon';

interface ParcelRejectionModalProps {
    visible: boolean;
    onClose: () => void;
    productName: string;
    onConfirm: (reason: ParcelRejectionReason) => Promise<void>;
}

const REJECTION_REASONS: Array<{ value: ParcelRejectionReason; label: string; icon: string }> = [
    { value: 'damaged', label: 'Produit endommagé', icon: '💔' },
    { value: 'wrong_item', label: 'Mauvais produit', icon: '❌' },
    { value: 'expired', label: 'Produit périmé', icon: '⏰' },
    { value: 'wrong_quantity', label: 'Mauvaise quantité', icon: '🔢' },
    { value: 'wrong_size', label: 'Mauvaise taille', icon: '📏' },
    { value: 'wrong_color', label: 'Mauvaise couleur', icon: '🎨' },
    { value: 'quality_issue', label: 'Problème de qualité', icon: '⚠️' },
    { value: 'not_ordered', label: 'Non commandé', icon: '🚫' },
    { value: 'duplicate', label: 'Doublon', icon: '📦' },
    { value: 'other', label: 'Autre raison', icon: '📝' },
];

const ParcelRejectionModal: React.FC<ParcelRejectionModalProps> = ({
    visible,
    onClose,
    productName,
    onConfirm,
}) => {
    const [selectedReason, setSelectedReason] = useState<ParcelRejectionReason | null>(null);
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        if (!selectedReason) {
            Alert.alert('Erreur', 'Veuillez sélectionner une raison de refus');
            return;
        }

        setLoading(true);
        try {
            await onConfirm(selectedReason);
            Alert.alert('Succès', 'Le produit a été refusé avec succès');
            onClose();
            setSelectedReason(null);
        } catch (error: any) {
            Alert.alert('Erreur', error.message || 'Impossible de refuser le produit');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <NativeCard style={styles.modal}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Refuser le produit</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color={modernColors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtitle}>
                        Sélectionnez la raison du refus pour <Text style={styles.productName}>{productName}</Text>
                    </Text>

                    <ScrollView style={styles.reasonsList} showsVerticalScrollIndicator={false}>
                        {REJECTION_REASONS.map((reason) => (
                            <TouchableOpacity
                                key={reason.value}
                                onPress={() => setSelectedReason(reason.value)}
                                style={[
                                    styles.reasonItem,
                                    selectedReason === reason.value && styles.reasonItemSelected,
                                ]}
                            >
                                <Text style={styles.reasonIcon}>{reason.icon}</Text>
                                <Text
                                    style={[
                                        styles.reasonLabel,
                                        selectedReason === reason.value && styles.reasonLabelSelected,
                                    ]}
                                >
                                    {reason.label}
                                </Text>
                                {selectedReason === reason.value && (
                                    <SafeIcon
                                        name="check-circle"
                                        size={20}
                                        color={modernColors.primary}
                                    />
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <View style={styles.actions}>
                        <NativeButton
                            title="Annuler"
                            variant="secondary"
                            onPress={onClose}
                            disabled={loading}
                            style={styles.button}
                        />
                        <NativeButton
                            title={loading ? 'En cours...' : 'Confirmer le refus'}
                            variant="primary"
                            onPress={handleConfirm}
                            disabled={!selectedReason || loading}
                            style={styles.button}
                        />
                    </View>
                </NativeCard>
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
        padding: 16,
    },
    modal: {
        width: '100%',
        maxWidth: 400,
        maxHeight: '80%',
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: modernColors.text,
    },
    closeButton: {
        padding: 4,
    },
    subtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 16,
    },
    productName: {
        fontWeight: '600',
        color: modernColors.text,
    },
    reasonsList: {
        maxHeight: 400,
        marginBottom: 16,
    },
    reasonItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
        marginBottom: 8,
    },
    reasonItemSelected: {
        borderColor: modernColors.primary,
        backgroundColor: modernColors.primary + '10',
    },
    reasonIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    reasonLabel: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
        color: modernColors.text,
    },
    reasonLabelSelected: {
        color: modernColors.primary,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flex: 1,
    },
});

export default ParcelRejectionModal;

