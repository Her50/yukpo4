// ✅ Écran de recherche de livres scolaires (Mobile)

import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import ModernGPSModal from '../../components/ModernGPSModal';
import { NativeButton, NativeInput } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useLocation } from '../../contexts/LocationContext';
import { modernColors } from '../../theme/modernTheme';

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
    const [ville, setVille] = useState('');
    const [quartier, setQuartier] = useState('');
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
        if (ville.trim()) filters.ville = ville.trim();
        if (quartier.trim()) filters.quartier = quartier.trim();
        if (gpsData) {
            filters.gps_lat = gpsData.lat;
            filters.gps_lon = gpsData.lng;
            filters.rayon_km = rayonKm;
        }

        navigation.navigate('LivreScolaireList' as never, { filters } as never);
    };

    const niveaux = ['Primaire', 'Collège', 'Lycée'];
    const etats = ['Neuf', 'Très bon', 'Bon', 'Acceptable'];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Rechercher un livre</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <View style={styles.searchForm}>
                    {/* Classe actuelle */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Classe actuelle *</Text>
                        <NativeInput
                            value={classeActuelle}
                            onChangeText={setClasseActuelle}
                            placeholder="Ex: 6ème, 5ème, Terminale"
                        />
                    </View>

                    {/* Classe souhaitée */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Classe souhaitée *</Text>
                        <NativeInput
                            value={classeSouhaitee}
                            onChangeText={setClasseSouhaitee}
                            placeholder="Ex: 5ème, 4ème, 1ère"
                        />
                    </View>

                    {/* Matière */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Matière *</Text>
                        <NativeInput
                            value={matiere}
                            onChangeText={setMatiere}
                            placeholder="Ex: Mathématiques, Français"
                        />
                    </View>

                    {/* Niveau */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Niveau</Text>
                        <View style={styles.chipContainer}>
                            {niveaux.map((n) => (
                                <TouchableOpacity
                                    key={n}
                                    style={[
                                        styles.chip,
                                        niveau === n && styles.chipSelected
                                    ]}
                                    onPress={() => setNiveau(niveau === n ? '' : n)}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        niveau === n && styles.chipTextSelected
                                    ]}>
                                        {n}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* État du livre */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>État du livre</Text>
                        <View style={styles.chipContainer}>
                            {etats.map((etat) => (
                                <TouchableOpacity
                                    key={etat}
                                    style={[
                                        styles.chip,
                                        etatLivre === etat && styles.chipSelected
                                    ]}
                                    onPress={() => setEtatLivre(etatLivre === etat ? '' : etat)}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        etatLivre === etat && styles.chipTextSelected
                                    ]}>
                                        {etat}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Ville */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Ville</Text>
                        <NativeInput
                            value={ville}
                            onChangeText={setVille}
                            placeholder="Ex: Douala, Yaoundé"
                        />
                    </View>

                    {/* Quartier */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Quartier (optionnel)</Text>
                        <NativeInput
                            value={quartier}
                            onChangeText={setQuartier}
                            placeholder="Ex: Bonanjo, Akwa"
                        />
                    </View>

                    {/* GPS */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Position GPS (optionnel)</Text>
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={() => setShowGPSModal(true)}
                        >
                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                            <Text style={styles.gpsButtonText}>
                                {gpsString || 'Sélectionner un point GPS'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Rayon de recherche */}
                    {gpsData && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Rayon de recherche: {rayonKm} km</Text>
                            <View style={styles.distanceControls}>
                                <TouchableOpacity
                                    style={styles.distanceButton}
                                    onPress={() => setRayonKm(Math.max(1, rayonKm - 1))}
                                >
                                    <Text style={styles.distanceButtonText}>-</Text>
                                </TouchableOpacity>
                                <Text style={styles.distanceValue}>{rayonKm} km</Text>
                                <TouchableOpacity
                                    style={styles.distanceButton}
                                    onPress={() => setRayonKm(Math.min(50, rayonKm + 1))}
                                >
                                    <Text style={styles.distanceButtonText}>+</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Bouton de recherche */}
                    <NativeButton
                        title="🔍 Rechercher"
                        variant="primary"
                        onPress={handleSearch}
                        style={styles.searchButton}
                    />
                </View>
            </ScrollView>

            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
                currentLocation={gpsString}
            />
        </View>
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
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
        padding: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    searchForm: {
        gap: 16,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    chipContainer: {
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
        color: '#FFF',
        fontWeight: '600',
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    gpsButtonText: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
    },
    distanceControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        justifyContent: 'center',
    },
    distanceButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    distanceButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    distanceValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        minWidth: 60,
        textAlign: 'center',
    },
    searchButton: {
        marginTop: 8,
    },
});

export default LivreScolaireSearchScreen;

