// ✅ Phase 6.4: Composant pour résoudre les conflits de synchronisation

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
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

export interface ConflictInfo {
    conflict_type: 'timestamp_mismatch' | 'concurrent_edit' | 'deleted_while_editing';
    service_id: number;
    local_updated_at: string;
    server_updated_at: string;
    local_data?: any;
    server_data?: any;
}

interface ConflictResolutionModalProps {
    visible: boolean;
    conflict: ConflictInfo | null;
    onResolve: (resolution: 'use_local' | 'use_server' | 'merge' | 'cancel') => Promise<void>;
    onClose: () => void;
}

const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
    visible,
    conflict,
    onResolve,
    onClose,
}) => {
        const { t } = useLanguageSafe();
const [resolving, setResolving] = useState(false);

    if (!conflict) return null;

    const handleResolve = async (resolution: 'use_local' | 'use_server' | 'merge' | 'cancel') => {
        try {
            setResolving(true);
            await onResolve(resolution);
            onClose();
        } catch (error) {
            console.error('[ConflictResolutionModal] Erreur résolution:', error);
            Alert.alert('Erreur', t('conflictResolutionModal.impossibleDeResoudreLeConflit'));
        } finally {
            setResolving(false);
        }
    };

    const getConflictMessage = () => {
        switch (conflict.conflict_type) {
            case 'timestamp_mismatch':
                return t('conflictResolutionModal.leServiceAEteModifieSur');
            case 'concurrent_edit':
                return t('conflictResolutionModal.leServiceAEteModifieSimultanement');
            case 'deleted_while_editing':
                return t('conflictResolutionModal.leServiceAEteSupprimeSur');
            default:
                return t('conflictResolutionModal.unConflitAEteDetecteLors');
        }
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <SafeIcon name="alert-triangle" size={32} color={modernColors.warning} />
                        </View>
                        <Text style={styles.title}>Conflit de Synchronisation</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color={modernColors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content}>
                        <Text style={styles.message}>{getConflictMessage()}</Text>

                        <View style={styles.infoSection}>
                            <Text style={styles.sectionTitle}>{t('conflictResolution.detailsDuConflit')}</Text>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>{t('conflictResolution.serviceId')}</Text>
                                <Text style={styles.infoValue}>{conflict.service_id}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>{t('conflictResolution.modifieLocalement')}</Text>
                                <Text style={styles.infoValue}>
                                    {new Date(conflict.local_updated_at).toLocaleString('fr-FR')}
                                </Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>{t('conflictResolution.modifieSurServeur')}</Text>
                                <Text style={styles.infoValue}>
                                    {new Date(conflict.server_updated_at).toLocaleString('fr-FR')}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.resolutionSection}>
                            <Text style={styles.sectionTitle}>{t('conflictResolution.choisirUneResolution')}</Text>

                            <TouchableOpacity
                                onPress={() => handleResolve('use_server')}
                                disabled={resolving}
                                style={[styles.resolutionButton, styles.primaryButton]}
                            >
                                <SafeIcon name="cloud" size={18} color="#fff" />
                                <View style={styles.resolutionButtonContent}>
                                    <Text style={[styles.resolutionButtonText, { color: '#fff' }]}>
                                        Utiliser la version serveur
                                    </Text>
                                    <Text style={[styles.resolutionDescription, { color: '#fff' + 'CC' }]}>
                                        Ignorer vos modifications locales et utiliser la version du serveur
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => handleResolve('use_local')}
                                disabled={resolving}
                                style={[styles.resolutionButton, styles.secondaryButton]}
                            >
                                <SafeIcon name="smartphone" size={18} color={modernColors.primary} />
                                <View style={styles.resolutionButtonContent}>
                                    <Text style={[styles.resolutionButtonText, { color: modernColors.primary }]}>
                                        Utiliser ma version
                                    </Text>
                                    <Text style={styles.resolutionDescription}>
                                        Écraser la version serveur avec vos modifications locales
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {conflict.conflict_type !== 'deleted_while_editing' && (
                                <TouchableOpacity
                                    onPress={() => handleResolve('merge')}
                                    disabled={resolving}
                                    style={[styles.resolutionButton, styles.secondaryButton]}
                                >
                                    <SafeIcon name="git-merge" size={18} color={modernColors.primary} />
                                    <View style={styles.resolutionButtonContent}>
                                        <Text style={[styles.resolutionButtonText, { color: modernColors.primary }]}>
                                            Fusionner intelligemment
                                        </Text>
                                        <Text style={styles.resolutionDescription}>
                                            Combiner les modifications des deux versions (non implémenté)
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                onPress={() => handleResolve('cancel')}
                                disabled={resolving}
                                style={[styles.resolutionButton, styles.outlineButton]}
                            >
                                <SafeIcon name="x" size={18} color={modernColors.textSecondary} />
                                <View style={styles.resolutionButtonContent}>
                                    <Text style={[styles.resolutionButtonText, { color: modernColors.textSecondary }]}>
                                        Annuler la modification
                                    </Text>
                                    <Text style={styles.resolutionDescription}>
                                        Ne pas appliquer vos modifications
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: modernColors.warning + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        flex: 1,
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginLeft: 12,
    },
    closeButton: {
        padding: 4,
    },
    content: {
        padding: 20,
    },
    message: {
        fontSize: 16,
        color: '#374151',
        marginBottom: 20,
        lineHeight: 24,
    },
    infoSection: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    infoLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    resolutionSection: {
        marginBottom: 20,
    },
    resolutionButton: {
        marginBottom: 12,
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    primaryButton: {
        backgroundColor: modernColors.primary,
    },
    secondaryButton: {
        backgroundColor: modernColors.primary + '15',
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    outlineButton: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    resolutionButtonContent: {
        flex: 1,
    },
    resolutionButtonText: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    resolutionDescription: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
    },
});

export default ConflictResolutionModal;

