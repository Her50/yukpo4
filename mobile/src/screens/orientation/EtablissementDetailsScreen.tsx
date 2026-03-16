// ✅ Écran de détails d'un établissement (Mobile)

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import ChatModalMobile from '../../components/ChatModalMobile';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/api';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface Etablissement {
    id: number;
    nom_etablissement: string;
    type_etablissement: string;
    adresse?: string;
    ville: string;
    region?: string;
    telephone?: string;
    email?: string;
    site_web?: string;
    filieres?: string[];
    statistiques_examens?: any;
    is_verified: boolean;
}

const EtablissementDetailsScreen: React.FC = () => {
    const navigation = useNavigation() as any;
    const { t } = useLanguageSafe();
    const route = useRoute();
    const { user } = useAuth();
    const { id } = (route.params as any) || {};

    const [loading, setLoading] = useState(true);
    const [etablissement, setEtablissement] = useState<Etablissement | null>(null);
    const [showChat, setShowChat] = useState(false);

    useEffect(() => {
        loadEtablissement();
    }, [id]);

    const loadEtablissement = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/orientation-scolaire/etablissements/${id}`);
            const data = (response?.data || response) as any;

            if (data?.success) {
                setEtablissement(data.data);
            }
        } catch (error) {
            console.error('[EtablissementDetails] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>{t('etablissementDetails.chargement')}</Text>
            </View>
        );
    }

    if (!etablissement) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.emptyText}>{t('etablissementDetails.etablissementNonTrouve')}</Text>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backButtonText}>{t('etablissementDetails.retour')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>{etablissement.nom_etablissement}</Text>
                <View style={styles.metaContainer}>
                    <Text style={styles.meta}>
                        📍 {etablissement.ville}
                        {etablissement.region && `, ${etablissement.region}`}
                    </Text>
                    <Text style={styles.meta}>🎓 {etablissement.type_etablissement}</Text>
                    {etablissement.is_verified && (
                        <View style={styles.verifiedBadge}>
                            <Text style={styles.verifiedText}>{t('etablissementDetails.verifie')}</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Contact */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Contact</Text>
                {etablissement.adresse && (
                    <Text style={styles.sectionText}>📍 {etablissement.adresse}</Text>
                )}
                {etablissement.telephone && (
                    <TouchableOpacity
                        onPress={() => Linking.openURL(`tel:${etablissement.telephone}`)}
                    >
                        <Text style={[styles.sectionText, styles.link]}>
                            📞 {etablissement.telephone}
                        </Text>
                    </TouchableOpacity>
                )}
                {etablissement.email && (
                    <TouchableOpacity
                        onPress={() => Linking.openURL(`mailto:${etablissement.email}`)}
                    >
                        <Text style={[styles.sectionText, styles.link]}>
                            ✉️ {etablissement.email}
                        </Text>
                    </TouchableOpacity>
                )}
                {etablissement.site_web && (
                    <TouchableOpacity
                        onPress={() => Linking.openURL(etablissement.site_web!)}
                    >
                        <Text style={[styles.sectionText, styles.link]}>
                            🌐 {etablissement.site_web}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Filières */}
            {etablissement.filieres && etablissement.filieres.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('etablissementDetails.filieres')}</Text>
                    <View style={styles.tagsContainer}>
                        {etablissement.filieres.map((filiere, idx) => (
                            <View key={idx} style={styles.tag}>
                                <Text style={styles.tagText}>{filiere}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* Actions */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Actions</Text>
                <View style={styles.actionsGrid}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() =>
                            navigation.navigate('ProgrammesList', {
                                etablissement_id: id,
                            })
                        }
                    >
                        <Text style={styles.actionIcon}>📖</Text>
                        <Text style={styles.actionText}>Programmes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() =>
                            navigation.navigate('FournituresList', {
                                etablissement_id: id,
                            })
                        }
                    >
                        <Text style={styles.actionIcon}>✏️</Text>
                        <Text style={styles.actionText}>Fournitures</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() =>
                            navigation.navigate('ConcoursList', {
                                etablissement_id: id,
                            })
                        }
                    >
                        <Text style={styles.actionIcon}>🏆</Text>
                        <Text style={styles.actionText}>Concours</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() =>
                            navigation.navigate('ExperiencesList', {
                                etablissement_id: id,
                            })
                        }
                    >
                        <Text style={styles.actionIcon}>💬</Text>
                        <Text style={styles.actionText}>{t('etablissementDetails.experiences')}</Text>
                    </TouchableOpacity>
                </View>
                {/* Bouton Contacter */}
                <TouchableOpacity
                    style={styles.contactButton}
                    onPress={() => setShowChat(true)}
                >
                    <Text style={styles.contactButtonText}>{t('etablissementDetails.contacterLetablissement')}</Text>
                </TouchableOpacity>
            </View>

            {/* Chat Modal */}
            {etablissement && (
                <ChatModalMobile
                    visible={showChat}
                    onClose={() => setShowChat(false)}
                    service={{
                        id: id?.toString() || '',
                        titre: etablissement.nom_etablissement,
                        description: `Établissement ${etablissement.type_etablissement} - ${etablissement.ville}`,
                    }}
                    prestataireInfo={{
                        id: parseInt(id?.toString() || '0'),
                        name: etablissement.nom_etablissement,
                        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(etablissement.nom_etablissement)}&background=10B981`,
                    }}
                    user={user}
                />
            )}

            {/* Statistiques */}
            {etablissement.statistiques_examens &&
                Object.keys(etablissement.statistiques_examens).length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('etablissementDetails.statistiquesDexamens')}</Text>
                        {Object.entries(etablissement.statistiques_examens).map(
                            ([annee, stats]: [string, any]) => (
                                <View key={annee} style={styles.statsCard}>
                                    <Text style={styles.statsYear}>{annee}</Text>
                                    {stats.taux_reussite && (
                                        <Text style={styles.statsText}>
                                            Taux de réussite: {stats.taux_reussite}%
                                        </Text>
                                    )}
                                    {stats.nb_candidats && (
                                        <Text style={styles.statsText}>
                                            Candidats: {stats.nb_candidats}
                                        </Text>
                                    )}
                                </View>
                            )
                        )}
                    </View>
                )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        color: '#6B7280',
    },
    emptyText: {
        color: '#6B7280',
        fontSize: 16,
        marginBottom: 16,
    },
    backButton: {
        backgroundColor: '#3B82F6',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    backButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    header: {
        backgroundColor: '#FFFFFF',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 12,
    },
    metaContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    meta: {
        fontSize: 14,
        color: '#6B7280',
    },
    verifiedBadge: {
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    verifiedText: {
        color: '#065F46',
        fontSize: 12,
        fontWeight: '500',
    },
    section: {
        backgroundColor: '#FFFFFF',
        padding: 20,
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    sectionText: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 8,
    },
    link: {
        color: '#3B82F6',
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        backgroundColor: '#DBEAFE',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    tagText: {
        color: '#1E40AF',
        fontSize: 14,
    },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    actionButton: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#E5E7EB',
    },
    actionIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    actionText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#111827',
    },
    statsCard: {
        backgroundColor: '#F9FAFB',
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#3B82F6',
    },
    statsYear: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    statsText: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    contactButton: {
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 12,
    },
    contactButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default EtablissementDetailsScreen;

