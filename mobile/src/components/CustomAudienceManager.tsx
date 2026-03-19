import * as DocumentPicker from 'expo-document-picker';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { NativeCard, NativeInput } from './SafeNativeDesign';

export interface CustomAudience {
    id: string;
    name: string;
    type: 'lookalike' | 'custom' | 'retargeting';
    source: 'website' | 'app' | 'email' | 'phone' | 'csv' | 'pixel';
    size: number;
    similarity?: number; // Pour lookalike (1-10)
    created_at: string;
    status: 'active' | 'pending' | 'error';
}

interface CustomAudienceManagerProps {
    selectedAudiences: string[];
    onAudiencesChange: (audienceIds: string[]) => void;
    userId?: number;
}

export const CustomAudienceManager: React.FC<CustomAudienceManagerProps> = ({
    selectedAudiences,
    onAudiencesChange,
    userId,
}) => {
    const [audiences, setAudiences] = useState<CustomAudience[]>([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createType, setCreateType] = useState<'lookalike' | 'custom' | null>(null);
    const [newAudienceName, setNewAudienceName] = useState('');
    const [lookalikeSource, setLookalikeSource] = useState<string>('');
    const [similarity, setSimilarity] = useState(5);
    const [customSource, setCustomSource] = useState<'email' | 'phone' | 'csv'>('email');
    const [customData, setCustomData] = useState(''); // Emails ou téléphones séparés par virgules

    const loadAudiences = useCallback(async () => {
        if (!userId) return;

        try {
            setLoading(true);
            const response = await apiGet(`/api/publicites/audiences?user_id=${userId}`);

            if (response.success && response.data) {
                setAudiences((response.data as any).audiences || []);
            }
        } catch (error) {
            console.error('[CustomAudienceManager] Erreur chargement:', error);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    React.useEffect(() => {
        if (expanded && userId) {
            loadAudiences();
        }
    }, [expanded, userId, loadAudiences]);

    const handleCreateLookalike = useCallback(async () => {
        if (!newAudienceName.trim() || !lookalikeSource.trim()) {
            Alert.alert('Erreur', 'Veuillez remplir tous les champs');
            return;
        }

        try {
            setLoading(true);
            const response = await apiPost('/api/publicites/audiences/create', {
                name: newAudienceName,
                type: 'lookalike',
                source_audience_id: lookalikeSource,
                similarity: similarity,
            });

            if (response.success) {
                Alert.alert('Succès', 'Audience lookalike créée avec succès');
                setShowCreateForm(false);
                setCreateType(null);
                setNewAudienceName('');
                loadAudiences();
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de créer l\'audience');
            }
        } catch (error) {
            console.error('[CustomAudienceManager] Erreur création lookalike:', error);
            Alert.alert('Erreur', 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    }, [newAudienceName, lookalikeSource, similarity, loadAudiences]);

    const handleCreateCustom = useCallback(async () => {
        if (!newAudienceName.trim()) {
            Alert.alert('Erreur', 'Veuillez entrer un nom');
            return;
        }

        if (customSource === 'csv') {
            // Import CSV
            try {
                const result = await DocumentPicker.getDocumentAsync({
                    type: 'text/csv',
                    copyToCacheDirectory: true,
                });

                if ((result as any).type === 'success') {
                    // Lire le fichier CSV et extraire les données
                    // TODO: Implémenter la lecture du CSV
                    Alert.alert('Info', 'Import CSV à implémenter');
                }
            } catch (error) {
                console.error('[CustomAudienceManager] Erreur import CSV:', error);
            }
            return;
        }

        if (!customData.trim()) {
            Alert.alert('Erreur', 'Veuillez entrer des données');
            return;
        }

        // Parser les données (emails ou téléphones)
        const items = customData
            .split(/[,\n]/)
            .map(item => item.trim())
            .filter(item => item.length > 0);

        if (items.length === 0) {
            Alert.alert('Erreur', 'Aucune donnée valide trouvée');
            return;
        }

        try {
            setLoading(true);
            const response = await apiPost('/api/publicites/audiences/create', {
                name: newAudienceName,
                type: 'custom',
                source: customSource,
                data: items,
            });

            if (response.success) {
                Alert.alert('Succès', `Audience créée avec ${items.length} contacts`);
                setShowCreateForm(false);
                setCreateType(null);
                setNewAudienceName('');
                setCustomData('');
                loadAudiences();
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de créer l\'audience');
            }
        } catch (error) {
            console.error('[CustomAudienceManager] Erreur création custom:', error);
            Alert.alert('Erreur', 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    }, [newAudienceName, customSource, customData, loadAudiences]);

    const toggleAudience = useCallback((audienceId: string) => {
        if (selectedAudiences.includes(audienceId)) {
            onAudiencesChange(selectedAudiences.filter(id => id !== audienceId));
        } else {
            onAudiencesChange([...selectedAudiences, audienceId]);
        }
    }, [selectedAudiences, onAudiencesChange]);

    if (!expanded) {
        return (
            <TouchableOpacity
                style={styles.expandButton}
                onPress={() => setExpanded(true)}
            >
                <SafeIcon name="users" size={20} color={modernColors.primary} />
                <Text style={styles.expandText}>
                    Audiences personnalisées ({selectedAudiences.length} sélectionnée{selectedAudiences.length > 1 ? 's' : ''})
                </Text>
                <SafeIcon name="chevron-right" size={16} color={modernColors.textSecondary} />
            </TouchableOpacity>
        );
    }

    return (
        <NativeCard style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>👥 Audiences Personnalisées</Text>
                    <Text style={styles.subtitle}>
                        Ciblez des utilisateurs similaires ou importez vos propres listes
                    </Text>
                </View>
                <TouchableOpacity onPress={() => setExpanded(false)}>
                    <SafeIcon name="x" size={20} color={modernColors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Bouton créer */}
            {!showCreateForm && (
                <TouchableOpacity
                    style={styles.createButton}
                    onPress={() => setShowCreateForm(true)}
                >
                    <SafeIcon name="plus" size={18} color="#fff" />
                    <Text style={styles.createButtonText}>Créer une audience</Text>
                </TouchableOpacity>
            )}

            {/* Formulaire de création */}
            {showCreateForm && (
                <View style={styles.createForm}>
                    <View style={styles.formHeader}>
                        <Text style={styles.formTitle}>Créer une audience</Text>
                        <TouchableOpacity onPress={() => {
                            setShowCreateForm(false);
                            setCreateType(null);
                            setNewAudienceName('');
                        }}>
                            <SafeIcon name="x" size={18} color={modernColors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {!createType ? (
                        <View style={styles.typeSelector}>
                            <TouchableOpacity
                                style={styles.typeCard}
                                onPress={() => setCreateType('lookalike')}
                            >
                                <SafeIcon name="users" size={24} color={modernColors.primary} />
                                <Text style={styles.typeTitle}>Lookalike</Text>
                                <Text style={styles.typeDescription}>
                                    Trouve des utilisateurs similaires à votre audience existante
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.typeCard}
                                onPress={() => setCreateType('custom')}
                            >
                                <SafeIcon name="upload" size={24} color={modernColors.primary} />
                                <Text style={styles.typeTitle}>Custom</Text>
                                <Text style={styles.typeDescription}>
                                    Importez vos propres listes (emails, téléphones, CSV)
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : createType === 'lookalike' ? (
                        <View style={styles.formContent}>
                            <NativeInput
                                placeholder="Nom de l'audience"
                                value={newAudienceName}
                                onChangeText={setNewAudienceName}
                                style={styles.input}
                            />
                            <Text style={styles.label}>Audience source (ID)</Text>
                            <NativeInput
                                placeholder="ID de l'audience source"
                                value={lookalikeSource}
                                onChangeText={setLookalikeSource}
                                style={styles.input}
                            />
                            <Text style={styles.label}>Similarité (1-10)</Text>
                            <View style={styles.similarityRow}>
                                {[1, 3, 5, 7, 10].map((val) => (
                                    <TouchableOpacity
                                        key={val}
                                        style={[
                                            styles.similarityButton,
                                            similarity === val && styles.similarityButtonActive,
                                        ]}
                                        onPress={() => setSimilarity(val)}
                                    >
                                        <Text style={[
                                            styles.similarityText,
                                            similarity === val && styles.similarityTextActive,
                                        ]}>
                                            {val}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Text style={styles.hint}>
                                Plus le nombre est élevé, plus l'audience est similaire (et plus petite)
                            </Text>
                            <View style={styles.formActions}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => {
                                        setCreateType(null);
                                        setNewAudienceName('');
                                    }}
                                >
                                    <Text style={styles.cancelButtonText}>Annuler</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.submitButton}
                                    onPress={handleCreateLookalike}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.submitButtonText}>Créer</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.formContent}>
                            <NativeInput
                                placeholder="Nom de l'audience"
                                value={newAudienceName}
                                onChangeText={setNewAudienceName}
                                style={styles.input}
                            />
                            <Text style={styles.label}>Source</Text>
                            <View style={styles.sourceSelector}>
                                {(['email', 'phone', 'csv'] as const).map((source) => (
                                    <TouchableOpacity
                                        key={source}
                                        style={[
                                            styles.sourceButton,
                                            customSource === source && styles.sourceButtonActive,
                                        ]}
                                        onPress={() => setCustomSource(source)}
                                    >
                                        <Text style={[
                                            styles.sourceText,
                                            customSource === source && styles.sourceTextActive,
                                        ]}>
                                            {source === 'email' ? '📧 Emails' : source === 'phone' ? '📱 Téléphones' : '📄 CSV'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {customSource !== 'csv' && (
                                <NativeInput
                                    placeholder={customSource === 'email' ? 'emails@exemple.com, ...' : '+237 6XX XX XX XX, ...'}
                                    value={customData}
                                    onChangeText={setCustomData}
                                    style={styles.input}
                                    multiline
                                    numberOfLines={4}
                                />
                            )}
                            {customSource === 'csv' && (
                                <TouchableOpacity
                                    style={styles.csvButton}
                                    onPress={async () => {
                                        try {
                                            const result = await DocumentPicker.getDocumentAsync({
                                                type: 'text/csv',
                                                copyToCacheDirectory: true,
                                            });
                                            if ((result as any).type === 'success') {
                                                Alert.alert('Info', `Fichier sélectionné: ${(result as any).name}`);
                                                // TODO: Lire et parser le CSV
                                            }
                                        } catch (error) {
                                            console.error('Erreur import CSV:', error);
                                        }
                                    }}
                                >
                                    <SafeIcon name="upload" size={18} color={modernColors.primary} />
                                    <Text style={styles.csvButtonText}>Importer un fichier CSV</Text>
                                </TouchableOpacity>
                            )}
                            <View style={styles.formActions}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => {
                                        setCreateType(null);
                                        setNewAudienceName('');
                                        setCustomData('');
                                    }}
                                >
                                    <Text style={styles.cancelButtonText}>Annuler</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.submitButton}
                                    onPress={handleCreateCustom}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.submitButtonText}>Créer</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            )}

            {/* Liste des audiences */}
            {!showCreateForm && (
                <View style={styles.audiencesList}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color={modernColors.primary} />
                        </View>
                    ) : audiences.length === 0 ? (
                        <View style={styles.emptyState}>
                            <SafeIcon name="users" size={48} color={modernColors.border} />
                            <Text style={styles.emptyText}>Aucune audience</Text>
                            <Text style={styles.emptySubtext}>
                                Créez votre première audience pour cibler précisément vos publicités
                            </Text>
                        </View>
                    ) : (
                        audiences.map((audience) => {
                            const isSelected = selectedAudiences.includes(audience.id);
                            return (
                                <TouchableOpacity
                                    key={audience.id}
                                    style={[
                                        styles.audienceCard,
                                        isSelected && styles.audienceCardSelected,
                                    ]}
                                    onPress={() => toggleAudience(audience.id)}
                                >
                                    <View style={styles.audienceHeader}>
                                        <View style={[
                                            styles.checkbox,
                                            isSelected && styles.checkboxChecked,
                                        ]}>
                                            {isSelected && (
                                                <SafeIcon name="check" size={14} color="#fff" />
                                            )}
                                        </View>
                                        <View style={styles.audienceInfo}>
                                            <Text style={styles.audienceName}>{audience.name}</Text>
                                            <View style={styles.audienceMeta}>
                                                <View style={styles.audienceBadge}>
                                                    <SafeIcon
                                                        name={audience.type === 'lookalike' ? 'users' : 'upload'}
                                                        size={12}
                                                        color={modernColors.primary}
                                                    />
                                                    <Text style={styles.audienceBadgeText}>
                                                        {audience.type === 'lookalike' ? 'Lookalike' : 'Custom'}
                                                    </Text>
                                                </View>
                                                <Text style={styles.audienceSize}>
                                                    {audience.size.toLocaleString()} personnes
                                                </Text>
                                            </View>
                                            {audience.type === 'lookalike' && audience.similarity && (
                                                <Text style={styles.similarityInfo}>
                                                    Similarité: {audience.similarity}/10
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    )}
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
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 14,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
        marginBottom: 16,
    },
    createButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    createForm: {
        padding: 16,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
        marginBottom: 16,
    },
    formHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    formTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    typeSelector: {
        gap: 12,
    },
    typeCard: {
        padding: 16,
        borderRadius: 12,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        alignItems: 'center',
    },
    typeTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        marginTop: 12,
        marginBottom: 4,
    },
    typeDescription: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    formContent: {
        gap: 12,
    },
    input: {
        width: '100%',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginTop: 8,
    },
    similarityRow: {
        flexDirection: 'row',
        gap: 8,
    },
    similarityButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
        alignItems: 'center',
    },
    similarityButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    similarityText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    similarityTextActive: {
        color: '#fff',
    },
    hint: {
        fontSize: 11,
        color: modernColors.textTertiary,
        fontStyle: 'italic',
    },
    sourceSelector: {
        flexDirection: 'row',
        gap: 8,
    },
    sourceButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
        alignItems: 'center',
    },
    sourceButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    sourceText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
    },
    sourceTextActive: {
        color: '#fff',
    },
    csvButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 14,
        borderRadius: 12,
        backgroundColor: modernColors.surface,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: modernColors.border,
    },
    csvButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    formActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    submitButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
    },
    submitButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    audiencesList: {
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyState: {
        alignItems: 'center',
        padding: 32,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginTop: 12,
    },
    emptySubtext: {
        fontSize: 13,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginTop: 4,
    },
    audienceCard: {
        padding: 14,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
        borderWidth: 1,
        borderColor: modernColors.border,
        marginBottom: 12,
    },
    audienceCardSelected: {
        borderColor: modernColors.primary,
        backgroundColor: '#EFF6FF',
    },
    audienceHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: modernColors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    checkboxChecked: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    audienceInfo: {
        flex: 1,
    },
    audienceName: {
        fontSize: 15,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 8,
    },
    audienceMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 4,
    },
    audienceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#EFF6FF',
    },
    audienceBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.primary,
    },
    audienceSize: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    similarityInfo: {
        fontSize: 11,
        color: modernColors.textTertiary,
        fontStyle: 'italic',
    },
});

