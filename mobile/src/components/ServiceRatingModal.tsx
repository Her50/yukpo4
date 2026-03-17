import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface ServiceRatingModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (rating: number, comment: string) => Promise<boolean>;
    serviceTitle?: string;
    loading?: boolean;
    allowCommentWithoutRating?: boolean; // ✅ NOUVEAU: Permet les commentaires sans note
}

const ServiceRatingModal: React.FC<ServiceRatingModalProps> = ({
    visible,
    onClose,
    onSubmit,
    serviceTitle = 'Service',
    loading = false,
    allowCommentWithoutRating = true // ✅ NOUVEAU: Par défaut, permet les commentaires sans note
}) => {
        const { t } = useLanguageSafe();
const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        // ✅ CORRIGÉ: Permettre la soumission si :
        // 1. Une note est sélectionnée (avis complet), OU
        // 2. Un commentaire est saisi ET allowCommentWithoutRating est true (commentaire seul)
        const hasRating = rating > 0;
        const hasComment = comment.trim().length > 0;
        
        if (!hasRating && !hasComment) {
            Alert.alert('Champ requis', t('serviceRatingModal.veuillezSelectionnerUneNoteOuSaisir'));
            return;
        }
        
        if (!hasRating && !allowCommentWithoutRating) {
            Alert.alert('Note requise', t('serviceRatingModal.veuillezSelectionnerUneNoteAvantDe'));
            return;
        }

        setIsSubmitting(true);
        try {
            const success = await onSubmit(rating, comment);
            if (success) {
                Alert.alert(
                    t('serviceRatingModal.avisEnvoye'),
                    t('serviceRatingModal.merciPourVotreAvisIlSera'),
                    [{ text: 'OK', onPress: onClose }]
                );
                // Reset form
                setRating(0);
                setComment('');
            } else {
                Alert.alert('Erreur', 'Impossible d\t('serviceRatingModal.envoyerVotreAvisVeuillezReessayer'));
            }
        } catch (error) {
            console.error('⚠️ [ServiceRatingModal] Erreur soumission:', error);
            Alert.alert('Erreur', 'Une erreur est survenue lors de l\'envoi de votre avis.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        setRating(0);
        setComment('');
        onClose();
    };

    const renderStars = () => {
        return (
            <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                        key={star}
                        onPress={() => setRating(star)}
                        style={styles.starButton}
                        disabled={isSubmitting}
                    >
                        <Text style={[
                            styles.star,
                            star <= rating && styles.starActive
                        ]}>
                            {star <= rating ? '⭐' : '☆'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const getRatingText = () => {
        switch (rating) {
            case 1: return t('serviceRatingModal.tresDecu');
            case 2: return t('serviceRatingModal.decu');
            case 3: return 'Moyen';
            case 4: return 'Satisfait';
            case 5: return t('serviceRatingModal.tresSatisfait');
            default: return t('serviceRatingModal.selectionnezUneNote');
        }
    };

    const getRatingColor = () => {
        switch (rating) {
            case 1: return '#EF4444';
            case 2: return '#F97316';
            case 3: return '#F59E0B';
            case 4: return '#10B981';
            case 5: return '#059669';
            default: return modernColors.textSecondary;
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={handleCancel}
                        disabled={isSubmitting}
                    >
                        <SafeIcon name="x" size={24} color={modernColors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Donner un avis</Text>
                    <View style={styles.headerSpacer} />
                </View>

                {/* Content */}
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={true}
                >
                    {/* Service info */}
                    <View style={styles.serviceInfo}>
                        <Text style={styles.serviceTitle}>{serviceTitle}</Text>
                        <Text style={styles.serviceSubtitle}>{t('serviceRating.partagezVotreExperience')}</Text>
                    </View>

                    {/* Rating section */}
                    <View style={[
                        styles.ratingSection,
                        rating === 0 && comment.length > 0 && styles.ratingSectionHighlight
                    ]}>
                        <Text style={styles.ratingLabel}>
                            Votre note {!allowCommentWithoutRating && <Text style={styles.requiredStar}>*</Text>}
                        </Text>
                        <Text style={styles.ratingInstruction}>
                            Cliquez sur les étoiles ci-dessous pour noter
                        </Text>
                        {renderStars()}
                        <Text style={[
                            styles.ratingText,
                            { color: getRatingColor() }
                        ]}>
                            {getRatingText()}
                        </Text>
                        {rating === 0 && comment.length > 0 && !allowCommentWithoutRating && (
                            <View style={styles.warningBox}>
                                <SafeIcon name="alert-circle" size={16} color="#F59E0B" />
                                <Text style={styles.warningText}>
                                    N'oubliez pas de sélectionner une note !
                                </Text>
                            </View>
                        )}
                        {rating === 0 && comment.length > 0 && allowCommentWithoutRating && (
                            <View style={styles.infoBox}>
                                <SafeIcon name="info" size={16} color={modernColors.primary} />
                                <Text style={styles.infoText}>
                                    Vous pouvez publier un commentaire sans note
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Comment section */}
                    <View style={styles.commentSection}>
                        <Text style={styles.commentLabel}>
                            Commentaire {rating === 0 && allowCommentWithoutRating ? '(optionnel)' : ''}
                        </Text>
                        <TextInput
                            style={styles.commentInput}
                            value={comment}
                            onChangeText={setComment}
                            placeholder={t('serviceRating.decrivezVotreExperienceAvecCe')}
                            placeholderTextColor={modernColors.textSecondary}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            editable={!isSubmitting}
                        />
                        <Text style={styles.commentHint}>
                            Votre commentaire aidera d'autres utilisateurs
                        </Text>
                    </View>
                </ScrollView>

                {/* Footer */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.button, styles.cancelButton]}
                        onPress={handleCancel}
                        disabled={isSubmitting}
                    >
                        <Text style={styles.cancelButtonText}>{t('serviceRatingModal.annuler')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.button,
                            styles.submitButton,
                            rating === 0 && comment.trim().length === 0 && styles.submitButtonLocked
                        ]}
                        onPress={(rating === 0 && comment.trim().length === 0) ? () => {
                            Alert.alert(
                                'Champ requis',
                                t('serviceRatingModal.veuillezSelectionnerUneNoteOuSaisir'),
                                [{ text: t('common.understood') }]
                            );
                        } : handleSubmit}
                        disabled={isSubmitting || (rating === 0 && comment.trim().length === 0)}
                        activeOpacity={0.7}
                    >
                        <LinearGradient
                            colors={(rating === 0 && comment.trim().length === 0)
                                ? ['#E5E7EB', '#D1D5DB']
                                : (isSubmitting
                                    ? ['#667eea', '#764ba2']
                                    : modernColors.primaryGradient)}
                            style={styles.submitButtonGradient}
                        >
                            {(rating === 0 && comment.trim().length === 0) ? (
                                <>
                                    <SafeIcon name="star" size={20} color="#6B7280" style={styles.buttonIcon} />
                                    <Text style={styles.submitButtonTextLocked}>
                                        Note ou commentaire requis
                                    </Text>
                                    <SafeIcon name="arrow-up" size={20} color="#6B7280" style={styles.buttonIcon} />
                                </>
                            ) : (
                                <>
                                    {isSubmitting && (
                                        <SafeIcon name="loader" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                                    )}
                                    <Text style={styles.submitButtonText}>
                                        {isSubmitting ? 'Envoi en cours...' : (rating > 0 ? 'Envoyer l\'avis' : 'Publier le commentaire')}
                                    </Text>
                                    {!isSubmitting && (
                                        <SafeIcon name="send" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                                    )}
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    closeButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    headerSpacer: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 20,
    },
    serviceInfo: {
        alignItems: 'center',
        marginBottom: 32,
    },
    serviceTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.text,
        textAlign: 'center',
        marginBottom: 8,
    },
    serviceSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    ratingSection: {
        alignItems: 'center',
        marginBottom: 32,
        padding: 16,
        borderRadius: 12,
        backgroundColor: modernColors.surface,
    },
    ratingSectionHighlight: {
        backgroundColor: '#FEF3C7',
        borderWidth: 2,
        borderColor: '#F59E0B',
    },
    ratingLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    requiredStar: {
        color: '#EF4444',
        fontSize: 18,
        fontWeight: 'bold',
    },
    ratingInstruction: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginBottom: 16,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    starsContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    starButton: {
        padding: 4,
    },
    star: {
        fontSize: 32,
        color: modernColors.border,
    },
    starActive: {
        color: '#FCD34D',
    },
    ratingText: {
        fontSize: 16,
        fontWeight: '600',
    },
    warningBox: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    warningText: {
        fontSize: 13,
        color: '#D97706',
        fontWeight: '600',
        flex: 1,
    },
    infoBox: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    infoText: {
        fontSize: 13,
        color: modernColors.primary,
        fontWeight: '600',
        flex: 1,
    },
    commentSection: {
        marginBottom: 20,
    },
    commentLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    commentInput: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: modernColors.text,
        backgroundColor: modernColors.surface,
        minHeight: 100,
    },
    commentHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 20 : 20,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        backgroundColor: modernColors.background,
    },
    button: {
        flex: 1,
        borderRadius: 12,
        overflow: 'hidden',
    },
    cancelButton: {
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        textAlign: 'center',
        paddingVertical: 16,
    },
    submitButton: {
        // Style géré par le gradient
    },
    submitButtonLocked: {
        opacity: 1,
    },
    submitButtonDisabled: {
        opacity: 0.5,
    },
    submitButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    submitButtonTextLocked: {
        fontSize: 15,
        fontWeight: '600',
        color: '#6B7280',
    },
    submitButtonTextDisabled: {
        opacity: 0.7,
    },
    buttonIcon: {
        marginHorizontal: 4,
    },
});

export default ServiceRatingModal;


