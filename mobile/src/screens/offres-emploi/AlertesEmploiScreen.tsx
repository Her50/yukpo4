// Écran de gestion des alertes emploi
// Permet de créer et gérer des alertes pour recevoir des notifications d'offres correspondantes

import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard, NativeInput } from '../../components/SafeNativeDesign';
import { offreEmploiService } from '../../services/offreEmploiService';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface AlerteEmploi {
    id: number;
    titre_poste?: string;
    secteur?: string;
    type_contrat?: string;
    lieu_travail?: string;
    salaire_min?: number;
    remote?: boolean;
    is_active: boolean;
    created_at: string;
}

const SECTEURS = [
    'Informatique', 'Commerce', t('alertesEmploiScreen.sante'), 'Éducation', 'Finance',
    'Marketing', 'Ressources Humaines', t('alertesEmploiScreen.ingenierie'), 'Design', 'Autre',
];

const TYPES_CONTRAT = ['CDI', 'CDD', 'Stage', 'Freelance', 'Temps partiel', 'Alternance'];

const AlertesEmploiScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const [alertes, setAlertes] = useState<AlerteEmploi[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);

    // Formulaire nouvelle alerte
    const [formTitre, setFormTitre] = useState('');
    const [formSecteur, setFormSecteur] = useState('');
    const [formTypeContrat, setFormTypeContrat] = useState('');
    const [formLieu, setFormLieu] = useState('');
    const [formSalaireMin, setFormSalaireMin] = useState('');
    const [formRemote, setFormRemote] = useState(false);

    const loadAlertes = useCallback(async () => {
        try {
            setLoading(true);
            const response = await offreEmploiService.getMesAlertes();
            const backendData = (response?.data as any);
            const alertesData = backendData?.data || backendData;
            if (response.success && Array.isArray(alertesData)) {
                setAlertes(alertesData);
            }
        } catch (error: any) {
            console.error('[AlertesEmploiScreen] Erreur:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadAlertes();
    }, [loadAlertes]);

    const handleCreate = async () => {
        if (!formTitre && !formSecteur && !formLieu) {
            Alert.alert('Erreur', 'Veuillez renseigner au moins un critère (titre, secteur ou lieu)');
            return;
        }

        try {
            setCreating(true);
            const alerteData: any = {};
            if (formTitre.trim()) alerteData.titre_poste = formTitre.trim();
            if (formSecteur) alerteData.secteur = formSecteur;
            if (formTypeContrat) alerteData.type_contrat = formTypeContrat;
            if (formLieu.trim()) alerteData.lieu_travail = formLieu.trim();
            if (formSalaireMin) alerteData.salaire_min = parseFloat(formSalaireMin);
            if (formRemote) alerteData.remote = true;

            const response = await offreEmploiService.createAlerte(alerteData);
            if (response.success) {
                Alert.alert('Succès', 'Alerte créée ! Vous serez notifié des nouvelles offres correspondantes.');
                setShowCreateModal(false);
                resetForm();
                loadAlertes();
            } else {
                Alert.alert('Erreur', 'Impossible de créer l\'alerte');
            }
        } catch (error: any) {
            console.error('[AlertesEmploiScreen] Erreur création:', error);
            Alert.alert('Erreur', error.message || 'Erreur lors de la création');
        } finally {
            setCreating(false);
        }
    };

    const resetForm = () => {
        setFormTitre('');
        setFormSecteur('');
        setFormTypeContrat('');
        setFormLieu('');
        setFormSalaireMin('');
        setFormRemote(false);
    };

    const renderAlerte = ({ item }: { item: AlerteEmploi }) => (
        <NativeCard style={styles.alerteCard}>
            <View style={styles.alerteHeader}>
                <View style={styles.alerteIconContainer}>
                    <SafeIcon name="bell" size={20} color="#6366F1" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.alerteTitre} numberOfLines={1}>
                        {item.titre_poste || item.secteur || t('alertesEmploi.alerteGenerale')}
                    </Text>
                    <Text style={styles.alerteDate}>
                        Créée le {new Date(item.created_at).toLocaleDateString('fr-FR')}
                    </Text>
                </View>
                <View style={[styles.activeBadge, { backgroundColor: item.is_active ? '#10B98115' : '#EF444415' }]}>
                    <View style={[styles.activeDot, { backgroundColor: item.is_active ? '#10B981' : '#EF4444' }]} />
                    <Text style={{ fontSize: 11, color: item.is_active ? '#10B981' : '#EF4444', fontWeight: '600' }}>
                        {item.is_active ? 'Active' : 'Inactive'}
                    </Text>
                </View>
            </View>

            <View style={styles.alerteCriteres}>
                {item.secteur && (
                    <View style={styles.critereChip}>
                        <SafeIcon name="briefcase" size={12} color="#6B7280" />
                        <Text style={styles.critereText}>{item.secteur}</Text>
                    </View>
                )}
                {item.type_contrat && (
                    <View style={styles.critereChip}>
                        <SafeIcon name="file-text" size={12} color="#6B7280" />
                        <Text style={styles.critereText}>{item.type_contrat}</Text>
                    </View>
                )}
                {item.lieu_travail && (
                    <View style={styles.critereChip}>
                        <SafeIcon name="map-pin" size={12} color="#6B7280" />
                        <Text style={styles.critereText}>{item.lieu_travail}</Text>
                    </View>
                )}
                {item.remote && (
                    <View style={styles.critereChip}>
                        <SafeIcon name="wifi" size={12} color="#6B7280" />
                        <Text style={styles.critereText}>{t('alertesEmploi.teletravail')}</Text>
                    </View>
                )}
                {item.salaire_min && (
                    <View style={styles.critereChip}>
                        <SafeIcon name="banknote" size={12} color="#6B7280" />
                        <Text style={styles.critereText}>≥ {item.salaire_min.toLocaleString()} FCFA</Text>
                    </View>
                )}
            </View>
        </NativeCard>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.header}>
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>{t('alertesEmploi.mesAlertesEmploi')}</Text>
                        <Text style={styles.headerSubtitle}>
                            {alertes.length} alerte{alertes.length > 1 ? 's' : ''} configurée{alertes.length > 1 ? 's' : ''}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => {
                            hapticPress();
                            setShowCreateModal(true);
                        }}
                        style={styles.addButton}
                    >
                        <SafeIcon name="plus" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* Content */}
            {loading && alertes.length === 0 ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#6366F1" />
                    <Text style={styles.loadingText}>{t('alertesEmploi.chargement')}</Text>
                </View>
            ) : (
                <FlatList
                    data={alertes}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderAlerte}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                loadAlertes();
                            }}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <SafeIcon name="bell-off" size={64} color="#9CA3AF" />
                            <Text style={styles.emptyTitle}>{t('alertesEmploi.aucuneAlerte')}</Text>
                            <Text style={styles.emptyText}>
                                Créez une alerte pour être notifié dès qu'une offre correspondant à vos critères est publiée.
                            </Text>
                            <TouchableOpacity
                                style={styles.createButton}
                                onPress={() => {
                                    hapticPress();
                                    setShowCreateModal(true);
                                }}
                            >
                                <SafeIcon name="plus" size={18} color="#FFFFFF" />
                                <Text style={styles.createButtonText}>{t('alertesEmploi.creerUneAlerte')}</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}

            {/* Modal création */}
            <Modal
                visible={showCreateModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowCreateModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('alertesEmploi.nouvelleAlerte')}</Text>
                            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                                <SafeIcon name="x" size={24} color="#111827" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                            <Text style={styles.fieldLabel}>{t('alertesEmploi.titreDuPosteRecherche')}</Text>
                            <NativeInput
                                value={formTitre}
                                onChangeText={setFormTitre}
                                placeholder={t('alertesEmploi.exDeveloppeurComptable')}
                            />

                            <Text style={styles.fieldLabel}>Secteur</Text>
                            <View style={styles.chipContainer}>
                                {SECTEURS.map(s => (
                                    <TouchableOpacity
                                        key={s}
                                        style={[styles.chip, formSecteur === s && styles.chipSelected]}
                                        onPress={() => setFormSecteur(formSecteur === s ? '' : s)}
                                    >
                                        <Text style={[styles.chipText, formSecteur === s && styles.chipTextSelected]}>{s}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.fieldLabel}>{t('alertesEmploi.typeDeContrat')}</Text>
                            <View style={styles.chipContainer}>
                                {TYPES_CONTRAT.map(t => (
                                    <TouchableOpacity
                                        key={t}
                                        style={[styles.chip, formTypeContrat === t && styles.chipSelected]}
                                        onPress={() => setFormTypeContrat(formTypeContrat === t ? '' : t)}
                                    >
                                        <Text style={[styles.chipText, formTypeContrat === t && styles.chipTextSelected]}>{t}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.fieldLabel}>{t('alertesEmploi.lieuDeTravail')}</Text>
                            <NativeInput
                                value={formLieu}
                                onChangeText={setFormLieu}
                                placeholder={t('alertesEmploi.exDoualaYaounde')}
                            />

                            <Text style={styles.fieldLabel}>Salaire minimum (FCFA)</Text>
                            <NativeInput
                                value={formSalaireMin}
                                onChangeText={setFormSalaireMin}
                                keyboardType="numeric"
                                placeholder="100000"
                            />

                            <View style={styles.switchRow}>
                                <Text style={styles.fieldLabel}>{t('alertesEmploi.teletravailUniquement')}</Text>
                                <Switch
                                    value={formRemote}
                                    onValueChange={setFormRemote}
                                    trackColor={{ false: '#D1D5DB', true: '#6366F1' }}
                                />
                            </View>

                            <NativeButton
                                title={creating ? t('alertesEmploiScreen.creation') : t('alertesEmploiScreen.creerLalerte')}
                                onPress={handleCreate}
                                disabled={creating}
                                style={styles.submitButton}
                            />
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    backButton: { marginRight: 12, padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
    headerSubtitle: { fontSize: 13, color: '#FFFFFFCC', marginTop: 2 },
    addButton: { padding: 8, backgroundColor: '#FFFFFF20', borderRadius: 10 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, fontSize: 14, color: '#6B7280' },
    listContent: { padding: 16, paddingBottom: 100 },

    alerteCard: { marginBottom: 12, padding: 14, borderRadius: 12, backgroundColor: '#FFFFFF' },
    alerteHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    alerteIconContainer: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#6366F115', justifyContent: 'center', alignItems: 'center' },
    alerteTitre: { fontSize: 15, fontWeight: '700', color: '#111827' },
    alerteDate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
    activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    activeDot: { width: 6, height: 6, borderRadius: 3 },

    alerteCriteres: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    critereChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#F3F4F6', borderRadius: 6 },
    critereText: { fontSize: 12, color: '#374151' },

    emptyContainer: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 16 },
    emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 20 },
    createButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, backgroundColor: '#6366F1', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
    createButtonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
    modalScroll: { maxHeight: 500 },

    fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 14, marginBottom: 6 },
    chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
    chipSelected: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
    chipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
    chipTextSelected: { color: '#FFFFFF' },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
    submitButton: { marginTop: 24, marginBottom: 20, backgroundColor: '#6366F1' },
});

export default AlertesEmploiScreen;
