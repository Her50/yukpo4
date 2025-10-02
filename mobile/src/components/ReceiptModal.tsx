import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button, Card, Title } from 'react-native-paper';
import { theme } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';

interface ReceiptData {
    id: string;
    amount: number;
    tokens: number;
    bonus: number;
    paymentMethod: string;
    transactionId: string;
    date: string;
    status: 'completed' | 'pending' | 'failed';
}

interface ReceiptModalProps {
    visible: boolean;
    onClose: () => void;
    receiptData: ReceiptData | null;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({
    visible,
    onClose,
    receiptData
}) => {
    const { user } = useAuth();

    if (!receiptData) return null;

    const formatAmount = (amount: number): string => {
        return `${amount.toLocaleString('fr-FR')} FCFA`;
    };

    const handleShare = () => {
        Alert.alert(
            'Partager le reçu',
            'Fonctionnalité de partage à implémenter',
            [{ text: 'OK' }]
        );
    };

    const handleSave = () => {
        Alert.alert(
            'Sauvegarder le reçu',
            'Fonctionnalité de sauvegarde à implémenter',
            [{ text: 'OK' }]
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Title style={styles.title}>Reçu de recharge</Title>
                </View>

                <ScrollView style={styles.content}>
                    <Card style={styles.receiptCard}>
                        <Card.Content>
                            {/* En-tête du reçu */}
                            <View style={styles.receiptHeader}>
                                <Text style={styles.logo}>Yukpomnang</Text>
                                <Text style={styles.receiptTitle}>Reçu de recharge</Text>
                            </View>

                            {/* Informations client */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Client</Text>
                                <Text style={styles.sectionValue}>{user?.name || 'Utilisateur'}</Text>
                                <Text style={styles.sectionSubValue}>{user?.email || 'N/A'}</Text>
                            </View>

                            {/* Informations transaction */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Transaction</Text>
                                <Text style={styles.sectionValue}>
                                    {new Date(receiptData.date).toLocaleString('fr-FR')}
                                </Text>
                                <Text style={styles.sectionSubValue}>
                                    ID: {receiptData.transactionId}
                                </Text>
                            </View>

                            {/* Méthode de paiement */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Méthode de paiement</Text>
                                <Text style={styles.sectionValue}>{receiptData.paymentMethod}</Text>
                            </View>

                            {/* Détails du paiement */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Détails du paiement</Text>
                                <View style={styles.paymentDetails}>
                                    <View style={styles.paymentRow}>
                                        <Text style={styles.paymentLabel}>Montant payé:</Text>
                                        <Text style={styles.paymentValue}>
                                            {formatAmount(receiptData.amount)}
                                        </Text>
                                    </View>
                                    <View style={styles.paymentRow}>
                                        <Text style={styles.paymentLabel}>Tokens reçus:</Text>
                                        <Text style={styles.paymentValue}>
                                            {receiptData.tokens.toLocaleString()} tokens
                                        </Text>
                                    </View>
                                    {receiptData.bonus > 0 && (
                                        <View style={styles.paymentRow}>
                                            <Text style={styles.paymentLabel}>Bonus:</Text>
                                            <Text style={[styles.paymentValue, styles.bonusValue]}>
                                                +{receiptData.bonus.toLocaleString()} tokens
                                            </Text>
                                        </View>
                                    )}
                                    <View style={[styles.paymentRow, styles.totalRow]}>
                                        <Text style={styles.totalLabel}>Total tokens:</Text>
                                        <Text style={styles.totalValue}>
                                            {(receiptData.tokens + receiptData.bonus).toLocaleString()} tokens
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Statut */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Statut</Text>
                                <View style={[
                                    styles.statusBadge,
                                    receiptData.status === 'completed' && styles.statusCompleted
                                ]}>
                                    <Ionicons 
                                        name={receiptData.status === 'completed' ? 'checkmark-circle' : 'time'} 
                                        size={16} 
                                        color={receiptData.status === 'completed' ? '#065f46' : '#6b7280'} 
                                    />
                                    <Text style={[
                                        styles.statusText,
                                        receiptData.status === 'completed' && styles.statusTextCompleted
                                    ]}>
                                        {receiptData.status === 'completed' ? 'Complété' : 
                                         receiptData.status === 'pending' ? 'En attente' : 'Échoué'}
                                    </Text>
                                </View>
                            </View>

                            {/* Footer */}
                            <View style={styles.footer}>
                                <Text style={styles.footerText}>Merci d'utiliser Yukpomnang !</Text>
                                <Text style={styles.footerSubText}>www.yukpomnang.com</Text>
                            </View>
                        </Card.Content>
                    </Card>
                </ScrollView>

                <View style={styles.actions}>
                    <Button
                        mode="outlined"
                        onPress={handleShare}
                        style={styles.actionButton}
                        icon="share"
                    >
                        Partager
                    </Button>
                    <Button
                        mode="contained"
                        onPress={handleSave}
                        style={styles.actionButton}
                        icon="download"
                    >
                        Sauvegarder
                    </Button>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    closeButton: {
        padding: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginLeft: 8,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    receiptCard: {
        elevation: 2,
    },
    receiptHeader: {
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: theme.colors.primary,
        paddingBottom: 16,
        marginBottom: 20,
    },
    logo: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.colors.primary,
        marginBottom: 4,
    },
    receiptTitle: {
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 8,
    },
    sectionValue: {
        fontSize: 14,
        color: theme.colors.text,
        marginBottom: 2,
    },
    sectionSubValue: {
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    paymentDetails: {
        gap: 8,
    },
    paymentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    paymentLabel: {
        fontSize: 14,
        color: theme.colors.text,
    },
    paymentValue: {
        fontSize: 14,
        color: theme.colors.text,
        fontWeight: '500',
    },
    bonusValue: {
        color: '#059669',
    },
    totalRow: {
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        paddingTop: 8,
        marginTop: 8,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    totalValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#f3f4f6',
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    statusCompleted: {
        backgroundColor: '#d1fae5',
    },
    statusText: {
        fontSize: 12,
        color: '#6b7280',
        marginLeft: 4,
        fontWeight: '500',
    },
    statusTextCompleted: {
        color: '#065f46',
    },
    footer: {
        alignItems: 'center',
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    footerText: {
        fontSize: 14,
        color: theme.colors.text,
        marginBottom: 4,
    },
    footerSubText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    actions: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        gap: 12,
    },
    actionButton: {
        flex: 1,
    },
});

export default ReceiptModal;














