/**
 * FavoriteCollections - Système de collections favoris niveau géant (Pinterest/Etsy style)
 * Collections personnalisées pour organiser les favoris
 */

import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiDelete, apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { triggerHaptic } from '../utils/hapticFeedback';
import SafeIcon from './SafeIcon';
import { useToaster } from './ToasterProvider';

interface Collection {
    id: string;
    name: string;
    color: string;
    icon: string;
    product_count: number;
}

interface FavoriteCollectionsProps {
    productId: string;
    serviceId: string;
    onCollectionChange?: () => void;
}

export const FavoriteCollections: React.FC<FavoriteCollectionsProps> = ({
    productId,
    serviceId,
    onCollectionChange,
}) => {
    const [collections, setCollections] = useState<Collection[]>([]);
    const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [newCollectionColor, setNewCollectionColor] = useState('#6366F1');
    const toaster = useToaster();

    const collectionColors = [
        '#6366F1', '#EF4444', '#10B981', '#F59E0B', '#EC4899',
        '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#14B8A6',
    ];

    useEffect(() => {
        loadCollections();
        loadProductCollections();
    }, [productId, serviceId]);

    const loadCollections = async () => {
        try {
            const response = await apiGet('/api/collections');
            if (response.success && response.data) {
                setCollections(response.data);
            }
        } catch (error) {
            console.error('[FavoriteCollections] Erreur chargement collections:', error);
        }
    };

    const loadProductCollections = async () => {
        try {
            const response = await apiGet(`/api/products/${serviceId}/${productId}/collections`);
            if (response.success && response.data) {
                setSelectedCollections((response.data as any[]).map((c: any) => c.id));
            }
        } catch (error) {
            console.error('[FavoriteCollections] Erreur chargement collections produit:', error);
        }
    };

    const toggleCollection = async (collectionId: string) => {
        const isSelected = selectedCollections.includes(collectionId);
        triggerHaptic('light');

        try {
            if (isSelected) {
                // Retirer de la collection
                await apiDelete(`/api/collections/${collectionId}/products/${productId}`);
                setSelectedCollections(prev => prev.filter(id => id !== collectionId));
                toaster.success('Retiré de la collection');
            } else {
                // Ajouter à la collection
                await apiPost(`/api/collections/${collectionId}/products`, {
                    product_id: productId,
                    service_id: serviceId,
                });
                setSelectedCollections(prev => [...prev, collectionId]);
                toaster.success('Ajouté à la collection');
            }
            onCollectionChange?.();
        } catch (error) {
            toaster.error('Erreur lors de la modification');
        }
    };

    const createCollection = async () => {
        if (!newCollectionName.trim()) {
            toaster.warning('Veuillez entrer un nom');
            return;
        }

        triggerHaptic('medium');
        try {
            const response = await apiPost('/api/collections', {
                name: newCollectionName.trim(),
                color: newCollectionColor,
                icon: 'folder',
            });

            if (response.success) {
                await loadCollections();
                setNewCollectionName('');
                setShowCreateModal(false);
                toaster.success('Collection créée');
                triggerHaptic('success');
            }
        } catch (error) {
            toaster.error('Erreur lors de la création');
        }
    };

    return (
        <>
            <TouchableOpacity
                style={styles.button}
                onPress={() => setShowModal(true)}
                accessibilityRole="button"
                accessibilityLabel="Gérer les collections"
            >
                <SafeIcon name="folder" size={18} color={modernColors.primary} />
                <Text style={styles.buttonText}>Collections</Text>
                {selectedCollections.length > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{selectedCollections.length}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <Modal
                visible={showModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Mes Collections</Text>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <SafeIcon name="x" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.collectionsList}>
                            {collections.map((collection) => {
                                const isSelected = selectedCollections.includes(collection.id);
                                return (
                                    <TouchableOpacity
                                        key={collection.id}
                                        style={[styles.collectionItem, isSelected && styles.collectionItemSelected]}
                                        onPress={() => toggleCollection(collection.id)}
                                    >
                                        <View style={[styles.collectionColor, { backgroundColor: collection.color }]} />
                                        <View style={styles.collectionInfo}>
                                            <Text style={styles.collectionName}>{collection.name}</Text>
                                            <Text style={styles.collectionCount}>
                                                {collection.product_count} produit{collection.product_count > 1 ? 's' : ''}
                                            </Text>
                                        </View>
                                        {isSelected && (
                                            <SafeIcon name="check-circle" size={20} color={collection.color} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.createButton}
                            onPress={() => setShowCreateModal(true)}
                        >
                            <SafeIcon name="plus" size={20} color="#FFFFFF" />
                            <Text style={styles.createButtonText}>Créer une collection</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modal création collection */}
            <Modal
                visible={showCreateModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowCreateModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Nouvelle Collection</Text>
                            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                                <SafeIcon name="x" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.createForm}>
                            <Text style={styles.label}>Nom de la collection</Text>
                            <TextInput
                                style={styles.input}
                                value={newCollectionName}
                                onChangeText={setNewCollectionName}
                                placeholder="Ex: Mes favoris, À acheter..."
                                placeholderTextColor="#9CA3AF"
                            />

                            <Text style={styles.label}>Couleur</Text>
                            <View style={styles.colorPicker}>
                                {collectionColors.map((color) => (
                                    <TouchableOpacity
                                        key={color}
                                        style={[
                                            styles.colorOption,
                                            { backgroundColor: color },
                                            newCollectionColor === color && styles.colorOptionSelected,
                                        ]}
                                        onPress={() => setNewCollectionColor(color)}
                                    />
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[styles.submitButton, { backgroundColor: newCollectionColor }]}
                                onPress={createCollection}
                            >
                                <Text style={styles.submitButtonText}>Créer</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#EEF2FF',
        borderWidth: 1,
        borderColor: '#CBD5F5',
    },
    buttonText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    badge: {
        backgroundColor: modernColors.primary,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
        paddingBottom: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1F2937',
    },
    collectionsList: {
        maxHeight: 400,
        padding: 16,
    },
    collectionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        backgroundColor: '#F9FAFB',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    collectionItemSelected: {
        backgroundColor: '#EEF2FF',
        borderColor: modernColors.primary,
    },
    collectionColor: {
        width: 24,
        height: 24,
        borderRadius: 12,
        marginRight: 12,
    },
    collectionInfo: {
        flex: 1,
    },
    collectionName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 2,
    },
    collectionCount: {
        fontSize: 12,
        color: '#6B7280',
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginHorizontal: 20,
        marginTop: 12,
        padding: 16,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
    },
    createButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    createForm: {
        padding: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
        marginTop: 12,
    },
    input: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
        color: '#1F2937',
        backgroundColor: '#F9FAFB',
    },
    colorPicker: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 8,
    },
    colorOption: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: 'transparent',
    },
    colorOptionSelected: {
        borderColor: '#1F2937',
        transform: [{ scale: 1.1 }],
    },
    submitButton: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default FavoriteCollections;

