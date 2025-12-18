import { ChatCircle, Heart, Star } from 'phosphor-react-native';
import React, { useState } from 'react';
import ReactNative from 'react-native';
import { Card, TextInput } from 'react-native-paper';
import { theme } from '../theme/theme';
import UserMentionPicker from './UserMentionPicker';

const { Alert, StyleSheet, Text, TouchableOpacity, View } = ReactNative;

interface Service {
  id: string;
  data?: any;
  reviews?: Review[];
  user_rating?: number;
}

interface Review {
  id: number;
  user_id: number;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
  helpful_count: number;
  is_helpful?: boolean;
}

interface ServiceRatingProps {
  service: Service;
  onRatingSubmit?: (rating: number, comment: string) => Promise<void>;
  onReviewHelpful?: (reviewId: number) => Promise<void>;
  showReviewForm?: boolean;
  customStyle?: any;
  onContactUser?: (userId: number, userName: string) => void;  // Ô£à NOUVEAU : Contact priv├®
}

interface User {
  id: number;
  nom_complet: string;
  email: string;
  avatar_url?: string;
}

export const ServiceRating: React.FC<ServiceRatingProps> = ({
  service,
  onRatingSubmit,
  onReviewHelpful,
  showReviewForm = false,
  customStyle,
  onContactUser
}) => {
  const [showReviewFormLocal, setShowReviewFormLocal] = useState(showReviewForm);
  const [rating, setRating] = useState(service.user_rating || 0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Ô£à NOUVEAU : ├ëtats pour @mention
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');

  const stats = service.data?.stats;
  const reviews = service.reviews || [];

  const handleRatingSubmit = async () => {
    if (rating === 0) return;

    setIsSubmitting(true);
    try {
      if (onRatingSubmit) {
        await onRatingSubmit(rating, comment);
        setComment('');
        setShowReviewFormLocal(false);
        Alert.alert('Succ├¿s', 'Votre avis a ├®t├® envoy├® avec succ├¿s !');
      }
    } catch (error) {
      console.error('Erreur lors de la soumission de la note:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer votre avis');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = (rating: number, interactive = false, size = 16) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={interactive ? () => setRating(star) : undefined}
            disabled={!interactive}
            style={styles.starButton}
          >
            <Star
              size={size}
              color={star <= rating ? '#FFD700' : '#E0E0E0'}
              weight={star <= rating ? 'fill' : 'regular'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'Date invalide';
    }
  };

  const getRatingText = (rating: number) => {
    const texts = ['', 'Tr├¿s mauvais', 'Mauvais', 'Moyen', 'Bon', 'Excellent'];
    return texts[rating] || '';
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return '#4CAF50';
    if (rating >= 3) return '#FF9800';
    return '#F44336';
  };

  // Ô£à NOUVEAU : D├®tecter "@" dans le commentaire
  const handleCommentChange = (text: string) => {
    setComment(text);

    // D├®tecter @mention
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex >= 0) {
      const textAfterAt = text.substring(lastAtIndex + 1);
      const spaceIndex = textAfterAt.indexOf(' ');

      if (spaceIndex === -1) {
        // Pas encore d'espace apr├¿s @, rechercher
        setMentionQuery(textAfterAt);
        setShowMentionPicker(true);
      } else {
        setShowMentionPicker(false);
      }
    } else {
      setShowMentionPicker(false);
    }
  };

  // Ô£à NOUVEAU : Ins├®rer la mention
  const insertMention = (user: User) => {
    const lastAtIndex = comment.lastIndexOf('@');
    const beforeAt = comment.substring(0, lastAtIndex);
    const afterAt = comment.substring(lastAtIndex + 1);
    const spaceIndex = afterAt.indexOf(' ');
    const afterMention = spaceIndex >= 0 ? afterAt.substring(spaceIndex) : '';

    setComment(`${beforeAt}@${user.nom_complet} ${afterMention}`);
    setShowMentionPicker(false);
  };

  // Ô£à NOUVEAU : Parser les @mentions pour l'affichage
  const parseMentions = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const regex = /@([A-Za-z├Ç-├┐\s]+?)(?=\s|$|[.,!?])/g;
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = regex.exec(text)) !== null) {
      // Texte avant la mention
      if (match.index > lastIndex) {
        parts.push(
          <Text key={`text-${key++}`} style={styles.reviewComment}>
            {text.substring(lastIndex, match.index)}
          </Text>
        );
      }

      // Mention
      parts.push(
        <Text key={`mention-${key++}`} style={styles.mentionText}>
          @{match[1]}
        </Text>
      );

      lastIndex = match.index + match[0].length;
    }

    // Texte apr├¿s la derni├¿re mention
    if (lastIndex < text.length) {
      parts.push(
        <Text key={`text-${key++}`} style={styles.reviewComment}>
          {text.substring(lastIndex)}
        </Text>
      );
    }

    return parts.length > 0 ? parts : [<Text key="default" style={styles.reviewComment}>{text}</Text>];
  };

  return (
    <View style={[styles.container, customStyle]}>
      {/* En-t├¬te avec note moyenne */}
      <View style={styles.header}>
        <View style={styles.ratingSummary}>
          <View style={styles.averageRating}>
            <Text style={styles.averageRatingNumber}>
              {stats?.rating ? stats.rating.toFixed(1) : '0.0'}
            </Text>
            <Text style={styles.averageRatingLabel}>/ 5</Text>
          </View>
          <View style={styles.ratingDetails}>
            {renderStars(Math.round(stats?.rating || 0), false, 20)}
            <Text style={styles.ratingCount}>
              {stats?.totalRatings || 0} avis
            </Text>
          </View>
        </View>
      </View>

      {/* Formulaire d'avis */}
      {showReviewFormLocal && (
        <Card style={styles.reviewForm}>
          <Card.Content>
            <Text style={styles.formTitle}>Donnez votre avis</Text>

            <View style={styles.ratingInput}>
              <Text style={styles.ratingLabel}>Note :</Text>
              {renderStars(rating, true, 24)}
              {rating > 0 && (
                <Text style={[styles.ratingText, { color: getRatingColor(rating) }]}>
                  {getRatingText(rating)}
                </Text>
              )}
            </View>

            <TextInput
              label="Commentaire (optionnel)"
              value={comment}
              onChangeText={handleCommentChange}  // Ô£à MODIFI├ë : D├®tecter @
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.commentInput}
              placeholder="Partagez votre exp├®rience... (@ pour taguer quelqu'un)"
            />

            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowReviewFormLocal(false)}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  rating === 0 && styles.submitButtonDisabled
                ]}
                onPress={handleRatingSubmit}
                disabled={rating === 0 || isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? 'Envoi...' : 'Envoyer'}
                </Text>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Bouton pour ajouter un avis */}
      {!showReviewFormLocal && (
        <TouchableOpacity
          style={styles.addReviewButton}
          onPress={() => setShowReviewFormLocal(true)}
        >
          <Star size={16} color={theme.colors.primary} />
          <Text style={styles.addReviewText}>Ajouter un avis</Text>
        </TouchableOpacity>
      )}

      {/* Liste des avis r├®cents */}
      {reviews.length > 0 && (
        <View style={styles.reviewsSection}>
          <Text style={styles.reviewsTitle}>Avis r├®cents</Text>

          {reviews.slice(0, 3).map((review) => (
            <Card key={review.id} style={styles.reviewCard}>
              <Card.Content>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewerInfo}>
                    <Text style={styles.reviewerName}>{review.user_name}</Text>
                    <View style={styles.reviewRating}>
                      {renderStars(review.rating, false, 14)}
                    </View>
                  </View>
                  <View style={styles.reviewMeta}>
                    <ChatCircle size={12} color="#666" />
                    <Text style={styles.reviewDate}>
                      {formatDate(review.created_at)}
                    </Text>
                  </View>
                </View>

                {review.comment && (
                  <View style={styles.reviewCommentContainer}>
                    {parseMentions(review.comment)}
                  </View>
                )}

                <View style={styles.reviewActions}>
                  <TouchableOpacity
                    style={styles.helpfulButton}
                    onPress={() => onReviewHelpful?.(review.id)}
                  >
                    <Heart
                      size={14}
                      color={review.is_helpful ? theme.colors.primary : '#666'}
                      weight={review.is_helpful ? 'fill' : 'regular'}
                    />
                    <Text style={[
                      styles.helpfulText,
                      review.is_helpful && styles.helpfulTextActive
                    ]}>
                      Utile ({review.helpful_count})
                    </Text>
                  </TouchableOpacity>

                  {/* Ô£à NOUVEAU : Bouton Contacter en priv├® */}
                  {onContactUser && review.user_id && (
                    <TouchableOpacity
                      style={styles.contactButton}
                      onPress={() => onContactUser(review.user_id, review.user_name)}
                    >
                      <ChatCircle size={14} color={theme.colors.primary} weight="regular" />
                      <Text style={styles.contactButtonText}>
                        Contacter en priv├®
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card.Content>
            </Card>
          ))}

          {reviews.length > 3 && (
            <TouchableOpacity style={styles.viewAllButton}>
              <Text style={styles.viewAllText}>
                Voir tous les avis ({reviews.length})
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Message si aucun avis */}
      {reviews.length === 0 && !showReviewFormLocal && (
        <View style={styles.noReviews}>
          <ChatCircle size={32} color="#E0E0E0" />
          <Text style={styles.noReviewsText}>Aucun avis pour le moment</Text>
          <Text style={styles.noReviewsSubtext}>
            Soyez le premier ├á donner votre avis !
          </Text>
        </View>
      )}

      {/* Ô£à NOUVEAU : Modal pour @mention */}
      {showMentionPicker && (
        <UserMentionPicker
          visible={showMentionPicker}
          onClose={() => setShowMentionPicker(false)}
          onSelectUser={insertMention}
          currentQuery={mentionQuery}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  ratingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  averageRating: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: 16,
  },
  averageRatingNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  averageRatingLabel: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginLeft: 4,
  },
  ratingDetails: {
    flex: 1,
  },
  ratingCount: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starButton: {
    padding: 2,
  },
  reviewForm: {
    marginBottom: 16,
    backgroundColor: '#f8f9fa',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 16,
  },
  ratingInput: {
    marginBottom: 16,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  commentInput: {
    marginBottom: 16,
    backgroundColor: 'white',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  addReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: 'white',
    marginBottom: 16,
  },
  addReviewText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.primary,
    marginLeft: 8,
  },
  reviewsSection: {
    marginTop: 16,
  },
  reviewsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 12,
  },
  reviewCard: {
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  reviewRating: {
    marginBottom: 4,
  },
  reviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewDate: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  reviewComment: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
    marginBottom: 12,
  },
  reviewActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  helpfulButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  helpfulText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  helpfulTextActive: {
    color: theme.colors.primary,
    fontWeight: '500',
  },
  viewAllButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: 8,
  },
  viewAllText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  noReviews: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noReviewsText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 12,
    marginBottom: 4,
  },
  noReviewsSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  // Ô£à NOUVEAU : Styles pour @mentions et contact priv├®
  reviewCommentContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mentionText: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginLeft: 12,
  },
  contactButtonText: {
    fontSize: 12,
    color: theme.colors.primary,
    marginLeft: 4,
    fontWeight: '500',
  },
});

export default ServiceRating;

