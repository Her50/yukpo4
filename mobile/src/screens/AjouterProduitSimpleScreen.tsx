// @ts-nocheck
/**
 * AjouterProduitSimpleScreen - Formulaire simple pour ajouter un produit à un service existant
 * Affiche UNIQUEMENT les champs produit, pas le formulaire complet
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import LinearAutocompleteEditor from '../components/LinearAutocompleteEditor';
import LocationSelector from '../components/LocationSelector';
import MediaUploadManager from '../components/MediaUploadManager';
import { NativeButton, NativeCard, NativeInput } from '../components/NativeDesign';
import PriceVariantSelector from '../components/PriceVariantSelector';
import SafeIcon from '../components/SafeIcon';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';

const AjouterProduitSimpleScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();

    // Récupérer les paramètres
    const { serviceId, suggestionIA } = (route.params as any) || {};

    const [loading, setLoading] = useState(false);
    
    // ✅ FONCTION HELPER: Extraire valeur avec fallback intelligent (IDENTIQUE AU GRAND FORMULAIRE)
    const extractValue = (field: any): any => {
        if (!field) return null;
        // Si c'est un objet avec propriété 'valeur', extraire la valeur
        if (typeof field === 'object' && 'valeur' in field) {
            return field.valeur;
        }
        // Sinon retourner tel quel
        return field;
    };

    // ✅ Extraire données depuis suggestionIA avec fallbacks intelligents (IDENTIQUE AU GRAND FORMULAIRE)
    const suggestionData = suggestionIA?.data || suggestionIA || {};
    
    const typeOffre = extractValue(suggestionData.type_offre) || 'produit';
    const isPrestation = typeOffre === 'prestation' || typeOffre === 'service';

    // ✅ Détecter si l'IA a généré des données produit
    const hasProductData = suggestionData.nom_produit || suggestionData.prix_produit || suggestionData.produits || suggestionData.variabilite_prix;

    // ✅ Nom produit avec fallback sur titre_service
    let nom_produit = extractValue(suggestionData.nom_produit) || '';
    if (!nom_produit && hasProductData && suggestionData.titre_service) {
        nom_produit = extractValue(suggestionData.titre_service);
        console.log('[AjouterProduitSimple] ✅ nom_produit fallback depuis titre_service:', nom_produit);
    }

    // ✅ Catégorie produit avec fallback sur category
    let categorie_produit = extractValue(suggestionData.categorie_produit) || '';
    if (!categorie_produit && hasProductData && suggestionData.category) {
        categorie_produit = extractValue(suggestionData.category);
        console.log('[AjouterProduitSimple] ✅ categorie_produit fallback depuis category:', categorie_produit);
    }

    // ✅ Description produit avec fallback sur description
    let description_produit = extractValue(suggestionData.description_produit) || '';
    if (!description_produit && hasProductData && suggestionData.description) {
        description_produit = extractValue(suggestionData.description);
        console.log('[AjouterProduitSimple] ✅ description_produit fallback depuis description:', description_produit);
    }

    // ✅ Prix et devise
    const prix_produit = extractValue(suggestionData.prix_produit) || extractValue(suggestionData.prix) || '';
    const devise_produit = extractValue(suggestionData.devise_produit) || extractValue(suggestionData.devise) || 'XAF';

    // ✅ Variabilité de prix
    const variabilite_prix = extractValue(suggestionData.variabilite_prix) || extractValue(suggestionData.variation_prix) || extractValue(suggestionData.price_variant) || null;

    // ✅ Caractéristiques autocomplete (avec sous_caracteristiques)
    const produits = extractValue(suggestionData.produits) || [];
    const sous_caracteristiques = suggestionData.produits?.sous_caracteristiques || null;

    // ✅ Lieu produit
    const lieu_produit = extractValue(suggestionData.lieu_produit) || extractValue(suggestionData.lieu_commercial) || extractValue(suggestionData.lieu_commercialisation) || null;

    console.log('[AjouterProduitSimple] 📦 Données chargées depuis IA:', {
        nom_produit,
        categorie_produit,
        description_produit,
        prix_produit,
        devise_produit,
        variabilite_prix: variabilite_prix ? 'OUI' : 'NON',
        produits: produits.length || 0,
        lieu_produit: lieu_produit ? 'OUI' : 'NON'
    });

    const [formValues, setFormValues] = useState<any>({
        nom_produit,
        categorie_produit,
        description_produit,
        prix_produit,
        devise_produit,
        variabilite_prix,
        produits,
        sous_caracteristiques,
        lieu_produit,
        images: [],
        videos: []
    });

    // Gérer changement de champ
    const handleFieldChange = (fieldName: string, value: any) => {
        setFormValues((prev: any) => ({
            ...prev,
            [fieldName]: value
        }));
    };

    // ✅ Soumettre le nouveau produit - IDENTIQUE AU GRAND FORMULAIRE
    const handleSubmit = async () => {
        // Validation minimale
        if (!formValues.nom_produit || !formValues.nom_produit.trim()) {
            Alert.alert('Erreur', 'Le nom du produit est obligatoire');
            return;
        }

        if (!formValues.lieu_produit) {
            Alert.alert('Erreur', 'Le lieu de commercialisation est obligatoire');
            return;
        }

        setLoading(true);

        try {
            // ✅ ÉTAPE 1 : Construire les données COMPLÈTES du nouveau produit (IDENTIQUE AU GRAND FORMULAIRE)
            const nouveauProduit: any = {};

            // ✅ Liste complète des champs produits à extraire (IDENTIQUE AU GRAND FORMULAIRE)
            const PRODUCT_FIELDS = [
                'nom_produit',
                'categorie_produit',
                'description_produit',
                'produits',  // Autocomplete caractéristiques
                'prix',
                'prix_produit',
                'devise',
                'devise_produit',
                'lieu_produit',
                'lieu_commercial',
                'lieu_commercialisation',
                'price_variant',   // ✅ Variations de prix
                'variabilite_prix', // Alias de price_variant
                'product_labels',   // ✅ Labels/tags
                'images',           // ✅ Images produit
                'videos',           // ✅ Vidéos produit
                'audios',           // Éventuellement
                'documents'         // Éventuellement
            ];

            PRODUCT_FIELDS.forEach(key => {
                const value = formValues[key];
                if (value !== undefined && value !== null && value !== '') {
                    nouveauProduit[key] = value;
                }
            });

            console.log('[AjouterProduitSimple] 📦 Données du nouveau produit (complètes):', {
                ...nouveauProduit,
                images: nouveauProduit.images ? `${nouveauProduit.images.length} image(s)` : 'aucune',
                videos: nouveauProduit.videos ? `${nouveauProduit.videos.length} vidéo(s)` : 'aucune'
            });

            // ✅ ÉTAPE 2 : Vérifier le solde (coût fixe : 3000 FCFA pour ajout produit - IDENTIQUE AU GRAND FORMULAIRE)
            const COUT_AJOUT_PRODUIT = 3000;

            console.log('💰 [AjouterProduitSimple] Vérification du solde pour ajout produit...');
            const balanceResponse = await apiGet<{ tokens_balance: number }>('/api/users/balance');

            if (!balanceResponse.success) {
                const errorMsg = balanceResponse.error || 'Impossible de vérifier votre solde';
                console.error('💰 [AjouterProduitSimple] ❌ Erreur vérification solde:', errorMsg);
                throw new Error(errorMsg);
            }

            if (!balanceResponse.data || typeof balanceResponse.data.tokens_balance === 'undefined') {
                console.error('💰 [AjouterProduitSimple] ❌ Données solde invalides:', balanceResponse.data);
                throw new Error('Données de solde invalides reçues du serveur');
            }

            const soldeActuel = balanceResponse.data.tokens_balance || 0;
            console.log('💰 [AjouterProduitSimple] ✅ Solde actuel récupéré:', soldeActuel);

            // Vérifier si le solde est suffisant
            if (soldeActuel < COUT_AJOUT_PRODUIT) {
                Alert.alert(
                    '💸 Solde insuffisant',
                    `Coût d'ajout de produit : ${COUT_AJOUT_PRODUIT.toLocaleString()} FCFA\nVotre solde : ${soldeActuel.toLocaleString()} FCFA\n\nVeuillez recharger votre compte pour ajouter ce produit.`,
                    [{ text: 'OK' }]
                );
                setLoading(false);
                return;
            }

            // ✅ ÉTAPE 3 : Demander confirmation avec affichage du coût (IDENTIQUE AU GRAND FORMULAIRE)
            Alert.alert(
                '💰 Ajout de produit',
                `Coût : ${COUT_AJOUT_PRODUIT.toLocaleString()} FCFA\nVotre solde : ${soldeActuel.toLocaleString()} FCFA\nSolde après ajout : ${(soldeActuel - COUT_AJOUT_PRODUIT).toLocaleString()} FCFA\n\nConfirmez-vous l'ajout de ce produit à votre service ?`,
                [
                    {
                        text: 'Annuler',
                        style: 'cancel',
                        onPress: () => setLoading(false)
                    },
                    {
                        text: 'Confirmer',
                        onPress: async () => {
                            try {
                                // ✅ ÉTAPE 4 : Appeler /api/services/{serviceId}/products (IDENTIQUE AU GRAND FORMULAIRE)
                                const userId = parseInt(user?.id || '0', 10);
                                const response = await apiPost(`/api/services/${serviceId}/products`, {
                                    user_id: userId,
                                    product_data: nouveauProduit
                                });

                                if (!response.success) {
                                    throw new Error(response.error || 'Erreur lors de l\'ajout du produit');
                                }

                                console.log('[AjouterProduitSimple] ✅ Produit ajouté avec succès:', response);

                                // ✅ ÉTAPE 5 : Afficher le résultat (IDENTIQUE AU GRAND FORMULAIRE)
                                Alert.alert(
                                    '✅ Produit créé',
                                    `Votre nouveau produit a été ajouté au service avec succès !\n\n💰 Coût: ${response.cost || COUT_AJOUT_PRODUIT} FCFA\n💳 Nouveau solde: ${response.new_balance?.toLocaleString() || (soldeActuel - COUT_AJOUT_PRODUIT).toLocaleString()} FCFA\n📦 Index produit: ${response.product_index}`,
                                    [
                                        {
                                            text: 'OK',
                                            onPress: () => {
                                                // Retour vers gestion des services
                                                navigation.goBack();
                                            }
                                        }
                                    ]
                                );
                            } catch (error: any) {
                                console.error('[AjouterProduitSimple] Erreur:', error);
                                Alert.alert('Erreur', error.message || 'Impossible d\'ajouter le produit');
                            } finally {
                                setLoading(false);
                            }
                        }
                    }
                ]
            );
        } catch (error: any) {
            console.error('[AjouterProduitSimple] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible d\'ajouter le produit');
            setLoading(false);
        }
    };

    return (
        <LinearGradient
            colors={[modernColors.background, '#F3F4F6']}
            style={styles.container}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.keyboardView}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Ajouter un produit</Text>
                    <View style={styles.headerRight} />
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Carte principale */}
                    <NativeCard style={styles.mainCard}>
                        <View style={styles.iconHeader}>
                            <SafeIcon name="package-plus" size={32} color={modernColors.primary} />
                            <Text style={styles.subtitle}>
                                Ajoutez un nouveau produit à votre service existant
                            </Text>
                        </View>

                        {/* Nom du produit/prestation */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>
                                {isPrestation ? 'Nom de la prestation' : 'Nom du produit'}
                            </Text>
                            <NativeInput
                                placeholder={isPrestation
                                    ? 'Ex: Cours de maths niveau terminal, Réparation écran téléphone...'
                                    : 'Ex: iPhone 14 Pro Max 256GB, Toyota RAV4 2018 4x4...'
                                }
                                value={formValues.nom_produit}
                                onChangeText={(value) => handleFieldChange('nom_produit', value)}
                            />
                        </View>

                        {/* Catégorie */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Catégorie du produit/prestation</Text>
                            <NativeInput
                                placeholder="Ex: Smartphone, Cours particulier, Service de réparation..."
                                value={formValues.categorie_produit}
                                onChangeText={(value) => handleFieldChange('categorie_produit', value)}
                            />
                        </View>

                        {/* Description */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Description du produit/prestation</Text>
                            <NativeInput
                                placeholder="Décrivez les caractéristiques spécifiques du produit/prestation..."
                                value={formValues.description_produit}
                                onChangeText={(value) => handleFieldChange('description_produit', value)}
                                multiline
                            />
                        </View>

                        {/* Caractéristiques (Autocomplete) - IDENTIQUE AU GRAND FORMULAIRE */}
                        <View style={styles.fieldGroup}>
                            <LinearAutocompleteEditor
                                label={isPrestation ? 'Caractéristiques prestation' : 'Caractéristiques produit'}
                                identifiantBase="produits"
                                value={formValues.produits || []}
                                onChange={(value) => handleFieldChange('produits', value)}
                                sousCaracteristiques={formValues.sous_caracteristiques || {
                                    // Caractéristiques essentielles
                                    marque: [],
                                    modele: [],
                                    couleur: ['Noir', 'Blanc', 'Gris', 'Rouge', 'Bleu', 'Vert', 'Jaune', 'Orange', 'Rose', 'Violet'],

                                    // Caractéristiques secondaires
                                    annee: ['2024', '2023', '2022', '2021', '2020', '2019', '2018'],
                                    etat: ['Neuf', 'Comme neuf', 'Bon état', 'Très bon état', 'Occasion', 'À rénover'],
                                    version: [],

                                    // Caractéristiques prestations
                                    competences: [],
                                    experience: ['Débutant', 'Intermédiaire', 'Avancé', 'Expert', 'Professionnel'],
                                    niveau: ['Débutant', 'Intermédiaire', 'Avancé', 'Expert', 'Professionnel']
                                }}
                                separateur=","
                                allowCustomModality={true}
                                placeholder="Tapez pour voir les suggestions..."
                                filtrable={true}
                            />
                        </View>

                        {/* Prix simple OU Variabilité de prix (comme dans le grand formulaire) */}
                        {!formValues.variabilite_prix && (
                            <>
                                <View style={styles.fieldGroup}>
                                    <Text style={styles.label}>Prix du produit/prestation</Text>
                                    <NativeInput
                                        placeholder="Ex: 150000"
                                        value={formValues.prix_produit}
                                        onChangeText={(value) => handleFieldChange('prix_produit', value)}
                                        keyboardType="numeric"
                                    />
                                </View>

                                <View style={styles.fieldGroup}>
                                    <Text style={styles.label}>Devise</Text>
                                    <View style={styles.pickerContainer}>
                                        {/* Simuler un select avec boutons */}
                                        <View style={styles.deviseButtons}>
                                            {['XAF', 'EUR', 'USD', 'GBP', 'CAD', 'CHF'].map((devise) => (
                                                <TouchableOpacity
                                                    key={devise}
                                                    style={[
                                                        styles.deviseButton,
                                                        formValues.devise_produit === devise && styles.deviseButtonActive
                                                    ]}
                                                    onPress={() => handleFieldChange('devise_produit', devise)}
                                                >
                                                    <Text style={[
                                                        styles.deviseButtonText,
                                                        formValues.devise_produit === devise && styles.deviseButtonTextActive
                                                    ]}>
                                                        {devise}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                </View>
                            </>
                        )}

                        {/* Lieu */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Lieu de commercialisation *</Text>
                            <LocationSelector
                                value={formValues.lieu_produit}
                                onChange={(value) => handleFieldChange('lieu_produit', value)}
                                placeholder="Ville, quartier, pays..."
                                enrichWithBackend={true}
                            />
                        </View>

                        {/* Variabilité de prix */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Variabilité de prix (optionnel)</Text>
                            <PriceVariantSelector
                                value={formValues.variabilite_prix}
                                onChange={(value) => handleFieldChange('variabilite_prix', value)}
                                defaultCurrency={formValues.devise_produit || 'XAF'}
                            />
                        </View>

                        {/* Photos et vidéos */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Photos et vidéos</Text>
                            <MediaUploadManager
                                serviceId={serviceId}
                                productId={null}
                                onImagesChange={(images) => handleFieldChange('images', images)}
                                onVideosChange={(videos) => handleFieldChange('videos', videos)}
                                maxImages={5}
                                maxVideos={2}
                            />
                        </View>

                        {/* Bouton de soumission */}
                        <NativeButton
                            title={loading ? 'Ajout en cours...' : 'Ajouter le produit'}
                            onPress={handleSubmit}
                            disabled={loading}
                            variant="primary"
                            style={styles.submitButton}
                        />

                        {/* Coût */}
                        <View style={styles.costInfo}>
                            <SafeIcon name="info" size={16} color={modernColors.textSecondary} />
                            <Text style={styles.costText}>
                                Coût: 3000 FCFA (Solde: {user?.credits || 0} FCFA)
                            </Text>
                        </View>
                    </NativeCard>
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    headerRight: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    mainCard: {
        marginBottom: 20,
    },
    iconHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    subtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginTop: 8,
    },
    fieldGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    submitButton: {
        marginTop: 24,
    },
    costInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        gap: 6,
    },
    costText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    pickerContainer: {
        marginTop: 4,
    },
    deviseButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    deviseButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    deviseButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    deviseButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    deviseButtonTextActive: {
        color: '#FFFFFF',
    },
});

export default AjouterProduitSimpleScreen;

