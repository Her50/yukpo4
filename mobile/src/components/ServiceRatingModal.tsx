import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    Alert,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface ServiceRatingModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (rating: number, comment: string) => Promise<boolean>;
    serviceTitle?: string;
    loading?: boolean;
}

const ServiceRatingModal: React.FC<ServiceRatingModalProps> = ({
    visible,
    onClose,
    onSubmit,
    serviceTitle = 'Service',
    loading = false
}) => {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (rating === 0) {
            Alert.alert('Note requise', 'Veuillez s├®lectionner une note avant de soumettre votre avis.');
            return;
        }

        setIsSubmitting(true);
        try {
            const success = await onSubmit(rating, comment);
            if (success) {
                Alert.alert(
                    'Avis envoy├®',
                    'Merci pour votre avis ! Il sera visible apr├¿s validation.',
                    [{ text: 'OK', onPress: onClose }]
                );
                // Reset form
                setRating(0);
                setComment('');
            } else {
                Alert.alert('Erreur', 'Impossible d\'envoyer votre avis. Veuillez r├®essayer.');
            }
        } catch (error) {
            console.error('ÔØî [ServiceRatingModal] Erreur soumission:', error);
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
                            {star <= rating ? 'Ô¡É' : 'Ôÿå'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const getRatingText = () => {
        switch (rating) {
            case 1: return 'Tr├¿s d├®├ºu';
            case 2: return 'D├®├ºu';
            case 3: return 'Moyen';
            case 4: return 'Satisfait';
            case 5: return 'Tr├¿s satisfait';
            default: return 'S├®lectionnez une note';
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
            <View style={styles.container}>
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
                <View style={styles.content}>
                    {/* Service info */}
                    <View style={styles.serviceInfo}>
                        <Text style={styles.serviceTitle}>{serviceTitle}</Text>
                        <Text style={styles.serviceSubtitle}>Partagez votre exp├®rience</Text>
                    </View>

                    {/* Rating section */}
                    <View style={[
                        styles.ratingSection,
                        rating === 0 && comment.length > 0 && styles.ratingSectionHighlight
                    ]}>
                        <Text style={styles.ratingLabel}>
                            Votre note <Text style={styles.requiredStar}>*</Text>
                        </Text>
                        <Text style={styles.ratingInstruction}>
                            Cliquez sur les ├®toiles ci-dessous pour noter
                        </Text>
                        {renderStars()}
                        <Text style={[
                            styles.ratingText,
                            { color: getRatingColor() }
                        ]}>
                            {getRatingText()}
                        </Text>
                        {rating === 0 && comment.length > 0 && (
                            <View style={styles.warningBox}>
                                <SafeIcon name="alert-circle" size={16} color="#F59E0B" />
                                <Text style={styles.warningText}>
                                    N'oubliez pas de s├®lectionner une note !
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Comment section */}
                    <View style={styles.commentSection}>
                        <Text style={styles.commentLabel}>Commentaire (optionnel)</Text>
                        <TextInput
                            style={styles.commentInput}
                            value={comment}
                            onChangeText={setComment}
                            placeholder="D├®crivez votre exp├®rience avec ce service..."
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
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.button, styles.cancelButton]}
                        onPress={handleCancel}
                        disabled={isSubmitting}
                    >
                        <Text style={styles.cancelButtonText}>Annuler</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.button,
                            styles.submitButton,
                            rating === 0 && styles.submitButtonLocked
                        ]}
                        onPress={rating === 0 ? () => {
                            Alert.alert(
                                'Ô¡É Note requise',
                                'Veuillez d\'abord s├®lectionner une note en cliquant sur les ├®toiles ci-dessus.',
                                [{ text: 'Compris' }]
                            );
                        } : handleSubmit}
                        disabled={isSubmitting}
                        activeOpacity={0.7}
                    >
                        <LinearGradient
                            colors={rating === 0
                                ? ['#E5E7EB', '#D1D5DB']
                                : (isSubmitting
                                    ? ['#667eea', '#764ba2']
                                    : modernColors.primaryGradient)}
                            style={styles.submitButtonGradient}
                        >
                            {rating === 0 ? (
                                <>
                                    <SafeIcon name="star" size={20} color="#6B7280" style={styles.buttonIcon} />
                                    <Text style={styles.submitButtonTextLocked}>
                                        Cliquez sur les ├®toiles d'abord
                                    </Text>
                                    <SafeIcon name="arrow-up" size={20} color="#6B7280" style={styles.buttonIcon} />
                                </>
                            ) : (
                                <>
                                    {isSubmitting && (
                                        <SafeIcon name="loader" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                                    )}
                                    <Text style={styles.submitButtonText}>
                                        {isSubmitting ? 'Envoi en cours...' : 'Envoyer l\'avis'}
                                    </Text>
                                    {!isSubmitting && (
                                        <SafeIcon name="send" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                                    )}
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
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
    content: {
        flex: 1,
        padding: 20,
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
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
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
        // Style g├®r├® par le gradient
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


