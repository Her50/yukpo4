// ✅ Détails d'un livre scolaire avec actions (Mobile)

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { NativeButton, NativeCard } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface LivreScolaire {
    id: number;
    service_id?: number;
    user_id: number;
    titre: string;
    auteur?: string;
    editeur?: string;
    isbn?: string;
    classe_actuelle: string;
    classe_souhaitee: string;
    matiere: string;
    niveau?: string;
    etat_livre: string;
    description_etat?: string;
    images_urls?: string[];
    video_url?: string;
    gps?: string;
    ville?: string;
    quartier?: string;
    is_available: boolean;
    is_active: boolean;
    created_at: string;
}

const LivreScolaireDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const params = route.params as any;

    const [livre, setLivre] = useState<LivreScolaire | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLivreDetails();
    }, []);

    const loadLivreDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/livres-scolaires/${params.livreId}`);

            if (response.success && response.data) {
                setLivre(response.data.livre);
            } else {
                Alert.alert('Erreur', 'Impossible de charger les détails du livre');
                navigation.goBack();
            }
        } catch (error: any) {
            console.error('[LivreScolaireDetailsScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les détails');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const handleFindMatching = async () => {
        if (!livre) return;

        try {
            const response = await apiPost('/api/troc-livres/match', {
                livre_id: livre.id,
                include_chaines: true,
                max_participants: 5,
            });

            if (response.success && response.data) {
                navigation.navigate('TrocMatching' as never, {
                    livreId: livre.id,
                    matchings: response.data.matchings,
                } as never);
            }
        } catch (error: any) {
            console.error('[LivreScolaireDetailsScreen] Erreur matching:', error);
            Alert.alert('Erreur', 'Impossible de trouver des matchings');
        }
    };

    const isOwner = user?.id === livre?.user_id;

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    if (!livre) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Livre non trouvé</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Détails du livre</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* Images */}
                {livre.images_urls && livre.images_urls.length > 0 && (
                    <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        style={styles.imagesScroll}
                    >
                        {livre.images_urls.map((url, index) => (
                            <Image key={index} source={{ uri: url }} style={styles.image} />
                        ))}
                    </ScrollView>
                )}

                {/* Informations principales */}
                <NativeCard style={styles.card}>
                    <Text style={styles.titre}>{livre.titre}</Text>
                    {livre.auteur && (
                        <Text style={styles.auteur}>Par {livre.auteur}</Text>
                    )}
                    {livre.editeur && (
                        <Text style={styles.meta}>Éditeur: {livre.editeur}</Text>
                    )}
                    {livre.isbn && (
                        <Text style={styles.meta}>ISBN: {livre.isbn}</Text>
                    )}
                </NativeCard>

                {/* Échange */}
                <NativeCard style={styles.card}>
                    <Text style={styles.cardTitle}>📚 Échange</Text>
                    <View style={styles.exchangeInfo}>
                        <View style={styles.exchangeItem}>
                            <Text style={styles.exchangeLabel}>Classe actuelle</Text>
                            <Text style={styles.exchangeValue}>{livre.classe_actuelle}</Text>
                        </View>
                        <SafeIcon name="arrow-right" size={20} color={modernColors.primary} />
                        <View style={styles.exchangeItem}>
                            <Text style={styles.exchangeLabel}>Classe souhaitée</Text>
                            <Text style={styles.exchangeValue}>{livre.classe_souhaitee}</Text>
                        </View>
                    </View>
                    <View style={styles.metaRow}>
                        <Text style={styles.meta}>📖 {livre.matiere}</Text>
                        {livre.niveau && (
                            <Text style={styles.meta}>🎓 {livre.niveau}</Text>
                        )}
                    </View>
                </NativeCard>

                {/* État */}
                <NativeCard style={styles.card}>
                    <Text style={styles.cardTitle}>État du livre</Text>
                    <View style={[
                        styles.etatBadge,
                        { backgroundColor: getEtatColor(livre.etat_livre) + '20' }
                    ]}>
                        <Text style={[
                            styles.etatText,
                            { color: getEtatColor(livre.etat_livre) }
                        ]}>
                            {livre.etat_livre}
                        </Text>
                    </View>
                    {livre.description_etat && (
                        <Text style={styles.description}>{livre.description_etat}</Text>
                    )}
                </NativeCard>

                {/* Localisation */}
                {(livre.ville || livre.quartier) && (
                    <NativeCard style={styles.card}>
                        <Text style={styles.cardTitle}>📍 Localisation</Text>
                        {livre.ville && (
                            <Text style={styles.meta}>Ville: {livre.ville}</Text>
                        )}
                        {livre.quartier && (
                            <Text style={styles.meta}>Quartier: {livre.quartier}</Text>
                        )}
                    </NativeCard>
                )}

                {/* Vidéo */}
                {livre.video_url && (
                    <NativeCard style={styles.card}>
                        <Text style={styles.cardTitle}>📹 Vidéo</Text>
                        <Text style={styles.meta}>Vidéo d'appréciation disponible</Text>
                        {/* TODO: Intégrer lecteur vidéo */}
                    </NativeCard>
                )}

                {/* Actions */}
                {!isOwner && livre.is_available && (
                    <View style={styles.actions}>
                        <NativeButton
                            title="🔄 Trouver un troc"
                            variant="primary"
                            onPress={handleFindMatching}
                            style={styles.actionButton}
                        />
                    </View>
                )}

                {isOwner && (
                    <View style={styles.actions}>
                        <NativeButton
                            title="✏️ Modifier"
                            variant="outline"
                            onPress={() => {
                                navigation.navigate('LivreScolaireForm' as never, {
                                    livreId: livre.id,
                                    mode: 'edit',
                                } as never);
                            }}
                            style={styles.actionButton}
                        />
                        <NativeButton
                            title={livre.is_available ? "❌ Marquer comme indisponible" : "✅ Marquer comme disponible"}
                            variant="outline"
                            onPress={async () => {
                                try {
                                    await apiPost(`/api/livres-scolaires/${livre.id}/availability`, {
                                        is_available: !livre.is_available,
                                    });
                                    loadLivreDetails();
                                    Alert.alert('Succès', 'Disponibilité mise à jour');
                                } catch (error: any) {
                                    Alert.alert('Erreur', 'Impossible de mettre à jour la disponibilité');
                                }
                            }}
                            style={styles.actionButton}
                        />
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const getEtatColor = (etat: string): string => {
    switch (etat) {
        case 'Neuf': return modernColors.success;
        case 'Très bon': return '#10B981';
        case 'Bon': return modernColors.warning;
        case 'Acceptable': return modernColors.error;
        default: return modernColors.textSecondary;
    }
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
        padding: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    errorText: {
        fontSize: 16,
        color: modernColors.error,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        gap: 16,
    },
    imagesScroll: {
        maxHeight: 300,
        marginBottom: 16,
    },
    image: {
        width: 300,
        height: 400,
        borderRadius: 8,
        marginRight: 8,
    },
    card: {
        padding: 16,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 12,
    },
    titre: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 8,
    },
    auteur: {
        fontSize: 16,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    meta: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    metaRow: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 8,
    },
    exchangeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginVertical: 12,
    },
    exchangeItem: {
        flex: 1,
    },
    exchangeLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    exchangeValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.primary,
    },
    etatBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginBottom: 12,
    },
    etatText: {
        fontSize: 14,
        fontWeight: '600',
    },
    description: {
        fontSize: 14,
        color: '#374151',
        lineHeight: 20,
    },
    actions: {
        gap: 12,
        marginTop: 8,
    },
    actionButton: {
        width: '100%',
    },
});

export default LivreScolaireDetailsScreen;

