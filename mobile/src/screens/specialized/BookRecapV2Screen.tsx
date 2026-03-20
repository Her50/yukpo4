// ✅ V2: Écran Récap par classe - Tableau état/valeur, choix mode troc/vente/don, finalisation

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
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
    /** Renseigné avant les photos (upload V2) */
    mode_listing?: string;
}

const ETAT_COLORS: Record<string, string> = {
    bon: '#22c55e',
    acceptable: '#f59e0b',
    rejete: '#ef4444',
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
    const MODE_OPTIONS = [
        { key: 'troc', label: 'Troc', icon: 'repeat', color: '#3b82f6', desc: t('bookRecapV2Screen.echangerContreUnAutreLivre') },
        { key: 'vente', label: 'Vente', icon: 'dollar-sign', color: '#22c55e', desc: t('bookRecapV2Screen.vendreAuPrixCalcule') },
        { key: 'don', label: 'Don', icon: 'heart', color: '#ef4444', desc: t('bookRecapV2Screen.donnerGratuitement', 'Donner gratuitement') },
    ];
    const ETAT_LABELS: Record<string, string> = {
        bon: t('bookRecapV2Screen.bonEtat'),
        acceptable: t('bookRecapV2Screen.acceptable', 'Acceptable'),
        rejete: t('bookRecapV2Screen.rejete'),
    };

    // Mode par livre : reprend les choix faits avant les photos, modifiable ici si besoin
    const [bookModes, setBookModes] = useState<Record<number, string>>(() => {
        const modes: Record<number, string> = {};
        initialBooks.forEach((b) => {
            const m = b.mode_listing;
            modes[b.id] =
                m === 'vente' || m === 'don' || m === 'troc' ? m : 'troc';
        });
        return modes;
    });
    const [finalizing, setFinalizing] = useState(false);
    const [showBulkModeTools, setShowBulkModeTools] = useState(false);
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

    const acceptedCount = initialBooks.filter((b) => !b.is_rejected).length;

    const modeCounts = useMemo(() => {
        const c = { troc: 0, vente: 0, don: 0 };
        initialBooks.forEach((b) => {
            if (b.is_rejected) return;
            const m = bookModes[b.id] || 'troc';
            if (m === 'vente') c.vente++;
            else if (m === 'don') c.don++;
            else c.troc++;
        });
        return c;
    }, [initialBooks, bookModes]);

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
                `${validBooks.length} livre${validBooks.length > 1 ? 's' : ''} mis en ligne avec succès`,
                'success'
            );

            navigation.navigate('LivreScolaireHome');
        } catch (error: any) {
            console.error('[BookRecapV2] Erreur finalisation:', error);
            Alert.alert('Erreur', t('bookRecapV2Screen.impossibleDeFinaliserLaSessionReessayez'));
        } finally {
            setFinalizing(false);
        }
    }, [sessionId, initialBooks, bookModes, navigation, toaster]);

    const renderClassTabs = () => (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.classTabs}
            contentContainerStyle={styles.classTabsContent}
        >
            <TouchableOpacity
                style={[styles.classTab, !selectedClassFilter && styles.classTabActive]}
                onPress={() => {
                    hapticPress();
                    setSelectedClassFilter(null);
                }}
            >
                <Text style={[styles.classTabText, !selectedClassFilter && styles.classTabTextActive]}>
                    {t('bookRecapV2Screen.filtreTous', 'Tous')} ({acceptedCount})
                </Text>
            </TouchableOpacity>
            {classes.map((classe) => (
                <TouchableOpacity
                    key={classe}
                    style={[styles.classTab, selectedClassFilter === classe && styles.classTabActive]}
                    onPress={() => {
                        hapticPress();
                        setSelectedClassFilter(classe);
                    }}
                >
                    <Text
                        style={[styles.classTabText, selectedClassFilter === classe && styles.classTabTextActive]}
                        numberOfLines={1}
                    >
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
                <View style={styles.bookRowTop}>
                    {item.image_recto_uri ? (
                        <Image source={{ uri: item.image_recto_uri }} style={styles.bookThumb} />
                    ) : (
                        <View style={[styles.bookThumb, styles.bookThumbPlaceholder]}>
                            <SafeIcon name="book-open" size={20} color="#9ca3af" />
                        </View>
                    )}
                    <View style={styles.bookRowMain}>
                        <View style={styles.bookRowHeader}>
                            <View style={[styles.etatDot, { backgroundColor: ETAT_COLORS[item.etat_classification] }]} />
                            <Text style={styles.bookRowTitle} numberOfLines={2}>
                                {item.titre}
                            </Text>
                            <Text style={styles.bookRowValue}>{Math.round(item.valeur_calculee)} XAF</Text>
                        </View>
                        <Text style={styles.bookRowMeta} numberOfLines={2}>
                            {item.niveau ? `${item.niveau} — ` : ''}
                            {item.classe_actuelle} • {item.matiere} • {ETAT_LABELS[item.etat_classification]}
                        </Text>
                        {item.classe_souhaitee ? (
                            <Text style={styles.bookRowClasseVisee} numberOfLines={1}>
                                Classe visée : {item.classe_souhaitee}
                            </Text>
                        ) : null}
                    </View>
                </View>

                {progMatch ? (
                    <View style={[styles.programmeBadge, progMatch.matched ? styles.programmeBadgeOk : styles.programmeBadgeNo]}>
                        <SafeIcon
                            name={progMatch.matched ? 'book-open' : 'alert-circle'}
                            size={12}
                            color={progMatch.matched ? '#166534' : '#92400e'}
                        />
                        <Text style={progMatch.matched ? styles.programmeBadgeTextOk : styles.programmeBadgeTextNo}>
                            {progMatch.matched
                                ? t('bourseLivreV2.recap.programmeOfficiel', {
                                      percent: (progMatch.score_match * 100).toFixed(0),
                                  })
                                : t('bourseLivreV2.recap.horsProgramme')}
                        </Text>
                    </View>
                ) : matchingInProgress ? (
                    <View style={styles.programmeBadgeLoading}>
                        <ActivityIndicator size="small" color="#6b7280" />
                        <Text style={styles.programmeBadgeTextLoading}>{t('bourseLivreV2.recap.verificationProgramme')}</Text>
                    </View>
                ) : null}

                <Text style={styles.modeRowLabel}>{t('bookRecapV2Screen.modePublication', 'Publication')}</Text>
                <View style={styles.modeSelector}>
                    {MODE_OPTIONS.map((opt) => (
                        <TouchableOpacity
                            key={opt.key}
                            style={[
                                styles.modeBtn,
                                currentMode === opt.key && {
                                    backgroundColor: opt.color + '18',
                                    borderColor: opt.color,
                                },
                            ]}
                            onPress={() => handleModeChange(item.id, opt.key)}
                        >
                            <SafeIcon
                                name={opt.icon}
                                size={13}
                                color={currentMode === opt.key ? opt.color : '#9ca3af'}
                            />
                            <Text
                                style={[
                                    styles.modeBtnText,
                                    currentMode === opt.key && { color: opt.color, fontWeight: '700' },
                                ]}
                            >
                                {opt.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        );
    };

    const finalizeLabel =
        acceptedCount === 0
            ? t('bookRecapV2Screen.mettreEnLigne', 'Mettre en ligne')
            : acceptedCount === 1
              ? t('bookRecapV2Screen.mettreEnLigneUnLivre', 'Mettre en ligne 1 livre')
              : t('bookRecapV2Screen.mettreEnLignePlusieurs', 'Mettre en ligne {{count}} livres', {
                    count: acceptedCount,
                });

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{t('bookRecapV2.recapitulatif')}</Text>
                <Text style={styles.headerSubtitle}>
                    {t(
                        'bookRecapV2Screen.recapSubtitle',
                        'Les modes ont été choisis avant les photos — ajustez ci-dessous si besoin.'
                    )}
                </Text>
                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{acceptedCount}</Text>
                        <Text style={styles.statLabel}>{t('bookRecapV2.livresAcceptes')}</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statValue, { color: modernColors.primary }]}>
                            {Math.round(totalValue)} XAF
                        </Text>
                        <Text style={styles.statLabel}>{t('bookRecapV2Screen.valeurTotale', 'Valeur totale')}</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statValue, { color: '#ef4444' }]}>{rejectedBooks.length}</Text>
                        <Text style={styles.statLabel}>{t('bookRecapV2.rejetes')}</Text>
                    </View>
                </View>

                <View style={styles.modeSummaryRow}>
                    {MODE_OPTIONS.map((opt) => (
                        <View key={opt.key} style={[styles.modeSummaryPill, { borderColor: opt.color + '55' }]}>
                            <SafeIcon name={opt.icon} size={14} color={opt.color} />
                            <Text style={styles.modeSummaryCount}>{modeCounts[opt.key as keyof typeof modeCounts]}</Text>
                            <Text style={styles.modeSummaryLabel}>{opt.label}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <View style={styles.gpsInfo}>
                <SafeIcon name="map-pin" size={14} color="#0369a1" />
                <Text style={styles.gpsInfoText} numberOfLines={1}>
                    {t('bookRecapV2Screen.recuperation', 'Récupération')} :{' '}
                    {gpsAddress || t('bookRecapV2Screen.lieuSelectionne', 'Lieu sélectionné')}
                </Text>
            </View>

            <TouchableOpacity
                style={styles.bulkModeToggle}
                onPress={() => {
                    hapticPress();
                    setShowBulkModeTools((v) => !v);
                }}
                activeOpacity={0.7}
            >
                <SafeIcon name={showBulkModeTools ? 'chevron-up' : 'chevron-down'} size={18} color="#64748b" />
                <Text style={styles.bulkModeToggleText}>
                    {t('bookRecapV2Screen.appliquerModeATous', 'Appliquer un mode à tous les livres')}
                </Text>
            </TouchableOpacity>
            {showBulkModeTools ? (
                <View style={styles.bulkModeRow}>
                    {MODE_OPTIONS.map((opt) => (
                        <TouchableOpacity
                            key={opt.key}
                            style={[styles.bulkModeBtn, { borderColor: opt.color }]}
                            onPress={() => handleSetAllMode(opt.key)}
                        >
                            <SafeIcon name={opt.icon} size={14} color={opt.color} />
                            <Text style={[styles.bulkModeBtnText, { color: opt.color }]}>{opt.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            ) : null}

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
                    title={finalizing ? t('bookRecapV2Screen.finalisation', 'Finalisation…') : finalizeLabel}
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

    header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 },
    headerSubtitle: { fontSize: 12, color: '#64748b', marginTop: 6, lineHeight: 17 },
    statsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
    statBox: {
        flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center',
        borderWidth: 1, borderColor: '#e2e8f0',
    },
    statValue: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
    statLabel: { fontSize: 10, color: '#64748b', marginTop: 4, textAlign: 'center' },

    modeSummaryRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    modeSummaryPill: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
        paddingVertical: 8, borderRadius: 10, borderWidth: 1, backgroundColor: '#fff',
    },
    modeSummaryCount: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
    modeSummaryLabel: { fontSize: 10, color: '#64748b', fontWeight: '600' },

    gpsInfo: {
        flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16,
        paddingVertical: 10, backgroundColor: '#f0f9ff', borderBottomWidth: 1, borderBottomColor: '#e0f2fe',
    },
    gpsInfoText: { fontSize: 12, color: '#0c4a6e', flex: 1 },

    bulkModeToggle: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    },
    bulkModeToggleText: { fontSize: 13, color: '#475569', fontWeight: '600', flex: 1 },
    bulkModeRow: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 8,
        paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4, backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    },
    bulkModeBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
        borderWidth: 1.5, backgroundColor: '#fafafa',
    },
    bulkModeBtnText: { fontSize: 13, fontWeight: '700' },

    classTabs: { maxHeight: 44, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
    classTabsContent: { paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
    classTab: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
        backgroundColor: '#f1f5f9', marginRight: 6, maxWidth: 200,
    },
    classTabActive: { backgroundColor: modernColors.primary },
    classTabText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
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
        backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10,
        borderWidth: 1, borderColor: '#e2e8f0',
        shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06,
        shadowRadius: 3, elevation: 2,
    },
    bookRowTop: { flexDirection: 'row', gap: 12 },
    bookThumb: { width: 52, height: 68, borderRadius: 8, backgroundColor: '#f1f5f9' },
    bookThumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    bookRowMain: { flex: 1, minWidth: 0 },
    bookRowHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    etatDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
    bookRowTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0f172a' },
    bookRowValue: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
    bookRowMeta: { fontSize: 11, color: '#64748b', marginTop: 6 },
    bookRowClasseVisee: {
        fontSize: 11, color: '#2563eb', fontWeight: '600', marginTop: 4,
    },
    modeRowLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

    programmeBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        marginTop: 8, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start',
    },
    programmeBadgeOk: { backgroundColor: '#dcfce7' },
    programmeBadgeNo: { backgroundColor: '#fef3c7' },
    programmeBadgeTextOk: { fontSize: 11, color: '#166534', fontWeight: '600' },
    programmeBadgeTextNo: { fontSize: 11, color: '#92400e', fontWeight: '500' },
    programmeBadgeLoading: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        marginTop: 8,
    },
    programmeBadgeTextLoading: { fontSize: 11, color: '#6b7280' },

    modeSelector: { flexDirection: 'row', gap: 6, marginTop: 6 },
    modeBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 4, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
    },
    modeBtnText: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },

    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb',
        shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 5,
    },
    finalizeBtn: { paddingVertical: 16 },
});

export default BookRecapV2Screen;
