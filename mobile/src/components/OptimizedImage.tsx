/**
 * Composant Image optimisé niveau géant (Instagram/TikTok style)
 * Support WebP/AVIF, BlurHash, lazy loading, CDN optimization
 */

import { BlurView } from 'expo-blur';
import React from 'react';
import { ActivityIndicator, Image, ImageProps, StyleSheet, View } from 'react-native';

// Essayer d'importer expo-image si disponible
let ExpoImage: any = null;
try {
    ExpoImage = require('expo-image').Image;
} catch (error) {
    // expo-image n'est pas disponible, on utilisera Image standard
    console.log('[OptimizedImage] expo-image non disponible, utilisation de Image standard');
}

interface OptimizedImageProps extends Omit<ImageProps, 'source'> {
    uri: string;
    placeholder?: string;
    fallback?: string;
    blurHash?: string; // ✅ GÉANT-LEVEL: BlurHash pour placeholder premium
    webp?: boolean; // ✅ GÉANT-LEVEL: Support WebP automatique
    priority?: 'low' | 'normal' | 'high';
    cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
    quality?: number; // ✅ GÉANT-LEVEL: Qualité d'image (1-100)
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
    uri,
    placeholder,
    fallback,
    blurHash,
    webp = true, // ✅ GÉANT-LEVEL: WebP activé par défaut
    priority = 'normal',
    cachePolicy = 'memory-disk',
    quality = 80, // ✅ GÉANT-LEVEL: Qualité optimale par défaut
    style,
    ...props
}) => {
    const [isLoading, setIsLoading] = React.useState(true);
    const [hasError, setHasError] = React.useState(false);
    const [useOriginalUri, setUseOriginalUri] = React.useState(false);

    // ✅ CORRIGÉ 2026-02-27: Ne PAS ajouter ?format=webp aux URLs CDN complètes
    // (GCP Storage, S3, etc. ne supportent pas ces query params et retournent des erreurs)
    const optimizedUri = React.useMemo(() => {
        if (!uri) return uri;
        // Si on a déjà échoué avec l'URI optimisée, utiliser l'originale
        if (useOriginalUri) return uri;

        // Ne JAMAIS modifier les URLs CDN complètes (storage.googleapis.com, cloudfront, etc.)
        if (uri.startsWith('https://storage.googleapis.com') ||
            uri.startsWith('https://cdn.') ||
            uri.startsWith('data:') ||
            uri.includes('cloudfront.net') ||
            uri.includes('wasabi') ||
            uri.includes('s3.')) {
            return uri;
        }

        // Appliquer WebP uniquement sur les URLs qui supportent la transformation
        if (webp && uri.includes('?')) {
            if (!uri.includes('format=webp') && !uri.includes('format=avif')) {
                return `${uri}&format=webp&quality=${quality}`;
            }
        } else if (webp && !uri.includes('format=')) {
            return `${uri}?format=webp&quality=${quality}`;
        }

        return uri;
    }, [uri, webp, quality, useOriginalUri]);

    // Placeholder par défaut (blur hash ou couleur)
    const defaultPlaceholder = placeholder || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const ImageComponent = ExpoImage || Image;

    return (
        <View style={[styles.container, style]}>
            {/* ✅ GÉANT-LEVEL: Placeholder BlurHash avec BlurView (Instagram style) */}
            {isLoading && blurHash && (
                <BlurView intensity={20} style={StyleSheet.absoluteFill}>
                    <Image
                        source={{ uri: `data:image/png;base64,${blurHash}` }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                    />
                </BlurView>
            )}

            <ImageComponent
                source={{ uri: optimizedUri }}
                {...(ExpoImage ? {
                    placeholder: blurHash ? undefined : defaultPlaceholder,
                    contentFit: "cover",
                    transition: 200,
                    priority: priority,
                    cachePolicy: cachePolicy,
                } : { resizeMode: "cover" })}
                onLoadStart={() => {
                    setIsLoading(true);
                    setHasError(false);
                }}
                onLoadEnd={() => setIsLoading(false)}
                onError={() => {
                    // ✅ CORRIGÉ 2026-02-27: Si l'URI optimisée échoue, retenter avec l'originale
                    if (!useOriginalUri && optimizedUri !== uri) {
                        console.log('[OptimizedImage] Retry avec URI originale:', uri?.substring(0, 80));
                        setUseOriginalUri(true);
                        return;
                    }
                    setHasError(true);
                    setIsLoading(false);
                }}
                style={StyleSheet.absoluteFill}
                {...props}
            />

            {/* ✅ GÉANT-LEVEL: Loading indicator seulement si pas de BlurHash */}
            {isLoading && !blurHash && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#9CA3AF" />
                </View>
            )}

            {hasError && fallback && (
                <ImageComponent
                    source={{ uri: fallback }}
                    {...(ExpoImage ? { contentFit: "cover" } : { resizeMode: "cover" })}
                    style={StyleSheet.absoluteFill}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        overflow: 'hidden',
    },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
    },
});

export default OptimizedImage;
