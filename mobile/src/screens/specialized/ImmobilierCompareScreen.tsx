// Écran de comparaison de biens immobiliers
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { NativeButton } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { immobilierService, RealEstateProperty } from '../../services/immobilierService';
import { modernColors } from '../../theme/modernTheme';

type RouteParams = {
    propertyIds: number[];
    comparisonName?: string;
};

const ImmobilierCompareScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const propertyIds = route.params?.propertyIds || [];
    const comparisonName = route.params?.comparisonName || 'Comparaison';

    const [properties, setProperties] = useState<RealEstateProperty[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (propertyIds.length > 0) {
            loadComparison();
        } else {
            setError('Aucun bien sélectionné pour la comparaison');
            setLoading(false);
        }
    }, [propertyIds]);

    const loadComparison = async () => {
        try {
            setError(null);
            const response = await immobilierService.compareProperties(
                propertyIds,
                comparisonName
            );
            if (response.success && response.properties) {
                setProperties(response.properties);
            } else {
                setError('Erreur lors du chargement de la comparaison');
            }
        } catch (err: any) {
            console.error('[ImmobilierCompareScreen] Erreur:', err);
            setError(err.message || 'Erreur lors du chargement');
        } finally {
            setLoading(false);
        }
    };

    const formatPrice = (price?: number) => {
        if (!price) return 'N/A';
        if (price >= 1000000) {
            return `${(price / 1000000).toFixed(1)}M FCFA`;
        }
        return `${(price / 1000).toFixed(0)}K FCFA`;
    };

    const handlePropertyPress = (propertyId: number) => {
        (navigation as any).navigate('ImmobilierDetails', { propertyId });
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement de la comparaison...</Text>
            </View>
        );
    }

    if (error || properties.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <SafeIcon name="alert-circle" size={48} color="#EF4444" />
                <Text style={styles.errorText}>{error || 'Aucun bien à comparer'}</Text>
                <NativeButton
                    title="Retour"
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                />
            </View>
        );
    }

    const comparisonFields = [
        { key: 'titre', label: 'Titre', type: 'text' },
        { key: 'type_bien', label: 'Type', type: 'text' },
        { key: 'statut', label: 'Statut', type: 'text' },
        { key: 'superficie_m2', label: 'Superficie (m²)', type: 'number', suffix: ' m²' },
        { key: 'nb_chambres', label: 'Chambres', type: 'number' },
        { key: 'nb_salles_bain', label: 'Salles de bain', type: 'number' },
        { key: 'standing', label: 'Standing', type: 'text' },
        { key: 'prix_vente', label: 'Prix vente', type: 'price' },
        { key: 'prix_location_mensuel', label: 'Loyer mensuel', type: 'price' },
        { key: 'quartier', label: 'Quartier', type: 'text' },
        { key: 'ville', label: 'Ville', type: 'text' },
    ];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{comparisonName}</Text>
                <Text style={styles.headerSubtitle}>
                    {properties.length} bien{properties.length > 1 ? 's' : ''} comparé{properties.length > 1 ? 's' : ''}
                </Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.tableContainer}>
                    {/* En-tête avec noms des biens */}
                    <View style={styles.headerRow}>
                        <View style={styles.firstColumn}>
                            <Text style={styles.columnHeader}>Caractéristique</Text>
                        </View>
                        {properties.map((property, index) => (
                            <TouchableOpacity
                                key={property.id}
                                style={styles.propertyColumn}
                                onPress={() => handlePropertyPress(property.id)}
                            >
                                <Text style={styles.propertyTitle} numberOfLines={2}>
                                    {property.titre}
                                </Text>
                                {property.photos && property.photos.length > 0 && (
                                    <View style={styles.photoPlaceholder}>
                                        <SafeIcon name="image" size={24} color="#9CA3AF" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Lignes de comparaison */}
                    {comparisonFields.map((field) => (
                        <View key={field.key} style={styles.comparisonRow}>
                            <View style={styles.firstColumn}>
                                <Text style={styles.fieldLabel}>{field.label}</Text>
                            </View>
                            {properties.map((property) => {
                                const value = (property as any)[field.key];
                                let displayValue = 'N/A';

                                if (value !== undefined && value !== null) {
                                    if (field.type === 'price') {
                                        displayValue = formatPrice(value);
                                    } else if (field.type === 'number') {
                                        displayValue = `${value}${field.suffix || ''}`;
                                    } else {
                                        displayValue = String(value);
                                    }
                                }

                                return (
                                    <View key={property.id} style={styles.propertyColumn}>
                                        <Text style={styles.fieldValue}>{displayValue}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    ))}

                    {/* Actions */}
                    <View style={styles.actionsRow}>
                        <View style={styles.firstColumn}>
                            <Text style={styles.fieldLabel}>Actions</Text>
                        </View>
                        {properties.map((property) => (
                            <View key={property.id} style={styles.propertyColumn}>
                                <NativeButton
                                    title="Voir détails"
                                    onPress={() => handlePropertyPress(property.id)}
                                    style={styles.detailButton}
                                />
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    header: {
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#6B7280',
    },
    tableContainer: {
        padding: 16,
    },
    headerRow: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 8,
        marginBottom: 8,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    firstColumn: {
        width: 150,
        paddingRight: 12,
        borderRightWidth: 1,
        borderRightColor: '#E5E7EB',
    },
    propertyColumn: {
        width: 200,
        paddingLeft: 12,
        alignItems: 'center',
    },
    columnHeader: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    propertyTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 8,
    },
    photoPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    comparisonRow: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 8,
        marginBottom: 4,
        padding: 12,
        minHeight: 50,
    },
    fieldLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    fieldValue: {
        fontSize: 14,
        color: '#111827',
        textAlign: 'center',
    },
    actionsRow: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 8,
        marginTop: 8,
        padding: 12,
    },
    detailButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        minWidth: 120,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
    },
    errorText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#EF4444',
        textAlign: 'center',
    },
    backButton: {
        marginTop: 24,
    },
});

export default ImmobilierCompareScreen;

