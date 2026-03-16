/**
 * Composant d'avis et notation pour tickets de bus
 */

import React, { useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { analytics } from '../services/analytics';
import { apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface TicketRatingProps {
    visible: boolean;
    onClose: () => void;
    ticketId: string;
    paymentId: string;
    onRatingSubmitted?: () => void;
}

const TicketRating: React.FC<TicketRatingProps> = ({
    visible,
    onClose,
    ticketId,
    paymentId,
    onRatingSubmitted,
}) => {
        const { t } = useLanguageSafe();
const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    const ratingCategories = [
        { id: 'punctuality', label: t('ticketRating.ponctualite'), icon: 'clock' },
        { id: 'comfort', label: 'Confort', icon: 'seat' },
        { id: 'cleanliness', label: t('ticketRating.proprete'), icon: 'sparkles' },
        { id: 'staff', label: 'Personnel', icon: 'users' },
        { id: 'value', label: t('ticketRating.rapportQualiteprix'), icon: 'dollar-sign' },
    ];

    const handleSubmit = async () => {
        if (rating === 0) {
            Alert.alert('Note requise', 'Veuillez sélectionner une note');
            return;
        }

        try {
            setSubmitting(true);
            const response = await apiPost('/api/bus-tickets/rate', {
                ticket_id: ticketId,
                payment_id: paymentId,
                rating,
                comment: comment.trim() || undefined,
                categories: selectedCategories,
            });

            if (response.success) {
                analytics.track('ticket_rated', {
                    ticket_id: ticketId,
                    rating,
                    has_comment: !!comment.trim(),
                    categories_count: selectedCategories.length,
                });

                Alert.alert('Merci !', 'Votre avis a été enregistré');
                setRating(0);
                setComment('');
                setSelectedCategories([]);
                onRatingSubmitted?.();
                onClose();
            } else {
                Alert.alert('Erreur', response.error || 'Impossible d\'enregistrer votre avis');
            }
        } catch (error: any) {
            console.error('[TicketRating] Erreur:', error);
            Alert.alert('Erreur', 'Impossible d\'enregistrer votre avis');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleCategory = (categoryId: string) => {
        setSelectedCategories((prev) =>
            prev.includes(categoryId)
                ? prev.filter((id) => id !== categoryId)
                : [...prev, categoryId]
        );
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
                    <View style={styles.header}>
                        <Text style={styles.title}>Donner votre avis</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Note globale */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>{t('ticketRating.noteGlobale')}/Text>
                            <View style={styles.starsContainer}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <TouchableOpacity
                                        key={star}
                                        onPress={() => setRating(star)}
                                        style={styles.starButton}
                                    >
                                        <SafeIcon
                                            name="star"
                                            size={32}
                                            color={star <= rating ? '#FFD700' : '#E5E7EB'}
                                        />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Catégories */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>{t('ticketRating.categoriesOptionnel')}</Text>
                            <View style={styles.categoriesContainer}>
                                {ratingCategories.map((category) => (
                                    <TouchableOpacity
                                        key={category.id}
                                        style={[
                                            styles.categoryButton,
                                            selectedCategories.includes(category.id) &&
                                            styles.categoryButtonSelected,
                                        ]}
                                        onPress={() => toggleCategory(category.id)}
                                    >
                                        <SafeIcon
                                            name={category.icon}
                                            size={20}
                                            color={
                                                selectedCategories.includes(category.id)
                                                    ? '#fff'
                                                    : modernColors.primary
                                            }
                                        />
                                        <Text
                                            style={[
                                                styles.categoryText,
                                                selectedCategories.includes(category.id) &&
                                                styles.categoryTextSelected,
                                            ]}
                                        >
                                            {category.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Commentaire */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Commentaire (optionnel)</Text>
                            <TextInput
                                style={styles.commentInput}
                                value={comment}
                                onChangeText={setComment}
                                placeholder={t('ticketRating.partagezVotreExperience')}
                                placeholderTextColor="#9CA3AF"
                                multiline
                                numberOfLines={4}
                                maxLength={500}
                            />
                            <Text style={styles.charCount}>{comment.length}/500</Text>
                        </View>
                    </ScrollView>

                    {/* Actions */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton]}
                            onPress={onClose}
                        >
                            <Text style={styles.cancelButtonText}>{t('ticketRating.annuler')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
                            onPress={handleSubmit}
                            disabled={submitting || rating === 0}
                        >
                            <Text style={styles.submitButtonText}>
                                {submitting ? 'Envoi...' : 'Envoyer'}
                            </Text>
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
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    closeButton: {
        padding: 4,
    },
    content: {
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    starsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    starButton: {
        padding: 4,
    },
    categoriesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    categoryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
        backgroundColor: '#fff',
    },
    categoryButtonSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    categoryText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    categoryTextSelected: {
        color: '#fff',
    },
    commentInput: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#111827',
        minHeight: 100,
        textAlignVertical: 'top',
    },
    charCount: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'right',
        marginTop: 4,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    button: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#F3F4F6',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
    submitButton: {
        backgroundColor: modernColors.primary,
    },
    submitButtonDisabled: {
        opacity: 0.5,
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
});

export default TicketRating;


