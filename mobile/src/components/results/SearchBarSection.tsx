/**
 * SearchBarSection - Composant de recherche pour ResultatBesoinScreen
 * Extrait de ResultatBesoinScreen pour améliorer la maintenabilité
 */

import React, { useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress, hapticSelect } from '../../utils/hapticFeedback';
import ModernGPSModal from '../ModernGPSModal';
import SafeIcon from '../SafeIcon';
import SearchActionsBottomSheet from './SearchActionsBottomSheet';

interface SearchBarSectionProps {
    searchQuery: string;
    onSearchQueryChange: (text: string) => void;
    onSearchSubmit: () => void;
    loadingResults: boolean;
    dynamicPlaceholder?: string | null;
    autocompleteSuggestions: Array<{ text: string; icon?: string; type?: string }>;
    isLoadingAutocomplete: boolean;
    searchHistory: Array<{ text: string }>;
    onAutocompleteSelect: (text: string) => void;
    onRemoveFromHistory: (text: string) => void;
    onClearHistory: () => void;
    // Recherche avancée
    searchImages: string[];
    searchDocuments: Array<{ name: string; base64: string }>;
    searchGPSString: string;
    searchGPSData: { lat: number; lng: number; address?: string } | null;
    onTakePhoto: () => void;
    onChooseImages: () => void;
    onPickDocument: () => void;
    onRemoveImage: (index: number) => void;
    onRemoveDocument: (index: number) => void;
    onGPSSelect: (coordinatesString: string) => void;
    onClearGPS: () => void;
}

const SearchBarSection: React.FC<SearchBarSectionProps> = ({
    searchQuery,
    onSearchQueryChange,
    onSearchSubmit,
    loadingResults,
    dynamicPlaceholder,
    autocompleteSuggestions,
    isLoadingAutocomplete,
    searchHistory,
    onAutocompleteSelect,
    onRemoveFromHistory,
    onClearHistory,
    searchImages,
    searchDocuments,
    searchGPSString,
    searchGPSData,
    onTakePhoto,
    onChooseImages,
    onPickDocument,
    onRemoveImage,
    onRemoveDocument,
    onGPSSelect,
    onClearGPS,
}) => {
    const [showSearchActions, setShowSearchActions] = useState(false);
    const [showGPSModal, setShowGPSModal] = useState(false);

    return (
        <View style={styles.searchSection}>
            <View style={styles.searchBarContainer}>
                <View style={styles.searchInputWrapper}>
                    <SafeIcon name="search" size={18} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={dynamicPlaceholder || 'Rechercher un produit...'}
                        placeholderTextColor="#9CA3AF"
                        value={searchQuery}
                        onChangeText={onSearchQueryChange}
                        returnKeyType="search"
                        onSubmitEditing={onSearchSubmit}
                    />
                    <TouchableOpacity
                        style={styles.searchActionsButton}
                        onPress={() => setShowSearchActions(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Afficher les outils de recherche avancée"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <SafeIcon name="more-horizontal" size={18} color={modernColors.primary} />
                    </TouchableOpacity>
                </View>
                <TouchableOpacity
                    style={[styles.searchButton, loadingResults && styles.searchButtonDisabled]}
                    onPress={() => {
                        hapticPress();
                        onSearchSubmit();
                    }}
                    disabled={loadingResults}
                    activeOpacity={0.8}
                >
                    {loadingResults ? (
                        <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                        <SafeIcon name="send" size={20} color="#FFF" />
                    )}
                </TouchableOpacity>
            </View>

            {/* Autocomplete suggestions */}
            {autocompleteSuggestions.length > 0 && searchQuery.trim().length >= 0 && (
                <View style={styles.autocompleteContainer}>
                    {isLoadingAutocomplete && (
                        <View style={styles.autocompleteLoading}>
                            <ActivityIndicator size="small" color={modernColors.primary} />
                            <Text style={styles.autocompleteLoadingText}>Recherche...</Text>
                        </View>
                    )}
                    <ScrollView
                        style={styles.autocompleteList}
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled
                    >
                        {autocompleteSuggestions.map((item, index) => (
                            <TouchableOpacity
                                key={`autocomplete-${index}-${item.text}`}
                                style={styles.autocompleteItem}
                                onPress={() => {
                                    hapticSelect();
                                    onAutocompleteSelect(item.text);
                                }}
                                activeOpacity={0.7}
                            >
                                <SafeIcon
                                    name={item.icon || 'search'}
                                    size={18}
                                    color={item.type === 'history' ? modernColors.textSecondary : modernColors.primary}
                                    type="lucide"
                                />
                                <Text style={styles.autocompleteText} numberOfLines={1}>
                                    {item.text}
                                </Text>
                                {item.type === 'history' && (
                                    <TouchableOpacity
                                        style={styles.autocompleteDelete}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            hapticPress();
                                            onRemoveFromHistory(item.text);
                                        }}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <SafeIcon name="x" size={14} color={modernColors.textTertiary} />
                                    </TouchableOpacity>
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    {searchHistory.length > 0 && searchQuery.trim().length === 0 && (
                        <View style={styles.historyHeader}>
                            <Text style={styles.historyHeaderText}>Historique</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    hapticPress();
                                    onClearHistory();
                                }}
                            >
                                <Text style={styles.clearHistoryText}>Effacer</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}

            {/* Attachments preview */}
            {(searchImages.length > 0 || searchDocuments.length > 0 || !!searchGPSString) && (
                <View style={styles.searchAttachmentsContainer}>
                    {searchImages.length > 0 && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.searchImagesPreview}
                        >
                            {searchImages.filter(uri => uri != null && String(uri).trim() !== '').map((uri, index) => (
                                <View key={`search-image-${index}`} style={styles.searchImageWrapper}>
                                    <Image source={{ uri: String(uri) }} style={styles.searchImage} />
                                    <TouchableOpacity
                                        style={styles.attachmentRemoveButton}
                                        onPress={() => onRemoveImage(index)}
                                    >
                                        <Text style={styles.attachmentRemoveIcon}>✕</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    )}

                    {searchDocuments.length > 0 && (
                        <View style={styles.searchDocumentsList}>
                            {searchDocuments.filter(doc => doc != null && doc.name != null).map((doc, index) => (
                                <View key={`search-doc-${index}`} style={styles.searchDocumentItem}>
                                    <SafeIcon name="file-text" size={14} color={modernColors.primary} />
                                    <Text style={styles.searchDocumentName} numberOfLines={1}>
                                        {String(doc.name || 'Document')}
                                    </Text>
                                    <TouchableOpacity onPress={() => onRemoveDocument(index)}>
                                        <Text style={styles.attachmentRemoveIcon}>✕</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}

                    {!!searchGPSString && (
                        <View style={styles.searchGPSBadge}>
                            <SafeIcon name="navigation" size={14} color={modernColors.primary} />
                            <Text style={styles.searchGPSLabel} numberOfLines={1}>
                                {searchGPSString.includes('|')
                                    ? `${searchGPSString.split('|').length} points GPS`
                                    : searchGPSData
                                        ? `${searchGPSData.lat.toFixed(4)}, ${searchGPSData.lng.toFixed(4)}`
                                        : searchGPSString}
                            </Text>
                            <TouchableOpacity onPress={onClearGPS}>
                                <Text style={styles.attachmentRemoveIcon}>✕</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}

            {/* Search actions bottom sheet */}
            <SearchActionsBottomSheet
                isOpen={showSearchActions}
                onClose={() => setShowSearchActions(false)}
                onTakePhoto={onTakePhoto}
                onChooseImages={onChooseImages}
                onPickDocument={onPickDocument}
                onSelectGPS={() => {
                    setShowSearchActions(false);
                    setTimeout(() => {
                        setShowGPSModal(true);
                    }, 300);
                }}
            />

            {/* GPS Modal */}
            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={(coordinatesString) => {
                    onGPSSelect(coordinatesString);
                    setShowGPSModal(false);
                }}
                currentLocation={searchGPSData || undefined}
                title="Sélection de localisation GPS"
                allowZoneSelection
            />
        </View>
    );
};

const styles = StyleSheet.create({
    searchSection: {
        backgroundColor: '#FFF',
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0F172A',
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    searchInputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 8,
    },
    searchInput: {
        flex: 1,
        minWidth: 0,
        fontSize: 15,
        color: '#111827',
    },
    searchActionsButton: {
        width: 34,
        height: 34,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    searchButton: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    searchButtonDisabled: {
        opacity: 0.7,
    },
    autocompleteContainer: {
        marginTop: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        maxHeight: 300,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    autocompleteLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
    },
    autocompleteLoadingText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    autocompleteList: {
        maxHeight: 250,
    },
    autocompleteItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    autocompleteText: {
        flex: 1,
        fontSize: 15,
        color: '#111827',
    },
    autocompleteDelete: {
        padding: 4,
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#F9FAFB',
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    historyHeaderText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
        textTransform: 'uppercase',
    },
    clearHistoryText: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '600',
    },
    searchAttachmentsContainer: {
        marginTop: 12,
        gap: 12,
    },
    searchImagesPreview: {
        gap: 12,
        paddingVertical: 4,
    },
    searchImageWrapper: {
        position: 'relative',
        width: 72,
        height: 72,
        borderRadius: 12,
        overflow: 'hidden',
    },
    searchImage: {
        width: '100%',
        height: '100%',
    },
    attachmentRemoveButton: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: '#111827',
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    attachmentRemoveIcon: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    searchDocumentsList: {
        gap: 8,
    },
    searchDocumentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    searchDocumentName: {
        flex: 1,
        fontSize: 12,
        color: '#1F2937',
        fontWeight: '500',
    },
    searchGPSBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        alignSelf: 'flex-start',
        backgroundColor: '#ECFEFF',
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    searchGPSLabel: {
        fontSize: 12,
        color: '#0F172A',
        maxWidth: 200,
    },
});

export default SearchBarSection;

