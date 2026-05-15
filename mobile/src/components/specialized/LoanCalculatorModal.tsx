// ✅ NOUVEAU Phase 4.4: Calculatrice de prêt intégrée
import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../SafeIcon';
import { modernColors } from '../../theme/modernTheme';
import { NativeInput, NativeButton } from '../SafeNativeDesign';

interface LoanCalculatorModalProps {
    visible: boolean;
    propertyPrice: number;
    onClose: () => void;
    currency?: string;
}

const LoanCalculatorModal: React.FC<LoanCalculatorModalProps> = ({
    visible,
    propertyPrice,
    onClose,
    currency = 'FCFA',
}) => {
    const [downPayment, setDownPayment] = useState('');
    const [interestRate, setInterestRate] = useState('8.5');
    const [loanDuration, setLoanDuration] = useState('20');
    const [monthlyPayment, setMonthlyPayment] = useState<number | null>(null);
    const [totalInterest, setTotalInterest] = useState<number | null>(null);
    const [totalCost, setTotalCost] = useState<number | null>(null);

    const calculateLoan = () => {
        const price = propertyPrice;
        const down = parseFloat(downPayment) || 0;
        const rate = parseFloat(interestRate) / 100 / 12; // Taux mensuel
        const duration = parseFloat(loanDuration) * 12; // Durée en mois
        const loanAmount = price - down;

        if (loanAmount <= 0 || rate <= 0 || duration <= 0) {
            setMonthlyPayment(null);
            setTotalInterest(null);
            setTotalCost(null);
            return;
        }

        // Calcul mensualité : M = P * [r(1+r)^n] / [(1+r)^n - 1]
        const monthly = (loanAmount * rate * Math.pow(1 + rate, duration)) /
            (Math.pow(1 + rate, duration) - 1);

        const total = monthly * duration;
        const interest = total - loanAmount;
        const totalCostValue = total + down;

        setMonthlyPayment(monthly);
        setTotalInterest(interest);
        setTotalCost(totalCostValue);
    };

    const formatPrice = (price: number) => {
        if (price >= 1000000) return `${(price / 1000000).toFixed(2)}M`;
        return `${(price / 1000).toFixed(0)}K`;
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Calculatrice de prêt</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color="#111827" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        {/* Prix du bien */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Prix du bien</Text>
                            <View style={styles.priceDisplay}>
                                <Text style={styles.priceValue}>
                                    {formatPrice(propertyPrice)} {currency}
                                </Text>
                            </View>
                        </View>

                        {/* Apport initial */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Apport initial ({currency})</Text>
                            <NativeInput
                                value={downPayment}
                                onChangeText={setDownPayment}
                                placeholder="0"
                                keyboardType="numeric"
                                style={styles.input}
                            />
                            <Text style={styles.hint}>
                                Montant que vous pouvez apporter immédiatement
                            </Text>
                        </View>

                        {/* Taux d'intérêt */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Taux d'intérêt annuel (%)</Text>
                            <NativeInput
                                value={interestRate}
                                onChangeText={setInterestRate}
                                placeholder="8.5"
                                keyboardType="numeric"
                                style={styles.input}
                            />
                            <Text style={styles.hint}>
                                Taux d'intérêt annuel (généralement entre 6% et 12%)
                            </Text>
                        </View>

                        {/* Durée du prêt */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Durée du prêt (années)</Text>
                            <NativeInput
                                value={loanDuration}
                                onChangeText={setLoanDuration}
                                placeholder="20"
                                keyboardType="numeric"
                                style={styles.input}
                            />
                            <Text style={styles.hint}>
                                Durée du prêt en années (généralement 15-30 ans)
                            </Text>
                        </View>

                        {/* Bouton calculer */}
                        <NativeButton
                            title="Calculer"
                            onPress={calculateLoan}
                            variant="primary"
                            size="large"
                            style={styles.calculateButton}
                        />

                        {/* Résultats */}
                        {monthlyPayment !== null && (
                            <View style={styles.resultsContainer}>
                                <Text style={styles.resultsTitle}>Résultats de la simulation</Text>
                                
                                <View style={styles.resultCard}>
                                    <Text style={styles.resultLabel}>Mensualité</Text>
                                    <Text style={styles.resultValue}>
                                        {formatPrice(monthlyPayment)} {currency}
                                    </Text>
                                </View>

                                <View style={styles.resultCard}>
                                    <Text style={styles.resultLabel}>Intérêts totaux</Text>
                                    <Text style={styles.resultValue}>
                                        {formatPrice(totalInterest || 0)} {currency}
                                    </Text>
                                </View>

                                <View style={styles.resultCard}>
                                    <Text style={styles.resultLabel}>Coût total</Text>
                                    <Text style={styles.resultValue}>
                                        {formatPrice(totalCost || 0)} {currency}
                                    </Text>
                                </View>

                                <View style={styles.affordabilityCard}>
                                    <SafeIcon name="info" size={20} color={modernColors.primary} />
                                    <Text style={styles.affordabilityText}>
                                        Votre mensualité ne devrait pas dépasser 30% de vos revenus mensuels
                                    </Text>
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    closeButton: {
        padding: 4,
    },
    scrollContent: {
        padding: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    priceDisplay: {
        backgroundColor: '#EFF6FF',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    priceValue: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.primary,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#111827',
    },
    hint: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 6,
    },
    calculateButton: {
        marginTop: 8,
        marginBottom: 24,
    },
    resultsContainer: {
        marginTop: 8,
    },
    resultsTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    resultCard: {
        backgroundColor: '#F9FAFB',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    resultLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    resultValue: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
    },
    affordabilityCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        padding: 12,
        borderRadius: 8,
        gap: 8,
        marginTop: 8,
    },
    affordabilityText: {
        flex: 1,
        fontSize: 12,
        color: '#1E40AF',
    },
});

export default LoanCalculatorModal;

