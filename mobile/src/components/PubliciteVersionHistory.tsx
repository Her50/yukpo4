import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { API_BASE_URL } from '../config/api';
import { modernColors } from '../styles/theme';
import { NativeButton, NativeCard } from './SafeNativeDesign';
import { SafeIcon } from './SafeIcon';

interface PubliciteVersion {
    id: number;
    version_number: number;
    change_type: string;
    change_description: string | null;
    created_at: string;
    changed_by: number | null;
}

interface PubliciteVersionHistoryProps {
    campaignId: number;
    onVersionSelect?: (versionNumber: number) => void;
}

const PubliciteVersionHistory: React.FC<PubliciteVersionHistoryProps> = ({
    campaignId,
    onVersionSelect,
}) => {
    const [versions, setVersions] = useState<PubliciteVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [restoring, setRestoring] = useState(false);

    useEffect(() => {
        fetchVersions();
    }, [campaignId]);

    const fetchVersions = async () => {
        try {
            setLoading(true);
            const response = await axios.get<{ versions: PubliciteVersion[] }>(
                `${API_BASE_URL}/api/publicites/${campaignId}/versions`
            );
            setVersions(response.data.versions);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Erreur lors du chargement de l\'historique');
            console.error('Erreur versions:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (versionNumber: number) => {
        if (!confirm(`Voulez-vous vraiment restaurer la version ${versionNumber} ?`)) {
            return;
        }

        try {
            setRestoring(true);
            await axios.post(
                `${API_BASE_URL}/api/publicites/${campaignId}/versions/${versionNumber}/restore`
            );
            alert('Version restaurée avec succès !');
            fetchVersions();
            if (onVersionSelect) {
                onVersionSelect(versionNumber);
            }
        } catch (err: any) {
            alert(err.response?.data?.error || 'Erreur lors de la restauration');
            console.error('Erreur restauration:', err);
        } finally {
            setRestoring(false);
        }
    };

    const getChangeTypeLabel = (type: string) => {
        switch (type) {
            case 'created':
                return 'Création';
            case 'updated':
                return 'Modification';
            case 'paused':
                return 'Mise en pause';
            case 'resumed':
                return 'Reprise';
            case 'deleted':
                return 'Suppression';
            default:
                return type;
        }
    };

    const getChangeTypeColor = (type: string) => {
        switch (type) {
            case 'created':
                return '#10B981';
            case 'updated':
                return '#3B82F6';
            case 'paused':
                return '#F59E0B';
            case 'resumed':
                return '#10B981';
            case 'deleted':
                return '#EF4444';
            default:
                return '#6B7280';
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement de l'historique...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <NativeCard style={styles.errorCard}>
                <Text style={styles.errorText}>❌ {error}</Text>
            </NativeCard>
        );
    }

    if (versions.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <SafeIcon name="history" size={64} color={modernColors.textSecondary} />
                <Text style={styles.emptyTitle}>Aucun historique disponible</Text>
                <Text style={styles.emptyText}>
                    Les modifications seront enregistrées automatiquement.
                </Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <SafeIcon name="history" size={24} color={modernColors.primary} />
                <Text style={styles.headerTitle}>Historique des Modifications</Text>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{versions.length}</Text>
                </View>
            </View>

            <View style={styles.versionsList}>
                {versions.map((version) => (
                    <NativeCard key={version.id} style={styles.versionCard}>
                        <View style={styles.versionHeader}>
                            <View style={styles.versionInfo}>
                                <View style={styles.versionBadgeRow}>
                                    <View
                                        style={[
                                            styles.typeBadge,
                                            { backgroundColor: getChangeTypeColor(version.change_type) },
                                        ]}
                                    >
                                        <Text style={styles.typeBadgeText}>
                                            {getChangeTypeLabel(version.change_type)}
                                        </Text>
                                    </View>
                                    <Text style={styles.versionNumber}>
                                        Version {version.version_number}
                                    </Text>
                                </View>
                                {version.change_description && (
                                    <Text style={styles.description}>
                                        {version.change_description}
                                    </Text>
                                )}
                                <View style={styles.dateRow}>
                                    <SafeIcon name="clock" size={14} color={modernColors.textSecondary} />
                                    <Text style={styles.dateText}>
                                        {new Date(version.created_at).toLocaleString('fr-FR', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </Text>
                                </View>
                            </View>
                            <NativeButton
                                title="Restaurer"
                                variant="outline"
                                size="small"
                                onPress={() => handleRestore(version.version_number)}
                                disabled={restoring || version.version_number === versions[0]?.version_number}
                            />
                        </View>
                    </NativeCard>
                ))}
            </View>

            {versions.length > 1 && (
                <View style={styles.tipCard}>
                    <SafeIcon name="info" size={20} color="#3B82F6" />
                    <Text style={styles.tipText}>
                        💡 Vous pouvez restaurer n'importe quelle version précédente. La version actuelle est la
                        version {versions[0]?.version_number}.
                    </Text>
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: modernColors.textSecondary,
    },
    errorCard: {
        padding: 16,
        backgroundColor: '#FEE2E2',
        borderColor: '#FCA5A5',
    },
    errorText: {
        color: '#DC2626',
        textAlign: 'center',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.textPrimary,
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.textPrimary,
        flex: 1,
    },
    badge: {
        backgroundColor: modernColors.primary,
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    versionsList: {
        gap: 12,
    },
    versionCard: {
        padding: 16,
        marginBottom: 12,
    },
    versionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    versionInfo: {
        flex: 1,
        marginRight: 12,
    },
    versionBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    typeBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    versionNumber: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textPrimary,
    },
    description: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    dateText: {
        fontSize: 11,
        color: modernColors.textSecondary,
    },
    tipCard: {
        flexDirection: 'row',
        padding: 12,
        backgroundColor: '#DBEAFE',
        borderRadius: 8,
        marginTop: 16,
        gap: 8,
    },
    tipText: {
        flex: 1,
        fontSize: 12,
        color: '#1E40AF',
        lineHeight: 18,
    },
});

export default PubliciteVersionHistory;

