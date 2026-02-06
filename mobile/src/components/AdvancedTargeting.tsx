import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { NativeCard, NativeInput } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';

interface TargetingOptions {
    ageRange: { min: number; max: number };
    gender: 'all' | 'male' | 'female' | 'other';
    interests: string[];
    behaviors: string[];
    locations: string[];
}

interface AdvancedTargetingProps {
    targeting: TargetingOptions;
    onTargetingChange: (targeting: TargetingOptions) => void;
}

const INTERESTS = [
    'Immobilier', 'Automobile', 'Mode', 'Technologie', 'Voyage',
    'Alimentation', 'Sport', 'Beauté', 'Éducation', 'Santé',
];

const BEHAVIORS = [
    'Acheteurs fréquents', 'Nouveaux utilisateurs', 'Abandon panier',
    'Visiteurs récents', 'Clients VIP', 'Inactifs',
];

export const AdvancedTargeting: React.FC<AdvancedTargetingProps> = ({
    targeting,
    onTargetingChange,
}) => {
    const [expanded, setExpanded] = useState(false);

    const toggleInterest = (interest: string) => {
        const newInterests = targeting.interests.includes(interest)
            ? targeting.interests.filter(i => i !== interest)
            : [...targeting.interests, interest];
        onTargetingChange({ ...targeting, interests: newInterests });
    };

    const toggleBehavior = (behavior: string) => {
        const newBehaviors = targeting.behaviors.includes(behavior)
            ? targeting.behaviors.filter(b => b !== behavior)
            : [...targeting.behaviors, behavior];
        onTargetingChange({ ...targeting, behaviors: newBehaviors });
    };

    if (!expanded) {
        return (
            <TouchableOpacity
                style={styles.expandButton}
                onPress={() => setExpanded(true)}
            >
                <SafeIcon name="target" size={20} color={modernColors.primary} />
                <Text style={styles.expandText}>Ciblage avancé (optionnel)</Text>
                <SafeIcon name="chevron-right" size={16} color={modernColors.textSecondary} />
            </TouchableOpacity>
        );
    }

    return (
        <NativeCard style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>🎯 Ciblage avancé</Text>
                <TouchableOpacity onPress={() => setExpanded(false)}>
                    <SafeIcon name="x" size={20} color={modernColors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Tranche d'âge */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Âge</Text>
                <View style={styles.ageRow}>
                    <NativeInput
                        placeholder="Min"
                        value={targeting.ageRange.min.toString()}
                        onChangeText={(text) => {
                            const min = parseInt(text) || 18;
                            onTargetingChange({
                                ...targeting,
                                ageRange: { ...targeting.ageRange, min },
                            });
                        }}
                        keyboardType="numeric"
                        style={styles.ageInput}
                    />
                    <Text style={styles.ageSeparator}>-</Text>
                    <NativeInput
                        placeholder="Max"
                        value={targeting.ageRange.max.toString()}
                        onChangeText={(text) => {
                            const max = parseInt(text) || 65;
                            onTargetingChange({
                                ...targeting,
                                ageRange: { ...targeting.ageRange, max },
                            });
                        }}
                        keyboardType="numeric"
                        style={styles.ageInput}
                    />
                </View>
            </View>

            {/* Genre */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Genre</Text>
                <View style={styles.optionsRow}>
                    {['all', 'male', 'female', 'other'].map((gender) => (
                        <TouchableOpacity
                            key={gender}
                            style={[
                                styles.optionButton,
                                targeting.gender === gender && styles.optionButtonActive,
                            ]}
                            onPress={() => onTargetingChange({ ...targeting, gender: gender as any })}
                        >
                            <Text
                                style={[
                                    styles.optionText,
                                    targeting.gender === gender && styles.optionTextActive,
                                ]}
                            >
                                {gender === 'all' ? 'Tous' : gender === 'male' ? 'Homme' : gender === 'female' ? 'Femme' : 'Autre'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Intérêts */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Intérêts</Text>
                <View style={styles.tagsContainer}>
                    {INTERESTS.map((interest) => (
                        <TouchableOpacity
                            key={interest}
                            style={[
                                styles.tag,
                                targeting.interests.includes(interest) && styles.tagActive,
                            ]}
                            onPress={() => toggleInterest(interest)}
                        >
                            <Text
                                style={[
                                    styles.tagText,
                                    targeting.interests.includes(interest) && styles.tagTextActive,
                                ]}
                            >
                                {interest}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Comportements */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Comportements</Text>
                <View style={styles.tagsContainer}>
                    {BEHAVIORS.map((behavior) => (
                        <TouchableOpacity
                            key={behavior}
                            style={[
                                styles.tag,
                                targeting.behaviors.includes(behavior) && styles.tagActive,
                            ]}
                            onPress={() => toggleBehavior(behavior)}
                        >
                            <Text
                                style={[
                                    styles.tagText,
                                    targeting.behaviors.includes(behavior) && styles.tagTextActive,
                                ]}
                            >
                                {behavior}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* ✅ NOUVEAU: Zones géographiques */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>📍 Zones géographiques</Text>
                <Text style={styles.sectionHint}>
                    Sélectionnez les zones spécifiques pour cibler votre publicité
                </Text>
                <View style={styles.tagsContainer}>
                    {[
                        'Douala', 'Yaoundé', 'Abidjan', 'Dakar', 'Bamako',
                        'Ouagadougou', 'Niamey', 'Lomé', 'Cotonou', 'Kinshasa',
                        'Brazzaville', 'Libreville', 'Bangui', 'N\'Djamena', 'Autre'
                    ].map((location) => (
                        <TouchableOpacity
                            key={location}
                            style={[
                                styles.tag,
                                targeting.locations.includes(location) && styles.tagActive,
                            ]}
                            onPress={() => {
                                const newLocations = targeting.locations.includes(location)
                                    ? targeting.locations.filter(l => l !== location)
                                    : [...targeting.locations, location];
                                onTargetingChange({ ...targeting, locations: newLocations });
                            }}
                        >
                            <Text
                                style={[
                                    styles.tagText,
                                    targeting.locations.includes(location) && styles.tagTextActive,
                                ]}
                            >
                                {location}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
                {targeting.locations.length > 0 && (
                    <View style={styles.selectedLocations}>
                        <Text style={styles.selectedLocationsLabel}>
                            Zones sélectionnées ({targeting.locations.length}):
                        </Text>
                        <Text style={styles.selectedLocationsText}>
                            {targeting.locations.join(', ')}
                        </Text>
                    </View>
                )}
            </View>
        </NativeCard>
    );
};

const styles = StyleSheet.create({
    expandButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
        marginBottom: 16,
    },
    expandText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    container: {
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    ageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    ageInput: {
        flex: 1,
    },
    ageSeparator: {
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    optionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    optionButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    optionButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    optionText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
    },
    optionTextActive: {
        color: '#fff',
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    tagActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    tagText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
    },
    tagTextActive: {
        color: '#fff',
    },
    sectionHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 12,
        lineHeight: 16,
    },
    selectedLocations: {
        marginTop: 12,
        padding: 12,
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 8,
    },
    selectedLocationsLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    selectedLocationsText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        lineHeight: 18,
    },
});

