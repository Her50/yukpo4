// Écran de gestion du groupe sanguin utilisateur
// Permet d'enregistrer/modifier son groupe sanguin et disponibilité pour don

import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../components/SafeIcon';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';

const BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

const BloodGroupManagementScreen: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [bloodGroup, setBloodGroup] = useState<string | null>(null);
    const [isAvailable, setIsAvailable] = useState(true);
    const [lastDonationDate, setLastDonationDate] = useState<string | null>(null);
    const [nextAvailableDate, setNextAvailableDate] = useState<string | null>(null);

    useEffect(() => {
        loadBloodGroupInfo();
    }, [user?.id]);

    const loadBloodGroupInfo = async () => {
        if (!user?.id) return;

        try {
            setLoading(true);
            // Récupérer les groupes sanguins de l'utilisateur
            const response = await apiGet('/api/blood-donation/donor/blood-groups');

            const rdata: any = response.data;
            if (response.success && rdata && rdata.length > 0) {
                const userBloodGroup: any = rdata[0]; // Prendre le premier groupe
                setBloodGroup(userBloodGroup.groupe_sanguin);
                setIsAvailable(userBloodGroup.is_available_for_donation);
                setLastDonationDate(userBloodGroup.last_donation_date);
                setNextAvailableDate(userBloodGroup.next_donation_available_date);
            }
        } catch (error: any) {
            console.error('[BloodGroupManagementScreen] Erreur chargement:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!bloodGroup) {
            Alert.alert('Erreur', 'Veuillez sélectionner votre groupe sanguin');
            return;
        }

        if (!user?.id) {
            Alert.alert('Erreur', 'Vous devez être connecté');
            return;
        }

        try {
            setSaving(true);

            // Créer ou mettre à jour le groupe sanguin
            const response = await apiPost('/api/blood-donation/donor/blood-group', {
                groupe_sanguin: bloodGroup,
                is_available_for_donation: isAvailable,
            });

            if (response.success) {
                Alert.alert('✅ Succès', 'Votre groupe sanguin a été enregistré avec succès');
                await loadBloodGroupInfo();
            } else {
                Alert.alert('Erreur', response.error || 'Impossible d\'enregistrer votre groupe sanguin');
            }
        } catch (error: any) {
            console.error('[BloodGroupManagementScreen] Erreur sauvegarde:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateLastDonation = async () => {
        if (!bloodGroup) {
            Alert.alert('Erreur', 'Veuillez d\'abord enregistrer votre groupe sanguin');
            return;
        }

        Alert.alert(
            'Mettre à jour le dernier don',
            'Voulez-vous enregistrer la date d\'aujourd\'hui comme date de votre dernier don ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Confirmer',
                    onPress: async () => {
                        try {
                            setSaving(true);
                            const response = await apiPost('/api/blood-donation/donor/update-last-donation', {
                                groupe_sanguin: bloodGroup,
                                donation_date: new Date().toISOString().split('T')[0], // Format YYYY-MM-DD
                            });

                            if (response.success) {
                                Alert.alert(
                                    '✅ Succès',
                                    `Votre dernier don a été enregistré. Prochain don possible le ${(response.data as any)?.next_donation_available_date || 'N/A'}`
                                );
                                await loadBloodGroupInfo();
                            } else {
                                Alert.alert('Erreur', response.error || 'Impossible de mettre à jour');
                            }
                        } catch (error: any) {
                            console.error('[BloodGroupManagementScreen] Erreur:', error);
                            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
                        } finally {
                            setSaving(false);
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Header */}
            <View style={styles.header}>
                <SafeIcon name="droplet" size={48} color={modernColors.primary} />
                <Text style={styles.title}>Gestion du don de sang</Text>
                <Text style={styles.subtitle}>
                    Enregistrez votre groupe sanguin pour être notifié en cas de besoin urgent
                </Text>
            </View>

            {/* Sélection groupe sanguin */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Votre groupe sanguin</Text>
                <View style={styles.bloodGroupGrid}>
                    {BLOOD_GROUPS.map((group) => (
                        <TouchableOpacity
                            key={group}
                            style={[
                                styles.bloodGroupButton,
                                bloodGroup === group && styles.bloodGroupButtonSelected,
                            ]}
                            onPress={() => setBloodGroup(group)}
                        >
                            <Text
                                style={[
                                    styles.bloodGroupText,
                                    bloodGroup === group && styles.bloodGroupTextSelected,
                                ]}
                            >
                                {group}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Disponibilité pour don */}
            <View style={styles.section}>
                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>Disponible pour don</Text>
                        <Text style={styles.settingDescription}>
                            Vous serez notifié en cas de demande urgente compatible avec votre groupe
                        </Text>
                    </View>
                    <Switch
                        value={isAvailable}
                        onValueChange={setIsAvailable}
                        trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        thumbColor="#fff"
                    />
                </View>
            </View>

            {/* Informations dernier don */}
            {lastDonationDate && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Historique de don</Text>
                    <View style={styles.infoCard}>
                        <View style={styles.infoRow}>
                            <SafeIcon name="calendar" size={20} color={modernColors.primary} />
                            <View style={styles.infoTextContainer}>
                                <Text style={styles.infoLabel}>Dernier don</Text>
                                <Text style={styles.infoValue}>
                                    {new Date(lastDonationDate).toLocaleDateString('fr-FR', {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric',
                                    })}
                                </Text>
                            </View>
                        </View>
                        {nextAvailableDate && (
                            <View style={styles.infoRow}>
                                <SafeIcon name="clock" size={20} color={modernColors.primary} />
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoLabel}>Prochain don possible</Text>
                                    <Text style={styles.infoValue}>
                                        {new Date(nextAvailableDate).toLocaleDateString('fr-FR', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric',
                                        })}
                                    </Text>
                                </View>
                            </View>
                        )}
                        <TouchableOpacity
                            style={styles.updateButton}
                            onPress={handleUpdateLastDonation}
                            disabled={saving}
                        >
                            <SafeIcon name="edit" size={16} color={modernColors.primary} />
                            <Text style={styles.updateButtonText}>Mettre à jour le dernier don</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Informations importantes */}
            <View style={styles.section}>
                <View style={styles.importantInfo}>
                    <SafeIcon name="info" size={20} color={modernColors.primary} />
                    <View style={styles.importantInfoText}>
                        <Text style={styles.importantInfoTitle}>ℹ️ Informations importantes</Text>
                        <Text style={styles.importantInfoItem}>
                            • Le délai minimum entre deux dons est de 8 semaines (56 jours)
                        </Text>
                        <Text style={styles.importantInfoItem}>
                            • Vous serez automatiquement notifié en cas de demande urgente compatible
                        </Text>
                        <Text style={styles.importantInfoItem}>
                            • Votre position GPS sera utilisée pour trouver les donneurs les plus proches
                        </Text>
                        <Text style={styles.importantInfoItem}>
                            • Vous pouvez refuser une demande à tout moment
                        </Text>
                    </View>
                </View>
            </View>

            {/* Bouton sauvegarder */}
            <TouchableOpacity
                style={[styles.saveButton, (!bloodGroup || saving) && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={!bloodGroup || saving}
            >
                {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <>
                        <SafeIcon name="check-circle" size={20} color="#fff" />
                        <Text style={styles.saveButtonText}>Enregistrer</Text>
                    </>
                )}
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    content: {
        padding: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#6B7280',
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginTop: 12,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 16,
    },
    bloodGroupGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    bloodGroupButton: {
        width: '22%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E5E7EB',
    },
    bloodGroupButtonSelected: {
        borderColor: modernColors.primary,
        backgroundColor: `${modernColors.primary}15`,
    },
    bloodGroupText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#6B7280',
    },
    bloodGroupTextSelected: {
        color: modernColors.primary,
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    settingInfo: {
        flex: 1,
        marginRight: 12,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    settingDescription: {
        fontSize: 13,
        color: '#6B7280',
        lineHeight: 18,
    },
    infoCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    infoTextContainer: {
        marginLeft: 12,
        flex: 1,
    },
    infoLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    updateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        marginTop: 8,
        gap: 8,
    },
    updateButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    importantInfo: {
        flexDirection: 'row',
        backgroundColor: '#FEF3C7',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FCD34D',
        gap: 12,
    },
    importantInfoText: {
        flex: 1,
    },
    importantInfoTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#92400E',
        marginBottom: 8,
    },
    importantInfoItem: {
        fontSize: 13,
        color: '#92400E',
        lineHeight: 20,
        marginBottom: 4,
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.primary,
        padding: 16,
        borderRadius: 12,
        marginTop: 8,
        marginBottom: 32,
        gap: 8,
    },
    saveButtonDisabled: {
        backgroundColor: '#D1D5DB',
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
});

export default BloodGroupManagementScreen;

