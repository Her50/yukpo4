// ✅ Phase 1.3: Profil conducteur enrichi avec note, avis, badge vérifié
import React from 'react';
import {
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';
import { NativeCard } from '../SafeNativeDesign';

interface DriverReview {
    id: number;
    user_name: string;
    user_avatar?: string;
    note: number;
    comment?: string;
    date: string;
}

interface CovoiturageDriverProfileProps {
    driver: {
        user_id: number;
        nom_complet?: string;
        avatar_url?: string;
        note_moyenne?: number;
        nombre_trajets?: number;
        nombre_avis?: number;
        date_inscription?: string;
        is_verified?: boolean;
        badges?: string[];
    };
    reviews?: DriverReview[];
    onContactPress?: () => void;
    onViewAllReviews?: () => void;
}

const CovoiturageDriverProfile: React.FC<CovoiturageDriverProfileProps> = ({
    driver,
    reviews = [],
    onContactPress,
    onViewAllReviews
}) => {
    const { t } = useLanguageSafe();
    const renderStars = (rating: number) => {
        const stars = [];
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;

        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                stars.push(
                    <SafeIcon key={i} name="star" size={16} color="#FBBF24" />
                );
            } else if (i === fullStars && hasHalfStar) {
                stars.push(
                    <SafeIcon key={i} name="star-half" size={16} color="#FBBF24" />
                );
            } else {
                stars.push(
                    <SafeIcon key={i} name="star" size={16} color="#D1D5DB" />
                );
            }
        }
        return stars;
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('fr-FR', {
                month: 'long',
                year: 'numeric'
            });
        } catch {
            return 'N/A';
        }
    };

    return (
        <NativeCard style={styles.container}>
            <View style={styles.header}>
                <View style={styles.avatarContainer}>
                    {driver.avatar_url ? (
                        <Image
                            source={{ uri: driver.avatar_url }}
                            style={styles.avatar}
                        />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <SafeIcon name="user" size={32} color={modernColors.primary} />
                        </View>
                    )}
                    {driver.is_verified && (
                        <View style={styles.verifiedBadge}>
                            <SafeIcon name="check-circle" size={20} color="#10B981" />
                        </View>
                    )}
                </View>
                <View style={styles.info}>
                    <View style={styles.nameRow}>
                        <Text style={styles.name}>
                            {driver.nom_complet || 'Conducteur'}
                        </Text>
                        {driver.is_verified && (
                            <View style={styles.verifiedLabel}>
                                <Text style={styles.verifiedText}>{t('covoiturageDriverProfile.verifie')}</Text>
                            </View>
                        )}
                    </View>
                    {driver.note_moyenne !== undefined && (
                        <View style={styles.ratingRow}>
                            <View style={styles.stars}>
                                {renderStars(driver.note_moyenne)}
                            </View>
                            <Text style={styles.ratingText}>
                                {driver.note_moyenne.toFixed(1)} ({String(driver.nombre_avis || 0)} avis)
                            </Text>
                        </View>
                    )}
                    <Text style={styles.memberSince}>
                        Membre depuis {formatDate(driver.date_inscription)}
                    </Text>
                </View>
            </View>

            {/* Statistiques */}
            <View style={styles.stats}>
                <View style={styles.statItem}>
                    <SafeIcon name="car" size={20} color={modernColors.primary} />
                    <Text style={styles.statValue}>{String(driver.nombre_trajets || 0)}</Text>
                    <Text style={styles.statLabel}>Trajets</Text>
                </View>
                <View style={styles.statItem}>
                    <SafeIcon name="star" size={20} color="#FBBF24" />
                    <Text style={styles.statValue}>
                        {driver.note_moyenne?.toFixed(1) || 'N/A'}
                    </Text>
                    <Text style={styles.statLabel}>Note</Text>
                </View>
                <View style={styles.statItem}>
                    <SafeIcon name="message-circle" size={20} color={modernColors.primary} />
                    <Text style={styles.statValue}>{String(driver.nombre_avis || 0)}</Text>
                    <Text style={styles.statLabel}>Avis</Text>
                </View>
            </View>

            {/* Badges */}
            {driver.badges && driver.badges.length > 0 && (
                <View style={styles.badgesSection}>
                    <Text style={styles.sectionTitle}>Badges</Text>
                    <View style={styles.badges}>
                        {driver.badges.map((badge, index) => (
                            <View key={index} style={styles.badge}>
                                <Text style={styles.badgeText}>{badge}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* Avis récents */}
            {reviews.length > 0 && (
                <View style={styles.reviewsSection}>
                    <View style={styles.reviewsHeader}>
                        <Text style={styles.sectionTitle}>{t('covoiturageDriverProfile.avisRecents')}</Text>
                        {onViewAllReviews && (
                            <TouchableOpacity onPress={onViewAllReviews}>
                                <Text style={styles.viewAllText}>{t('covoiturageDriverProfile.voirTout')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    {reviews.slice(0, 3).map((review) => (
                        <View key={review.id} style={styles.review}>
                            <View style={styles.reviewHeader}>
                                <View style={styles.reviewAvatar}>
                                    {review.user_avatar ? (
                                        <Image
                                            source={{ uri: review.user_avatar }}
                                            style={styles.reviewAvatarImage}
                                        />
                                    ) : (
                                        <SafeIcon name="user" size={16} color={modernColors.primary} />
                                    )}
                                </View>
                                <View style={styles.reviewInfo}>
                                    <Text style={styles.reviewName}>{review.user_name}</Text>
                                    <View style={styles.reviewStars}>
                                        {renderStars(review.note)}
                                    </View>
                                </View>
                                <Text style={styles.reviewDate}>
                                    {new Date(review.date).toLocaleDateString('fr-FR')}
                                </Text>
                            </View>
                            {review.comment && (
                                <Text style={styles.reviewComment}>{review.comment}</Text>
                            )}
                        </View>
                    ))}
                </View>
            )}

            {/* Bouton contact */}
            {onContactPress && (
                <TouchableOpacity
                    style={styles.contactButton}
                    onPress={onContactPress}
                >
                    <SafeIcon name="message-circle" size={20} color="#fff" />
                    <Text style={styles.contactButtonText}>Contacter</Text>
                </TouchableOpacity>
            )}
        </NativeCard>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 16,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F3F4F6',
    },
    avatarPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    verifiedBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 2,
    },
    info: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    name: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    verifiedLabel: {
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    verifiedText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#059669',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    stars: {
        flexDirection: 'row',
        gap: 2,
    },
    ratingText: {
        fontSize: 14,
        color: '#6B7280',
    },
    memberSince: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    stats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 16,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 16,
    },
    statItem: {
        alignItems: 'center',
        gap: 4,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    statLabel: {
        fontSize: 12,
        color: '#6B7280',
    },
    badgesSection: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    badges: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    badge: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
    },
    reviewsSection: {
        marginBottom: 16,
    },
    reviewsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    viewAllText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    review: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    reviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
    },
    reviewAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    reviewAvatarImage: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    reviewInfo: {
        flex: 1,
    },
    reviewName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    reviewStars: {
        flexDirection: 'row',
        gap: 2,
    },
    reviewDate: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    reviewComment: {
        fontSize: 14,
        color: '#374151',
        lineHeight: 20,
    },
    contactButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: modernColors.primary,
        padding: 16,
        borderRadius: 12,
        marginTop: 8,
    },
    contactButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});

export default CovoiturageDriverProfile;


