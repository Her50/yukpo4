import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import {
    Button,
    Card,
    Divider,
    Menu,
    Paragraph,
    Text,
    TextInput,
    Title
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocation } from '../../contexts/LocationContext';
import { serviceService } from '../../services/api';

const CreateServiceScreen = () => {
    const navigation = useNavigation();
    const { location } = useLocation();

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        category: '',
        price: '',
        phone: '',
        email: '',
        address: '',
    });

    const [images, setImages] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);

    const categories = [
        'Coiffure', 'Restaurant', 'Transport', 'Santé', 'Éducation',
        'Technologie', 'Immobilier', 'Automobile', 'Mode', 'Sport'
    ];

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleImagePicker = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.8,
            });

            if (!result.canceled) {
                const newImages = result.assets.map(asset => asset.uri);
                setImages(prev => [...prev, ...newImages]);
            }
        } catch (error) {
            console.error('Erreur lors de la sélection d\'images:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner les images');
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.description || !formData.category) {
            Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
            return;
        }

        try {
            setLoading(true);

            const serviceData = {
                ...formData,
                price: formData.price ? parseFloat(formData.price) : null,
                location: location ? {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    address: formData.address || location.address,
                } : null,
                images,
            };

            await serviceService.createService(serviceData);

            Alert.alert(
                'Succès',
                'Votre service a été créé avec succès',
                [
                    { text: 'OK', onPress: () => navigation.goBack() }
                ]
            );
        } catch (error) {
            console.error('Erreur lors de la création du service:', error);
            Alert.alert('Erreur', 'Impossible de créer le service');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoidingView}
            >
                <ScrollView style={styles.scrollView}>
                    <View style={styles.header}>
                        <Title style={styles.title}>Créer un service</Title>
                        <Paragraph style={styles.subtitle}>
                            Remplissez les informations de votre service
                        </Paragraph>
                    </View>

                    <Card style={styles.card}>
                        <Card.Content>
                            {/* Service Name */}
                            <TextInput
                                label="Nom du service *"
                                value={formData.name}
                                onChangeText={(value) => handleInputChange('name', value)}
                                mode="outlined"
                                style={styles.input}
                            />

                            {/* Category */}
                            <Menu
                                visible={categoryMenuVisible}
                                onDismiss={() => setCategoryMenuVisible(false)}
                                anchor={
                                    <Button
                                        mode="outlined"
                                        onPress={() => setCategoryMenuVisible(true)}
                                        style={styles.categoryButton}
                                    >
                                        {formData.category || 'Sélectionner une catégorie *'}
                                    </Button>
                                }
                            >
                                {categories.map((category) => (
                                    <Menu.Item
                                        key={category}
                                        onPress={() => {
                                            handleInputChange('category', category);
                                            setCategoryMenuVisible(false);
                                        }}
                                        title={category}
                                    />
                                ))}
                            </Menu>

                            {/* Description */}
                            <TextInput
                                label="Description *"
                                value={formData.description}
                                onChangeText={(value) => handleInputChange('description', value)}
                                mode="outlined"
                                multiline
                                numberOfLines={4}
                                style={styles.input}
                            />

                            {/* Price */}
                            <TextInput
                                label="Prix (FCFA)"
                                value={formData.price}
                                onChangeText={(value) => handleInputChange('price', value)}
                                mode="outlined"
                                keyboardType="numeric"
                                style={styles.input}
                            />

                            <Divider style={styles.divider} />

                            {/* Contact Information */}
                            <Title style={styles.sectionTitle}>Informations de contact</Title>

                            <TextInput
                                label="Téléphone"
                                value={formData.phone}
                                onChangeText={(value) => handleInputChange('phone', value)}
                                mode="outlined"
                                keyboardType="phone-pad"
                                style={styles.input}
                            />

                            <TextInput
                                label="Email"
                                value={formData.email}
                                onChangeText={(value) => handleInputChange('email', value)}
                                mode="outlined"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                style={styles.input}
                            />

                            <TextInput
                                label="Adresse"
                                value={formData.address}
                                onChangeText={(value) => handleInputChange('address', value)}
                                mode="outlined"
                                multiline
                                numberOfLines={2}
                                style={styles.input}
                            />

                            <Divider style={styles.divider} />

                            {/* Images */}
                            <Title style={styles.sectionTitle}>Images</Title>

                            <Button
                                mode="outlined"
                                onPress={handleImagePicker}
                                icon="camera"
                                style={styles.imageButton}
                            >
                                Ajouter des images
                            </Button>

                            {images.length > 0 && (
                                <View style={styles.imagesContainer}>
                                    {images.map((image, index) => (
                                        <View key={index} style={styles.imageItem}>
                                            <Text style={styles.imageText}>Image {index + 1}</Text>
                                            <Button
                                                mode="text"
                                                onPress={() => removeImage(index)}
                                                textColor="#dc2626"
                                                compact
                                            >
                                                Supprimer
                                            </Button>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Location Info */}
                            {location && (
                                <View style={styles.locationInfo}>
                                    <Text style={styles.locationLabel}>Localisation actuelle:</Text>
                                    <Text style={styles.locationText}>
                                        {location.city}, {location.country}
                                    </Text>
                                </View>
                            )}

                            {/* Submit Button */}
                            <Button
                                mode="contained"
                                onPress={handleSubmit}
                                loading={loading}
                                disabled={loading}
                                style={styles.submitButton}
                            >
                                Créer le service
                            </Button>
                        </Card.Content>
                    </Card>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    header: {
        padding: 20,
        paddingBottom: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#64748b',
    },
    card: {
        margin: 20,
        marginTop: 10,
        elevation: 2,
    },
    input: {
        marginBottom: 16,
    },
    categoryButton: {
        marginBottom: 16,
        justifyContent: 'flex-start',
    },
    divider: {
        marginVertical: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 12,
    },
    imageButton: {
        marginBottom: 16,
    },
    imagesContainer: {
        marginBottom: 16,
    },
    imageItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        marginBottom: 8,
    },
    imageText: {
        fontSize: 14,
        color: '#64748b',
    },
    locationInfo: {
        backgroundColor: '#dbeafe',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    locationLabel: {
        fontSize: 12,
        color: '#1e40af',
        fontWeight: 'bold',
        marginBottom: 4,
    },
    locationText: {
        fontSize: 14,
        color: '#1e40af',
    },
    submitButton: {
        marginTop: 16,
    },
});

export default CreateServiceScreen;

