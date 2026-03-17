// ✅ Écran pour gérer mes offres d'emploi créées
// Permet de voir les offres créées et accéder rapidement aux candidatures

import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeCard } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { offreEmploiService } from '../../services/offreEmploiService';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface OffreEmploi {
    id: number;
    titre_poste: string;
    secteur: string;
    lieu_travail: string;
    nombre_candidatures: number;
    nombre_vues: number;
    statut: 'active' | 'closed';
    created_at: string;
}

const MesOffresScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const { user } = useAuth();
    const [offres, setOffres] = useState<OffreEmploi[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadOffres();
    }, []);

    const loadOffres = async () => {
        try {
            setLoading(true);
            const response = await offreEmploiService.getMesOffres();
            const backendData = (response?.data as any);
            const offresData = backendData?.data || backendData;
            if (response.success && Array.isArray(offresData)) {
                setOffres(offresData);
            }
        } catch (error: any) {
            console.error('[MesOffresScreen] Erreur:', error);
            Alert.alert('Erreur', 'Impossible de charger vos offres');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    if (loading && offres.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>{t('mesOffres.chargement')}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>{t('mesOffres.mesOffres')}</Text>
                <TouchableOpacity
                    onPress={() => {
                        hapticPress();
                        (navigation as any).navigate('CreateOffre');
                    }}
                    style={styles.addButton}
                >
                    <SafeIcon name="plus" size={24} color={modernColors.primary} type="lucide" />
                </TouchableOpacity>
            </View>

            {offres.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <SafeIcon name="briefcase" size={64} color="#9CA3AF" />
                    <Text style={styles.emptyText}>{t('mesOffres.aucuneOffreCreeet('mesOffresScreen.textTextStylestylesemptysubtextCreezVotrePremiere')emploi pour commencer à recevoir des candidatures
                    </Text>
                    <TouchableOpacity
                        style={styles.createButton}
                        onPress={() => {
                            hapticPress();
                            (navigation as any).navigate('CreateOffre');
                        }}
                    >
                        <Text style={styles.createButtonText}>{t('mesOffres.creerUneOffre')}</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={offres}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <OffreCard
                            offre={item}
                            onPress={() => {
                                hapticPress();
                                (navigation as any).navigate('OffreCandidatures', { offreId: item.id });
                            }}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                loadOffres();
                            }}
                            colors={[modernColors.primary]}
                        />
                    }
                />
            )}
        </View>
    );
};

interface OffreCardProps {
    offre: OffreEmploi;
    onPress: () => void;
}

const OffreCard: React.FC<OffreCardProps> = ({ offre, onPress }) => {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
            <NativeCard style={styles.offreCard}>
                <View style={styles.offreHeader}>
                    <View style={styles.offreInfo}>
                        <Text style={styles.offreTitle}>{offre.titre_poste}</Text>
                        <Text style={styles.offreSecteur}>{offre.secteur}</Text>
                        <Text style={styles.offreLieu}>{offre.lieu_travail}</Text>
                    </View>
                    <View
                        style={[
                            styles.statutBadge,
                            {
                                backgroundColor:
                                    offre.statut === 'active' ? '#10B98120' : '#9CA3AF20',
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.statutText,
                                {
                                    color: offre.statut === 'active' ? '#10B981' : '#9CA3AF',
                                },
                            ]}
                        >
                            {offre.statut === 'active' ? 'Active' : t('mesOffresScreen.fermee')}
                        </Text>
                    </View>
                </View>

                <View style={styles.offreStats}>
                    <View style={styles.statItem}>
                        <SafeIcon name="users" size={16} color={modernColors.primary} type="lucide" />
                        <Text style={styles.statText}>
                            {offre.nombre_candidatures} candidature{offre.nombre_candidatures > 1 ? 's' : ''}
                        </Text>
                    </View>
                    <View style={styles.statItem}>
                        <SafeIcon name="eye" size={16} color={modernColors.textSecondary} type="lucide" />
                        <Text style={styles.statText}>{offre.nombre_vues} vues</Text>
                    </View>
                </View>

                <View style={styles.offreActions}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={(e) => {
                            e.stopPropagation();
                            onPress();
                        }}
                    >
                        <SafeIcon name="users" size={18} color={modernColors.primary} type="lucide" />
                        <Text style={styles.actionButtonText}>Voir candidatures</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={(e) => {
                            e.stopPropagation();
                            // Naviguer vers l'analyse IA
                            Alert.alert('Analyse IA', t('mesOffresScreen.fonctionnaliteAVenir'));
                        }}
                    >
                        <SafeIcon name="brain" size={18} color={modernColors.primary} type="lucide" />
                        <Text style={styles.actionButtonText}>Analyser CV (IA)</Text>
                    </TouchableOpacity>
                </View>
            </NativeCard>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: modernColors.textSecondary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        flex: 1,
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    addButton: {
        padding: 4,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    emptySubtext: {
        marginTop: 8,
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    createButton: {
        backgroundColor: modernColors.primary,
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 8,
    },
    createButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    listContent: {
        padding: 16,
    },
    offreCard: {
        marginBottom: 16,
        padding: 16,
    },
    offreHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    offreInfo: {
        flex: 1,
    },
    offreTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    offreSecteur: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    offreLieu: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    statutBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statutText: {
        fontSize: 12,
        fontWeight: '600',
    },
    offreStats: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    offreActions: {
        flexDirection: 'row',
        gap: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.surface,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        gap: 6,
    },
    actionButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
});

export default MesOffresScreen;

