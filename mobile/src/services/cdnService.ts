/**
 * Service CDN pour distribution vidéo
 * Gère les URLs CDN, le fallback, et la détection de la région
 */

// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import SafeStorage from '../../utils/safeStorage';
import { ENVIRONMENT } from '../config/environment';

interface CDNConfig {
    primary: string; // URL CDN primaire
    fallback: string[]; // URLs CDN de fallback
    region?: string; // Région détectée (us-east, eu-west, etc.)
}

interface CDNEndpoint {
    name: string;
    url: string;
    region: string;
    latency?: number; // Latence en ms (mesurée)
}

// Configuration des CDN disponibles
// ✅ CONFIGURATION CLOUDFLARE: Cloudflare lit depuis Wasabi (Origin Pull)
// Cloudflare = CDN qui distribue | Wasabi = Stockage source
const CDN_ENDPOINTS: CDNEndpoint[] = [
    {
        name: 'Cloudflare',
        // URL Cloudflare CDN (configurez dans Cloudflare Dashboard)
        // Cloudflare pointera vers Wasabi comme "Origin"
        // ⚠️ Configurez dans Cloudflare : Origin = Wasabi URL
        url: ENVIRONMENT.CDN_CLOUDFLARE_URL || 'https://cdn.yukpomnang.com',
        region: 'global',
    },
    {
        name: 'Wasabi Direct',
        // Fallback direct vers Wasabi si Cloudflare indisponible
        url: ENVIRONMENT.WASABI_DIRECT_URL || 'https://yukpo-video-prod.s3.eu-central-1.wasabisys.com',
        region: 'eu-central',
    },
    {
        name: 'Backend Direct',
        url: '', // Sera rempli avec l'URL du backend
        region: 'fallback',
    },
];

class CDNService {
    private config: CDNConfig | null = null;
    private backendUrl: string = '';
    private selectedEndpoint: CDNEndpoint | null = null;

    /**
     * Initialise le service CDN
     */
    async initialize(backendUrl: string): Promise<void> {
        this.backendUrl = backendUrl;

        try {
            // Charger la configuration sauvegardée
            const saved = await SafeStorage.getItem('cdn_config');
            if (saved) {
                this.config = JSON.parse(saved);
            }

            // Mettre à jour l'endpoint de fallback avec l'URL du backend
            const fallbackEndpoint = CDN_ENDPOINTS.find(e => e.region === 'fallback');
            if (fallbackEndpoint) {
                fallbackEndpoint.url = backendUrl;
            }

            // Détecter le meilleur endpoint si pas de config sauvegardée
            if (!this.config || !this.selectedEndpoint) {
                await this.detectBestEndpoint();
            }
        } catch (error) {
            console.error('[CDNService] Erreur initialisation:', error);
            // Fallback vers backend direct
            this.selectedEndpoint = CDN_ENDPOINTS.find(e => e.region === 'fallback') || CDN_ENDPOINTS[0];
        }
    }

    /**
     * Détecte le meilleur endpoint CDN en mesurant la latence
     * Priorité : Cloudflare > Wasabi Direct > Backend
     */
    async detectBestEndpoint(): Promise<CDNEndpoint> {
        const endpoints = CDN_ENDPOINTS.filter(e => e.region !== 'fallback');

        // Prioriser Cloudflare (CDN global)
        const cloudflareEndpoint = endpoints.find(e => e.name === 'Cloudflare');
        if (cloudflareEndpoint) {
            try {
                // Tester Cloudflare avec une requête légère
                const start = Date.now();
                const response = await fetch(`${cloudflareEndpoint.url}/favicon.ico`, {
                    method: 'HEAD',
                    signal: AbortSignal.timeout(3000),
                });
                const latency = Date.now() - start;

                if (response.ok || response.status === 404) { // 404 OK car on teste juste la connectivité
                    cloudflareEndpoint.latency = latency;
                    this.selectedEndpoint = cloudflareEndpoint;
                    this.config = {
                        primary: cloudflareEndpoint.url,
                        fallback: endpoints.filter(e => e.name !== 'Cloudflare').map(e => e.url),
                        region: cloudflareEndpoint.region,
                    };
                    await SafeStorage.setItem('cdn_config', JSON.stringify(this.config));
                    return cloudflareEndpoint;
                }
            } catch (error) {
                // ✅ OPTIMISATION: Logger en debug au lieu de warn (fallback automatique fonctionnel)
                console.debug('[CDNService] Cloudflare non disponible, test Wasabi...');
            }
        }

        // Fallback vers Wasabi Direct
        const wasabiEndpoint = endpoints.find(e => e.name === 'Wasabi Direct');
        if (wasabiEndpoint) {
            try {
                const start = Date.now();
                const response = await fetch(`${wasabiEndpoint.url}/favicon.ico`, {
                    method: 'HEAD',
                    signal: AbortSignal.timeout(3000),
                });
                const latency = Date.now() - start;

                if (response.ok || response.status === 404) {
                    wasabiEndpoint.latency = latency;
                    this.selectedEndpoint = wasabiEndpoint;
                    this.config = {
                        primary: wasabiEndpoint.url,
                        fallback: [cloudflareEndpoint?.url || ''].filter(Boolean),
                        region: wasabiEndpoint.region,
                    };
                    await SafeStorage.setItem('cdn_config', JSON.stringify(this.config));
                    return wasabiEndpoint;
                }
            } catch (error) {
                // ✅ OPTIMISATION: Logger en debug au lieu de warn (fallback automatique fonctionnel)
                console.debug('[CDNService] Wasabi non disponible, fallback backend...');
            }
        }

        // Dernier recours : Backend direct
        const fallback = CDN_ENDPOINTS.find(e => e.region === 'fallback') || CDN_ENDPOINTS[0];
        this.selectedEndpoint = fallback;
        return fallback;
    }

    /**
     * Obtient l'URL CDN pour une ressource vidéo
     */
    getVideoUrl(videoPath: string, useCDN: boolean = true): string {
        // Si CDN désactivé ou pas d'endpoint sélectionné, utiliser backend direct
        if (!useCDN || !this.selectedEndpoint || this.selectedEndpoint.region === 'fallback') {
            return `${this.backendUrl}${videoPath.startsWith('/') ? '' : '/'}${videoPath}`;
        }

        // Construire l'URL CDN
        const cdnBase = this.selectedEndpoint.url.endsWith('/')
            ? this.selectedEndpoint.url.slice(0, -1)
            : this.selectedEndpoint.url;

        const path = videoPath.startsWith('/') ? videoPath : `/${videoPath}`;
        return `${cdnBase}${path}`;
    }

    /**
     * Obtient l'URL avec fallback automatique
     * Si le CDN échoue, retourne l'URL du backend
     */
    getVideoUrlWithFallback(videoPath: string): string[] {
        const urls: string[] = [];

        // URL CDN primaire
        if (this.selectedEndpoint && this.selectedEndpoint.region !== 'fallback') {
            urls.push(this.getVideoUrl(videoPath, true));
        }

        // URLs de fallback
        if (this.config?.fallback) {
            this.config.fallback.forEach(fallbackUrl => {
                if (fallbackUrl) {
                    const path = videoPath.startsWith('/') ? videoPath : `/${videoPath}`;
                    urls.push(`${fallbackUrl}${path}`);
                }
            });
        }

        // Backend direct en dernier recours
        urls.push(this.getVideoUrl(videoPath, false));

        return urls;
    }

    /**
     * Vérifie si le CDN est disponible
     */
    async checkCDNAvailability(): Promise<boolean> {
        if (!this.selectedEndpoint || this.selectedEndpoint.region === 'fallback') {
            return false;
        }

        try {
            const response = await fetch(`${this.selectedEndpoint.url}/health`, {
                method: 'HEAD',
                signal: AbortSignal.timeout(3000),
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * Obtient l'endpoint CDN actuel
     */
    getCurrentEndpoint(): CDNEndpoint | null {
        return this.selectedEndpoint;
    }

    /**
     * Force la sélection d'un endpoint spécifique
     */
    async setEndpoint(endpointName: string): Promise<void> {
        const endpoint = CDN_ENDPOINTS.find(e => e.name === endpointName);
        if (endpoint) {
            this.selectedEndpoint = endpoint;
            this.config = {
                primary: endpoint.url,
                fallback: CDN_ENDPOINTS.filter(e => e.name !== endpointName).map(e => e.url),
                region: endpoint.region,
            };
            await SafeStorage.setItem('cdn_config', JSON.stringify(this.config));
        }
    }

    /**
     * Réinitialise la détection CDN
     */
    async resetDetection(): Promise<void> {
        await SafeStorage.removeItem('cdn_config');
        this.config = null;
        this.selectedEndpoint = null;
        await this.detectBestEndpoint();
    }
}

export const cdnService = new CDNService();

