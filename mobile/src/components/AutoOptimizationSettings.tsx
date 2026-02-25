import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { NativeCard } from './SafeNativeDesign';

interface AutoOptimizationSettings {
    enabled: boolean;
    budget_optimization: boolean;
    targeting_optimization: boolean;
    schedule_optimization: boolean;
    placement_optimization: boolean;
    bid_strategy_optimization: boolean;
    auto_apply_threshold: number; // Seuil de confiance pour appliquer automatiquement (0-1)
    optimization_frequency: 'daily' | 'weekly' | 'real-time'; // Fréquence d'optimisation
    min_confidence: number; // Confiance minimale pour appliquer (0-1)
    budget_adjustment_limit: number; // Limite d'ajustement de budget (%)
}

interface AutoOptimizationSettingsProps {
    userId?: number;
    campaignId?: number;
    onSettingsChange?: (settings: AutoOptimizationSettings) => void;
}

const defaultSettings: AutoOptimizationSettings = {
    enabled: false,
    budget_optimization: true,
    targeting_optimization: true,
    schedule_optimization: false,
    placement_optimization: true,
    bid_strategy_optimization: true,
    auto_apply_threshold: 0.85,
    optimization_frequency: 'daily',
    min_confidence: 0.75,
    budget_adjustment_limit: 20,
};

export const AutoOptimizationSettings: React.FC<AutoOptimizationSettingsProps> = ({
    userId,
    campaignId,
    onSettingsChange,
}) => {
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<AutoOptimizationSettings>(defaultSettings);

    const loadSettings = useCallback(async () => {
        if (!userId) return;

        try {
            setLoading(true);
            const endpoint = campaignId
                ? `/api/publicites/optimization/auto-settings?user_id=${userId}&campaign_id=${campaignId}`
                : `/api/publicites/optimization/auto-settings?user_id=${userId}`;

            const response = await apiGet(endpoint);

            if (response.success && response.data) {
                setSettings({ ...defaultSettings, ...response.data.settings });
            }
        } catch (error) {
            console.error('[AutoOptimizationSettings] Erreur chargement:', error);
            // Garder les paramètres par défaut en cas d'erreur
        } finally {
            setLoading(false);
        }
    }, [userId, campaignId]);

    useEffect(() => {
        if (expanded && userId) {
            loadSettings();
        }
    }, [expanded, userId, loadSettings]);

    const saveSettings = useCallback(async () => {
        if (!userId) return;

        try {
            setSaving(true);
            const endpoint = campaignId
                ? `/api/publicites/optimization/auto-settings`
                : `/api/publicites/optimization/auto-settings`;

            const payload = {
                user_id: userId,
                campaign_id: campaignId,
                settings,
            };

            const response = await apiPost(endpoint, payload);

            if (response.success) {
                Alert.alert('Succès', 'Paramètres d\'optimisation automatique sauvegardés');
                onSettingsChange?.(settings);
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de sauvegarder les paramètres');
            }
        } catch (error) {
            console.error('[AutoOptimizationSettings] Erreur sauvegarde:', error);
            Alert.alert('Erreur', 'Une erreur est survenue lors de la sauvegarde');
        } finally {
            setSaving(false);
        }
    }, [userId, campaignId, settings, onSettingsChange]);

    const updateSetting = <K extends keyof AutoOptimizationSettings>(
        key: K,
        value: AutoOptimizationSettings[K]
    ) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
    };

    if (!expanded) {
        return (
            <TouchableOpacity
                style={styles.expandButton}
                onPress={() => setExpanded(true)}
            >
                <SafeIcon name="zap" size={20} color={modernColors.primary} />
                <Text style={styles.expandText}>
                    Optimisation Automatique
                    {settings.enabled && <Text style={styles.enabledBadge}> ✓ Activée</Text>}
                </Text>
                <SafeIcon name="chevron-right" size={16} color={modernColors.textSecondary} />
            </TouchableOpacity>
        );
    }

    return (
        <NativeCard style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>⚡ Optimisation Automatique</Text>
                    <Text style={styles.subtitle}>
                        Laissez l'IA optimiser vos campagnes automatiquement
                    </Text>
                </View>
                <TouchableOpacity onPress={() => setExpanded(false)}>
                    <SafeIcon name="x" size={20} color={modernColors.textSecondary} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={modernColors.primary} />
                </View>
            ) : (
                <View style={styles.content}>
                    {/* Activation principale */}
                    <View style={styles.section}>
                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Activer l'optimisation automatique</Text>
                                <Text style={styles.settingDescription}>
                                    L'IA analysera et optimisera vos campagnes selon vos préférences
                                </Text>
                            </View>
                            <Switch
                                value={settings.enabled}
                                onValueChange={(value) => updateSetting('enabled', value)}
                                trackColor={{ false: modernColors.border, true: modernColors.primary }}
                                thumbColor="#fff"
                            />
                        </View>
                    </View>

                    {settings.enabled && (
                        <>
                            {/* Types d'optimisation */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Types d'optimisation</Text>

                                <View style={styles.settingRow}>
                                    <View style={styles.settingInfo}>
                                        <Text style={styles.settingLabel}>Budget</Text>
                                        <Text style={styles.settingDescription}>
                                            Ajuster automatiquement le budget selon les performances
                                        </Text>
                                    </View>
                                    <Switch
                                        value={settings.budget_optimization}
                                        onValueChange={(value) => updateSetting('budget_optimization', value)}
                                        trackColor={{ false: modernColors.border, true: modernColors.primary }}
                                        thumbColor="#fff"
                                    />
                                </View>

                                <View style={styles.settingRow}>
                                    <View style={styles.settingInfo}>
                                        <Text style={styles.settingLabel}>Ciblage</Text>
                                        <Text style={styles.settingDescription}>
                                            Affiner le ciblage selon les audiences performantes
                                        </Text>
                                    </View>
                                    <Switch
                                        value={settings.targeting_optimization}
                                        onValueChange={(value) => updateSetting('targeting_optimization', value)}
                                        trackColor={{ false: modernColors.border, true: modernColors.primary }}
                                        thumbColor="#fff"
                                    />
                                </View>

                                <View style={styles.settingRow}>
                                    <View style={styles.settingInfo}>
                                        <Text style={styles.settingLabel}>Planification</Text>
                                        <Text style={styles.settingDescription}>
                                            Optimiser les heures et jours de diffusion
                                        </Text>
                                    </View>
                                    <Switch
                                        value={settings.schedule_optimization}
                                        onValueChange={(value) => updateSetting('schedule_optimization', value)}
                                        trackColor={{ false: modernColors.border, true: modernColors.primary }}
                                        thumbColor="#fff"
                                    />
                                </View>

                                <View style={styles.settingRow}>
                                    <View style={styles.settingInfo}>
                                        <Text style={styles.settingLabel}>Placements</Text>
                                        <Text style={styles.settingDescription}>
                                            Réallouer le budget vers les placements performants
                                        </Text>
                                    </View>
                                    <Switch
                                        value={settings.placement_optimization}
                                        onValueChange={(value) => updateSetting('placement_optimization', value)}
                                        trackColor={{ false: modernColors.border, true: modernColors.primary }}
                                        thumbColor="#fff"
                                    />
                                </View>

                                <View style={styles.settingRow}>
                                    <View style={styles.settingInfo}>
                                        <Text style={styles.settingLabel}>Stratégie d'enchères</Text>
                                        <Text style={styles.settingDescription}>
                                            Ajuster automatiquement la stratégie d'enchères
                                        </Text>
                                    </View>
                                    <Switch
                                        value={settings.bid_strategy_optimization}
                                        onValueChange={(value) => updateSetting('bid_strategy_optimization', value)}
                                        trackColor={{ false: modernColors.border, true: modernColors.primary }}
                                        thumbColor="#fff"
                                    />
                                </View>
                            </View>

                            {/* Paramètres avancés */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Paramètres avancés</Text>

                                <View style={styles.settingRow}>
                                    <View style={styles.settingInfo}>
                                        <Text style={styles.settingLabel}>Fréquence d'optimisation</Text>
                                        <Text style={styles.settingDescription}>
                                            À quelle fréquence l'IA doit-elle analyser et optimiser ?
                                        </Text>
                                    </View>
                                    <View style={styles.frequencySelector}>
                                        {(['daily', 'weekly', 'real-time'] as const).map((freq) => (
                                            <TouchableOpacity
                                                key={freq}
                                                style={[
                                                    styles.frequencyButton,
                                                    settings.optimization_frequency === freq && styles.frequencyButtonActive,
                                                ]}
                                                onPress={() => updateSetting('optimization_frequency', freq)}
                                            >
                                                <Text
                                                    style={[
                                                        styles.frequencyButtonText,
                                                        settings.optimization_frequency === freq && styles.frequencyButtonTextActive,
                                                    ]}
                                                >
                                                    {freq === 'daily' ? 'Quotidien' : freq === 'weekly' ? 'Hebdomadaire' : 'Temps réel'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <View style={styles.settingRow}>
                                    <View style={styles.settingInfo}>
                                        <Text style={styles.settingLabel}>
                                            Seuil d'application automatique: {(settings.auto_apply_threshold * 100).toFixed(0)}%
                                        </Text>
                                        <Text style={styles.settingDescription}>
                                            Confiance minimale pour appliquer automatiquement les optimisations
                                        </Text>
                                    </View>
                                    <View style={styles.sliderContainer}>
                                        <Text style={styles.sliderValue}>
                                            {(settings.auto_apply_threshold * 100).toFixed(0)}%
                                        </Text>
                                        {/* Slider simplifié avec boutons */}
                                        <View style={styles.sliderButtons}>
                                            {[0.7, 0.8, 0.85, 0.9, 0.95].map((val) => (
                                                <TouchableOpacity
                                                    key={val}
                                                    style={[
                                                        styles.sliderButton,
                                                        Math.abs(settings.auto_apply_threshold - val) < 0.01 && styles.sliderButtonActive,
                                                    ]}
                                                    onPress={() => updateSetting('auto_apply_threshold', val)}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.sliderButtonText,
                                                            Math.abs(settings.auto_apply_threshold - val) < 0.01 && styles.sliderButtonTextActive,
                                                        ]}
                                                    >
                                                        {(val * 100).toFixed(0)}%
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.settingRow}>
                                    <View style={styles.settingInfo}>
                                        <Text style={styles.settingLabel}>
                                            Limite d'ajustement de budget: {settings.budget_adjustment_limit}%
                                        </Text>
                                        <Text style={styles.settingDescription}>
                                            Variation maximale du budget lors d'une optimisation
                                        </Text>
                                    </View>
                                    <View style={styles.sliderContainer}>
                                        <Text style={styles.sliderValue}>
                                            {settings.budget_adjustment_limit}%
                                        </Text>
                                        <View style={styles.sliderButtons}>
                                            {[10, 15, 20, 25, 30].map((val) => (
                                                <TouchableOpacity
                                                    key={val}
                                                    style={[
                                                        styles.sliderButton,
                                                        settings.budget_adjustment_limit === val && styles.sliderButtonActive,
                                                    ]}
                                                    onPress={() => updateSetting('budget_adjustment_limit', val)}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.sliderButtonText,
                                                            settings.budget_adjustment_limit === val && styles.sliderButtonTextActive,
                                                        ]}
                                                    >
                                                        {val}%
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* Info */}
                            <View style={styles.infoBox}>
                                <SafeIcon name="info" size={16} color={modernColors.info} />
                                <Text style={styles.infoText}>
                                    L'optimisation automatique utilise l'IA pour analyser vos campagnes et appliquer
                                    les meilleures pratiques. Vous recevrez des notifications pour chaque optimisation appliquée.
                                </Text>
                            </View>
                        </>
                    )}

                    {/* Bouton sauvegarder */}
                    <TouchableOpacity
                        style={styles.saveButton}
                        onPress={saveSettings}
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <SafeIcon name="save" size={18} color="#fff" />
                                <Text style={styles.saveButtonText}>Sauvegarder les paramètres</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </NativeCard>
    );
};

const styles = StyleSheet.create({
    expandButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
        marginBottom: 16,
    },
    expandText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    enabledBadge: {
        color: modernColors.success,
        fontWeight: '700',
    },
    container: {
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    content: {
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 16,
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    settingInfo: {
        flex: 1,
        marginRight: 16,
    },
    settingLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    settingDescription: {
        fontSize: 12,
        color: modernColors.textSecondary,
        lineHeight: 16,
    },
    frequencySelector: {
        flexDirection: 'row',
        gap: 8,
    },
    frequencyButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    frequencyButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    frequencyButtonText: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.text,
    },
    frequencyButtonTextActive: {
        color: '#fff',
    },
    sliderContainer: {
        alignItems: 'flex-end',
    },
    sliderValue: {
        fontSize: 14,
        fontWeight: '700',
        color: modernColors.primary,
        marginBottom: 8,
    },
    sliderButtons: {
        flexDirection: 'row',
        gap: 4,
    },
    sliderButton: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    sliderButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    sliderButtonText: {
        fontSize: 10,
        fontWeight: '600',
        color: modernColors.text,
    },
    sliderButtonTextActive: {
        color: '#fff',
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 16,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    infoText: {
        flex: 1,
        fontSize: 11,
        color: modernColors.textSecondary,
        lineHeight: 16,
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 14,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
        marginTop: 8,
    },
    saveButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
});

