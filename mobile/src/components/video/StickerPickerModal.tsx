/**
 * Modal de sélection de stickers pour vidéos
 * Intégration avec la bibliothèque de stickers
 */

import React, { useState } from 'react';
import {
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    getPopularStickers,
    getStickersByCategory,
    searchStickers,
    Sticker,
    stickerCategories,
    StickerCategory,
} from '../../data/stickersLibrary';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';

interface StickerPickerModalProps {
    visible: boolean;
    onSelect: (sticker: Sticker) => void;
    onClose: () => void;
}

export const StickerPickerModal: React.FC<StickerPickerModalProps> = ({
    visible,
    onSelect,
    onClose,
}) => {
    const [selectedCategory, setSelectedCategory] = useState<StickerCategory>('emojis');
    const [searchQuery, setSearchQuery] = useState('');

    const getStickers = () => {
        if (searchQuery.trim()) {
            return searchStickers(searchQuery);
        }
        if (selectedCategory === 'emojis') {
            return getPopularStickers();
        }
        return getStickersByCategory(selectedCategory);
    };

    const stickers = getStickers();

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Choisir un sticker</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <SafeIcon name="x" size={20} color="#1F2937" />
                    </TouchableOpacity>
                </View>

                {/* Catégories */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.categoriesContainer}
                    contentContainerStyle={styles.categoriesContent}
                >
                    {stickerCategories.map((category) => (
                        <TouchableOpacity
                            key={category}
                            style={[
                                styles.categoryButton,
                                selectedCategory === category && styles.categoryButtonActive,
                            ]}
                            onPress={() => {
                                setSelectedCategory(category);
                                setSearchQuery('');
                            }}
                        >
                            <Text
                                style={[
                                    styles.categoryText,
                                    selectedCategory === category && styles.categoryTextActive,
                                ]}
                            >
                                {category.charAt(0).toUpperCase() + category.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Grille de stickers */}
                <FlatList
                    data={stickers}
                    numColumns={4}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.stickersGrid}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.stickerItem}
                            onPress={() => {
                                onSelect(item);
                                onClose();
                            }}
                        >
                            <Text style={styles.stickerEmoji}>{item.emoji || item.name}</Text>
                            <Text style={styles.stickerName} numberOfLines={1}>
                                {item.name}
                            </Text>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>Aucun sticker trouvé</Text>
                        </View>
                    }
                />
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2937',
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    categoriesContainer: {
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    categoriesContent: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    categoryButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        marginRight: 8,
    },
    categoryButtonActive: {
        backgroundColor: modernColors.primary,
    },
    categoryText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    categoryTextActive: {
        color: '#FFF',
    },
    stickersGrid: {
        padding: 16,
    },
    stickerItem: {
        flex: 1,
        margin: 4,
        padding: 12,
        backgroundColor: '#FFF',
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        minHeight: 80,
    },
    stickerEmoji: {
        fontSize: 32,
        marginBottom: 4,
    },
    stickerName: {
        fontSize: 10,
        color: '#6B7280',
        textAlign: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 16,
        color: '#9CA3AF',
    },
});

