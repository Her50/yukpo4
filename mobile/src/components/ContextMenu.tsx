/**
 * ContextMenu - Menu contextuel pour long-press (style Instagram/TikTok)
 */

import { BlurView } from 'expo-blur';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SafeIcon from './SafeIcon';

export interface ContextMenuAction {
    label: string;
    icon: string;
    onPress: () => void;
    destructive?: boolean;
}

interface ContextMenuProps {
    visible: boolean;
    onClose: () => void;
    actions: ContextMenuAction[];
    title?: string;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
    visible,
    onClose,
    actions,
    title,
}) => {
    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <BlurView intensity={80} style={styles.blurContainer}>
                    <View style={styles.menuContainer}>
                        {title && (
                            <View style={styles.titleContainer}>
                                <Text style={styles.title}>{title}</Text>
                            </View>
                        )}
                        {actions.map((action, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.actionItem,
                                    action.destructive && styles.actionItemDestructive,
                                ]}
                                onPress={() => {
                                    action.onPress();
                                    onClose();
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={action.label}
                            >
                                <SafeIcon
                                    name={action.icon}
                                    size={20}
                                    color={action.destructive ? '#EF4444' : '#1F2937'}
                                />
                                <Text
                                    style={[
                                        styles.actionText,
                                        action.destructive && styles.actionTextDestructive,
                                    ]}
                                >
                                    {action.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </BlurView>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    blurContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    menuContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingVertical: 8,
        minWidth: 280,
        maxWidth: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    titleContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
        textAlign: 'center',
    },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
    },
    actionItemDestructive: {
        borderTopWidth: 1,
        borderTopColor: '#FEE2E2',
        marginTop: 8,
    },
    actionText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1F2937',
        flex: 1,
    },
    actionTextDestructive: {
        color: '#EF4444',
    },
});

export default ContextMenu;

