/**
 * Sélecteur de gifts/dons pour live streaming
 * Système de monétisation comme TikTok
 */

import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

export interface Gift {
    id: string;
    name: string;
    emoji: string;
    price: number; // En tokens/CFA
    animation?: string; // URL animation
    category: 'cheap' | 'medium' | 'expensive' | 'premium';
}

const giftsLibrary: Gift[] = [
    // Cheap (10-50 tokens)
    { id: 'gift-1', name: 'Rose', emoji: '🌹', price: 10, category: 'cheap' },
    { id: 'gift-2', name: t('giftSelector.cur'), emoji: '❤️', price: 20, category: 'cheap' },
    { id: 'gift-3', name: t('giftSelector.etoile'), emoji: '⭐', price: 30, category: 'cheap' },
    { id: 'gift-4', name: 'Clap', emoji: '👏', price: 40, category: 'cheap' },
    { id: 'gift-5', name: 'Feu', emoji: '🔥', price: 50, category: 'cheap' },

    // Medium (100-500 tokens)
    { id: 'gift-6', name: 'Bouquet', emoji: '💐', price: 100, category: 'medium' },
    { id: 'gift-7', name: 'Cadeau', emoji: '🎁', price: 200, category: 'medium' },
    { id: 'gift-8', name: t('giftSelector.trophee'), emoji: '🏆', price: 300, category: 'medium' },
    { id: 'gift-9', name: 'Diamant', emoji: '💎', price: 400, category: 'medium' },
    { id: 'gift-10', name: 'Couronne', emoji: '👑', price: 500, category: 'medium' },

    // Expensive (1000-5000 tokens)
    { id: 'gift-11', name: 'Ferrari', emoji: '🏎️', price: 1000, category: 'expensive' },
    { id: 'gift-12', name: 'Yacht', emoji: '🛥️', price: 2000, category: 'expensive' },
    { id: 'gift-13', name: t('giftSelector.chateau'), emoji: '🏰', price: 3000, category: 'expensive' },
    { id: 'gift-14', name: 'Rocket', emoji: '🚀', price: 4000, category: 'expensive' },
    { id: 'gift-15', name: t('giftSelector.meteore'), emoji: '☄️', price: 5000, category: 'expensive' },

    // Premium (10000+ tokens)
    { id: 'gift-16', name: 'Supernova', emoji: '🌟', price: 10000, category: 'premium' },
    { id: 'gift-17', name: 'Galaxie', emoji: '🌌', price: 20000, category: 'premium' },
    { id: 'gift-18', name: 'Univers', emoji: '🌠', price: 50000, category: 'premium' },
];

interface GiftSelectorProps {
    onSelect: (giftId: string, amount: number) => void;
    onClose: () => void;
}

export const GiftSelector: React.FC<GiftSelectorProps> = ({ onSelect, onClose }) => {
        const { t } = useLanguageSafe();
const [selectedCategory, setSelectedCategory] = useState<'cheap' | 'medium' | 'expensive' | 'premium'>('cheap');

    const filteredGifts = giftsLibrary.filter(gift => gift.category === selectedCategory);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{t('giftSelector.envoyerUnGift')}</Text>
                <TouchableOpacity onPress={onClose}>
                    <SafeIcon name="x" size={18} color="#1F2937" />
                </TouchableOpacity>
            </View>

            <View style={styles.categoriesContainer}>
                {(['cheap', 'medium', 'expensive', 'premium'] as const).map((category) => (
                    <TouchableOpacity
                        key={category}
                        style={[
                            styles.categoryButton,
                            selectedCategory === category && styles.categoryButtonActive,
                        ]}
                        onPress={() => setSelectedCategory(category)}
                    >
                        <Text
                            style={[
                                styles.categoryText,
                                selectedCategory === category && styles.categoryTextActive,
                            ]}
                        >
                            {category === 'cheap' ? '💰' :
                                category === 'medium' ? '💎' :
                                    category === 'expensive' ? '🏆' :
                                        category === 'premium' ? '👑' : ''}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={filteredGifts}
                numColumns={3}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.giftsList}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.giftItem}
                        onPress={() => onSelect(item.id, item.price)}
                    >
                        <Text style={styles.giftEmoji}>{item.emoji}</Text>
                        <Text style={styles.giftName}>{item.name}</Text>
                        <Text style={styles.giftPrice}>{item.price} tokens</Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#F9FAFB',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        maxHeight: 300,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
    },
    categoriesContainer: {
        flexDirection: 'row',
        padding: 8,
        gap: 8,
    },
    categoryButton: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#E5E7EB',
        alignItems: 'center',
    },
    categoryButtonActive: {
        backgroundColor: modernColors.primary,
    },
    categoryText: {
        fontSize: 20,
    },
    categoryTextActive: {
        // Style pour actif si nécessaire
    },
    giftsList: {
        padding: 12,
    },
    giftItem: {
        flex: 1,
        margin: 4,
        padding: 12,
        backgroundColor: '#FFF',
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    giftEmoji: {
        fontSize: 32,
        marginBottom: 4,
    },
    giftName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 2,
    },
    giftPrice: {
        fontSize: 10,
        color: modernColors.primary,
        fontWeight: '700',
    },
});

