// Composant modal pour signaler un produit/service
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { NativeInput } from './SafeNativeDesign';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface SignalementModalProps {
    visible: boolean;
    onClose: () => void;
    serviceId: number;
    productId?: string;
    productName?: string;
}

const SignalementModal: React.FC<SignalementModalProps> = ({
    visible,
    onClose,
    serviceId,
    productId,
    productName
}) => {
        const { t } = useLanguageSafe();
const [selectedType, setSelectedType] = useState<string | null>(null);
    const [selectedMotifs, setSelectedMotifs] = useState<string[]>([]);
    const [motifLibre, setMotifLibre] = useState('');
    const [loading, setLoading] = useState(false);

    const typesSignalement = [
        { id: 'contenu_inapproprie', label: t('signalement.contenuInapproprie'), icon: '⚠️', color: '#EF4444' },
        { id: 'arnaque_suspectee', label: t('signalement.arnaqueSuspectee'), icon: '🚨', color: '#DC2626' },
        { id: 'prix_trompeur', label: t('signalementModal.prixTrompeur'), icon: '💰', color: '#F59E0B' },
        { id: 'produit_contrefait', label: t('signalement.produitContrefait'), icon: '🔍', color: '#F97316' },
        { id: 'photo_trompeuse', label: t('signalement.photoTrompeuse'), icon: '📷', color: '#FB923C' },
        { id: 'harcèlement', label: t('signalement.harcelement'), icon: '🛑', color: '#B91C1C' },
        { id: 'spam', label: t('signalement.spamPublicite'), icon: '📢', color: '#EA580C' },
        { id: 'informations_fausses', label: t('signalement.informationsFausses'), icon: '❌', color: '#DC2626' },
        { id: 'autre', label: 'Autre', icon: '📝', color: '#6B7280' },
    ];

    const motifsFrequents = [
        t('signalementModal.lePrestataireNeRepondPas'),
        'Les photos ne correspondent pas au produit',
        t('signalementModal.prixDifferentDeLannonce'),
        'Produit non disponible',
        'Demande d\'argent avant prestation',
        'Comportement suspect',
        t('signalementModal.coordonneesInvalides'),
        t('signalementModal.serviceDeMauvaiseQualite'),
        t('signalementModal.delaisNonRespectes'),
        t('signalementModal.produitDefectueux'),
    ];

    const handleSubmit = async () => {
        if (!selectedType) {
            Alert.alert('Erreur', t('signalementModal.veuillezSelectionnerUnTypeDeSignalement'));
            return;
        }

        if (selectedMotifs.length === 0 && !motifLibre.trim()) {
            Alert.alert('Erreur', t('signalementModal.veuillezPreciserAuMoinsUnMotif'));
            return;
        }

        setLoading(true);
        try {
            const response = await apiPost('/api/signalements', {
                service_id: serviceId,
                product_id: productId,
                product_name: productName,
                type_signalement: selectedType,
                motifs_predefinis: selectedMotifs.length > 0 ? selectedMotifs : null,
                motif_libre: motifLibre.trim() || null
            });

            if (response.success) {
                Alert.alert(
                    t('signalementModal.signalementEnregistre'),
                    t('signalementModal.referenceNn', { (response_data as any)_reference: (response.data as any).reference, (response_data as any)_message: (response.data as any).message }),
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                resetForm();
                                onClose();
                            }
                        }
                    ]
                );
            } else {
                throw new Error(response.error || 'Erreur lors du signalement');
            }
        } catch (error: any) {
            console.error('[SignalementModal] Erreur:', error);
            Alert.alert(
                'Erreur',
                error.message || t('signalementModal.impossibleDenregistrerLeSignalementReessayez')
            );
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setSelectedType(null);
        setSelectedMotifs([]);
        setMotifLibre('');
    };

    const toggleMotif = (motif: string) => {
        if (selectedMotifs.includes(motif)) {
            setSelectedMotifs(selectedMotifs.filter(m => m !== motif));
        } else {
            setSelectedMotifs([...selectedMotifs, motif]);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerIcon}>
                            <SafeIcon name="flag" size={24} color={modernColors.error} />
                        </View>
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.headerTitle}>{t('signalement.signalerUnProbleme')}</Text>
                            <Text style={styles.headerSubtitle}>
                                {productName ? `Produit: ${productName}` : 'Service'}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Type de signalement */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>{t('signalement.typeDeProbleme')}</Text>
                            <View style={styles.typesGrid}>
                                {typesSignalement.map((type) => (
                                    <TouchableOpacity
                                        key={type.id}
                                        style={[
                                            styles.typeCard,
                                            selectedType === type.id && styles.typeCardActive,
                                            { borderColor: selectedType === type.id ? type.color : modernColors.border }
                                        ]}
                                        onPress={() => setSelectedType(type.id)}
                                    >
                                        <Text style={styles.typeIcon}>{type.icon}</Text>
                                        <Text style={[
                                            styles.typeLabel,
                                            selectedType === type.id && { color: type.color }
                                        ]}>
                                            {type.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Motifs fréquents */}
                        {selectedType && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>{t('signalement.motifsFrequentsOptionnel')}</Text>
                                <Text style={styles.sectionHint}>Cochez tout ce qui s'applique</Text>
                                {motifsFrequents.map((motif) => (
                                    <TouchableOpacity
                                        key={motif}
                                        style={styles.motifItem}
                                        onPress={() => toggleMotif(motif)}
                                    >
                                        <View style={[
                                            styles.checkbox,
                                            selectedMotifs.includes(motif) && styles.checkboxChecked
                                        ]}>
                                            {selectedMotifs.includes(motif) && (
                                                <SafeIcon name="check" size={14} color="#FFFFFF" />
                                            )}
                                        </View>
                                        <Text style={styles.motifText}>{motif}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {/* Description libre */}
                        {selectedType && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>{t('signalement.descriptionDuProbleme')}</Text>
                                <Text style={styles.sectionHint}>{t('signalement.decrivezEnDetailLeProbleme')}</Text>
                                <NativeInput
                                    placeholder={t('signalement.exLePrestataireDemandeLe')}
                                    value={motifLibre}
                                    onChangeText={setMotifLibre}
                                    multiline
                                    numberOfLines={5}
                                    style={styles.textarea}
                                />
                                <Text style={styles.charCount}>
                                    {motifLibre.length} / 500 caractères
                                </Text>
                            </View>
                        )}

                        {/* Avertissement */}
                        <View style={styles.warningBox}>
                            <SafeIcon name="shield" size={18} color={modernColors.primary} />
                            <Text style={styles.warningText}>
                                Les signalements abusifs peuvent entraîner des sanctions. Assurez-vous que votre signalement est justifié.
                            </Text>
                        </View>
                    </ScrollView>

                    {/* Footer avec boutons */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => {
                                resetForm();
                                onClose();
                            }}
                            disabled={loading}
                        >
                            <Text style={styles.cancelButtonText}>{t('signalementModal.annuler')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.submitButton,
                                (!selectedType || loading) && styles.submitButtonDisabled
                            ]}
                            onPress={handleSubmit}
                            disabled={!selectedType || loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <SafeIcon name="flag" size={18} color="#FFFFFF" />
                                    <Text style={styles.submitButtonText}>{t('signalement.envoyerLeSignalement')}</Text>
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
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: modernColors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    headerIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: modernColors.error + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTextContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    headerSubtitle: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    closeButton: {
        padding: 4,
    },
    content: {
        maxHeight: '70%',
    },
    section: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    sectionHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 12,
    },
    typesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    typeCard: {
        width: '30%',
        aspectRatio: 1,
        backgroundColor: modernColors.surface,
        borderWidth: 2,
        borderColor: modernColors.border,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    typeCardActive: {
        backgroundColor: modernColors.background,
    },
    typeIcon: {
        fontSize: 28,
    },
    typeLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.text,
        textAlign: 'center',
    },
    motifItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: modernColors.background,
        borderRadius: 8,
        marginBottom: 8,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    motifText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
    },
    textarea: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: modernColors.text,
        backgroundColor: modernColors.surface,
        minHeight: 120,
        textAlignVertical: 'top',
    },
    charCount: {
        fontSize: 11,
        color: modernColors.textSecondary,
        textAlign: 'right',
        marginTop: 4,
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        backgroundColor: modernColors.primary + '15',
        padding: 16,
        margin: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.primary + '30',
    },
    warningText: {
        flex: 1,
        fontSize: 12,
        color: modernColors.primary,
        lineHeight: 18,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: modernColors.background,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    cancelButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
    },
    submitButton: {
        flex: 2,
        backgroundColor: modernColors.error,
        paddingVertical: 14,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    submitButtonDisabled: {
        opacity: 0.5,
    },
    submitButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default SignalementModal;

