/**
 * SimpleSearchBar - Composant de recherche simple et efficace
 * Refonte complète pour corriger les problèmes de performance
 */

import React, { useState, useCallback } from 'react';
import {
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator,
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface SimpleSearchBarProps {
    placeholder?: string;
    onSubmit: (query: string) => void;
    onGPSPress?: () => void;
    showSendButton?: boolean;
    initialValue?: string;
    loading?: boolean;
    onImagePress?: () => void;
    onAudioPress?: () => void;
}

const SimpleSearchBar: React.FC<SimpleSearchBarProps> = ({
    placeholder = "Rechercher...",
    onSubmit,
    onGPSPress,
    showSendButton = true,
    initialValue = "",
    loading = false,
    onImagePress,
    onAudioPress,
}) => {
    const [query, setQuery] = useState(initialValue);

    const handleSubmit = useCallback(() => {
        const trimmed = query.trim();
        if (trimmed) {
            onSubmit(trimmed);
        }
    }, [query, onSubmit]);

    const handleClear = useCallback(() => {
        setQuery('');
    }, []);

    return (
        <View style={styles.container}>
            <View style={styles.searchInputContainer}>
                <SafeIcon name="search" size={20} color={modernColors.textSecondary} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF"
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={handleSubmit}
                    returnKeyType="search"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                />
                {loading && (
                    <ActivityIndicator size="small" color={modernColors.primary} style={styles.loader} />
                )}
                {query.length > 0 && !loading && (
                    <TouchableOpacity
                        style={styles.clearButton}
                        onPress={handleClear}
                    >
                        <SafeIcon name="x-circle" size={18} color={modernColors.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Boutons d'action */}
            <View style={styles.actionsContainer}>
                {onImagePress && (
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={onImagePress}
                    >
                        <SafeIcon name="image" size={18} color={modernColors.primary} />
                    </TouchableOpacity>
                )}
                {onAudioPress && (
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={onAudioPress}
                    >
                        <SafeIcon name="mic" size={18} color={modernColors.primary} />
                    </TouchableOpacity>
                )}
                {onGPSPress && (
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={onGPSPress}
                    >
                        <SafeIcon name="map-pin" size={18} color={modernColors.primary} />
                    </TouchableOpacity>
                )}
                {showSendButton && (
                    <TouchableOpacity
                        style={[styles.sendButton, (!query.trim() || loading) && styles.sendButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={!query.trim() || loading}
                    >
                        <SafeIcon name="send" size={18} color={query.trim() && !loading ? "#FFFFFF" : modernColors.textTertiary} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        gap: 8,
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: modernColors.text,
        paddingVertical: 4,
    },
    loader: {
        marginLeft: 8,
    },
    clearButton: {
        marginLeft: 8,
        padding: 4,
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
    },
    actionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: modernColors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    sendButtonDisabled: {
        backgroundColor: '#D1D5DB',
        shadowOpacity: 0,
    },
});

export default SimpleSearchBar;







