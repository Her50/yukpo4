// ✅ Écran de recherche de livres scolaires (Mobile) - VERSION REFONDUE
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
import SafeIcon from '../../components/SafeIcon';
import { NativeInput } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLocation } from '../../contexts/LocationContext';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

interface SearchFilters {
    classe_actuelle?: string;
    classe_souhaitee?: string;
    matiere?: string;
    niveau?: string;
    etat_livre?: string;
    ville?: string;
    quartier?: string;
    gps_lat?: number;
    gps_lon?: number;
    rayon_km?: number;
}

const LivreScolaireSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();

    const [classeActuelle, setClasseActuelle] = useState('');
    const [classeSouhaitee, setClasseSouhaitee] = useState('');
    const [matiere, setMatiere] = useState('');
    const [niveau, setNiveau] = useState('');
    const [etatLivre, setEtatLivre] = useState('');
    const [ville, setVille] = useState<LocationObject | string>('');
    const [quartier, setQuartier] = useState<LocationObject | string>('');
    const [gpsString, setGpsString] = useState('');
    const [gpsData, setGpsData] = useState<{ lat: number; lng: number } | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [rayonKm, setRayonKm] = useState(10);

    React.useEffect(() => {
        if (location?.coords) {
            const lat = location.coords.latitude;
            const lng = location.coords.longitude;
            setGpsString(`${lat},${lng}`);
            setGpsData({ lat, lng });
        }
    }, [location]);

    const handleGPSSelect = (coordinates: string) => {
        setGpsString(coordinates);
        const [lat, lng] = coordinates.split(',').map(parseFloat);
        if (!isNaN(lat) && !isNaN(lng)) {
            setGpsData({ lat, lng });
        }
        setShowGPSModal(false);
    };

    const handleSearch = () => {
        if (!classeActuelle.trim() && !classeSouhaitee.trim() && !matiere.trim()) {
            Alert.alert('Erreur', 'Veuillez renseigner au moins une classe ou une matière');
            return;
        }

        const filters: SearchFilters = {};
        if (classeActuelle.trim()) filters.classe_actuelle = classeActuelle.trim();
        if (classeSouhaitee.trim()) filters.classe_souhaitee = classeSouhaitee.trim();
        if (matiere.trim()) filters.matiere = matiere.trim();
        if (niveau.trim()) filters.niveau = niveau.trim();
        if (etatLivre.trim()) filters.etat_livre = etatLivre.trim();
        const villeStr = typeof ville === 'string' ? ville : (ville as LocationObject)?.components?.ville || (ville as LocationObject)?.place_name || '';
        const quartierStr = typeof quartier === 'string' ? quartier : (quartier as LocationObject)?.components?.quartier || (quartier as LocationObject)?.place_name || '';
        if (villeStr.trim()) filters.ville = villeStr.trim();
        if (quartierStr.trim()) filters.quartier = quartierStr.trim();
        if (gpsData) {
            filters.gps_lat = gpsData.lat;
            filters.gps_lon = gpsData.lng;
            filters.rayon_km = rayonKm;
        }

        navigation.navigate('LivreScolaireList' as never, { filters } as never);
    };

    const niveaux = ['Primaire', 'Collège', 'Lycée'];
    const etats = ['Neuf', 'Très bon', 'Bon', 'Acceptable'];
    const matieres = ['Mathématiques', 'Français', 'Anglais', 'SVT', 'Physique-Chimie', 'Histoire-Géo', 'Philosophie'];

    // ✅ NOUVEAU: État pour fonctionnalités avancées
    const [showMatching, setShowMatching] = useState(false);
    const [showTradeChains, setShowTradeChains] = useState(false);
    const [loading, setLoading] = useState(false);

    // Recherches rapides spécifiques livres scolaires
    const quickSearches = [
        {
            id: 'echange',
            title: 'Échange',
            icon: 'repeat',
            description: 'Trouver un échange',
            action: () => {
                hapticPress();
                navigation.navigate('MesTrocs' as never);
            }
        },
        {
            id: 'matching',
            title: 'Matching IA',
            icon: 'sparkles',
            description: 'Matching intelligent',
            action: () => {
                hapticPress();
                setShowMatching(true);
            }
        },
        {
            id: 'chaines',
            title: 'Chaînes de troc',
            icon: 'link',
            description: 'Troc en chaîne',
            action: () => {
                hapticPress();
                setShowTradeChains(true);
            }
        },
        {
            id: 'proche',
            title: 'Plus proche',
            icon: 'map-pin',
            description: 'À proximité',
            action: () => {
                hapticPress();
                setRayonKm(5);
            }
        },
        {
            id: 'neuf',
            title: 'Neuf',
            icon: 'star',
            description: 'Livres neufs',
            action: () => {
                hapticPress();
                setEtatLivre('Neuf');
            }
        },
    ];

    return (
        <SafeNativeView style={styles.container}>
            {/* Header avec gradient vert (éducation) */}
            <LinearGradient
                colors={['#059669', '#10B981']}
                style={styles.headerGradient}
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => {
                            hapticPress();
                            navigation.goBack();
                        }}
                        style={styles.backButton}
                    >
                        <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <View style={styles.headerIconContainer}>
                            <SafeIcon name="book-open" size={32} color="#FFFFFF" type="lucide" />
                        </View>
                        <Text style={styles.headerTitle}>Rechercher un livre scolaire</Text>
                        <Text style={styles.headerSubtitle}>
                            Trouvez ou échangez des livres scolaires près de chez vous
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            <KeyboardAwareScreen
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* ✅ NOUVEAU: Bannière matching et chaînes de troc */}
                <TouchableOpacity
                    style={styles.matchingBanner}
                    onPress={() => {
                        hapticPress();
                        setShowMatching(true);
                    }}
                >
                    <LinearGradient
                        colors={['#059669', '#10B981']}
                        style={styles.matchingBannerGradient}
                    >
                        <View style={styles.matchingBannerContent}>
                            <View style={styles.matchingBannerIcon}>
                                <SafeIcon name="sparkles" size={24} color="#FFFFFF" type="lucide" />
                            </View>
                            <View style={styles.matchingBannerText}>
                                <Text style={styles.matchingBannerTitle}>Matching intelligent</Text>
                                <Text style={styles.matchingBannerSubtitle}>
                                    Trouvez des échanges parfaits avec l'IA
                                </Text>
                            </View>
                            <SafeIcon name="chevron-right" size={20} color="#FFFFFF" type="lucide" />
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.tradeChainsBanner}
                    onPress={() => {
                        hapticPress();
                        setShowTradeChains(true);
                    }}
                >
                    <LinearGradient
                        colors={['#10B981', '#34D399']}
                        style={styles.tradeChainsBannerGradient}
                    >
                        <View style={styles.tradeChainsBannerContent}>
                            <View style={styles.tradeChainsBannerIcon}>
                                <SafeIcon name="link" size={24} color="#FFFFFF" type="lucide" />
                            </View>
                            <View style={styles.tradeChainsBannerText}>
                                <Text style={styles.tradeChainsBannerTitle}>Chaînes de troc</Text>
                                <Text style={styles.tradeChainsBannerSubtitle}>
                                    Participez à des échanges en chaîne
                                </Text>
                            </View>
                            <SafeIcon name="chevron-right" size={20} color="#FFFFFF" type="lucide" />
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                {/* Recherches rapides */}
                <View style={styles.quickSearchesSection}>
                    <Text style={styles.sectionTitle}>🔍 Recherches rapides</Text>
                    <View style={styles.quickSearchesGrid}>
                        {quickSearches.map((search) => (
                            <TouchableOpacity
                                key={search.id}
                                style={styles.quickSearchCard}
                                onPress={search.action}
                                activeOpacity={0.7}
                            >
                                <View style={styles.quickSearchIconContainer}>
                                    <SafeIcon
                                        name={search.icon}
                                        size={24}
                                        color="#059669"
                                        type="lucide"
                                    />
                                </View>
                                <Text style={styles.quickSearchTitle}>{search.title}</Text>
                                <Text style={styles.quickSearchDescription}>{search.description}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Formulaire de recherche */}
                <View style={styles.searchFormCard}>
                    <Text style={styles.sectionTitle}>📚 Informations du livre</Text>
                    {/* Classe actuelle */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="graduation-cap" size={14} color={modernColors.primary} type="lucide" /> Classe actuelle *
                        </Text>
                        <NativeInput
                            value={classeActuelle}
                            onChangeText={setClasseActuelle}
                            placeholder="Ex: 6ème, 5ème, Terminale"
                        />
                    </View>

                    {/* Classe souhaitée */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="target" size={14} color={modernColors.primary} type="lucide" /> Classe souhaitée *
                        </Text>
                        <NativeInput
                            value={classeSouhaitee}
                            onChangeText={setClasseSouhaitee}
                            placeholder="Ex: 5ème, 4ème, 1ère"
                        />
                    </View>

                    {/* Matière */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="book" size={14} color={modernColors.primary} type="lucide" /> Matière *
                        </Text>
                        <NativeInput
                            value={matiere}
                            onChangeText={setMatiere}
                            placeholder="Ex: Mathématiques, Français"
                        />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                            {matieres.map((m) => (
                                <TouchableOpacity
                                    key={m}
                                    style={[styles.chip, matiere === m && styles.chipActive]}
                                    onPress={() => {
                                        hapticPress();
                                        setMatiere(matiere === m ? '' : m);
                                    }}
                                >
                                    <Text style={[styles.chipText, matiere === m && styles.chipTextActive]}>
                                        {m}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Niveau */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="layers" size={14} color={modernColors.primary} type="lucide" /> Niveau
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                            {niveaux.map((n) => (
                                <TouchableOpacity
                                    key={n}
                                    style={[styles.chip, niveau === n && styles.chipActive]}
                                    onPress={() => {
                                        hapticPress();
                                        setNiveau(niveau === n ? '' : n);
                                    }}
                                >
                                    <Text style={[styles.chipText, niveau === n && styles.chipTextActive]}>
                                        {n}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* État du livre */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="check-circle" size={14} color={modernColors.primary} type="lucide" /> État du livre
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                            {etats.map((etat) => (
                                <TouchableOpacity
                                    key={etat}
                                    style={[styles.chip, etatLivre === etat && styles.chipActive]}
                                    onPress={() => {
                                        hapticPress();
                                        setEtatLivre(etatLivre === etat ? '' : etat);
                                    }}
                                >
                                    <Text style={[styles.chipText, etatLivre === etat && styles.chipTextActive]}>
                                        {etat}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Localisation */}
                    <Text style={styles.sectionTitle}>📍 Localisation</Text>

                    {/* Ville */}
                    <View style={styles.inputGroup}>
                        <LocationSelector
                            label="Ville"
                            value={typeof ville === 'string' ? (ville ? { raw: ville, place_name: ville } : '') : ville}
                            onSelect={(location: LocationObject) => {
                                setVille(location);
                            }}
                            placeholder="Rechercher un lieu (ville, quartier, adresse...)"
                            scope="all"
                            enrichWithBackend={true}
                        />
                    </View>

                    {/* Quartier */}
                    <View style={styles.inputGroup}>
                        <LocationSelector
                            label="Quartier (optionnel)"
                            value={typeof quartier === 'string' ? (quartier ? { raw: quartier, place_name: quartier } : '') : quartier}
                            onSelect={(location: LocationObject) => {
                                setQuartier(location);
                            }}
                            placeholder="Rechercher un lieu précis (quartier, rue, adresse...)"
                            scope="all"
                            cityContext={typeof ville === 'string' ? ville : (ville as LocationObject)?.components?.ville || (ville as LocationObject)?.place_name || ''}
                            enrichWithBackend={true}
                        />
                    </View>

                    {/* GPS */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="map-pin" size={14} color={modernColors.primary} type="lucide" /> Position GPS
                        </Text>
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={() => {
                                hapticPress();
                                setShowGPSModal(true);
                            }}
                        >
                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} type="lucide" />
                            <Text style={styles.gpsButtonText} numberOfLines={1}>
                                {gpsString || 'Utiliser ma position GPS'}
                            </Text>
                            <SafeIcon name="chevron-right" size={20} color="#9CA3AF" type="lucide" />
                        </TouchableOpacity>
                    </View>

                    {/* Rayon de recherche */}
                    {gpsData && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>
                                <SafeIcon name="maximize-2" size={14} color={modernColors.primary} type="lucide" /> Rayon de recherche
                            </Text>
                            <View style={styles.distanceCard}>
                                <TouchableOpacity
                                    style={styles.distanceButton}
                                    onPress={() => {
                                        hapticPress();
                                        setRayonKm(Math.max(1, rayonKm - 1));
                                    }}
                                >
                                    <SafeIcon name="minus" size={18} color="#FFFFFF" type="lucide" />
                                </TouchableOpacity>
                                <View style={styles.distanceValueContainer}>
                                    <Text style={styles.distanceValue}>{rayonKm}</Text>
                                    <Text style={styles.distanceUnit}>km</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.distanceButton}
                                    onPress={() => {
                                        hapticPress();
                                        setRayonKm(Math.min(50, rayonKm + 1));
                                    }}
                                >
                                    <SafeIcon name="plus" size={18} color="#FFFFFF" type="lucide" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* ✅ NOUVEAU: Option recherche échange */}
                    <View style={styles.inputGroup}>
                        <View style={styles.optionCard}>
                            <View style={styles.optionContent}>
                                <View style={styles.optionIconContainer}>
                                    <SafeIcon name="repeat" size={20} color="#059669" type="lucide" />
                                </View>
                                <View style={styles.optionTextContainer}>
                                    <Text style={styles.optionTitle}>Rechercher des échanges</Text>
                                    <Text style={styles.optionDescription}>
                                        Trouver des utilisateurs intéressés par un échange
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={styles.exchangeButton}
                                onPress={() => {
                                    hapticPress();
                                    navigation.navigate('MesTrocs' as never, {
                                        classeActuelle,
                                        classeSouhaitee,
                                        matiere,
                                    } as never);
                                }}
                            >
                                <SafeIcon name="arrow-right" size={20} color="#059669" type="lucide" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Bouton de recherche */}
                    <TouchableOpacity
                        onPress={handleSearch}
                        disabled={loading}
                        style={[styles.searchButton, loading && styles.searchButtonDisabled]}
                        activeOpacity={0.8}
                    >
                        <View style={styles.searchButtonContent}>
                            <SafeIcon name="search" size={20} color="#FFFFFF" type="lucide" />
                            <Text style={styles.searchButtonText}>
                                {loading ? 'Recherche en cours...' : 'Lancer la recherche'}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Info section */}
                <View style={styles.infoCard}>
                    <View style={styles.infoHeader}>
                        <SafeIcon name="info" size={20} color="#059669" type="lucide" />
                        <Text style={styles.infoTitle}>💡 Bon à savoir</Text>
                    </View>
                    <Text style={styles.infoText}>
                        • Vous pouvez échanger vos livres scolaires avec d'autres utilisateurs{'\n'}
                        • La recherche par GPS permet de trouver des livres à proximité{'\n'}
                        • Vérifiez l'état du livre avant de finaliser l'échange{'\n'}
                        • Les livres neufs sont généralement plus chers mais en meilleur état
                    </Text>
                </View>
            </KeyboardAwareScreen>

            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
                currentLocation={gpsString as any}
            />
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    headerGradient: {
        paddingTop: 20,
        paddingBottom: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
    },
    backButton: {
        marginRight: 12,
        marginTop: 4,
    },
    headerContent: {
        flex: 1,
        alignItems: 'center',
    },
    headerIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 6,
        textAlign: 'center',
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        paddingHorizontal: 20,
        lineHeight: 20,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 32,
    },
    quickSearchesSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    quickSearchesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    quickSearchCard: {
        flex: 1,
        minWidth: '30%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    quickSearchIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#D1FAE5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    quickSearchTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
        textAlign: 'center',
    },
    quickSearchDescription: {
        fontSize: 11,
        color: '#6B7280',
        textAlign: 'center',
    },
    searchFormCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    chipsContainer: {
        flexDirection: 'row',
        marginTop: 8,
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1.5,
        borderColor: '#D1D5DB',
    },
    chipActive: {
        backgroundColor: '#059669',
        borderColor: '#059669',
    },
    chipText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '600',
    },
    chipTextActive: {
        color: '#FFFFFF',
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 12,
    },
    gpsButtonText: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    distanceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    distanceButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#059669',
        justifyContent: 'center',
        alignItems: 'center',
    },
    distanceValueContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    distanceValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
    },
    distanceUnit: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    searchButton: {
        marginTop: 16,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#059669',
        paddingVertical: 16,
    },
    searchButtonDisabled: {
        opacity: 0.6,
    },
    searchButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    searchButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    infoCard: {
        backgroundColor: '#ECFDF5',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#065F46',
    },
    infoText: {
        fontSize: 13,
        color: '#065F46',
        lineHeight: 20,
    },
    // ✅ NOUVEAU: Styles pour bannières
    matchingBanner: {
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    matchingBannerGradient: {
        padding: 16,
    },
    matchingBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    matchingBannerIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    matchingBannerText: {
        flex: 1,
    },
    matchingBannerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    matchingBannerSubtitle: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.9)',
        lineHeight: 16,
    },
    tradeChainsBanner: {
        marginBottom: 20,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    tradeChainsBannerGradient: {
        padding: 16,
    },
    tradeChainsBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    tradeChainsBannerIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tradeChainsBannerText: {
        flex: 1,
    },
    tradeChainsBannerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    tradeChainsBannerSubtitle: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.9)',
        lineHeight: 16,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    optionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
    },
    optionIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    optionTextContainer: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    optionDescription: {
        fontSize: 12,
        color: '#6B7280',
        lineHeight: 16,
    },
    exchangeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#ECFDF5',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default LivreScolaireSearchScreen;

