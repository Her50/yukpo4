/**
 * 🛒 Composants d'étapes pour le flux de shopping
 * Divisé en étapes pour une meilleure UX
 */

import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { modernColors } from '../../theme/modernTheme';
import { NativeButton, NativeCard } from '../SafeNativeDesign';
import { SafeIcon } from '../SafeIcon';
import { SavedAddressSelector } from './SavedAddressSelector';
import { LocationObject } from '../LocationSelector';
import { UserSavedAddress } from '../../hooks/useSavedAddresses';

// Types
interface Supermarket {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    distance_km?: number;
    phone?: string;
    website?: string;
}

interface BasketItem {
    id: string;
    name: string;
    quantity: number;
    unit?: string;
    estimatedPrice?: number;
}

interface LocationData {
    latitude: number;
    longitude: number;
    address?: string;
}

// Étape 1: Sélection du supermarché
export const SupermarketSelectionStep: React.FC<{
    supermarkets: Supermarket[];
    selectedSupermarket: Supermarket | null;
    onSelect: (supermarket: Supermarket) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    sortBy: 'distance' | 'name';
    onSortChange: (sort: 'distance' | 'name') => void;
    loading: boolean;
    error?: string;
}> = ({
    supermarkets,
    selectedSupermarket,
    onSelect,
    searchQuery,
    onSearchChange,
    sortBy,
    onSortChange,
    loading,
    error,
    onViewProducts,
}) => {
        const filtered = React.useMemo(() => {
            let filtered = supermarkets;
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                filtered = filtered.filter(
                    (sm) =>
                        sm.name.toLowerCase().includes(query) ||
                        sm.address.toLowerCase().includes(query)
                );
            }
            return filtered.sort((a, b) => {
                if (sortBy === 'distance') {
                    return (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity);
                }
                return a.name.localeCompare(b.name);
            });
        }, [supermarkets, searchQuery, sortBy]);

        if (selectedSupermarket) {
            return (
                <View style={styles.stepContainer}>
                    <NativeCard style={styles.selectedCard}>
                        <View style={styles.selectedHeader}>
                            <SafeIcon name="check-circle" size={24} color={modernColors.success} />
                            <Text style={styles.selectedTitle}>Supermarché sélectionné</Text>
                        </View>
                        <Text style={styles.supermarketName}>{selectedSupermarket.name}</Text>
                        <Text style={styles.supermarketAddress}>{selectedSupermarket.address}</Text>
                        {selectedSupermarket.distance_km && (
                            <Text style={styles.distance}>
                                À {selectedSupermarket.distance_km.toFixed(1)} km
                            </Text>
                        )}
                        <View style={styles.selectedActions}>
                            <NativeButton
                                title="Changer"
                                variant="outline"
                                size="small"
                                onPress={() => onSelect(null as any)}
                                style={styles.changeButton}
                            />
                            <NativeButton
                                title="Voir les produits"
                                variant="primary"
                                size="small"
                                onPress={() => {
                                    if (onViewProducts) {
                                        onViewProducts(selectedSupermarket);
                                    } else {
                                        (navigation as any).navigate('SupermarketHome', { supermarketId: selectedSupermarket.id });
                                    }
                                }}
                                style={styles.viewProductsButton}
                            />
                        </View>
                    </NativeCard>
                </View>
            );
        }

        return (
            <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>Choisissez votre supermarché</Text>
                <Text style={styles.stepSubtitle}>
                    Sélectionnez le supermarché où vous souhaitez faire vos courses
                </Text>

                {/* Recherche */}
                <View style={styles.searchContainer}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Rechercher un supermarché..."
                        value={searchQuery}
                        onChangeText={onSearchChange}
                        placeholderTextColor={modernColors.textSecondary}
                    />
                    <View style={styles.sortButtons}>
                        <TouchableOpacity
                            style={[styles.sortButton, sortBy === 'distance' && styles.sortButtonActive]}
                            onPress={() => onSortChange('distance')}
                        >
                            <Text style={[styles.sortButtonText, sortBy === 'distance' && styles.sortButtonTextActive]}>
                                Par distance
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.sortButton, sortBy === 'name' && styles.sortButtonActive]}
                            onPress={() => onSortChange('name')}
                        >
                            <Text style={[styles.sortButtonText, sortBy === 'name' && styles.sortButtonTextActive]}>
                                Par nom
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Liste */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={modernColors.primary} />
                        <Text style={styles.loadingText}>Chargement des supermarchés...</Text>
                    </View>
                ) : filtered.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <SafeIcon name="store" size={48} color={modernColors.textSecondary} />
                        <Text style={styles.emptyText}>
                            {searchQuery ? 'Aucun supermarché trouvé' : 'Aucun supermarché disponible'}
                        </Text>
                    </View>
                ) : (
                    <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
                        {filtered.map((supermarket) => (
                            <TouchableOpacity
                                key={supermarket.id}
                                style={styles.supermarketCard}
                                onPress={() => onSelect(supermarket)}
                            >
                                <View style={styles.supermarketInfo}>
                                    <Text style={styles.supermarketName}>{supermarket.name}</Text>
                                    <Text style={styles.supermarketAddress}>{supermarket.address}</Text>
                                    {supermarket.distance_km && (
                                        <Text style={styles.distance}>
                                            À {supermarket.distance_km.toFixed(1)} km
                                        </Text>
                                    )}
                                </View>
                                <SafeIcon name="chevron-right" size={20} color={modernColors.textSecondary} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                {error && (
                    <View style={styles.errorContainer}>
                        <SafeIcon name="alert-circle" size={16} color={modernColors.error} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}
            </View>
        );
    };

// Étape 2: Composition du panier
export const BasketCompositionStep: React.FC<{
    basketItems: BasketItem[];
    onAddItem: (item: BasketItem) => void;
    onRemoveItem: (id: string) => void;
    newItemName: string;
    onNewItemNameChange: (name: string) => void;
    newItemQuantity: string;
    onNewItemQuantityChange: (qty: string) => void;
    newItemUnit: string;
    onNewItemUnitChange: (unit: string) => void;
    newItemPrice: string;
    onNewItemPriceChange: (price: string) => void;
    showAddForm: boolean;
    onToggleAddForm: () => void;
    error?: string;
}> = ({
    basketItems,
    onAddItem,
    onRemoveItem,
    newItemName,
    onNewItemNameChange,
    newItemQuantity,
    onNewItemQuantityChange,
    newItemUnit,
    onNewItemUnitChange,
    newItemPrice,
    onNewItemPriceChange,
    showAddForm,
    onToggleAddForm,
    error,
}) => {
        const total = React.useMemo(() => {
            return basketItems.reduce((sum, item) => sum + (item.estimatedPrice || 0) * item.quantity, 0);
        }, [basketItems]);

        return (
            <View style={styles.stepContainer}>
                <View style={styles.stepHeader}>
                    <Text style={styles.stepTitle}>Votre panier</Text>
                    <TouchableOpacity style={styles.addButton} onPress={onToggleAddForm}>
                        <SafeIcon name="plus" size={16} color={modernColors.primary} />
                        <Text style={styles.addButtonText}>Ajouter</Text>
                    </TouchableOpacity>
                </View>

                {showAddForm && (
                    <NativeCard style={styles.addForm}>
                        <Text style={styles.formLabel}>Nouvel article</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Nom du produit *"
                            value={newItemName}
                            onChangeText={onNewItemNameChange}
                        />
                        <View style={styles.formRow}>
                            <TextInput
                                style={[styles.input, styles.inputHalf]}
                                placeholder="Quantité"
                                value={newItemQuantity}
                                onChangeText={onNewItemQuantityChange}
                                keyboardType="numeric"
                            />
                            <TextInput
                                style={[styles.input, styles.inputHalf]}
                                placeholder="Unité (kg, L...)"
                                value={newItemUnit}
                                onChangeText={onNewItemUnitChange}
                            />
                        </View>
                        <TextInput
                            style={styles.input}
                            placeholder={`Prix estimé (${detectedCurrency})`}
                            value={newItemPrice}
                            onChangeText={onNewItemPriceChange}
                            keyboardType="numeric"
                        />
                        <NativeButton
                            title="Ajouter au panier"
                            variant="primary"
                            size="small"
                            onPress={() => {
                                onAddItem({
                                    id: Date.now().toString(),
                                    name: newItemName,
                                    quantity: parseInt(newItemQuantity) || 1,
                                    unit: newItemUnit || undefined,
                                    estimatedPrice: newItemPrice ? parseFloat(newItemPrice) : undefined,
                                });
                                onNewItemNameChange('');
                                onNewItemQuantityChange('1');
                                onNewItemUnitChange('');
                                onNewItemPriceChange('');
                                onToggleAddForm();
                            }}
                        />
                    </NativeCard>
                )}

                {basketItems.length === 0 ? (
                    <View style={styles.emptyBasket}>
                        <SafeIcon name="shopping-bag" size={64} color={modernColors.textSecondary} />
                        <Text style={styles.emptyBasketText}>Votre panier est vide</Text>
                        <Text style={styles.emptyBasketSubtext}>
                            Ajoutez des articles pour continuer
                        </Text>
                    </View>
                ) : (
                    <ScrollView style={styles.basketList}>
                        {basketItems.map((item) => (
                            <NativeCard key={item.id} style={styles.basketItem}>
                                <View style={styles.basketItemInfo}>
                                    <Text style={styles.basketItemName}>{item.name}</Text>
                                    <Text style={styles.basketItemDetails}>
                                        {item.quantity} {item.unit || 'unité(s)'}
                                        {item.estimatedPrice && ` • ${item.estimatedPrice.toLocaleString('fr-FR')} ${detectedCurrency}`}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => onRemoveItem(item.id)}>
                                    <SafeIcon name="x" size={20} color={modernColors.error} />
                                </TouchableOpacity>
                            </NativeCard>
                        ))}
                        <NativeCard style={styles.totalCard}>
                            <Text style={styles.totalLabel}>Total estimé</Text>
                            <Text style={styles.totalValue}>
                                {total.toLocaleString('fr-FR')} {detectedCurrency}
                            </Text>
                        </NativeCard>
                    </ScrollView>
                )}

                {error && (
                    <View style={styles.errorContainer}>
                        <SafeIcon name="alert-circle" size={16} color={modernColors.error} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}
            </View>
        );
    };

// Étape 3: Adresse de livraison
export const DeliveryAddressStep: React.FC<{
    dropoffLocation: LocationData | null;
    onSelectLocation: () => void;
    onSelectSavedAddress?: (address: UserSavedAddress | LocationObject) => void;
    onUseCurrentLocation: () => void;
    loadingLocation: boolean;
    estimatedDistance: number | null;
    error?: string;
}> = ({
    dropoffLocation,
    onSelectLocation,
    onSelectSavedAddress,
    onUseCurrentLocation,
    loadingLocation,
    estimatedDistance,
    error,
}) => {
        // Handler pour sélection d'adresse sauvegardée
        const handleSavedAddressSelect = (address: UserSavedAddress | LocationObject) => {
            if (onSelectSavedAddress) {
                onSelectSavedAddress(address);
            }
        };

        return (
            <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>Adresse de livraison</Text>
                <Text style={styles.stepSubtitle}>
                    Où souhaitez-vous recevoir vos courses ?
                </Text>

                {/* ✅ NOUVEAU : Sélecteur d'adresse sauvegardée */}
                {onSelectSavedAddress && (
                    <View style={styles.savedAddressSelectorContainer}>
                        <SavedAddressSelector
                            addressType="dropoff"
                            value={dropoffLocation ? {
                                raw: dropoffLocation.address || '',
                                place_name: dropoffLocation.address || '',
                                coordinates: { lat: dropoffLocation.latitude, lng: dropoffLocation.longitude },
                                components: {},
                            } : undefined}
                            onSelect={handleSavedAddressSelect}
                            allowNew={true}
                        />
                    </View>
                )}

                {dropoffLocation ? (
                    <NativeCard style={styles.locationCard}>
                        <View style={styles.locationHeader}>
                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                            <Text style={styles.locationLabel}>Adresse sélectionnée</Text>
                        </View>
                        <Text style={styles.locationText}>
                            {dropoffLocation.address ||
                                `${dropoffLocation.latitude.toFixed(6)}, ${dropoffLocation.longitude.toFixed(6)}`}
                        </Text>
                        {estimatedDistance !== null && (
                            <Text style={styles.distance}>
                                Distance : {estimatedDistance.toFixed(1)} km
                            </Text>
                        )}
                        <NativeButton
                            title="Sélectionner sur la carte (nouveau)"
                            variant="outline"
                            size="small"
                            onPress={onSelectLocation}
                            style={styles.changeButton}
                        />
                    </NativeCard>
                ) : (
                    <View style={styles.locationActions}>
                        <NativeButton
                            title={loadingLocation ? 'Localisation...' : 'Utiliser ma position actuelle'}
                            variant="primary"
                            onPress={onUseCurrentLocation}
                            disabled={loadingLocation}
                            style={styles.locationButton}
                        />
                        <NativeButton
                            title="Sélectionner sur la carte"
                            variant="outline"
                            onPress={onSelectLocation}
                            style={styles.locationButton}
                        />
                    </View>
                )}

                {error && (
                    <View style={styles.errorContainer}>
                        <SafeIcon name="alert-circle" size={16} color={modernColors.error} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}
            </View>
        );
    };

const styles = StyleSheet.create({
    stepContainer: {
        flex: 1,
        padding: 20,
    },
    stepTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 8,
    },
    stepSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 24,
    },
    stepHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    searchContainer: {
        marginBottom: 16,
    },
    searchInput: {
        padding: 12,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 12,
        fontSize: 16,
        color: modernColors.text,
        marginBottom: 12,
    },
    sortButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    sortButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        alignItems: 'center',
    },
    sortButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    sortButtonText: {
        fontSize: 14,
        color: modernColors.text,
        fontWeight: '500',
    },
    sortButtonTextActive: {
        color: '#FFFFFF',
    },
    listContainer: {
        maxHeight: 400,
    },
    supermarketCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    supermarketInfo: {
        flex: 1,
    },
    supermarketName: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    supermarketAddress: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    distance: {
        fontSize: 12,
        color: modernColors.primary,
        marginTop: 4,
    },
    selectedCard: {
        backgroundColor: modernColors.success + '10',
        borderWidth: 2,
        borderColor: modernColors.success,
    },
    selectedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    selectedTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.success,
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    loadingText: {
        marginTop: 16,
        color: modernColors.textSecondary,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    emptyText: {
        marginTop: 16,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: modernColors.primary + '20',
        borderRadius: 8,
    },
    addButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    addForm: {
        marginBottom: 16,
    },
    formLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    input: {
        padding: 12,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        fontSize: 16,
        color: modernColors.text,
        marginBottom: 12,
    },
    formRow: {
        flexDirection: 'row',
        gap: 12,
    },
    inputHalf: {
        flex: 1,
    },
    emptyBasket: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 60,
    },
    emptyBasketText: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginTop: 16,
    },
    emptyBasketSubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
    },
    basketList: {
        maxHeight: 400,
    },
    basketItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    basketItemInfo: {
        flex: 1,
    },
    basketItemName: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    basketItemDetails: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    totalCard: {
        backgroundColor: modernColors.primary + '10',
        borderWidth: 2,
        borderColor: modernColors.primary,
        marginTop: 8,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    totalValue: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.primary,
        marginTop: 4,
    },
    locationCard: {
        marginTop: 16,
    },
    locationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    locationLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    locationText: {
        fontSize: 16,
        color: modernColors.text,
        marginBottom: 8,
    },
    locationActions: {
        gap: 12,
        marginTop: 16,
    },
    locationButton: {
        marginBottom: 0,
    },
    selectedActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    changeButton: {
        flex: 1,
    },
    viewProductsButton: {
        flex: 1,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: modernColors.error + '15',
        borderRadius: 8,
        marginTop: 16,
    },
    errorText: {
        fontSize: 14,
        color: modernColors.error,
        flex: 1,
    },
    savedAddressSelectorContainer: {
        marginBottom: 16,
    },
});


