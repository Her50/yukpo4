/**
 * P1 - Upload ordonnance (photo)
 * Permet de prendre une photo ou choisir depuis la galerie, puis envoyer à la pharmacie
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { pharmacyService } from '../../services/pharmacyService';
import { modernColors } from '../../theme/modernTheme';

interface RouteParams {
    pharmacyId: number;
    pharmacyName: string;
}

const OrdonnanceUploadScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { t } = useLanguageSafe();
    const { pharmacyId, pharmacyName } = (route.params as RouteParams) || {};

    const [imageUri, setImageUri] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    const pickFromGallery = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission refusée', 'L\'accès à la galerie est nécessaire.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            allowsEditing: true,
        });
        if (!result.canceled && result.assets.length > 0) {
            setImageUri(result.assets[0].uri);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission refusée', 'L\'accès à la caméra est nécessaire.');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            allowsEditing: true,
        });
        if (!result.canceled && result.assets.length > 0) {
            setImageUri(result.assets[0].uri);
        }
    };

    const handleUpload = async () => {
        if (!imageUri) {
            Alert.alert('Aucune image', 'Veuillez sélectionner ou prendre une photo de votre ordonnance.');
            return;
        }
        setUploading(true);
        try {
            const response = await pharmacyService.uploadOrdonnance(pharmacyId, imageUri);
            if (response.success) {
                Alert.alert('Succès', 'Votre ordonnance a été envoyée à la pharmacie.', [
                    { text: 'OK', onPress: () => navigation.goBack() },
                ]);
            } else {
                Alert.alert('Erreur', response.error || 'Impossible d\'envoyer l\'ordonnance.');
            }
        } catch (error: any) {
            Alert.alert('Erreur', error.message || 'Une erreur est survenue.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* En-tête */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <SafeIcon name="arrow-left" size={20} color={modernColors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>Envoyer une ordonnance</Text>
            </View>

            {pharmacyName ? (
                <View style={styles.pharmacyBadge}>
                    <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
                    <Text style={styles.pharmacyName}>{pharmacyName}</Text>
                </View>
            ) : null}

            {/* Instructions */}
            <View style={styles.infoBox}>
                <SafeIcon name="info" size={16} color="#3B82F6" />
                <Text style={styles.infoText}>
                    Prenez une photo claire de votre ordonnance. La pharmacie la recevra et préparera vos médicaments.
                </Text>
            </View>

            {/* Boutons de sélection */}
            {!imageUri && (
                <View style={styles.optionsRow}>
                    <TouchableOpacity style={styles.optionCard} onPress={takePhoto}>
                        <SafeIcon name="camera" size={36} color={modernColors.primary} />
                        <Text style={styles.optionLabel}>Prendre une photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.optionCard} onPress={pickFromGallery}>
                        <SafeIcon name="image" size={36} color="#10B981" />
                        <Text style={styles.optionLabel}>Depuis la galerie</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Aperçu de la photo */}
            {imageUri && (
                <View style={styles.previewContainer}>
                    <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
                    <TouchableOpacity
                        style={styles.changePhotoBtn}
                        onPress={() => setImageUri(null)}
                    >
                        <SafeIcon name="refresh-cw" size={16} color={modernColors.primary} />
                        <Text style={styles.changePhotoText}>Changer la photo</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Bouton d'envoi */}
            {imageUri && (
                <TouchableOpacity
                    style={[styles.sendButton, uploading && styles.sendButtonDisabled]}
                    onPress={handleUpload}
                    disabled={uploading}
                >
                    {uploading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <SafeIcon name="send" size={20} color="#fff" />
                            <Text style={styles.sendButtonText}>Envoyer à la pharmacie</Text>
                        </>
                    )}
                </TouchableOpacity>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        paddingTop: 8,
    },
    backBtn: {
        padding: 8,
        marginRight: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.textPrimary,
    },
    pharmacyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        padding: 10,
        borderRadius: 8,
        marginBottom: 16,
        gap: 6,
    },
    pharmacyName: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: '#EFF6FF',
        padding: 12,
        borderRadius: 8,
        marginBottom: 24,
        gap: 8,
        alignItems: 'flex-start',
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: '#1E40AF',
        lineHeight: 20,
    },
    optionsRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 24,
    },
    optionCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    optionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textPrimary,
        textAlign: 'center',
    },
    previewContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    preview: {
        width: '100%',
        height: 280,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
    },
    changePhotoBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        gap: 6,
    },
    changePhotoText: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '600',
    },
    sendButton: {
        backgroundColor: modernColors.primary,
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    sendButtonDisabled: {
        opacity: 0.7,
    },
    sendButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default OrdonnanceUploadScreen;
