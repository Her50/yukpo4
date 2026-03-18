/**
 * Composant pour permettre au client de choisir ses options avant de commander
 */
import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TextInput,
    StyleSheet,
} from 'react-native';
import SafeIcon from '../../../components/SafeIcon';

interface ClientOption {
    id: string;
    label: string;
    icon: string;
    selected: boolean;
}

interface ClientOptionsSelectorProps {
    availableOptions: string[];
    onOptionsSelected: (options: string[]) => void;
    onDestinationSet: (destination: string) => void;
    onNotesAdded: (notes: string) => void;
}

const ClientOptionsSelector: React.FC<ClientOptionsSelectorProps> = ({
    availableOptions,
    onOptionsSelected,
    onDestinationSet,
    onNotesAdded,
}) => {
    const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
    const [destination, setDestination] = useState('');
    const [specialNotes, setSpecialNotes] = useState('');

    const toggleOption = (option: string) => {
        const newSelected = new Set(selectedOptions);
        if (newSelected.has(option)) {
            newSelected.delete(option);
        } else {
            newSelected.add(option);
        }
        setSelectedOptions(newSelected);
        onOptionsSelected(Array.from(newSelected));
    };

    const handleDestinationChange = (text: string) => {
        setDestination(text);
        onDestinationSet(text);
    };

    const handleNotesChange = (text: string) => {
        setSpecialNotes(text);
        onNotesAdded(text);
    };

    const getIconForOption = (option: string): string => {
        if (option.includes('Climatisation')) return 'wind';
        if (option.includes('Wifi')) return 'wifi';
        if (option.includes('Chargeur')) return 'battery-charging';
        if (option.includes('Eau')) return 'droplet';
        if (option.includes('Musique')) return 'music';
        if (option.includes('Silence')) return 'volume-x';
        if (option.includes('Coffre')) return 'package';
        if (option.includes('Siège bébé')) return 'baby';
        return 'check-circle';
    };

    return (
        <ScrollView style={styles.container}>
            {/* Destination */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <SafeIcon name="map-pin" size={20} color="#F59E0B" />
                    <Text style={styles.sectionTitle}>\uD83D\uDCCD Destination</Text>
                </View>
                <TextInput
                    style={styles.input}
                    placeholder="Entrez votre destination..."
                    value={destination}
                    onChangeText={handleDestinationChange}
                    multiline
                />
                <Text style={styles.hint}>
                    \uD83D\uDCA1 Soyez précis (quartier, rue, point de repère)
                </Text>
            </View>

            {/* Options de confort */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <SafeIcon name="star" size={20} color="#F59E0B" />
                    <Text style={styles.sectionTitle}>⭐ Options souhaitées</Text>
                </View>
                <Text style={styles.sectionSubtitle}>
                    Sélectionnez les options que vous souhaitez
                </Text>
                <View style={styles.optionsGrid}>
                    {availableOptions.map((option, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[
                                styles.optionCard,
                                selectedOptions.has(option) && styles.optionCardSelected,
                            ]}
                            onPress={() => toggleOption(option)}
                        >
                            <SafeIcon
                                name={getIconForOption(option)}
                                size={20}
                                color={selectedOptions.has(option) ? '#F59E0B' : '#6B7280'}
                            />
                            <Text style={[
                                styles.optionLabel,
                                selectedOptions.has(option) && styles.optionLabelSelected,
                            ]}>
                                {option}
                            </Text>
                            {selectedOptions.has(option) && (
                                <SafeIcon name="check-circle" size={16} color="#F59E0B" />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Notes spéciales */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <SafeIcon name="file-text" size={20} color="#F59E0B" />
                    <Text style={styles.sectionTitle}>\uD83D\uDCDD Notes spéciales</Text>
                </View>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Instructions particulières (ex: bagages, nombre de passagers...)"
                    value={specialNotes}
                    onChangeText={handleNotesChange}
                    multiline
                    numberOfLines={4}
                />
            </View>

            {/* Résumé */}
            {(selectedOptions.size > 0 || destination || specialNotes) && (
                <View style={styles.summary}>
                    <Text style={styles.summaryTitle}>✅ Votre demande</Text>
                    
                    {destination && (
                        <View style={styles.summaryItem}>
                            <SafeIcon name="map-pin" size={14} color="#10B981" />
                            <Text style={styles.summaryText}>Destination: {destination}</Text>
                        </View>
                    )}
                    
                    {selectedOptions.size > 0 && (
                        <View style={styles.summaryItem}>
                            <SafeIcon name="star" size={14} color="#10B981" />
                            <Text style={styles.summaryText}>
                                {selectedOptions.size} option{selectedOptions.size > 1 ? 's' : ''} sélectionnée{selectedOptions.size > 1 ? 's' : ''}
                            </Text>
                        </View>
                    )}
                    
                    {specialNotes && (
                        <View style={styles.summaryItem}>
                            <SafeIcon name="file-text" size={14} color="#10B981" />
                            <Text style={styles.summaryText}>Notes ajoutées</Text>
                        </View>
                    )}
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 10,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
    },
    sectionSubtitle: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 12,
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 14,
        color: '#1F2937',
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    hint: {
        fontSize: 12,
        color: '#92400E',
        backgroundColor: '#FEF3C7',
        padding: 10,
        borderRadius: 8,
        marginTop: 8,
    },
    optionsGrid: {
        gap: 10,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 15,
        gap: 12,
    },
    optionCardSelected: {
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
    },
    optionLabel: {
        fontSize: 14,
        color: '#6B7280',
        flex: 1,
    },
    optionLabelSelected: {
        color: '#92400E',
        fontWeight: '500',
    },
    summary: {
        backgroundColor: '#ECFDF5',
        borderRadius: 12,
        padding: 15,
        marginBottom: 20,
        gap: 12,
    },
    summaryTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#059669',
        marginBottom: 4,
    },
    summaryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    summaryText: {
        fontSize: 13,
        color: '#047857',
    },
});

export default ClientOptionsSelector;

