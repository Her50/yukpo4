// ✅ NOUVEAU: Composant biens similaires vendus
// Date: 2026-01-26

import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';

interface SimilarProperty {
    id: number;
    property_id?: number;
    type_transaction: string;
    prix_final: number;
    date_transaction: string;
    quartier?: string;
    ville: string;
    type_bien: string;
    superficie_m2?: number;
    nb_chambres?: number;
    standing?: string;
    duree_marché_jours?: number;
}

interface SimilarPropertiesCardProps {
    propertyId: number;
    onPropertyPress?: (propertyId: number) => void;
}

const SimilarPropertiesCard: React.FC<SimilarPropertiesCardProps> = ({
    propertyId,
    onPropertyPress,
}) => {
    const [similar, setSimilar] = useState<SimilarProperty[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadSimilarProperties();
    }, [propertyId]);

    const loadSimilarProperties = async () => {
        try {
            setLoading(true);
            const response = await apiGet<{ success: boolean; data: SimilarProperty[] }>(
                `/api/immobilier/similar-sold-properties?property_id=${propertyId}`
            );

            if (response.success && response.data) {
                setSimilar(response.data);
            } else {
                setError('Impossible de charger les biens similaires');
            }
        } catch (err) {
            console.error('[SimilarPropertiesCard] Erreur:', err);
            setError('Erreur lors du chargement');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
    };

    const renderProperty = ({ item }: { item: SimilarProperty }) => (
        <TouchableOpacity
            style={styles.propertyCard}
            onPress={() => {
                if (item.property_id && onPropertyPress) {
                    onPropertyPress(item.property_id);
                }
            }}
            disabled={!item.property_id}
        >
            <View style={styles.propertyHeader}>
                <View style={styles.propertyInfo}>
                    <Text style={styles.propertyPrice}>
                        {item.prix_final.toLocaleString('fr-FR')} FCFA
                    </Text>
                    <Text style={styles.propertyDate}>
                        Vendu en {formatDate(item.date_transaction)}
                    </Text>
                </View>
                {item.duree_marché_jours && (
                    <View style={styles.durationBadge}>
                        <Text style={styles.durationText}>
                            {item.duree_marché_jours} jours
                        </Text>
                    </View>
                )}
            </View>
            <View style={styles.propertyDetails}>
                {item.superficie_m2 && (
                    <View style={styles.detailItem}>
                        <SafeIcon name="maximize-2" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.detailText}>{item.superficie_m2} m²</Text>
                    </View>
                )}
                {item.nb_chambres && (
                    <View style={styles.detailItem}>
                        <SafeIcon name="bed" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.detailText}>{item.nb_chambres} ch.</Text>
                    </View>
                )}
                {item.quartier && (
                    <View style={styles.detailItem}>
                        <SafeIcon name="map-pin" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.detailText}>{item.quartier}</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={modernColors.primary} />
            </View>
        );
    }

    if (error || similar.length === 0) {
        return (
            <View style={styles.container}>
                <SafeIcon name="info" size={24} color={modernColors.textSecondary} />
                <Text style={styles.emptyText}>
                    {error || 'Aucun bien similaire vendu trouvé'}
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>
                🏘️ Biens similaires vendus ({similar.length})
            </Text>
            <FlatList
                data={similar}
                renderItem={renderProperty}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: modernColors.surface,
        borderRadius: 16,
        padding: 16,
        marginVertical: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 16,
    },
    listContent: {
        paddingRight: 16,
    },
    propertyCard: {
        backgroundColor: modernColors.background,
        borderRadius: 12,
        padding: 12,
        marginRight: 12,
        width: 280,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    propertyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    propertyInfo: {
        flex: 1,
    },
    propertyPrice: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.primary,
        marginBottom: 4,
    },
    propertyDate: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    durationBadge: {
        backgroundColor: modernColors.success + '20',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    durationText: {
        fontSize: 10,
        color: modernColors.success,
        fontWeight: '600',
    },
    propertyDetails: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    detailText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    emptyText: {
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginTop: 8,
    },
});

export default SimilarPropertiesCard;

