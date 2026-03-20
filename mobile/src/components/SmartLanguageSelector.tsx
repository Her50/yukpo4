/**
 * SmartLanguageSelector — Sélecteur de langue intelligent basé sur la position GPS
 * 
 * Fonctionnalités :
 * - Détecte automatiquement le pays via GPS
 * - Affiche les langues locales pertinentes (max 10) + langues officielles
 * - Badge "Localt('smartLanguageSelector.pourLesLanguesRegionalest('smartLanguageSelector.officielPourLesLanguesOfficiellesSection')ensemble des langues supportées
 * - Mode compact (bouton drapeau) ou mode full (modal)
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { useLanguageSafe } from '../contexts/LanguageContext';
import { SUPPORTED_LANGUAGES } from '../i18n';
import {
    detectGeoLanguageContext,
    GeoLanguage,
} from '../services/geoLanguageService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SmartLanguageSelectorProps {
    /** Mode compact = petit bouton drapeau ; full = modal directe */
    compact?: boolean;
    /** Callback quand l'utilisateur change de langue */
    onLanguageChange?: (code: string) => void;
    /** Afficher le label du pays détecté */
    showCountryHint?: boolean;
    /** Style du conteneur */
    style?: any;
    /** Forcer l'ouverture de la modal */
    visible?: boolean;
    /** Callback de fermeture (mode contrôlé) */
    onClose?: () => void;
}

const SmartLanguageSelector: React.FC<SmartLanguageSelectorProps> = ({
    compact = false,
    onLanguageChange,
    showCountryHint = false,
    style,
    visible: controlledVisible,
    onClose,
}) => {
    const { language, setLanguage, t } = useLanguageSafe();
    const [modalVisible, setModalVisible] = useState(false);
    const [suggestedLanguages, setSuggestedLanguages] = useState<GeoLanguage[]>([]);
    const [countryCode, setCountryCode] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [showAllLanguages, setShowAllLanguages] = useState(false);

    // Mode contrôlé ou interne
    const isVisible = controlledVisible !== undefined ? controlledVisible : modalVisible;
    const closeModal = useCallback(() => {
        if (onClose) onClose();
        else setModalVisible(false);
        setShowAllLanguages(false);
    }, [onClose]);

    // Détecter les langues géographiques au montage
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const ctx = await detectGeoLanguageContext();
                if (mounted) {
                    setSuggestedLanguages(ctx.suggestedLanguages);
                    setCountryCode(ctx.countryCode);
                }
            } catch (e) {
                console.warn('[SmartLangSelector] Geo detection failed:', e);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    const handleSelectLanguage = useCallback((code: string) => {
        setLanguage(code);
        if (onLanguageChange) onLanguageChange(code);
        closeModal();
    }, [setLanguage, onLanguageChange, closeModal]);

    // Langue courante
    const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];

    // Toutes les langues supportées (pour le mode "voir tout")
    const allLanguages = SUPPORTED_LANGUAGES.map(l => ({
        code: l.code,
        name: l.name,
        nativeName: l.name,
        flag: l.flag,
        isOfficial: false,
        isLocal: false,
    }));

    // ===== RENDU COMPACT (bouton drapeau) =====
    if (compact) {
        return (
            <TouchableOpacity
                style={[styles.compactButton, style]}
                onPress={() => setModalVisible(true)}
                activeOpacity={0.7}
            >
                <Text style={styles.compactFlag}>{currentLang.flag}</Text>
                <Text style={styles.compactLabel}>{currentLang.code.toUpperCase()}</Text>
                <Text style={styles.compactChevron}>▾</Text>
                {/* Modal */}
                {renderModal()}
            </TouchableOpacity>
        );
    }

    // ===== RENDU FULL =====
    return renderModal();

    // ===== MODAL =====
    function renderModal() {
        return (
            <Modal
                visible={isVisible}
                transparent
                animationType="slide"
                onRequestClose={closeModal}
            >
                <TouchableOpacity
                    style={styles.overlay}
                    activeOpacity={1}
                    onPress={closeModal}
                >
                    <View style={styles.container} onStartShouldSetResponder={() => true}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.handleBar} />
                            <Text style={styles.title}>{t('smartLanguageSelector.chooseLanguage')}</Text>
                            {showCountryHint && countryCode ? (
                                <Text style={styles.countryHint}>
                                    📍 {t('smartLanguageSelector.detectedCountry')}: {countryCode}
                                </Text>
                            ) : null}
                        </View>

                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#3B82F6" />
                                <Text style={styles.loadingText}>
                                    {t('smartLanguageSelector.detectingPosition')}
                                </Text>
                            </View>
                        ) : showAllLanguages ? (
                            <>
                                {/* Bouton retour */}
                                <TouchableOpacity
                                    style={styles.backButton}
                                    onPress={() => setShowAllLanguages(false)}
                                >
                                    <Text style={styles.backButtonText}>← {t('smartLanguageSelector.suggestedLanguages')}</Text>
                                </TouchableOpacity>
                                <FlatList
                                    data={allLanguages}
                                    keyExtractor={item => item.code}
                                    renderItem={({ item }) => renderLanguageItem(item, false)}
                                    style={styles.list}
                                    showsVerticalScrollIndicator={false}
                                />
                            </>
                        ) : (
                            <ScrollView
                                style={styles.suggestedScroll}
                                contentContainerStyle={styles.suggestedScrollContent}
                                showsVerticalScrollIndicator={false}
                            >
                                {/* Langues suggérées */}
                                {suggestedLanguages.length > 0 && (
                                    <View style={styles.section}>
                                        <Text style={styles.sectionTitle}>
                                            🌍 {t('smartLanguageSelector.suggestedForYou')}
                                        </Text>
                                        {suggestedLanguages.map(lang => (
                                            <React.Fragment key={lang.code}>
                                                {renderLanguageItem(lang, true)}
                                            </React.Fragment>
                                        ))}
                                    </View>
                                )}

                                {/* Bouton voir toutes les langues */}
                                <TouchableOpacity
                                    style={styles.showAllButton}
                                    onPress={() => setShowAllLanguages(true)}
                                >
                                    <Text style={styles.showAllText}>
                                        🌐 {t('smartLanguageSelector.allLanguages')} ({SUPPORTED_LANGUAGES.length})
                                    </Text>
                                    <Text style={styles.showAllChevron}>→</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>
        );
    }

    function renderLanguageItem(lang: GeoLanguage, showBadges: boolean) {
        const isActive = lang.code === language;
        return (
            <TouchableOpacity
                key={lang.code}
                style={[styles.langItem, isActive && styles.langItemActive]}
                onPress={() => handleSelectLanguage(lang.code)}
                activeOpacity={0.6}
            >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <View style={styles.langInfo}>
                    <View style={styles.langNameRow}>
                        <Text style={[styles.langName, isActive && styles.langNameActive]}>
                            {lang.nativeName || lang.name}
                        </Text>
                        {showBadges && lang.isOfficial && (
                            <View style={styles.badgeOfficial}>
                                <Text style={styles.badgeText}>{t('smartLanguageSelector.official')}</Text>
                            </View>
                        )}
                        {showBadges && lang.isLocal && (
                            <View style={styles.badgeLocal}>
                                <Text style={styles.badgeText}>{t('smartLanguageSelector.local')}</Text>
                            </View>
                        )}
                    </View>
                    {lang.name !== lang.nativeName && (
                        <Text style={styles.langSubtitle}>{lang.name}</Text>
                    )}
                </View>
                {isActive && <Text style={styles.checkMark}>✓</Text>}
            </TouchableOpacity>
        );
    }
};

const styles = StyleSheet.create({
    // ===== COMPACT =====
    compactButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
    },
    compactFlag: {
        fontSize: 18,
    },
    compactLabel: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    compactChevron: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 10,
    },

    // ===== MODAL =====
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: Dimensions.get('window').height * 0.75,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    },
    header: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    handleBar: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#ddd',
        marginBottom: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1a1a2e',
    },
    countryHint: {
        fontSize: 13,
        color: '#666',
        marginTop: 4,
    },

    // ===== LOADING =====
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#888',
    },

    // ===== SECTION =====
    section: {
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    suggestedScroll: {
        maxHeight: Dimensions.get('window').height * 0.55,
    },
    suggestedScrollContent: {
        paddingBottom: 12,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
        paddingHorizontal: 4,
    },

    // ===== LANGUAGE ITEM =====
    langItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#f0f0f0',
    },
    langItemActive: {
        backgroundColor: '#EFF6FF',
    },
    langFlag: {
        fontSize: 28,
        marginRight: 12,
    },
    langInfo: {
        flex: 1,
    },
    langNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    langName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1a1a2e',
    },
    langNameActive: {
        color: '#3B82F6',
        fontWeight: '700',
    },
    langSubtitle: {
        fontSize: 12,
        color: '#999',
        marginTop: 2,
    },
    checkMark: {
        fontSize: 20,
        color: '#3B82F6',
        fontWeight: '700',
    },

    // ===== BADGES =====
    badgeOfficial: {
        backgroundColor: '#3B82F6',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    badgeLocal: {
        backgroundColor: '#10B981',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
    },

    // ===== SHOW ALL =====
    showAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 20,
        marginTop: 8,
        marginHorizontal: 16,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    showAllText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#3B82F6',
    },
    showAllChevron: {
        fontSize: 18,
        color: '#3B82F6',
    },

    // ===== BACK BUTTON =====
    backButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    backButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#3B82F6',
    },

    // ===== LIST =====
    list: {
        maxHeight: Dimensions.get('window').height * 0.55,
    },
});

export default SmartLanguageSelector;
