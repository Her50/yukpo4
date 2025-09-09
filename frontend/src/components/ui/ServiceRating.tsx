import React, { useState } from 'react';
import { Star, MessageSquare, ThumbsUp, Clock, CheckCircle } from 'lucide-react';
import { Button } from './buttons/Button';
import { Service, Review, ServiceStats } from '@/types/service';

interface ServiceRatingProps {
  service: Service;
  onRatingSubmit?: (rating: number, comment: string) => void;
  onReviewHelpful?: (reviewId: number) => void;
  showReviewForm?: boolean;
  className?: string;
}

export const ServiceRating: React.FC<ServiceRatingProps> = ({
  service,
  onRatingSubmit,
  onReviewHelpful,
  showReviewForm = false,
  className = ''
}) => {
  const [showReviewFormLocal, setShowReviewFormLocal] = useState(showReviewForm);
  const [rating, setRating] = useState(service.user_rating || 0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      }
    } catch (error) {
      console.error('Erreur lors de la soumission de la note:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = (rating: number, interactive = false, size = 'w-4 h-4') => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type={interactive ? 'button' : undefined}
            onClick={interactive ? () => setRating(star) : undefined}
            className={`${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
            disabled={!interactive}
          >
            <Star
              className={`${size} ${
                star <= rating
                  ? 'text-yellow-400 fill-current'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  const renderStatsBadge = () => {
    if (!stats) return null;

    return (
      <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded-full">
        {renderStars(stats.average_rating, false, 'w-3 h-3')}
        <span className="font-medium">{stats.average_rating.toFixed(1)}</span>
        <span>•</span>
        <span>{stats.total_reviews} avis</span>
        {stats.completion_rate > 0 && (
          <>
            <span>•</span>
            <CheckCircle className="w-3 h-3 text-green-500" />
            <span>{Math.round(stats.completion_rate * 100)}%</span>
          </>
        )}
        {stats.response_time > 0 && (
          <>
            <span>•</span>
            <Clock className="w-3 h-3 text-blue-500" />
            <span>{Math.round(stats.response_time)}h</span>
          </>
        )}
      </div>
    );
  };

  const renderReviewForm = () => {
    if (!showReviewFormLocal) return null;

    return (
      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="text-sm font-medium text-blue-800 mb-3">Donner votre avis</h4>
        
        <div className="mb-3">
          <label className="block text-xs text-blue-700 mb-2">Note</label>
          {renderStars(rating, true, 'w-6 h-6')}
        </div>
        
        <div className="mb-3">
          <label className="block text-xs text-blue-700 mb-2">Commentaire</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Partagez votre expérience avec ce service..."
            className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            rows={3}
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={handleRatingSubmit}
            disabled={rating === 0 || isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
            size="sm"
          >
            {isSubmitting ? 'Envoi...' : 'Envoyer l\'avis'}
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setShowReviewFormLocal(false)}
            className="text-gray-600 border-gray-300 text-sm"
            size="sm"
          >
            Annuler
          </Button>
        </div>
      </div>
    );
  };

  const renderReviews = () => {
    if (reviews.length === 0) return null;

    return (
      <div className="mt-4 space-y-3">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Avis récents ({reviews.length})
        </h4>
        
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {reviews.slice(0, 3).map((review) => (
            <div key={review.id} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                    {review.user_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-900">{review.user_name}</span>
                </div>
                {renderStars(review.rating, false, 'w-3 h-3')}
              </div>
              
              <p className="text-sm text-gray-700 mb-2">{review.comment}</p>
              
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{new Date(review.created_at).toLocaleDateString()}</span>
                <button
                  onClick={() => onReviewHelpful?.(review.id)}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                >
                  <ThumbsUp className="w-3 h-3" />
                  <span>{review.helpful_count}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Badge de statistiques compact */}
      {renderStatsBadge()}
      
      {/* Bouton pour donner un avis */}
      {!showReviewFormLocal && (
        <Button
          variant="outline"
          onClick={() => setShowReviewFormLocal(true)}
          className="w-full text-sm border-gray-300 hover:border-blue-500 hover:text-blue-600"
          size="sm"
        >
          <Star className="w-4 h-4 mr-2" />
          Donner un avis
        </Button>
      )}
      
      {/* Formulaire d'avis */}
      {renderReviewForm()}
      
      {/* Avis récents */}
      {renderReviews()}
    </div>
  );
}; 