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
    DeviceEventEmitter,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import LinearAutocompleteEditor from '../components/LinearAutocompleteEditor';
import LocationSelector from '../components/LocationSelector';
import MediaUploadManager from '../components/MediaUploadManager';
import { NativeButton, NativeCard, NativeInput } from '../components/NativeDesign';
import NavigatorToolbar from '../components/NavigatorToolbar';
import PriceVariantSelector from '../components/PriceVariantSelector';
import SafeIcon from '../components/SafeIcon';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPatch, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { MAX_PRODUCT_IMAGES, mergeImageSources, orderImagesWithPrimary } from '../utils/mediaHelpers';
import { applyPriceVariantToProduits, extractPriceVariant } from '../utils/priceVariant';

const AjouterProduitSimpleScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();

    // Récupérer les paramètres
    const params = (route.params as any) || {};
    const { serviceId, suggestionIA } = params;
    const mediaData = params.mediaData || {};
    const mode = params.mode || 'create';
    const isEditing = mode === 'edit';
    const isDuplicate = mode === 'duplicate';
    const productId = typeof params.productId !== 'undefined' ? parseInt(String(params.productId), 10) : null;
    const productIndex = typeof params.productIndex === 'number'
        ? params.productIndex
        : params.productIndex !== undefined
            ? parseInt(String(params.productIndex), 10)
            : null;
    const prefill = params.prefill || {};

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

    // ✅ FONCTION HELPER: Extraire devise depuis variante de prix (DOIT être définie avant utilisation)
    const getCurrencyFromVariant = (variant: any): string | undefined => {
        if (!variant) {
            return undefined;
        }

        const modalitesSource = Array.isArray(variant?.modalites)
            ? variant.modalites
            : Array.isArray(variant)
                ? variant
                : Array.isArray(variant?.valeur?.modalites)
                    ? variant.valeur.modalites
                    : [];

        for (const entry of modalitesSource) {
            if (!entry || typeof entry !== 'object') {
                continue;
            }

            const currencyRaw = typeof entry.devise === 'string' && entry.devise.trim().length > 0
                ? entry.devise.trim()
                : typeof entry.currency === 'string' && entry.currency.trim().length > 0
                    ? entry.currency.trim()
                    : undefined;

            if (currencyRaw) {
                return currencyRaw.toUpperCase();
            }
        }

        return undefined;
    };

    // ✅ Extraire données depuis suggestionIA avec fallbacks intelligents (IDENTIQUE AU GRAND FORMULAIRE)
    const suggestionData = suggestionIA?.data || suggestionIA || {};

    const normalizeMediaList = (value: any): any[] => {
        if (!value) {
            return [];
        }

        if (Array.isArray(value)) {
            return value.filter((item) => item !== null && item !== undefined);
        }

        return [value];
    };

    const combineUnique = (...lists: any[][]): any[] => {
        const combined: any[] = [];
        lists.flat().forEach((item) => {
            if (item !== null && item !== undefined && !combined.includes(item)) {
                combined.push(item);
            }
        });
        return combined;
    };

    const normalizeToStringArray = (value: any): string[] => {
        if (!value) {
            return [];
        }

        if (Array.isArray(value)) {
            return value
                .map((item) => (typeof item === 'string' ? item : String(item)))
                .filter((item) => item && item.trim().length > 0);
        }

        if (typeof value === 'string') {
            return [value];
        }

        return [String(value)];
    };

    const prefilledImages = normalizeMediaList(prefill.images);
    const prefilledVideos = normalizeMediaList(prefill.videos);
    const prefilledAudios = normalizeMediaList(prefill.audios);
    const prefilledDocuments = normalizeMediaList(prefill.documents);

    const mergedImageSources = mergeImageSources(
        MAX_PRODUCT_IMAGES,
        mediaData?.base64_image,
        mediaData?.image_base64,
        suggestionData?.base64_image,
        suggestionData?.images,
        suggestionIA?.service_data?.base64_image
    );

    const initialProductImages = prefilledImages.length > 0 ? prefilledImages : mergedImageSources;

    const mergedVideos = combineUnique(
        prefilledVideos,
        normalizeMediaList(mediaData?.video_base64),
        normalizeMediaList(mediaData?.videos),
        normalizeMediaList(suggestionData?.videos)
    );
    const initialProductVideos = mergedVideos;

    const initialProductAudios = combineUnique(
        prefilledAudios,
        normalizeMediaList(mediaData?.audio_base64),
        normalizeMediaList(suggestionData?.audios)
    );

    const initialProductDocuments = combineUnique(
        prefilledDocuments,
        normalizeMediaList(mediaData?.doc_base64),
        normalizeMediaList(suggestionData?.documents)
    );

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

    // ✅ Variabilité de prix (normalisée, y compris si imbriquée dans produits)
    const iaPriceVariant =
        extractPriceVariant(suggestionData.variabilite_prix) ||
        extractPriceVariant(suggestionData.variation_prix) ||
        extractPriceVariant(suggestionData.price_variant) ||
        extractPriceVariant(suggestionData.produits);
    const prefillPriceVariant =
        extractPriceVariant(prefill.variabilite_prix || prefill.price_variant) ||
        extractPriceVariant(prefill.produits);

    // ✅ Caractéristiques autocomplete (avec sous_caracteristiques)
    // ✅ CORRECTION: Extraire produits correctement même si c'est un objet avec valeur
    let produits = null;
    if (suggestionData.produits) {
        if (typeof suggestionData.produits === 'object' && 'valeur' in suggestionData.produits) {
            produits = suggestionData.produits.valeur;
        } else {
            produits = suggestionData.produits;
        }
    }
    const suggestionProduits = normalizeToStringArray(produits || []);

    // ✅ CORRECTION: Extraire prefill.produits correctement même si c'est un objet avec valeur
    let prefillProduitsValue = null;
    if (prefill.produits) {
        if (typeof prefill.produits === 'object' && 'valeur' in prefill.produits) {
            prefillProduitsValue = prefill.produits.valeur;
        } else {
            prefillProduitsValue = prefill.produits;
        }
    }
    const prefillProduits = normalizeToStringArray(prefillProduitsValue || []);

    const sous_caracteristiques = suggestionData.produits?.sous_caracteristiques || prefill.sous_caracteristiques || null;

    // ✅ Lieu produit
    const lieu_produit = extractValue(suggestionData.lieu_produit) || extractValue(suggestionData.lieu_commercial) || extractValue(suggestionData.lieu_commercialisation) || null;

    console.log('[AjouterProduitSimple] 📦 Données chargées depuis IA:', {
        nom_produit,
        categorie_produit,
        description_produit,
        prix_produit,
        devise_produit,
        variabilite_prix: iaPriceVariant ? 'OUI' : 'NON',
        produits: (produits && Array.isArray(produits) ? produits.length : 0) || (Array.isArray(suggestionProduits) ? suggestionProduits.length : 0),
        lieu_produit: lieu_produit ? 'OUI' : 'NON'
    });

    const [primaryProductImage, setPrimaryProductImage] = useState<string | null>(initialProductImages[0] || null);

    const initialPriceVariant = prefillPriceVariant || iaPriceVariant || null;
    const variantCurrency = getCurrencyFromVariant(initialPriceVariant);

    const initialCurrency = (
        (typeof prefill.devise_produit === 'string' && prefill.devise_produit.trim().length > 0
            ? prefill.devise_produit.trim().toUpperCase()
            : undefined) ||
        (typeof devise_produit === 'string' && devise_produit.trim().length > 0
            ? String(devise_produit).trim().toUpperCase()
            : undefined) ||
        variantCurrency ||
        'XAF'
    );

    const initialFormValues = {
        nom_produit: prefill.nom_produit ?? nom_produit,
        categorie_produit: prefill.categorie_produit ?? categorie_produit,
        description_produit: prefill.description_produit ?? description_produit,
        prix_produit: prefill.prix_produit ?? prix_produit,
        devise_produit: initialCurrency,
        variabilite_prix: initialPriceVariant,
        price_variant: initialPriceVariant,
        // ✅ CORRECTION: S'assurer que produits est toujours un tableau de strings pour LinearAutocompleteEditor
        produits: prefillProduits.length > 0 ? prefillProduits : suggestionProduits,
        sous_caracteristiques: prefill.sous_caracteristiques ?? sous_caracteristiques,
        lieu_produit: prefill.lieu_produit ?? lieu_produit,
        images: initialProductImages,
        videos: initialProductVideos,
        audios: initialProductAudios,
        documents: initialProductDocuments,
        characteristic_vector: prefill.characteristic_vector ?? suggestionData?.characteristic_vector ?? null,
        combinaison_brute: prefill.combinaison_brute ?? suggestionData?.combinaison_brute ?? null,
        // ✅ NOUVEAU: Initialiser product_vector et product_labels depuis suggestionData si disponibles
        product_vector: prefill.product_vector ?? (suggestionData.produits?.product_vector && Array.isArray(suggestionData.produits.product_vector) ? suggestionData.produits.product_vector : undefined),
        product_labels: prefill.product_labels ?? (suggestionData.produits?.product_labels && Array.isArray(suggestionData.produits.product_labels) ? suggestionData.produits.product_labels : undefined),
    };

    const [formValues, setFormValues] = useState<any>(initialFormValues);

    // ✅ NOUVEAU 2025-11-21: Charger les combinaisons préférées par l'IA via session_id
    React.useEffect(() => {
        const loadAIPreferredCombinations = async () => {
            // Vérifier si on a un session_id et que produits n'est pas déjà rempli
            const sessionId = suggestionIA?.session_id || suggestionIA?.data?.session_id;
            if (sessionId && (!formValues.produits || formValues.produits.length === 0)) {
                try {
                    const combinationsResponse = await apiGet(`/api/combinations/session/${sessionId}`);
                    if (combinationsResponse?.combinations && Array.isArray(combinationsResponse.combinations)) {
                        // Trouver la combinaison préférée par l'IA (is_ai_preferred = true)
                        const preferred = combinationsResponse.combinations.find((c: any) => c.is_ai_preferred);

                        if (preferred && preferred.product_vector && Array.isArray(preferred.product_vector) && preferred.product_vector.length > 0) {
                            // Construire la valeur au format attendu (string concaténée avec séparateur)
                            const separateur = preferred.separateur || ',';
                            const combinationString = preferred.product_vector.join(separateur);

                            // ✅ CORRECTION: Convertir product_labels (tableau) en objet pour sous_caracteristiques
                            // product_labels est un tableau qui correspond à l'ordre de product_vector
                            // On doit le convertir en objet { dimension: [valeurs] } pour sous_caracteristiques
                            const sousCaracsObj: Record<string, string[]> = {};
                            if (Array.isArray(preferred.product_labels) && preferred.product_labels.length > 0) {
                                // Grouper les labels par dimension
                                preferred.product_vector.forEach((value: string, index: number) => {
                                    const label = preferred.product_labels[index];
                                    if (label && typeof label === 'string') {
                                        if (!sousCaracsObj[label]) {
                                            sousCaracsObj[label] = [];
                                        }
                                        if (!sousCaracsObj[label].includes(value)) {
                                            sousCaracsObj[label].push(value);
                                        }
                                    }
                                });
                            }

                            // Mettre à jour formValues avec la combinaison préférée
                            setFormValues((prev: any) => ({
                                ...prev,
                                produits: [combinationString],
                                sous_caracteristiques: Object.keys(sousCaracsObj).length > 0 ? sousCaracsObj : (preferred.product_labels || prev.sous_caracteristiques || {}),
                                // ✅ NOUVEAU: Stocker product_vector et product_labels (tableaux) pour l'ordre correct
                                product_vector: preferred.product_vector,
                                product_labels: preferred.product_labels || []
                            }));

                            console.log('[AjouterProduitSimple] ✅ Combinaison préférée IA chargée:', {
                                combinationString,
                                product_vector: preferred.product_vector,
                                product_labels: preferred.product_labels,
                                sous_caracteristiques: Object.keys(sousCaracsObj).length > 0 ? Object.keys(sousCaracsObj) : Object.keys(preferred.product_labels || {})
                            });
                        }
                    }
                } catch (error) {
                    console.warn('[AjouterProduitSimple] ⚠️ Erreur chargement combinaisons IA:', error);
                    // Ne pas bloquer le formulaire si l'API échoue
                }
            }
        };

        loadAIPreferredCombinations();
    }, [suggestionIA?.session_id, suggestionIA?.data?.session_id]);

    const currentModalites = Array.isArray(formValues.variabilite_prix?.modalites)
        ? formValues.variabilite_prix.modalites
        : Array.isArray(formValues.variabilite_prix)
            ? formValues.variabilite_prix
            : [];
    const hasExistingVariants = currentModalites.length > 0;
    const variantCurrencyCurrent = getCurrencyFromVariant(formValues.variabilite_prix || formValues.price_variant || initialPriceVariant);
    const modaliteCurrencies = currentModalites
        .map((mod: any) => {
            if (!mod || typeof mod !== 'object') {
                return undefined;
            }
            if (typeof mod.devise === 'string' && mod.devise.trim().length > 0) {
                return mod.devise.trim().toUpperCase();
            }
            if (typeof mod.currency === 'string' && mod.currency.trim().length > 0) {
                return mod.currency.trim().toUpperCase();
            }
            return undefined;
        })
        .filter((currency?: string) => Boolean(currency)) as string[];

    const defaultCurrencyPool = [
        'XAF', 'XOF', 'USD', 'EUR', 'NGN', 'GHS', 'KES', 'TZS', 'UGX', 'RWF', 'BIF', 'CDF', 'ZMW', 'ZAR',
        'MAD', 'DZD', 'TND', 'EGP', 'LYD', 'MUR', 'MGA', 'MZN', 'AOA', 'SCR', 'KMF', 'SOS', 'SDG', 'SSP',
        'DJF', 'MRU', 'ERN', 'STN'
    ];

    const availableVariantCurrencies = Array.from(
        new Set(
            [
                ...modaliteCurrencies,
                variantCurrencyCurrent,
                initialCurrency,
                ...defaultCurrencyPool
            ]
                .filter((currency): currency is string => Boolean(currency))
                .map((currency) => currency.toUpperCase())
        )
    );

    const toolbarTitle = isEditing
        ? 'Modifier un produit'
        : isDuplicate
            ? 'Dupliquer un produit'
            : 'Ajouter un produit';

    const toolbarSubtitle = isEditing
        ? 'Actualisez les informations de votre produit ou prestation'
        : isDuplicate
            ? 'Toutes les données sont préremplies, ajustez-les avant duplication'
            : (isPrestation ? 'Formulaire prestation' : 'Formulaire produit');

    const heroDescription = isEditing
        ? 'Mettez à jour chaque champ du produit, y compris les médias.'
        : isDuplicate
            ? 'Une copie complète a été générée. Personnalisez-la avant validation.'
            : 'Ajoutez un nouveau produit à votre service existant.';

    const submitLabel = loading
        ? (isEditing ? '⏳ Mise à jour...' : isDuplicate ? '⏳ Duplication...' : '⏳ Ajout en cours...')
        : (isEditing ? 'Enregistrer les modifications' : isDuplicate ? 'Dupliquer le produit' : 'Ajouter le produit');

    // Gérer changement de champ
    const handleFieldChange = (fieldName: string, value: any) => {
        if (fieldName === 'produits') {
            setFormValues((prev: any) => {
                const normalizedPriceVariant = extractPriceVariant(
                    value,
                    value?.origine_champs || prev?.produits?.origine_champs
                );

                const nextState: Record<string, any> = {
                    ...prev
                };

                if (normalizedPriceVariant) {
                    nextState.variabilite_prix = normalizedPriceVariant;
                    nextState.price_variant = normalizedPriceVariant;
                    nextState.produits = applyPriceVariantToProduits(value, normalizedPriceVariant);
                    const inferredCurrency = getCurrencyFromVariant(normalizedPriceVariant);
                    if (inferredCurrency) {
                        nextState.devise_produit = inferredCurrency;
                        nextState.devise = inferredCurrency;
                    }
                } else {
                    nextState.produits = applyPriceVariantToProduits(
                        value,
                        prev.variabilite_prix ? extractPriceVariant(prev.variabilite_prix) : null
                    );

                    if (!nextState.produits?.variation_prix && !nextState.produits?.variabilite_prix) {
                        delete nextState.variabilite_prix;
                        delete nextState.price_variant;
                    }
                }

                return nextState;
            });
            return;
        }

        if (fieldName === 'variabilite_prix' || fieldName === 'price_variant') {
            const normalizedPriceVariant = extractPriceVariant(value, value?.origine_champs || 'formulaire');
            setFormValues((prev: any) => {
                const nextState: Record<string, any> = {
                    ...prev,
                    [fieldName]: value
                };

                if (normalizedPriceVariant) {
                    const existingProduits = prev.produits
                        ? applyPriceVariantToProduits(prev.produits, normalizedPriceVariant)
                        : undefined;

                    if (existingProduits) {
                        nextState.produits = existingProduits;
                    }
                    nextState.variabilite_prix = normalizedPriceVariant;
                    nextState.price_variant = normalizedPriceVariant;
                    const inferredCurrency = getCurrencyFromVariant(normalizedPriceVariant);
                    if (inferredCurrency) {
                        nextState.devise_produit = inferredCurrency;
                        nextState.devise = inferredCurrency;
                    }
                } else if (prev.produits) {
                    nextState.produits = applyPriceVariantToProduits(prev.produits, null);
                    delete nextState.variabilite_prix;
                    delete nextState.price_variant;
                }

                return nextState;
            });
            return;
        }

        setFormValues((prev: any) => ({
            ...prev,
            [fieldName]: value
        }));
    };

    const handleImagesChange = (images: string[]) => {
        const { images: orderedImages, primary } = orderImagesWithPrimary(
            images,
            primaryProductImage,
            MAX_PRODUCT_IMAGES
        );

        setPrimaryProductImage(primary);
        setFormValues((prev: any) => ({
            ...prev,
            images: orderedImages
        }));
    };

    const handleVideosChange = (videos: any[]) => {
        const videosList = Array.isArray(videos) ? videos : [];

        setFormValues((prev: any) => ({
            ...prev,
            videos: videosList
        }));
    };

    // ✅ Soumettre le nouveau produit - IDENTIQUE AU GRAND FORMULAIRE
    const handleSubmit = async () => {
        // Validation minimale
        if (!formValues.nom_produit || !formValues.nom_produit.trim()) {
            Alert.alert('Erreur', 'Le nom du produit est obligatoire');
            return;
        }

        if (!isEditing && !formValues.lieu_produit) {
            Alert.alert('Erreur', 'Le lieu de commercialisation est obligatoire');
            return;
        }

        setLoading(true);

        try {
            if (isEditing) {
                if (productId === null || Number.isNaN(productId)) {
                    setLoading(false);
                    Alert.alert('Erreur', 'Identifiant du produit introuvable.');
                    return;
                }

                if (productIndex === null || Number.isNaN(productIndex)) {
                    setLoading(false);
                    Alert.alert('Erreur', 'Index du produit introuvable.');
                    return;
                }
            }

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

            const combinationString = (() => {
                if (Array.isArray(formValues.produits)) {
                    const firstString = formValues.produits.find((entry: any) => typeof entry === 'string');
                    if (typeof firstString === 'string') {
                        return firstString;
                    }
                }
                if (typeof formValues.produits === 'string') {
                    return formValues.produits;
                }
                if (Array.isArray(formValues.nominalVector)) {
                    const firstString = formValues.nominalVector.find((entry: any) => typeof entry === 'string');
                    if (typeof firstString === 'string') {
                        return firstString;
                    }
                }
                return '';
            })();

            if (combinationString) {
                nouveauProduit.combinaison_brute = combinationString;
                const characteristicVector = combinationString
                    .split(',')
                    .map((part: string) => part.trim())
                    .filter((part: string) => part.length > 0);
                if (characteristicVector.length > 0) {
                    nouveauProduit.characteristic_vector = characteristicVector;
                }
            }

            if (!nouveauProduit.product_labels && formValues.sous_caracteristiques && typeof formValues.sous_caracteristiques === 'object') {
                nouveauProduit.product_labels = Object.keys(formValues.sous_caracteristiques || {});
            }

            if (!nouveauProduit.origine_champs) {
                nouveauProduit.origine_champs = 'formulaire';
            }

            console.log('[AjouterProduitSimple] 📦 Données du nouveau produit (complètes):', {
                ...nouveauProduit,
                images: nouveauProduit.images ? `${nouveauProduit.images.length} image(s)` : 'aucune',
                videos: nouveauProduit.videos ? `${nouveauProduit.videos.length} vidéo(s)` : 'aucune'
            });

            if (isEditing) {
                try {
                    const response = await apiPatch(`/api/products/${productId}/update`, {
                        service_id: String(serviceId),
                        product_index: productIndex ?? 0,
                        updated_product: nouveauProduit
                    });

                    if (!response.success) {
                        throw new Error(response.error || response.message || 'Impossible de mettre à jour le produit');
                    }

                    Alert.alert(
                        '✅ Produit mis à jour',
                        'Les modifications ont été enregistrées avec succès.',
                        [{ text: 'OK', onPress: () => navigation.goBack() }]
                    );
                } catch (error: any) {
                    console.error('[AjouterProduitSimple] Erreur mise à jour produit:', error);
                    Alert.alert('Erreur', error.message || 'Impossible de mettre à jour le produit');
                } finally {
                    setLoading(false);
                }
                return;
            }

            // ✅ ÉTAPE 2 : Vérifier le solde (coût fixe : 2000 FCFA pour ajout produit - IDENTIQUE AU GRAND FORMULAIRE)
            const COUT_AJOUT_PRODUIT = 2000;

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
            const actionTitle = isDuplicate ? '💰 Duplication de produit' : '💰 Ajout de produit';
            const confirmationMessage =
                `Coût : ${COUT_AJOUT_PRODUIT.toLocaleString()} FCFA\n` +
                `Votre solde : ${soldeActuel.toLocaleString()} FCFA\n` +
                `Solde après ${isDuplicate ? 'duplication' : 'ajout'} : ${(soldeActuel - COUT_AJOUT_PRODUIT).toLocaleString()} FCFA\n\n` +
                (isDuplicate
                    ? 'Confirmez-vous la duplication de ce produit sur votre service ?'
                    : 'Confirmez-vous l\'ajout de ce produit à votre service ?');

            Alert.alert(
                actionTitle,
                confirmationMessage,
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
                                const responseData: any = response.data ?? {};
                                const costPaid = Number(responseData.cost ?? COUT_AJOUT_PRODUIT);
                                const newBalanceValue = Number(responseData.new_balance ?? (soldeActuel - COUT_AJOUT_PRODUIT));
                                const productIndexResult =
                                    responseData.product_index ??
                                    (typeof responseData === 'object' && responseData.data ? responseData.data.product_index : undefined);
                                Alert.alert(
                                    isDuplicate ? '✅ Produit dupliqué' : '✅ Produit créé',
                                    `${isDuplicate ? 'Votre produit dupliqué' : 'Votre nouveau produit'} a été ajouté au service avec succès !\n\n` +
                                    `💰 Coût: ${costPaid.toLocaleString('fr-FR')} FCFA\n` +
                                    `💳 Nouveau solde: ${newBalanceValue.toLocaleString('fr-FR')} FCFA\n` +
                                    `📦 Index produit: ${productIndexResult ?? 'non communiqué'}`,
                                    [
                                        {
                                            text: 'OK',
                                            onPress: () => {
                                                // Retour vers gestion des services
                                                DeviceEventEmitter.emit('service:refresh');
                                                (navigation as any).navigate('Main', { screen: 'Services' });
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
                <NavigatorToolbar
                    title={toolbarTitle}
                    subtitle={toolbarSubtitle}
                    showHandle={false}
                    density="compact"
                    backIcon="back"
                />

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
                                {heroDescription}
                            </Text>
                        </View>

                        {/* Nom du produit / prestation */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>
                                Nom du produit / prestation
                            </Text>
                            <NativeInput
                                placeholder={isPrestation
                                    ? 'Ex: Cours de maths niveau terminal, Réparation écran téléphone...'
                                    : 'Ex: iPhone 14 Pro Max 256GB, Toyota RAV4 2018 4x4...'
                                }
                                value={formValues.nom_produit}
                                onChangeText={(value) => handleFieldChange('nom_produit', value)}
                                multiline
                                minLines={1}
                                style={styles.autoGrowingInput}
                            />
                        </View>

                        {/* Catégorie */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Catégorie du produit / prestation</Text>
                            <NativeInput
                                placeholder="Ex: Smartphone, Cours particulier, Service de réparation..."
                                value={formValues.categorie_produit}
                                onChangeText={(value) => handleFieldChange('categorie_produit', value)}
                                multiline
                                minLines={1}
                                style={styles.autoGrowingInput}
                            />
                        </View>

                        {/* Description */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Description du produit / prestation</Text>
                            <NativeInput
                                placeholder="Décrivez les caractéristiques spécifiques du produit / prestation..."
                                value={formValues.description_produit}
                                onChangeText={(value) => handleFieldChange('description_produit', value)}
                                multiline
                                minLines={3}
                                style={styles.textareaInput}
                                inputStyle={styles.descriptionInputText}
                            />
                        </View>

                        {/* Caractéristiques (Autocomplete) - IDENTIQUE AU GRAND FORMULAIRE */}
                        <View style={styles.fieldGroup}>
                            <LinearAutocompleteEditor
                                label="Caractéristiques produits / prestations"
                                identifiantBase="produits"
                                value={formValues.produits || []}
                                contextValues={[
                                    formValues.description_produit,
                                    formValues.description,
                                ]}
                                categoryValue={formValues.categorie_produit || ''}
                                onChange={(values, updatedSousCaracs) => {
                                    handleFieldChange('produits', values);
                                    if (updatedSousCaracs) {
                                        handleFieldChange('sous_caracteristiques', updatedSousCaracs);
                                    }
                                }}
                                productVector={Array.isArray(formValues.product_vector) ? formValues.product_vector : undefined}
                                productLabels={Array.isArray(formValues.product_labels) ? formValues.product_labels : undefined}
                                sousCaracteristiques={(() => {
                                    // ✅ CORRIGÉ: Réextraction dynamique pour garantir que les sous-caractéristiques sont toujours à jour
                                    // 1. PRIORITÉ: Utiliser sous_caracteristiques complets si disponibles (contient TOUTES les valeurs)
                                    // ✅ AMÉLIORATION: Vérifier aussi dans formValues.produits.sous_caracteristiques
                                    const sousCaracsComplets = formValues.produits?.sous_caracteristiques
                                        || formValues.sous_caracteristiques
                                        || suggestionData?.produits?.sous_caracteristiques;
                                    if (sousCaracsComplets && typeof sousCaracsComplets === 'object' && Object.keys(sousCaracsComplets).length > 0) {
                                        const sousCaracsObj: Record<string, string[]> = {};
                                        Object.entries(sousCaracsComplets).forEach(([key, vals]: [string, any]) => {
                                            if (Array.isArray(vals) && vals.length > 0) {
                                                // ✅ Passer TOUTES les valeurs pour permettre l'affichage du tableau complet
                                                const allValues = vals
                                                    .filter((v: any) => typeof v === 'string' && v.trim().length > 0)
                                                    .map((v: string) => v.trim());
                                                if (allValues.length > 0) {
                                                    sousCaracsObj[key] = allValues;
                                                }
                                            }
                                        });

                                        if (Object.keys(sousCaracsObj).length > 0) {
                                            console.log('[AjouterProduitSimple] ✅ Utilisation sous_caracteristiques complets (TOUTES les valeurs):', sousCaracsObj);
                                            return sousCaracsObj;
                                        }
                                    }

                                    // ✅ PRIORITÉ 1B: Fallback vers product_vector/product_labels (combinaison préférée uniquement)
                                    // Si on n'a pas sous_caracteristiques complets, utiliser la combinaison préférée
                                    if (formValues.product_vector && Array.isArray(formValues.product_vector) &&
                                        formValues.product_labels && Array.isArray(formValues.product_labels) &&
                                        formValues.product_vector.length > 0 && formValues.product_vector.length === formValues.product_labels.length) {

                                        const sousCaracsFromPreferred: Record<string, string[]> = {};
                                        formValues.product_vector.forEach((value: string, index: number) => {
                                            const label = formValues.product_labels[index];
                                            if (label && typeof label === 'string' && value && typeof value === 'string') {
                                                if (!sousCaracsFromPreferred[label]) {
                                                    sousCaracsFromPreferred[label] = [];
                                                }
                                                // Ajouter uniquement la valeur de la combinaison préférée
                                                if (!sousCaracsFromPreferred[label].includes(value)) {
                                                    sousCaracsFromPreferred[label].push(value);
                                                }
                                            }
                                        });

                                        if (Object.keys(sousCaracsFromPreferred).length > 0) {
                                            console.log('[AjouterProduitSimple] ✅ Utilisation sous_caracteristiques depuis combinaison préférée (product_vector/product_labels):', sousCaracsFromPreferred);
                                            return sousCaracsFromPreferred;
                                        }
                                    }

                                    // 2. Fallback: Utiliser sous_caracteristiques si product_vector/product_labels non disponibles
                                    // ✅ CORRIGÉ: Passer TOUTES les valeurs pour permettre l'affichage du tableau complet dans LinearAutocompleteEditor
                                    if (formValues.sous_caracteristiques && typeof formValues.sous_caracteristiques === 'object' && Object.keys(formValues.sous_caracteristiques).length > 0) {
                                        const sousCaracsObj: Record<string, string[]> = {};
                                        Object.entries(formValues.sous_caracteristiques).forEach(([key, vals]: [string, any]) => {
                                            if (Array.isArray(vals) && vals.length > 0) {
                                                // ✅ CORRIGÉ: Passer TOUTES les valeurs, pas seulement la première
                                                // Cela permet au tableau de s'afficher correctement dans LinearAutocompleteEditor
                                                const allValues = vals
                                                    .filter((v: any) => typeof v === 'string' && v.trim().length > 0)
                                                    .map((v: string) => v.trim());
                                                if (allValues.length > 0) {
                                                    sousCaracsObj[key] = allValues;
                                                }
                                            }
                                        });

                                        if (Object.keys(sousCaracsObj).length > 0) {
                                            console.log('[AjouterProduitSimple] ✅ Utilisation sous_caracteristiques (TOUTES les valeurs) depuis formValues:', sousCaracsObj);
                                            return sousCaracsObj;
                                        }
                                    }

                                    // 3. Fallback: Vérifier aussi dans suggestionData si disponible
                                    // ✅ CORRIGÉ: Passer TOUTES les valeurs pour permettre l'affichage du tableau complet
                                    if (suggestionData?.produits?.sous_caracteristiques && typeof suggestionData.produits.sous_caracteristiques === 'object' && Object.keys(suggestionData.produits.sous_caracteristiques).length > 0) {
                                        const sousCaracsObj: Record<string, string[]> = {};
                                        Object.entries(suggestionData.produits.sous_caracteristiques).forEach(([key, vals]: [string, any]) => {
                                            if (Array.isArray(vals) && vals.length > 0) {
                                                // ✅ CORRIGÉ: Passer TOUTES les valeurs, pas seulement la première
                                                // Cela permet au tableau de s'afficher correctement dans LinearAutocompleteEditor
                                                const allValues = vals
                                                    .filter((v: any) => typeof v === 'string' && v.trim().length > 0)
                                                    .map((v: string) => v.trim());
                                                if (allValues.length > 0) {
                                                    sousCaracsObj[key] = allValues;
                                                }
                                            }
                                        });

                                        if (Object.keys(sousCaracsObj).length > 0) {
                                            console.log('[AjouterProduitSimple] ✅ Utilisation sous_caracteristiques (TOUTES les valeurs) depuis suggestionData:', sousCaracsObj);
                                            return sousCaracsObj;
                                        }
                                    }

                                    // 4. Fallback: objet vide (pas de valeurs par défaut hardcodées)
                                    console.log('[AjouterProduitSimple] ⚠️ Aucune combinaison préférée trouvée, utilisation objet vide');
                                    return {};
                                })()}
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
                                    <Text style={styles.label}>Devise (automatique)</Text>
                                    <View style={styles.autoCurrencyBadge}>
                                        <SafeIcon name="info" size={14} color={modernColors.primary} />
                                        <Text style={styles.autoCurrencyText}>
                                            {(formValues.devise_produit || 'Auto')} — déterminée selon le lieu
                                        </Text>
                                    </View>
                                </View>
                            </>
                        )}

                        {/* Lieu */}
                        <View style={styles.fieldGroup}>
                            <LocationSelector
                                label="Lieu de commercialisation"
                                value={formValues.lieu_produit}
                                onSelect={(value) => handleFieldChange('lieu_produit', value)}
                                placeholder="Ville, quartier, pays..."
                                enrichWithBackend={true}
                                required
                            />
                        </View>

                        {/* Variabilité de prix - affichée uniquement si l’IA a détecté des variantes */}
                        {hasExistingVariants && (
                            <View style={styles.fieldGroup}>
                                <PriceVariantSelector
                                    label={isPrestation ? 'Variantes prestation' : 'Variantes produit'}
                                    variable={isPrestation ? 'formule' : 'option'}
                                    modalites={currentModalites}
                                    onChange={(modalites) => handleFieldChange('variabilite_prix', {
                                        type_donnee: 'price_variant',
                                        variable: isPrestation ? 'formule' : 'option',
                                        modalites,
                                        filtrable: true,
                                        origine_champs: 'formulaire'
                                    })}
                                    defaultCurrency={formValues.devise_produit || variantCurrencyCurrent || initialCurrency}
                                    availableCurrencies={availableVariantCurrencies}
                                    helperText="Modifiez les variations détectées par l’IA (prix, stock, image)."
                                    showEmptyStateDetails={false}
                                />
                            </View>
                        )}

                        {/* Photos et vidéos */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Photos et vidéos</Text>
                            <MediaUploadManager
                                images={formValues.images || []}
                                videos={formValues.videos || []}
                                serviceId={serviceId}
                                productId={isEditing && productId !== null ? productId : null}
                                onImagesChange={handleImagesChange}
                                onVideosChange={handleVideosChange}
                                maxImages={MAX_PRODUCT_IMAGES}
                                maxVideos={2}
                            />
                        </View>

                        {/* Bouton de soumission */}
                        <NativeButton
                            title={submitLabel}
                            onPress={handleSubmit}
                            disabled={loading}
                            variant="primary"
                            style={styles.submitButton}
                        />

                        {/* Coût */}
                        {!isEditing && (
                            <View style={styles.costInfo}>
                                <SafeIcon name="info" size={16} color={modernColors.textSecondary} />
                                <Text style={styles.costText}>
                                    {`Coût: 2000 FCFA (Solde: ${(user?.credits || 0).toLocaleString('fr-FR')} FCFA)`}
                                </Text>
                            </View>
                        )}
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
        alignSelf: 'flex-start',
        fontSize: 12,
        fontWeight: '700',
        color: modernColors.primary,
        backgroundColor: 'rgba(99, 102, 241, 0.12)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 12,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
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
    autoCurrencyBadge: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#CBD5F5',
        backgroundColor: '#EEF2FF',
    },
    autoCurrencyText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#312E81',
    },
    autoGrowingInput: {
        minHeight: 52,
    },
    textareaInput: {
        minHeight: 0,
        paddingVertical: 12,
    },
    descriptionInputText: {
        lineHeight: 22,
    },
    variantCallout: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
    },
    variantCalloutHighlighted: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    variantCalloutTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    variantCalloutTitleHighlighted: {
        color: '#FFFFFF',
    },
    variantCalloutText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    variantCalloutTextHighlighted: {
        color: '#E0E7FF',
    },
});

export default AjouterProduitSimpleScreen;

