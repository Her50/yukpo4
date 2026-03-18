import React, { useState } from 'react';
import {
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface SearchBarProps {
    placeholder?: string;
    onSubmit: (query: string) => void;
    onGPSPress?: () => void;
    showSendButton?: boolean;
    initialValue?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
    placeholder = "Rechercher...",
    onSubmit,
    onGPSPress,
    showSendButton = true,
    initialValue = ""
}) => {
    const [query, setQuery] = useState(initialValue);

    const handleSubmit = () => {
        if (query.trim()) {
            onSubmit(query.trim());
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.searchInputContainer}>
                <SafeIcon name="search" size={20} color="#6B7280" style={styles.searchIcon} />
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
                />
                {onGPSPress && (
                    <TouchableOpacity
                        style={styles.gpsButton}
                        onPress={onGPSPress}
                    >
                        <SafeIcon name="map-pin" size={18} color={modernColors.primary} />
                    </TouchableOpacity>
                )}
            </View>
            
            {showSendButton && (
                <TouchableOpacity
                    style={[styles.sendButton, !query.trim() && styles.sendButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={!query.trim()}
                >
                    <SafeIcon name="send" size={18} color="#FFFFFF" />
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        gap: 12,
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#1F2937',
        paddingVertical: 4,
    },
    gpsButton: {
        padding: 6,
        marginLeft: 8,
    },
    sendButton: {
        backgroundColor: modernColors.primary,
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 48,
    },
    sendButtonDisabled: {
        backgroundColor: '#D1D5DB',
    },
});

export default SearchBar;
