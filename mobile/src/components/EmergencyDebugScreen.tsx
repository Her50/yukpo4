import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeIcon } from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface Props {
    onClose: () => void;
    logs?: string;
}

export default function EmergencyDebugScreen({ onClose, logs }: Props) {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <SafeIcon name="bug" size={24} color="#DC2626" type="emoji" />
                <Text style={styles.title}>Debug d'urgence</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <SafeIcon name="x" size={20} color="#666" type="emoji" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                <Text style={styles.label}>Logs de debug:</Text>
                <View style={styles.logsContainer}>
                    <Text style={styles.logsText}>
                        {logs || t('emergencyDebug.aucunLogDisponible')}
                    </Text>
                </View>

                <View style={styles.instructions}>
                    <Text style={styles.instructionsTitle}>Instructions:</Text>
                    <Text style={styles.instructionsText}>
                        1. Copiez le contenu ci-dessus{'\n'}
                        2. Envoyez-le au développeur{'\n'}
                        3. Redémarrez l'application
                    </Text>
                </View>
            </ScrollView>

            <TouchableOpacity onPress={onClose} style={styles.closeMainButton}>
                <Text style={styles.closeMainButtonText}>{t('emergencyDebugScreen.fermer')}</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    title: {
        flex: 1,
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1A1A1A',
        marginLeft: 12,
    },
    closeButton: {
        padding: 8,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    logsContainer: {
        backgroundColor: '#1F2937',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    logsText: {
        color: '#F9FAFB',
        fontSize: 12,
        fontFamily: 'monospace',
        lineHeight: 16,
    },
    instructions: {
        backgroundColor: '#FEF3C7',
        padding: 12,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#F59E0B',
    },
    instructionsTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#92400E',
        marginBottom: 4,
    },
    instructionsText: {
        fontSize: 14,
        color: '#92400E',
        lineHeight: 20,
    },
    closeMainButton: {
        backgroundColor: '#DC2626',
        margin: 16,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    closeMainButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
});