// Modal pour proposer à l'utilisateur de renseigner son groupe sanguin
// S'affiche après une réponse favorable à une notification de don de sang

import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';

interface BloodGroupPromptModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

const BloodGroupPromptModal: React.FC<BloodGroupPromptModalProps> = ({
    visible,
    onClose,
    onSuccess,
}) => {
    const { t } = useLanguageSafe();
    const navigation = useNavigation();
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!selectedGroup) {
            Alert.alert(t('message.error'), t('bloodPrompt.errorSelectGroup'));
            return;
        }

        try {
            setSaving(true);

            // Créer ou mettre à jour le groupe sanguin
            const response = await apiPost('/api/blood-donation/donor/blood-group', {
                groupe_sanguin: selectedGroup,
                is_available_for_donation: true,
            });

            if (response.success) {
                Alert.alert(
                    t('bloodPrompt.successTitle'),
                    t('bloodPrompt.successMessage'),
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                onSuccess?.();
                                onClose();
                            },
                        },
                    ]
                );
            } else {
                Alert.alert(t('message.error'), response.error || t('bloodPrompt.errorSave'));
            }
        } catch (error: any) {
            console.error('[BloodGroupPromptModal] Erreur sauvegarde:', error);
            Alert.alert(t('message.error'), error.message || t('bloodPrompt.errorGeneric'));
        } finally {
            setSaving(false);
        }
    };

    const handleLater = () => {
        onClose();
    };

    const handleManageBloodGroup = () => {
        onClose();
        // Naviguer vers l'écran de gestion du groupe sanguin
        // @ts-ignore
        navigation.navigate('BloodGroupManagement');
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <SafeIcon name="droplet" size={32} color={modernColors.primary} />
                        </View>
                        <Text style={styles.title}>{t('bloodPrompt.title')}</Text>
                        <Text style={styles.subtitle}>
                            {t('bloodPrompt.subtitle')}
                        </Text>
                    </View>

                    {/* Sélection groupe sanguin */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('bloodPrompt.sectionTitle')}</Text>
                        <View style={styles.bloodGroupGrid}>
                            {BLOOD_GROUPS.map((group) => (
                                <TouchableOpacity
                                    key={group}
                                    style={[
                                        styles.bloodGroupButton,
                                        selectedGroup === group && styles.bloodGroupButtonSelected,
                                    ]}
                                    onPress={() => setSelectedGroup(group)}
                                >
                                    <Text
                                        style={[
                                            styles.bloodGroupText,
                                            selectedGroup === group && styles.bloodGroupTextSelected,
                                        ]}
                                    >
                                        {group}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Informations */}
                    <View style={styles.infoBox}>
                        <SafeIcon name="info" size={18} color={modernColors.primary} />
                        <Text style={styles.infoText}>
                            {t('bloodPrompt.infoText')}
                        </Text>
                    </View>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.laterButton]}
                            onPress={handleLater}
                            disabled={saving}
                        >
                            <Text style={styles.laterButtonText}>{t('bloodPrompt.later')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.actionButton,
                                styles.saveButton,
                                (!selectedGroup || saving) && styles.saveButtonDisabled,
                            ]}
                            onPress={handleSave}
                            disabled={!selectedGroup || saving}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <SafeIcon name="check-circle" size={18} color="#fff" />
                                    <Text style={styles.saveButtonText}>{t('bloodPrompt.save')}</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Lien vers gestion complète */}
                    <TouchableOpacity
                        style={styles.manageLink}
                        onPress={handleManageBloodGroup}
                    >
                        <Text style={styles.manageLinkText}>
                            {t('bloodPrompt.manageLink')}
                        </Text>
                        <SafeIcon name="chevron-right" size={16} color={modernColors.primary} />
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 24,
        width: '100%',
        maxWidth: 400,
        maxHeight: '90%',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: `${modernColors.primary}15`,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    bloodGroupGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    bloodGroupButton: {
        width: '22%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E5E7EB',
    },
    bloodGroupButtonSelected: {
        borderColor: modernColors.primary,
        backgroundColor: `${modernColors.primary}15`,
    },
    bloodGroupText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#6B7280',
    },
    bloodGroupTextSelected: {
        color: modernColors.primary,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: '#FEF3C7',
        padding: 12,
        borderRadius: 8,
        marginBottom: 20,
        gap: 10,
        borderWidth: 1,
        borderColor: '#FCD34D',
    },
    infoText: {
        flex: 1,
        fontSize: 12,
        color: '#92400E',
        lineHeight: 18,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 12,
        gap: 8,
    },
    laterButton: {
        backgroundColor: '#F3F4F6',
    },
    laterButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
    saveButton: {
        backgroundColor: modernColors.primary,
    },
    saveButtonDisabled: {
        backgroundColor: '#D1D5DB',
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    manageLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        gap: 6,
    },
    manageLinkText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
});

export default BloodGroupPromptModal;

