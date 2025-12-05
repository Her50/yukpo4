/**
 * Service unifié pour la gestion des médias (images et vidéos)
 * Intègre automatiquement le CDN Cloudflare et gère les fallbacks
 */

import { cdnService } from './cdnService';
import { ENVIRONMENT } from '../config/environment';

export interface ImageOptions {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpg' | 'png';
}

export interface VideoOptions {
    quality?: 'high' | 'medium' | 'low';
    format?: 'mp4' | 'webm';
}

class MediaService {
    private backendUrl: string;

    constructor() {
        this.backendUrl = ENVIRONMENT.API_URL || '';
    }

    /**
     * Initialise le service média
     */
    async initialize(backendUrl?: string): Promise<void> {
        if (backendUrl) {
            this.backendUrl = backendUrl;
        }
        await cdnService.initialize(this.backendUrl);
    }

    /**
     * Normalise un chemin média (ajoute / si nécessaire)
     */
    private normalizePath(path: string): string {
        if (!path) return '';
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path; // URL complète, retourner tel quel
        }
        return path.startsWith('/') ? path : `/${path}`;
    }

    /**
     * Obtient l'URL d'une image optimisée via CDN
     */
    getImageUrl(path: string, options?: ImageOptions): string {
        const normalizedPath = this.normalizePath(path);
        
        // Si c'est déjà une URL complète, utiliser directement
        if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
            return normalizedPath;
        }

        // Obtenir URL via CDN
        let url = cdnService.getVideoUrl(normalizedPath, true); // CDN service gère aussi les images
        
        // Ajouter paramètres d'optimisation si fournis
        if (options) {
            const params = new URLSearchParams();
            if (options.width) params.append('w', options.width.toString());
            if (options.height) params.append('h', options.height.toString());
            if (options.quality) params.append('q', options.quality.toString());
            if (options.format) params.append('f', options.format);
            
            const queryString = params.toString();
            if (queryString) {
                url += (url.includes('?') ? '&' : '?') + queryString;
            }
        }

        return url;
    }

    /**
     * Obtient l'URL d'une vidéo optimisée via CDN
     */
    getVideoUrl(path: string, options?: VideoOptions): string {
        const normalizedPath = this.normalizePath(path);
        
        // Si c'est déjà une URL complète, utiliser directement
        if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
            return normalizedPath;
        }

        // Obtenir URL via CDN
        let url = cdnService.getVideoUrl(normalizedPath, true);
        
        // Ajouter paramètres d'optimisation si fournis
        if (options) {
            const params = new URLSearchParams();
            if (options.quality) params.append('quality', options.quality);
            if (options.format) params.append('format', options.format);
            
            const queryString = params.toString();
            if (queryString) {
                url += (url.includes('?') ? '&' : '?') + queryString;
            }
        }

        return url;
    }

    /**
     * Obtient l'URL d'une vidéo avec fallback automatique
     * Retourne un tableau d'URLs dans l'ordre de priorité
     */
    getVideoUrlWithFallback(path: string): string[] {
        const normalizedPath = this.normalizePath(path);
        
        // Si c'est déjà une URL complète, retourner tel quel
        if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
            return [normalizedPath];
        }

        return cdnService.getVideoUrlWithFallback(normalizedPath);
    }

    /**
     * Obtient l'URL d'une image avec fallback automatique
     */
    getImageUrlWithFallback(path: string, options?: ImageOptions): string[] {
        const normalizedPath = this.normalizePath(path);
        
        // Si c'est déjà une URL complète
        if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
            return [normalizedPath];
        }

        const urls: string[] = [];
        
        // URL CDN primaire
        urls.push(this.getImageUrl(normalizedPath, options));
        
        // Fallback Wasabi direct
        if (ENVIRONMENT.WASABI_DIRECT_URL) {
            urls.push(`${ENVIRONMENT.WASABI_DIRECT_URL}${normalizedPath}`);
        }
        
        // Fallback backend direct
        urls.push(`${this.backendUrl}${normalizedPath}`);

        return urls;
    }

    /**
     * Prépare une URL pour l'upload (retourne l'URL du backend)
     */
    getUploadUrl(): string {
        return `${this.backendUrl}/api/media/upload`;
    }

    /**
     * Vérifie si une URL utilise le CDN
     */
    isCDNUrl(url: string): boolean {
        if (!url) return false;
        return url.includes(ENVIRONMENT.CDN_CLOUDFLARE_URL || 'cdn.yukpomnang.com');
    }

    /**
     * Vérifie si une URL utilise Wasabi
     */
    isWasabiUrl(url: string): boolean {
        if (!url) return false;
        return url.includes(ENVIRONMENT.WASABI_DIRECT_URL || 'wasabisys.com');
    }

    /**
     * Obtient l'URL de base du CDN
     */
    getCDNBaseUrl(): string {
        return ENVIRONMENT.CDN_CLOUDFLARE_URL || 'https://cdn.yukpomnang.com';
    }

    /**
     * Obtient l'URL de base de Wasabi
     */
    getWasabiBaseUrl(): string {
        return ENVIRONMENT.WASABI_DIRECT_URL || 'https://yukpo-video-prod.s3.eu-central-1.wasabisys.com';
    }
}

export const mediaService = new MediaService();



