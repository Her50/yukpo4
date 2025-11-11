/**
 * Composant Sheet pour React Native (Modal basique)
 */

import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SheetProps {
    children: React.ReactNode;
    visible: boolean;
    onClose: () => void;
    title?: string;
}

export const Sheet: React.FC<SheetProps> = ({ children, visible, onClose, title }) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    {title && (
                        <View style={styles.header}>
                            <Text style={styles.title}>{title}</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Text style={styles.closeText}>✕</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    <View style={styles.content}>
                        {children}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export const SheetContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <View style={styles.content}>{children}</View>;
};

export const SheetTrigger: React.FC<{
    children: React.ReactNode;
    onPress: () => void;
}> = ({ children, onPress }) => {
    return (
        <TouchableOpacity onPress={onPress}>
            {children}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    closeButton: {
        padding: 8,
    },
    closeText: {
        fontSize: 18,
        color: '#6B7280',
    },
    content: {
        padding: 16,
    },
});

export default Sheet;
