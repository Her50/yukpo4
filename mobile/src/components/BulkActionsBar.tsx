/**
 * BulkActionsBar - Barre d'actions groupées (inspiré Amazon/Gmail)
 * Permet sélection multiple et actions en masse
 */

import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface BulkAction {
    id: string;
    label: string;
    icon: string;
    onPress: (selectedIds: string[]) => void;
    color?: string;
    destructive?: boolean;
}

interface BulkActionsBarProps {
    visible: boolean;
    selectedCount: number;
    totalCount: number;
    actions: BulkAction[];
    onSelectAll?: () => void;
    onDeselectAll?: () => void;
    onClose?: () => void;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
    visible,
    selectedCount,
    totalCount,
    actions,
    onSelectAll,
    onDeselectAll,
    onClose,
}) => {
    const slideAnim = React.useRef(new Animated.Value(100)).current;

    React.useEffect(() => {
    const { t } = useLanguageSafe();
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: 100,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    if (!visible && selectedCount === 0) return null;

    const allSelected = selectedCount === totalCount && totalCount > 0;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ translateY: slideAnim }],
                },
            ]}
        >
            <View style={styles.content}>
                {/* Selection Info */}
                <View style={styles.selectionInfo}>
                    <TouchableOpacity
                        onPress={allSelected ? onDeselectAll : onSelectAll}
                        style={styles.selectAllButton}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.checkbox, allSelected && styles.checkboxChecked]}>
                            {allSelected && <SafeIcon name="check" size={14} color="#fff" />}
                        </View>
                        <Text style={styles.selectionText}>
                            {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                    {actions.map((action) => (
                        <TouchableOpacity
                            key={action.id}
                            style={[
                                styles.actionButton,
                                action.destructive && styles.actionButtonDestructive,
                                { backgroundColor: action.color ? action.color + '20' : modernColors.primary + '20' },
                            ]}
                            onPress={() => {
                                // Passer les IDs sélectionnés depuis le parent
                                // Note: Les IDs seront récupérés depuis selectedItems dans le parent
                                action.onPress([]);
                            }}
                            activeOpacity={0.7}
                        >
                            <SafeIcon
                                name={action.icon}
                                size={18}
                                color={action.destructive ? modernColors.error : (action.color || modernColors.primary)}
                            />
                            <Text
                                style={[
                                    styles.actionLabel,
                                    {
                                        color: action.destructive ? modernColors.error : (action.color || modernColors.primary),
                                    },
                                ]}
                            >
                                {action.label}
                            </Text>
                        </TouchableOpacity>
                    ))}

                    {/* Close button */}
                    {onClose && (
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={onClose}
                            activeOpacity={0.7}
                        >
                            <SafeIcon name="x" size={20} color={modernColors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 1000,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingBottom: 12 + 20, // Safe area bottom
    },
    selectionInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    selectAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: modernColors.borderDark,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    selectionText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 6,
    },
    actionButtonDestructive: {
        backgroundColor: modernColors.error + '20',
    },
    actionLabel: {
        fontSize: 13,
        fontWeight: '600',
    },
    closeButton: {
        padding: 8,
        marginLeft: 4,
    },
});

