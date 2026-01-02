// @ts-nocheck
/**
 * AjouterProduitSimpleScreen - Formulaire simple pour ajouter un produit à un service existant
 * Affiche UNIQUEMENT les champs produit, pas le formulaire complet
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useState } from 'react';
import {
    ActivityIndicator,
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
import { NativeButton, NativeCard, NativeInput } from '../components/SafeNativeDesign';
import NavigatorToolbar from '../components/NavigatorToolbar';
import PriceVariantSelector from '../components/PriceVariantSelector';
import SafeIcon from '../components/SafeIcon';
import { useToaster } from '../components/ToasterProvider'; // ✅ NOUVEAU: Pour les toasts de confirmation
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPatch, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { MAX_PRODUCT_IMAGES, mergeImageSources, orderImagesWithPrimary } from '../utils/mediaHelpers';
import { applyPriceVariantToProduits, extractPriceVariant } from '../utils/priceVariant';
import ProductDeliveryConfigModal from '../components/delivery/ProductDeliveryConfigModal';

const AjouterProduitSimpleScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const toaster = useToaster(); // ✅ NOUVEAU: Pour les toasts de confirmation

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
    const [isAddingProductLoading, setIsAddingProductLoading] = useState(false); // ✅ NOUVEAU: État de loading spécifique pour l'ajout de produit
    // ✅ NOUVEAU: Référence au ScrollView principal pour gérer le scroll horizontal des images
    const mainScrollViewRef = useRef<ScrollView>(null);
    // ✅ NOUVEAU: États pour le modal de configuration de livraison
    const [showProductDeliveryConfig, setShowProductDeliveryConfig] = useState(false);
    const [productDeliveryConfigData, setProductDeliveryConfigData] = useState<{
        serviceId: number;
        productIndex: number;
        productName: string;
    } | null>(null);

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

    // ✅ CORRECTION : Extraire données depuis suggestionIA avec priorité sur service_data.data
    // La structure peut être : suggestionIA.data OU suggestionIA.service_data.data OU suggestionIA directement
    const suggestionData = suggestionIA?.service_data?.data || suggestionIA?.data || suggestionIA || {};

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
    // ✅ CORRECTION: Extraire exactement comme dans FormulaireYukpoIntelligentScreen (lignes 1388-1405)
    // Parcourir suggestionData comme Object.keys() et extraire depuis fieldData.modalites avec normalisation
    let iaPriceVariant = null;
    
    // ✅ MÊME LOGIQUE QUE FormulaireYukpoIntelligentScreen: Parcourir les champs et extraire price_variant
    Object.keys(suggestionData || {}).forEach(fieldName => {
        const fieldData = suggestionData[fieldName];
        
        // ✅ IDENTIQUE À FormulaireYukpoIntelligentScreen (ligne 1388)
        if (fieldData && typeof fieldData === 'object' && 'type_donnee' in fieldData) {
            const typeDonnee = fieldData.type_donnee || 'string';
            
            // ✅ IDENTIQUE À FormulaireYukpoIntelligentScreen (ligne 1388): Traitement spécial pour price_variant
            if (typeDonnee === 'price_variant' || fieldName === 'variabilite_prix') {
                // ✅ IDENTIQUE À FormulaireYukpoIntelligentScreen (lignes 1390-1395): Normaliser les modalités
                const modalitesAvecValeurs = (fieldData.modalites || []).map((mod: any) => ({
                    valeur: mod.valeur || '',
                    prix: (mod.prix !== null && mod.prix !== undefined && mod.prix !== 0) ? mod.prix : 0,
                    devise: mod.devise || 'XAF',
                    stock: mod.stock
                }));
                
                // ✅ IDENTIQUE À FormulaireYukpoIntelligentScreen (lignes 1397-1403)
                iaPriceVariant = {
                    type_donnee: 'price_variant',
                    variable: fieldData.variable || 'variante',
                    modalites: modalitesAvecValeurs,
                    filtrable: fieldData.filtrable !== false,
                    origine_champs: fieldData.origine_champs || 'ia'
                };
                console.log('[AjouterProduitSimple] ✅ variabilite_prix extrait depuis IA (identique à FormulaireYukpoIntelligentScreen):', iaPriceVariant.modalites.length, 'modalités');
            }
        }
    });
    
    // ✅ FALLBACK: Utiliser extractPriceVariant si aucune extraction directe n'a fonctionné (pour structures imbriquées)
    if (!iaPriceVariant) {
        iaPriceVariant =
            extractPriceVariant(suggestionData.variabilite_prix) ||
            extractPriceVariant(suggestionData.variation_prix) ||
            extractPriceVariant(suggestionData.price_variant) ||
            extractPriceVariant(suggestionData.produits);
        if (iaPriceVariant) {
            console.log('[AjouterProduitSimple] ✅ variabilite_prix extrait via extractPriceVariant (fallback):', iaPriceVariant.modalites?.length || 0, 'modalités');
        }
    }
    
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

    // ✅ CORRECTION: Extraire sous_caracteristiques avec plusieurs fallbacks
    let sous_caracteristiques = null;

    // PRIORITÉ 1: Depuis suggestionData.produits.sous_caracteristiques
    if (suggestionData.produits?.sous_caracteristiques && typeof suggestionData.produits.sous_caracteristiques === 'object') {
        sous_caracteristiques = suggestionData.produits.sous_caracteristiques;
    }
    // PRIORITÉ 2: Depuis suggestionData.sous_caracteristiques (au niveau racine)
    else if (suggestionData.sous_caracteristiques && typeof suggestionData.sous_caracteristiques === 'object') {
        sous_caracteristiques = suggestionData.sous_caracteristiques;
    }
    // PRIORITÉ 3: Construire depuis product_vector et product_labels si disponibles
    else if (suggestionData.produits?.product_vector && Array.isArray(suggestionData.produits.product_vector) &&
        suggestionData.produits.product_labels && Array.isArray(suggestionData.produits.product_labels) &&
        suggestionData.produits.product_vector.length > 0 && suggestionData.produits.product_vector.length === suggestionData.produits.product_labels.length) {
        const sousCaracsObj: Record<string, string[]> = {};
        
        // ✅ DEBUG: Logger pour diagnostiquer
        console.log('[AjouterProduitSimple] 🔍 Construction initiale depuis product_vector/product_labels:', {
            product_vector: suggestionData.produits.product_vector,
            product_labels: suggestionData.produits.product_labels,
            length_vector: suggestionData.produits.product_vector.length,
            length_labels: suggestionData.produits.product_labels.length
        });
        
        suggestionData.produits.product_vector.forEach((value: string, index: number) => {
            const label = suggestionData.produits.product_labels[index];
            console.log(`[AjouterProduitSimple] 🔍 Index ${index}: label="${label}", value="${value}"`);
            
            if (label && typeof label === 'string' && value && typeof value === 'string') {
                // ✅ CRITIQUE: Chaque valeur doit être associée à son label correspondant par index
                // Si le label existe déjà, on ajoute la valeur (cas où même label apparaît plusieurs fois)
                if (!sousCaracsObj[label]) {
                    sousCaracsObj[label] = [value];
                    console.log(`[AjouterProduitSimple] ✅ Nouveau label créé: "${label}" = ["${value}"]`);
                } else {
                    // Si le label existe déjà, ajouter la valeur (pour gérer les labels dupliqués)
                    const existingValues = sousCaracsObj[label];
                    if (!existingValues.includes(value)) {
                        sousCaracsObj[label] = [value, ...existingValues];
                        console.log(`[AjouterProduitSimple] ✅ Label existant mis à jour: "${label}" = ["${value}", ...]`);
                    } else {
                        console.log(`[AjouterProduitSimple] ⚠️ Valeur déjà présente pour "${label}": "${value}"`);
                    }
                }
            } else {
                console.warn(`[AjouterProduitSimple] ⚠️ Index ${index}: label ou value invalide`, { label, value });
            }
        });
        
        console.log('[AjouterProduitSimple] ✅ Résultat construction initiale:', sousCaracsObj);
        if (Object.keys(sousCaracsObj).length > 0) {
            sous_caracteristiques = sousCaracsObj;
            console.log('[AjouterProduitSimple] ✅ sous_caracteristiques construit depuis product_vector/product_labels:', Object.keys(sousCaracsObj));
        }
    }
    // PRIORITÉ 4: Depuis prefill
    if (!sous_caracteristiques && prefill.sous_caracteristiques && typeof prefill.sous_caracteristiques === 'object') {
        sous_caracteristiques = prefill.sous_caracteristiques;
    }

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
        sous_caracteristiques: sous_caracteristiques ? Object.keys(sous_caracteristiques).length + ' dimensions' : 'VIDE',
        product_vector: suggestionData.produits?.product_vector ? suggestionData.produits.product_vector.length : 0,
        product_labels: suggestionData.produits?.product_labels ? suggestionData.produits.product_labels.length : 0,
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

    // ✅ NOUVEAU 2025-11-28: Construire produitsValues initialement si vide
    // Même logique que FormulaireYukpoIntelligentScreen pour garantir l'affichage de la combinaison préférée
    let initialProduitsValues = prefillProduits.length > 0 ? prefillProduits : suggestionProduits;

    // ✅ Si produitsValues est vide mais qu'on a product_vector, construire la valeur initiale
    if (initialProduitsValues.length === 0) {
        const productVector = prefill.product_vector ?? (suggestionData.produits?.product_vector && Array.isArray(suggestionData.produits.product_vector) ? suggestionData.produits.product_vector : undefined);
        const productLabels = prefill.product_labels ?? (suggestionData.produits?.product_labels && Array.isArray(suggestionData.produits.product_labels) ? suggestionData.produits.product_labels : undefined);
        const safeSeparateur = suggestionData.produits?.separateur || prefill.produits?.separateur || ',';

        // 1. Essayer depuis product_vector (combinaison préférée)
        if (productVector && productVector.length > 0 && safeSeparateur) {
            const combinationString = productVector.join(safeSeparateur);
            initialProduitsValues = [combinationString];
            console.log('[AjouterProduitSimple] ✅ Valeur initiale construite depuis product_vector (combinaison préférée IA):', combinationString);
        }
        // 2. Sinon, construire depuis sous_caracteristiques en prenant la PREMIÈRE valeur de chaque dimension
        else if (initialProduitsValues.length === 0) {
            const finalSousCaracs = sous_caracteristiques || prefill.sous_caracteristiques || {};
            if (finalSousCaracs && typeof finalSousCaracs === 'object' && Object.keys(finalSousCaracs).length > 0) {
                const firstValues: string[] = [];
                Object.entries(finalSousCaracs).forEach(([label, values]) => {
                    if (Array.isArray(values) && values.length > 0 && typeof values[0] === 'string') {
                        // ✅ CRITIQUE: Prendre la PREMIÈRE valeur (valeur préférée par l'IA)
                        firstValues.push(values[0]);
                    }
                });
                if (firstValues.length > 0) {
                    initialProduitsValues = [firstValues.join(safeSeparateur)];
                    console.log('[AjouterProduitSimple] ✅ Valeur initiale construite depuis sous_caracteristiques (premières valeurs = préférées IA):', initialProduitsValues[0]);
                }
            }
        }
    }

    // ✅ CORRECTION CRITIQUE: Prioriser le prefill pour l'édition/duplication
    // Si on est en mode edit ou duplicate, utiliser DIRECTEMENT les valeurs du prefill (même si vides)
    // Cela garantit que toutes les données sont chargées depuis le produit existant
    const initialFormValues = {
        // ✅ PRIORITÉ 1: prefill (données du produit existant pour édition/duplication)
        // En mode edit/duplicate, utiliser TOUJOURS le prefill, avec fallback intelligent si vide
        nom_produit: (isEditing || isDuplicate)
            ? (prefill.nom_produit !== undefined && prefill.nom_produit !== null ? String(prefill.nom_produit) : (nom_produit || ''))
            : (prefill.nom_produit ?? nom_produit ?? ''),
        categorie_produit: (isEditing || isDuplicate)
            ? (prefill.categorie_produit !== undefined && prefill.categorie_produit !== null ? String(prefill.categorie_produit) : (categorie_produit || ''))
            : (prefill.categorie_produit ?? categorie_produit ?? ''),
        description_produit: (isEditing || isDuplicate)
            ? (prefill.description_produit !== undefined && prefill.description_produit !== null ? String(prefill.description_produit) : (description_produit || ''))
            : (prefill.description_produit ?? description_produit ?? ''),
        prix_produit: (isEditing || isDuplicate)
            ? (prefill.prix_produit !== undefined && prefill.prix_produit !== null && prefill.prix_produit !== '' ? String(prefill.prix_produit) : (prix_produit || ''))
            : (prefill.prix_produit ?? prix_produit ?? ''),
        devise_produit: (isEditing || isDuplicate)
            ? (prefill.devise_produit !== undefined && prefill.devise_produit !== null && prefill.devise_produit !== '' ? String(prefill.devise_produit).toUpperCase() : initialCurrency)
            : (prefill.devise_produit ?? initialCurrency),
        variabilite_prix: (isEditing || isDuplicate)
            ? (prefill.variabilite_prix !== undefined ? prefill.variabilite_prix : (prefill.price_variant || null))
            : (initialPriceVariant || prefill.price_variant || prefill.variabilite_prix || null),
        price_variant: (isEditing || isDuplicate)
            ? (prefill.price_variant !== undefined ? prefill.price_variant : (prefill.variabilite_prix || null))
            : (initialPriceVariant || prefill.variabilite_prix || prefill.price_variant || null),
        // ✅ CORRIGÉ: Pour produits, utiliser prefill.produits si disponible (mode edit/duplicate)
        // En mode edit/duplicate, utiliser TOUJOURS prefill.produits (même si vide), avec fallback intelligent
        produits: (isEditing || isDuplicate)
            ? (prefill.produits !== undefined && prefill.produits !== null
                ? (Array.isArray(prefill.produits) ? prefill.produits : (prefill.produits ? [prefill.produits] : []))
                : (initialProduitsValues.length > 0 ? initialProduitsValues : []))
            : initialProduitsValues,
        // ✅ CORRECTION: Utiliser sous_caracteristiques depuis prefill en priorité pour edit/duplicate
        // En mode edit/duplicate, utiliser TOUJOURS prefill.sous_caracteristiques (même si vide), avec fallback intelligent
        sous_caracteristiques: (isEditing || isDuplicate)
            ? (prefill.sous_caracteristiques !== undefined && prefill.sous_caracteristiques !== null
                ? (typeof prefill.sous_caracteristiques === 'object' && !Array.isArray(prefill.sous_caracteristiques)
                    ? prefill.sous_caracteristiques
                    : {})
                : (sous_caracteristiques && typeof sous_caracteristiques === 'object' && Object.keys(sous_caracteristiques).length > 0
                    ? sous_caracteristiques
                    : {}))
            : (prefill.sous_caracteristiques || sous_caracteristiques || {}),
        lieu_produit: (isEditing || isDuplicate)
            ? (prefill.lieu_produit !== undefined ? prefill.lieu_produit : null)
            : (prefill.lieu_produit ?? lieu_produit ?? null),
        // ✅ NOUVEAU: Quantité disponible (uniquement pour les produits)
        quantite_disponible: (isEditing || isDuplicate)
            ? (prefill.quantite_disponible !== undefined ? prefill.quantite_disponible : (prefill.stock !== undefined ? prefill.stock : null))
            : (prefill.quantite_disponible ?? prefill.stock ?? null),
        // ✅ CRITIQUE: Pour les médias, utiliser prefill en priorité pour edit/duplicate
        // En mode edit/duplicate, utiliser TOUJOURS les médias du prefill (même si vides)
        images: (isEditing || isDuplicate) ? prefilledImages : initialProductImages,
        videos: (isEditing || isDuplicate) ? prefilledVideos : initialProductVideos,
        audios: (isEditing || isDuplicate) ? prefilledAudios : initialProductAudios,
        documents: (isEditing || isDuplicate) ? prefilledDocuments : initialProductDocuments,
        characteristic_vector: prefill.characteristic_vector ?? suggestionData?.characteristic_vector ?? null,
        combinaison_brute: prefill.combinaison_brute ?? suggestionData?.combinaison_brute ?? null,
        // ✅ NOUVEAU: Initialiser product_vector et product_labels depuis prefill en priorité
        product_vector: prefill.product_vector ?? (suggestionData.produits?.product_vector && Array.isArray(suggestionData.produits.product_vector) ? suggestionData.produits.product_vector : undefined),
        product_labels: prefill.product_labels ?? (suggestionData.produits?.product_labels && Array.isArray(suggestionData.produits.product_labels) ? suggestionData.produits.product_labels : undefined),
    };

    // ✅ DEBUG: Logger le prefill pour vérifier qu'il contient bien les données
    React.useEffect(() => {
        if (isEditing || isDuplicate) {
            console.log('[AjouterProduitSimple] 📝 Mode:', mode);
            console.log('[AjouterProduitSimple] 📦 Prefill reçu:', {
                nom_produit: prefill.nom_produit || 'VIDE',
                categorie_produit: prefill.categorie_produit || 'VIDE',
                description_produit: prefill.description_produit || 'VIDE',
                prix_produit: prefill.prix_produit || 'VIDE',
                devise_produit: prefill.devise_produit || 'VIDE',
                produits: prefill.produits
                    ? (Array.isArray(prefill.produits) ? `${prefill.produits.length} élément(s)` : 'non-array')
                    : 'VIDE',
                lieu_produit: prefill.lieu_produit || 'VIDE',
                variabilite_prix: prefill.variabilite_prix ? 'présent' : 'VIDE',
                sous_caracteristiques: prefill.sous_caracteristiques
                    ? (typeof prefill.sous_caracteristiques === 'object' ? `${Object.keys(prefill.sous_caracteristiques).length} dimension(s)` : 'présent')
                    : 'VIDE',
                images_count: Array.isArray(prefill.images) ? prefill.images.length : 0,
                videos_count: Array.isArray(prefill.videos) ? prefill.videos.length : 0,
                audios_count: Array.isArray(prefill.audios) ? prefill.audios.length : 0,
                documents_count: Array.isArray(prefill.documents) ? prefill.documents.length : 0,
            });
            console.log('[AjouterProduitSimple] 📦 MediaData reçu:', {
                base64_image_count: Array.isArray(mediaData?.base64_image) ? mediaData.base64_image.length : 0,
                video_base64_count: Array.isArray(mediaData?.video_base64) ? mediaData.video_base64.length : 0,
                audio_base64_count: Array.isArray(mediaData?.audio_base64) ? mediaData.audio_base64.length : 0,
                doc_base64_count: Array.isArray(mediaData?.doc_base64) ? mediaData.doc_base64.length : 0,
            });
            console.log('[AjouterProduitSimple] 📝 Valeurs initiales formValues:', {
                nom_produit: initialFormValues.nom_produit || 'VIDE',
                categorie_produit: initialFormValues.categorie_produit || 'VIDE',
                description_produit: initialFormValues.description_produit || 'VIDE',
                prix_produit: initialFormValues.prix_produit || 'VIDE',
                devise_produit: initialFormValues.devise_produit || 'VIDE',
                lieu_produit: initialFormValues.lieu_produit || 'VIDE',
                produits_count: Array.isArray(initialFormValues.produits) ? initialFormValues.produits.length : 0,
                has_sous_caracteristiques: initialFormValues.sous_caracteristiques && typeof initialFormValues.sous_caracteristiques === 'object'
                    ? Object.keys(initialFormValues.sous_caracteristiques).length
                    : 0,
                images_count: Array.isArray(initialFormValues.images) ? initialFormValues.images.length : 0,
                videos_count: Array.isArray(initialFormValues.videos) ? initialFormValues.videos.length : 0,
                audios_count: Array.isArray(initialFormValues.audios) ? initialFormValues.audios.length : 0,
                documents_count: Array.isArray(initialFormValues.documents) ? initialFormValues.documents.length : 0,
            });
        }
    }, [mode, prefill, initialFormValues]);

    const [formValues, setFormValues] = useState<any>(initialFormValues);

    // ✅ NOUVEAU 2025-11-21: Charger les combinaisons préférées par l'IA via session_id
    // ✅ CORRIGÉ: Charger aussi si sous_caracteristiques est vide (pour afficher les caractéristiques)
    // ✅ OPTIMISATION: Utiliser useRef pour éviter les re-renders en boucle
    const hasLoadedCombinations = React.useRef(false);
    React.useEffect(() => {
        const loadAIPreferredCombinations = async () => {
            // ✅ OPTIMISATION: Ne charger qu'une seule fois pour éviter les re-renders en boucle
            if (hasLoadedCombinations.current) {
                return;
            }
            
            // Vérifier si on a un session_id et que produits OU sous_caracteristiques sont vides
            const sessionId = suggestionIA?.session_id || suggestionIA?.data?.session_id;
            const hasProduits = formValues.produits && Array.isArray(formValues.produits) && formValues.produits.length > 0;
            const hasSousCaracs = formValues.sous_caracteristiques && typeof formValues.sous_caracteristiques === 'object' && Object.keys(formValues.sous_caracteristiques).length > 0;

            // ✅ CORRIGÉ: Charger si session_id existe ET (produits vide OU sous_caracteristiques vide)
            if (sessionId && (!hasProduits || !hasSousCaracs)) {
                hasLoadedCombinations.current = true; // ✅ Marquer comme chargé pour éviter les re-renders
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
                                // ✅ CRITIQUE: Grouper les labels par dimension avec la valeur préférée en PREMIÈRE position
                                preferred.product_vector.forEach((value: string, index: number) => {
                                    const label = preferred.product_labels[index];
                                    if (label && typeof label === 'string') {
                                        // ✅ CRITIQUE: La valeur préférée de l'IA doit être en PREMIÈRE position
                                        if (!sousCaracsObj[label]) {
                                            sousCaracsObj[label] = [value];
                                        } else {
                                            // Si le label existe déjà, s'assurer que la valeur préférée est en première position
                                            const existingValues = sousCaracsObj[label];
                                            if (!existingValues.includes(value)) {
                                                // Insérer la valeur préférée en première position
                                                sousCaracsObj[label] = [value, ...existingValues];
                                            } else {
                                                // Si la valeur existe déjà mais n'est pas en première position, la déplacer
                                                const filtered = existingValues.filter(v => v !== value);
                                                sousCaracsObj[label] = [value, ...filtered];
                                            }
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
                    // ✅ CORRECTION: Logger en WARN avec retry logic pour résoudre le problème
                    console.warn('[AjouterProduitSimple] ⚠️ Erreur chargement combinaisons IA:', error);
                    // ✅ AMÉLIORATION: Essayer une fois de plus après un délai
                    try {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        const retryResponse = await apiGet(`/api/combinations/session/${sessionId}`);
                        if (retryResponse?.combinations && Array.isArray(retryResponse.combinations)) {
                            const preferred = retryResponse.combinations.find((c: any) => c.is_ai_preferred);
                            if (preferred && preferred.product_vector && Array.isArray(preferred.product_vector) && preferred.product_vector.length > 0) {
                                const separateur = preferred.separateur || ',';
                                const combinationString = preferred.product_vector.join(separateur);
                                const sousCaracsObj: Record<string, string[]> = {};
                                if (Array.isArray(preferred.product_labels) && preferred.product_labels.length > 0) {
                                    // ✅ CRITIQUE: Grouper les labels par dimension avec la valeur préférée en PREMIÈRE position
                                    preferred.product_vector.forEach((value: string, index: number) => {
                                        const label = preferred.product_labels[index];
                                        if (label && typeof label === 'string') {
                                            // ✅ CRITIQUE: La valeur préférée de l'IA doit être en PREMIÈRE position
                                            if (!sousCaracsObj[label]) {
                                                sousCaracsObj[label] = [value];
                                            } else {
                                                // Si le label existe déjà, s'assurer que la valeur préférée est en première position
                                                const existingValues = sousCaracsObj[label];
                                                if (!existingValues.includes(value)) {
                                                    // Insérer la valeur préférée en première position
                                                    sousCaracsObj[label] = [value, ...existingValues];
                                                } else {
                                                    // Si la valeur existe déjà mais n'est pas en première position, la déplacer
                                                    const filtered = existingValues.filter(v => v !== value);
                                                    sousCaracsObj[label] = [value, ...filtered];
                                                }
                                            }
                                        }
                                    });
                                }
                                setFormValues((prev: any) => ({
                                    ...prev,
                                    produits: [combinationString],
                                    sous_caracteristiques: Object.keys(sousCaracsObj).length > 0 ? sousCaracsObj : (preferred.product_labels || prev.sous_caracteristiques || {}),
                                    product_vector: preferred.product_vector,
                                    product_labels: preferred.product_labels || []
                                }));
                                console.log('[AjouterProduitSimple] ✅ Combinaison préférée IA chargée après retry');
                            }
                        }
                    } catch (retryError) {
                        console.warn('[AjouterProduitSimple] ⚠️ Retry échoué également:', retryError);
                        // Ne pas bloquer le formulaire si l'API échoue
                    }
                }
            }
        };

        loadAIPreferredCombinations();
    }, [suggestionIA?.session_id, suggestionIA?.data?.session_id]); // ✅ OPTIMISATION: Retirer formValues des dépendances pour éviter les re-renders en boucle

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

    const submitLabel = (loading || isAddingProductLoading)
        ? (isAddingProductLoading ? '⏳ Création du produit...' : isEditing ? '⏳ Mise à jour...' : isDuplicate ? '⏳ Duplication...' : '⏳ Ajout en cours...')
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

        // ✅ CORRECTION CRITIQUE: Afficher la confirmation IMMÉDIATEMENT (avant toute opération lourde)
        // Cela permet à l'utilisateur de voir immédiatement le coût avant confirmation
        // Le toast/Alert doit apparaître instantanément au clic
        try {
            // ✅ ÉTAPE 1 : Vérifier le solde RAPIDEMENT (sans upload médias)
            const COUT_AJOUT_PRODUIT = 2000;
            console.log('💰 [AjouterProduitSimple] Vérification rapide du solde pour affichage coût...');
            const balanceResponse = await apiGet<{ tokens_balance: number }>('/api/users/balance');

            if (!balanceResponse.success) {
                const errorMsg = balanceResponse.error || 'Impossible de vérifier votre solde';
                console.error('💰 [AjouterProduitSimple] ❌ Erreur vérification solde:', errorMsg);
                Alert.alert('Erreur', errorMsg);
                return;
            }

            if (!balanceResponse.data || typeof balanceResponse.data.tokens_balance === 'undefined') {
                console.error('💰 [AjouterProduitSimple] ❌ Données solde invalides:', balanceResponse.data);
                Alert.alert('Erreur', 'Données de solde invalides reçues du serveur');
                return;
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
                return;
            }

            // ✅ ÉTAPE 2 : Afficher la confirmation IMMÉDIATEMENT (toast instantané)
            const actionTitle = isDuplicate ? '💰 Duplication de produit' : '💰 Ajout de produit';
            const confirmationMessage =
                `Coût : ${COUT_AJOUT_PRODUIT.toLocaleString()} FCFA\n` +
                `Votre solde : ${soldeActuel.toLocaleString()} FCFA\n` +
                `Solde après ${isDuplicate ? 'duplication' : 'ajout'} : ${(soldeActuel - COUT_AJOUT_PRODUIT).toLocaleString()} FCFA\n\n` +
                (isDuplicate
                    ? 'Confirmez-vous la duplication de ce produit sur votre service ?'
                    : 'Confirmez-vous l\'ajout de ce produit à votre service ?');

            console.log('[AjouterProduitSimple] 📋 Affichage confirmation création produit:', {
                serviceId,
                hasUser: !!user,
                userId: user?.id,
                productName: formValues.nom_produit,
                cost: COUT_AJOUT_PRODUIT,
                balance: soldeActuel
            });

            // ✅ AFFICHER L'ALERT IMMÉDIATEMENT (toast instantané)
            Alert.alert(
                actionTitle,
                confirmationMessage,
                [
                    {
                        text: 'Annuler',
                        style: 'cancel',
                        onPress: () => {
                            console.log('[AjouterProduitSimple] ❌ Création annulée par l\'utilisateur');
                        }
                    },
                    {
                        text: 'Confirmer',
                        onPress: async () => {
                            // ✅ MAINTENANT on fait les opérations lourdes après confirmation
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
                                    // ✅ CORRECTION 2025-12-14 : Filtrer explicitement les chaînes vides pour prix
                                    // Ne pas envoyer prix_produit ou prix s'ils sont vides (pour éviter erreur 400 backend)
                                    if (key === 'prix_produit' || key === 'prix') {
                                        // Pour les prix, accepter uniquement les nombres ou chaînes non vides avec contenu numérique
                                        if (value !== undefined && value !== null && value !== '') {
                                            const trimmed = String(value).trim();
                                            if (trimmed.length > 0 && !isNaN(Number(trimmed))) {
                                                nouveauProduit[key] = trimmed;
                                            }
                                        }
                                    } else if (value !== undefined && value !== null && value !== '') {
                                        nouveauProduit[key] = value;
                                    }
                                });

                                // ✅ Ajouter le stock si quantite_disponible est défini
                                // ✅ Note: Validation backend dans creer_service.rs (sécurité ultime)
                                if (formValues.quantite_disponible !== null && formValues.quantite_disponible !== undefined && formValues.quantite_disponible !== '') {
                                    const stockValue = typeof formValues.quantite_disponible === 'number'
                                        ? formValues.quantite_disponible
                                        : parseInt(String(formValues.quantite_disponible), 10);
                                    if (!isNaN(stockValue) && stockValue >= 0) {
                                        nouveauProduit.stock = stockValue;
                                        nouveauProduit.quantite_disponible = stockValue; // Alias pour compatibilité
                                    }
                                }

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

                                // ✅ NOUVEAU: Transformer variation_prix en format variants/has_variant pour ProductCard
                                // Le ProductCard cherche product.variants et product.has_variant
                                const priceVariant = nouveauProduit.variabilite_prix || nouveauProduit.price_variant || nouveauProduit.variation_prix;
                                if (priceVariant && typeof priceVariant === 'object' && !Array.isArray(priceVariant)) {
                                    const modalites = priceVariant.modalites || priceVariant.valeur || priceVariant;
                                    if (Array.isArray(modalites) && modalites.length > 0) {
                                        // Transformer les modalités en format variants
                                        const variants = modalites.map((modalite: any) => {
                                            const variant: any = {};
                                            if (modalite.valeur || modalite.value) {
                                                variant.value = modalite.valeur || modalite.value;
                                                variant.valeur = modalite.valeur || modalite.value;
                                            }
                                            if (modalite.prix !== undefined || modalite.price !== undefined) {
                                                variant.prix = modalite.prix || modalite.price;
                                            }
                                            if (modalite.devise || modalite.currency) {
                                                variant.devise = modalite.devise || modalite.currency;
                                            }
                                            if (modalite.stock !== undefined || modalite.quantite !== undefined) {
                                                variant.stock = modalite.stock || modalite.quantite;
                                            }
                                            if (modalite.image) {
                                                variant.image = modalite.image;
                                            }
                                            return variant;
                                        });

                                        nouveauProduit.has_variant = true;
                                        nouveauProduit.variants = variants;

                                        // Ajouter aussi variant_dimension si disponible
                                        if (priceVariant.variable) {
                                            nouveauProduit.variant_dimension = priceVariant.variable;
                                        }

                                        console.log('[AjouterProduitSimple] ✅ Variations de prix transformées en variants:', variants.length);
                                    }
                                }

                                // ✅ OPTIMISATION CRITIQUE: Vérifier AVANT l'import s'il y a des médias à compresser
                                // Évite l'import dynamique coûteux et les opérations inutiles si pas de médias
                                let compressedMedia: any = null;
                                
                                // Vérifier rapidement s'il y a des médias base64/file à compresser
                                const hasImagesToCompress = nouveauProduit.images && Array.isArray(nouveauProduit.images) && 
                                    nouveauProduit.images.some((img: string) => img && (img.startsWith('data:') || img.startsWith('file://')));
                                const hasVideosToCompress = nouveauProduit.videos && Array.isArray(nouveauProduit.videos) && 
                                    nouveauProduit.videos.some((vid: string) => vid && (vid.startsWith('data:') || vid.startsWith('file://')));
                                
                                if (hasImagesToCompress || hasVideosToCompress) {
                                    // ✅ SEULEMENT si on a des médias à compresser, importer et compresser
                                    console.log('[AjouterProduitSimple] 🔄 Compression des médias avant envoi...');
                                    try {
                                        const { compressAllMedia } = await import('../utils/mediaCompression');

                                        // Séparer les médias base64/file des URLs existantes
                                        const imagesBase64: string[] = [];
                                        const videosBase64: string[] = [];
                                        const existingImageUrls: string[] = [];
                                        const existingVideoUrls: string[] = [];

                                        // Images : séparer base64/file des URLs
                                        if (nouveauProduit.images && Array.isArray(nouveauProduit.images)) {
                                            nouveauProduit.images.forEach((img: string) => {
                                                if (img && (img.startsWith('data:') || img.startsWith('file://'))) {
                                                    imagesBase64.push(img);
                                                } else if (img && (img.startsWith('http://') || img.startsWith('https://'))) {
                                                    existingImageUrls.push(img);
                                                }
                                            });
                                        }

                                        // Vidéos : séparer base64/file des URLs
                                        if (nouveauProduit.videos && Array.isArray(nouveauProduit.videos)) {
                                            nouveauProduit.videos.forEach((vid: string) => {
                                                if (vid && (vid.startsWith('data:') || vid.startsWith('file://'))) {
                                                    videosBase64.push(vid);
                                                } else if (vid && (vid.startsWith('http://') || vid.startsWith('https://'))) {
                                                    existingVideoUrls.push(vid);
                                                }
                                            });
                                        }

                                        // Compresser uniquement les médias base64/file
                                        if (imagesBase64.length > 0 || videosBase64.length > 0) {
                                            const mediaForCompression = {
                                                images: imagesBase64,
                                                videos: videosBase64,
                                            };

                                            compressedMedia = await compressAllMedia(mediaForCompression);
                                            console.log('[AjouterProduitSimple] ✅ Médias compressés:', {
                                                before: `${(compressedMedia.totalSizeBefore / (1024 * 1024)).toFixed(2)} MB`,
                                                after: `${(compressedMedia.totalSizeAfter / (1024 * 1024)).toFixed(2)} MB`,
                                                saved: `${((1 - compressedMedia.totalSizeAfter / compressedMedia.totalSizeBefore) * 100).toFixed(1)}%`
                                            });

                                            // ✅ CORRIGÉ: Séparer les médias base64 (seront traités par le backend) des URLs
                                            // Le backend nettoie les base64 et les sauvegarde dans la table media
                                            // On envoie les base64 dans des champs séparés pour que le backend les traite
                                            if (compressedMedia.images.length > 0) {
                                                // Les images base64 compressées seront traitées par le backend
                                                nouveauProduit.base64_image = compressedMedia.images;
                                                // Ne pas mettre dans images pour éviter d'envoyer du base64 dans le JSONB
                                            }
                                            if (existingImageUrls.length > 0) {
                                                // Les URLs existantes peuvent être dans images (pas de base64)
                                                nouveauProduit.images = existingImageUrls;
                                            }

                                            if (compressedMedia.videos.length > 0) {
                                                // Les vidéos base64 compressées seront traitées par le backend
                                                nouveauProduit.video_base64 = compressedMedia.videos;
                                                // Ne pas mettre dans videos pour éviter d'envoyer du base64 dans le JSONB
                                            }
                                            if (existingVideoUrls.length > 0) {
                                                // Les URLs existantes peuvent être dans videos (pas de base64)
                                                nouveauProduit.videos = existingVideoUrls;
                                            }
                                        } else if (existingImageUrls.length > 0 || existingVideoUrls.length > 0) {
                                            // Seulement des URLs existantes, pas de compression nécessaire
                                            if (existingImageUrls.length > 0) {
                                                nouveauProduit.images = existingImageUrls;
                                            }
                                            if (existingVideoUrls.length > 0) {
                                                nouveauProduit.videos = existingVideoUrls;
                                            }
                                        }
                                    } catch (compressionError: any) {
                                        console.warn('[AjouterProduitSimple] ⚠️ Erreur compression médias, continuation sans compression:', compressionError.message);
                                        // Continuer sans compression si erreur - le backend gérera
                                    }
                                } else {
                                    // ✅ OPTIMISATION: Pas de médias à compresser, traitement rapide
                                    // Vérifier s'il y a des URLs existantes à préserver
                                    const existingImageUrls: string[] = [];
                                    const existingVideoUrls: string[] = [];
                                    
                                    if (nouveauProduit.images && Array.isArray(nouveauProduit.images)) {
                                        nouveauProduit.images.forEach((img: string) => {
                                            if (img && (img.startsWith('http://') || img.startsWith('https://'))) {
                                                existingImageUrls.push(img);
                                            }
                                        });
                                        if (existingImageUrls.length > 0) {
                                            nouveauProduit.images = existingImageUrls;
                                        } else {
                                            // Pas de médias du tout, supprimer les champs vides
                                            delete nouveauProduit.images;
                                        }
                                    }
                                    
                                    if (nouveauProduit.videos && Array.isArray(nouveauProduit.videos)) {
                                        nouveauProduit.videos.forEach((vid: string) => {
                                            if (vid && (vid.startsWith('http://') || vid.startsWith('https://'))) {
                                                existingVideoUrls.push(vid);
                                            }
                                        });
                                        if (existingVideoUrls.length > 0) {
                                            nouveauProduit.videos = existingVideoUrls;
                                        } else {
                                            // Pas de médias du tout, supprimer les champs vides
                                            delete nouveauProduit.videos;
                                        }
                                    }
                                    
                                    console.log('[AjouterProduitSimple] ✅ Pas de médias à compresser, traitement rapide');
                                }

                                console.log('[AjouterProduitSimple] 📦 Données du nouveau produit (complètes):', {
                                    ...nouveauProduit,
                                    images: compressedMedia?.images?.length || (nouveauProduit.images ? nouveauProduit.images.length : 0),
                                    videos: compressedMedia?.videos?.length || (nouveauProduit.videos ? nouveauProduit.videos.length : 0),
                                    has_variant: nouveauProduit.has_variant,
                                    variants_count: nouveauProduit.variants ? nouveauProduit.variants.length : 0
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

                                // ✅ ÉTAPE 4 : Appeler /api/services/{serviceId}/products
                                const userId = parseInt(user?.id || '0', 10);
                                const COUT_AJOUT_PRODUIT = 2000;
                                const soldeActuel = balanceResponse.data.tokens_balance || 0;

                                if (!userId || userId === 0) {
                                    throw new Error('ID utilisateur invalide');
                                }

                                if (!serviceId) {
                                    throw new Error('ID service invalide');
                                }

                                // ✅ NOUVEAU: Activer le loading spécifique pour l'ajout de produit
                                setIsAddingProductLoading(true);
                                
                                // ✅ CRITIQUE: Nettoyer les médias base64 AVANT l'envoi pour éviter les timeouts
                                // Le backend nettoie aussi, mais il vaut mieux le faire côté client pour réduire la taille du payload
                                // Les médias base64 seront traités séparément par le backend (upload vers Wasabi + table media)
                                const productDataForAPI = { ...nouveauProduit };
                                
                                // Garder seulement les URLs dans images/videos (pas de base64)
                                // Les base64 sont dans base64_image/video_base64 et seront nettoyés par le backend
                                if (productDataForAPI.images && Array.isArray(productDataForAPI.images)) {
                                    // Filtrer pour garder seulement les URLs (pas de base64)
                                    productDataForAPI.images = productDataForAPI.images.filter((img: string) => 
                                        img && (img.startsWith('http://') || img.startsWith('https://'))
                                    );
                                    if (productDataForAPI.images.length === 0) {
                                        delete productDataForAPI.images;
                                    }
                                }
                                
                                if (productDataForAPI.videos && Array.isArray(productDataForAPI.videos)) {
                                    // Filtrer pour garder seulement les URLs (pas de base64)
                                    productDataForAPI.videos = productDataForAPI.videos.filter((vid: string) => 
                                        vid && (vid.startsWith('http://') || vid.startsWith('https://'))
                                    );
                                    if (productDataForAPI.videos.length === 0) {
                                        delete productDataForAPI.videos;
                                    }
                                }
                                
                                // ✅ NOUVEAU: Calculer et logger la taille du payload pour diagnostic
                                const payload = {
                                    user_id: userId,
                                    product_data: productDataForAPI
                                };
                                const payloadJson = JSON.stringify(payload);
                                // ✅ Approximation: chaque caractère UTF-16 = 2 bytes (pour JSON simple)
                                // Pour base64, c'est ~4/3 de la taille de la string
                                const payloadSizeBytes = payloadJson.length * 2; // Approximation conservative
                                const payloadSizeMB = (payloadSizeBytes / (1024 * 1024)).toFixed(2);
                                
                                // Calculer la taille des médias base64 séparément
                                const base64ImagesSize = nouveauProduit.base64_image ? 
                                    (Array.isArray(nouveauProduit.base64_image) ? 
                                        nouveauProduit.base64_image.reduce((acc: number, img: string) => acc + (img?.length || 0) * 2, 0) : 
                                        (nouveauProduit.base64_image.length || 0) * 2) : 0;
                                const base64VideosSize = nouveauProduit.video_base64 ? 
                                    (Array.isArray(nouveauProduit.video_base64) ? 
                                        nouveauProduit.video_base64.reduce((acc: number, vid: string) => acc + (vid?.length || 0) * 2, 0) : 
                                        (nouveauProduit.video_base64.length || 0) * 2) : 0;
                                const totalBase64SizeMB = ((base64ImagesSize + base64VideosSize) / (1024 * 1024)).toFixed(2);
                                
                                console.log('[AjouterProduitSimple] 📤 Appel API création produit:', {
                                    url: `/api/services/${serviceId}/products`,
                                    userId,
                                    serviceId,
                                    productDataKeys: Object.keys(productDataForAPI),
                                    payloadSize: `${payloadSizeMB} MB (${payloadSizeBytes} bytes)`,
                                    base64MediaSize: `${totalBase64SizeMB} MB (sera traité séparément par le backend)`,
                                    hasImages: !!(productDataForAPI.images && productDataForAPI.images.length > 0),
                                    hasVideos: !!(productDataForAPI.videos && productDataForAPI.videos.length > 0),
                                    hasBase64Images: !!(nouveauProduit.base64_image && (Array.isArray(nouveauProduit.base64_image) ? nouveauProduit.base64_image.length > 0 : true)),
                                    hasBase64Videos: !!(nouveauProduit.video_base64 && (Array.isArray(nouveauProduit.video_base64) ? nouveauProduit.video_base64.length > 0 : true)),
                                    hasVariants: !!(productDataForAPI.variants && productDataForAPI.variants.length > 0),
                                    variantsCount: productDataForAPI.variants ? productDataForAPI.variants.length : 0
                                });
                                
                                // ✅ NOUVEAU: Avertir si le payload est très volumineux
                                if (payloadSizeBytes > 10 * 1024 * 1024) { // > 10 MB
                                    console.warn('[AjouterProduitSimple] ⚠️ Payload très volumineux:', payloadSizeMB, 'MB');
                                }
                                if (base64ImagesSize + base64VideosSize > 50 * 1024 * 1024) { // > 50 MB de base64
                                    console.warn('[AjouterProduitSimple] ⚠️ Médias base64 très volumineux:', totalBase64SizeMB, 'MB - Le backend va les traiter en arrière-plan');
                                }

                                // ✅ SIMPLIFIÉ: Appel direct sans retry (le timeout de 180s devrait suffire)
                                // Les retries peuvent causer des timeouts cumulatifs qui dépassent le timeout
                                console.log(`[AjouterProduitSimple] 📤 Appel API création produit (timeout: 180s)...`);
                                
                                const startTime = Date.now();
                                const response = await apiPost(`/api/services/${serviceId}/products`, {
                                    user_id: userId,
                                    product_data: productDataForAPI // ✅ Utiliser les données nettoyées (sans base64 dans images/videos)
                                });
                                const duration = Date.now() - startTime;
                                
                                console.log('[AjouterProduitSimple] 📥 Réponse API création produit:', {
                                    success: response.success,
                                    hasData: !!response.data,
                                    error: response.error,
                                    message: response.message,
                                    duration: `${(duration / 1000).toFixed(2)}s`
                                });

                                if (!response.success) {
                                    throw new Error(response.error || response.message || 'Erreur lors de l\'ajout du produit');
                                }

                                console.log('[AjouterProduitSimple] ✅ Produit ajouté avec succès:', response);
                                
                                // ✅ NOUVEAU: Afficher un toast de succès
                                toaster.success('✅ Produit créé avec succès !');

                                // ✅ ÉTAPE 5 : Afficher le résultat (IDENTIQUE AU GRAND FORMULAIRE)
                                const responseData: any = response.data ?? {};
                                const costPaid = Number(responseData.cost ?? COUT_AJOUT_PRODUIT);
                                const newBalanceValue = Number(responseData.new_balance ?? (soldeActuel - COUT_AJOUT_PRODUIT));
                                const productIndexResult =
                                    responseData.product_index ??
                                    (typeof responseData === 'object' && responseData.data ? responseData.data.product_index : undefined);
                                
                                // ✅ NOUVEAU: Si c'est un produit (pas une prestation), ouvrir la configuration de livraison
                                const typeOffre = formValues.type_offre || 'produit';
                                const isPrestation = typeOffre === 'prestation' || typeOffre === 'service';
                                
                                if (!isPrestation && productIndexResult !== undefined && serviceId) {
                                    // C'est un produit, ouvrir le modal de configuration de livraison
                                    const finalServiceId = typeof serviceId === 'string' ? parseInt(serviceId, 10) : serviceId;
                                    const finalProductIndex = typeof productIndexResult === 'number' ? productIndexResult : parseInt(String(productIndexResult), 10);
                                    const productName = formValues.nom_produit || 'Nouveau produit';
                                    
                                    // Ouvrir le modal de configuration de livraison
                                    setShowProductDeliveryConfig(true);
                                    setProductDeliveryConfigData({
                                        serviceId: finalServiceId,
                                        productIndex: finalProductIndex,
                                        productName: productName,
                                    });
                                    
                                    // Ne pas afficher l'Alert de succès ici, le modal s'ouvrira directement
                                    DeviceEventEmitter.emit('service:refresh');
                                    setIsAddingProductLoading(false); // ✅ NOUVEAU: Désactiver le loading
                                    return;
                                }
                                
                                // Pour les prestations ou si productIndexResult n'est pas disponible, afficher l'Alert normal
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
                                setIsAddingProductLoading(false); // ✅ NOUVEAU: Désactiver le loading après succès
                            } catch (error: any) {
                                console.error('[AjouterProduitSimple] ❌ Erreur:', {
                                    message: error?.message,
                                    stack: error?.stack,
                                    name: error?.name,
                                    response: error?.response?.data,
                                    status: error?.response?.status,
                                    code: error?.code,
                                });
                                
                                setIsAddingProductLoading(false); // ✅ NOUVEAU: Désactiver le loading en cas d'erreur
                                
                                // ✅ AMÉLIORÉ: Afficher un message d'erreur plus détaillé
                                let errorMessage = 'Impossible d\'ajouter le produit.';
                                let errorTitle = 'Erreur';
                                
                                // Gérer les erreurs selon leur type
                                if (error?.code === 'TIMEOUT' || error?.message?.includes('timeout') || error?.message?.includes('Timeout') || error?.name === 'AbortError' || error?.message === 'Aborted') {
                                    errorTitle = '⏱️ Timeout';
                                    errorMessage = 'L\'ajout du produit a pris trop de temps (plus de 3 minutes). Cela peut être dû à :\n\n• Un grand nombre de médias\n• Des variants complexes\n• Une connexion internet lente\n• Un serveur temporairement surchargé\n• Des opérations backend lourdes\n\n⚠️ Le produit peut avoir été créé malgré l\'erreur. Vérifiez votre liste de produits avant de réessayer.';
                                    
                                    // ✅ NOUVEAU: Afficher un toast d'erreur
                                    toaster.error('⏱️ Timeout lors de la création du produit');
                                    
                                    Alert.alert(
                                        errorTitle,
                                        errorMessage,
                                        [
                                            { text: 'Vérifier mes produits', onPress: () => {
                                                DeviceEventEmitter.emit('service:refresh');
                                                (navigation as any).navigate('Main', { screen: 'Services' });
                                            }},
                                            { text: 'Réessayer', onPress: () => soumettreFormulaire() }
                                        ]
                                    );
                                    return;
                                } else if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network request failed') || error?.message?.includes('Failed to fetch')) {
                                    errorTitle = '🌐 Erreur réseau';
                                    errorMessage = 'Impossible de se connecter au serveur. Vérifiez votre connexion internet et réessayez.';
                                    toaster.error('🌐 Erreur réseau lors de la création du produit');
                                } else if (error?.response?.status === 500) {
                                    errorTitle = '❌ Erreur serveur';
                                    errorMessage = 'Une erreur est survenue côté serveur. Veuillez réessayer plus tard.';
                                    toaster.error('❌ Erreur serveur lors de la création du produit');
                                    // ✅ AMÉLIORÉ: Extraire le message d'erreur détaillé du backend
                                    const backendError = error?.response?.data?.error || error?.error || error?.message;
                                    if (backendError && typeof backendError === 'string') {
                                        // Si le message contient des détails utiles, les afficher
                                        if (backendError.includes('Timeout') || backendError.includes('timeout')) {
                                            errorMessage = 'Le serveur a mis trop de temps à répondre. Veuillez réessayer dans quelques instants.\n\n' + 
                                                (backendError.includes('remboursé') ? 'Votre solde a été remboursé.' : '');
                                        } else if (backendError.includes('surchargée') || backendError.includes('surchargé')) {
                                            errorMessage = 'Le serveur est temporairement surchargé. Veuillez réessayer dans quelques instants.\n\n' + 
                                                (backendError.includes('remboursé') ? 'Votre solde a été remboursé.' : '');
                                        } else {
                                            errorMessage = backendError;
                                        }
                                    } else {
                                        errorMessage = 'Erreur serveur (500). Veuillez réessayer ou contacter le support.';
                                    }
                                } else if (error?.response?.status === 400) {
                                    errorTitle = '⚠️ Erreur de validation';
                                    errorMessage = error?.response?.data?.error || error?.message || 'Les données envoyées sont invalides. Veuillez vérifier les informations du produit.';
                                    toaster.error('⚠️ Erreur de validation');
                                } else if (error?.response?.status === 401) {
                                    errorTitle = '🔐 Erreur d\'authentification';
                                    errorMessage = 'Votre session a expiré. Veuillez vous reconnecter.';
                                    toaster.error('🔐 Session expirée');
                                } else if (error?.response?.data?.error) {
                                    errorMessage = error.response.data.error;
                                    toaster.error('❌ Erreur lors de la création du produit');
                                } else if (error?.message) {
                                    errorMessage = error.message;
                                    toaster.error(`❌ ${errorMessage}`);
                                } else {
                                    toaster.error('❌ Erreur lors de la création du produit');
                                }
                                
                                Alert.alert(errorTitle, errorMessage);
                            } finally {
                                setLoading(false);
                            }
                        }
                    }
                ]
            );
        } catch (error: any) {
            console.error('[AjouterProduitSimple] ❌ Erreur générale:', {
                message: error?.message,
                stack: error?.stack,
                name: error?.name,
                response: error?.response?.data,
                status: error?.response?.status,
                code: error?.code,
            });
            
            // ✅ AMÉLIORÉ: Afficher un message d'erreur plus détaillé
            let errorMessage = 'Impossible d\'ajouter le produit.';
            let errorTitle = 'Erreur';
            
            // Gérer les erreurs selon leur type
            if (error?.code === 'TIMEOUT' || error?.message?.includes('timeout') || error?.message?.includes('Timeout')) {
                errorTitle = '⏱️ Timeout';
                errorMessage = 'La requête a pris trop de temps. Cela peut être dû à une connexion lente ou un serveur surchargé.\n\nVeuillez réessayer dans quelques instants.';
            } else if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network request failed') || error?.message?.includes('Failed to fetch')) {
                errorTitle = '🌐 Erreur réseau';
                errorMessage = 'Impossible de se connecter au serveur. Vérifiez votre connexion internet et réessayez.';
            } else if (error?.response?.status === 500) {
                errorTitle = '❌ Erreur serveur';
                // ✅ AMÉLIORÉ: Extraire le message d'erreur détaillé du backend
                const backendError = error?.response?.data?.error || error?.error || error?.message;
                if (backendError && typeof backendError === 'string') {
                    // Si le message contient des détails utiles, les afficher
                    if (backendError.includes('Timeout') || backendError.includes('timeout')) {
                        errorMessage = 'Le serveur a mis trop de temps à répondre. Veuillez réessayer dans quelques instants.\n\n' + 
                            (backendError.includes('remboursé') ? 'Votre solde a été remboursé.' : '');
                    } else if (backendError.includes('surchargée') || backendError.includes('surchargé')) {
                        errorMessage = 'Le serveur est temporairement surchargé. Veuillez réessayer dans quelques instants.\n\n' + 
                            (backendError.includes('remboursé') ? 'Votre solde a été remboursé.' : '');
                    } else {
                        errorMessage = backendError;
                    }
                } else {
                    errorMessage = 'Erreur serveur (500). Veuillez réessayer ou contacter le support.';
                }
            } else if (error?.response?.status === 400) {
                errorTitle = '⚠️ Erreur de validation';
                errorMessage = error?.response?.data?.error || error?.message || 'Les données envoyées sont invalides. Veuillez vérifier les informations du produit.';
            } else if (error?.response?.status === 401) {
                errorTitle = '🔐 Erreur d\'authentification';
                errorMessage = 'Votre session a expiré. Veuillez vous reconnecter.';
            } else if (error?.response?.data?.error) {
                errorMessage = error.response.data.error;
            } else if (error?.message) {
                errorMessage = error.message;
            }
            
            Alert.alert('Erreur', errorMessage);
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
                    ref={mainScrollViewRef}
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled={true} // ✅ CORRIGÉ: Permettre le scroll horizontal des images dans MediaUploadManager
                    keyboardShouldPersistTaps="handled" // ✅ OPTIMISATION: Éviter les conflits de clavier
                    scrollEventThrottle={16} // ✅ OPTIMISATION: Limiter la fréquence des événements de scroll
                    removeClippedSubviews={true} // ✅ OPTIMISATION: Améliorer les performances
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
                            />
                        </View>

                        {/* Catégorie */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Catégorie du produit / prestation</Text>
                            <NativeInput
                                placeholder="Ex: Smartphone, Cours particulier, Service de réparation..."
                                value={formValues.categorie_produit}
                                onChangeText={(value) => handleFieldChange('categorie_produit', value)}
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

                        {/* ✅ NOUVEAU: Quantité disponible (uniquement pour les produits) */}
                        {!isPrestation && (
                            <View style={{ marginBottom: 12 }}>
                                <Text style={{ fontSize: 12, color: modernColors.textSecondary, marginBottom: 4, fontStyle: 'italic' }}>
                                    ⚠️ Quantité obligatoire pour les produits
                                </Text>
                                <Text style={{ fontSize: 11, color: modernColors.textSecondary, marginBottom: 8 }}>
                                    La gestion du stock permet d'éviter les ventes de produits épuisés et d'améliorer l'expérience de vos clients.
                                </Text>
                            </View>
                        )}
                        {!isPrestation && (
                            <View style={styles.fieldGroup}>
                                <Text style={styles.label}>Quantité disponible</Text>
                                <NativeInput
                                    placeholder="Ex: 50"
                                    value={formValues.quantite_disponible?.toString() || ''}
                                    onChangeText={(text) => {
                                        const numValue = text.trim() === '' ? null : parseInt(text, 10);
                                        handleFieldChange('quantite_disponible', isNaN(numValue as any) ? null : numValue);
                                    }}
                                    keyboardType="numeric"
                                    style={styles.fieldInput}
                                />
                                <Text style={styles.helperText}>Nombre d'unités disponibles en stock</Text>
                            </View>
                        )}

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
                                        
                                        // ✅ DEBUG: Logger les données d'entrée pour diagnostiquer
                                        console.log('[AjouterProduitSimple] 🔍 Construction depuis product_vector/product_labels:', {
                                            product_vector: formValues.product_vector,
                                            product_labels: formValues.product_labels,
                                            length_vector: formValues.product_vector.length,
                                            length_labels: formValues.product_labels.length
                                        });
                                        
                                        formValues.product_vector.forEach((value: string, index: number) => {
                                            const label = formValues.product_labels[index];
                                            console.log(`[AjouterProduitSimple] 🔍 Index ${index}: label="${label}", value="${value}"`);
                                            
                                            if (label && typeof label === 'string' && value && typeof value === 'string') {
                                                // ✅ CRITIQUE: Chaque valeur doit être associée à son label correspondant par index
                                                // Si le label existe déjà, on ajoute la valeur (cas où même label apparaît plusieurs fois)
                                                if (!sousCaracsFromPreferred[label]) {
                                                    sousCaracsFromPreferred[label] = [value];
                                                    console.log(`[AjouterProduitSimple] ✅ Nouveau label créé: "${label}" = ["${value}"]`);
                                                } else {
                                                    // Si le label existe déjà, ajouter la valeur (pour gérer les labels dupliqués)
                                                    const existingValues = sousCaracsFromPreferred[label];
                                                    if (!existingValues.includes(value)) {
                                                        sousCaracsFromPreferred[label] = [value, ...existingValues];
                                                        console.log(`[AjouterProduitSimple] ✅ Label existant mis à jour: "${label}" = ["${value}", ...]`);
                                                    } else {
                                                        console.log(`[AjouterProduitSimple] ⚠️ Valeur déjà présente pour "${label}": "${value}"`);
                                                    }
                                                }
                                            } else {
                                                console.warn(`[AjouterProduitSimple] ⚠️ Index ${index}: label ou value invalide`, { label, value });
                                            }
                                        });
                                        
                                        console.log('[AjouterProduitSimple] ✅ Résultat construction depuis product_vector/product_labels:', sousCaracsFromPreferred);

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
                                    // ✅ CORRECTION: Logger en WARN car c'est un vrai problème - les caractéristiques devraient être disponibles
                                    console.warn('[AjouterProduitSimple] ⚠️ PROBLÈME: Aucune combinaison préférée trouvée après vérification de toutes les sources. Vérifier que:');
                                    console.warn('  - session_id est présent dans suggestionIA');
                                    console.warn('  - L\'API /api/combinations/session/{session_id} retourne des données');
                                    console.warn('  - formValues contient sous_caracteristiques ou product_vector/product_labels');
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

                        {/* Variabilité de prix - affichée uniquement si l'IA a détecté des variantes */}
                        {hasExistingVariants && (
                            <View style={styles.fieldGroup}>
                                <PriceVariantSelector
                                    label={isPrestation ? 'Variantes prestation' : 'Variantes produit'}
                                    variable={formValues.variabilite_prix?.variable || formValues.price_variant?.variable || (isPrestation ? 'formule' : 'option')}
                                    modalites={currentModalites}
                                    onChange={(modalites) => {
                                        // ✅ CORRECTION: Conserver la variable existante depuis les données IA
                                        const existingVariable = formValues.variabilite_prix?.variable || formValues.price_variant?.variable || (isPrestation ? 'formule' : 'option');
                                        handleFieldChange('variabilite_prix', {
                                            type_donnee: 'price_variant',
                                            variable: existingVariable,
                                            modalites,
                                            filtrable: true,
                                            origine_champs: 'formulaire'
                                        });
                                    }}
                                    defaultCurrency={formValues.devise_produit || variantCurrencyCurrent || initialCurrency}
                                    availableCurrencies={availableVariantCurrencies}
                                    helperText="Modifiez les variations détectées par l'IA (prix, stock, image)."
                                    showEmptyStateDetails={false}
                                />
                            </View>
                        )}

                        {/* Photos et vidéos */}
                        <View style={[styles.fieldGroup, { overflow: 'visible' }]}>
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
                                // ✅ OPTIMISATION: Callbacks pour gérer le scroll horizontal et éviter les conflits
                                onHorizontalScrollStart={() => {
                                    // Bloquer temporairement le scroll vertical pendant le scroll horizontal
                                    if (mainScrollViewRef.current) {
                                        mainScrollViewRef.current.setNativeProps({ scrollEnabled: false });
                                    }
                                }}
                                onHorizontalScrollEnd={() => {
                                    // Réactiver le scroll vertical après le scroll horizontal
                                    if (mainScrollViewRef.current) {
                                        mainScrollViewRef.current.setNativeProps({ scrollEnabled: true });
                                    }
                                }}
                            />
                        </View>

                        {/* Bouton de soumission */}
                        <NativeButton
                            title={submitLabel}
                            onPress={handleSubmit}
                            disabled={loading || isAddingProductLoading}
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

            {/* ✅ NOUVEAU: Modal de configuration de livraison */}
            {productDeliveryConfigData && (
                <ProductDeliveryConfigModal
                    visible={showProductDeliveryConfig}
                    onClose={() => {
                        setShowProductDeliveryConfig(false);
                        setProductDeliveryConfigData(null);
                        // Après fermeture, rediriger vers Mes Services
                        setTimeout(() => {
                            (navigation as any).navigate('Main', { screen: 'Services' });
                        }, 300);
                    }}
                    serviceId={productDeliveryConfigData.serviceId}
                    productIndex={productDeliveryConfigData.productIndex}
                    productName={productDeliveryConfigData.productName}
                    onSuccess={() => {
                        // Configuration sauvegardée avec succès
                        setShowProductDeliveryConfig(false);
                        setProductDeliveryConfigData(null);
                        Alert.alert(
                            '✅ Configuration terminée',
                            'Votre produit a été configuré avec succès !',
                            [
                                {
                                    text: 'OK',
                                    onPress: () => {
                                        (navigation as any).navigate('Main', { screen: 'Services' });
                                    }
                                }
                            ]
                        );
                    }}
                />
            )}
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

