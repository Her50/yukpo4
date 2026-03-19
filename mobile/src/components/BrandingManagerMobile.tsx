import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import ReactNative from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

const { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, Image: RNImage } = ReactNative;

interface BrandingManagerMobileProps {
    logo: string[];
    banner: string[];
    onLogoChange: (logo: string[]) => void;
    onBannerChange: (banner: string[]) => void;
    readonly?: boolean;
}

const BrandingManagerMobile: React.FC<BrandingManagerMobileProps> = ({
    logo,
    banner,
    onLogoChange,
    onBannerChange,
    readonly = false
}) => {
    const [showImagePreview, setShowImagePreview] = useState<string | null>(null);

    const pickImage = async (type: 'logo' | 'banner') => {
        try {
            // ✅ CORRECTION: Timeout pour les permissions
            const permissionPromise = ImagePicker.requestMediaLibraryPermissionsAsync();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Permission timeout')), 10000)
            );

            const permissionResult = await Promise.race([permissionPromise, timeoutPromise]) as any;

            if (!permissionResult.granted) {
                Alert.alert(
                    'Permission refusée',
                    'Vous devez autoriser l\'accès à la galerie pour ajouter des images'
                );
                return;
            }

            // ✅ CORRIGÉ: Utiliser 'images' as any pour compatibilité avec toutes les versions d'expo-image-picker
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images' as any,
                allowsMultipleSelection: false,
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets && result.assets[0]) {
                const newImage = result.assets[0].base64
                    ? `data:image/jpeg;base64,${result.assets[0].base64}`
                    : '';

                if (newImage) {
                    if (type === 'logo') {
                        onLogoChange([newImage]);
                    } else {
                        onBannerChange([newImage]);
                    }
                }
            }
        } catch (error) {
            console.error('Erreur sélection image:', error);
            // ✅ CORRECTION: Gestion d'erreur plus douce
            if (error.message === 'Permission timeout') {
                console.warn('Timeout permission galerie - continuer sans image');
            } else {
                Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
            }
        }
    };

    const removeImage = (type: 'logo' | 'banner') => {
        if (type === 'logo') {
            onLogoChange([]);
        } else {
            onBannerChange([]);
        }
    };

    if (readonly) {
        return (
            <View style={styles.readonlyContainer}>
                <Text style={styles.readonlyText}>Identité visuelle (lecture seule)</Text>
                <View style={styles.readonlyGrid}>
                    {logo.length > 0 && (
                        <View style={styles.readonlyItem}>
                            <SafeIcon name="image" size={20} color="#3B82F6" />
                            <Text style={styles.readonlyLabel}>Logo</Text>
                        </View>
                    )}
                    {banner.length > 0 && (
                        <View style={styles.readonlyItem}>
                            <SafeIcon name="image" size={20} color="#8B5CF6" />
                            <Text style={styles.readonlyLabel}>Bannière</Text>
                        </View>
                    )}
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Identité Visuelle</Text>
            <Text style={styles.subtitle}>Logo et bannière de votre service</Text>

            {/* Logo */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <SafeIcon name="star" size={20} color="#3B82F6" />
                    <Text style={styles.sectionTitle}>Logo</Text>
                </View>

                {logo.length === 0 ? (
                    <TouchableOpacity
                        style={[styles.uploadButton, { borderColor: '#3B82F6' }]}
                        onPress={() => pickImage('logo')}
                    >
                        <SafeIcon name="upload" size={32} color="#3B82F6" />
                        <Text style={[styles.uploadText, { color: '#3B82F6' }]}>Télécharger le logo</Text>
                        <Text style={styles.uploadHint}>Format carré recommandé</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.previewContainer}>
                        <TouchableOpacity
                            style={styles.imagePreview}
                            onPress={() => setShowImagePreview(logo[0])}
                        >
                            <RNImage source={{ uri: logo[0] }} style={styles.logoImage} />
                        </TouchableOpacity>
                        <View style={styles.imageActions}>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.changeButton]}
                                onPress={() => pickImage('logo')}
                            >
                                <SafeIcon name="edit-2" size={16} color="#3B82F6" />
                                <Text style={styles.changeButtonText}>Modifier</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.deleteButton]}
                                onPress={() => removeImage('logo')}
                            >
                                <SafeIcon name="trash-2" size={16} color="#EF4444" />
                                <Text style={styles.deleteButtonText}>Supprimer</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {/* Bannière */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <SafeIcon name="flag" size={20} color="#8B5CF6" />
                    <Text style={styles.sectionTitle}>Bannière</Text>
                </View>

                {banner.length === 0 ? (
                    <TouchableOpacity
                        style={[styles.uploadButton, { borderColor: '#8B5CF6' }]}
                        onPress={() => pickImage('banner')}
                    >
                        <SafeIcon name="upload" size={32} color="#8B5CF6" />
                        <Text style={[styles.uploadText, { color: '#8B5CF6' }]}>Télécharger la bannière</Text>
                        <Text style={styles.uploadHint}>Format rectangle recommandé (16:9)</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.previewContainer}>
                        <TouchableOpacity
                            style={styles.imagePreview}
                            onPress={() => setShowImagePreview(banner[0])}
                        >
                            <RNImage source={{ uri: banner[0] }} style={styles.bannerImage} />
                        </TouchableOpacity>
                        <View style={styles.imageActions}>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.changeButton]}
                                onPress={() => pickImage('banner')}
                            >
                                <SafeIcon name="edit-2" size={16} color="#8B5CF6" />
                                <Text style={styles.changeButtonText}>Modifier</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.deleteButton]}
                                onPress={() => removeImage('banner')}
                            >
                                <SafeIcon name="trash-2" size={16} color="#EF4444" />
                                <Text style={styles.deleteButtonText}>Supprimer</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {/* Conseil */}
            <View style={styles.hintBox}>
                <Text style={styles.hintText}>
                    💡 <Text style={styles.hintBold}>Conseil :</Text> Un logo professionnel et une belle bannière renforcent votre identité de marque
                </Text>
            </View>

            {/* Modal de prévisualisation */}
            {showImagePreview && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setShowImagePreview(null)}
                        >
                            <SafeIcon name="x" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                        <RNImage
                            source={{ uri: showImagePreview }}
                            style={styles.modalImage}
                            resizeMode="contain"
                        />
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 16,
    },
    section: {
        marginBottom: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    uploadButton: {
        borderWidth: 2,
        borderStyle: 'dashed',
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
        backgroundColor: modernColors.surface,
    },
    uploadText: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 8,
    },
    uploadHint: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    previewContainer: {
        gap: 12,
    },
    imagePreview: {
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: modernColors.background,
    },
    logoImage: {
        width: '100%',
        height: 200,
        resizeMode: 'contain',
    },
    bannerImage: {
        width: '100%',
        height: 150,
        resizeMode: 'cover',
    },
    imageActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
    },
    changeButton: {
        backgroundColor: '#EFF6FF',
        borderColor: '#3B82F6',
    },
    changeButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#3B82F6',
    },
    deleteButton: {
        backgroundColor: '#FEF2F2',
        borderColor: '#EF4444',
    },
    deleteButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#EF4444',
    },
    hintBox: {
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
        padding: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#3B82F6',
        marginTop: 12,
    },
    hintText: {
        fontSize: 12,
        color: modernColors.text,
        lineHeight: 16,
    },
    hintBold: {
        fontWeight: '600',
        color: '#3B82F6',
    },
    readonlyContainer: {
        padding: 16,
        backgroundColor: modernColors.surface,
        borderRadius: 12,
    },
    readonlyText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    readonlyGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    readonlyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: modernColors.background,
        borderRadius: 8,
    },
    readonlyLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    modalContainer: {
        width: '90%',
        height: '80%',
        position: 'relative',
    },
    modalCloseButton: {
        position: 'absolute',
        top: -40,
        right: 0,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
    },
    modalImage: {
        width: '100%',
        height: '100%',
    },
});

export default BrandingManagerMobile;

