/**
 * P2 - Scan code-barres médicament
 * Utilise expo-barcode-scanner pour scanner un médicament et afficher disponibilité/prix
 */

import { useNavigation } from '@react-navigation/native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { pharmacyProductService, NearbyMedicineItem } from '../../services/pharmacyProductService';
import { modernColors } from '../../theme/modernTheme';

type ScanMode = 'scanner' | 'manual' | 'results';

const MedicamentScanScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();

    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [scanned, setScanned] = useState(false);
    const [mode, setMode] = useState<ScanMode>('scanner');
    const [loading, setLoading] = useState(false);
    const [manualInput, setManualInput] = useState('');
    const [results, setResults] = useState<NearbyMedicineItem[]>([]);
    const [searchedName, setSearchedName] = useState('');
    const [history, setHistory] = useState<string[]>([]);

    useEffect(() => {
        (async () => {
            const { status } = await BarCodeScanner.requestPermissionsAsync();
            setHasPermission(status === 'granted');
            if (status !== 'granted') {
                setMode('manual');
            }
        })();
    }, []);

    const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
        setScanned(true);
        await searchByCode(data);
    };

    const searchByCode = async (code: string) => {
        setLoading(true);
        setMode('results');
        try {
            const response = await pharmacyProductService.searchByBarcode(code);
            if (response.success && response.items) {
                setResults(response.items);
                setSearchedName(response.medicamentName || code);
            } else {
                setResults([]);
                setSearchedName(code);
                Alert.alert('Non trouvé', 'Aucun médicament trouvé pour ce code.');
            }
        } catch (error: any) {
            Alert.alert('Erreur', error.message || 'Erreur lors de la recherche.');
        } finally {
            setLoading(false);
        }
    };

    const searchByName = async (name: string) => {
        if (!name.trim()) return;
        Keyboard.dismiss();
        setLoading(true);
        setMode('results');
        try {
            const response = await pharmacyProductService.searchMedicamentByName(name.trim());
            if (response.success && response.items) {
                setResults(response.items);
                setSearchedName(name.trim());
            } else {
                setResults([]);
                setSearchedName(name.trim());
            }
        } catch (error: any) {
            Alert.alert('Erreur', error.message || 'Erreur lors de la recherche.');
        } finally {
            setLoading(false);
        }
    };

    const addToHistory = (name: string) => {
        setHistory(prev => [name, ...prev.filter(h => h !== name)].slice(0, 10));
        Alert.alert('Ajouté', `"${name}" ajouté à votre historique de médicaments.`);
    };

    if (mode === 'scanner') {
        if (hasPermission === null) {
            return (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.permText}>Vérification des permissions...</Text>
                </View>
            );
        }

        return (
            <View style={styles.container}>
                <View style={styles.scannerHeader}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <SafeIcon name="arrow-left" size={20} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.scannerTitle}>Scanner un médicament</Text>
                </View>

                <BarCodeScanner
                    onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
                    style={styles.scanner}
                />

                <View style={styles.scanOverlay}>
                    <View style={styles.scanFrame} />
                    <Text style={styles.scanHint}>Placez le code-barres dans le cadre</Text>
                </View>

                <View style={styles.scanFooter}>
                    {scanned && (
                        <TouchableOpacity
                            style={styles.rescanBtn}
                            onPress={() => setScanned(false)}
                        >
                            <Text style={styles.rescanText}>Scanner à nouveau</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={styles.manualBtn}
                        onPress={() => setMode('manual')}
                    >
                        <SafeIcon name="edit-3" size={16} color={modernColors.primary} />
                        <Text style={styles.manualBtnText}>Saisir manuellement</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (mode === 'manual') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backBtn2}
                        onPress={() => hasPermission ? setMode('scanner') : navigation.goBack()}
                    >
                        <SafeIcon name="arrow-left" size={20} color={modernColors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Rechercher un médicament</Text>
                </View>

                <View style={styles.searchBox}>
                    <SafeIcon name="search" size={20} color="#9CA3AF" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Nom du médicament ou code EAN..."
                        placeholderTextColor="#9CA3AF"
                        value={manualInput}
                        onChangeText={setManualInput}
                        onSubmitEditing={() => searchByName(manualInput)}
                        returnKeyType="search"
                        autoFocus
                    />
                    {manualInput.length > 0 && (
                        <TouchableOpacity onPress={() => setManualInput('')}>
                            <SafeIcon name="x" size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                </View>

                <TouchableOpacity
                    style={[styles.searchBtn, !manualInput.trim() && styles.searchBtnDisabled]}
                    onPress={() => searchByName(manualInput)}
                    disabled={!manualInput.trim()}
                >
                    <Text style={styles.searchBtnText}>Rechercher</Text>
                </TouchableOpacity>

                {hasPermission && (
                    <TouchableOpacity
                        style={styles.scannerToggleBtn}
                        onPress={() => setMode('scanner')}
                    >
                        <SafeIcon name="camera" size={16} color={modernColors.primary} />
                        <Text style={styles.scannerToggleText}>Scanner avec la caméra</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    }

    // Mode results
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backBtn2}
                    onPress={() => setMode(hasPermission ? 'scanner' : 'manual')}
                >
                    <SafeIcon name="arrow-left" size={20} color={modernColors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {searchedName}
                </Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.permText}>Recherche en cours...</Text>
                </View>
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={(item) => `${item.id}`}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <SafeIcon name="package" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyText}>Aucune pharmacie trouvée pour ce médicament</Text>
                        </View>
                    }
                    ListHeaderComponent={
                        results.length > 0 ? (
                            <View style={styles.resultHeader}>
                                <Text style={styles.resultCount}>{results.length} pharmacie(s) trouvée(s)</Text>
                                <TouchableOpacity onPress={() => addToHistory(searchedName)}>
                                    <Text style={styles.addHistoryText}>+ Ajouter à l'historique</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null
                    }
                    renderItem={({ item }) => (
                        <View style={[
                            styles.resultCard,
                            item.stock === 0 && styles.resultCardUnavailable,
                        ]}>
                            <View style={styles.resultCardTop}>
                                <View style={styles.resultInfo}>
                                    <Text style={styles.resultPharmacy}>{item.pharmacy_name || item.pharmacy_nom}</Text>
                                    {(item.pharmacy_quartier || item.pharmacy_ville) && (
                                        <Text style={styles.resultAddress}>
                                            {[item.pharmacy_quartier, item.pharmacy_ville].filter(Boolean).join(', ')}
                                        </Text>
                                    )}
                                </View>
                                <View style={styles.resultRight}>
                                    {item.prix != null && (
                                        <Text style={styles.resultPrice}>
                                            {item.prix.toLocaleString()} FCFA
                                        </Text>
                                    )}
                                    <View style={[
                                        styles.stockBadge,
                                        item.stock > 0 ? styles.stockAvail : styles.stockOut,
                                    ]}>
                                        <Text style={styles.stockBadgeText}>
                                            {item.stock > 0 ? 'En stock' : 'Rupture'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                            {item.distance_km != null && (
                                <View style={styles.distanceRow}>
                                    <SafeIcon name="navigation" size={12} color="#6B7280" />
                                    <Text style={styles.distanceText}>{item.distance_km.toFixed(1)} km</Text>
                                </View>
                            )}
                        </View>
                    )}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    permText: { fontSize: 14, color: '#6B7280' },
    // Scanner styles
    scannerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#000',
        paddingTop: 48,
        paddingBottom: 12,
        paddingHorizontal: 16,
        gap: 12,
    },
    scannerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
    scanner: { flex: 1 },
    scanOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none',
    },
    scanFrame: {
        width: 240,
        height: 160,
        borderWidth: 3,
        borderColor: modernColors.primary,
        borderRadius: 12,
        backgroundColor: 'transparent',
        marginTop: 80,
    },
    scanHint: {
        color: '#fff',
        fontSize: 14,
        marginTop: 12,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    scanFooter: {
        backgroundColor: '#000',
        padding: 20,
        gap: 12,
        alignItems: 'center',
    },
    rescanBtn: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    rescanText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    manualBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
    },
    manualBtnText: { color: modernColors.primary, fontSize: 14, fontWeight: '600' },
    // Manual / results
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        paddingTop: 24,
        gap: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backBtn: { padding: 4 },
    backBtn2: { padding: 4 },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.textPrimary,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        margin: 16,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
    },
    searchInput: { flex: 1, fontSize: 15, color: modernColors.textPrimary },
    searchBtn: {
        backgroundColor: modernColors.primary,
        marginHorizontal: 16,
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
    },
    searchBtnDisabled: { opacity: 0.5 },
    searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    scannerToggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 16,
        paddingVertical: 10,
    },
    scannerToggleText: { color: modernColors.primary, fontSize: 14, fontWeight: '600' },
    // Results
    list: { padding: 16, gap: 12 },
    resultHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    resultCount: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
    addHistoryText: { fontSize: 13, color: modernColors.primary, fontWeight: '600' },
    resultCard: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
        marginBottom: 10,
    },
    resultCardUnavailable: { opacity: 0.75 },
    resultCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    resultInfo: { flex: 1 },
    resultPharmacy: { fontSize: 15, fontWeight: '700', color: modernColors.textPrimary, marginBottom: 2 },
    resultAddress: { fontSize: 12, color: '#6B7280' },
    resultRight: { alignItems: 'flex-end', gap: 4 },
    resultPrice: { fontSize: 16, fontWeight: '700', color: modernColors.primary },
    stockBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
    stockAvail: { backgroundColor: '#D1FAE5' },
    stockOut: { backgroundColor: '#FEE2E2' },
    stockBadgeText: { fontSize: 11, fontWeight: '700', color: '#111827' },
    distanceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    distanceText: { fontSize: 12, color: '#6B7280' },
    empty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
    emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
});

export default MedicamentScanScreen;
