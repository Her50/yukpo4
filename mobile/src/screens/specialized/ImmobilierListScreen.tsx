// ✅ Écran de liste des biens immobiliers
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import ImmobilierResultCard from '../../components/specialized/ImmobilierResultCard';
import { immobilierService, PropertySearchFilters, RealEstateProperty } from '../../services/immobilierService';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

type RouteParams = {
    filters: PropertySearchFilters;
};

const ImmobilierListScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute() as any;
    const filters = route.params?.filters || {};

    const [properties, setProperties] = useState<RealEstateProperty[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedProperties, setSelectedProperties] = useState<Set<number>>(new Set());

    const loadProperties = async () => {
        try {
            setError(null);
            const response = await immobilierService.searchProperties(filters);
            if (response.success && response.data) {
                setProperties((response as any).data);
            } else {
                setError(t('immobilierList.aucunBienTrouve'));
            }
        } catch (err: any) {
            console.error('[ImmobilierListScreen] Erreur chargement:', err);
            setError(err.message || 'Erreur lors du chargement');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadProperties();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        loadProperties();
    };

    const handlePropertyPress = (property: RealEstateProperty) => {
        (navigation as any).navigate('ImmobilierDetails', {
            propertyId: property.id,
        });
    };

    const handleToggleSelection = (propertyId: number) => {
        const newSelection = new Set(selectedProperties);
        if (newSelection.has(propertyId)) {
            newSelection.delete(propertyId);
        } else {
            if (newSelection.size >= 5) {
                Alert.alert('Limite atteinte', 'Vous pouvez comparer jusqu\t('immobilierListScreen.a5BiensMaximum'));
                return;
            }
            newSelection.add(propertyId);
        }
        setSelectedProperties(newSelection);
    };

    const handleCompare = () => {
        if (selectedProperties.size < 2) {
            Alert.alert(t('immobilierListScreen.selectionRequise'), t('immobilierListScreen.selectionnezAuMoins2BiensPour'));
            return;
        }
        (navigation as any).navigate('ImmobilierCompare', {
            propertyIds: Array.from(selectedProperties),
        });
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>{t('immobilierList.chargementDesBiens')}</Text>
            </View>
        );
    }

    if (error && properties.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <SafeIcon name="alert-circle" size={48} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
                <Text style={styles.errorSubtext}>
                    Aucun bien immobilier trouvé avec ces critères
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.headerTitle}>
                        {properties.length} bien{properties.length > 1 ? 's' : 't('immobilierListScreen.trouvepropertieslength1')s' : ''}
                    </Text>
                    {selectedProperties.size > 0 && (
                        <Text style={styles.selectionCount}>
                            {selectedProperties.size} sélectionné{selectedProperties.size > 1 ? 's' : ''}
                        </Text>
                    )}
                </View>
                {selectedProperties.size > 0 && (
                    <TouchableOpacity
                        style={styles.compareButton}
                        onPress={handleCompare}
                    >
                        <SafeIcon name="git-compare" size={20} color="#fff" />
                        <Text style={styles.compareButtonText}>Comparer</Text>
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={properties}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.cardContainer}>
                        {selectedProperties.size > 0 && (
                            <TouchableOpacity
                                style={[
                                    styles.selectionCheckbox,
                                    selectedProperties.has(item.id) && styles.selectionCheckboxSelected,
                                ]}
                                onPress={() => handleToggleSelection(item.id)}
                            >
                                {selectedProperties.has(item.id) && (
                                    <SafeIcon name="check" size={20} color="#fff" />
                                )}
                            </TouchableOpacity>
                        )}
                        <ImmobilierResultCard
                            property={item}
                            onPress={() => {
                                if (selectedProperties.size > 0) {
                                    handleToggleSelection(item.id);
                                } else {
                                    handlePropertyPress(item);
                                }
                            }}
                        />
                    </View>
                )}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={[modernColors.primary]}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <SafeIcon name="home" size={64} color="#9CA3AF" />
                        <Text style={styles.emptyText}>{t('immobilierList.aucunBienTrouve')}</Text>
                        <Text style={styles.emptySubtext}>
                            Essayez de modifier vos critères de recherche
                        </Text>
                    </View>
                }
            />
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
        backgroundColor: '#fff',
    },
    header: {
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLeft: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    selectionCount: {
        fontSize: 14,
        color: modernColors.primary,
        marginTop: 4,
    },
    compareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.primary,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
    },
    compareButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    cardContainer: {
        position: 'relative',
    },
    selectionCheckbox: {
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 10,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderWidth: 2,
        borderColor: '#D1D5DB',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    selectionCheckboxSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    listContent: {
        padding: 16,
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
    errorSubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        minHeight: 400,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#6B7280',
    },
    emptySubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
    },
});

export default ImmobilierListScreen;

