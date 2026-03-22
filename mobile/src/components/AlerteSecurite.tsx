// Composant d'alerte de sécurité pour rappeler les vérifications avant paiement
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface AlerteSecuriteProps {
    variant?: 'warning' | 'info';
    showDetails?: boolean;
    onDismiss?: () => void;
}

const AlerteSecurite: React.FC<AlerteSecuriteProps> = ({
    variant = 'warning',
    showDetails = true,
    onDismiss
}) => {
    const { t } = useLanguageSafe();
    const isWarning = variant === 'warning';

    return (
        <View style={[
            styles.container,
            isWarning ? styles.containerWarning : styles.containerInfo
        ]}>
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <SafeIcon
                        name={isWarning ? "alert-triangle" : "shield"}
                        size={20}
                        color={isWarning ? "#F59E0B" : "#3B82F6"}
                    />
                </View>
                <Text style={[
                    styles.title,
                    isWarning ? styles.titleWarning : styles.titleInfo
                ]}>
                    ⚠️ Sécurité - Avant tout paiement
                </Text>
                {onDismiss && (
                    <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
                        <SafeIcon name="x" size={18} color="#6B7280" />
                    </TouchableOpacity>
                )}
            </View>

            <Text style={styles.message}>
                Pour votre sécurité, vérifiez toujours le prestataire avant d'effectuer un paiement.
            </Text>

            {showDetails && (
                <View style={styles.checklistContainer}>
                    <Text style={styles.checklistTitle}>{t('alerteSecurite.pointsDeVerification')}</Text>
                    <View style={styles.checklist}>
                        <View style={styles.checkItem}>
                            <SafeIcon name="check-circle" size={14} color={isWarning ? "#F59E0B" : "#3B82F6"} />
                            <Text style={styles.checkText}>{t('alerteSecurite.verifierLesAvisEtNotes')}</Text>
                        </View>
                        <View style={styles.checkItem}>
                            <SafeIcon name="check-circle" size={14} color={isWarning ? "#F59E0B" : "#3B82F6"} />
                            <Text style={styles.checkText}>{t('alerteSecurite.confirmerLidentiteEtLesCoordonnees')}</Text>
                        </View>
                        <View style={styles.checkItem}>
                            <SafeIcon name="check-circle" size={14} color={isWarning ? "#F59E0B" : "#3B82F6"} />
                            <Text style={styles.checkText}>{t('alerteSecurite.discuterDesDetailsAvantDe')}</Text>
                        </View>
                        <View style={styles.checkItem}>
                            <SafeIcon name="check-circle" size={14} color={isWarning ? "#F59E0B" : "#3B82F6"} />
                            <Text style={styles.checkText}>{t('alerteSecurite.neJamaisPayerLintegraliteA')}</Text>
                        </View>
                        <View style={styles.checkItem}>
                            <SafeIcon name="check-circle" size={14} color={isWarning ? "#F59E0B" : "#3B82F6"} />
                            <Text style={styles.checkText}>{t('alerteSecurite.utiliserLesModesDePaiement')}</Text>
                        </View>
                    </View>
                </View>
            )}

            <View style={styles.footer}>
                <SafeIcon name="info" size={14} color="#6B7280" />
                <Text style={styles.footerText}>
                    Yukpo n'est pas responsable des transactions entre utilisateurs
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        padding: 16,
        marginVertical: 12,
        borderWidth: 2,
    },
    containerWarning: {
        backgroundColor: '#FFFBEB',
        borderColor: '#FCD34D',
    },
    containerInfo: {
        backgroundColor: '#EFF6FF',
        borderColor: '#93C5FD',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        flex: 1,
        fontSize: 15,
        fontWeight: '700',
    },
    titleWarning: {
        color: '#92400E',
    },
    titleInfo: {
        color: '#1E40AF',
    },
    dismissButton: {
        padding: 4,
    },
    message: {
        fontSize: 14,
        color: '#374151',
        marginBottom: 12,
        lineHeight: 20,
    },
    checklistContainer: {
        marginTop: 8,
    },
    checklistTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    checklist: {
        gap: 8,
    },
    checkItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    checkText: {
        flex: 1,
        fontSize: 13,
        color: '#4B5563',
        lineHeight: 18,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.1)',
    },
    footerText: {
        flex: 1,
        fontSize: 11,
        color: '#6B7280',
        fontStyle: 'italic',
    },
});

export default AlerteSecurite;

