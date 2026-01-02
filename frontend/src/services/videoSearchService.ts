/**
 * Service de recherche par vidéo pour le frontend web
 * 
 * Fonctionnalités:
 * - Extraction audio depuis vidéo
 * - Upload vidéo vers backend (si supporté)
 * - Transcription audio → texte (via backend Whisper API)
 * - Recherche sémantique sur texte transcrit
 * - Gestion facturation
 * - Retry logic
 */

import { audioSearchService, AudioSearchRequest, AudioSearchResponse } from './audioSearchService';

export interface VideoSearchRequest {
    videoFile?: File; // Fichier vidéo
    videoBase64?: string; // Vidéo en base64
    extractAudio?: boolean; // Si true, extrait l'audio de la vidéo (défaut: true)
    similarity_threshold?: number;
    max_results?: number;
}

export interface VideoSearchResponse {
    success: boolean;
    results?: any[]; // Résultats de recherche
    transcription?: {
        text: string;
        language?: string;
        duration?: number;
    };
    search_method?: 'video_ai' | 'audio_ai' | 'native';
    billing?: {
        charged: boolean;
        amount: number;
        currency: string;
        new_balance: number;
        results_found: number;
    };
    error?: string;
}

class VideoSearchService {
    private maxRetries: number = 3;
    private retryDelay: number = 1000;

    /**
     * Retry logic avec délai exponentiel
     */
    private async retry<T>(
        fn: () => Promise<T>,
        retries: number = this.maxRetries,
        delay: number = this.retryDelay
    ): Promise<T> {
        try {
            return await fn();
        } catch (error) {
            if (retries <= 0) {
                throw error;
            }
            console.log(`[VideoSearchService] ⚠️ Erreur, retry dans ${delay}ms (${retries} tentatives restantes)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.retry(fn, retries - 1, delay * 2);
        }
    }

    /**
     * Convertit un fichier vidéo en base64
     */
    private async fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                resolve(result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Extrait l'audio d'une vidéo en utilisant Web Audio API
     * Note: Cette méthode nécessite que le navigateur supporte Web Audio API
     * Pour une meilleure compatibilité, on peut aussi envoyer la vidéo directement au backend
     */
    private async extractAudioFromVideo(videoFile: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                reject(new Error('Canvas context non disponible'));
                return;
            }

            video.src = URL.createObjectURL(videoFile);
            video.muted = true; // Important pour éviter les problèmes de permissions

            video.onloadedmetadata = () => {
                // Créer un contexte audio
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const source = audioContext.createMediaElementSource(video);
                const destination = audioContext.createMediaStreamDestination();
                source.connect(destination);

                // Enregistrer l'audio
                const mediaRecorder = new MediaRecorder(destination.stream);
                const chunks: Blob[] = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        chunks.push(event.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(chunks, { type: 'audio/webm' });
                    const reader = new FileReader();
                    reader.onload = () => {
                        resolve(reader.result as string);
                        URL.revokeObjectURL(video.src);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(audioBlob);
                };

                video.play();
                mediaRecorder.start();

                video.onended = () => {
                    mediaRecorder.stop();
                };
            };

            video.onerror = (error) => {
                URL.revokeObjectURL(video.src);
                reject(error);
            };
        });
    }

    /**
     * Recherche par vidéo (upload + extraction audio + transcription + recherche)
     * @param request Requête avec fichier vidéo ou base64
     * @returns Résultats de recherche avec transcription
     */
    async searchByVideo(request: VideoSearchRequest): Promise<VideoSearchResponse> {
        try {
            console.log('[VideoSearchService] 🎥 Début recherche par vidéo');

            // Convertir File en base64 si nécessaire
            let videoBase64: string | undefined = request.videoBase64;
            
            if (request.videoFile && !videoBase64) {
                console.log('[VideoSearchService] Conversion fichier vidéo en base64...');
                videoBase64 = await this.fileToBase64(request.videoFile);
            }

            if (!videoBase64) {
                return {
                    success: false,
                    error: 'Aucun fichier vidéo fourni'
                };
            }

            // Si extractAudio est true (par défaut), extraire l'audio et utiliser audioSearchService
            if (request.extractAudio !== false) {
                console.log('[VideoSearchService] Extraction audio depuis vidéo...');
                
                try {
                    // Essayer d'extraire l'audio
                    if (request.videoFile) {
                        const audioBase64 = await this.extractAudioFromVideo(request.videoFile);
                        
                        // Utiliser audioSearchService pour la recherche
                        const audioResult = await audioSearchService.searchByAudio({
                            audioBase64,
                            similarity_threshold: request.similarity_threshold,
                            max_results: request.max_results,
                        });

                        return {
                            success: audioResult.success,
                            results: audioResult.results,
                            transcription: audioResult.transcription,
                            search_method: 'video_ai',
                            billing: audioResult.billing,
                            error: audioResult.error,
                        };
                    } else {
                        // Si on a seulement base64, on peut essayer d'envoyer directement au backend
                        // Le backend peut extraire l'audio lui-même
                        return await this.searchByVideoDirect(videoBase64, request);
                    }
                } catch (extractError) {
                    console.warn('[VideoSearchService] ⚠️ Erreur extraction audio, tentative envoi direct:', extractError);
                    // Fallback: envoyer la vidéo directement au backend
                    return await this.searchByVideoDirect(videoBase64, request);
                }
            } else {
                // Envoyer directement la vidéo au backend
                return await this.searchByVideoDirect(videoBase64, request);
            }
        } catch (error: any) {
            console.error('[VideoSearchService] ❌ Erreur recherche par vidéo:', error);
            return {
                success: false,
                error: error.message || 'Erreur lors de la recherche par vidéo'
            };
        }
    }

    /**
     * Recherche directe par vidéo (envoie la vidéo au backend)
     */
    private async searchByVideoDirect(
        videoBase64: string,
        request: VideoSearchRequest
    ): Promise<VideoSearchResponse> {
        try {
            // Nettoyer le base64 (enlever le préfixe data:video/...)
            const cleanBase64 = videoBase64.includes(',') 
                ? videoBase64.split(',')[1] 
                : videoBase64;

            // Construire la requête pour l'API backend
            const searchPayload = {
                texte: '', // Texte vide, la vidéo sera traitée par le backend
                video_base64: [cleanBase64], // Backend attend un array
                gps_mobile: null, // Peut être ajouté si nécessaire
            };

            console.log('[VideoSearchService] Envoi requête recherche avec vidéo...');

            // Recherche avec retry logic
            const result = await this.retry(async () => {
                const token = localStorage.getItem('token');
                const headers: HeadersInit = {
                    'Content-Type': 'application/json',
                };
                
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                const response = await fetch('/api/search/direct', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(searchPayload),
                });

                if (!response.ok) {
                    throw new Error(`Erreur HTTP: ${response.status}`);
                }

                const data = await response.json();

                // Extraire la transcription depuis la réponse
                let transcription: { text: string; language?: string; duration?: number } | undefined;
                if (data.transcription) {
                    transcription = {
                        text: data.transcription.text || data.transcription,
                        language: data.transcription.language,
                        duration: data.transcription.duration,
                    };
                } else if (data.video_transcription) {
                    transcription = {
                        text: data.video_transcription.text || data.video_transcription,
                        language: data.video_transcription.language,
                        duration: data.video_transcription.duration,
                    };
                }

                // Extraire les résultats
                const results = data?.resultats?.resultats || data?.resultats || data?.data || [];

                // Extraire la facturation
                const billing = data?.billing;

                console.log('[VideoSearchService] ✅ Recherche terminée:', {
                    resultsCount: results.length,
                    transcription: transcription?.text?.substring(0, 50) + '...',
                    billing: billing ? `${billing.amount} ${billing.currency}` : 'gratuit',
                });

                return {
                    success: true,
                    results,
                    transcription,
                    search_method: data?.search_method || 'video_ai',
                    billing,
                } as VideoSearchResponse;
            });

            return result;
        } catch (error: any) {
            console.error('[VideoSearchService] ❌ Erreur recherche directe par vidéo:', error);
            return {
                success: false,
                error: error.message || 'Erreur lors de la recherche par vidéo'
            };
        }
    }

    /**
     * Vérifie si un fichier vidéo peut être traité
     */
    canProcessVideo(fileSize: number, mimeType?: string): { canProcess: boolean; error?: string } {
        const maxSize = 50 * 1024 * 1024; // 50 MB

        if (fileSize > maxSize) {
            return {
                canProcess: false,
                error: `Fichier vidéo trop volumineux (max ${this.formatFileSize(maxSize)})`
            };
        }

        // Vérifier le type MIME
        const allowedTypes = [
            'video/mp4',
            'video/mpeg',
            'video/webm',
            'video/ogg',
            'video/quicktime',
            'video/x-msvideo', // AVI
        ];

        if (mimeType && !allowedTypes.includes(mimeType)) {
            return {
                canProcess: false,
                error: `Type de fichier vidéo non supporté: ${mimeType}`
            };
        }

        return { canProcess: true };
    }

    /**
     * Formate la taille d'un fichier en format lisible
     */
    private formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}

export const videoSearchService = new VideoSearchService();





