// ✅ Page de recherche d'offres d'emploi (Mobile)
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeButton, NativeCard } from '../../components/NativeDesign';
import { modernColors } from '../../theme/modernTheme';

const OffreSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const [secteur, setSecteur] = useState('');
    const [typeContrat, setTypeContrat] = useState<string[]>([]);
    const [salaireMin, setSalaireMin] = useState('');
    const [lieuTravail, setLieuTravail] = useState('');
    const [remote, setRemote] = useState(false);

    const secteurs = [
        'Informatique', 'Commerce', 'Santé', 'Éducation', 'Finance',
        'Marketing', 'Ressources Humaines', 'Ingénierie', 'Design', 'Autre'
    ];

    const typesContrat = ['CDI', 'CDD', 'Stage', 'Freelance', 'Temps partiel', 'Alternance'];

    const toggleTypeContrat = (type: string) => {
        setTypeContrat(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const handleSearch = () => {
        const filters: any = {};
        if (secteur) filters.secteur = secteur;
        if (typeContrat.length > 0) filters.type_contrat = typeContrat;
        if (salaireMin) filters.salaire_min = parseFloat(salaireMin);
        if (lieuTravail) filters.lieu_travail = lieuTravail;
        if (remote) filters.remote = true;

        (navigation as any).navigate('OffreList', { filters });
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.title}>Rechercher une offre</Text>

            <NativeCard style={styles.card}>
                {/* Secteur */}
                <View style={styles.field}>
                    <Text style={styles.label}>Secteur d'activité</Text>
                    <View style={styles.pickerContainer}>
                        {secteurs.map((s) => (
                            <TouchableOpacity
                                key={s}
                                style={[
                                    styles.pickerOption,
                                    secteur === s && styles.pickerOptionSelected,
                                ]}
                                onPress={() => setSecteur(secteur === s ? '' : s)}
                            >
                                <Text
                                    style={[
                                        styles.pickerOptionText,
                                        secteur === s && styles.pickerOptionTextSelected,
                                    ]}
                                >
                                    {s}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Type de contrat */}
                <View style={styles.field}>
                    <Text style={styles.label}>Type de contrat</Text>
                    <View style={styles.chipContainer}>
                        {typesContrat.map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[
                                    styles.chip,
                                    typeContrat.includes(type) && styles.chipSelected,
                                ]}
                                onPress={() => toggleTypeContrat(type)}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        typeContrat.includes(type) && styles.chipTextSelected,
                                    ]}
                                >
                                    {type}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Salaire minimum */}
                <View style={styles.field}>
                    <Text style={styles.label}>Salaire minimum (XAF)</Text>
                    <TextInput
                        style={styles.input}
                        value={salaireMin}
                        onChangeText={setSalaireMin}
                        placeholder="Ex: 100000"
                        keyboardType="numeric"
                    />
                </View>

                {/* Lieu de travail */}
                <View style={styles.field}>
                    <Text style={styles.label}>Lieu de travail</Text>
                    <TextInput
                        style={styles.input}
                        value={lieuTravail}
                        onChangeText={setLieuTravail}
                        placeholder="Ex: Douala, Yaoundé"
                    />
                </View>

                {/* Remote */}
                <View style={styles.field}>
                    <View style={styles.switchRow}>
                        <Text style={styles.label}>Télétravail possible</Text>
                        <Switch
                            value={remote}
                            onValueChange={setRemote}
                            trackColor={{ false: '#767577', true: modernColors.primary }}
                        />
                    </View>
                </View>

                <NativeButton
                    title="Rechercher"
                    onPress={handleSearch}
                    style={styles.searchButton}
                />
            </NativeCard>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    scrollContent: {
        padding: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 24,
    },
    card: {
        padding: 16,
    },
    field: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: modernColors.text,
        backgroundColor: modernColors.surface,
    },
    pickerContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    pickerOption: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    pickerOptionSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    pickerOptionText: {
        color: modernColors.text,
        fontSize: 14,
    },
    pickerOptionTextSelected: {
        color: '#FFFFFF',
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    chipSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    chipText: {
        color: modernColors.text,
        fontSize: 14,
    },
    chipTextSelected: {
        color: '#FFFFFF',
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    searchButton: {
        marginTop: 8,
    },
});

export default OffreSearchScreen;

