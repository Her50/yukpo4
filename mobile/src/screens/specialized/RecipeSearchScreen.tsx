// ✅ Écran de recherche de recettes
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { menuPlanningService } from '../../services/menuPlanningService';
import { modernColors } from '../../theme/modernTheme';

const RecipeSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [recipes, setRecipes] = useState<any[]>([]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            Alert.alert('Erreur', 'Veuillez saisir un nom de recette');
            return;
        }

        try {
            setLoading(true);
            setRecipes([]); // Réinitialiser les résultats précédents
            
            // ✅ AMÉLIORÉ: Ajouter un timeout explicite pour éviter les chargements infinis
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('La génération de la recette prend trop de temps. Veuillez réessayer.')), 95000); // 95s (légèrement inférieur au timeout API)
            });
            
            // Générer une recette avec l'IA
            const responsePromise = menuPlanningService.generateRecipe(searchQuery.trim());
            const response = await Promise.race([responsePromise, timeoutPromise]) as any;
            
            if (response && response.success && response.data?.recipe) {
                // Naviguer vers les détails de la recette
                navigation.navigate('RecipeDetails' as never, {
                    recipe: response.data.recipe,
                } as never);
            } else if (response && !response.success) {
                Alert.alert('Erreur', response.error || 'Impossible de générer la recette');
            } else {
                Alert.alert('Erreur', 'Réponse invalide du serveur');
            }
        } catch (error: any) {
            console.error('[RecipeSearch] Erreur:', error);
            
            // ✅ AMÉLIORÉ: Messages d'erreur plus spécifiques
            let errorMessage = 'Une erreur est survenue';
            if (error.message) {
                errorMessage = error.message;
            } else if (error.error) {
                errorMessage = error.error;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }
            
            // Vérifier si c'est un timeout
            if (errorMessage.includes('temps') || errorMessage.includes('timeout') || error.code === 'ABORT_ERR') {
                errorMessage = 'La génération prend trop de temps. Veuillez réessayer avec un nom de recette plus simple.';
            }
            
            Alert.alert('Erreur', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickSearch = (recipeName: string) => {
        setSearchQuery(recipeName);
        // Déclencher la recherche automatiquement
        setTimeout(() => {
            handleSearch();
        }, 100);
    };

    const quickRecipes = [
        'Poulet DG',
        'Ndolé',
        'Sauce arachide',
        'Riz sauté',
        'Poulet braisé',
        'Poisson braisé',
        'Okok',
        'Eru',
    ];

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Recherche de Recettes</Text>
            </View>

            <View style={styles.form}>
                <NativeCard style={styles.searchCard}>
                    <Text style={styles.label}>🔍 Rechercher une recette</Text>
                    <View style={styles.searchContainer}>
                        <TextInput
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Ex: Poulet DG, Ndolé, Riz sauté..."
                            onSubmitEditing={handleSearch}
                            returnKeyType="search"
                        />
                        <NativeButton
                            title="Rechercher"
                            onPress={handleSearch}
                            loading={loading}
                            variant="primary"
                            size="small"
                            style={styles.searchButton}
                        />
                    </View>
                </NativeCard>

                <NativeCard style={styles.quickCard}>
                    <Text style={styles.label}>⚡ Recettes populaires</Text>
                    <View style={styles.quickRecipesContainer}>
                        {quickRecipes.map((recipe) => (
                            <TouchableOpacity
                                key={recipe}
                                style={styles.quickRecipeChip}
                                onPress={() => handleQuickSearch(recipe)}
                            >
                                <SafeIcon name="ChefHat" size={16} color={modernColors.primary} type="lucide" />
                                <Text style={styles.quickRecipeText}>{recipe}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </NativeCard>

                {loading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={modernColors.primary} />
                        <Text style={styles.loadingText}>Génération de la recette en cours...</Text>
                        <Text style={styles.loadingSubtext}>Cela peut prendre jusqu'à 90 secondes</Text>
                    </View>
                )}

                <NativeCard style={styles.infoCard}>
                    <SafeIcon name="Info" size={24} color={modernColors.primary} type="lucide" />
                    <Text style={styles.infoText}>
                        Notre IA génère des recettes complètes et détaillées selon vos préférences et votre profil famille.
                    </Text>
                </NativeCard>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    scrollContent: {
        paddingBottom: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    form: {
        padding: 16,
    },
    searchCard: {
        marginBottom: 16,
        padding: 16,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    searchContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    searchInput: {
        flex: 1,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        fontSize: 16,
    },
    searchButton: {
        minWidth: 100,
    },
    quickCard: {
        marginBottom: 16,
        padding: 16,
    },
    quickRecipesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    quickRecipeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    quickRecipeText: {
        fontSize: 14,
        color: '#111827',
        fontWeight: '500',
    },
    loadingContainer: {
        alignItems: 'center',
        padding: 24,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: modernColors.textSecondary,
        fontWeight: '600',
    },
    loadingSubtext: {
        marginTop: 4,
        fontSize: 12,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        padding: 16,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    infoText: {
        flex: 1,
        fontSize: 14,
        color: '#1E40AF',
        lineHeight: 20,
    },
});

export default RecipeSearchScreen;

