// ✅ 2026-04-01: Wizard Partenaire — Connecter sa boutique à Yukpo
// Permet à n'importe quel partenaire e-commerce de connecter sa boutique en 4 étapes :
// 1. Choisir le type de plateforme (WooCommerce, Shopify, Jumia, CSV, etc.)
// 2. Configurer la connexion (URL, clés API)
// 3. Mapper les champs + tester
// 4. Planifier la synchronisation

import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import {
    ALL_STORE_CATEGORIES,
    AuthType,
    CreateIntegrationPayload,
    EcommercePlatform,
    StoreCategory,
    STORE_CATEGORY_ICONS,
    STORE_CATEGORY_LABELS,
    SyncSchedule,
    TestConnectionResult,
    ecommerceService,
} from '../../services/ecommerceService';

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS: Record<Step, string> = {
    1: 'Plateforme',
    2: 'Connexion',
    3: 'Test',
    4: 'Planification',
};

const SYNC_SCHEDULE_OPTIONS: Array<{ value: SyncSchedule; label: string; description: string }> = [
    { value: 'manual', label: 'Manuelle', description: 'Vous déclenchezla sync vous-même' },
    { value: 'hourly', label: 'Toutes les heures', description: 'Sync automatique chaque heure' },
    { value: 'daily', label: 'Quotidienne', description: 'Sync automatique 1x/jour' },
    { value: 'weekly', label: 'Hebdomadaire', description: 'Sync automatique 1x/semaine' },
];

const EcommercePartnerConnectScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const route = useRoute();
    const { t } = useLanguageSafe();

    // Service_id passé par navigation (obligatoire)
    const serviceId: number = (route.params as any)?.service_id || (route.params as any)?.serviceId || 0;

    // ─── Étape courante ───────────────────────────────────────
    const [step, setStep] = useState<Step>(1);
    const stepAnim = useRef(new Animated.Value(0)).current;

    // ─── Étape 1 : Plateforme ─────────────────────────────────
    const [platforms, setPlatforms] = useState<EcommercePlatform[]>([]);
    const [loadingPlatforms, setLoadingPlatforms] = useState(true);
    const [selectedPlatform, setSelectedPlatform] = useState<EcommercePlatform | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<StoreCategory>('supermarche');

    // ─── Étape 2 : Connexion ──────────────────────────────────
    const [apiUrl, setApiUrl] = useState('');
    const [authType, setAuthType] = useState<AuthType>('api_key');
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [bearerToken, setBearerToken] = useState('');
    const [basicUser, setBasicUser] = useState('');
    const [basicPass, setBasicPass] = useState('');
    const [itemsPath, setItemsPath] = useState('');
    const [storeName, setStoreName] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Champ mapping (affichage avancé)
    const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
    const [showFieldMapping, setShowFieldMapping] = useState(false);

    // ─── Étape 3 : Test ──────────────────────────────────────
    const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
    const [testLoading, setTestLoading] = useState(false);
    const [autoTestDone, setAutoTestDone] = useState(false);

    // ─── Étape 4 : Planification ──────────────────────────────
    const [syncSchedule, setSyncSchedule] = useState<SyncSchedule>('daily');
    const [syncHour, setSyncHour] = useState(3);
    const [overwriteOnSync, setOverwriteOnSync] = useState(true);

    // ─── Création finale ──────────────────────────────────────
    const [creating, setCreating] = useState(false);

    // ─────────────────────────────────────────────────────────
    // CHARGEMENT PLATEFORMES
    // ─────────────────────────────────────────────────────────
    useEffect(() => {
        ecommerceService.listPlatforms()
            .then(({ platforms }) => setPlatforms(platforms))
            .catch(() => {})
            .finally(() => setLoadingPlatforms(false));
    }, []);

    // Pré-remplir depuis la plateforme sélectionnée
    useEffect(() => {
        if (!selectedPlatform) return;
        setAuthType(selectedPlatform.auth_type as AuthType);
        if (selectedPlatform.default_items_path) {
            setItemsPath(selectedPlatform.default_items_path);
        }
        // Pré-remplir le mapping par défaut
        if (selectedPlatform.default_field_mapping) {
            setFieldMapping(selectedPlatform.default_field_mapping);
        }
        // Pré-remplir l'URL si endpoint connu
        if (selectedPlatform.default_products_endpoint && !apiUrl) {
            // On laisse l'utilisateur entrer la base URL
        }
    }, [selectedPlatform]);

    // ─────────────────────────────────────────────────────────
    // NAVIGATION ENTRE ÉTAPES
    // ─────────────────────────────────────────────────────────
    const goToStep = useCallback((next: Step) => {
        Animated.spring(stepAnim, {
            toValue: next - 1,
            useNativeDriver: true,
            tension: 200,
            friction: 25,
        }).start();
        setStep(next);
    }, [stepAnim]);

    const canProceedStep1 = !!selectedPlatform;
    const canProceedStep2 = apiUrl.trim().length > 5 && storeName.trim().length > 0;
    const canProceedStep3 = testResult?.success === true;

    // ─────────────────────────────────────────────────────────
    // TEST DE CONNEXION
    // ─────────────────────────────────────────────────────────
    const runTest = useCallback(async () => {
        if (!selectedPlatform || !apiUrl.trim()) return;
        setTestLoading(true);
        setTestResult(null);
        try {
            const result = await ecommerceService.testConnection({
                platform_slug: selectedPlatform.slug,
                api_url: apiUrl.trim(),
                auth_type: authType,
                api_key: apiKey || undefined,
                api_secret: apiSecret || undefined,
                bearer_token: bearerToken || undefined,
                basic_auth_user: basicUser || undefined,
                basic_auth_pass: basicPass || undefined,
                items_path: itemsPath || undefined,
            });
            setTestResult(result);
            setAutoTestDone(true);
        } catch {
            setTestResult({ success: false, reachable: false, error: 'Erreur réseau' });
        } finally {
            setTestLoading(false);
        }
    }, [selectedPlatform, apiUrl, authType, apiKey, apiSecret, bearerToken, basicUser, basicPass, itemsPath]);

    // Auto-test quand on arrive à l'étape 3
    useEffect(() => {
        if (step === 3 && !autoTestDone) {
            runTest();
        }
    }, [step]);

    // ─────────────────────────────────────────────────────────
    // CRÉATION DE L'INTÉGRATION
    // ─────────────────────────────────────────────────────────
    const handleCreate = useCallback(async () => {
        if (!selectedPlatform || !serviceId) {
            Alert.alert('Erreur', 'Service non configuré. Veuillez réessayer depuis votre tableau de bord.');
            return;
        }
        setCreating(true);
        try {
            const payload: CreateIntegrationPayload = {
                service_id: serviceId,
                platform_slug: selectedPlatform.slug,
                api_url: apiUrl.trim(),
                auth_type: authType,
                api_key: apiKey || undefined,
                api_secret: apiSecret || undefined,
                bearer_token: bearerToken || undefined,
                basic_auth_user: basicUser || undefined,
                basic_auth_pass: basicPass || undefined,
                items_path: itemsPath || undefined,
                field_mapping: Object.keys(fieldMapping).length > 0 ? fieldMapping : undefined,
                sync_schedule: syncSchedule,
                sync_hour: syncHour,
                store_name: storeName,
                overwrite_on_sync: overwriteOnSync,
            };

            const result = await ecommerceService.createIntegration(payload);

            // Lancer une première sync immédiate
            Alert.alert(
                '🎉 Boutique connectée !',
                `Votre boutique "${storeName}" est maintenant intégrée à Yukpo.\n\nVoulez-vous importer vos produits maintenant ?`,
                [
                    {
                        text: 'Plus tard',
                        style: 'cancel',
                        onPress: () => navigation.goBack(),
                    },
                    {
                        text: 'Importer maintenant',
                        onPress: async () => {
                            try {
                                await ecommerceService.syncIntegration(result.integration_id, { max_products: 2000 });
                                Alert.alert('✅ Import lancé', 'Vos produits sont en cours d\'importation dans Yukpo.', [
                                    { text: 'OK', onPress: () => navigation.goBack() }
                                ]);
                            } catch {
                                navigation.goBack();
                            }
                        },
                    },
                ]
            );
        } catch (err: any) {
            Alert.alert('Erreur', err?.response?.data?.message || err?.message || 'Impossible de créer l\'intégration');
        } finally {
            setCreating(false);
        }
    }, [selectedPlatform, serviceId, apiUrl, authType, apiKey, apiSecret, bearerToken, basicUser, basicPass, itemsPath, fieldMapping, syncSchedule, syncHour, storeName, overwriteOnSync, navigation]);

    // ─────────────────────────────────────────────────────────
    // RENDER ÉTAPE 1 : SÉLECTION PLATEFORME
    // ─────────────────────────────────────────────────────────
    const renderStep1 = () => {
        const filteredPlatforms = platforms.filter(
            p => p.store_category === selectedCategory || p.store_category === 'autre' || p.slug === 'csv_import' || p.slug === 'generic_rest'
        );
        return (
            <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.stepTitle}>Quel type de boutique ?</Text>
                <Text style={styles.stepSubtitle}>Sélectionnez la catégorie puis la plateforme de votre boutique</Text>

                {/* Filtre catégorie */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScrollBar}>
                    {ALL_STORE_CATEGORIES.map(cat => (
                        <TouchableOpacity
                            key={cat}
                            style={[styles.catChip, selectedCategory === cat && styles.catChipActive]}
                            onPress={() => { setSelectedCategory(cat); setSelectedPlatform(null); }}
                        >
                            <Text style={[styles.catChipText, selectedCategory === cat && styles.catChipTextActive]}>
                                {STORE_CATEGORY_ICONS[cat]} {STORE_CATEGORY_LABELS[cat]}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {loadingPlatforms ? (
                    <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#6366F1" />
                ) : (
                    <View style={styles.platformGrid}>
                        {filteredPlatforms.map(platform => {
                            const isSelected = selectedPlatform?.slug === platform.slug;
                            return (
                                <TouchableOpacity
                                    key={platform.slug}
                                    style={[styles.platformCard, isSelected && styles.platformCardSelected]}
                                    onPress={() => setSelectedPlatform(platform)}
                                    activeOpacity={0.85}
                                >
                                    <View style={[styles.platformIconBg, isSelected && { backgroundColor: '#EEF2FF' }]}>
                                        <Text style={styles.platformEmoji}>
                                            {getPlatformEmoji(platform.slug)}
                                        </Text>
                                    </View>
                                    <Text style={[styles.platformName, isSelected && { color: '#4F46E5' }]} numberOfLines={2}>
                                        {platform.name}
                                    </Text>
                                    {platform.supports_webhook && (
                                        <View style={styles.webhookBadge}>
                                            <Text style={styles.webhookBadgeText}>Webhook</Text>
                                        </View>
                                    )}
                                    {isSelected && (
                                        <View style={styles.platformSelectedIcon}>
                                            <SafeIcon name="check-circle" size={18} color="#4F46E5" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </ScrollView>
        );
    };

    // ─────────────────────────────────────────────────────────
    // RENDER ÉTAPE 2 : CONFIGURATION CONNEXION
    // ─────────────────────────────────────────────────────────
    const renderStep2 = () => (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.stepTitle}>Configurer la connexion</Text>
                <Text style={styles.stepSubtitle}>
                    Plateforme : <Text style={{ fontWeight: '700', color: '#4F46E5' }}>{selectedPlatform?.name}</Text>
                </Text>

                {/* Nom de la boutique */}
                <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Nom de votre boutique *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ex: Supermarché Central Yaoundé"
                        placeholderTextColor="#9CA3AF"
                        value={storeName}
                        onChangeText={setStoreName}
                    />
                </View>

                {/* URL API */}
                <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                        URL de votre API *
                        {selectedPlatform?.default_products_endpoint && (
                            <Text style={styles.fieldHint}> (ex: https://votre-site.com{selectedPlatform.default_products_endpoint})</Text>
                        )}
                    </Text>
                    <TextInput
                        style={styles.input}
                        placeholder="https://votre-boutique.com/api/products"
                        placeholderTextColor="#9CA3AF"
                        value={apiUrl}
                        onChangeText={setApiUrl}
                        autoCapitalize="none"
                        keyboardType="url"
                    />
                </View>

                {/* Type d'authentification */}
                <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Type d'authentification</Text>
                    <View style={styles.authTypeRow}>
                        {(['api_key', 'bearer_token', 'basic_auth', 'none'] as AuthType[]).map(type => (
                            <TouchableOpacity
                                key={type}
                                style={[styles.authTypeChip, authType === type && styles.authTypeChipActive]}
                                onPress={() => setAuthType(type)}
                            >
                                <Text style={[styles.authTypeText, authType === type && styles.authTypeTextActive]}>
                                    {type === 'api_key' ? 'Clé API' : type === 'bearer_token' ? 'Token' : type === 'basic_auth' ? 'Basic' : 'Aucune'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Champs selon auth type */}
                {authType === 'api_key' && (
                    <>
                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>Clé API (Consumer Key)</Text>
                            <TextInput style={styles.input} placeholder="ck_xxxxxxxxxxxxx" placeholderTextColor="#9CA3AF" value={apiKey} onChangeText={setApiKey} autoCapitalize="none" secureTextEntry />
                        </View>
                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>Secret API (Consumer Secret)</Text>
                            <TextInput style={styles.input} placeholder="cs_xxxxxxxxxxxxx" placeholderTextColor="#9CA3AF" value={apiSecret} onChangeText={setApiSecret} autoCapitalize="none" secureTextEntry />
                        </View>
                    </>
                )}
                {authType === 'bearer_token' && (
                    <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Bearer Token</Text>
                        <TextInput style={styles.input} placeholder="eyJhbGciOi..." placeholderTextColor="#9CA3AF" value={bearerToken} onChangeText={setBearerToken} autoCapitalize="none" secureTextEntry />
                    </View>
                )}
                {authType === 'basic_auth' && (
                    <>
                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>Nom d'utilisateur</Text>
                            <TextInput style={styles.input} placeholder="admin" placeholderTextColor="#9CA3AF" value={basicUser} onChangeText={setBasicUser} autoCapitalize="none" />
                        </View>
                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>Mot de passe</Text>
                            <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor="#9CA3AF" value={basicPass} onChangeText={setBasicPass} secureTextEntry />
                        </View>
                    </>
                )}

                {/* Options avancées */}
                <TouchableOpacity style={styles.advancedToggle} onPress={() => setShowAdvanced(!showAdvanced)}>
                    <SafeIcon name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={16} color="#6366F1" />
                    <Text style={styles.advancedToggleText}>Options avancées</Text>
                </TouchableOpacity>

                {showAdvanced && (
                    <>
                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>Chemin vers la liste de produits</Text>
                            <Text style={styles.fieldHint}>Chemin JSON vers le tableau de produits (ex: "data", "products", "items")</Text>
                            <TextInput
                                style={styles.input}
                                placeholder={selectedPlatform?.default_items_path || 'items'}
                                placeholderTextColor="#9CA3AF"
                                value={itemsPath}
                                onChangeText={setItemsPath}
                                autoCapitalize="none"
                            />
                        </View>

                        {/* Mapping de champs */}
                        <TouchableOpacity style={styles.advancedToggle} onPress={() => setShowFieldMapping(!showFieldMapping)}>
                            <SafeIcon name={showFieldMapping ? 'chevron-up' : 'chevron-down'} size={16} color="#6366F1" />
                            <Text style={styles.advancedToggleText}>Mapper les champs produit</Text>
                        </TouchableOpacity>

                        {showFieldMapping && (
                            <View style={styles.fieldMappingContainer}>
                                <Text style={styles.fieldMappingHint}>
                                    Indiquez le nom du champ dans votre API pour chaque champ Yukpo
                                </Text>
                                {[
                                    { yukpo: 'nom', label: 'Nom du produit', placeholder: selectedPlatform?.default_field_mapping?.nom || 'name' },
                                    { yukpo: 'prix', label: 'Prix', placeholder: selectedPlatform?.default_field_mapping?.prix || 'price' },
                                    { yukpo: 'stock', label: 'Stock / Quantité', placeholder: selectedPlatform?.default_field_mapping?.stock || 'stock_quantity' },
                                    { yukpo: 'categorie', label: 'Catégorie', placeholder: selectedPlatform?.default_field_mapping?.categorie || 'category' },
                                    { yukpo: 'image_url', label: 'Image URL', placeholder: selectedPlatform?.default_field_mapping?.image_url || 'images[0].src' },
                                    { yukpo: 'code_barre', label: 'Code-barres / SKU', placeholder: selectedPlatform?.default_field_mapping?.code_barre || 'sku' },
                                    { yukpo: 'description', label: 'Description', placeholder: selectedPlatform?.default_field_mapping?.description || 'description' },
                                ].map(({ yukpo, label, placeholder }) => (
                                    <View key={yukpo} style={styles.mappingRow}>
                                        <View style={styles.mappingYukpoField}>
                                            <Text style={styles.mappingYukpoLabel}>Yukpo: {label}</Text>
                                        </View>
                                        <SafeIcon name="arrow-right" size={14} color="#9CA3AF" />
                                        <TextInput
                                            style={styles.mappingInput}
                                            placeholder={placeholder}
                                            placeholderTextColor="#9CA3AF"
                                            value={fieldMapping[yukpo] || ''}
                                            onChangeText={val => setFieldMapping(prev => ({ ...prev, [yukpo]: val }))}
                                            autoCapitalize="none"
                                        />
                                    </View>
                                ))}
                            </View>
                        )}
                    </>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );

    // ─────────────────────────────────────────────────────────
    // RENDER ÉTAPE 3 : TEST DE CONNEXION
    // ─────────────────────────────────────────────────────────
    const renderStep3 = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}>
            <Text style={styles.stepTitle}>Test de connexion</Text>
            <Text style={styles.stepSubtitle}>Vérification que Yukpo peut accéder à votre catalogue</Text>

            {/* Résumé de la config */}
            <View style={styles.configSummary}>
                <View style={styles.configRow}>
                    <SafeIcon name="globe" size={16} color="#6366F1" />
                    <Text style={styles.configLabel}>Plateforme</Text>
                    <Text style={styles.configValue}>{selectedPlatform?.name}</Text>
                </View>
                <View style={styles.configRow}>
                    <SafeIcon name="link" size={16} color="#6366F1" />
                    <Text style={styles.configLabel}>URL</Text>
                    <Text style={styles.configValue} numberOfLines={1}>{apiUrl}</Text>
                </View>
                <View style={styles.configRow}>
                    <SafeIcon name="lock" size={16} color="#6366F1" />
                    <Text style={styles.configLabel}>Auth</Text>
                    <Text style={styles.configValue}>{authType}</Text>
                </View>
            </View>

            {/* Résultat du test */}
            {testLoading ? (
                <View style={styles.testLoading}>
                    <ActivityIndicator size="large" color="#6366F1" />
                    <Text style={styles.testLoadingText}>Test de connexion en cours...</Text>
                </View>
            ) : testResult ? (
                <View style={[styles.testResultCard, testResult.success ? styles.testResultSuccess : styles.testResultError]}>
                    <SafeIcon
                        name={testResult.success ? 'check-circle' : 'alert-circle'}
                        size={36}
                        color={testResult.success ? '#10B981' : '#EF4444'}
                    />
                    <Text style={[styles.testResultTitle, testResult.success ? { color: '#10B981' } : { color: '#EF4444' }]}>
                        {testResult.success ? '✅ Connexion réussie !' : '❌ Connexion échouée'}
                    </Text>
                    {testResult.message && (
                        <Text style={styles.testResultMessage}>{testResult.message}</Text>
                    )}
                    {testResult.products_found !== undefined && (
                        <Text style={styles.testResultDetail}>
                            {testResult.products_found} produit(s) détecté(s)
                        </Text>
                    )}
                    {testResult.error && (
                        <Text style={styles.testResultError2}>{testResult.error}</Text>
                    )}
                    {testResult.sample_fields && testResult.sample_fields.length > 0 && (
                        <View style={styles.sampleFields}>
                            <Text style={styles.sampleFieldsTitle}>Champs disponibles :</Text>
                            <Text style={styles.sampleFieldsText}>{testResult.sample_fields.join(', ')}</Text>
                        </View>
                    )}
                </View>
            ) : null}

            {/* Bouton re-tester */}
            <TouchableOpacity
                style={[styles.retestBtn, testLoading && { opacity: 0.6 }]}
                onPress={runTest}
                disabled={testLoading}
            >
                <SafeIcon name="refresh-cw" size={16} color="#6366F1" />
                <Text style={styles.retestBtnText}>Re-tester la connexion</Text>
            </TouchableOpacity>
        </ScrollView>
    );

    // ─────────────────────────────────────────────────────────
    // RENDER ÉTAPE 4 : PLANIFICATION
    // ─────────────────────────────────────────────────────────
    const renderStep4 = () => (
        <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.stepTitle}>Planifier la synchronisation</Text>
            <Text style={styles.stepSubtitle}>À quelle fréquence mettre à jour le catalogue dans Yukpo ?</Text>

            {SYNC_SCHEDULE_OPTIONS.map(opt => (
                <TouchableOpacity
                    key={opt.value}
                    style={[styles.scheduleCard, syncSchedule === opt.value && styles.scheduleCardActive]}
                    onPress={() => setSyncSchedule(opt.value)}
                >
                    <View style={styles.scheduleInfo}>
                        <Text style={[styles.scheduleLabel, syncSchedule === opt.value && { color: '#4F46E5' }]}>
                            {opt.label}
                        </Text>
                        <Text style={styles.scheduleDesc}>{opt.description}</Text>
                    </View>
                    {syncSchedule === opt.value && (
                        <SafeIcon name="check-circle" size={22} color="#4F46E5" />
                    )}
                </TouchableOpacity>
            ))}

            {(syncSchedule === 'daily' || syncSchedule === 'weekly') && (
                <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Heure de synchronisation</Text>
                    <View style={styles.hourSelector}>
                        {[0, 1, 2, 3, 4, 5, 6].map(h => (
                            <TouchableOpacity
                                key={h}
                                style={[styles.hourChip, syncHour === h && styles.hourChipActive]}
                                onPress={() => setSyncHour(h)}
                            >
                                <Text style={[styles.hourChipText, syncHour === h && { color: '#FFFFFF' }]}>
                                    {h}h
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={styles.fieldHint}>Recommandé : 2h-4h du matin (trafic faible)</Text>
                </View>
            )}

            <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.switchLabel}>Écraser les produits existants</Text>
                    <Text style={styles.switchDesc}>Met à jour prix et stock si le produit existe déjà</Text>
                </View>
                <Switch
                    value={overwriteOnSync}
                    onValueChange={setOverwriteOnSync}
                    trackColor={{ false: '#E5E7EB', true: '#A5B4FC' }}
                    thumbColor={overwriteOnSync ? '#4F46E5' : '#9CA3AF'}
                />
            </View>

            {/* Résumé final */}
            <View style={styles.finalSummary}>
                <Text style={styles.finalSummaryTitle}>📋 Résumé de l'intégration</Text>
                {[
                    { icon: 'shopping-bag', label: 'Boutique', value: storeName },
                    { icon: 'globe', label: 'Plateforme', value: selectedPlatform?.name || '' },
                    { icon: 'link', label: 'URL', value: apiUrl },
                    { icon: 'clock', label: 'Sync', value: SYNC_SCHEDULE_OPTIONS.find(s => s.value === syncSchedule)?.label || syncSchedule },
                ].map(({ icon, label, value }) => (
                    <View key={label} style={styles.summaryRow}>
                        <SafeIcon name={icon} size={14} color="#6366F1" />
                        <Text style={styles.summaryLabel}>{label} :</Text>
                        <Text style={styles.summaryValue} numberOfLines={1}>{value}</Text>
                    </View>
                ))}
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );

    // ─────────────────────────────────────────────────────────
    // RENDER PRINCIPAL
    // ─────────────────────────────────────────────────────────
    const canProceed = [canProceedStep1, canProceedStep2, canProceedStep3, true][step - 1];
    const isLastStep = step === 4;

    return (
        <SafeNativeView style={styles.container}>
            {/* Header */}
            <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.header}>
                <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()}>
                    <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Connecter une boutique</Text>
                    <Text style={styles.headerSubtitle}>Étape {step} sur 4 — {STEP_LABELS[step]}</Text>
                </View>
            </LinearGradient>

            {/* Barre de progression */}
            <View style={styles.progressBar}>
                {([1, 2, 3, 4] as Step[]).map(s => (
                    <View key={s} style={styles.progressStepContainer}>
                        <View style={[
                            styles.progressDot,
                            s < step && styles.progressDotDone,
                            s === step && styles.progressDotActive,
                        ]}>
                            {s < step ? (
                                <SafeIcon name="check" size={12} color="#FFFFFF" />
                            ) : (
                                <Text style={[styles.progressDotText, s === step && { color: '#FFFFFF' }]}>{s}</Text>
                            )}
                        </View>
                        <Text style={[styles.progressLabel, s === step && styles.progressLabelActive]}>
                            {STEP_LABELS[s]}
                        </Text>
                        {s < 4 && <View style={[styles.progressLine, s < step && styles.progressLineDone]} />}
                    </View>
                ))}
            </View>

            {/* Contenu de l'étape */}
            <View style={styles.stepContent}>
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
            </View>

            {/* Boutons navigation */}
            <View style={styles.footer}>
                {step > 1 && (
                    <TouchableOpacity style={styles.backBtn} onPress={() => goToStep((step - 1) as Step)}>
                        <SafeIcon name="arrow-left" size={18} color="#4F46E5" />
                        <Text style={styles.backBtnText}>Retour</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={[
                        styles.nextBtn,
                        !canProceed && styles.nextBtnDisabled,
                        creating && styles.nextBtnDisabled,
                    ]}
                    onPress={() => {
                        if (!canProceed) return;
                        if (isLastStep) {
                            handleCreate();
                        } else {
                            goToStep((step + 1) as Step);
                        }
                    }}
                    disabled={!canProceed || creating}
                >
                    {creating ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                        <>
                            <Text style={styles.nextBtnText}>
                                {isLastStep ? '🚀 Connecter la boutique' : 'Continuer'}
                            </Text>
                            {!isLastStep && <SafeIcon name="arrow-right" size={18} color="#FFFFFF" />}
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </SafeNativeView>
    );
};

// ─────────────────────────────────────────────────────────
// UTILITAIRE : emoji par plateforme
// ─────────────────────────────────────────────────────────
function getPlatformEmoji(slug: string): string {
    const map: Record<string, string> = {
        woocommerce: '🛒',
        shopify: '🏪',
        prestashop: '🧡',
        magento: '🔶',
        opencart: '🛍️',
        jumia: '🌍',
        cdiscount: '🔵',
        supermarche_custom: '🥦',
        mode_custom: '👗',
        csv_import: '📄',
        generic_rest: '⚙️',
    };
    return map[slug] || '🏬';
}

// ─────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        paddingTop: 50,
        gap: 12,
    },
    headerBack: { padding: 4 },
    headerCenter: { flex: 1 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
    headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    progressBar: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        gap: 0,
    },
    progressStepContainer: { alignItems: 'center', flex: 1, position: 'relative' },
    progressDot: {
        width: 30, height: 30, borderRadius: 15,
        backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center',
    },
    progressDotActive: { backgroundColor: '#4F46E5' },
    progressDotDone: { backgroundColor: '#10B981' },
    progressDotText: { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
    progressLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },
    progressLabelActive: { color: '#4F46E5', fontWeight: '700' },
    progressLine: {
        position: 'absolute',
        top: 15, right: -'50%' as any,
        width: '100%',
        height: 2,
        backgroundColor: '#E5E7EB',
        zIndex: -1,
    },
    progressLineDone: { backgroundColor: '#10B981' },
    stepContent: { flex: 1, padding: 16 },
    stepTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 6 },
    stepSubtitle: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 20 },
    // Step 1
    categoryScrollBar: { marginBottom: 16 },
    catChip: {
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 20, backgroundColor: '#F3F4F6',
        marginRight: 8,
    },
    catChipActive: { backgroundColor: '#4F46E5' },
    catChipText: { fontSize: 13, fontWeight: '500', color: '#374151' },
    catChipTextActive: { color: '#FFFFFF', fontWeight: '700' },
    platformGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    platformCard: {
        width: '47%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        alignItems: 'center',
        gap: 8,
        borderWidth: 2,
        borderColor: 'transparent',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
        position: 'relative',
    },
    platformCardSelected: { borderColor: '#4F46E5', backgroundColor: '#F5F3FF' },
    platformIconBg: {
        width: 56, height: 56, borderRadius: 16,
        backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center',
    },
    platformEmoji: { fontSize: 28 },
    platformName: { fontSize: 13, fontWeight: '600', color: '#111827', textAlign: 'center' },
    webhookBadge: {
        backgroundColor: '#DBEAFE', borderRadius: 6,
        paddingHorizontal: 6, paddingVertical: 2,
    },
    webhookBadgeText: { fontSize: 10, color: '#1D4ED8', fontWeight: '600' },
    platformSelectedIcon: { position: 'absolute', top: 8, right: 8 },
    // Step 2
    fieldGroup: { marginBottom: 16 },
    fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
    fieldHint: { fontSize: 12, color: '#9CA3AF', marginBottom: 4, fontStyle: 'italic', fontWeight: '400' },
    input: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1, borderColor: '#E5E7EB',
        borderRadius: 12, padding: 12,
        fontSize: 14, color: '#111827',
    },
    authTypeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    authTypeChip: {
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 10, backgroundColor: '#F3F4F6',
        borderWidth: 1, borderColor: 'transparent',
    },
    authTypeChipActive: { backgroundColor: '#EEF2FF', borderColor: '#4F46E5' },
    authTypeText: { fontSize: 13, color: '#374151', fontWeight: '500' },
    authTypeTextActive: { color: '#4F46E5', fontWeight: '700' },
    advancedToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, marginBottom: 8 },
    advancedToggleText: { fontSize: 14, color: '#4F46E5', fontWeight: '600' },
    fieldMappingContainer: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, gap: 8, marginBottom: 12 },
    fieldMappingHint: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
    mappingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    mappingYukpoField: { width: 120 },
    mappingYukpoLabel: { fontSize: 12, color: '#374151', fontWeight: '500' },
    mappingInput: {
        flex: 1, backgroundColor: '#FFFFFF',
        borderWidth: 1, borderColor: '#E5E7EB',
        borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
        fontSize: 13, color: '#111827',
    },
    // Step 3
    configSummary: {
        backgroundColor: '#FFFFFF', borderRadius: 14,
        padding: 14, marginBottom: 20, gap: 10,
        borderWidth: 1, borderColor: '#E5E7EB',
    },
    configRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    configLabel: { fontSize: 13, color: '#6B7280', width: 70 },
    configValue: { flex: 1, fontSize: 13, color: '#111827', fontWeight: '600' },
    testLoading: { alignItems: 'center', paddingVertical: 40, gap: 14 },
    testLoadingText: { fontSize: 15, color: '#6B7280' },
    testResultCard: {
        borderRadius: 16, padding: 20, alignItems: 'center', gap: 10,
        borderWidth: 2, marginBottom: 16,
    },
    testResultSuccess: { backgroundColor: '#F0FDF4', borderColor: '#10B981' },
    testResultError: { backgroundColor: '#FEF2F2', borderColor: '#EF4444' },
    testResultTitle: { fontSize: 18, fontWeight: '700' },
    testResultMessage: { fontSize: 14, color: '#374151', textAlign: 'center', lineHeight: 20 },
    testResultDetail: { fontSize: 16, fontWeight: '600', color: '#10B981' },
    testResultError2: { fontSize: 13, color: '#EF4444', textAlign: 'center' },
    sampleFields: { width: '100%', backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10 },
    sampleFieldsTitle: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 4 },
    sampleFieldsText: { fontSize: 12, color: '#6B7280', lineHeight: 18 },
    retestBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 12,
        borderWidth: 1, borderColor: '#4F46E5', borderRadius: 12,
    },
    retestBtnText: { fontSize: 14, color: '#4F46E5', fontWeight: '600' },
    // Step 4
    scheduleCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FFFFFF', borderRadius: 14,
        padding: 14, marginBottom: 10, gap: 12,
        borderWidth: 2, borderColor: 'transparent',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
    },
    scheduleCardActive: { borderColor: '#4F46E5', backgroundColor: '#F5F3FF' },
    scheduleInfo: { flex: 1 },
    scheduleLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
    scheduleDesc: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    hourSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    hourChip: {
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 10, backgroundColor: '#F3F4F6',
    },
    hourChipActive: { backgroundColor: '#4F46E5' },
    hourChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
    switchRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FFFFFF', borderRadius: 14,
        padding: 14, marginTop: 8, gap: 12,
        borderWidth: 1, borderColor: '#E5E7EB',
    },
    switchLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
    switchDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    finalSummary: {
        backgroundColor: '#EEF2FF', borderRadius: 14,
        padding: 14, marginTop: 16, gap: 8,
    },
    finalSummaryTitle: { fontSize: 15, fontWeight: '700', color: '#3730A3', marginBottom: 4 },
    summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    summaryLabel: { fontSize: 13, color: '#6B7280', width: 70 },
    summaryValue: { flex: 1, fontSize: 13, color: '#111827', fontWeight: '600' },
    // Footer
    footer: {
        flexDirection: 'row', gap: 10,
        padding: 16, paddingBottom: 32,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1, borderTopColor: '#F3F4F6',
    },
    backBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingVertical: 14, paddingHorizontal: 16,
        borderRadius: 12, borderWidth: 1, borderColor: '#4F46E5',
    },
    backBtnText: { fontSize: 15, color: '#4F46E5', fontWeight: '600' },
    nextBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, backgroundColor: '#4F46E5',
        paddingVertical: 14, borderRadius: 12,
    },
    nextBtnDisabled: { backgroundColor: '#C4B5FD', opacity: 0.7 },
    nextBtnText: { fontSize: 15, color: '#FFFFFF', fontWeight: '700' },
});

export default EcommercePartnerConnectScreen;
