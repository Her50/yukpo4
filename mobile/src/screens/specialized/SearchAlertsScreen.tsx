// ✅ NOUVEAU Phase 3.1: Écran de gestion des alertes de recherche
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeNativeView } from '../../components/SafeNativeView';
import SafeIcon from '../../components/SafeIcon';
import { useToaster } from '../../components/ToasterProvider';
import { immobilierService } from '../../services/immobilierService';
import { modernColors } from '../../theme/modernTheme';
import { useNavigation } from '@react-navigation/native';

interface SearchAlert {
    id: number;
    name?: string;
    filters: any;
    is_active: boolean;
    new_properties_count: number;
}

const SearchAlertsScreen: React.FC = () => {
    const navigation = useNavigation();
    const toaster = useToaster();
    const [alerts, setAlerts] = useState<SearchAlert[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAlerts();
    }, []);

    const loadAlerts = async () => {
        try {
            setLoading(true);
            const response = await immobilierService.getMySearchAlerts();
            if (response.success && response.alerts) {
                setAlerts(response.alerts);
            }
        } catch (error) {
            console.error('[SearchAlertsScreen] Erreur:', error);
            toaster.error('Impossible de charger les alertes');
        } finally {
            setLoading(false);
        }
    };

    const toggleAlert = async (alertId: number, isActive: boolean) => {
        try {
            // TODO: Implémenter endpoint pour activer/désactiver alerte
            toaster.info('Fonctionnalité à implémenter');
        } catch (error) {
            console.error('[SearchAlertsScreen] Erreur toggle:', error);
        }
    };

    const deleteAlert = async (alertId: number) => {
        Alert.alert(
            'Supprimer l\'alerte',
            'Êtes-vous sûr de vouloir supprimer cette alerte ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // TODO: Implémenter endpoint pour supprimer alerte
                            setAlerts(prev => prev.filter(a => a.id !== alertId));
                        } catch (error) {
                            console.error('[SearchAlertsScreen] Erreur suppression:', error);
                            toaster.error("Impossible de supprimer l'alerte");
                        }
                    },
                },
            ]
        );
    };

    return (
        <SafeNativeView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Mes alertes de recherche</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Liste des alertes */}
            <FlatList
                data={alerts}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.alertCard}>
                        <View style={styles.alertHeader}>
                            <Text style={styles.alertName}>
                                {item.name || 'Alerte sans nom'}
                            </Text>
                            {item.new_properties_count > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>
                                        {item.new_properties_count} nouveau{item.new_properties_count > 1 ? 'x' : ''}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.alertFilters} numberOfLines={2}>
                            {JSON.stringify(item.filters)}
                        </Text>
                        <View style={styles.alertActions}>
                            <View style={styles.switchContainer}>
                                <Text style={styles.switchLabel}>Active</Text>
                                <Switch
                                    value={item.is_active}
                                    onValueChange={(value) => toggleAlert(item.id, value)}
                                />
                            </View>
                            <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={() => deleteAlert(item.id)}
                            >
                                <SafeIcon name="trash-2" size={18} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <SafeIcon name="bell-off" size={64} color="#9CA3AF" />
                        <Text style={styles.emptyText}>Aucune alerte</Text>
                        <Text style={styles.emptySubtext}>
                            Créez une alerte pour être notifié des nouveaux biens correspondant à vos critères
                        </Text>
                    </View>
                }
            />
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    placeholder: {
        width: 32,
    },
    alertCard: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginTop: 12,
        padding: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    alertHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    alertName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        flex: 1,
    },
    badge: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    alertFilters: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 12,
    },
    alertActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    switchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    switchLabel: {
        fontSize: 14,
        color: '#374151',
    },
    deleteButton: {
        padding: 8,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 8,
    },
});

export default SearchAlertsScreen;

