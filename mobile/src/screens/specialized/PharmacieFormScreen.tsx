// ✅ REFONTE TOTALE 2026-03-05: PharmacieFormScreen → Dashboard professionnel + Formulaire
// Mode Dashboard (pharmacie existante): 4 tabs (Accueil / Mon service / Produits / Stats)
// Mode Création (nouvelle pharmacie): Formulaire guidé avec header gradient
// Exploite endpoints: CRUD pharmacie, produits, commandes, garde, analytics, IA interactions/dosage
import { useNavigation, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import GuardDaysSelector from '../../components/GuardDaysSelector';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import ServiceTeamManager from '../../components/ServiceTeamManager';
import SimplePrestationSelector from '../../components/SimplePrestationSelector';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useLocation } from '../../contexts/LocationContext';
import { clearSavedFormData, useFormAutoSave } from '../../hooks/useFormAutoSave';
import { useFormValidation } from '../../hooks/useFormValidation';
import { usePartnerData } from '../../hooks/usePartnerData';
import { apiDelete, apiGet, apiPatch, apiPost, servicesApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';
import * as XLSX from 'xlsx';

const STORAGE_KEY = '@pharmacie_form';
type TabType = 'overview' | 'service' | 'products' | 'analytics' | 'team';

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

interface PharmacyAnalytics {
    total_orders: number;
    orders_7d: number;
    orders_30d: number;
    total_revenue: string | null;
    avg_order_value: string | null;
}

const PharmacieFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user, logout } = useAuth();
    const { t } = useLanguageSafe();
    const { location } = useLocation();
    const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);
    const specializedServiceId = (route.params as any)?.specializedServiceId as number | undefined;
    const mode = (route.params as any)?.mode as string | undefined;
    const devise = getCurrencyIntelligently() || 'FCFA';

    const SERVICES_OPTIONS = [
        'Garde',
        t('pharmacieFormScreen.delivrance') || 'Délivrance',
        'Conseil',
        'Vaccination',
        'Pansements',
        t('pharmacieFormScreen.livraisonADomicile') || 'Livraison à domicile',
        t('pharmacieFormScreen.preparationDeMedicaments') || 'Préparation de médicaments',
    ];
    const UNITE_OPTIONS = [
        t('pharmacieFormScreen.unite') || 'Unité',
        t('pharmacieFormScreen.boite') || 'Boîte',
        'flacon',
        'plaquette',
        'tube',
        'sachet',
        'ampoule',
        t('pharmacieFormScreen.comprime') || 'Comprimé',
    ];
    const CATEGORIE_OPTIONS = [
        t('pharmacieFormScreen.medicament') || 'Médicament',
        'Parapharmacie',
        t('pharmacieFormScreen.accessoireMedical') || 'Accessoire médical',
        t('pharmacieFormScreen.hygiene') || 'Hygiène',
        'Nutrition',
        'Autre',
    ];

    // Dashboard state
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    // ✅ FIX: Partenaires voient TOUJOURS le dashboard (même vide), pas le formulaire de création
    const [isDashboardMode, setIsDashboardMode] = useState(user?.role === 'partenaire' && !mode);
    const [initialLoading, setInitialLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pharmacyData, setPharmacyData] = useState<any>(null);
    const [analyticsData, setAnalyticsData] = useState<PharmacyAnalytics | null>(null);
    const [isOnDuty, setIsOnDuty] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        nom: '',
        adresse: '',
        quartier: null as LocationObject | null,
        jours_garde: {} as Record<string, number[]>,
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

    // Products state
    const [products, setProducts] = useState<PharmacyProduct[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<PharmacyProduct | null>(null);
    const [productFormData, setProductFormData] = useState({
        nom_produit: '', description: '', prix: '', stock: '', unite: t('pharmacieFormScreen.unite'), code_barre: '', categorie: '',
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [showBulkImportModal, setShowBulkImportModal] = useState(false);
    const [bulkImportText, setBulkImportText] = useState('');
    const [bulkImportOverwrite, setBulkImportOverwrite] = useState(false);
    const [loadingBulkImport, setLoadingBulkImport] = useState(false);
    const [showBulkGuide, setShowBulkGuide] = useState(false);
    const [importWizardStep, setImportWizardStep] = useState<1 | 2 | 3>(1);
    const [importSource, setImportSource] = useState<'paste' | 'file' | 'external'>('paste');
    const [previewProducts, setPreviewProducts] = useState<any[]>([]);
    const [invalidLines, setInvalidLines] = useState<string[]>([]);
    const [externalApiUrl, setExternalApiUrl] = useState('');
    const [externalItemsPath, setExternalItemsPath] = useState('items');
    const [externalBearerToken, setExternalBearerToken] = useState('');

    const { partnerData } = usePartnerData(user?.role, 'pharmacie');
    const { errors, validateField, validateForm, setError } = useFormValidation({
        nom: { required: true, minLength: 3 },
        telephone: { required: true, pattern: /^\+?[0-9]{9,15}$/ },
        email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    });

    useFormAutoSave(STORAGE_KEY, formData, mode !== 'edit', 1000);

    // Computed
    const filteredProducts = products.filter(p => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return p.nom_produit.toLowerCase().includes(q) || (p.categorie || '').toLowerCase().includes(q) || (p.code_barre || '').includes(q);
    });
    const stats = {
        total: products.length,
        totalStock: products.reduce((s, p) => s + p.stock, 0),
        totalValue: products.reduce((s, p) => s + (p.prix * p.stock), 0),
        categories: Array.from(new Set(products.map(p => p.categorie).filter(Boolean))).length,
    };
    const formatPrice = (price: number | string | null) => {
        if (!price) return `0 ${devise}`;
        const num = typeof price === 'string' ? parseFloat(price) : price;
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M ${devise}`;
        if (num >= 1000) return `${Math.round(num / 1000)}K ${devise}`;
        return `${num} ${devise}`;
    };

    // ─── DATA LOADING ───────────────────────────────────────────────────
    // Detect existing pharmacy → dashboard mode
    useEffect(() => {
        const init = async () => {
            if (user?.role === 'partenaire' && user?.partner_type === 'pharmacie') {
                try {
                    // Load partner data for form prefill
                    const partnerResp = await apiGet('/api/partners/me');
                    if (partnerResp.success && partnerResp.data) {
                        const p = partnerResp.data as any;
                        setFormData(prev => ({
                            ...prev,
                            nom: p.name || prev.nom,
                            adresse: p.address || p.location_address || prev.adresse,
                            telephone: p.contact_phone || prev.telephone,
                            email: p.contact_email || prev.email,
                            quartier: p.city ? { raw: p.city, place_name: p.city, components: { ville: p.city, pays: p.country } } as any : prev.quartier,
                        }));
                    }

                    // Check if pharmacy already exists
                    const pharmaResp = await apiGet('/api/pharmacies');
                    const resData = (pharmaResp?.data || pharmaResp) as any;
                    const pharmacies = Array.isArray(resData?.data) ? resData.data : Array.isArray(resData) ? resData : [];
                    if (pharmacies.length > 0) {
                        const myPharmacy = pharmacies[0];
                        setPharmacyData(myPharmacy);
                        setIsDashboardMode(true);
                        setIsOnDuty(myPharmacy.is_on_duty_now || false);
                        if (!serviceId && myPharmacy.service_id) setServiceId(myPharmacy.service_id);
                        // Load products + analytics
                        const pid = myPharmacy.service_id || myPharmacy.id;
                        if (pid) {
                            loadProducts(pid);
                            loadAnalytics(pid);
                        }
                    }
                } catch (e) {
                    console.log('[PharmacieForm] Init:', e);
                }
            }
            setInitialLoading(false);
        };
        init();
    }, [user?.role, user?.partner_type]);

    // Auto-create service if needed
    useEffect(() => {
        const createServiceIfNeeded = async () => {
            if (!serviceId && user?.id && formData.nom) {
                try {
                    const resp = await servicesApi.createService({ titre_service: formData.nom || 'Pharmacie', description: 'Pharmacie avec garde', category: 'sante' });
                    if (resp.success && resp.data && typeof resp.data === 'object' && 'id' in resp.data) {
                        setServiceId((resp.data as any).id);
                    }
                } catch (e) { console.error('[PharmacieForm] Erreur service:', e); }
            }
        };
        if (!serviceId && formData.nom) createServiceIfNeeded();
    }, [formData.nom, serviceId, user?.id]);

    // Load existing data in edit mode
    useEffect(() => {
        if (mode === 'edit' && specializedServiceId && serviceId) {
            (async () => {
                try {
                    setLoading(true);
                    const resp = await apiGet(`/api/pharmacies/${specializedServiceId}`);
                    if (resp.success && resp.data) {
                        const d = resp.data as any;
                        setFormData({
                            nom: d.nom || '', adresse: d.adresse || '',
                            quartier: d.quartier ? { raw: d.quartier, place_name: d.quartier } as any : null,
                            jours_garde: d.jours_garde ? (typeof d.jours_garde === 'string' ? JSON.parse(d.jours_garde) : d.jours_garde) : {},
                            heures_ouverture: d.heures_ouverture || '08:00', heures_fermeture: d.heures_fermeture || '20:00',
                            permanent_24h: d.permanent_24h || false, telephone: d.telephone || '',
                            telephone_urgence: d.telephone_urgence || '', whatsapp: d.whatsapp || '',
                            email: d.email || '', services: d.services || [],
                        });
                        setSelectedServices(d.services || []);
                        if (d.gps) setSelectedGPS(d.gps);
                    }
                } catch (e) { console.error('[PharmacieForm] Edit load:', e); } finally { setLoading(false); }
            })();
        }
    }, [mode, specializedServiceId, serviceId]);

    const loadProducts = async (pharmaId: number) => {
        try {
            setLoadingProducts(true);
            const resp = await apiGet(`/api/pharmacies/${pharmaId}/products`);
            const d = (resp?.data || resp) as any;
            const prods = Array.isArray(d?.data) ? d.data : Array.isArray(d?.products) ? d.products : Array.isArray(d) ? d : [];
            setProducts(prods);
        } catch (e) { console.log('[PharmacieForm] Produits:', e); } finally { setLoadingProducts(false); }
    };

    const loadAnalytics = async (pharmaId: number) => {
        try {
            const resp = await apiGet(`/api/pharmacies/${pharmaId}/analytics`);
            const d = (resp?.data || resp) as any;
            if (d?.data || d?.total_orders !== undefined) setAnalyticsData(d?.data || d);
        } catch (e) { console.log('[PharmacieForm] Analytics:', e); }
    };

    // ─── HANDLERS ────────────────────────────────────────────────────────
    const handleRefresh = async () => {
        setRefreshing(true);
        const pid = pharmacyData?.service_id || pharmacyData?.id || serviceId;
        if (pid) { await Promise.all([loadProducts(pid), loadAnalytics(pid)]); }
        setRefreshing(false);
    };

    const handleToggleGuard = async () => {
        if (!pharmacyData?.id) return;
        try {
            const newStatus = !isOnDuty;
            await apiPatch(`/api/pharmacies/${pharmacyData.id}/on-duty`, { is_on_duty_now: newStatus });
            setIsOnDuty(newStatus);
            Alert.alert(t('message.success'), newStatus ? t('pharmacie.guardActivated') : t('pharmacie.guardDeactivated'));
        } catch (e) { Alert.alert(t('message.error'), t('pharmacie.cannotChangeStatus')); }
    };

    const handleGPSSelect = (coords: string) => { setSelectedGPS(coords); setShowGPSModal(false); };
    const handleGuardDaysSave = (days: Record<string, number[]>) => { setFormData({ ...formData, jours_garde: days }); setShowGuardDaysModal(false); };

    const openProductModal = (product?: PharmacyProduct) => {
        if (product) {
            setEditingProduct(product);
            setProductFormData({ nom_produit: product.nom_produit, description: product.description || '', prix: String(product.prix), stock: String(product.stock), unite: product.unite, code_barre: product.code_barre || '', categorie: product.categorie || '' });
        } else {
            setEditingProduct(null);
            setProductFormData({ nom_produit: '', description: '', prix: '', stock: '', unite: t('pharmacieFormScreen.unite'), code_barre: '', categorie: '' });
        }
        setShowProductModal(true);
    };
    const closeProductModal = () => { setShowProductModal(false); setEditingProduct(null); };

    const handleSaveProduct = async () => {
        if (!productFormData.nom_produit.trim()) { Alert.alert(t('message.error'), t('pharmacie.productNameRequired')); return; }
        const pid = pharmacyData?.service_id || serviceId;
        if (!pid) { Alert.alert(t('message.error'), t('pharmacie.pharmacyNotRegistered')); return; }
        setLoading(true);
        try {
            const payload = { pharmacy_service_id: pid, nom_produit: productFormData.nom_produit.trim(), description: productFormData.description || null, prix: parseFloat(productFormData.prix) || 0, stock: parseInt(productFormData.stock) || 0, unite: productFormData.unite, code_barre: productFormData.code_barre || null, categorie: productFormData.categorie || null };
            if (editingProduct) {
                await apiPatch(`/api/pharmacies/products/${editingProduct.id}`, payload);
            } else {
                await apiPost('/api/pharmacies/products', payload);
            }
            closeProductModal();
            loadProducts(pid);
        } catch (e: any) { Alert.alert(t('message.error'), e.message || t('pharmacie.productSaveError')); } finally { setLoading(false); }
    };

    const handleDeleteProduct = (product: PharmacyProduct) => {
        Alert.alert(t('message.delete'), t('pharmacie.deleteProduct', { name: product.nom_produit }), [
            { text: t('message.cancel'), style: 'cancel' },
            {
                text: t('common.delete'), style: 'destructive', onPress: async () => {
                    try {
                        await apiDelete(`/api/pharmacies/products/${product.id}`);
                        const pid = pharmacyData?.service_id || serviceId;
                        if (pid) loadProducts(pid);
                    } catch (e) { Alert.alert(t('message.error'), t('pharmacie.cannotDelete')); }
                }
            },
        ]);
    };

    const handleExportProducts = () => {
        const csv = ['nom_produit,prix,stock,unite,categorie', ...products.map(p => `${p.nom_produit},${p.prix},${p.stock},${p.unite},${p.categorie || ''}`)].join('\n');
        Alert.alert('Export', t('pharmacie.exportDone', { count: products.length }));
    };

    const parseBulkImportInput = (inputText: string) => {
        const parsedProducts: any[] = [];
        const invalids: string[] = [];
        const trimmed = inputText.trim();
        if (!trimmed) {
            return { parsedProducts, invalids };
        }

        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            const parsed = JSON.parse(trimmed);
            const rows = Array.isArray(parsed) ? parsed : [parsed];
            rows.forEach((row: any, idx: number) => {
                const nom = String(row?.nom_produit || row?.nom || row?.product_name || '').trim();
                if (!nom) {
                    invalids.push(`Ligne ${idx + 1}: nom_produit manquant`);
                    return;
                }
                parsedProducts.push({
                    nom_produit: nom,
                    prix: Number(row?.prix ?? row?.price ?? 0) || 0,
                    stock: Number(row?.stock ?? row?.quantity ?? 0) || 0,
                    unite: row?.unite || row?.unit || t('pharmacieForm.unite'),
                    code_barre: row?.code_barre || row?.barcode || undefined,
                    categorie: row?.categorie || row?.category || undefined,
                    description: row?.description || undefined,
                });
            });
            return { parsedProducts, invalids };
        }

        const lines = trimmed.split('\n').filter(l => l.trim());
        const firstLower = lines[0]?.toLowerCase() || '';
        const hasHeader = firstLower.includes('nom') || firstLower.includes('prix') || firstLower.includes('product');
        const dataLines = hasHeader ? lines.slice(1) : lines;
        dataLines.forEach((line, idx) => {
            const parts = line.split(/[,;\t]/).map(s => s.trim().replace(/^"|"$/g, ''));
            const nom = (parts[0] || '').trim();
            if (!nom) {
                invalids.push(`Ligne ${idx + 1}: nom_produit manquant`);
                return;
            }
            const rawPrice = parts[1]?.replace(',', '.');
            const rawStock = parts[2];
            const prix = parseFloat(rawPrice || '0');
            const stock = parseInt(rawStock || '0');
            if (Number.isNaN(prix) || prix < 0) {
                invalids.push(`Ligne ${idx + 1}: prix invalide`);
                return;
            }
            if (Number.isNaN(stock) || stock < 0) {
                invalids.push(`Ligne ${idx + 1}: stock invalide`);
                return;
            }
            parsedProducts.push({
                nom_produit: nom,
                prix,
                stock,
                unite: parts[3] || t('pharmacieForm.unite'),
                code_barre: parts[4] || undefined,
                categorie: parts[5] || undefined,
                description: parts[6] || undefined,
            });
        });
        return { parsedProducts, invalids };
    };

    const resetImportWizard = () => {
        setImportWizardStep(1);
        setImportSource('paste');
        setPreviewProducts([]);
        setInvalidLines([]);
        setBulkImportText('');
    };

    const handlePreviewBulkImport = () => {
        if (importSource !== 'external' && !bulkImportText.trim()) {
            Alert.alert(t('message.error'), 'Ajoutez des données avant la prévisualisation.');
            return;
        }
        if (importSource === 'external') {
            setImportWizardStep(3);
            return;
        }
        try {
            const { parsedProducts, invalids } = parseBulkImportInput(bulkImportText);
            setPreviewProducts(parsedProducts);
            setInvalidLines(invalids);
            if (parsedProducts.length === 0) {
                Alert.alert(t('message.error'), t('pharmacie.noProductsDetected'));
                return;
            }
            setImportWizardStep(2);
        } catch (e: any) {
            const msg = e?.message || 'Format invalide';
            if (msg.includes('JSON')) {
                Alert.alert(t('pharmacie.jsonFormatError'), t('pharmacie.jsonFormatErrorMsg'));
            } else {
                Alert.alert(t('message.error'), msg);
            }
        }
    };

    const handleBulkImport = async () => {
        const pid = pharmacyData?.service_id || serviceId;
        if (!pid) { Alert.alert(t('message.error'), t('pharmacie.pharmacyNotRegistered')); return; }
        setLoadingBulkImport(true);
        try {
            if (importSource === 'external') {
                await handleExternalApiSync();
                return;
            }

            const parsedProducts = previewProducts.length > 0 ? previewProducts : parseBulkImportInput(bulkImportText).parsedProducts;
            if (parsedProducts.length === 0) { Alert.alert(t('message.error'), t('pharmacie.noProductsDetected')); setLoadingBulkImport(false); return; }
            const resp: any = await apiPost('/api/pharmacies/products/bulk-import', {
                pharmacy_service_id: pid,
                products: parsedProducts,
                overwrite_existing: bulkImportOverwrite,
            });
            const data = resp?.data as any;
            setShowBulkImportModal(false);
            resetImportWizard();
            loadProducts(pid);
            Alert.alert(
                'Import',
                t('pharmacie.importDone', { created: data?.created || 0, updated: data?.updated || 0 }) + (data?.errors?.length > 0 ? t('pharmacie.importErrors', { count: data.errors.length, errors: data.errors.slice(0, 3).join('\n') }) : ''),
            );
        } catch (e: any) {
            const msg = e?.message || 'Erreur import';
            if (msg.includes('JSON')) { Alert.alert(t('pharmacie.jsonFormatError'), t('pharmacie.jsonFormatErrorMsg')); }
            else { Alert.alert(t('message.error'), msg); }
        } finally { setLoadingBulkImport(false); }
    };

    const handlePickImportFile = async () => {
        try {
            setImportSource('file');
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'text/csv',
                    'text/plain',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel',
                ],
                copyToCacheDirectory: true,
                multiple: false,
            });
            if (result.canceled || !result.assets?.[0]) return;
            const asset = result.assets[0];
            const fileName = (asset.name || '').toLowerCase();
            const uri = asset.uri;
            if (!uri) return;

            if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                const wb = XLSX.read(base64, { type: 'base64' });
                const firstSheet = wb.SheetNames[0];
                if (!firstSheet) {
                    Alert.alert(t('message.error'), 'Fichier Excel vide');
                    return;
                }
                const ws = wb.Sheets[firstSheet];
                const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
                if (!rows.length) {
                    Alert.alert(t('message.error'), 'Aucune ligne détectée dans le fichier Excel');
                    return;
                }
                const normalized = rows.map((row: any) => ({
                    nom_produit: row.nom_produit || row.nom || row.product_name || '',
                    prix: Number(row.prix ?? row.price ?? 0),
                    stock: Number(row.stock ?? row.quantity ?? 0),
                    unite: row.unite || row.unit || 'unité',
                    code_barre: row.code_barre || row.barcode || undefined,
                    categorie: row.categorie || row.category || undefined,
                    description: row.description || undefined,
                })).filter((r: any) => String(r.nom_produit || '').trim().length > 0);
                setBulkImportText(JSON.stringify(normalized, null, 2));
                Alert.alert('Import', `${normalized.length} produit(s) détecté(s) dans Excel.`);
                return;
            }

            const text = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
            setBulkImportText(text);
            Alert.alert('Import', 'Fichier CSV chargé. Vérifiez puis importez.');
        } catch (e: any) {
            Alert.alert(t('message.error'), e?.message || 'Impossible de lire le fichier importé');
        }
    };

    const handleExternalApiSync = async () => {
        const pid = pharmacyData?.service_id || serviceId;
        if (!pid) {
            Alert.alert(t('message.error'), t('pharmacie.pharmacyNotRegistered'));
            return;
        }
        if (!externalApiUrl.trim()) {
            Alert.alert(t('message.error'), 'URL API externe requise');
            return;
        }
        setLoadingBulkImport(true);
        try {
            const resp: any = await apiPost('/api/pharmacies/products/sync-external', {
                pharmacy_service_id: pid,
                api_url: externalApiUrl.trim(),
                overwrite_existing: bulkImportOverwrite,
                items_path: externalItemsPath.trim() || 'items',
                auth_bearer_token: externalBearerToken.trim() || undefined,
            });
            const data = resp?.data ?? resp;
            loadProducts(pid);
            Alert.alert(
                'Sync API',
                `Créés: ${data?.created || 0}, Mis à jour: ${data?.updated || 0}` +
                (data?.errors?.length ? `\nErreurs: ${data.errors.slice(0, 3).join('\n')}` : ''),
            );
        } catch (e: any) {
            Alert.alert(t('message.error'), e?.message || 'Erreur sync API externe');
        } finally {
            setLoadingBulkImport(false);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        let finalServiceId = serviceId;
        if (!finalServiceId && user?.id) {
            try {
                const resp = await servicesApi.createService({ titre_service: formData.nom || 'Pharmacie', description: 'Pharmacie avec garde', category: 'sante' });
                if (resp.success && resp.data && typeof resp.data === 'object' && 'id' in resp.data) { finalServiceId = (resp.data as any).id; setServiceId(finalServiceId); }
            } catch (e) { Alert.alert(t('message.error'), t('pharmacie.cannotCreateService')); setLoading(false); return; }
        }
        if (!finalServiceId) { Alert.alert(t('message.error'), t('pharmacie.serviceIdMissing')); setLoading(false); return; }
        if (!formData.nom.trim()) { Alert.alert(t('message.error'), t('pharmacie.nameRequired')); setLoading(false); return; }
        if (!formData.telephone.trim()) { Alert.alert(t('message.error'), t('pharmacie.phoneRequired')); setLoading(false); return; }
        try {
            const payload = {
                service_id: finalServiceId, nom: formData.nom, adresse: formData.adresse || null,
                quartier: typeof formData.quartier === 'string' ? formData.quartier : (formData.quartier?.raw || formData.quartier?.place_name || null),
                gps: selectedGPS || (location ? `${location.coords.latitude},${location.coords.longitude}` : null),
                jours_garde: Object.keys(formData.jours_garde).length > 0 ? formData.jours_garde : null,
                heures_ouverture: formData.heures_ouverture || null, heures_fermeture: formData.heures_fermeture || null,
                permanent_24h: formData.permanent_24h, telephone: formData.telephone || null,
                telephone_urgence: formData.telephone_urgence || null, whatsapp: formData.whatsapp || null,
                email: formData.email || null, services: selectedServices.length > 0 ? selectedServices : null,
            };
            const resp = await apiPost('/api/pharmacies', payload);
            if (resp.success) {
                await clearSavedFormData(STORAGE_KEY);
                Alert.alert(t('message.success'), t('pharmacie.pharmacySaved'), [{ text: 'OK', onPress: () => { setIsDashboardMode(true); setActiveTab('overview'); handleRefresh(); } }]);
            } else { Alert.alert(t('message.error'), (resp as any).error || t('pharmacie.cannotSave')); }
        } catch (e: any) { Alert.alert(t('message.error'), e.message || t('pharmacie.genericError')); } finally { setLoading(false); }
    };

    // ─── RENDER: Loading ─────────────────────────────────────────────────
    if (initialLoading) {
        return (
            <View style={s.loadingScreen}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={s.loadingText}>{t('pharmacieForm.chargementDeVotreEspace')}</Text>
            </View>
        );
    }

    // ─── RENDER: Overview Tab ────────────────────────────────────────────
    const renderOverview = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            {/* Stats Grid */}
            <View style={s.statsGrid}>
                {[
                    { label: 'Produits', value: stats.total, icon: 'package', color: '#10B981' },
                    { label: t('pharmacieForm.stockTotal'), value: stats.totalStock.toLocaleString(), icon: 'box', color: '#3B82F6' },
                    { label: 'Valeur stock', value: formatPrice(stats.totalValue), icon: 'banknote', color: '#8B5CF6' },
                    { label: t('pharmacieForm.commandes7j'), value: analyticsData?.orders_7d || 0, icon: 'shopping-bag', color: '#F59E0B' },
                ].map((st, i) => (
                    <View key={i} style={[s.statCard, { borderLeftColor: st.color }]}>
                        <SafeIcon name={st.icon as any} size={18} color={st.color} />
                        <Text style={s.statValue}>{st.value}</Text>
                        <Text style={s.statLabel}>{st.label}</Text>
                    </View>
                ))}
            </View>

            {/* Quick Actions */}
            <Text style={s.sectionTitle}>Actions rapides</Text>
            <View style={s.quickRow}>
                {[
                    { label: isOnDuty ? 'En garde ✓' : 'Hors garde', icon: isOnDuty ? 'shield-check' : 'shield-off', color: isOnDuty ? '#10B981' : '#EF4444', onPress: handleToggleGuard },
                    { label: t('pharmacieForm.ajouterProduit'), icon: 'plus-circle', color: '#3B82F6', onPress: () => { setActiveTab('products'); setTimeout(() => openProductModal(), 200); } },
                    { label: 'IA Interactions', icon: 'brain', color: '#7C3AED', onPress: () => (navigation as any).navigate('PharmacyAIInteractions', { serviceId }) },
                    { label: 'Statistiques', icon: 'bar-chart-2', color: '#F59E0B', onPress: () => (navigation as any).navigate('PharmacyAnalytics', { serviceId }) },
                    { label: 'Finances pharmacie', icon: 'wallet', color: '#0EA5E9', onPress: () => (navigation as any).navigate('PharmacyFinancial') },
                    { label: t('financialTracking.wallet') || 'Portefeuille', icon: 'wallet', color: '#8B5CF6', onPress: () => (navigation as any).navigate('WalletFinancial') },
                    { label: t('common.sortir'), icon: 'log-out', color: '#DC2626', onPress: () => { Alert.alert(t('common.deconnexion'), t('common.confirmDeconnexion'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.seDeconnecter'), style: 'destructive', onPress: logout }]); } },
                ].map((a, i) => (
                    <TouchableOpacity key={i} style={s.quickAction} onPress={a.onPress}>
                        <View style={[s.quickIcon, { backgroundColor: a.color + '15' }]}>
                            <SafeIcon name={a.icon as any} size={22} color={a.color} />
                        </View>
                        <Text style={s.quickLabel} numberOfLines={2}>{a.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Guard Card */}
            <View style={s.guardCard}>
                <View style={[s.guardDot, { backgroundColor: isOnDuty ? '#10B981' : '#EF4444' }]} />
                <View style={{ flex: 1 }}>
                    <Text style={s.guardTitle}>{isOnDuty ? 'Pharmacie en garde' : 'Pharmacie hors garde'}</Text>
                    <Text style={s.guardSub}>{isOnDuty ? 'Visible dans les recherches de garde' : 'Non visible pour les gardes'}</Text>
                </View>
                <Switch value={isOnDuty} onValueChange={handleToggleGuard} trackColor={{ false: '#D1D5DB', true: '#10B981' }} />
            </View>

            {/* Recent Products */}
            {products.length > 0 && (
                <>
                    <View style={s.sectionRow}>
                        <Text style={s.sectionTitle}>{t('pharmacieForm.produitsRecents')}</Text>
                        <TouchableOpacity onPress={() => setActiveTab('products')}>
                            <Text style={s.seeAll}>Tout voir ({products.length})</Text>
                        </TouchableOpacity>
                    </View>
                    {products.slice(0, 3).map(p => (
                        <View key={p.id} style={s.recentProduct}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.rpName}>{p.nom_produit}</Text>
                                <Text style={s.rpDetail}>{p.prix.toLocaleString()} {devise} · Stock: {p.stock} {p.unite}</Text>
                            </View>
                            {p.categorie && <View style={s.rpBadge}><Text style={s.rpBadgeText}>{p.categorie}</Text></View>}
                        </View>
                    ))}
                </>
            )}

            {/* Pharmacy Info */}
            {pharmacyData && (
                <>
                    <Text style={[s.sectionTitle, { marginTop: 20 }]}>Informations</Text>
                    {[
                        pharmacyData.adresse && { icon: 'map-pin', text: pharmacyData.adresse },
                        pharmacyData.telephone && { icon: 'phone', text: pharmacyData.telephone },
                        { icon: 'clock', text: pharmacyData.permanent_24h ? '24h/24' : `${pharmacyData.heures_ouverture || '08:00'} - ${pharmacyData.heures_fermeture || '20:00'}` },
                    ].filter(Boolean).map((info: any, i) => (
                        <View key={i} style={s.infoRow}>
                            <SafeIcon name={info.icon} size={16} color="#6B7280" />
                            <Text style={s.infoText}>{info.text}</Text>
                        </View>
                    ))}
                </>
            )}

            {/* Empty state */}
            {!pharmacyData && products.length === 0 && (
                <View style={s.emptyDash}>
                    <SafeIcon name="activity" size={48} color="#9CA3AF" />
                    <Text style={s.emptyTitle}>{t('pharmacieForm.bienvenueSurVotreDashboard')}</Text>
                    <Text style={s.emptyText}>{t('pharmacieForm.configurezVotrePharmacieDansMon')}</Text>
                    <NativeButton title="Configurer" onPress={() => setActiveTab('service')} style={{ marginTop: 16 }} />
                </View>
            )}
        </ScrollView>
    );

    // ─── RENDER: Service Form Tab ────────────────────────────────────────
    const renderServiceForm = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}>
            {user?.role !== 'partenaire' && (
                <View style={s.field}><NativeInput label={t('pharmacieForm.nomDeLaPharmacie')} value={formData.nom} onChangeText={t => setFormData({ ...formData, nom: t })} placeholder="Ex: Pharmacie Centrale" /></View>
            )}
            <View style={s.field}>
                <Text style={s.label}>{t('pharmacieForm.localisationGps')}</Text>
                <TouchableOpacity style={s.gpsBtn} onPress={() => setShowGPSModal(true)}>
                    <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                    <Text style={s.gpsBtnText}>{selectedGPS ? t('pharmacieFormScreen.localisationSelectionnee') : t('pharmacieFormScreen.selectionnerSurLaCarte')}</Text>
                    <SafeIcon name="chevron-right" size={20} color="#9CA3AF" />
                </TouchableOpacity>
            </View>
            {user?.role !== 'partenaire' && (
                <View style={s.field}><NativeInput label="Adresse" value={formData.adresse} onChangeText={t => setFormData({ ...formData, adresse: t })} placeholder={t('pharmacieForm.adresseComplete')} multiline /></View>
            )}
            <View style={s.field}>
                <LocationSelector label={t('pharmacieForm.quartier')} value={formData.quartier ? (typeof formData.quartier === 'string' ? { raw: formData.quartier, place_name: formData.quartier } : formData.quartier) : ''} onSelect={(loc: LocationObject) => setFormData({ ...formData, quartier: loc })} placeholder={t('pharmacieForm.rechercherUnLieu')} scope="all" enrichWithBackend />
            </View>
            <View style={s.field}>
                <Text style={s.label}>{t('pharmacieForm.joursDeGarde')}</Text>
                <TouchableOpacity style={s.greenBtn} onPress={() => setShowGuardDaysModal(true)}>
                    <SafeIcon name="calendar" size={18} color="#fff" />
                    <Text style={s.greenBtnText}>{Object.keys(formData.jours_garde).length > 0 ? 'Modifier planification' : 'Planifier jours de garde'}</Text>
                </TouchableOpacity>
                {Object.keys(formData.jours_garde).length > 0 && (
                    <View style={s.guardSummary}><Text style={s.guardSummaryText}>{Object.values(formData.jours_garde).reduce((s, d) => s + d.length, 0)} jour(s) sur {Object.keys(formData.jours_garde).length} mois</Text></View>
                )}
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[s.field, { flex: 1 }]}><NativeInput label="Ouverture" value={formData.heures_ouverture} onChangeText={t => setFormData({ ...formData, heures_ouverture: t })} placeholder="08:00" /></View>
                <View style={[s.field, { flex: 1 }]}><NativeInput label="Fermeture" value={formData.heures_fermeture} onChangeText={t => setFormData({ ...formData, heures_fermeture: t })} placeholder="20:00" /></View>
            </View>
            <View style={s.switchRow}><Text style={s.label}>Ouvert 24h/24</Text><Switch value={formData.permanent_24h} onValueChange={v => setFormData({ ...formData, permanent_24h: v })} trackColor={{ false: '#D1D5DB', true: modernColors.primary }} /></View>
            {user?.role !== 'partenaire' && (
                <>
                    <View style={s.field}><NativeInput label={t('pharmacieForm.telephone')} value={formData.telephone} onChangeText={t => setFormData({ ...formData, telephone: t })} placeholder="+XXX XXXXXXXXX" keyboardType="phone-pad" /></View>
                    <View style={s.field}><NativeInput label="Urgence" value={formData.telephone_urgence} onChangeText={t => setFormData({ ...formData, telephone_urgence: t })} placeholder="+XXX XXXXXXXXX" keyboardType="phone-pad" /></View>
                    <View style={s.field}><NativeInput label="WhatsApp" value={formData.whatsapp} onChangeText={t => setFormData({ ...formData, whatsapp: t })} placeholder="+XXX XXXXXXXXX" keyboardType="phone-pad" /></View>
                    <View style={s.field}><NativeInput label="Email" value={formData.email} onChangeText={t => setFormData({ ...formData, email: t })} placeholder="pharmacie@example.com" keyboardType="email-address" autoCapitalize="none" /></View>
                </>
            )}
            <View style={s.field}><SimplePrestationSelector label={t('pharmacieForm.servicesProposes')} options={SERVICES_OPTIONS} selected={selectedServices} onSelectionChange={setSelectedServices} allowCustom placeholder={t('pharmacieForm.ajouterUnService')} /></View>
            <NativeButton title={loading ? 'Enregistrement...' : (isDashboardMode ? t('pharmacieFormScreen.mettreAJour') : 'Enregistrer la Pharmacie')} onPress={handleSubmit} disabled={loading || !formData.nom.trim()} variant="primary" size="large" style={{ marginTop: 24 }} />
        </ScrollView>
    );

    // ─── RENDER: Products Tab ────────────────────────────────────────────
    const renderProductsTab = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            {/* Stats */}
            {products.length > 0 && (
                <View style={s.prodStats}>
                    <View style={s.prodStatItem}><Text style={s.prodStatVal}>{stats.total}</Text><Text style={s.prodStatLbl}>Produits</Text></View>
                    <View style={s.prodStatDiv} />
                    <View style={s.prodStatItem}><Text style={s.prodStatVal}>{stats.totalStock.toLocaleString()}</Text><Text style={s.prodStatLbl}>Stock</Text></View>
                    <View style={s.prodStatDiv} />
                    <View style={s.prodStatItem}><Text style={s.prodStatVal}>{formatPrice(stats.totalValue)}</Text><Text style={s.prodStatLbl}>Valeur</Text></View>
                </View>
            )}
            {/* Actions Bar */}
            <View style={s.prodActions}>
                <TouchableOpacity style={s.addProdBtn} onPress={() => openProductModal()}>
                    <SafeIcon name="plus" size={18} color="#fff" /><Text style={s.addProdText}>{t('pharmacieFormScreen.ajouter')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.bulkBtn} onPress={() => { resetImportWizard(); setShowBulkImportModal(true); }}>
                    <SafeIcon name="upload" size={16} color="#fff" />
                </TouchableOpacity>
                {products.length > 0 && (
                    <TouchableOpacity style={s.exportBtn} onPress={handleExportProducts}>
                        <SafeIcon name="download" size={16} color={modernColors.primary} />
                    </TouchableOpacity>
                )}
            </View>
            {/* Search */}
            {products.length > 0 && (
                <View style={s.searchBar}>
                    <SafeIcon name="search" size={18} color="#9CA3AF" />
                    <NativeInput value={searchQuery} onChangeText={setSearchQuery} placeholder={t('pharmacieForm.rechercher')} style={{ flex: 1, backgroundColor: 'transparent' }} />
                    {searchQuery.trim() !== '' && <TouchableOpacity onPress={() => setSearchQuery('')}><SafeIcon name="x" size={18} color="#9CA3AF" /></TouchableOpacity>}
                </View>
            )}
            {/* List */}
            {loadingProducts ? <ActivityIndicator size="large" color={modernColors.primary} style={{ marginTop: 32 }} /> :
                products.length === 0 ? (
                    <View style={s.emptyDash}>
                        <SafeIcon name="package" size={48} color="#9CA3AF" />
                        <Text style={s.emptyTitle}>{t('pharmacieForm.aucunMedicament')}</Text>
                        <Text style={s.emptyText}>{t('pharmacieForm.ajoutezVosProduitsPourLes')}</Text>
                        <NativeButton title={t('pharmacieForm.ajouterUnProduit')} onPress={() => openProductModal()} style={{ marginTop: 16 }} />
                    </View>
                ) : (
                    filteredProducts.map(p => (
                        <View key={p.id} style={s.prodCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.prodName}>{p.nom_produit}</Text>
                                {p.description ? <Text style={s.prodDesc}>{p.description}</Text> : null}
                                <Text style={s.prodPrice}>{p.prix.toLocaleString()} {devise} / {p.unite} · Stock: {p.stock}</Text>
                                {p.categorie ? <View style={s.rpBadge}><Text style={s.rpBadgeText}>{p.categorie}</Text></View> : null}
                            </View>
                            <View style={{ gap: 6 }}>
                                <TouchableOpacity style={s.iconBtn} onPress={() => openProductModal(p)}><SafeIcon name="edit" size={16} color={modernColors.primary} /></TouchableOpacity>
                                <TouchableOpacity style={[s.iconBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => handleDeleteProduct(p)}><SafeIcon name="trash-2" size={16} color="#DC2626" /></TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
        </ScrollView>
    );

    // ─── RENDER: Analytics Tab ───────────────────────────────────────────
    const renderAnalytics = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            <View style={s.analyticsCard}>
                <View style={s.analyticsHdr}><SafeIcon name="bar-chart-2" size={22} color="#8B5CF6" /><Text style={s.analyticsTitle}>{t('pharmacieForm.commandes')}</Text></View>
                {analyticsData ? (
                    <View style={{ gap: 12 }}>
                        {[
                            { l: 'Commandes totales', v: analyticsData.total_orders },
                            { l: 'Commandes (7j)', v: analyticsData.orders_7d },
                            { l: 'Commandes (30j)', v: analyticsData.orders_30d },
                            { l: 'Revenu total', v: formatPrice(analyticsData.total_revenue), c: '#10B981' },
                            { l: 'Panier moyen', v: formatPrice(analyticsData.avg_order_value) },
                        ].map((r, i) => (
                            <View key={i} style={s.analyticsRow}><Text style={s.analyticsLbl}>{r.l}</Text><Text style={[s.analyticsVal, r.c ? { color: r.c } : {}]}>{r.v}</Text></View>
                        ))}
                    </View>
                ) : <Text style={s.analyticsEmpty}>{t('pharmacieForm.disponibleApresLesPremieresCommandes')}</Text>}
            </View>
            <View style={s.analyticsCard}>
                <View style={s.analyticsHdr}><SafeIcon name="package" size={22} color="#3B82F6" /><Text style={s.analyticsTitle}>Inventaire</Text></View>
                <View style={{ gap: 12 }}>
                    {[
                        { l: 'Produits', v: stats.total },
                        { l: 'Stock total', v: stats.totalStock.toLocaleString() },
                        { l: 'Valeur stock', v: formatPrice(stats.totalValue), c: '#8B5CF6' },
                        { l: t('pharmacieFormScreen.categories'), v: stats.categories },
                    ].map((r, i) => (
                        <View key={i} style={s.analyticsRow}><Text style={s.analyticsLbl}>{r.l}</Text><Text style={[s.analyticsVal, r.c ? { color: r.c } : {}]}>{r.v}</Text></View>
                    ))}
                </View>
            </View>
            <View style={s.analyticsCard}>
                <View style={s.analyticsHdr}><SafeIcon name="sparkles" size={22} color="#F59E0B" /><Text style={s.analyticsTitle}>Intelligence Artificielle</Text></View>
                <Text style={s.analyticsEmpty}>{t('pharmacieForm.interactionsMedicamenteusesEtSuggestions')}</Text>
                <NativeButton title="Tester les interactions IA" onPress={() => (navigation as any).navigate('PharmacyAIInteractions')} style={{ marginTop: 12, backgroundColor: '#F59E0B' }} />
            </View>
        </ScrollView>
    );

    // ─── RENDER: Product Modal ───────────────────────────────────────────
    const renderProductModal = () => (
        <Modal visible={showProductModal} animationType="slide" transparent onRequestClose={closeProductModal}>
            <View style={s.modalOverlay}><View style={s.modalContent}>
                <View style={s.modalHeader}>
                    <Text style={s.modalTitle}>{editingProduct ? 'Modifier' : t('pharmacieFormScreen.ajouterUnMedicament')}</Text>
                    <TouchableOpacity onPress={closeProductModal}><SafeIcon name="x" size={24} color="#6B7280" /></TouchableOpacity>
                </View>
                <ScrollView style={{ padding: 16, maxHeight: 500 }}>
                    <View style={s.field}><NativeInput label="Nom *" value={productFormData.nom_produit} onChangeText={t => setProductFormData({ ...productFormData, nom_produit: t })} placeholder={t('pharmacieForm.exParacetamol500mg')} /></View>
                    <View style={s.field}><NativeInput label="Description" value={productFormData.description} onChangeText={t => setProductFormData({ ...productFormData, description: t })} placeholder={t('pharmacieFormScreen.description')} multiline /></View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={[s.field, { flex: 1 }]}><NativeInput label={`${t('pharmacieFormScreen.price')} (${devise}) *`} value={productFormData.prix} onChangeText={t => setProductFormData({ ...productFormData, prix: t })} placeholder="0" keyboardType="numeric" /></View>
                        <View style={[s.field, { flex: 1 }]}><NativeInput label={t('pharmacieForm.stock')} value={productFormData.stock} onChangeText={t => setProductFormData({ ...productFormData, stock: t })} placeholder="0" keyboardType="numeric" /></View>
                    </View>
                    <Text style={s.label}>{t('pharmacieForm.unite')}</Text>
                    <View style={s.chips}>{UNITE_OPTIONS.map(u => <TouchableOpacity key={u} style={[s.chip, productFormData.unite === u && s.chipOn]} onPress={() => setProductFormData({ ...productFormData, unite: u })}><Text style={[s.chipText, productFormData.unite === u && s.chipTextOn]}>{u}</Text></TouchableOpacity>)}</View>
                    <Text style={[s.label, { marginTop: 16 }]}>{t('pharmacieForm.categorie')}</Text>
                    <View style={s.chips}>{CATEGORIE_OPTIONS.map(c => <TouchableOpacity key={c} style={[s.chip, productFormData.categorie === c && s.chipOn]} onPress={() => setProductFormData({ ...productFormData, categorie: c })}><Text style={[s.chipText, productFormData.categorie === c && s.chipTextOn]}>{c}</Text></TouchableOpacity>)}</View>
                    <View style={[s.field, { marginTop: 16 }]}><NativeInput label="Code-barres" value={productFormData.code_barre} onChangeText={t => setProductFormData({ ...productFormData, code_barre: t })} placeholder="1234567890123" keyboardType="numeric" /></View>
                </ScrollView>
                <View style={s.modalFooter}>
                    <NativeButton title={t('pharmacieFormScreen.annuler')} onPress={closeProductModal} variant="secondary" style={{ flex: 1 }} />
                    <NativeButton title={editingProduct ? t('pharmacieFormScreen.modifier') : t('pharmacieFormScreen.ajouter')} onPress={handleSaveProduct} variant="primary" style={{ flex: 1 }} disabled={loading || !productFormData.nom_produit.trim()} />
                </View>
            </View></View>
        </Modal>
    );

    // ─── RENDER: Bulk Import Modal ───────────────────────────────────────
    const renderBulkImportModal = () => (
        <Modal visible={showBulkImportModal} animationType="slide" transparent onRequestClose={() => { setShowBulkImportModal(false); resetImportWizard(); }}>
            <View style={s.modalOverlay}><View style={s.modalContent}>
                <View style={s.modalHeader}>
                    <Text style={s.modalTitle}>Import en masse (Etape {importWizardStep}/3)</Text>
                    <TouchableOpacity onPress={() => { setShowBulkImportModal(false); resetImportWizard(); }}><SafeIcon name="x" size={24} color="#6B7280" /></TouchableOpacity>
                </View>
                <ScrollView style={{ padding: 16, maxHeight: 500 }}>
                    <View style={{ flexDirection: 'row', marginBottom: 12, gap: 8 }}>
                        {[1, 2, 3].map((step) => (
                            <View key={step} style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: importWizardStep >= step ? '#10B981' : '#E5E7EB' }} />
                        ))}
                    </View>

                    {importWizardStep === 1 && (
                        <>
                            <Text style={{ fontSize: 13, fontWeight: '700', marginBottom: 8, color: '#111827' }}>Choix source</Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                                <TouchableOpacity onPress={() => setImportSource('paste')} style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: importSource === 'paste' ? '#DBEAFE' : '#F3F4F6' }}>
                                    <Text style={{ textAlign: 'center', fontWeight: '700', color: '#1E3A8A' }}>Coller texte</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setImportSource('file')} style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: importSource === 'file' ? '#DBEAFE' : '#F3F4F6' }}>
                                    <Text style={{ textAlign: 'center', fontWeight: '700', color: '#1E3A8A' }}>Fichier CSV/Excel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setImportSource('external')} style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: importSource === 'external' ? '#DBEAFE' : '#F3F4F6' }}>
                                    <Text style={{ textAlign: 'center', fontWeight: '700', color: '#1E3A8A' }}>API externe</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Guide / Aide */}
                            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, backgroundColor: '#EFF6FF', borderRadius: 8, marginBottom: 12 }} onPress={() => setShowBulkGuide(!showBulkGuide)}>
                                <SafeIcon name="help-circle" size={18} color="#3B82F6" />
                                <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: '#3B82F6' }}>Guide format CSV/Excel attendu</Text>
                                <SafeIcon name={showBulkGuide ? 'chevron-up' : 'chevron-down'} size={16} color="#3B82F6" />
                            </TouchableOpacity>

                            {showBulkGuide && (
                                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' }}>
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 4 }}>Colonnes attendues</Text>
                                    <Text style={{ fontSize: 12, color: '#4B5563', lineHeight: 18 }}>
                                        Obligatoire: nom_produit{"\n"}
                                        Optionnelles: prix, stock, unite, code_barre, categorie, description
                                    </Text>
                                    <View style={{ backgroundColor: '#1F2937', borderRadius: 8, padding: 10, marginVertical: 6 }}>
                                        <Text style={{ fontSize: 11, color: '#A5F3FC', fontFamily: 'monospace' }}>
                                            {`nom_produit;prix;stock;unite;code_barre;categorie;description\nParacetamol 500mg;1500;200;boite;3401560123;analgesique;Douleurs et fièvre`}
                                        </Text>
                                    </View>
                                    <Text style={{ fontSize: 12, color: '#4B5563', lineHeight: 18 }}>
                                        En mode "Remplacer existants" désactivé: les stocks existants sont incrémentés.{"\n"}
                                        En mode activé: prix/stock/champs sont remplacés pour les produits déjà existants.
                                    </Text>
                                </View>
                            )}

                            {importSource !== 'external' && (
                                <>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Collez vos données ici (CSV/JSON) :</Text>
                                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                                        <TouchableOpacity
                                            style={{ flex: 1, backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
                                            onPress={handlePickImportFile}
                                        >
                                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Charger fichier CSV/Excel</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <NativeInput value={bulkImportText} onChangeText={setBulkImportText} placeholder={`nom_produit;prix;stock;unite;categorie\nParacetamol 500mg;1500;200;boite;analgesique`} multiline style={{ minHeight: 150, fontFamily: 'monospace', fontSize: 12 }} />
                                </>
                            )}

                            {importSource === 'external' && (
                                <View style={{ marginTop: 6 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 6 }}>Connecteur API externe</Text>
                                    <NativeInput value={externalApiUrl} onChangeText={setExternalApiUrl} placeholder="https://api.ma-pharmacie.com/catalog" />
                                    <NativeInput value={externalItemsPath} onChangeText={setExternalItemsPath} placeholder="items ou data.items" style={{ marginTop: 8 }} />
                                    <NativeInput value={externalBearerToken} onChangeText={setExternalBearerToken} placeholder="Bearer token (optionnel)" style={{ marginTop: 8 }} />
                                </View>
                            )}
                        </>
                    )}

                    {importWizardStep === 2 && (
                        <>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>Prévisualisation</Text>
                            <Text style={{ marginTop: 4, marginBottom: 10, color: '#4B5563' }}>
                                Lignes valides: {previewProducts.length} · Lignes invalides: {invalidLines.length}
                            </Text>
                            {invalidLines.length > 0 && (
                                <View style={{ backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                                    <Text style={{ fontWeight: '700', color: '#991B1B', marginBottom: 6 }}>Lignes invalides détectées</Text>
                                    {invalidLines.slice(0, 20).map((err, idx) => (
                                        <Text key={`inv-${idx}`} style={{ color: '#B91C1C', fontSize: 12 }}>- {err}</Text>
                                    ))}
                                </View>
                            )}
                            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10 }}>
                                <Text style={{ fontWeight: '700', color: '#1F2937', marginBottom: 6 }}>Aperçu produits valides (max 10)</Text>
                                {previewProducts.slice(0, 10).map((p, idx) => (
                                    <Text key={`pv-${idx}`} style={{ fontSize: 12, color: '#374151' }}>
                                        {idx + 1}. {p.nom_produit} | Prix: {p.prix} | Stock: {p.stock} | Unité: {p.unite}
                                    </Text>
                                ))}
                            </View>
                        </>
                    )}

                    {importWizardStep === 3 && (
                        <>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 8 }}>Confirmation import</Text>
                            <View style={[s.switchRow, { marginTop: 6 }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.label}>Remplacer existants</Text>
                                    <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                                        OFF: cumule stock existant · ON: remplace prix/stock/champs des produits existants
                                    </Text>
                                </View>
                                <Switch value={bulkImportOverwrite} onValueChange={setBulkImportOverwrite} trackColor={{ false: '#D1D5DB', true: modernColors.primary }} />
                            </View>
                            {importSource === 'external' ? (
                                <Text style={{ marginTop: 8, color: '#4B5563' }}>Prêt à synchroniser via API externe.</Text>
                            ) : (
                                <Text style={{ marginTop: 8, color: '#4B5563' }}>Produits valides prêts à importer: {previewProducts.length}</Text>
                            )}
                        </>
                    )}
                </ScrollView>
                <View style={s.modalFooter}>
                    <NativeButton
                        title={importWizardStep === 1 ? t('pharmacieFormScreen.cancel') : 'Retour'}
                        onPress={() => {
                            if (importWizardStep === 1) {
                                setShowBulkImportModal(false);
                                resetImportWizard();
                            } else {
                                setImportWizardStep((prev) => (prev === 3 ? 2 : 1));
                            }
                        }}
                        variant="secondary"
                        style={{ flex: 1 }}
                    />
                    {importWizardStep < 3 ? (
                        <NativeButton
                            title={importWizardStep === 1 ? 'Prévisualiser' : 'Confirmer la prévisualisation'}
                            onPress={() => {
                                if (importWizardStep === 1) {
                                    handlePreviewBulkImport();
                                } else {
                                    setImportWizardStep(3);
                                }
                            }}
                            variant="primary"
                            style={{ flex: 1 }}
                            disabled={
                                loadingBulkImport ||
                                (importWizardStep === 1 && importSource !== 'external' && !bulkImportText.trim()) ||
                                (importWizardStep === 1 && importSource === 'external' && !externalApiUrl.trim()) ||
                                (importWizardStep === 2 && previewProducts.length === 0)
                            }
                        />
                    ) : (
                        <NativeButton
                            title={loadingBulkImport ? 'Import...' : (importSource === 'external' ? 'Lancer la synchronisation' : 'Importer maintenant')}
                            onPress={handleBulkImport}
                            variant="primary"
                            style={{ flex: 1 }}
                            disabled={loadingBulkImport || (importSource !== 'external' && previewProducts.length === 0)}
                        />
                    )}
                </View>
            </View></View>
        </Modal>
    );

    // ─── RENDER: Dashboard (main) ────────────────────────────────────────
    if (isDashboardMode || (user?.role === 'partenaire' && serviceId)) {
        const tabs: { key: TabType; label: string; icon: string }[] = [
            { key: 'overview', label: t('pharmacieForm.accueil'), icon: 'layout-dashboard' },
            { key: 'service', label: 'Service', icon: 'settings' },
            { key: 'products', label: 'Produits', icon: 'package' },
            { key: 'analytics', label: 'Stats', icon: 'bar-chart-2' },
            { key: 'team', label: t('pharmacieForm.equipe'), icon: 'users' },
        ];

        return (
            <View style={s.container}>
                <LinearGradient colors={['#047857', '#10B981']} style={s.dashHeader}>
                    <View style={s.dashHeaderRow}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><SafeIcon name="arrow-left" size={24} color="#fff" /></TouchableOpacity>
                        <View style={{ flex: 1 }}>
                            <Text style={s.dashTitle}>{pharmacyData?.nom || formData.nom || t('pharmacieForm.maPharmacie')}</Text>
                            <Text style={s.dashSub}>{stats.total} produit{stats.total !== 1 ? 's' : ''} · {isOnDuty ? '🟢 En garde' : '🔴 Hors garde'}</Text>
                        </View>
                    </View>
                    <View style={s.tabsRow}>
                        {tabs.map(t => (
                            <TouchableOpacity key={t.key} style={[s.tab, activeTab === t.key && s.tabOn]} onPress={() => setActiveTab(t.key)}>
                                <SafeIcon name={t.icon as any} size={14} color={activeTab === t.key ? '#fff' : '#ffffff70'} />
                                <Text style={[s.tabText, activeTab === t.key && s.tabTextOn]}>{t.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </LinearGradient>
                <View style={s.dashContent}>
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'service' && renderServiceForm()}
                    {activeTab === 'products' && renderProductsTab()}
                    {activeTab === 'analytics' && renderAnalytics()}
                    {activeTab === 'team' && <ServiceTeamManager serviceId={serviceId?.toString()} onClose={() => setActiveTab('overview')} />}
                </View>
                <ModernGPSModal visible={showGPSModal} onClose={() => setShowGPSModal(false)} onSelect={handleGPSSelect} currentLocation={location ? { lat: location.coords.latitude, lng: location.coords.longitude } : null} title="Localisation pharmacie" />
                <GuardDaysSelector visible={showGuardDaysModal} onClose={() => setShowGuardDaysModal(false)} onSave={handleGuardDaysSave} initialDays={formData.jours_garde} title="Jours de garde" />
                {renderProductModal()}
                {renderBulkImportModal()}
            </View>
        );
    }

    // ─── RENDER: Creation Mode ───────────────────────────────────────────
    return (
        <View style={s.container}>
            <LinearGradient colors={['#047857', '#10B981']} style={s.createHeader}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><SafeIcon name="arrow-left" size={24} color="#fff" /></TouchableOpacity>
                <Text style={s.createTitle}>{t('pharmacieFormScreen.enregistrerUnePharmacie')}</Text>
            </LinearGradient>
            {renderServiceForm()}
            <ModernGPSModal visible={showGPSModal} onClose={() => setShowGPSModal(false)} onSelect={handleGPSSelect} currentLocation={location ? { lat: location.coords.latitude, lng: location.coords.longitude } : null} title="Localisation pharmacie" />
            <GuardDaysSelector visible={showGuardDaysModal} onClose={() => setShowGuardDaysModal(false)} onSave={handleGuardDaysSave} initialDays={formData.jours_garde} title="Jours de garde" />
            {renderProductModal()}
            {renderBulkImportModal()}
        </View>
    );
};

// ─── STYLES ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    loadingText: { marginTop: 12, fontSize: 15, color: '#6B7280', fontWeight: '500' },

    // Dashboard Header
    dashHeader: { paddingTop: 50, paddingBottom: 8, paddingHorizontal: 16 },
    dashHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    backBtn: { marginRight: 12, padding: 4 },
    dashTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
    dashSub: { fontSize: 13, color: '#ffffffCC', marginTop: 2 },
    dashContent: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

    // Creation Header
    createHeader: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
    createTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },

    // Tabs
    tabsRow: { flexDirection: 'row', gap: 4, paddingBottom: 8 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 8, backgroundColor: '#ffffff15' },
    tabOn: { backgroundColor: '#ffffff30' },
    tabText: { fontSize: 11, color: '#ffffff70', fontWeight: '500' },
    tabTextOn: { color: '#fff', fontWeight: '700' },

    // Stats Grid
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    statCard: { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderLeftWidth: 3, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
    statValue: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 8 },
    statLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },

    // Quick Actions
    quickRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    quickAction: { flex: 1, alignItems: 'center', gap: 6 },
    quickIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    quickLabel: { fontSize: 11, color: '#374151', fontWeight: '500', textAlign: 'center' },

    // Guard Card
    guardCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#fff', borderRadius: 12, marginBottom: 20, elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
    guardDot: { width: 12, height: 12, borderRadius: 6 },
    guardTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
    guardSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },

    // Section
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    seeAll: { fontSize: 13, color: modernColors.primary, fontWeight: '600' },

    // Recent Product
    recentProduct: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#fff', borderRadius: 10, marginBottom: 8, elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
    rpName: { fontSize: 15, fontWeight: '600', color: '#111827' },
    rpDetail: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    rpBadge: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#EEF2FF', borderRadius: 6, alignSelf: 'flex-start', marginTop: 4 },
    rpBadgeText: { fontSize: 11, fontWeight: '600', color: modernColors.primary },

    // Info
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    infoText: { fontSize: 14, color: '#374151' },

    // Empty
    emptyDash: { alignItems: 'center', padding: 32, backgroundColor: '#fff', borderRadius: 12, marginTop: 8 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 16 },
    emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 20 },

    // Form
    field: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
    hint: { fontSize: 12, color: '#6B7280', marginBottom: 12, fontStyle: 'italic' },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingVertical: 8 },
    gpsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, gap: 12 },
    gpsBtnText: { flex: 1, fontSize: 14, color: '#111827' },
    greenBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, backgroundColor: modernColors.primary, borderRadius: 8, marginTop: 8 },
    greenBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
    guardSummary: { marginTop: 8, padding: 12, backgroundColor: '#EEF2FF', borderRadius: 8, borderWidth: 1, borderColor: '#C7D2FE' },
    guardSummaryText: { fontSize: 13, fontWeight: '600', color: modernColors.primary },

    // Products Tab
    prodStats: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 10, marginBottom: 12 },
    prodStatItem: { flex: 1, alignItems: 'center' },
    prodStatVal: { fontSize: 18, fontWeight: '700', color: modernColors.primary },
    prodStatLbl: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    prodStatDiv: { width: 1, height: 36, backgroundColor: '#E5E7EB', marginHorizontal: 8 },
    prodActions: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    addProdBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: modernColors.primary, borderRadius: 8 },
    addProdText: { fontSize: 14, fontWeight: '600', color: '#fff' },
    bulkBtn: { padding: 10, borderRadius: 8, backgroundColor: '#10B981' },
    exportBtn: { padding: 10, borderRadius: 8, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: modernColors.primary },
    searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 },
    prodCard: { flexDirection: 'row', padding: 14, backgroundColor: '#fff', borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#F3F4F6' },
    prodName: { fontSize: 15, fontWeight: '600', color: '#111827' },
    prodDesc: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    prodPrice: { fontSize: 13, fontWeight: '500', color: modernColors.primary, marginTop: 4 },
    iconBtn: { padding: 8, borderRadius: 6, backgroundColor: '#F3F4F6' },

    // Analytics
    analyticsCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
    analyticsHdr: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    analyticsTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
    analyticsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    analyticsLbl: { fontSize: 14, color: '#6B7280' },
    analyticsVal: { fontSize: 16, fontWeight: '700', color: '#111827' },
    analyticsEmpty: { fontSize: 14, color: '#6B7280', fontStyle: 'italic', lineHeight: 20 },

    // Chips
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
    chipOn: { backgroundColor: modernColors.primary, borderColor: modernColors.primary },
    chipText: { fontSize: 13, color: '#374151' },
    chipTextOn: { color: '#fff', fontWeight: '600' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
    modalFooter: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
});

export default PharmacieFormScreen;
