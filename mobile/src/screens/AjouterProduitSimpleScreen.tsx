// @ts-nocheck
/**
 * AjouterProduitSimpleScreen - Formulaire simple pour ajouter un produit à un service existant
 * Affiche UNIQUEMENT les champs produit, pas le formulaire complet
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    DeviceEventEmitter,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { KeyboardAwareScreen } from '../components/KeyboardAwareScreen';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import LinearAutocompleteEditor from '../components/LinearAutocompleteEditor';
import LocationSelector, { LocationObject } from '../components/LocationSelector';
import ModernGPSModal from '../components/ModernGPSModal';
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
import DeliveryAutoConfigPromptModal from '../components/delivery/DeliveryAutoConfigPromptModal';

/**
 * ✅ CORRECTION DÉFINITIVE: Mapping intelligent des valeurs aux labels
 * Gère les cas où product_vector et product_labels ont des longueurs différentes
 * en utilisant les sous_caracteristiques pour mapper correctement chaque valeur à sa dimension
 */
const mapProductVectorToSousCaracteristiques = (
    productVector: string[],
    productLabels: string[],
    sousCaracteristiquesIA?: Record<string, string[]>
): Record<string, string[]> => {
    const sousCaracsObj: Record<string, string[]> = {};
    
    // Si longueurs identiques, mapping direct par index
    if (productVector.length === productLabels.length) {
        productVector.forEach((value: string, index: number) => {
            const label = productLabels[index];
            if (label && typeof label === 'string' && value && typeof value === 'string') {
                if (!sousCaracsObj[label]) {
                    sousCaracsObj[label] = [value];
                } else {
                    const existingValues = sousCaracsObj[label];
                    if (!existingValues.includes(value)) {
                        sousCaracsObj[label] = [value, ...existingValues];
                    }
                }
            }
        });
        return sousCaracsObj;
    }
    
    // Si longueurs différentes et sous_caracteristiques disponibles, mapping intelligent
    if (sousCaracteristiquesIA && typeof sousCaracteristiquesIA === 'object') {
        // Construire un index inversé : valeur -> dimensions possibles
        const valueToDimensions: Record<string, string[]> = {};
        const dimensionOrder: string[] = Object.keys(sousCaracteristiquesIA);
        
        for (const dimension of dimensionOrder) {
            const valuesArray = sousCaracteristiquesIA[dimension];
            if (Array.isArray(valuesArray)) {
                for (const possibleValue of valuesArray) {
                    const normalizedValue = String(possibleValue).trim().toLowerCase();
                    if (!valueToDimensions[normalizedValue]) {
                        valueToDimensions[normalizedValue] = [];
                    }
                    if (!valueToDimensions[normalizedValue].includes(dimension)) {
                        valueToDimensions[normalizedValue].push(dimension);
                    }
                }
            }
        }
        
        // Track des dimensions assignées
        const assignedDimensions = new Set<string>();
        const mappedValues: Array<{dimension: string, value: string}> = [];
        
        // Étape 1: Mapper les valeurs qui correspondent à une dimension
        for (const value of productVector) {
            if (!value || typeof value !== 'string') continue;
            
            const normalizedValue = value.trim().toLowerCase();
            const possibleDimensions = valueToDimensions[normalizedValue];
            
            if (possibleDimensions && possibleDimensions.length > 0) {
                // Prendre la première dimension non assignée, ou la première disponible
                const dimension = possibleDimensions.find(d => !assignedDimensions.has(d)) || possibleDimensions[0];
                mappedValues.push({ dimension, value });
                assignedDimensions.add(dimension);
            }
        }
        
        // Étape 2: Construire l'objet final dans l'ordre des dimensions
        for (const dimension of dimensionOrder) {
            const mapped = mappedValues.find(m => m.dimension === dimension);
            if (mapped) {
                if (!sousCaracsObj[dimension]) {
                    sousCaracsObj[dimension] = [];
                }
                if (!sousCaracsObj[dimension].includes(mapped.value)) {
                    sousCaracsObj[dimension].push(mapped.value);
                }
            }
        }
        
        // Étape 3: Ajouter les valeurs non mappées avec leur label par index si disponible
        for (let i = 0; i < productVector.length; i++) {
            const value = productVector[i];
            if (!value || typeof value !== 'string') continue;
            
            const alreadyMapped = mappedValues.some(m => m.value === value);
            if (!alreadyMapped && i < productLabels.length) {
                const label = productLabels[i];
                if (label && typeof label === 'string') {
                    if (!sousCaracsObj[label]) {
                        sousCaracsObj[label] = [];
                    }
                    if (!sousCaracsObj[label].includes(value)) {
                        sousCaracsObj[label].push(value);
                    }
                }
            }
        }
        
        return sousCaracsObj;
    }
    
    // Fallback: mapping par index avec les labels disponibles
    productVector.forEach((value: string, index: number) => {
        if (index < productLabels.length) {
            const label = productLabels[index];
            if (label && typeof label === 'string' && value && typeof value === 'string') {
                if (!sousCaracsObj[label]) {
                    sousCaracsObj[label] = [value];
                } else {
                    const existingValues = sousCaracsObj[label];
                    if (!existingValues.includes(value)) {
                        sousCaracsObj[label] = [value, ...existingValues];
                    }
                }
            }
        }
    });
    
    return sousCaracsObj;
};

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
    const mainScrollViewRef = useRef<KeyboardAwareScrollView>(null);
    // ✅ NOUVEAU: États pour le modal GPS (pour lieu_produit)
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
    // ✅ NOUVEAU: États pour le modal de configuration de livraison
    const [showProductDeliveryConfig, setShowProductDeliveryConfig] = useState(false);
    const [productDeliveryConfigData, setProductDeliveryConfigData] = useState<{
        serviceId: number;
        productIndex: number;
        productName: string;
    } | null>(null);
    // ✅ NOUVEAU: État pour le modal de confirmation de livraison automatique
    const [showDeliveryAutoPrompt, setShowDeliveryAutoPrompt] = useState(false);
    
    // ✅ NOUVEAU: États pour la modal de confirmation de création de produit
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successModalData, setSuccessModalData] = useState<{
        serviceId: number;
        productIndex: number;
        productName: string;
        isPrestation: boolean;
        isDuplicate?: boolean; // ✅ NOUVEAU: Indique si c'est une duplication
    } | null>(null);

    // ✅ Phase de lancement (LAUNCH_PHASE_START_DATE) : coût affiché (0 = gratuit)
    const [productAddCost, setProductAddCost] = useState<number | null>(null);
    const [productAddIsFree, setProductAddIsFree] = useState<boolean | null>(null);

    useEffect(() => {
        if (!user?.id) return;
        apiGet<{ cost: number; is_free: boolean }>('/api/users/product-add-cost')
            .then((res) => {
                if (res.success && res.data) {
                    setProductAddCost(res.data.is_free ? 0 : res.data.cost);
                    setProductAddIsFree(res.data.is_free);
                }
            })
            .catch(() => {});
    }, [user?.id]);

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
    console.log('[AjouterProduitSimple] 🔍 suggestionIA reçu:', JSON.stringify(suggestionIA, null, 2));
    console.log('[AjouterProduitSimple] 🔍 suggestionIA.service_data présent?', !!suggestionIA?.service_data);
    console.log('[AjouterProduitSimple] 🔍 suggestionIA.service_data.data présent?', !!suggestionIA?.service_data?.data);
    console.log('[AjouterProduitSimple] 🔍 suggestionIA.data présent?', !!suggestionIA?.data);
    console.log('[AjouterProduitSimple] 🔍 suggestionIA.service_data complet:', JSON.stringify(suggestionIA?.service_data, null, 2));
    
    // ✅ CORRIGÉ: Extraire suggestionData avec toutes les sources possibles
    // 1. service_data.data (données complètes avec produits si présents)
    // 2. data (données de base du service)
    // 3. suggestionIA directement (fallback)
    const suggestionData = suggestionIA?.service_data?.data || suggestionIA?.data || suggestionIA || {};
    console.log('[AjouterProduitSimple] 🔍 suggestionData extrait:', JSON.stringify(suggestionData, null, 2));
    console.log('[AjouterProduitSimple] 🔍 suggestionData a des données produit?', !!(suggestionData.nom_produit || suggestionData.prix_produit || suggestionData.produits || suggestionData.variabilite_prix));
    console.log('[AjouterProduitSimple] 🔍 suggestionData.titre_service:', suggestionData.titre_service);
    console.log('[AjouterProduitSimple] 🔍 suggestionData.category:', suggestionData.category);
    console.log('[AjouterProduitSimple] 🔍 suggestionData.description:', suggestionData.description);

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

    // ✅ CORRIGÉ: En mode edit/duplicate, fusionner prefill.images avec mediaData pour s'assurer que tous les médias sont chargés
    const prefilledImagesFromMediaData = isEditing || isDuplicate 
        ? combineUnique(
            prefilledImages,
            normalizeMediaList(mediaData?.base64_image),
            normalizeMediaList(mediaData?.image_base64)
        )
        : prefilledImages;

    const prefilledVideosFromMediaData = isEditing || isDuplicate
        ? combineUnique(
            prefilledVideos,
            normalizeMediaList(mediaData?.video_base64),
            normalizeMediaList(mediaData?.videos)
        )
        : prefilledVideos;

    const prefilledAudiosFromMediaData = isEditing || isDuplicate
        ? combineUnique(
            prefilledAudios,
            normalizeMediaList(mediaData?.audio_base64)
        )
        : prefilledAudios;

    const prefilledDocumentsFromMediaData = isEditing || isDuplicate
        ? combineUnique(
            prefilledDocuments,
            normalizeMediaList(mediaData?.doc_base64)
        )
        : prefilledDocuments;

    // ✅ CORRECTION: S'assurer que les images de mediaData sont en première position
    // Priorité 1: mediaData.base64_image (image utilisée pour la création)
    // Priorité 2: Autres sources (suggestionData, etc.)
    const mediaDataImages = normalizeMediaList(mediaData?.base64_image || mediaData?.image_base64 || []);
    const otherImageSources = mergeImageSources(
        MAX_PRODUCT_IMAGES,
        suggestionData?.base64_image,
        suggestionData?.images,
        suggestionIA?.service_data?.base64_image
    );
    
    // Combiner en mettant mediaDataImages en premier
    const mergedImageSources: string[] = [];
    const seenImages = new Set<string>();
    
    // Ajouter d'abord les images de mediaData
    mediaDataImages.forEach(img => {
        if (img && !seenImages.has(img) && mergedImageSources.length < MAX_PRODUCT_IMAGES) {
            mergedImageSources.push(img);
            seenImages.add(img);
        }
    });
    
    // Puis ajouter les autres images
    otherImageSources.forEach(img => {
        if (img && !seenImages.has(img) && mergedImageSources.length < MAX_PRODUCT_IMAGES) {
            mergedImageSources.push(img);
            seenImages.add(img);
        }
    });

    const initialProductImages = prefilledImagesFromMediaData.length > 0 ? prefilledImagesFromMediaData : mergedImageSources;

    const mergedVideos = combineUnique(
        prefilledVideosFromMediaData,
        normalizeMediaList(mediaData?.video_base64),
        normalizeMediaList(mediaData?.videos),
        normalizeMediaList(suggestionData?.videos)
    );
    const initialProductVideos = mergedVideos;

    const initialProductAudios = combineUnique(
        prefilledAudiosFromMediaData,
        normalizeMediaList(mediaData?.audio_base64),
        normalizeMediaList(suggestionData?.audios)
    );

    const initialProductDocuments = combineUnique(
        prefilledDocumentsFromMediaData,
        normalizeMediaList(mediaData?.doc_base64),
        normalizeMediaList(suggestionData?.documents)
    );

    const typeOffre = extractValue(suggestionData.type_offre) || 'produit';
    const isPrestation = typeOffre === 'prestation' || typeOffre === 'service';

    // ✅ Détecter si l'IA a généré des données produit spécifiques
    const hasProductData = suggestionData.nom_produit || suggestionData.prix_produit || suggestionData.produits || suggestionData.variabilite_prix;

    // ✅ CORRIGÉ: Nom produit avec fallback sur titre_service (TOUJOURS utiliser le fallback si nom_produit est vide)
    let nom_produit = extractValue(suggestionData.nom_produit) || '';
    if (!nom_produit && suggestionData.titre_service) {
        nom_produit = extractValue(suggestionData.titre_service);
        console.log('[AjouterProduitSimple] ✅ nom_produit fallback depuis titre_service:', nom_produit);
    }

    // ✅ CORRIGÉ: Catégorie produit avec fallback sur category (TOUJOURS utiliser le fallback si categorie_produit est vide)
    let categorie_produit = extractValue(suggestionData.categorie_produit) || '';
    if (!categorie_produit && suggestionData.category) {
        categorie_produit = extractValue(suggestionData.category);
        console.log('[AjouterProduitSimple] ✅ categorie_produit fallback depuis category:', categorie_produit);
    }

    // ✅ CORRIGÉ: Description produit avec fallback sur description (TOUJOURS utiliser le fallback si description_produit est vide)
    let description_produit = extractValue(suggestionData.description_produit) || '';
    if (!description_produit && suggestionData.description) {
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
    
    // ✅ NOUVEAU 2026-01-04: Extraire variabilite_prix depuis suggestionData.produits.valeur[0] si présent
    // Les produits sont maintenant chargés depuis service_products et ajoutés dans data.produits.valeur
    if (!iaPriceVariant && suggestionData?.produits) {
        const produitsData = suggestionData.produits;
        // Extraire le tableau de produits (peut être dans .valeur ou directement)
        const produitsArray = Array.isArray(produitsData?.valeur)
            ? produitsData.valeur
            : Array.isArray(produitsData)
                ? produitsData
                : [];
        
        // Si on a au moins un produit, extraire variabilite_prix depuis le premier produit
        if (produitsArray.length > 0) {
            const firstProduct = produitsArray[0];
            if (firstProduct && typeof firstProduct === 'object') {
                const variantRaw = firstProduct.variabilite_prix || firstProduct.price_variant || firstProduct.variation_prix;
                if (variantRaw) {
                    // Si c'est un objet avec 'valeur', extraire la valeur
                    const variantValue = typeof variantRaw === 'object' && 'valeur' in variantRaw
                        ? variantRaw.valeur
                        : variantRaw;
                    if (variantValue && typeof variantValue === 'object' && 'modalites' in variantValue) {
                        iaPriceVariant = variantValue;
                        console.log('[AjouterProduitSimple] ✅ variabilite_prix extrait depuis suggestionData.produits.valeur[0]:', iaPriceVariant.modalites?.length || 0, 'modalités');
                    }
                }
            }
        }
    }
    
    const prefillPriceVariant =
        extractPriceVariant(prefill.variabilite_prix || prefill.price_variant) ||
        extractPriceVariant(prefill.produits);
    
    // ✅ NOUVEAU 2026-01-14: Si pas de prix_variation détecté mais qu'on a des sous-caractéristiques, générer automatiquement
    if (!iaPriceVariant && suggestionData?.produits?.sous_caracteristiques) {
        const produitsData = suggestionData.produits;
        const sousCaracs = produitsData.sous_caracteristiques;
        const productLabels = produitsData.product_labels || [];
        
        // Détecter les caractéristiques qui peuvent avoir des variations de prix
        const priceVariableLabels = ['taille', 'pointure', 'quantite', 'volume', 'poids', 'capacite'];
        const hasPriceVariable = productLabels.some((label: string) => 
            priceVariableLabels.includes(label.toLowerCase())
        );
        
        if (hasPriceVariable && Object.keys(sousCaracs).length > 0) {
            // Trouver le premier label qui peut avoir des variations de prix
            const variableLabel = productLabels.find((label: string) => 
                priceVariableLabels.includes(label.toLowerCase())
            );
            
            if (variableLabel && sousCaracs[variableLabel]) {
                const variableValues = sousCaracs[variableLabel];
                
                if (Array.isArray(variableValues) && variableValues.length > 0) {
                    // Générer des variations de prix basées sur les sous-caractéristiques
                    const modalites = variableValues.map((val: string) => ({
                        valeur: val,
                        prix: 0, // Prix par défaut, l'utilisateur devra le remplir
                        devise: 'XAF',
                        stock: null
                    }));
                    
                    iaPriceVariant = {
                        type_donnee: 'price_variant',
                        variable: variableLabel,
                        modalites: modalites,
                        filtrable: true,
                        origine_champs: 'auto_generated'
                    };
                    
                    console.log('[AjouterProduitSimple] ✅ Prix_variation généré automatiquement depuis sous-caractéristiques:', {
                        variable: variableLabel,
                        modalites_count: iaPriceVariant.modalites.length,
                        modalites: iaPriceVariant.modalites.map((m: any) => m.valeur)
                    });
                }
            }
        }
    }

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
    // ✅ CORRECTION DÉFINITIVE: Mapping intelligent même si longueurs différentes
    else if (suggestionData.produits?.product_vector && Array.isArray(suggestionData.produits.product_vector) &&
        suggestionData.produits.product_labels && Array.isArray(suggestionData.produits.product_labels) &&
        suggestionData.produits.product_vector.length > 0) {
        const sousCaracsObj: Record<string, string[]> = {};
        
        // ✅ DEBUG: Logger pour diagnostiquer
        console.log('[AjouterProduitSimple] 🔍 Construction initiale depuis product_vector/product_labels:', {
            product_vector: suggestionData.produits.product_vector,
            product_labels: suggestionData.produits.product_labels,
            length_vector: suggestionData.produits.product_vector.length,
            length_labels: suggestionData.produits.product_labels.length,
            sous_caracteristiques_ia: suggestionData.produits.sous_caracteristiques
        });
        
        // ✅ CORRECTION DÉFINITIVE: Utiliser la fonction helper pour mapping intelligent
        const iaSousCaracs = suggestionData.produits.sous_caracteristiques;
        const hasLengthMismatch = suggestionData.produits.product_vector.length !== suggestionData.produits.product_labels.length;
        
        if (hasLengthMismatch) {
            console.warn(`[AjouterProduitSimple] ⚠️ Incohérence détectée: ${suggestionData.produits.product_vector.length} valeurs pour ${suggestionData.produits.product_labels.length} labels. Mapping intelligent activé.`);
        }
        
        const mappedSousCaracs = mapProductVectorToSousCaracteristiques(
            suggestionData.produits.product_vector,
            suggestionData.produits.product_labels,
            iaSousCaracs
        );
        
        // Copier le résultat dans sousCaracsObj
        Object.assign(sousCaracsObj, mappedSousCaracs);
        
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
        // ✅ CORRECTION CRITIQUE: Utiliser productLabels pour garantir l'ordre correct
        else if (initialProduitsValues.length === 0) {
            const finalSousCaracs = sous_caracteristiques || prefill.sous_caracteristiques || {};
            if (finalSousCaracs && typeof finalSousCaracs === 'object' && Object.keys(finalSousCaracs).length > 0) {
                const firstValues: string[] = [];
                
                // ✅ CRITIQUE: Utiliser productLabels pour garantir l'ordre correct (au lieu de Object.entries qui ne garantit pas l'ordre)
                const orderedLabels = (productLabels && Array.isArray(productLabels) && productLabels.length > 0)
                    ? productLabels.filter(label => label && typeof label === 'string' && finalSousCaracs[label])
                    : Object.keys(finalSousCaracs);
                
                console.log('[AjouterProduitSimple] 🔍 Construction valeur depuis sous_caracteristiques:', {
                    orderedLabels,
                    sousCaracsKeys: Object.keys(finalSousCaracs),
                    productLabels: productLabels || 'non disponible'
                });
                
                // Parcourir les labels dans l'ordre garanti
                orderedLabels.forEach((label) => {
                    const values = finalSousCaracs[label];
                    if (Array.isArray(values) && values.length > 0 && typeof values[0] === 'string') {
                        // ✅ CRITIQUE: Prendre la PREMIÈRE valeur (valeur préférée par l'IA)
                        firstValues.push(values[0]);
                        console.log(`[AjouterProduitSimple] ✅ Ajout valeur pour "${label}": "${values[0]}"`);
                    } else {
                        console.warn(`[AjouterProduitSimple] ⚠️ Label "${label}" - Valeurs invalides ou vides:`, values);
                    }
                });
                
                if (firstValues.length > 0) {
                    initialProduitsValues = [firstValues.join(safeSeparateur)];
                    console.log('[AjouterProduitSimple] ✅ Valeur initiale construite depuis sous_caracteristiques (ordre garanti par productLabels):', initialProduitsValues[0]);
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
        // ✅ CRITIQUE: Pour les médias, utiliser prefill fusionné avec mediaData pour edit/duplicate
        // En mode edit/duplicate, fusionner les médias du prefill avec ceux de mediaData
        images: (isEditing || isDuplicate) ? prefilledImagesFromMediaData : initialProductImages,
        videos: (isEditing || isDuplicate) ? prefilledVideosFromMediaData : initialProductVideos,
        audios: (isEditing || isDuplicate) ? prefilledAudiosFromMediaData : initialProductAudios,
        documents: (isEditing || isDuplicate) ? prefilledDocumentsFromMediaData : initialProductDocuments,
        characteristic_vector: prefill.characteristic_vector ?? suggestionData?.characteristic_vector ?? null,
        combinaison_brute: prefill.combinaison_brute ?? suggestionData?.combinaison_brute ?? null,
        // ✅ NOUVEAU: Initialiser product_vector et product_labels depuis prefill en priorité
        // ✅ CORRECTION CRITIQUE: Extraire product_labels depuis suggestionData.produits même si produits est un objet structuré (type_donnee: 'autocomplete')
        product_vector: prefill.product_vector ?? (() => {
            // Vérifier si produits est un objet structuré avec type_donnee
            if (suggestionData.produits && typeof suggestionData.produits === 'object' && 'type_donnee' in suggestionData.produits) {
                // Si c'est un objet structuré, extraire depuis characteristic_vector ou product_vector
                return (suggestionData.produits.characteristic_vector && Array.isArray(suggestionData.produits.characteristic_vector) ? suggestionData.produits.characteristic_vector : undefined) ||
                       (suggestionData.produits.product_vector && Array.isArray(suggestionData.produits.product_vector) ? suggestionData.produits.product_vector : undefined);
            }
            // Sinon, extraction directe
            return (suggestionData.produits?.product_vector && Array.isArray(suggestionData.produits.product_vector) ? suggestionData.produits.product_vector : undefined);
        })(),
        product_labels: prefill.product_labels ?? (() => {
            // ✅ NOUVEAU 2026-02-07: PRIORITÉ 1: Extraire product_labels depuis prefill.produits (pour édition/duplication)
            // Vérifier si prefill.produits est un objet structuré avec type_donnee (comme dans FormulaireYukpoIntelligentScreen)
            if (prefill.produits && typeof prefill.produits === 'object' && 'type_donnee' in prefill.produits) {
                if (prefill.produits.type_donnee === 'autocomplete' && Array.isArray(prefill.produits.product_labels)) {
                    const labels = prefill.produits.product_labels.filter((label: any) => typeof label === 'string' && label.trim().length > 0);
                    if (labels.length > 0) {
                        console.log('[AjouterProduitSimple] ✅ product_labels extrait depuis prefill.produits (objet structuré):', labels);
                        return labels;
                    }
                }
            }
            // ✅ NOUVEAU 2026-02-07: PRIORITÉ 2: Extraire product_labels depuis le premier produit dans prefill.produits (si c'est un tableau)
            if (Array.isArray(prefill.produits) && prefill.produits.length > 0) {
                const firstProduct = prefill.produits[0];
                if (firstProduct && typeof firstProduct === 'object' && firstProduct.product_labels && Array.isArray(firstProduct.product_labels)) {
                    const labels = firstProduct.product_labels.filter((label: any) => typeof label === 'string' && label.trim().length > 0);
                    if (labels.length > 0) {
                        console.log('[AjouterProduitSimple] ✅ product_labels extrait depuis premier produit dans prefill.produits:', labels);
                        return labels;
                    }
                }
            }
            // ✅ PRIORITÉ 3: Extraire depuis prefill.sous_caracteristiques (pour édition/duplication)
            if (prefill.sous_caracteristiques && typeof prefill.sous_caracteristiques === 'object') {
                const keys = Object.keys(prefill.sous_caracteristiques);
                if (keys.length > 0) {
                    console.log('[AjouterProduitSimple] ✅ product_labels extrait depuis prefill.sous_caracteristiques (fallback):', keys);
                    return keys;
                }
            }
            // ✅ PRIORITÉ 4: Vérifier si suggestionData.produits est un objet structuré avec type_donnee
            if (suggestionData.produits && typeof suggestionData.produits === 'object' && 'type_donnee' in suggestionData.produits) {
                // Si c'est un objet structuré, extraire product_labels directement
                if (suggestionData.produits.product_labels && Array.isArray(suggestionData.produits.product_labels)) {
                    return suggestionData.produits.product_labels;
                }
            }
            // ✅ PRIORITÉ 5: Extraction directe depuis suggestionData.produits.product_labels
            if (suggestionData.produits?.product_labels && Array.isArray(suggestionData.produits.product_labels)) {
                return suggestionData.produits.product_labels;
            }
            // ✅ PRIORITÉ 6: Vérifier au niveau racine de suggestionData (pour les prestations)
            if (suggestionData.product_labels && Array.isArray(suggestionData.product_labels)) {
                return suggestionData.product_labels;
            }
            // ✅ PRIORITÉ 6B: Dériver depuis la première modalité (valeur[0]) pour alignement prestations / produits
            const produitsValeur = suggestionData.produits?.valeur;
            const rawValeur = Array.isArray(produitsValeur) ? produitsValeur : [];
            const sep = suggestionData.produits?.separateur ?? ',';
            const sousCaracsInit = suggestionData.produits?.sous_caracteristiques ?? suggestionData.sous_caracteristiques;
            if (rawValeur.length > 0 && sousCaracsInit && typeof sousCaracsInit === 'object' && Object.keys(sousCaracsInit).length > 0) {
                const firstMod = rawValeur[0];
                if (typeof firstMod === 'string' && firstMod.trim().length > 0) {
                    const parts = firstMod.split(sep).map((p: string) => p.trim()).filter((p: string) => p.length > 0);
                    const derived: string[] = [];
                    const used = new Set<string>();
                    for (const part of parts) {
                        const norm = part.toLowerCase().trim();
                        let keyFound: string | null = null;
                        for (const k of Object.keys(sousCaracsInit)) {
                            if (used.has(k)) continue;
                            const v = (sousCaracsInit as Record<string, unknown>)[k];
                            const arr = Array.isArray(v) ? v : (v != null ? [String(v)] : []);
                            if (arr.some((x: string) => String(x).toLowerCase().trim() === norm)) {
                                keyFound = k;
                                break;
                            }
                        }
                        if (keyFound) {
                            derived.push(keyFound);
                            used.add(keyFound);
                        }
                    }
                    if (derived.length > 0 && derived.length === parts.length) {
                        console.log('[AjouterProduitSimple] ✅ product_labels dérivé depuis première modalité (init):', derived);
                        return derived;
                    }
                }
            }
            // ✅ PRIORITÉ 7: Si on a des sous_caracteristiques, extraire les clés comme product_labels (fallback)
            if (suggestionData.produits?.sous_caracteristiques && typeof suggestionData.produits.sous_caracteristiques === 'object') {
                const keys = Object.keys(suggestionData.produits.sous_caracteristiques);
                if (keys.length > 0) {
                    console.log('[AjouterProduitSimple] ✅ product_labels extrait depuis produits.sous_caracteristiques (fallback):', keys);
                    return keys;
                }
            }
            // ✅ PRIORITÉ 8: Vérifier dans sous_caracteristiques au niveau racine
            if (suggestionData.sous_caracteristiques && typeof suggestionData.sous_caracteristiques === 'object') {
                const keys = Object.keys(suggestionData.sous_caracteristiques);
                if (keys.length > 0) {
                    console.log('[AjouterProduitSimple] ✅ product_labels extrait depuis sous_caracteristiques (niveau racine, fallback):', keys);
                    return keys;
                }
            }
            return undefined;
        })(),
    };

    // ✅ DEBUG: Logger les valeurs initiales pour diagnostiquer le problème
    console.log('[AjouterProduitSimple] 📝 Valeurs initiales extraites depuis IA:', {
        nom_produit: nom_produit || 'VIDE',
        categorie_produit: categorie_produit || 'VIDE',
        description_produit: description_produit || 'VIDE',
        prix_produit: prix_produit || 'VIDE',
        devise_produit: devise_produit || 'VIDE',
        hasProductData: hasProductData,
        typeOffre: typeOffre,
    });

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
        } else {
            // ✅ DEBUG: Logger aussi en mode création pour diagnostiquer
            console.log('[AjouterProduitSimple] 📝 Mode création - Valeurs initiales formValues:', {
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
            });
        }
    }, [mode, prefill, initialFormValues]);

    const [formValues, setFormValues] = useState<any>(initialFormValues);
    
    // ✅ NOUVEAU: Mettre à jour formValues quand prefill ou mediaData changent en mode édition
    React.useEffect(() => {
        if (isEditing || isDuplicate) {
            // Recalculer les médias depuis prefill et mediaData à chaque fois que prefill ou mediaData changent
            const currentPrefilledImages = normalizeMediaList(prefill.images);
            const currentPrefilledVideos = normalizeMediaList(prefill.videos);
            const currentPrefilledAudios = normalizeMediaList(prefill.audios);
            const currentPrefilledDocuments = normalizeMediaList(prefill.documents);
            
            const currentMediaDataImages = combineUnique(
                normalizeMediaList(mediaData?.base64_image),
                normalizeMediaList(mediaData?.image_base64)
            );
            const currentMediaDataVideos = combineUnique(
                normalizeMediaList(mediaData?.video_base64),
                normalizeMediaList(mediaData?.videos)
            );
            const currentMediaDataAudios = normalizeMediaList(mediaData?.audio_base64);
            const currentMediaDataDocuments = normalizeMediaList(mediaData?.doc_base64);
            
            const updatedImages = combineUnique(currentPrefilledImages, currentMediaDataImages);
            const updatedVideos = combineUnique(currentPrefilledVideos, currentMediaDataVideos);
            const updatedAudios = combineUnique(currentPrefilledAudios, currentMediaDataAudios);
            const updatedDocuments = combineUnique(currentPrefilledDocuments, currentMediaDataDocuments);
            
            console.log('[AjouterProduitSimple] 🔄 Mise à jour formValues avec médias en mode édition:', {
                prefill_images: currentPrefilledImages.length,
                mediaData_images: currentMediaDataImages.length,
                final_images: updatedImages.length,
                prefill_videos: currentPrefilledVideos.length,
                mediaData_videos: currentMediaDataVideos.length,
                final_videos: updatedVideos.length,
                first_image: updatedImages[0] ? (typeof updatedImages[0] === 'string' ? updatedImages[0].substring(0, 50) + '...' : typeof updatedImages[0]) : 'none',
            });
            
            // ✅ CORRIGÉ: Mettre à jour seulement si les médias ont changé
            setFormValues((prev: any) => {
                const imagesChanged = JSON.stringify(prev.images || []) !== JSON.stringify(updatedImages);
                const videosChanged = JSON.stringify(prev.videos || []) !== JSON.stringify(updatedVideos);
                
                if (imagesChanged || videosChanged) {
                    return {
                        ...prev,
                        images: updatedImages,
                        videos: updatedVideos,
                        audios: updatedAudios,
                        documents: updatedDocuments,
                    };
                }
                return prev;
            });
        }
    }, [isEditing, isDuplicate, prefill, mediaData]);

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
            // ✅ CORRIGÉ: Extraire session_id depuis toutes les sources possibles
            const sessionId = suggestionIA?.session_id 
                || suggestionIA?.data?.session_id 
                || suggestionIA?.service_data?.session_id
                || suggestionIA?.service_data?.data?.session_id;
            
            console.log('[AjouterProduitSimple] 🔍 Extraction session_id:', {
                sessionId,
                from_suggestionIA_session_id: !!suggestionIA?.session_id,
                from_suggestionIA_data_session_id: !!suggestionIA?.data?.session_id,
                from_service_data_session_id: !!suggestionIA?.service_data?.session_id,
                from_service_data_data_session_id: !!suggestionIA?.service_data?.data?.session_id,
            });
            const hasProduits = formValues.produits && Array.isArray(formValues.produits) && formValues.produits.length > 0;
            const hasSousCaracs = formValues.sous_caracteristiques && typeof formValues.sous_caracteristiques === 'object' && Object.keys(formValues.sous_caracteristiques).length > 0;

            // ✅ CORRIGÉ: Charger si session_id existe ET (produits vide OU sous_caracteristiques vide)
            if (sessionId && (!hasProduits || !hasSousCaracs)) {
                hasLoadedCombinations.current = true; // ✅ Marquer comme chargé pour éviter les re-renders
                try {
                    const combinationsResponse = await apiGet(`/api/combinations/session/${sessionId}`);
                    console.log('[AjouterProduitSimple] 🔍 Réponse API combinations:', {
                        success: combinationsResponse?.success,
                        hasData: !!combinationsResponse?.data,
                        dataType: Array.isArray(combinationsResponse?.data) ? 'array' : typeof combinationsResponse?.data,
                        dataLength: Array.isArray(combinationsResponse?.data) ? combinationsResponse.data.length : 0,
                        count: combinationsResponse?.count,
                        fullResponse: combinationsResponse
                    });
                    
                    // ✅ CORRIGÉ: L'API backend retourne { success: true, data: combinations[], count: number }
                    // Donc on doit utiliser combinationsResponse?.data au lieu de combinationsResponse?.combinations
                    const combinations = combinationsResponse?.data || combinationsResponse?.combinations || [];
                    if (Array.isArray(combinations) && combinations.length > 0) {
                        // Trouver la combinaison préférée par l'IA (is_ai_preferred = true)
                        const preferred = combinations.find((c: any) => c.is_ai_preferred);

                        if (preferred && preferred.product_vector && Array.isArray(preferred.product_vector) && preferred.product_vector.length > 0) {
                            // Construire la valeur au format attendu (string concaténée avec séparateur)
                            const separateur = preferred.separateur || ',';
                            const combinationString = preferred.product_vector.join(separateur);

                            // ✅ CORRECTION: Convertir product_labels (tableau) en objet pour sous_caracteristiques
                            // product_labels est un tableau qui correspond à l'ordre de product_vector
                            // On doit le convertir en objet { dimension: [valeurs] } pour sous_caracteristiques
                            // ✅ CORRECTION DÉFINITIVE: Utiliser la fonction helper pour mapping intelligent
                            const sousCaracsObj = mapProductVectorToSousCaracteristiques(
                                preferred.product_vector,
                                preferred.product_labels || [],
                                preferred.sous_caracteristiques
                            );

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
                        console.log('[AjouterProduitSimple] 🔍 Retry réponse API combinations:', {
                            success: retryResponse?.success,
                            hasData: !!retryResponse?.data,
                            dataType: Array.isArray(retryResponse?.data) ? 'array' : typeof retryResponse?.data,
                            dataLength: Array.isArray(retryResponse?.data) ? retryResponse.data.length : 0,
                        });
                        
                        // ✅ CORRIGÉ: Utiliser retryResponse?.data au lieu de retryResponse?.combinations
                        const retryCombinations = retryResponse?.data || retryResponse?.combinations || [];
                        if (Array.isArray(retryCombinations) && retryCombinations.length > 0) {
                            const preferred = retryCombinations.find((c: any) => c.is_ai_preferred);
                            if (preferred && preferred.product_vector && Array.isArray(preferred.product_vector) && preferred.product_vector.length > 0) {
                                const separateur = preferred.separateur || ',';
                                const combinationString = preferred.product_vector.join(separateur);
                                // ✅ CORRECTION DÉFINITIVE: Utiliser la fonction helper pour mapping intelligent
                                const sousCaracsObj = mapProductVectorToSousCaracteristiques(
                                    preferred.product_vector,
                                    preferred.product_labels || [],
                                    preferred.sous_caracteristiques
                                );
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
        // ✅ Phase de lancement (LAUNCH_PHASE_START_DATE) : coût 0 si gratuit, sinon 2000 FCFA
        try {
            // ✅ ÉTAPE 1 : Coût effectif (backend = phase lancement ou 1er produit = gratuit)
            console.log('💰 [AjouterProduitSimple] Vérification coût effectif et solde...');
            const [costResponse, balanceResponse] = await Promise.all([
                apiGet<{ cost: number; is_free: boolean }>('/api/users/product-add-cost'),
                apiGet<{ tokens_balance: number }>('/api/users/balance')
            ]);

            const effectiveCost = (costResponse.success && costResponse.data)
                ? (costResponse.data.is_free ? 0 : costResponse.data.cost)
                : 2000; // fallback si API absente
            const isFree = effectiveCost === 0;

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
            console.log('💰 [AjouterProduitSimple] ✅ Solde:', soldeActuel, 'Coût effectif:', effectiveCost, isFree ? '(gratuit - phase lancement)' : 'FCFA');

            // Bloquer seulement si coût > 0 et solde insuffisant
            if (effectiveCost > 0 && soldeActuel < effectiveCost) {
                Alert.alert(
                    '💸 Solde insuffisant',
                    `Coût d'ajout de produit : ${effectiveCost.toLocaleString()} FCFA\nVotre solde : ${soldeActuel.toLocaleString()} FCFA\n\nVeuillez recharger votre compte pour ajouter ce produit.`,
                    [{ text: 'OK' }]
                );
                return;
            }

            // ✅ ÉTAPE 2 : Confirmation avec message adapté (gratuit ou coût)
            const actionTitle = isDuplicate ? '💰 Duplication de produit' : '💰 Ajout de produit';
            const confirmationMessage = isFree
                ? `🆓 Gratuit (période de lancement)\n\nConfirmez-vous l'${isDuplicate ? 'duplication' : 'ajout'} de ce produit à votre service ?`
                : `Coût : ${effectiveCost.toLocaleString()} FCFA\n` +
                  `Votre solde : ${soldeActuel.toLocaleString()} FCFA\n` +
                  `Solde après ${isDuplicate ? 'duplication' : 'ajout'} : ${(soldeActuel - effectiveCost).toLocaleString()} FCFA\n\n` +
                  (isDuplicate
                      ? 'Confirmez-vous la duplication de ce produit sur votre service ?'
                      : 'Confirmez-vous l\'ajout de ce produit à votre service ?');

            console.log('[AjouterProduitSimple] 📋 Confirmation création produit:', {
                serviceId,
                productName: formValues.nom_produit,
                cost: effectiveCost,
                is_free: isFree,
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

                                // ✅ CORRECTION: Inclure sous_caracteristiques dans le payload (OBJET COMPLET avec valeurs)
                                if (formValues.sous_caracteristiques && typeof formValues.sous_caracteristiques === 'object') {
                                    nouveauProduit.sous_caracteristiques = formValues.sous_caracteristiques;
                                    
                                    // ✅ CORRECTION CRITIQUE: Prioriser product_labels depuis formValues si disponible (ordre garanti)
                                    // Sinon utiliser Object.keys() comme fallback (ordre non garanti)
                                    if (!nouveauProduit.product_labels) {
                                        if (formValues.product_labels && Array.isArray(formValues.product_labels) && formValues.product_labels.length > 0) {
                                            nouveauProduit.product_labels = formValues.product_labels.filter((label: any) => typeof label === 'string' && label.trim().length > 0);
                                            console.log('[AjouterProduitSimple] ✅ product_labels préservé depuis formValues (ordre garanti):', nouveauProduit.product_labels);
                                        } else {
                                            const sc = formValues.sous_caracteristiques || {};
                                            const produitsArr = Array.isArray(formValues.produits) ? formValues.produits : [];
                                            if (produitsArr.length > 0 && Object.keys(sc).length > 0) {
                                                const firstMod = produitsArr[0];
                                                if (typeof firstMod === 'string' && firstMod.trim().length > 0) {
                                                    const parts = firstMod.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0);
                                                    const derived: string[] = [];
                                                    const used = new Set<string>();
                                                    for (const part of parts) {
                                                        const norm = part.toLowerCase().trim();
                                                        let keyFound: string | null = null;
                                                        for (const k of Object.keys(sc)) {
                                                            if (used.has(k)) continue;
                                                            const v = (sc as Record<string, unknown>)[k];
                                                            const arr = Array.isArray(v) ? v : (v != null ? [String(v)] : []);
                                                            if (arr.some((x: string) => String(x).toLowerCase().trim() === norm)) {
                                                                keyFound = k;
                                                                break;
                                                            }
                                                        }
                                                        if (keyFound) {
                                                            derived.push(keyFound);
                                                            used.add(keyFound);
                                                        }
                                                    }
                                                    if (derived.length > 0 && derived.length === parts.length) {
                                                        nouveauProduit.product_labels = derived;
                                                        console.log('[AjouterProduitSimple] ✅ product_labels dérivé depuis première modalité (sauvegarde):', nouveauProduit.product_labels);
                                                    } else {
                                                        nouveauProduit.product_labels = Object.keys(sc);
                                                    }
                                                } else {
                                                    nouveauProduit.product_labels = Object.keys(sc);
                                                }
                                            } else {
                                                nouveauProduit.product_labels = Object.keys(sc);
                                                if (Object.keys(sc).length > 0) {
                                                    console.warn('[AjouterProduitSimple] ⚠️ Utilisation Object.keys() pour product_labels - ordre non garanti');
                                                }
                                            }
                                        }
                                    }
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

                                        // ✅ NOUVEAU 2026-01-04: Ouvrir automatiquement l'écran de configuration de livraison après modification
                                        const finalServiceId = typeof serviceId === 'number' ? serviceId : parseInt(String(serviceId), 10);
                                        const finalProductIndex = productIndex ?? 0;
                                        const productName = formValues.nom_produit || 'Produit';

                                        setShowProductDeliveryConfig(true);
                                        setProductDeliveryConfigData({
                                            serviceId: finalServiceId,
                                            productIndex: finalProductIndex,
                                            productName: productName
                                        });
                                    } catch (error: any) {
                                        console.error('[AjouterProduitSimple] Erreur mise à jour produit:', error);
                                        Alert.alert('Erreur', error.message || 'Impossible de mettre à jour le produit');
                                    } finally {
                                        setLoading(false);
                                    }
                                    return;
                                }

                                // ✅ ÉTAPE 4 : Appeler /api/services/{serviceId}/products (effectiveCost = 0 si phase lancement)
                                const userId = parseInt(user?.id || '0', 10);
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
                                    nom_produit: productDataForAPI.nom_produit || productDataForAPI.nom,
                                    description_produit: productDataForAPI.description_produit || 'ABSENT',
                                    description: productDataForAPI.description || 'ABSENT',
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

                                const responseData: any = response.data ?? {};
                                const costPaid = Number(responseData.cost ?? effectiveCost);
                                const newBalanceValue = Number(responseData.new_balance ?? (soldeActuel - effectiveCost));
                                
                                // ✅ NOUVEAU 2026-01-02: Vérifier si c'est une queue asynchrone (job_id présent)
                                const jobId = responseData.job_id;
                                
                                if (jobId) {
                                    // ✅ NOUVEAU: Le backend utilise une queue asynchrone, il faut interroger le statut
                                    console.log('[AjouterProduitSimple] 🔄 Job créé, interrogation du statut (job_id:', jobId, ')');
                                    toaster.info('⏳ Création du produit en cours...');
                                    
                                    // Fonction pour interroger le statut du job
                                    const pollJobStatus = async (): Promise<{ productIndex: number | null; error: string | null }> => {
                                        const maxAttempts = 60; // 60 tentatives max (5 minutes avec intervalle de 5s)
                                        const pollInterval = 5000; // 5 secondes entre chaque tentative
                                        
                                        for (let attempt = 0; attempt < maxAttempts; attempt++) {
                                            try {
                                                await new Promise(resolve => setTimeout(resolve, pollInterval));
                                                
                                                const statusResponse = await apiGet(`/api/services/${serviceId}/products/queue/${jobId}`);
                                                
                                                if (!statusResponse.success) {
                                                    console.warn('[AjouterProduitSimple] ⚠️ Erreur récupération statut job:', statusResponse.error);
                                                    continue;
                                                }
                                                
                                                const statusData: any = statusResponse.data ?? {};
                                                const jobStatus = statusData.status;
                                                
                                                console.log('[AjouterProduitSimple] 📊 Statut job:', jobStatus, '(tentative', attempt + 1, '/', maxAttempts, ')');
                                                
                                                if (jobStatus === 'completed') {
                                                    // Job terminé avec succès, extraire product_index depuis result_data
                                                    const resultData = statusData.result;
                                                    if (resultData && typeof resultData === 'object') {
                                                        const productIndex = resultData.product_index ?? resultData.data?.product_index;
                                                        if (typeof productIndex === 'number') {
                                                            console.log('[AjouterProduitSimple] ✅ Job terminé, product_index:', productIndex);
                                                            return { productIndex, error: null };
                                                        }
                                                    }
                                                    // Si pas de product_index dans result, essayer de le calculer depuis produits_data
                                                    console.warn('[AjouterProduitSimple] ⚠️ product_index non trouvé dans result_data, tentative extraction depuis produits_data');
                                                    return { productIndex: null, error: null }; // On continuera sans product_index
                                                } else if (jobStatus === 'failed') {
                                                    const errorMsg = statusData.error_message || 'Erreur lors de la création du produit';
                                                    console.error('[AjouterProduitSimple] ❌ Job échoué:', errorMsg);
                                                    return { productIndex: null, error: errorMsg };
                                                } else if (jobStatus === 'pending' || jobStatus === 'processing') {
                                                    // Continuer à interroger
                                                    continue;
                                                } else {
                                                    console.warn('[AjouterProduitSimple] ⚠️ Statut job inattendu:', jobStatus);
                                                    continue;
                                                }
                                            } catch (error: any) {
                                                console.error('[AjouterProduitSimple] ❌ Erreur interrogation statut job:', error);
                                                // Continuer à interroger malgré l'erreur
                                                continue;
                                            }
                                        }
                                        
                                        // Timeout après maxAttempts
                                        return { productIndex: null, error: 'Timeout: La création du produit a pris trop de temps' };
                                    };
                                    
                                    // Interroger le statut du job
                                    const jobResult = await pollJobStatus();
                                    
                                    if (jobResult.error) {
                                        throw new Error(jobResult.error);
                                    }
                                    
                                    // ✅ NOUVEAU: Afficher la modal de confirmation au lieu du toast
                                    const typeOffre = formValues.type_offre || 'produit';
                                    const isPrestation = typeOffre === 'prestation' || typeOffre === 'service';
                                    
                                    // Rafraîchir la liste des services pour afficher le nouveau produit
                                    setTimeout(() => {
                                      DeviceEventEmitter.emit('service:refresh');
                                      // ✅ NOUVEAU: Émettre aussi un événement spécifique pour les produits
                                      DeviceEventEmitter.emit('product:created');
                                    }, 2000);
                                    
                                    if (!isPrestation && jobResult.productIndex !== null && serviceId) {
                                        // C'est un produit, préparer les données pour la modal de confirmation
                                        const finalServiceId = typeof serviceId === 'string' ? parseInt(serviceId, 10) : serviceId;
                                        const finalProductIndex = jobResult.productIndex;
                                        const productName = formValues.nom_produit || 'Nouveau produit';
                                        
                                        // Afficher la modal de confirmation
                                        setSuccessModalData({
                                            serviceId: finalServiceId,
                                            productIndex: finalProductIndex,
                                            productName: productName,
                                            isPrestation: false,
                                            isDuplicate: isDuplicate, // ✅ NOUVEAU: Indiquer si c'est une duplication
                                        });
                                        setShowSuccessModal(true);
                                    } else {
                                        // C'est une prestation, afficher juste la modal de confirmation sans option de livraison
                                        setSuccessModalData({
                                            serviceId: typeof serviceId === 'string' ? parseInt(serviceId, 10) : serviceId,
                                            productIndex: -1,
                                            productName: formValues.nom_produit || 'Nouvelle prestation',
                                            isPrestation: true,
                                            isDuplicate: isDuplicate, // ✅ NOUVEAU: Indiquer si c'est une duplication
                                        });
                                        setShowSuccessModal(true);
                                    }
                                    
                                    setIsAddingProductLoading(false); // ✅ NOUVEAU: Désactiver le loading
                                    return;
                                }
                                
                                // ✅ ANCIEN CODE: Si pas de job_id, traitement synchrone (ancien format)
                                console.log('[AjouterProduitSimple] ✅ Produit ajouté avec succès (format synchrone):', response);
                                
                                // ✅ NOUVEAU: Afficher la modal de confirmation au lieu du toast
                                const productIndexResult =
                                    responseData.product_index ??
                                    (typeof responseData === 'object' && responseData.data ? responseData.data.product_index : undefined);
                                
                                // ✅ NOUVEAU: Si c'est un produit (pas une prestation), préparer l'ouverture de la configuration de livraison
                                const typeOffre = formValues.type_offre || 'produit';
                                const isPrestation = typeOffre === 'prestation' || typeOffre === 'service';
                                
                                // Rafraîchir la liste des services pour afficher le nouveau produit
                                setTimeout(() => {
                                  DeviceEventEmitter.emit('service:refresh');
                                  // ✅ NOUVEAU: Émettre aussi un événement spécifique pour les produits
                                  DeviceEventEmitter.emit('product:created');
                                }, 2000);
                                
                                if (!isPrestation && productIndexResult !== undefined && serviceId) {
                                    // C'est un produit, préparer les données pour la modal de confirmation
                                    const finalServiceId = typeof serviceId === 'string' ? parseInt(serviceId, 10) : serviceId;
                                    const finalProductIndex = typeof productIndexResult === 'number' ? productIndexResult : parseInt(String(productIndexResult), 10);
                                    const productName = formValues.nom_produit || 'Nouveau produit';
                                    
                                    // Afficher la modal de confirmation
                                    setSuccessModalData({
                                        serviceId: finalServiceId,
                                        productIndex: finalProductIndex,
                                        productName: productName,
                                        isPrestation: false,
                                        isDuplicate: isDuplicate, // ✅ NOUVEAU: Indiquer si c'est une duplication
                                    });
                                    setShowSuccessModal(true);
                                } else {
                                    // C'est une prestation, afficher juste la modal de confirmation sans option de livraison
                                    setSuccessModalData({
                                        serviceId: typeof serviceId === 'string' ? parseInt(serviceId, 10) : serviceId,
                                        productIndex: -1,
                                        productName: formValues.nom_produit || 'Nouvelle prestation',
                                        isPrestation: true,
                                        isDuplicate: isDuplicate, // ✅ NOUVEAU: Indiquer si c'est une duplication
                                    });
                                    setShowSuccessModal(true);
                                }
                                
                                // Rafraîchir la liste des services pour afficher le nouveau produit
                                setTimeout(() => {
                                  DeviceEventEmitter.emit('service:refresh');
                                  DeviceEventEmitter.emit('product:created');
                                }, 2000);
                                
                                setIsAddingProductLoading(false); // ✅ NOUVEAU: Désactiver le loading
                                return;
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
            <View style={styles.keyboardView}>
                <NavigatorToolbar
                    title={toolbarTitle}
                    subtitle={toolbarSubtitle}
                    showHandle={false}
                    density="compact"
                    backIcon="back"
                />

                <KeyboardAwareScreen
                    innerRef={mainScrollViewRef}
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
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
                                    // ✅ CORRECTION CRITIQUE: Préserver product_labels pour garantir l'alignement correct des labels et valeurs
                                    // Extraire productLabels depuis plusieurs emplacements possibles (même logique que dans productLabels prop)
                                    const currentProductLabels = (() => {
                                        // PRIORITÉ 1: formValues.product_labels
                                        if (Array.isArray(formValues.product_labels) && formValues.product_labels.length > 0) {
                                            return formValues.product_labels;
                                        }
                                        // PRIORITÉ 2: suggestionData.produits.product_labels (objet structuré)
                                        if (suggestionData?.produits && typeof suggestionData.produits === 'object' && 'type_donnee' in suggestionData.produits) {
                                            if (Array.isArray(suggestionData.produits.product_labels) && suggestionData.produits.product_labels.length > 0) {
                                                return suggestionData.produits.product_labels;
                                            }
                                        }
                                        // PRIORITÉ 3: suggestionData.produits.product_labels (direct)
                                        if (Array.isArray(suggestionData?.produits?.product_labels) && suggestionData.produits.product_labels.length > 0) {
                                            return suggestionData.produits.product_labels;
                                        }
                                        // PRIORITÉ 4: suggestionData.product_labels (niveau racine pour prestations)
                                        if (Array.isArray(suggestionData?.product_labels) && suggestionData.product_labels.length > 0) {
                                            return suggestionData.product_labels;
                                        }
                                        // PRIORITÉ 5: Dériver depuis la première modalité (values[0]) puis fallback Object.keys
                                        const sousCaracsForDerive = updatedSousCaracs || formValues.sous_caracteristiques || suggestionData?.produits?.sous_caracteristiques;
                                        if (sousCaracsForDerive && typeof sousCaracsForDerive === 'object' && values.length > 0) {
                                            const firstMod = values[0];
                                            if (typeof firstMod === 'string' && firstMod.trim().length > 0) {
                                                const parts = firstMod.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0);
                                                const derived: string[] = [];
                                                const used = new Set<string>();
                                                for (const part of parts) {
                                                    const norm = part.toLowerCase().trim();
                                                    let keyFound: string | null = null;
                                                    for (const k of Object.keys(sousCaracsForDerive)) {
                                                        if (used.has(k)) continue;
                                                        const v = (sousCaracsForDerive as Record<string, unknown>)[k];
                                                        const arr = Array.isArray(v) ? v : (v != null ? [String(v)] : []);
                                                        if (arr.some((x: string) => String(x).toLowerCase().trim() === norm)) {
                                                            keyFound = k;
                                                            break;
                                                        }
                                                    }
                                                    if (keyFound) {
                                                        derived.push(keyFound);
                                                        used.add(keyFound);
                                                    }
                                                }
                                                if (derived.length > 0 && derived.length === parts.length) {
                                                    return derived;
                                                }
                                            }
                                        }
                                        if (updatedSousCaracs && typeof updatedSousCaracs === 'object') {
                                            return Object.keys(updatedSousCaracs);
                                        }
                                        const sousCaracsComplets = formValues.sous_caracteristiques || suggestionData?.produits?.sous_caracteristiques;
                                        if (sousCaracsComplets && typeof sousCaracsComplets === 'object') {
                                            return Object.keys(sousCaracsComplets);
                                        }
                                        return undefined;
                                    })();
                                    
                                    if (currentProductLabels && currentProductLabels.length > 0) {
                                        handleFieldChange('product_labels', currentProductLabels);
                                        console.log('[AjouterProduitSimple] ✅ product_labels préservé lors de la modification:', currentProductLabels);
                                    }
                                }}
                                productVector={Array.isArray(formValues.product_vector) ? formValues.product_vector : undefined}
                                productLabels={(() => {
                                    // ✅ CORRECTION CRITIQUE: Extraire productLabels depuis plusieurs emplacements possibles
                                    // PRIORITÉ 1: formValues.product_labels
                                    if (Array.isArray(formValues.product_labels) && formValues.product_labels.length > 0) {
                                        return formValues.product_labels;
                                    }
                                    // PRIORITÉ 2: suggestionData.produits.product_labels (objet structuré)
                                    if (suggestionData?.produits && typeof suggestionData.produits === 'object' && 'type_donnee' in suggestionData.produits) {
                                        if (Array.isArray(suggestionData.produits.product_labels) && suggestionData.produits.product_labels.length > 0) {
                                            return suggestionData.produits.product_labels;
                                        }
                                    }
                                    // PRIORITÉ 3: suggestionData.produits.product_labels (direct)
                                    if (Array.isArray(suggestionData?.produits?.product_labels) && suggestionData.produits.product_labels.length > 0) {
                                        return suggestionData.produits.product_labels;
                                    }
                                    // PRIORITÉ 4: suggestionData.product_labels (niveau racine pour prestations)
                                    if (Array.isArray(suggestionData?.product_labels) && suggestionData.product_labels.length > 0) {
                                        return suggestionData.product_labels;
                                    }
                                    // PRIORITÉ 5: Dériver depuis la première modalité puis fallback Object.keys
                                    const sousCaracsComplets = formValues.produits?.sous_caracteristiques
                                        || formValues.sous_caracteristiques
                                        || suggestionData?.produits?.sous_caracteristiques
                                        || suggestionData?.sous_caracteristiques;
                                    if (sousCaracsComplets && typeof sousCaracsComplets === 'object') {
                                        const sep = ',';
                                        const produitsArr = Array.isArray(formValues.produits) ? formValues.produits : [];
                                        if (produitsArr.length > 0) {
                                            const firstMod = produitsArr[0];
                                            if (typeof firstMod === 'string' && firstMod.trim().length > 0) {
                                                const parts = firstMod.split(sep).map((p: string) => p.trim()).filter((p: string) => p.length > 0);
                                                const derived: string[] = [];
                                                const used = new Set<string>();
                                                for (const part of parts) {
                                                    const norm = part.toLowerCase().trim();
                                                    let keyFound: string | null = null;
                                                    for (const k of Object.keys(sousCaracsComplets)) {
                                                        if (used.has(k)) continue;
                                                        const v = (sousCaracsComplets as Record<string, unknown>)[k];
                                                        const arr = Array.isArray(v) ? v : (v != null ? [String(v)] : []);
                                                        if (arr.some((x: string) => String(x).toLowerCase().trim() === norm)) {
                                                            keyFound = k;
                                                            break;
                                                        }
                                                    }
                                                    if (keyFound) {
                                                        derived.push(keyFound);
                                                        used.add(keyFound);
                                                    }
                                                }
                                                if (derived.length > 0 && derived.length === parts.length) {
                                                    return derived;
                                                }
                                            }
                                        }
                                        const keys = Object.keys(sousCaracsComplets);
                                        if (keys.length > 0) {
                                            return keys;
                                        }
                                    }
                                    return undefined;
                                })()}
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
                                    // ✅ CORRECTION DÉFINITIVE: Si on n'a pas sous_caracteristiques complets, utiliser la combinaison préférée avec mapping intelligent
                                    if (formValues.product_vector && Array.isArray(formValues.product_vector) &&
                                        formValues.product_labels && Array.isArray(formValues.product_labels) &&
                                        formValues.product_vector.length > 0) {

                                        // ✅ Utiliser la fonction helper pour mapping intelligent (gère les longueurs différentes)
                                        const sousCaracsFromPreferred = mapProductVectorToSousCaracteristiques(
                                            formValues.product_vector,
                                            formValues.product_labels,
                                            formValues.sous_caracteristiques
                                        );
                                        
                                        console.log('[AjouterProduitSimple] 🔍 Construction depuis product_vector/product_labels:', {
                                            product_vector: formValues.product_vector,
                                            product_labels: formValues.product_labels,
                                            length_vector: formValues.product_vector.length,
                                            length_labels: formValues.product_labels.length,
                                            resultDimensions: Object.keys(sousCaracsFromPreferred)
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
                            <Text style={styles.label}>
                                Lieu de commercialisation <Text style={styles.required}>*</Text>
                            </Text>
                            <TouchableOpacity
                                style={[styles.select, !formValues.lieu_produit && styles.selectPlaceholder]}
                                onPress={() => {
                                    // Récupérer la localisation actuelle si disponible
                                    const currentValue = formValues.lieu_produit;
                                    if (typeof currentValue === 'object' && currentValue !== null && currentValue.coordinates) {
                                        setSelectedLocation({ lat: currentValue.coordinates.lat, lng: currentValue.coordinates.lng });
                                    } else {
                                        setSelectedLocation(null);
                                    }
                                    setShowGPSModal(true);
                                }}
                            >
                                <Text style={[styles.selectText, !formValues.lieu_produit && styles.selectPlaceholderText]}>
                                    {(() => {
                                        const currentValue = formValues.lieu_produit;
                                        if (typeof currentValue === 'object' && currentValue !== null) {
                                            return currentValue.place_name || currentValue.raw || 'Sélectionner un lieu...';
                                        }
                                        return typeof currentValue === 'string' ? currentValue : 'Sélectionner un lieu...';
                                    })()}
                                </Text>
                                <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                            </TouchableOpacity>
                            <Text style={styles.hint}>
                                💡 Cliquez pour ouvrir la carte et sélectionner ou créer un lieu précis. Le nom complet du lieu sera affiché.
                            </Text>
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
                            {(() => {
                                const imagesToPass = formValues.images || [];
                                const videosToPass = formValues.videos || [];
                                console.log('[AjouterProduitSimple] 📸 Passage des médias à MediaUploadManager:', {
                                    images_count: imagesToPass.length,
                                    videos_count: videosToPass.length,
                                    isEditing,
                                    isDuplicate,
                                    first_image: imagesToPass[0] ? (typeof imagesToPass[0] === 'string' ? imagesToPass[0].substring(0, 50) + '...' : typeof imagesToPass[0]) : 'none',
                                });
                                return null;
                            })()}
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

                        {/* Coût (phase lancement = gratuit) */}
                        {!isEditing && (
                            <View style={styles.costInfo}>
                                <SafeIcon name="info" size={16} color={modernColors.textSecondary} />
                                <Text style={styles.costText}>
                                    {productAddIsFree === true
                                        ? '🆓 Gratuit (période de lancement)'
                                        : `Coût: ${(productAddCost ?? 2000).toLocaleString('fr-FR')} FCFA (Solde: ${(user?.credits ?? 0).toLocaleString('fr-FR')} FCFA)`}
                                </Text>
                            </View>
                        )}
                    </NativeCard>
                </KeyboardAwareScreen>
            </View>

            {/* ✅ NOUVEAU: Modal GPS pour lieu_produit */}
            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => {
                    setShowGPSModal(false);
                }}
                onSelect={async (coordinatesString) => {
                    // Parser les coordonnées depuis le format string
                    const firstPoint = coordinatesString.split('|')[0].split(',');
                    if (firstPoint.length === 2) {
                        const lat = parseFloat(firstPoint[0]);
                        const lng = parseFloat(firstPoint[1]);
                        
                        if (!isNaN(lat) && !isNaN(lng)) {
                            setSelectedLocation({ lat, lng });

                            // ✅ CORRIGÉ 2026-01-12: Utiliser reverseGeocodeWithRetry avec retry et fallback
                            try {
                                const { reverseGeocodeWithRetry } = await import('../utils/reverseGeocoding');
                                const geocodeResult = await reverseGeocodeWithRetry(lat, lng, {
                                    fallbackAddress: coordinatesString
                                });
                                
                                if (geocodeResult) {
                                    const fullAddress = geocodeResult.address;
                                    
                                    // Construire un LocationObject avec le nom complet
                                    const locationObject: LocationObject = {
                                        raw: fullAddress,
                                        place_name: placeName, // Nom principal du lieu (établissement, rue, quartier)
                                        components: {
                                            quartier: addr.district || undefined,
                                            ville: addr.city || undefined,
                                            region: addr.region || undefined,
                                            pays: addr.country || undefined,
                                        },
                                        coordinates: { lat, lng },
                                    };
                                    
                                    // Sauvegarder dans le formulaire
                                    handleFieldChange('lieu_produit', locationObject);
                                } else {
                                    // Fallback si pas de géocodage inverse
                                    const locationObject: LocationObject = {
                                        raw: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                                        place_name: 'Lieu sélectionné',
                                        components: {},
                                        coordinates: { lat, lng },
                                    };
                                    handleFieldChange('lieu_produit', locationObject);
                                }
                            } catch (error) {
                                console.error('[AjouterProduitSimple] Erreur géocodage inverse:', error);
                                // Fallback en cas d'erreur
                                const locationObject: LocationObject = {
                                    raw: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                                    place_name: 'Lieu sélectionné',
                                    components: {},
                                    coordinates: { lat, lng },
                                };
                                handleFieldChange('lieu_produit', locationObject);
                            }
                        }
                    }

                    setShowGPSModal(false);
                }}
                currentLocation={selectedLocation}
                title="Sélectionner le lieu de commercialisation"
                allowZoneSelection={false}
            />

            {/* ✅ NOUVEAU: Modal de confirmation de création de produit */}
            <Modal
                visible={showSuccessModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => {
                    setShowSuccessModal(false);
                    setSuccessModalData(null);
                }}
            >
                <View style={styles.successModalOverlay}>
                    <View style={styles.successModalContent}>
                        <View style={styles.successModalIcon}>
                            <Text style={styles.successModalIconText}>✅</Text>
                        </View>
                        <Text style={styles.successModalTitle}>
                            {successModalData?.isDuplicate 
                                ? (successModalData?.isPrestation ? 'Prestation dupliquée avec succès !' : 'Produit dupliqué avec succès !')
                                : (successModalData?.isPrestation ? 'Prestation créée avec succès !' : 'Produit créé avec succès !')}
                        </Text>
                        <Text style={styles.successModalMessage}>
                            {successModalData?.isPrestation 
                                ? (successModalData?.isDuplicate 
                                    ? 'Votre prestation a été dupliquée avec succès.'
                                    : 'Votre prestation a été ajoutée à votre service.')
                                : (successModalData?.isDuplicate
                                    ? 'Votre produit a été dupliqué et ajouté à votre service avec succès.'
                                    : 'Votre produit a été ajouté à votre service avec succès.')}
                        </Text>
                        <NativeButton
                            title="Ok"
                            variant="primary"
                            onPress={async () => {
                                setShowSuccessModal(false);
                                
                                // ✅ NOUVEAU: Si c'est un produit (pas une prestation), afficher d'abord le modal de confirmation
                                if (successModalData && !successModalData.isPrestation && successModalData.productIndex >= 0) {
                                    // Afficher le modal de confirmation de livraison automatique
                                    setShowDeliveryAutoPrompt(true);
                                } else {
                                    // Pour les prestations, fermer directement
                                    setSuccessModalData(null);
                                }
                            }}
                            style={styles.successModalButton}
                        />
                    </View>
                </View>
            </Modal>

            {/* ✅ NOUVEAU: Modal de confirmation de livraison automatique */}
            {successModalData && !successModalData.isPrestation && successModalData.productIndex >= 0 && (
                <DeliveryAutoConfigPromptModal
                    visible={showDeliveryAutoPrompt}
                    productName={successModalData.productName}
                    onYes={async () => {
                        setShowDeliveryAutoPrompt(false);
                        // ✅ Attendre un délai pour permettre la synchronisation du produit
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        
                        setProductDeliveryConfigData({
                            serviceId: successModalData.serviceId,
                            productIndex: successModalData.productIndex,
                            productName: successModalData.productName,
                        });
                        setShowProductDeliveryConfig(true);
                        setSuccessModalData(null);
                    }}
                    onNo={() => {
                        setShowDeliveryAutoPrompt(false);
                        setSuccessModalData(null);
                        // Rediriger vers Mes Services
                        setTimeout(() => {
                            (navigation as any).navigate('Main', { screen: 'Services' });
                        }, 300);
                    }}
                />
            )}

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
    select: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#FFFFFF',
        minHeight: 50,
    },
    selectText: {
        fontSize: 14,
        color: modernColors.text,
        flex: 1,
    },
    selectPlaceholder: {
        borderColor: '#E5E7EB',
    },
    selectPlaceholderText: {
        color: modernColors.textSecondary,
    },
    required: {
        color: modernColors.danger || '#EF4444',
    },
    hint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 8,
        fontStyle: 'italic',
    },
    // ✅ NOUVEAU: Styles pour la modal de confirmation de création de produit
    successModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    successModalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    successModalIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#F0FDF4',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    successModalIconText: {
        fontSize: 32,
    },
    successModalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 12,
        textAlign: 'center',
    },
    successModalMessage: {
        fontSize: 16,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    successModalButton: {
        width: '100%',
        minWidth: 200,
    },
});

export default AjouterProduitSimpleScreen;

