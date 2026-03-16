/**
 * SwipeableProductCard - Carte produit avec swipe actions (like, favoris, partage)
 * Inspiré de TikTok/Instagram pour une expérience utilisateur premium
 */

import React, { useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { modernColors } from '../theme/modernTheme';
import { hapticPress, hapticSuccess } from '../utils/hapticFeedback';
import SafeIcon from './SafeIcon';
import ProductCard from './ProductCard';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface SwipeableProductCardProps {
  product: any;
  service: any;
  onPress?: () => void;
  onLike?: (liked: boolean) => void;
  onFavorite?: (favorited: boolean) => void;
  onShare?: () => void;
  initialLiked?: boolean;
  initialFavorited?: boolean;
}

const SwipeableProductCard: React.FC<SwipeableProductCardProps> = ({
  product,
  service,
  onPress,
  onLike,
  onFavorite,
  onShare,
  initialLiked = false,
  initialFavorited = false,
}) => {
  const swipeableRef = useRef<Swipeable>(null);
  const [liked, setLiked] = React.useState(initialLiked);
  const [favorited, setFavorited] = React.useState(initialFavorited);

  const handleLike = () => {
    const newLiked = !liked;
    setLiked(newLiked);
    hapticPress();
    if (onLike) onLike(newLiked);
    if (newLiked) hapticSuccess();
    swipeableRef.current?.close();
  };

  const handleFavorite = () => {
    const newFavorited = !favorited;
    setFavorited(newFavorited);
    hapticPress();
    if (onFavorite) onFavorite(newFavorited);
    if (newFavorited) hapticSuccess();
    swipeableRef.current?.close();
  };

  const handleShare = () => {
    hapticPress();
    if (onShare) onShare();
    swipeableRef.current?.close();
  };

  // Action de droite (like)
  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>) => {
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [100, 0],
    });

    return (
      <View style={styles.rightActions}>
        <Animated.View
          style={[
            styles.actionButton,
            styles.likeButton,
            { transform: [{ translateX }] },
          ]}
        >
          <TouchableOpacity
            style={styles.actionButtonContent}
            onPress={handleLike}
            activeOpacity={0.8}
          >
            <SafeIcon
              name={liked ? 'heart' : 'heart-outline'}
              size={24}
              color="#FFFFFF"
              type="ionicons"
            />
            <Text style={styles.actionButtonText}>J'aime</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  // Action de gauche (favoris, partage)
  const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>) => {
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [-100, 0],
    });

    return (
      <View style={styles.leftActions}>
        <Animated.View
          style={[
            styles.actionButton,
            styles.favoriteButton,
            { transform: [{ translateX }] },
          ]}
        >
          <TouchableOpacity
            style={styles.actionButtonContent}
            onPress={handleFavorite}
            activeOpacity={0.8}
          >
            <SafeIcon
              name={favorited ? 'star' : 'star-outline'}
              size={24}
              color="#FFFFFF"
              type="ionicons"
            />
            <Text style={styles.actionButtonText}>{t('swipeableProductCard.favoris')}/Text>
          </TouchableOpacity>
        </Animated.View>
        <Animated.View
          style={[
            styles.actionButton,
            styles.shareButton,
            { transform: [{ translateX }] },
          ]}
        >
          <TouchableOpacity
            style={styles.actionButtonContent}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <SafeIcon
              name="share-outline"
              size={24}
              color="#FFFFFF"
              type="ionicons"
            />
            <Text style={styles.actionButtonText}>{t('swipeableProductCard.partager')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  return (
    <GestureHandlerRootView>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        renderLeftActions={renderLeftActions}
        friction={2}
        overshootRight={false}
        overshootLeft={false}
        onSwipeableWillOpen={() => hapticPress()}
      >
        <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
          <ProductCard product={product} service={service} />
        </TouchableOpacity>
      </Swipeable>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 100,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: 200,
  },
  actionButton: {
    width: 100,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  likeButton: {
    backgroundColor: '#EF4444',
  },
  favoriteButton: {
    backgroundColor: '#FBBF24',
  },
  shareButton: {
    backgroundColor: modernColors.primary,
  },
  actionButtonContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default SwipeableProductCard;

