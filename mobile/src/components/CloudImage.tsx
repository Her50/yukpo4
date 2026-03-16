/**
 * Composant pour afficher une image depuis le cloud
 * Gère automatiquement le téléchargement, la mise en cache et l'affichage
 */

import React from 'react';
import { 
    Image, 
    ImageProps, 
    View, 
    ActivityIndicator, 
    StyleSheet, 
    Text 
} from 'react-native';
import { useCloudFile } from '../hooks/useCloudFiles';
import { modernColors } from '../theme/modernTheme';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface CloudImageProps extends Omit<ImageProps, 'source'> {
    cloudUrl: string | null | undefined;
    fallback?: React.ReactNode;
    showLoader?: boolean;
    showError?: boolean;
    loaderColor?: string;
    resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
}

/**
 * Composant CloudImage
 * Utilisation : <CloudImage cloudUrl="https://..." style={styles.image} />
 */
export const CloudImage: React.FC<CloudImageProps> = ({
    cloudUrl,
    fallback,
    showLoader = true,
    showError = true,
    loaderColor = modernColors.primary,
    resizeMode = 'cover',
    style,
    ...imageProps
}) => {
    const { localUri, isDownloading, error } = useCloudFile(cloudUrl, {
        autoDownload: true,
        asBase64: true,
        useCache: true
    });

    // État de chargement
    if (isDownloading && showLoader) {
        return (
            <View style={[styles.container, style]}>
                <ActivityIndicator size="small" color={loaderColor} />
            </View>
        );
    }

    // État d'erreur
    if (error && showError) {
        if (fallback) {
            return <>{fallback}</>;
        }
        return (
            <View style={[styles.container, styles.errorContainer, style]}>
                <Text style={styles.errorIcon}>🖼️</Text>
                <Text style={styles.errorText}>{t('cloudImage.imageIndisponible')}/Text>
            </View>
        );
    }

    // Pas d'URL
    if (!localUri) {
        if (fallback) {
            return <>{fallback}</>;
        }
        return (
            <View style={[styles.container, styles.placeholderContainer, style]}>
                <Text style={styles.placeholderIcon}>📷</Text>
            </View>
        );
    }

    // Afficher l'image
    return (
        <Image
            {...imageProps}
            source={{ uri: localUri }}
            style={style}
            resizeMode={resizeMode}
        />
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: modernColors.background,
    },
    errorContainer: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        borderStyle: 'dashed',
    },
    errorIcon: {
        fontSize: 32,
        marginBottom: 4,
    },
    errorText: {
        fontSize: 10,
        color: '#DC2626',
    },
    placeholderContainer: {
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    placeholderIcon: {
        fontSize: 48,
        opacity: 0.3,
    },
});

export default CloudImage;

