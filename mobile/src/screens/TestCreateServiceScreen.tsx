import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TextInput } from 'react-native-paper';
import { theme } from '../theme/theme';

const TestCreateServiceScreen: React.FC = () => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: '',
        price: '',
    });

    const categories = [
        'Coiffure',
        'Beauté',
        'Réparation',
        'Nettoyage',
        'Transport',
        'Cuisine',
        'Éducation',
        'Autre',
    ];

    const handleSubmit = () => {
        if (!formData.title || !formData.description || !formData.category) {
            Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
            return;
        }

        Alert.alert('Succès', 'Service créé avec succès !');
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>➕ Créer un Service</Text>
                <Text style={styles.subtitle}>Formulaire de test simplifié</Text>
            </View>

            <View style={styles.form}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Titre du service *</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.title}
                        onChangeText={(text) => setFormData({ ...formData, title: text })}
                        placeholder="Ex: Coiffure à domicile"
                        mode="outlined"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Description *</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.description}
                        onChangeText={(text) => setFormData({ ...formData, description: text })}
                        placeholder="Décrivez votre service..."
                        mode="outlined"
                        multiline
                        numberOfLines={4}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Catégorie *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
                        {categories.map((category) => (
                            <TouchableOpacity
                                key={category}
                                style={[
                                    styles.categoryChip,
                                    formData.category === category && styles.categoryChipSelected
                                ]}
                                onPress={() => setFormData({ ...formData, category })}
                            >
                                <Text style={[
                                    styles.categoryText,
                                    formData.category === category && styles.categoryTextSelected
                                ]}>
                                    {category}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Prix (XAF)</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.price}
                        onChangeText={(text) => setFormData({ ...formData, price: text })}
                        placeholder="Ex: 5000"
                        mode="outlined"
                        keyboardType="numeric"
                    />
                </View>

                <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                    <Text style={styles.submitButtonText}>Créer le Service</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        backgroundColor: theme.colors.primary,
        padding: 20,
        paddingTop: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.9)',
    },
    form: {
        padding: 16,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 8,
    },
    input: {
        backgroundColor: 'white',
    },
    categoriesContainer: {
        flexDirection: 'row',
    },
    categoryChip: {
        backgroundColor: 'white',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    categoryChipSelected: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    categoryText: {
        color: '#6B7280',
        fontSize: 14,
    },
    categoryTextSelected: {
        color: 'white',
    },
    submitButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
    },
    submitButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default TestCreateServiceScreen;






