// ✅ NOUVEAU: Composant indicateur de progression pour actions longues

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface ProgressIndicatorProps {
    visible: boolean;
    message?: string;
    progress?: number; // 0-100
    showPercentage?: boolean;
    size?: 'small' | 'large';
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
    visible,
    message = 'Chargement...',
    progress,
    showPercentage = false,
    size = 'large',
}) => {
    if (!visible) return null;

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <ActivityIndicator size={size} color={modernColors.primary} />
                {message && (
                    <Text style={styles.message} accessibilityRole="text">
                        {message}
                    </Text>
                )}
                {progress !== undefined && (
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { width: `${Math.min(100, Math.max(0, progress))}%` },
                                ]}
                            />
                        </View>
                        {showPercentage && (
                            <Text style={styles.progressText} accessibilityRole="text">
                                {Math.round(progress)}%
                            </Text>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    content: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
        minWidth: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    message: {
        marginTop: 12,
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        textAlign: 'center',
    },
    progressContainer: {
        width: '100%',
        marginTop: 16,
    },
    progressBar: {
        width: '100%',
        height: 4,
        backgroundColor: '#E5E7EB',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: modernColors.primary,
        borderRadius: 2,
    },
    progressText: {
        marginTop: 8,
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
});

export default ProgressIndicator;









