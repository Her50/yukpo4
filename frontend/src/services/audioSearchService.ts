/**
 * Service de recherche par audio pour le frontend web
 * 
 * Fonctionnalités:
 * - Upload audio vers backend
 * - Transcription audio → texte (via backend Whisper API)
 * - Recherche sémantique sur texte transcrit
 * - Gestion facturation
 * - Retry logic
 */

export interface AudioSearchRequest {
    audioFile?: File; // Fichier audio
    audioBase64?: string; // Audio en base64
    similarity_threshold?: number;
    max_results?: number;
}

export interface TranscriptionResult {
    text: string;
    language?: string;
    duration?: number;
}

export interface AudioSearchResponse {
    success: boolean;
    results?: any[]; // Résultats de recherche
    transcription?: TranscriptionResult;
    search_method?: 'audio_ai' | 'native';
    billing?: {
        charged: boolean;
        amount: number;
        currency: string;
        new_balance: number;
        results_found: number;
    };
    error?: string;
}

class AudioSearchService {
    private baseUrl: string;
    private maxRetries: number = 3;
    private retryDelay: number = 1000;

    constructor() {
        this.baseUrl = '/api/search/direct'; // Utilise l'endpoint de recherche directe qui gère déjà l'audio
    }

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
            console.log(`[AudioSearchService] ⚠️ Erreur, retry dans ${delay}ms (${retries} tentatives restantes)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.retry(fn, retries - 1, delay * 2);
        }
    }

    /**
     * Convertit un fichier audio en base64
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
     * Recherche par audio (upload + transcription + recherche)
     * @param request Requête avec fichier audio ou base64
     * @returns Résultats de recherche avec transcription
     */
    async searchByAudio(request: AudioSearchRequest): Promise<AudioSearchResponse> {
        try {
            console.log('[AudioSearchService] 🎤 Début recherche par audio');

            // Convertir File en base64 si nécessaire
            let audioBase64: string | undefined = request.audioBase64;
            
            if (request.audioFile && !audioBase64) {
                console.log('[AudioSearchService] Conversion fichier audio en base64...');
                audioBase64 = await this.fileToBase64(request.audioFile);
            }

            if (!audioBase64) {
                return {
                    success: false,
                    error: 'Aucun fichier audio fourni'
                };
            }

            // Nettoyer le base64 (enlever le préfixe data:audio/...)
            const cleanBase64 = audioBase64.includes(',') 
                ? audioBase64.split(',')[1] 
                : audioBase64;

            // Construire la requête pour l'API backend
            const searchPayload = {
                texte: '', // Texte vide, l'audio sera transcrit par le backend
                audio_base64: [cleanBase64], // Backend attend un array
                gps_mobile: null, // Peut être ajouté si nécessaire
            };

            console.log('[AudioSearchService] Envoi requête recherche avec audio...');

            // Recherche avec retry logic
            const result = await this.retry(async () => {
                const token = localStorage.getItem('token');
                const headers: HeadersInit = {
                    'Content-Type': 'application/json',
                };
                
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                const response = await fetch(this.baseUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(searchPayload),
                });

                if (!response.ok) {
                    throw new Error(`Erreur HTTP: ${response.status}`);
                }

                const data = await response.json();

                // Extraire la transcription depuis la réponse
                let transcription: TranscriptionResult | undefined;
                if (data.transcription) {
                    transcription = {
                        text: data.transcription.text || data.transcription,
                        language: data.transcription.language,
                        duration: data.transcription.duration,
                    };
                } else if (data.audio_transcription) {
                    transcription = {
                        text: data.audio_transcription.text || data.audio_transcription,
                        language: data.audio_transcription.language,
                        duration: data.audio_transcription.duration,
                    };
                }

                // Extraire les résultats
                const results = data?.resultats?.resultats || data?.resultats || data?.data || [];

                // Extraire la facturation
                const billing = data?.billing;

                console.log('[AudioSearchService] ✅ Recherche terminée:', {
                    resultsCount: results.length,
                    transcription: transcription?.text?.substring(0, 50) + '...',
                    billing: billing ? `${billing.amount} ${billing.currency}` : 'gratuit',
                });

                return {
                    success: true,
                    results,
                    transcription,
                    search_method: data?.search_method || 'audio_ai',
                    billing,
                } as AudioSearchResponse;
            });

            return result;
        } catch (error: any) {
            console.error('[AudioSearchService] ❌ Erreur recherche par audio:', error);
            return {
                success: false,
                error: error.message || 'Erreur lors de la recherche par audio'
            };
        }
    }

    /**
     * Transcription audio uniquement (sans recherche)
     * @param audioFile Fichier audio
     * @returns Transcription
     */
    async transcribeAudio(audioFile: File | string): Promise<TranscriptionResult> {
        try {
            console.log('[AudioSearchService] 🎤 Début transcription audio');

            // Convertir File en base64 si nécessaire
            let audioBase64: string;
            if (audioFile instanceof File) {
                audioBase64 = await this.fileToBase64(audioFile);
            } else {
                audioBase64 = audioFile;
            }

            // Nettoyer le base64
            const cleanBase64 = audioBase64.includes(',') 
                ? audioBase64.split(',')[1] 
                : audioBase64;

            // Appeler l'endpoint de transcription (si disponible) ou utiliser la recherche directe
            const token = localStorage.getItem('token');
            const headers: HeadersInit = {
                'Content-Type': 'application/json',
            };
            
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            // Utiliser l'endpoint de recherche directe qui transcrit automatiquement
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    texte: '',
                    audio_base64: [cleanBase64],
                }),
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();

            // Extraire la transcription
            let transcription: TranscriptionResult;
            if (data.transcription) {
                transcription = {
                    text: data.transcription.text || data.transcription,
                    language: data.transcription.language,
                    duration: data.transcription.duration,
                };
            } else if (data.audio_transcription) {
                transcription = {
                    text: data.audio_transcription.text || data.audio_transcription,
                    language: data.audio_transcription.language,
                    duration: data.audio_transcription.duration,
                };
            } else {
                throw new Error('Transcription non disponible dans la réponse');
            }

            console.log('[AudioSearchService] ✅ Transcription réussie:', transcription.text.substring(0, 50) + '...');

            return transcription;
        } catch (error: any) {
            console.error('[AudioSearchService] ❌ Erreur transcription:', error);
            throw new Error(error.message || 'Erreur lors de la transcription');
        }
    }

    /**
     * Vérifie si un fichier audio peut être traité
     */
    canProcessAudio(fileSize: number, mimeType?: string): { canProcess: boolean; error?: string } {
        const maxSize = 10 * 1024 * 1024; // 10 MB

        if (fileSize > maxSize) {
            return {
                canProcess: false,
                error: `Fichier audio trop volumineux (max ${this.formatFileSize(maxSize)})`
            };
        }

        // Vérifier le type MIME
        const allowedTypes = [
            'audio/mpeg',
            'audio/mp3',
            'audio/mp4',
            'audio/m4a',
            'audio/wav',
            'audio/webm',
            'audio/ogg',
        ];

        if (mimeType && !allowedTypes.includes(mimeType)) {
            return {
                canProcess: false,
                error: `Type de fichier audio non supporté: ${mimeType}`
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

export const audioSearchService = new AudioSearchService();


