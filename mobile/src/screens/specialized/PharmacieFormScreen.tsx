import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import GuardDaysSelector from '../../components/GuardDaysSelector';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
// ✅ SUPPRIMÉ: PartnerSelector - Les données partenaire sont chargées automatiquement depuis /api/partners/me
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import SimplePrestationSelector from '../../components/SimplePrestationSelector';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiDelete, apiGet, apiPatch, apiPost, servicesApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

// ✅ NOUVEAU: Interface pour les produits de pharmacie
interface PharmacyProduct {
    id: number;
    nom_produit: string;
    description?: string;
    prix: number;
    stock: number;
    unite: string;
    code_barre?: string;
    categorie?: string;
    created_at?: string;
    updated_at?: string;
}

const PharmacieFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);
    const specializedServiceId = (route.params as any)?.specializedServiceId as number | undefined;
    const mode = (route.params as any)?.mode as string | undefined;

    const [formData, setFormData] = useState({
        nom: '', // ✅ Sera rempli automatiquement depuis /api/partners/me
        adresse: '',
        quartier: null as LocationObject | null,
        // ✅ SUPPRIMÉ : ville (quartier contient déjà ville et pays)
        jours_garde: {} as Record<string, number[]>, // Format: { '2025-01': [1, 3, 5], ... }
        heures_ouverture: '08:00',
        heures_fermeture: '20:00',
        permanent_24h: false,
        telephone: '',
        telephone_urgence: '',
        whatsapp: '',
        email: '',
        services: [] as string[],
    });

    const [loading, setLoading] = useState(false);
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [selectedGPS, setSelectedGPS] = useState<string | null>(null);
    const [showGuardDaysModal, setShowGuardDaysModal] = useState(false);
    // ✅ NOUVEAU: Données du partenaire pour affichage dans l'en-tête
    const [partnerData, setPartnerData] = useState<any>(null);

    // ✅ NOUVEAU: États pour la gestion des médicaments
    const [products, setProducts] = useState<PharmacyProduct[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<PharmacyProduct | null>(null);
    const [productFormData, setProductFormData] = useState({
        nom_produit: '',
        description: '',
        prix: '',
        stock: '',
        unite: 'unité',
        code_barre: '',
        categorie: '',
    });
    // ✅ NOUVEAU: États pour fonctionnalités avancées
    const [searchQuery, setSearchQuery] = useState('');
    const [showBulkImportModal, setShowBulkImportModal] = useState(false);
    const [bulkImportText, setBulkImportText] = useState('');
    const [bulkImportOverwrite, setBulkImportOverwrite] = useState(false);
    const [loadingBulkImport, setLoadingBulkImport] = useState(false);

    const servicesOptions = ['Garde', 'Délivrance', 'Conseil', 'Vaccination', 'Pansements', 'Livraison à domicile', 'Préparation de médicaments'];
    const uniteOptions = ['unité', 'boîte', 'flacon', 'plaquette', 'tube', 'sachet', 'ampoule', 'comprimé'];
    const categorieOptions = ['Médicament', 'Parapharmacie', 'Accessoire médical', 'Hygiène', 'Nutrition', 'Autre'];

    // ✅ NOUVEAU: Filtrer les produits selon la recherche
    const filteredProducts = products.filter((product) => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
            product.nom_produit.toLowerCase().includes(query) ||
            (product.description && product.description.toLowerCase().includes(query)) ||
            (product.categorie && product.categorie.toLowerCase().includes(query)) ||
            (product.code_barre && product.code_barre.includes(query))
        );
    });

    // ✅ NOUVEAU: Calculer les statistiques
    const stats = {
        total: products.length,
        totalStock: products.reduce((sum, p) => sum + p.stock, 0),
        totalValue: products.reduce((sum, p) => sum + (p.prix * p.stock), 0),
        categories: Array.from(new Set(products.map(p => p.categorie).filter(Boolean))).length,
    };

    // ✅ NOUVEAU: Charger automatiquement les données partenaire depuis /api/partners/me
    useEffect(() => {
        const loadPartnerData = async () => {
            if (user?.role === 'partenaire' && user?.partner_type === 'pharmacie') {
                try {
                    const response = await apiGet('/api/partners/me');
                    if (response.success && response.data) {
                        const partner = response.data;
                        setPartnerData(partner); // ✅ Stocker pour affichage dans l'en-tête
                        // ✅ Pré-remplir silencieusement les champs pour l'envoi au backend (mais ne pas les afficher)
                        setFormData(prev => ({
                            ...prev,
                            nom: partner.name || prev.nom,
                            adresse: partner.address || partner.location_address || prev.adresse,
                            telephone: partner.contact_phone || prev.telephone,
                            email: partner.contact_email || prev.email,
                            quartier: partner.city ? {
                                raw: partner.city,
                                place_name: partner.city,
                                components: {
                                    ville: partner.city,
                                    pays: partner.country,
                                }
                            } : prev.quartier,
                        }));
                    }
                } catch (error) {
                    console.error('[PharmacieFormScreen] Erreur chargement partenaire:', error);
                }
            }
        };
        loadPartnerData();
    }, [user?.role, user?.partner_type]);

    // ✅ Créer automatiquement un service si serviceId manquant
    useEffect(() => {
        const createServiceIfNeeded = async () => {
            if (!serviceId && user?.id && formData.nom) {
                try {
                    const serviceData = {
                        titre_service: formData.nom || 'Pharmacie',
                        description: 'Pharmacie avec garde',
                        category: 'sante',
                    };

                    const response = await servicesApi.createService(serviceData);
                    if (response.success && response.data && typeof response.data === 'object' && 'id' in response.data) {
                        setServiceId((response.data as any).id);
                    }
                } catch (error: any) {
                    console.error('[PharmacieFormScreen] Erreur création service:', error);
                }
            }
        };

        if (!serviceId && formData.nom) {
            createServiceIfNeeded();
        }
    }, [formData.nom, serviceId, user?.id]);

    // ✅ NOUVEAU : Charger les données existantes si mode='edit' et specializedServiceId fourni
    useEffect(() => {
        const loadExistingData = async () => {
            if (mode === 'edit' && specializedServiceId && serviceId) {
                try {
                    setLoading(true);
                    const { apiGet } = require('../../services/api');
                    const response = await apiGet(`/api/pharmacies/${specializedServiceId}`);

                    if (response.success && response.data) {
                        const data = response.data;
                        setFormData({
                            nom: data.nom || '',
                            // ✅ Les données partenaire sont chargées automatiquement depuis /api/partners/me
                            adresse: data.adresse || '',
                            quartier: data.quartier ? { raw: data.quartier, place_name: data.quartier } : null,
                            jours_garde: data.jours_garde ? (typeof data.jours_garde === 'string' ? JSON.parse(data.jours_garde) : data.jours_garde) : {},
                            heures_ouverture: data.heures_ouverture || '08:00',
                            heures_fermeture: data.heures_fermeture || '20:00',
                            permanent_24h: data.permanent_24h || false,
                            telephone: data.telephone || '',
                            telephone_urgence: data.telephone_urgence || '',
                            whatsapp: data.whatsapp || '',
                            email: data.email || '',
                            services: data.services || [],
                        });

                        setSelectedServices(data.services || []);
                        if (data.gps) {
                            setSelectedGPS(data.gps);
                        }
                    }
                } catch (error: any) {
                    console.error('[PharmacieFormScreen] Erreur chargement données:', error);
                } finally {
                    setLoading(false);
                }
            }
        };

        loadExistingData();
    }, [mode, specializedServiceId, serviceId]);

    // ✅ NOUVEAU: Charger les produits de la pharmacie
    useEffect(() => {
        const loadProducts = async () => {
            // Utiliser serviceId car l'endpoint backend attend pharmacy_service_id
            if (serviceId) {
                try {
                    setLoadingProducts(true);
                    const response = await apiGet(`/api/pharmacies/${serviceId}/products`);
                    if (response.success && response.data && Array.isArray(response.data)) {
                        setProducts(response.data);
                    } else if (response.success && response.data && response.data.products && Array.isArray(response.data.products)) {
                        // Format alternatif si backend retourne { products: [...] }
                        setProducts(response.data.products);
                    }
                } catch (error: any) {
                    console.error('[PharmacieFormScreen] Erreur chargement produits:', error);
                    // Ne pas afficher d'erreur si la pharmacie n'existe pas encore
                } finally {
                    setLoadingProducts(false);
                }
            }
        };

        if (serviceId) {
            loadProducts();
        }
    }, [serviceId]);


    const handleGPSSelect = (coordinates: string) => {
        setSelectedGPS(coordinates);
        setShowGPSModal(false);
    };

    const handleGuardDaysSave = (days: Record<string, number[]>) => {
        setFormData({ ...formData, jours_garde: days });
        setShowGuardDaysModal(false);
    };

    // ✅ NOUVEAU: Gestion des produits
    const openProductModal = (product?: PharmacyProduct) => {
        if (product) {
            setEditingProduct(product);
            setProductFormData({
                nom_produit: product.nom_produit,
                description: product.description || '',
                prix: product.prix.toString(),
                stock: product.stock.toString(),
                unite: product.unite,
                code_barre: product.code_barre || '',
                categorie: product.categorie || '',
            });
        } else {
            setEditingProduct(null);
            setProductFormData({
                nom_produit: '',
                description: '',
                prix: '',
                stock: '',
                unite: 'unité',
                code_barre: '',
                categorie: '',
            });
        }
        setShowProductModal(true);
    };

    const closeProductModal = () => {
        setShowProductModal(false);
        setEditingProduct(null);
        setProductFormData({
            nom_produit: '',
            description: '',
            prix: '',
            stock: '',
            unite: 'unité',
            code_barre: '',
            categorie: '',
        });
    };

    const handleSaveProduct = async () => {
        if (!serviceId) {
            Alert.alert('Erreur', 'Service ID manquant');
            return;
        }

        if (!productFormData.nom_produit.trim()) {
            Alert.alert('Erreur', 'Le nom du produit est obligatoire');
            return;
        }

        if (!productFormData.prix.trim() || isNaN(parseFloat(productFormData.prix))) {
            Alert.alert('Erreur', 'Le prix est obligatoire et doit être un nombre');
            return;
        }

        if (!productFormData.stock.trim() || isNaN(parseInt(productFormData.stock))) {
            Alert.alert('Erreur', 'Le stock est obligatoire et doit être un nombre');
            return;
        }

        try {
            setLoading(true);
            const payload = {
                pharmacy_service_id: serviceId,
                nom_produit: productFormData.nom_produit.trim(),
                description: productFormData.description.trim() || null,
                prix: parseFloat(productFormData.prix),
                stock: parseInt(productFormData.stock),
                unite: productFormData.unite,
                code_barre: productFormData.code_barre.trim() || null,
                categorie: productFormData.categorie || null,
            };

            let response;
            if (editingProduct) {
                // Modifier un produit existant
                response = await apiPatch(`/api/pharmacies/products/${editingProduct.id}`, payload);
            } else {
                // Créer un nouveau produit
                response = await apiPost('/api/pharmacies/products', payload);
            }

            if (response.success) {
                Alert.alert('Succès', editingProduct ? 'Produit modifié avec succès' : 'Produit ajouté avec succès');
                closeProductModal();
                // Recharger la liste des produits
                if (serviceId) {
                    const productsResponse = await apiGet(`/api/pharmacies/${serviceId}/products`);
                    if (productsResponse.success && productsResponse.data) {
                        if (Array.isArray(productsResponse.data)) {
                            setProducts(productsResponse.data);
                        } else if (productsResponse.data.products && Array.isArray(productsResponse.data.products)) {
                            setProducts(productsResponse.data.products);
                        }
                    }
                }
            } else {
                Alert.alert('Erreur', response.error || 'Impossible d\'enregistrer le produit');
            }
        } catch (error: any) {
            console.error('[PharmacieFormScreen] Erreur sauvegarde produit:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProduct = (product: PharmacyProduct) => {
        Alert.alert(
            'Confirmer la suppression',
            `Êtes-vous sûr de vouloir supprimer "${product.nom_produit}" ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            const response = await apiDelete(`/api/pharmacies/products/${product.id}`);
                            if (response.success) {
                                Alert.alert('Succès', 'Produit supprimé avec succès');
                                // Recharger la liste
                                if (serviceId) {
                                    const productsResponse = await apiGet(`/api/pharmacies/${serviceId}/products`);
                                    if (productsResponse.success && productsResponse.data) {
                                        if (Array.isArray(productsResponse.data)) {
                                            setProducts(productsResponse.data);
                                        } else if (productsResponse.data.products && Array.isArray(productsResponse.data.products)) {
                                            setProducts(productsResponse.data.products);
                                        }
                                    }
                                }
                            } else {
                                Alert.alert('Erreur', response.error || 'Impossible de supprimer le produit');
                            }
                        } catch (error: any) {
                            console.error('[PharmacieFormScreen] Erreur suppression produit:', error);
                            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    // ✅ NOUVEAU: Import en masse
    const handleBulkImport = async () => {
        if (!serviceId) {
            Alert.alert('Erreur', 'Service ID manquant');
            return;
        }

        if (!bulkImportText.trim()) {
            Alert.alert('Erreur', 'Veuillez entrer des données à importer');
            return;
        }

        try {
            setLoadingBulkImport(true);
            let productsToImport: any[] = [];

            // Essayer de parser comme JSON
            try {
                const parsed = JSON.parse(bulkImportText);
                if (Array.isArray(parsed)) {
                    productsToImport = parsed;
                } else if (parsed.products && Array.isArray(parsed.products)) {
                    productsToImport = parsed.products;
                } else {
                    throw new Error('Format JSON invalide');
                }
            } catch (jsonError) {
                // Essayer de parser comme CSV
                const lines = bulkImportText.trim().split('\n');
                if (lines.length < 2) {
                    Alert.alert('Erreur', 'Format invalide. Utilisez JSON ou CSV');
                    return;
                }

                // Parser CSV (format: nom_produit,prix,stock,unite,description,code_barre,categorie)
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                productsToImport = lines.slice(1).map((line, index) => {
                    const values = line.split(',').map(v => v.trim());
                    const product: any = {};
                    headers.forEach((header, i) => {
                        const value = values[i] || '';
                        if (header === 'nom_produit' || header === 'nom') {
                            product.nom_produit = value;
                        } else if (header === 'prix') {
                            product.prix = parseFloat(value) || 0;
                        } else if (header === 'stock') {
                            product.stock = parseInt(value) || 0;
                        } else if (header === 'unite' || header === 'unité') {
                            product.unite = value || 'unité';
                        } else if (header === 'description') {
                            product.description = value || null;
                        } else if (header === 'code_barre' || header === 'code-barre') {
                            product.code_barre = value || null;
                        } else if (header === 'categorie' || header === 'catégorie') {
                            product.categorie = value || null;
                        }
                    });
                    return product;
                }).filter(p => p.nom_produit);
            }

            if (productsToImport.length === 0) {
                Alert.alert('Erreur', 'Aucun produit valide trouvé');
                return;
            }

            // Valider et formater les produits
            const formattedProducts = productsToImport.map((p, index) => {
                if (!p.nom_produit || !p.prix || !p.stock) {
                    throw new Error(`Produit ligne ${index + 1}: nom, prix et stock sont obligatoires`);
                }
                return {
                    nom_produit: String(p.nom_produit || p.nom || ''),
                    description: p.description ? String(p.description) : null,
                    prix: typeof p.prix === 'number' ? p.prix : parseFloat(String(p.prix)) || 0,
                    stock: typeof p.stock === 'number' ? p.stock : parseInt(String(p.stock)) || 0,
                    unite: p.unite || 'unité',
                    code_barre: p.code_barre ? String(p.code_barre) : null,
                    categorie: p.categorie ? String(p.categorie) : null,
                };
            });

            const payload = {
                pharmacy_service_id: serviceId,
                products: formattedProducts,
                overwrite_existing: bulkImportOverwrite,
            };

            const response = await apiPost('/api/pharmacies/products/bulk-import', payload);

            if (response.success) {
                const created = response.data?.created || 0;
                const updated = response.data?.updated || 0;
                const errors = response.data?.errors || [];
                
                let message = `Import réussi !\n- ${created} produit(s) créé(s)\n- ${updated} produit(s) mis à jour`;
                if (errors.length > 0) {
                    message += `\n\n${errors.length} erreur(s):\n${errors.slice(0, 5).join('\n')}`;
                    if (errors.length > 5) {
                        message += `\n... et ${errors.length - 5} autre(s)`;
                    }
                }

                Alert.alert('Import terminé', message);
                setShowBulkImportModal(false);
                setBulkImportText('');
                
                // Recharger la liste
                if (serviceId) {
                    const productsResponse = await apiGet(`/api/pharmacies/${serviceId}/products`);
                    if (productsResponse.success && productsResponse.data) {
                        if (Array.isArray(productsResponse.data)) {
                            setProducts(productsResponse.data);
                        } else if (productsResponse.data.products && Array.isArray(productsResponse.data.products)) {
                            setProducts(productsResponse.data.products);
                        }
                    }
                }
            } else {
                Alert.alert('Erreur', response.error || 'Impossible d\'importer les produits');
            }
        } catch (error: any) {
            console.error('[PharmacieFormScreen] Erreur import en masse:', error);
            Alert.alert('Erreur', error.message || 'Format de données invalide');
        } finally {
            setLoadingBulkImport(false);
        }
    };

    // ✅ NOUVEAU: Export des produits
    const handleExportProducts = () => {
        if (products.length === 0) {
            Alert.alert('Information', 'Aucun produit à exporter');
            return;
        }

        const exportData = products.map(p => ({
            nom_produit: p.nom_produit,
            description: p.description || '',
            prix: p.prix,
            stock: p.stock,
            unite: p.unite,
            code_barre: p.code_barre || '',
            categorie: p.categorie || '',
        }));

        const jsonString = JSON.stringify(exportData, null, 2);
        
        // Afficher dans une alerte (dans une vraie app, on pourrait utiliser le partage de fichiers)
        Alert.alert(
            'Export réussi',
            `${products.length} produit(s) exporté(s).\n\nLes données sont prêtes à être copiées.`,
            [
                { text: 'OK' },
                {
                    text: 'Copier JSON',
                    onPress: () => {
                        // Dans React Native, on pourrait utiliser Clipboard ou un module de partage
                        console.log('JSON à copier:', jsonString);
                        Alert.alert('JSON copié', 'Les données sont dans la console');
                    },
                },
            ]
        );
    };

    const handleSubmit = async () => {
        // ✅ Créer le service si nécessaire
        let finalServiceId = serviceId;
        if (!finalServiceId && user?.id) {
            try {
                setLoading(true);
                const serviceData = {
                    titre_service: formData.nom || 'Pharmacie',
                    description: 'Pharmacie avec garde',
                    category: 'sante',
                };

                const response = await servicesApi.createService(serviceData);
                if (response.success && response.data && typeof response.data === 'object' && 'id' in response.data) {
                    finalServiceId = (response.data as any).id;
                    setServiceId(finalServiceId);
                } else {
                    Alert.alert('Erreur', 'Impossible de créer le service. Veuillez réessayer.');
                    setLoading(false);
                    return;
                }
            } catch (error: any) {
                console.error('[PharmacieFormScreen] Erreur création service:', error);
                Alert.alert('Erreur', 'Impossible de créer le service. Veuillez réessayer.');
                setLoading(false);
                return;
            }
        }

        if (!finalServiceId) {
            Alert.alert('Erreur', 'Service ID manquant. Veuillez créer un service d\'abord.');
            setLoading(false);
            return;
        }

        if (!formData.nom.trim()) {
            Alert.alert('Erreur', 'Le nom de la pharmacie est obligatoire');
            setLoading(false);
            return;
        }

        try {
            // ✅ SUPPRIMÉ : planning_hebdomadaire (pas d'utilité selon demande)
            // ✅ Format jours_garde : { '2025-01': [1, 3, 5], ... } où les valeurs sont les jours de la semaine
            const joursGardeFormatted = Object.keys(formData.jours_garde).length > 0
                ? formData.jours_garde
                : null;

            const payload = {
                service_id: finalServiceId,
                nom: formData.nom,
                adresse: formData.adresse || null,
                quartier: formData.quartier?.raw || formData.quartier?.place_name || null,
                // ✅ SUPPRIMÉ : ville (quartier contient déjà ville et pays)
                gps: selectedGPS || (location
                    ? `${location.coords.latitude},${location.coords.longitude}`
                    : null),
                jours_garde: joursGardeFormatted,
                heures_ouverture: formData.heures_ouverture || null,
                heures_fermeture: formData.heures_fermeture || null,
                permanent_24h: formData.permanent_24h,
                telephone: formData.telephone || null,
                telephone_urgence: formData.telephone_urgence || null,
                whatsapp: formData.whatsapp || null,
                email: formData.email || null,
                services: selectedServices.length > 0 ? selectedServices : null,
            };

            const response = await apiPost('/api/pharmacies', payload);

            if (response.success) {
                Alert.alert(
                    'Succès',
                    'Pharmacie enregistrée avec succès !',
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.goBack(),
                        },
                    ]
                );
            } else {
                Alert.alert('Erreur', response.error || 'Impossible d\'enregistrer la pharmacie');
            }
        } catch (error: any) {
            console.error('Erreur création pharmacie:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <KeyboardAwareScreen style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <SafeIcon name="arrow-left" size={24} color="#111827" />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <Text style={styles.title}>Enregistrer une Pharmacie</Text>
                        {/* ✅ NOUVEAU: Afficher le nom et logo du partenaire dans l'en-tête */}
                        {user?.role === 'partenaire' && partnerData && (
                            <View style={styles.partnerHeader}>
                                {partnerData.logo_url ? (
                                    <Image
                                        source={{ uri: partnerData.logo_url }}
                                        style={styles.partnerLogo}
                                    />
                                ) : (
                                    <SafeIcon name="building" size={16} color={modernColors.primary} />
                                )}
                                <Text style={styles.partnerName}>{partnerData.name}</Text>
                            </View>
                        )}
                    </View>
                </View>

                <View style={styles.form}>
                    {/* ✅ Masquer les champs redondants pour les partenaires */}
                    {user?.role !== 'partenaire' && (
                        <View style={styles.inputGroup}>
                            <NativeInput
                                label="Nom de la pharmacie *"
                                value={formData.nom}
                                onChangeText={(text) => setFormData({ ...formData, nom: text })}
                                placeholder="Ex: Pharmacie Centrale"
                            />
                        </View>
                    )}

                    {/* ✅ Localisation avec Google Maps */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Localisation GPS</Text>
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={() => setShowGPSModal(true)}
                        >
                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                            <Text style={styles.gpsButtonText}>
                                {selectedGPS ? 'Localisation sélectionnée' : 'Sélectionner sur la carte'}
                            </Text>
                            <SafeIcon name="chevron-right" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                        {selectedGPS && (
                            <Text style={styles.gpsText}>{selectedGPS}</Text>
                        )}
                    </View>

                    {/* ✅ Masquer l'adresse pour les partenaires (chargée automatiquement) */}
                    {user?.role !== 'partenaire' && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Adresse</Text>
                            <NativeInput
                                value={formData.adresse}
                                onChangeText={(text) => setFormData({ ...formData, adresse: text })}
                                placeholder="Adresse complète"
                                multiline
                            />
                        </View>
                    )}

                    <View style={styles.inputGroup}>
                        <LocationSelector
                            label="Quartier"
                            value={formData.quartier ? (typeof formData.quartier === 'string' ? { raw: formData.quartier, place_name: formData.quartier } : formData.quartier) : ''}
                            onSelect={(location: LocationObject) => {
                                // ✅ CORRECTION: Extraire la valeur à stocker (string ou LocationObject selon besoin)
                                const quartierValue = location.raw || location.place_name || '';
                                setFormData({ 
                                    ...formData, 
                                    quartier: quartierValue,
                                    // ✅ NOUVEAU: Extraire automatiquement ville et pays si disponibles
                                    ville: location.components?.ville || formData.ville,
                                    pays: location.components?.pays || formData.pays,
                                });
                            }}
                            placeholder="Rechercher un quartier (inclut ville et pays)..."
                            scope="neighborhood"
                            enrichWithBackend
                        />
                        <Text style={styles.hintText}>
                            Le quartier permet de récupérer automatiquement la ville et le pays
                        </Text>
                    </View>

                    {/* ✅ SUPPRIMÉ : Planning hebdomadaire (pas d'utilité) */}

                    {/* ✅ Jours de garde avec sélecteur visuel amélioré */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Jours de garde</Text>
                        <Text style={styles.hintText}>
                            Planifier les jours de garde sur les 12 prochains mois
                        </Text>
                        <TouchableOpacity
                            style={styles.planningButton}
                            onPress={() => setShowGuardDaysModal(true)}
                        >
                            <SafeIcon name="calendar" size={18} color="#fff" />
                            <Text style={styles.planningButtonText}>
                                {Object.keys(formData.jours_garde).length > 0 ? 'Modifier la planification' : 'Planifier les jours de garde'}
                            </Text>
                        </TouchableOpacity>
                        {Object.keys(formData.jours_garde).length > 0 && (
                            <View style={styles.guardDaysSummary}>
                                <Text style={styles.guardDaysSummaryText}>
                                    {Object.values(formData.jours_garde).reduce((sum, days) => sum + days.length, 0)} jour(s) de garde planifié(s) sur {Object.keys(formData.jours_garde).length} mois
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                            <Text style={styles.label}>Heure d'ouverture</Text>
                            <NativeInput
                                value={formData.heures_ouverture}
                                onChangeText={(text) => setFormData({ ...formData, heures_ouverture: text })}
                                placeholder="08:00"
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.label}>Heure de fermeture</Text>
                            <NativeInput
                                value={formData.heures_fermeture}
                                onChangeText={(text) => setFormData({ ...formData, heures_fermeture: text })}
                                placeholder="20:00"
                            />
                        </View>
                    </View>

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Ouvert 24h/24</Text>
                        <Switch
                            value={formData.permanent_24h}
                            onValueChange={(value) => setFormData({ ...formData, permanent_24h: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    {/* ✅ Masquer les champs de contact pour les partenaires (chargés automatiquement) */}
                    {user?.role !== 'partenaire' && (
                        <>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Téléphone</Text>
                                <NativeInput
                                    value={formData.telephone}
                                    onChangeText={(text) => setFormData({ ...formData, telephone: text })}
                                    placeholder="+237 6XX XX XX XX"
                                    keyboardType="phone-pad"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Téléphone urgence</Text>
                                <NativeInput
                                    value={formData.telephone_urgence}
                                    onChangeText={(text) => setFormData({ ...formData, telephone_urgence: text })}
                                    placeholder="+237 6XX XX XX XX"
                                    keyboardType="phone-pad"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>WhatsApp</Text>
                                <NativeInput
                                    value={formData.whatsapp}
                                    onChangeText={(text) => setFormData({ ...formData, whatsapp: text })}
                                    placeholder="+237 6XX XX XX XX"
                                    keyboardType="phone-pad"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Email</Text>
                                <NativeInput
                                    value={formData.email}
                                    onChangeText={(text) => setFormData({ ...formData, email: text })}
                                    placeholder="pharmacie@example.com"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>
                        </>
                    )}

                    <View style={styles.inputGroup}>
                        <SimplePrestationSelector
                            label="Services proposés"
                            options={servicesOptions}
                            selected={selectedServices}
                            onSelectionChange={setSelectedServices}
                            allowCustom={true}
                            placeholder="Ajouter un service personnalisé"
                        />
                    </View>

                    {/* ✅ NOUVEAU: Section Gestion des médicaments */}
                    {serviceId && (
                        <View style={styles.productsSection}>
                            <View style={styles.sectionHeader}>
                                <View style={styles.sectionTitleContainer}>
                                    <SafeIcon name="pills" size={20} color={modernColors.primary} type="lucide" />
                                    <Text style={styles.sectionTitle}>Gérer mes médicaments</Text>
                                </View>
                                <View style={styles.sectionActions}>
                                    {products.length > 0 && (
                                        <TouchableOpacity
                                            style={styles.exportButton}
                                            onPress={handleExportProducts}
                                        >
                                            <SafeIcon name="download" size={16} color={modernColors.primary} type="lucide" />
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        style={styles.bulkImportButton}
                                        onPress={() => setShowBulkImportModal(true)}
                                    >
                                        <SafeIcon name="upload" size={16} color="#fff" type="lucide" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.addProductButton}
                                        onPress={() => openProductModal()}
                                    >
                                        <SafeIcon name="plus" size={18} color="#fff" type="lucide" />
                                        <Text style={styles.addProductButtonText}>Ajouter</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* ✅ NOUVEAU: Statistiques rapides */}
                            {products.length > 0 && (
                                <View style={styles.statsContainer}>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{stats.total}</Text>
                                        <Text style={styles.statLabel}>Produits</Text>
                                    </View>
                                    <View style={styles.statDivider} />
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{stats.totalStock.toLocaleString()}</Text>
                                        <Text style={styles.statLabel}>Stock total</Text>
                                    </View>
                                    <View style={styles.statDivider} />
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{stats.totalValue.toLocaleString()}</Text>
                                        <Text style={styles.statLabel}>Valeur (FCFA)</Text>
                                    </View>
                                    {stats.categories > 0 && (
                                        <>
                                            <View style={styles.statDivider} />
                                            <View style={styles.statItem}>
                                                <Text style={styles.statValue}>{stats.categories}</Text>
                                                <Text style={styles.statLabel}>Catégories</Text>
                                            </View>
                                        </>
                                    )}
                                </View>
                            )}

                            {/* ✅ NOUVEAU: Barre de recherche */}
                            {products.length > 0 && (
                                <View style={styles.searchContainer}>
                                    <SafeIcon name="search" size={18} color="#9CA3AF" type="lucide" />
                                    <NativeInput
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        placeholder="Rechercher un médicament..."
                                        style={styles.searchInput}
                                    />
                                    {searchQuery.trim() && (
                                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                                            <SafeIcon name="x" size={18} color="#9CA3AF" type="lucide" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}

                            {loadingProducts ? (
                                <Text style={styles.loadingText}>Chargement des produits...</Text>
                            ) : products.length === 0 ? (
                                <View style={styles.emptyProductsContainer}>
                                    <SafeIcon name="package" size={48} color="#9CA3AF" type="lucide" />
                                    <Text style={styles.emptyProductsText}>Aucun médicament enregistré</Text>
                                    <Text style={styles.emptyProductsHint}>
                                        Ajoutez vos médicaments pour permettre aux clients de les rechercher
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.productsList}>
                                    {filteredProducts.length === 0 && searchQuery.trim() ? (
                                        <View style={styles.emptySearchContainer}>
                                            <SafeIcon name="search-x" size={48} color="#9CA3AF" type="lucide" />
                                            <Text style={styles.emptySearchText}>Aucun résultat pour "{searchQuery}"</Text>
                                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                                <Text style={styles.clearSearchText}>Effacer la recherche</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        filteredProducts.map((product) => (
                                        <View key={product.id} style={styles.productCard}>
                                            <View style={styles.productInfo}>
                                                <Text style={styles.productName}>{product.nom_produit}</Text>
                                                {product.description && (
                                                    <Text style={styles.productDescription}>{product.description}</Text>
                                                )}
                                                <View style={styles.productDetails}>
                                                    <Text style={styles.productPrice}>
                                                        {product.prix.toLocaleString()} FCFA / {product.unite}
                                                    </Text>
                                                    <Text style={styles.productStock}>
                                                        Stock: {product.stock} {product.unite}(s)
                                                    </Text>
                                                </View>
                                                {product.categorie && (
                                                    <View style={styles.productCategory}>
                                                        <Text style={styles.productCategoryText}>{product.categorie}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <View style={styles.productActions}>
                                                <TouchableOpacity
                                                    style={styles.productActionButton}
                                                    onPress={() => openProductModal(product)}
                                                >
                                                    <SafeIcon name="edit" size={18} color={modernColors.primary} type="lucide" />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.productActionButton, styles.deleteButton]}
                                                    onPress={() => handleDeleteProduct(product)}
                                                >
                                                    <SafeIcon name="trash-2" size={18} color="#DC2626" type="lucide" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                        ))
                                    )}
                                </View>
                            )}
                            {searchQuery.trim() && filteredProducts.length > 0 && (
                                <Text style={styles.searchResultsText}>
                                    {filteredProducts.length} résultat(s) sur {products.length}
                                </Text>
                            )}
                        </View>
                    )}

                    {/* ✅ CORRIGÉ: Utiliser title au lieu de children */}
                    <NativeButton
                        title={loading ? 'Enregistrement...' : 'Enregistrer la Pharmacie'}
                        onPress={handleSubmit}
                        disabled={loading || !formData.nom.trim()}
                        variant="primary"
                        size="large"
                        style={styles.submitButton}
                    />
                </View>
            </KeyboardAwareScreen>

            {/* Modals */}
            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
                currentLocation={location ? {
                    lat: location.coords.latitude,
                    lng: location.coords.longitude
                } : null}
                title="Sélectionner la localisation"
            />

            <GuardDaysSelector
                visible={showGuardDaysModal}
                onClose={() => setShowGuardDaysModal(false)}
                onSave={handleGuardDaysSave}
                initialDays={formData.jours_garde}
                title="Planifier les jours de garde"
            />

            {/* ✅ NOUVEAU: Modal pour ajouter/modifier un produit */}
            <Modal
                visible={showProductModal}
                animationType="slide"
                transparent={true}
                onRequestClose={closeProductModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingProduct ? 'Modifier le médicament' : 'Ajouter un médicament'}
                            </Text>
                            <TouchableOpacity onPress={closeProductModal}>
                                <SafeIcon name="x" size={24} color="#6B7280" type="lucide" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Nom du produit *</Text>
                                <NativeInput
                                    value={productFormData.nom_produit}
                                    onChangeText={(text) => setProductFormData({ ...productFormData, nom_produit: text })}
                                    placeholder="Ex: Paracétamol 500mg"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Description</Text>
                                <NativeInput
                                    value={productFormData.description}
                                    onChangeText={(text) => setProductFormData({ ...productFormData, description: text })}
                                    placeholder="Description du produit"
                                    multiline
                                />
                            </View>

                            <View style={styles.row}>
                                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                    <Text style={styles.label}>Prix (FCFA) *</Text>
                                    <NativeInput
                                        value={productFormData.prix}
                                        onChangeText={(text) => setProductFormData({ ...productFormData, prix: text })}
                                        placeholder="0"
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                                    <Text style={styles.label}>Stock *</Text>
                                    <NativeInput
                                        value={productFormData.stock}
                                        onChangeText={(text) => setProductFormData({ ...productFormData, stock: text })}
                                        placeholder="0"
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Unité</Text>
                                <View style={styles.chipsContainer}>
                                    {uniteOptions.map((unite) => (
                                        <TouchableOpacity
                                            key={unite}
                                            style={[
                                                styles.chip,
                                                productFormData.unite === unite && styles.chipSelected,
                                            ]}
                                            onPress={() => setProductFormData({ ...productFormData, unite })}
                                        >
                                            <Text
                                                style={[
                                                    styles.chipText,
                                                    productFormData.unite === unite && styles.chipTextSelected,
                                                ]}
                                            >
                                                {unite}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Code-barres (optionnel)</Text>
                                <NativeInput
                                    value={productFormData.code_barre}
                                    onChangeText={(text) => setProductFormData({ ...productFormData, code_barre: text })}
                                    placeholder="Ex: 1234567890123"
                                    keyboardType="numeric"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Catégorie</Text>
                                <View style={styles.chipsContainer}>
                                    {categorieOptions.map((categorie) => (
                                        <TouchableOpacity
                                            key={categorie}
                                            style={[
                                                styles.chip,
                                                productFormData.categorie === categorie && styles.chipSelected,
                                            ]}
                                            onPress={() => setProductFormData({ ...productFormData, categorie })}
                                        >
                                            <Text
                                                style={[
                                                    styles.chipText,
                                                    productFormData.categorie === categorie && styles.chipTextSelected,
                                                ]}
                                            >
                                                {categorie}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <NativeButton
                                title="Annuler"
                                onPress={closeProductModal}
                                variant="secondary"
                                style={styles.modalButton}
                            />
                            <NativeButton
                                title={editingProduct ? 'Modifier' : 'Ajouter'}
                                onPress={handleSaveProduct}
                                variant="primary"
                                style={styles.modalButton}
                                disabled={loading || !productFormData.nom_produit.trim()}
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ✅ NOUVEAU: Modal Import en masse */}
            <Modal
                visible={showBulkImportModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowBulkImportModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Import en masse</Text>
                            <TouchableOpacity onPress={() => setShowBulkImportModal(false)}>
                                <SafeIcon name="x" size={24} color="#6B7280" type="lucide" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.label}>Format JSON ou CSV</Text>
                            <Text style={styles.hintText}>
                                JSON: [{"{"}"nom_produit": "...", "prix": 1000, "stock": 50, ...{"}"}]
                                {'\n\n'}
                                CSV: nom_produit,prix,stock,unite,description,code_barre,categorie
                            </Text>

                            <View style={styles.inputGroup}>
                                <NativeInput
                                    value={bulkImportText}
                                    onChangeText={setBulkImportText}
                                    placeholder="Collez vos données ici..."
                                    multiline
                                    style={styles.bulkImportInput}
                                />
                            </View>

                            <View style={styles.switchGroup}>
                                <Text style={styles.label}>Remplacer les produits existants</Text>
                                <Switch
                                    value={bulkImportOverwrite}
                                    onValueChange={setBulkImportOverwrite}
                                    trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                                />
                            </View>

                            <Text style={styles.hintText}>
                                {bulkImportOverwrite
                                    ? 'Les produits avec le même nom seront mis à jour'
                                    : 'Les produits existants seront ignorés'}
                            </Text>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <NativeButton
                                title="Annuler"
                                onPress={() => {
                                    setShowBulkImportModal(false);
                                    setBulkImportText('');
                                }}
                                variant="secondary"
                                style={styles.modalButton}
                            />
                            <NativeButton
                                title={loadingBulkImport ? 'Import...' : 'Importer'}
                                onPress={handleBulkImport}
                                variant="primary"
                                style={styles.modalButton}
                                disabled={loadingBulkImport || !bulkImportText.trim()}
                            />
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
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
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    headerContent: {
        flex: 1,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    partnerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: modernColors.primary + '15',
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    partnerName: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
        marginLeft: 6,
    },
    partnerLogo: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 8,
    },
    form: {
        padding: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    switchGroup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingVertical: 8,
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    chipSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    chipText: {
        fontSize: 14,
        color: '#374151',
    },
    chipTextSelected: {
        color: '#fff',
        fontWeight: '600',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        gap: 12,
    },
    gpsButtonText: {
        flex: 1,
        fontSize: 14,
        color: '#111827',
    },
    gpsText: {
        marginTop: 8,
        fontSize: 12,
        color: '#6B7280',
    },
    planningButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
        marginTop: 8,
    },
    planningButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    scheduleSummary: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
    },
    hintText: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
        fontStyle: 'italic',
    },
    guardDaysSummary: {
        marginTop: 8,
        padding: 12,
        backgroundColor: '#EEF2FF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#C7D2FE',
    },
    guardDaysSummaryText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
    },
    submitButton: {
        marginTop: 24,
    },
    // ✅ NOUVEAU: Styles pour la section produits
    productsSection: {
        marginTop: 24,
        marginBottom: 16,
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    addProductButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
    },
    addProductButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    loadingText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        padding: 16,
    },
    emptyProductsContainer: {
        alignItems: 'center',
        padding: 32,
    },
    emptyProductsText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginTop: 12,
        marginBottom: 8,
    },
    emptyProductsHint: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    productsList: {
        gap: 12,
    },
    productCard: {
        flexDirection: 'row',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    productDescription: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 8,
    },
    productDetails: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 8,
    },
    productPrice: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    productStock: {
        fontSize: 14,
        color: '#6B7280',
    },
    productCategory: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#EEF2FF',
        borderRadius: 4,
    },
    productCategoryText: {
        fontSize: 12,
        fontWeight: '500',
        color: modernColors.primary,
    },
    productActions: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'flex-start',
    },
    productActionButton: {
        padding: 8,
        borderRadius: 6,
        backgroundColor: '#F3F4F6',
    },
    deleteButton: {
        backgroundColor: '#FEE2E2',
    },
    // ✅ NOUVEAU: Styles pour le modal produit
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    modalBody: {
        padding: 16,
        maxHeight: 500,
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    modalButton: {
        flex: 1,
    },
    // ✅ NOUVEAU: Styles pour fonctionnalités avancées
    sectionActions: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    exportButton: {
        padding: 8,
        borderRadius: 6,
        backgroundColor: '#EEF2FF',
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    bulkImportButton: {
        padding: 8,
        borderRadius: 6,
        backgroundColor: '#10B981',
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        marginBottom: 12,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#6B7280',
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 8,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        backgroundColor: '#fff',
    },
    emptySearchContainer: {
        alignItems: 'center',
        padding: 32,
    },
    emptySearchText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginTop: 12,
        marginBottom: 8,
    },
    clearSearchText: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '600',
    },
    searchResultsText: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 8,
        fontStyle: 'italic',
    },
    bulkImportInput: {
        minHeight: 200,
        textAlignVertical: 'top',
        fontFamily: 'monospace',
        fontSize: 12,
    },
});

export default PharmacieFormScreen;

