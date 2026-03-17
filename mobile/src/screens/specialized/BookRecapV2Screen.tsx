// ✅ V2: Écran Récap par classe - Tableau état/valeur, choix mode troc/vente/don, finalisation

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton } from '../../components/SafeNativeDesign';
import { useToaster } from '../../components/ToasterProvider';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { bourseLivreV2Api, ProgrammeMatchResult } from '../../services/bourseLivreV2Api';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

interface BookEntry {
    id: number;
    titre: string;
    etat_classification: string;
    valeur_calculee: number;
    is_rejected: boolean;
    classe_actuelle?: string;
    classe_souhaitee?: string;
    niveau?: string;
    matiere?: string;
    image_recto_uri: string;
    image_verso_uri: string;
    confidence: number;
}

const MODE_OPTIONS = [
    { key: 'troc', label: 'Troc', icon: 'repeat', color: '#3b82f6', desc: t('bookRecapV2Screen.echangerContreUnAutreLivre') },
    { key: 'vente', label: 'Vente', icon: 'dollar-sign', color: '#22c55e', desc: t('bookRecapV2Screen.vendreAuPrixCalcule') },
    { key: 'don', label: 'Don', icon: 'heart', color: '#ef4444', desc: 'Donner gratuitement' },
];

const ETAT_COLORS: Record<string, string> = {
    bon: '#22c55e',
    acceptable: '#f59e0b',
    rejete: '#ef4444',
};

const ETAT_LABELS: Record<string, string> = {
    bon: t('bookRecapV2Screen.bonEtat'),
    acceptable: 'Acceptable',
    rejete: t('bookRecapV2Screen.rejete'),
};

const BookRecapV2Screen: React.FC = () => {
    const navigation = useNavigation() as any;
    const route = useRoute();
    const toaster = useToaster();
    const { t } = useLanguageSafe();
    const params = route.params as any;

    const sessionId: string = params?.sessionId;
    const initialBooks: BookEntry[] = params?.books || [];
    const totalValue: number = params?.totalValue || 0;
    const gpsCoords: string = params?.gpsCoords || '';
    const gpsAddress: string = params?.gpsAddress || '';

    // Mode par livre (par défaut: troc)
    const [bookModes, setBookModes] = useState<Record<number, string>>(() => {
        const modes: Record<number, string> = {};
        initialBooks.forEach(b => { modes[b.id] = 'troc'; });
        return modes;
    });
    const [finalizing, setFinalizing] = useState(false);
    const [selectedClassFilter, setSelectedClassFilter] = useState<string | null>(null);
    const [programmeMatches, setProgrammeMatches] = useState<Record<number, ProgrammeMatchResult>>({});
    const [matchingInProgress, setMatchingInProgress] = useState(false);

    // Auto-check programme matching for all non-rejected books
    useEffect(() => {
        const checkProgrammes = async () => {
            const validBooks = initialBooks.filter(b => !b.is_rejected);
            if (validBooks.length === 0) return;
            setMatchingInProgress(true);
            const matches: Record<number, ProgrammeMatchResult> = {};
            for (const book of validBooks) {
                try {
                    const res = await bourseLivreV2Api.matchLivreProgramme(book.id);
                    if (res.matching) matches[book.id] = res.matching;
                } catch { /* skip */ }
            }
            setProgrammeMatches(matches);
            setMatchingInProgress(false);
        };
        checkProgrammes();
    }, [initialBooks]);

    // Grouper les livres par classe
    const booksByClass = useMemo(() => {
        const groups: Record<string, BookEntry[]> = {};
        initialBooks.forEach(book => {
            if (book.is_rejected) return; // Skip rejected books
            const classe = book.classe_actuelle || t('bookRecapV2.nonClasse');
            if (!groups[classe]) groups[classe] = [];
            groups[classe].push(book);
        });
        return groups;
    }, [initialBooks]);

    const classes = useMemo(() => Object.keys(booksByClass).sort(), [booksByClass]);
    const rejectedBooks = useMemo(() => initialBooks.filter(b => b.is_rejected), [initialBooks]);

    // Livres filtrés par classe sélectionnée
    const displayedBooks = useMemo(() => {
        if (!selectedClassFilter) return initialBooks.filter(b => !b.is_rejected);
        return booksByClass[selectedClassFilter] || [];
    }, [selectedClassFilter, booksByClass, initialBooks]);

    // Stats par classe
    const classStats = useMemo(() => {
        const stats: Record<string, { count: number; value: number }> = {};
        initialBooks.forEach(book => {
            if (book.is_rejected) return;
            const classe = book.classe_actuelle || t('bookRecapV2.nonClasse');
            if (!stats[classe]) stats[classe] = { count: 0, value: 0 };
            stats[classe].count++;
            stats[classe].value += book.valeur_calculee;
        });
        return stats;
    }, [initialBooks]);

    const handleModeChange = useCallback((bookId: number, mode: string) => {
        hapticPress();
        setBookModes(prev => ({ ...prev, [bookId]: mode }));
    }, []);

    const handleSetAllMode = useCallback((mode: string) => {
        hapticPress();
        const newModes: Record<number, string> = {};
        initialBooks.forEach(b => {
            if (!b.is_rejected) newModes[b.id] = mode;
        });
        setBookModes(newModes);
        toaster.show(t('bookRecapV2Screen.tousLesLivresPassesEnMode', { mode: mode }), 'info');
    }, [initialBooks, toaster]);

    const handleFinalize = useCallback(async () => {
        if (!sessionId) return;

        const validBooks = initialBooks.filter(b => !b.is_rejected);
        if (validBooks.length === 0) {
            Alert.alert('Aucun livre valide', t('bookRecapV2Screen.tousLesLivresOntEteRejetes'));
            return;
        }

        setFinalizing(true);
        try {
            const livresModes = validBooks.map(b => ({
                livre_id: b.id,
                mode_listing: bookModes[b.id] || 'troc',
            }));

            await bourseLivreV2Api.finalizeSession(sessionId, livresModes);

            toaster.show(
                t('bookRecapV2Screen.livreMisEnLigneAvecSucces', { validBooks_length: validBooks.length, validBooks_length > 1 ? 's' : '': validBooks.length > 1 ? 's' : '' }),
                'success'
            );

            navigation.navigate('LivreScolaireSearch');
        } catch (error: any) {
            console.error('[BookRecapV2] Erreur finalisation:', error);
            Alert.alert('Erreur', t('bookRecapV2Screen.impossibleDeFinaliserLaSessionReessayez'));
        } finally {
            setFinalizing(false);
        }
    }, [sessionId, initialBooks, bookModes, navigation, toaster]);

    const renderClassTabs = () => (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classTabs}>
            <TouchableOpacity
                style={[styles.classTab, !selectedClassFilter && styles.classTabActive]}
                onPress={() => { hapticPress(); setSelectedClassFilter(null); }}
            >
                <Text style={[styles.classTabText, !selectedClassFilter && styles.classTabTextActive]}>
                    Tous ({initialBooks.filter(b => !b.is_rejected).length})
                </Text>
            </TouchableOpacity>
            {classes.map(classe => (
                <TouchableOpacity
                    key={classe}
                    style={[styles.classTab, selectedClassFilter === classe && styles.classTabActive]}
                    onPress={() => { hapticPress(); setSelectedClassFilter(classe); }}
                >
                    <Text style={[styles.classTabText, selectedClassFilter === classe && styles.classTabTextActive]}>
                        {classe} ({classStats[classe]?.count || 0})
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );

    const renderBookRow = ({ item }: { item: BookEntry }) => {
        const currentMode = bookModes[item.id] || 'troc';
        const progMatch = programmeMatches[item.id];
        return (
            <View style={styles.bookRow}>
                <View style={styles.bookRowHeader}>
                    <View style={[styles.etatDot, { backgroundColor: ETAT_COLORS[item.etat_classification] }]} />
                    <Text style={styles.bookRowTitle} numberOfLines={1}>{item.titre}</Text>
                    <Text style={styles.bookRowValue}>{Math.round(item.valeur_calculee)} XAF</Text>
                </View>
                <Text style={styles.bookRowMeta}>
                    {item.niveau ? `${item.niveau} — ` : ''}{item.classe_actuelle} • {item.matiere} • {ETAT_LABELS[item.etat_classification]}
                </Text>
                {item.classe_souhaitee ? (
                    <Text style={styles.bookRowClasseVisee}>
                        Classe visée : {item.classe_souhaitee}
                    </Text>
                ) : null}

                {/* Programme match badge */}
                {progMatch ? (
                    <View style={[styles.programmeBadge, progMatch.matched ? styles.programmeBadgeOk : styles.programmeBadgeNo]}>
                        <SafeIcon
                            name={progMatch.matched ? 'book-open' : 'alert-circle'}
                            size={12}
                            color={progMatch.matched ? '#166534' : '#92400e'}
                        />
                        <Text style={progMatch.matched ? styles.programmeBadgeTextOk : styles.programmeBadgeTextNo}>
                            {progMatch.matched
                                ? t('bourseLivreV2.recap.programmeOfficiel', { percent: (progMatch.score_match * 100).toFixed(0) })
                                : t('bourseLivreV2.recap.horsProgramme')}
                        </Text>
                    </View>
                ) : matchingInProgress ? (
                    <View style={styles.programmeBadgeLoading}>
                        <ActivityIndicator size="small" color="#6b7280" />
                        <Text style={styles.programmeBadgeTextLoading}>{t('bourseLivreV2.recap.verificationProgramme')}</Text>
                    </View>
                ) : null}

                {/* Mode selector */}
                <View style={styles.modeSelector}>
                    {MODE_OPTIONS.map(opt => (
                        <TouchableOpacity
                            key={opt.key}
                            style={[
                                styles.modeBtn,
                                currentMode === opt.key && { backgroundColor: opt.color + '20', borderColor: opt.color },
                            ]}
                            onPress={() => handleModeChange(item.id, opt.key)}
                        >
                            <SafeIcon
                                name={opt.icon}
                                size={14}
                                color={currentMode === opt.key ? opt.color : '#9ca3af'}
                            />
                            <Text style={[
                                styles.modeBtnText,
                                currentMode === opt.key && { color: opt.color, fontWeight: '700' },
                            ]}>
                                {opt.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header stats */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{t('bookRecapV2.recapitulatif')}</Text>
                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{initialBooks.filter(b => !b.is_rejected).length}</Text>
                        <Text style={styles.statLabel}>{t('bookRecapV2.livresAcceptes')}</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statValue, { color: modernColors.primary }]}>
                            {Math.round(totalValue)} XAF
                        </Text>
                        <Text style={styles.statLabel}>Valeur totale</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statValue, { color: '#ef4444' }]}>{rejectedBooks.length}</Text>
                        <Text style={styles.statLabel}>{t('bookRecapV2.rejetes')}</Text>
                    </View>
                </View>
            </View>

            {/* GPS info */}
            <View style={styles.gpsInfo}>
                <SafeIcon name="map-pin" size={14} color="#6b7280" />
                <Text style={styles.gpsInfoText}>
                    Récupération: {gpsAddress || gpsCoords?.substring(0, 25)}
                </Text>
            </View>

            {/* Quick mode buttons */}
            <View style={styles.quickModeBar}>
                <Text style={styles.quickModeLabel}>Tout passer en:</Text>
                {MODE_OPTIONS.map(opt => (
                    <TouchableOpacity
                        key={opt.key}
                        style={[styles.quickModeBtn, { borderColor: opt.color }]}
                        onPress={() => handleSetAllMode(opt.key)}
                    >
                        <SafeIcon name={opt.icon} size={12} color={opt.color} />
                        <Text style={[styles.quickModeBtnText, { color: opt.color }]}>{opt.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Class filter tabs */}
            {renderClassTabs()}

            {/* Class value summary table */}
            {!selectedClassFilter && classes.length > 1 && (
                <View style={styles.classTable}>
                    {classes.map(classe => (
                        <View key={classe} style={styles.classTableRow}>
                            <Text style={styles.classTableClass}>{classe}</Text>
                            <Text style={styles.classTableCount}>{classStats[classe]?.count} livres</Text>
                            <Text style={styles.classTableValue}>
                                {Math.round(classStats[classe]?.value || 0)} XAF
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Books list */}
            <FlatList
                data={displayedBooks}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderBookRow}
                style={styles.booksList}
                contentContainerStyle={{ paddingBottom: 100 }}
            />

            {/* Bottom action */}
            <View style={styles.bottomBar}>
                <NativeButton
                    title={finalizing ? 'Finalisation...' : `Mettre en ligne ${initialBooks.filter(b => !b.is_rejected).length} livres`}
                    onPress={handleFinalize}
                    disabled={finalizing}
                    style={[styles.finalizeBtn, { backgroundColor: modernColors.primary }]}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },

    header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
    headerTitle: { fontSize: 22, fontWeight: '700', color: '#1f2937', marginBottom: 12 },
    statsRow: { flexDirection: 'row', gap: 8 },
    statBox: {
        flex: 1, backgroundColor: '#f3f4f6', borderRadius: 10, padding: 12, alignItems: 'center',
    },
    statValue: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
    statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },

    gpsInfo: {
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16,
        paddingVertical: 8, backgroundColor: '#f0f9ff',
    },
    gpsInfoText: { fontSize: 12, color: '#6b7280' },

    quickModeBar: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    },
    quickModeLabel: { fontSize: 12, color: '#6b7280' },
    quickModeBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16,
        borderWidth: 1,
    },
    quickModeBtnText: { fontSize: 12, fontWeight: '600' },

    classTabs: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
    classTab: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
        backgroundColor: '#f3f4f6', marginRight: 8,
    },
    classTabActive: { backgroundColor: modernColors.primary },
    classTabText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
    classTabTextActive: { color: '#fff', fontWeight: '700' },

    classTable: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 10, padding: 12 },
    classTableRow: {
        flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6,
        borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
    },
    classTableClass: { fontSize: 13, fontWeight: '600', color: '#1f2937', flex: 1 },
    classTableCount: { fontSize: 12, color: '#6b7280', width: 70, textAlign: 'center' },
    classTableValue: { fontSize: 13, fontWeight: '700', color: modernColors.primary, width: 80, textAlign: 'right' },

    booksList: { flex: 1, paddingHorizontal: 16, marginTop: 8 },
    bookRow: {
        backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05,
        shadowRadius: 2, elevation: 1,
    },
    bookRowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    etatDot: { width: 8, height: 8, borderRadius: 4 },
    bookRowTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1f2937' },
    bookRowValue: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
    bookRowMeta: { fontSize: 12, color: '#6b7280', marginTop: 4, marginLeft: 16 },
    bookRowClasseVisee: {
        fontSize: 12, color: '#3b82f6', fontWeight: '600', marginTop: 2, marginLeft: 16,
    },

    programmeBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        marginTop: 6, marginLeft: 16, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    },
    programmeBadgeOk: { backgroundColor: '#dcfce7' },
    programmeBadgeNo: { backgroundColor: '#fef3c7' },
    programmeBadgeTextOk: { fontSize: 11, color: '#166534', fontWeight: '600' },
    programmeBadgeTextNo: { fontSize: 11, color: '#92400e', fontWeight: '500' },
    programmeBadgeLoading: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        marginTop: 6, marginLeft: 16,
    },
    programmeBadgeTextLoading: { fontSize: 11, color: '#6b7280' },

    modeSelector: { flexDirection: 'row', gap: 8, marginTop: 10 },
    modeBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 4, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: '#e5e7eb',
    },
    modeBtnText: { fontSize: 12, color: '#9ca3af' },

    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb',
        shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 5,
    },
    finalizeBtn: { paddingVertical: 16 },
});

export default BookRecapV2Screen;
