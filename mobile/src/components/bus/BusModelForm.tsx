/**
 * Composant pour créer/modifier un modèle de bus
 * Permet de configurer le nombre de places, la classe, les équipements, etc.
 */

import React, { useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';

export interface BusModel {
    id?: string;
    nom_modele: string;
    name?: string;
    total_seats: number;
    classe: string;
    prix_base: number;
    equipements: string[];
    rows?: number;
    seatsPerRow?: number;
    firstRowSeats?: number;
}

interface BusModelFormProps {
    visible: boolean;
    onClose: () => void;
    onSave: (model: BusModel) => void;
    initialModel?: BusModel;
}

const BusModelForm: React.FC<BusModelFormProps> = ({
    visible,
    onClose,
    onSave,
    initialModel
}) => {
        const { t } = useLanguageSafe();
const [model, setModel] = useState<BusModel>(
        initialModel || {
            nom_modele: '',
            total_seats: 50,
            classe: 'Standard',
            prix_base: 10000,
            equipements: [],
            rows: 10,
            seatsPerRow: 4,
            firstRowSeats: 2,
        }
    );

    const [selectedEquipements, setSelectedEquipements] = useState<string[]>(
        initialModel?.equipements || []
    );

    const classeOptions = [t('busModelForm.economique'), 'Standard', 'VIP', 'Luxury'];
    const equipementOptions = [
        'WiFi',
        'Climatisation',
        'Toilettes',
        t('busModelForm.ecransTv'),
        t('busModelForm.priseElectrique'),
        t('busModelForm.eauMinerale'),
        'Snacks',
        'Couverture',
    ];

    const toggleEquipement = (equipement: string) => {
        setSelectedEquipements((prev) =>
            prev.includes(equipement)
                ? prev.filter((e) => e !== equipement)
                : [...prev, equipement]
        );
    };

    const calculateSeats = () => {
        if (model.rows && model.seatsPerRow && model.firstRowSeats) {
            const total = model.firstRowSeats + (model.rows - 1) * model.seatsPerRow;
            setModel({ ...model, total_seats: total });
        }
    };

    const handleSave = () => {
        if (!model.nom_modele.trim()) {
            Alert.alert('Erreur', t('busModelForm.leNomDuModeleEstObligatoire'));
            return;
        }

        if (model.total_seats <= 0) {
            Alert.alert('Erreur', t('busModelForm.leNombreDePlacesDoitEtre'));
            return;
        }

        if (model.prix_base <= 0) {
            Alert.alert('Erreur', t('busModelForm.lePrixDeBaseDoitEtre'));
            return;
        }

        onSave({
            ...model,
            equipements: selectedEquipements,
        });
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.backButton}>
                        <SafeIcon name="arrow-left" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>
                        {initialModel ? t('busModelForm.modifierLeModele') : t('busModelForm.nouveauModeleDeBus')}
                    </Text>
                </View>

                <ScrollView style={styles.content}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('busModelForm.nomDuModele')}</Text>
                        <TextInput
                            style={styles.input}
                            value={model.nom_modele}
                            onChangeText={(text) => setModel({ ...model, nom_modele: text })}
                            placeholder={t('busModelForm.exLuxuryVipStandardEconomique')}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Classe</Text>
                        <View style={styles.chipsContainer}>
                            {classeOptions.map((classe) => (
                                <TouchableOpacity
                                    key={classe}
                                    style={[
                                        styles.chip,
                                        model.classe === classe && styles.chipSelected,
                                    ]}
                                    onPress={() => setModel({ ...model, classe })}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            model.classe === classe && styles.chipTextSelected,
                                        ]}
                                    >
                                        {classe}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                            <Text style={styles.label}>{t('busModelForm.nombreDePlaces')}</Text>
                            <TextInput
                                style={styles.input}
                                value={model.total_seats.toString()}
                                onChangeText={(text) => {
                                    const seats = parseInt(text) || 0;
                                    setModel({ ...model, total_seats: seats });
                                }}
                                keyboardType="numeric"
                                placeholder="50"
                            />
                        </View>

                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.label}>{t('busModelForm.prixDeBaseFcfa')}</Text>
                            <TextInput
                                style={styles.input}
                                value={model.prix_base.toString()}
                                onChangeText={(text) => {
                                    const prix = parseInt(text) || 0;
                                    setModel({ ...model, prix_base: prix });
                                }}
                                keyboardType="numeric"
                                placeholder="10000"
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('busModelForm.configurationDesSiegesOptionnel')}</Text>
                        <Text style={styles.hint}>
                            Laissez vide pour configuration automatique
                        </Text>

                        <View style={styles.row}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                <Text style={styles.sublabel}>{t('busModelForm.nombreDeRangees')}</Text>
                                <TextInput
                                    style={styles.input}
                                    value={model.rows?.toString() || ''}
                                    onChangeText={(text) => {
                                        const rows = parseInt(text) || 0;
                                        setModel({ ...model, rows });
                                        if (rows && model.seatsPerRow && model.firstRowSeats) {
                                            setTimeout(calculateSeats, 100);
                                        }
                                    }}
                                    keyboardType="numeric"
                                    placeholder="10"
                                />
                            </View>

                            <View style={[styles.inputGroup, { flex: 1, marginLeft: 4, marginRight: 4 }]}>
                                <Text style={styles.sublabel}>{t('busModelForm.placesParRangee')}</Text>
                                <TextInput
                                    style={styles.input}
                                    value={model.seatsPerRow?.toString() || ''}
                                    onChangeText={(text) => {
                                        const seatsPerRow = parseInt(text) || 0;
                                        setModel({ ...model, seatsPerRow });
                                        if (model.rows && seatsPerRow && model.firstRowSeats) {
                                            setTimeout(calculateSeats, 100);
                                        }
                                    }}
                                    keyboardType="numeric"
                                    placeholder="4"
                                />
                            </View>

                            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                                <Text style={styles.sublabel}>{t('busModelForm.1ereRangee')}</Text>
                                <TextInput
                                    style={styles.input}
                                    value={model.firstRowSeats?.toString() || ''}
                                    onChangeText={(text) => {
                                        const firstRowSeats = parseInt(text) || 0;
                                        setModel({ ...model, firstRowSeats });
                                        if (model.rows && model.seatsPerRow && firstRowSeats) {
                                            setTimeout(calculateSeats, 100);
                                        }
                                    }}
                                    keyboardType="numeric"
                                    placeholder="2"
                                />
                            </View>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('busModelForm.equipements')}</Text>
                        <View style={styles.chipsContainer}>
                            {equipementOptions.map((equipement) => (
                                <TouchableOpacity
                                    key={equipement}
                                    style={[
                                        styles.chip,
                                        selectedEquipements.includes(equipement) &&
                                        styles.chipSelected,
                                    ]}
                                    onPress={() => toggleEquipement(equipement)}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            selectedEquipements.includes(equipement) &&
                                            styles.chipTextSelected,
                                        ]}
                                    >
                                        {equipement}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                        <Text style={styles.saveButtonText}>{t('busModelForm.enregistrerLeModele')}</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    sublabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#6B7280',
        marginBottom: 6,
    },
    hint: {
        fontSize: 12,
        color: '#9CA3AF',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#F9FAFB',
    },
    row: {
        flexDirection: 'row',
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
        borderColor: '#D1D5DB',
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
    saveButton: {
        backgroundColor: modernColors.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 40,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default BusModelForm;

