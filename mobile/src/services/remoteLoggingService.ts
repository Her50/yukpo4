/**
 * Service de logging distant pour Expo.dev dans le cloud
 * Envoie les logs au backend pour centralisation
 * 
 * ✅ INTERCEPTE AUTOMATIQUEMENT TOUS LES console.log/error/warn/info/debug
 * ✅ Fonctionne avec tous les fichiers existants dans mobile/src/
 * ✅ Capture même les logs chargés avant l'initialisation
 */

import { apiPost } from './api';

interface LogEntry {
    level: 'log' | 'warn' | 'error' | 'info' | 'debug';
    message: string;
    component?: string;
    data?: any;
    timestamp: string;
    userId?: string;
    deviceInfo?: {
        platform: string;
        version?: string;
        deviceId?: string;
    };
    stack?: string;
}

class RemoteLoggingService {
    private logQueue: LogEntry[] = [];
    private isEnabled: boolean = true;
    private batchSize: number = 10;
    private flushInterval: number = 5000; // 5 secondes
    private flushTimer: NodeJS.Timeout | null = null;
    private userId: string | undefined;
    private originalConsole: {
        log: typeof console.log;
        warn: typeof console.warn;
        error: typeof console.error;
        info: typeof console.info;
        debug: typeof console.debug;
    } | null = null;

    constructor() {
        // ✅ CRITIQUE : Intercepter IMMÉDIATEMENT au chargement du module
        // Cela garantit que TOUS les logs sont capturés, même ceux chargés avant
        this.interceptConsole();

        // ✅ NOUVEAU : Intercepter les erreurs React Native spécifiques
        this.interceptReactNativeErrors();

        // Démarrer le flush périodique
        this.startPeriodicFlush();

        console.log('[RemoteLoggingService] ✅ Service initialisé - Tous les logs seront capturés');
    }

    /**
     * Intercepter console.log, console.error, etc. IMMÉDIATEMENT
     * Cette méthode est appelée dans le constructeur pour garantir
     * que TOUS les logs sont capturés, même ceux des fichiers chargés après
     */
    private interceptConsole() {
        if (this.originalConsole) {
            return; // Déjà intercepté
        }

        if (typeof global === 'undefined') {
            console.warn('[RemoteLoggingService] ⚠️ global non disponible, interception limitée');
            return;
        }

        // Sauvegarder les fonctions originales
        this.originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info,
            debug: console.debug,
        };

        // Intercepter console.log
        console.log = (...args: any[]) => {
            this.originalConsole!.log(...args);
            const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            this.addToQueue({
                level: 'log',
                message,
                component: this.extractComponentFromMessage(message),
                timestamp: new Date().toISOString(),
                userId: this.userId,
                deviceInfo: this.getDeviceInfo(),
            });
        };

        // Intercepter console.warn
        console.warn = (...args: any[]) => {
            this.originalConsole!.warn(...args);
            const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            this.addToQueue({
                level: 'warn',
                message,
                component: this.extractComponentFromMessage(message),
                timestamp: new Date().toISOString(),
                userId: this.userId,
                deviceInfo: this.getDeviceInfo(),
            });
        };

        // Intercepter console.error
        console.error = (...args: any[]) => {
            this.originalConsole!.error(...args);
            const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            const error = args.find(arg => arg instanceof Error);
            
            // ✅ CRITIQUE: Filtrer les erreurs AsyncStorage connues (non-bloquantes)
            if (this.isAsyncStorageError(error || message)) {
                // Ces erreurs sont gérées par SafeStorage, ne pas les logger comme erreurs critiques
                return;
            }

            // ✅ CORRECTION 1: Filtrer les erreurs liées à /api/mobile-logs pour éviter la boucle infinie
            if (this.isLoggingError(message, error)) {
                // Ne pas logger les erreurs de logging pour éviter la boucle infinie
                if (__DEV__) {
                    this.originalConsole?.warn('[RemoteLogging] ⚠️ Erreur de logging filtrée pour éviter la boucle:', message);
                }
                return;
            }

            this.addToQueue({
                level: 'error',
                message,
                component: this.extractComponentFromMessage(message),
                data: error ? {
                    message: error?.message,
                    name: error?.name,
                    code: (error as any)?.code,
                    ...(typeof error === 'object' ? error : { raw: String(error) }),
                } : undefined,
                timestamp: new Date().toISOString(),
                userId: this.userId,
                deviceInfo: this.getDeviceInfo(),
                stack: error?.stack,
            });
        };

        // Intercepter console.info
        console.info = (...args: any[]) => {
            this.originalConsole!.info(...args);
            const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            this.addToQueue({
                level: 'info',
                message,
                component: this.extractComponentFromMessage(message),
                timestamp: new Date().toISOString(),
                userId: this.userId,
                deviceInfo: this.getDeviceInfo(),
            });
        };

        // Intercepter console.debug
        console.debug = (...args: any[]) => {
            this.originalConsole!.debug(...args);
            const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            this.addToQueue({
                level: 'debug',
                message,
                component: this.extractComponentFromMessage(message),
                timestamp: new Date().toISOString(),
                userId: this.userId,
                deviceInfo: this.getDeviceInfo(),
            });
        };
    }

    /**
     * Vérifie si une erreur est une erreur AsyncStorage connue (non-bloquante)
     */
    private isAsyncStorageError(error: any): boolean {
        const errorMsg = error?.message || String(error || '');
        return (
            errorMsg.includes('Driver not found') ||
            errorMsg.includes('No available storage method found') ||
            (errorMsg.includes('AsyncStorage') && (errorMsg.includes('not found') || errorMsg.includes('unavailable')))
        );
    }

    /**
     * ✅ CORRECTION 1: Vérifie si une erreur est liée au logging pour éviter la boucle infinie
     */
    private isLoggingError(message: string, error: any): boolean {
        const errorMsg = error?.message || message || '';
        const errorName = error?.name || '';
        
        // Filtrer les erreurs liées à /api/mobile-logs
        return (
            errorMsg.includes('/api/mobile-logs') ||
            errorMsg.includes('mobile-logs') ||
            errorMsg.includes('Network request failed') && (errorMsg.includes('mobile') || errorMsg.includes('log')) ||
            errorName === 'TypeError' && errorMsg.includes('Network request failed') ||
            // Filtrer aussi les erreurs dans le stack trace
            (error?.stack && (
                error.stack.includes('/api/mobile-logs') ||
                error.stack.includes('remoteLoggingService') ||
                error.stack.includes('flush')
            ))
        );
    }

    /**
     * Intercepter les erreurs React Native spécifiques (ErrorBoundary, Promise rejections, etc.)
     */
    private interceptReactNativeErrors() {
        try {
            // Intercepter ErrorUtils (React Native)
            if (typeof global !== 'undefined' && (global as any).ErrorUtils) {
                const originalHandler = (global as any).ErrorUtils.getGlobalHandler();
                (global as any).ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
                    // ✅ CRITIQUE: Filtrer les erreurs AsyncStorage connues (non-bloquantes)
                    if (this.isAsyncStorageError(error)) {
                        // Ces erreurs sont gérées par SafeStorage, ne pas les logger comme erreurs critiques
                        if (originalHandler) {
                            originalHandler(error, isFatal);
                        }
                        return;
                    }

                    // ✅ CORRECTION 1: Filtrer les erreurs de logging pour éviter la boucle
                    if (this.isLoggingError(error.message, error)) {
                        if (__DEV__) {
                            this.originalConsole?.warn('[RemoteLogging] ⚠️ Erreur de logging filtrée (ErrorUtils):', error.message);
                        }
                        if (originalHandler) {
                            originalHandler(error, isFatal);
                        }
                        return;
                    }

                    this.addToQueue({
                        level: 'error',
                        message: `❌ Erreur ${isFatal ? 'FATALE' : 'non fatale'}: ${error.message}`,
                        component: 'ReactNative',
                        data: {
                            name: error.name,
                            message: error.message,
                            isFatal,
                        },
                        timestamp: new Date().toISOString(),
                        userId: this.userId,
                        deviceInfo: this.getDeviceInfo(),
                        stack: error.stack,
                    });
                    if (originalHandler) {
                        originalHandler(error, isFatal);
                    }
                });
            }

            // Intercepter les Promise rejections non gérées
            if (typeof global !== 'undefined' && global.Promise) {
                const originalReject = Promise.reject;
                Promise.reject = (reason: any) => {
                    // ✅ CRITIQUE: Filtrer les erreurs AsyncStorage connues (non-bloquantes)
                    if (this.isAsyncStorageError(reason)) {
                        // Ces erreurs sont gérées par SafeStorage, ne pas les logger comme erreurs critiques
                        return originalReject(reason);
                    }

                    // ✅ CORRECTION 1: Filtrer les erreurs de logging pour éviter la boucle
                    if (this.isLoggingError(reason?.message || String(reason), reason)) {
                        if (__DEV__) {
                            this.originalConsole?.warn('[RemoteLogging] ⚠️ Erreur de logging filtrée (Promise rejection):', reason?.message || String(reason));
                        }
                        return originalReject(reason);
                    }

                    this.addToQueue({
                        level: 'error',
                        message: `❌ Promise rejection: ${reason?.message || String(reason)}`,
                        component: 'Promise',
                        data: reason,
                        timestamp: new Date().toISOString(),
                        userId: this.userId,
                        deviceInfo: this.getDeviceInfo(),
                        stack: reason?.stack,
                    });
                    return originalReject(reason);
                };
            }
        } catch (error) {
            // Ne pas logger pour éviter la récursion
            this.originalConsole?.warn('[RemoteLoggingService] ⚠️ Erreur interception React Native:', error);
        }
    }

    /**
     * Extraire le nom du composant depuis le message de log
     * Exemple: "[HomeScreen] Message" -> "HomeScreen"
     */
    private extractComponentFromMessage(message: string): string | undefined {
        const match = message.match(/^\[([^\]]+)\]/);
        return match ? match[1] : undefined;
    }

    /**
     * Initialiser le service avec l'ID utilisateur
     */
    setUserId(userId: string | undefined) {
        this.userId = userId;
    }

    /**
     * Activer/désactiver le logging distant
     */
    setEnabled(enabled: boolean) {
        this.isEnabled = enabled;
        if (!enabled) {
            this.flush(); // Flush les logs restants avant désactivation
        }
    }

    /**
     * Obtenir les infos de l'appareil
     */
    private getDeviceInfo(): LogEntry['deviceInfo'] {
        try {
            const { Platform } = require('react-native');
            return {
                platform: Platform.OS,
                version: Platform.Version?.toString(),
            };
        } catch {
            return {
                platform: 'unknown',
            };
        }
    }

    /**
     * Ajouter un log à la queue
     */
    private addToQueue(entry: LogEntry) {
        if (!this.isEnabled) return;

        this.logQueue.push(entry);

        // Flush automatique si la queue est pleine
        if (this.logQueue.length >= this.batchSize) {
            this.flush();
        }
    }

    /**
     * ✅ NOUVEAU 2026-01-02: Estimer la taille d'un batch de logs (en bytes)
     */
    private estimateBatchSize(logs: LogEntry[]): number {
        // Estimation conservatrice de la taille JSON
        return logs.reduce((size, log) => {
            const messageSize = log.message?.length || 0;
            const componentSize = log.component?.length || 0;
            const dataSize = log.data ? JSON.stringify(log.data).length : 0;
            const stackSize = log.stack?.length || 0;
            const timestampSize = log.timestamp?.length || 0;
            const userIdSize = log.userId?.length || 0;
            const deviceInfoSize = log.deviceInfo ? JSON.stringify(log.deviceInfo).length : 0;
            
            // Taille de base pour la structure JSON (~200 bytes par log)
            return size + 200 + messageSize + componentSize + dataSize + stackSize 
                + timestampSize + userIdSize + deviceInfoSize;
        }, 100); // +100 bytes pour batch_id et structure wrapper
    }

    /**
     * ✅ NOUVEAU 2026-01-02: Diviser les logs en chunks qui respectent la limite de taille
     */
    private splitLogsIntoChunks(logs: LogEntry[], maxSizeBytes: number): LogEntry[][] {
        const chunks: LogEntry[][] = [];
        const MAX_LOGS_PER_BATCH = 100; // Limite par nombre de logs aussi
        const maxSize = Math.min(maxSizeBytes, 5_000_000); // 5 MB max
        
        let currentChunk: LogEntry[] = [];
        let currentSize = 100; // Taille de base pour batch_id et structure
        
        for (const log of logs) {
            const logSize = this.estimateLogSize(log);
            const newSize = currentSize + logSize;
            
            // Si ajouter ce log dépasserait la limite OU si on a atteint la limite de logs
            // (sauf si c'est le premier log du chunk), finaliser le chunk actuel
            if (currentChunk.length > 0 && (newSize > maxSize || currentChunk.length >= MAX_LOGS_PER_BATCH)) {
                chunks.push(currentChunk);
                currentChunk = [];
                currentSize = 100; // Réinitialiser pour le nouveau chunk
            }
            
            // Ajouter le log au chunk actuel (même s'il dépasse la limite individuelle)
            // Cela évite de perdre des logs très volumineux
            currentChunk.push(log);
            currentSize = newSize;
        }
        
        // Ajouter le dernier chunk s'il n'est pas vide
        if (currentChunk.length > 0) {
            chunks.push(currentChunk);
        }
        
        return chunks;
    }

    /**
     * ✅ NOUVEAU 2026-01-02: Estimer la taille d'un log individuel
     */
    private estimateLogSize(log: LogEntry): number {
        const messageSize = log.message?.length || 0;
        const componentSize = log.component?.length || 0;
        const dataSize = log.data ? JSON.stringify(log.data).length : 0;
        const stackSize = log.stack?.length || 0;
        const timestampSize = log.timestamp?.length || 0;
        const userIdSize = log.userId?.length || 0;
        const deviceInfoSize = log.deviceInfo ? JSON.stringify(log.deviceInfo).length : 0;
        
        return 200 + messageSize + componentSize + dataSize + stackSize 
            + timestampSize + userIdSize + deviceInfoSize;
    }

    /**
     * Envoyer les logs au backend
     * ✅ AMÉLIORÉ 2026-01-02: Divise automatiquement les batches trop volumineux
     */
    async flush(): Promise<void> {
        if (this.logQueue.length === 0) return;

        const logsToSend = [...this.logQueue];
        this.logQueue = [];

        // ✅ NOUVEAU 2026-01-02: Diviser les logs en chunks si nécessaire
        const MAX_BATCH_SIZE_BYTES = 4_500_000; // 4.5 MB (légèrement sous 5MB pour sécurité)
        const estimatedSize = this.estimateBatchSize(logsToSend);
        
        let chunks: LogEntry[][];
        if (estimatedSize > MAX_BATCH_SIZE_BYTES) {
            if (__DEV__) {
                this.originalConsole?.warn(
                    `[RemoteLogging] ⚠️ Batch trop volumineux (${estimatedSize} bytes), division en chunks`
                );
            }
            chunks = this.splitLogsIntoChunks(logsToSend, MAX_BATCH_SIZE_BYTES);
        } else {
            chunks = [logsToSend];
        }

        // Envoyer chaque chunk séparément
        for (const chunk of chunks) {
            try {
                const response = await apiPost('/api/mobile-logs', {
                    logs: chunk,
                    batch_id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                });

                // ✅ AMÉLIORÉ: Vérifier si la réponse indique un succès
                if (response.success !== false) {
                    if (__DEV__) {
                        this.originalConsole?.log(`[RemoteLogging] ✅ ${chunk.length} logs envoyés au backend`);
                    }
                } else {
                    // Réponse indique une erreur mais pas d'exception levée
                    // Remettre les logs dans la queue pour retry
                    if (this.logQueue.length < 100) {
                        this.logQueue.unshift(...chunk);
                    } else {
                        this.logQueue = chunk.slice(-50);
                    }
                    
                    if (__DEV__) {
                        this.originalConsole?.warn(`[RemoteLogging] ⚠️ Échec envoi logs (réponse: ${response.error || 'unknown'})`);
                    }
                }
            } catch (error: any) {
                // ✅ AMÉLIORÉ: Gérer différemment selon le type d'erreur
                const isNetworkError = error?.code === 'NETWORK_ERROR' || 
                                      error?.code === 'TIMEOUT' ||
                                      error?.message?.includes('Network request failed') ||
                                      error?.message?.includes('Failed to fetch') ||
                                      error?.message?.includes('timeout');
                
                // Pour les erreurs réseau/timeout, on peut supposer que le serveur n'a pas reçu les logs
                // Pour les autres erreurs (500, etc.), le serveur a peut-être reçu les logs mais a retourné une erreur
                if (isNetworkError) {
                    // Erreur réseau/timeout : remettre dans la queue pour retry
                    if (this.logQueue.length < 100) {
                        this.logQueue.unshift(...chunk);
                    } else {
                        // Queue trop pleine, garder seulement les plus récents
                        this.logQueue = chunk.slice(-50);
                    }
                    
                    if (__DEV__) {
                        this.originalConsole?.warn(`[RemoteLogging] ⚠️ Erreur réseau/timeout, ${chunk.length} logs remis en queue pour retry`);
                    }
                } else {
                    // Autre erreur (500, etc.) : le serveur a peut-être reçu les logs
                    // Ne pas remettre dans la queue pour éviter les doublons
                    // Mais logger l'erreur pour diagnostic
                    if (__DEV__) {
                        this.originalConsole?.warn(`[RemoteLogging] ⚠️ Erreur serveur (${error?.response?.status || 'unknown'}), logs peut-être reçus:`, error);
                    }
                }
            }
        }
    }

    /**
     * Démarrer le flush périodique
     */
    private startPeriodicFlush() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }

        this.flushTimer = setInterval(() => {
            this.flush();
        }, this.flushInterval);
    }

    /**
     * Arrêter le flush périodique
     */
    stop() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        this.flush(); // Flush final
    }

    /**
     * Logger un message (méthode manuelle)
     */
    log(message: string, component?: string, data?: any) {
        this.addToQueue({
            level: 'log',
            message,
            component,
            data,
            timestamp: new Date().toISOString(),
            userId: this.userId,
            deviceInfo: this.getDeviceInfo(),
        });
    }

    /**
     * Logger un warning (méthode manuelle)
     */
    warn(message: string, component?: string, data?: any) {
        this.addToQueue({
            level: 'warn',
            message,
            component,
            data,
            timestamp: new Date().toISOString(),
            userId: this.userId,
            deviceInfo: this.getDeviceInfo(),
        });
    }

    /**
     * Logger une erreur (méthode manuelle)
     */
    error(message: string, component?: string, error?: any, stack?: string) {
        // ✅ CRITIQUE: Filtrer les erreurs AsyncStorage connues (non-bloquantes)
        if (this.isAsyncStorageError(error || message)) {
            // Ces erreurs sont gérées par SafeStorage, ne pas les logger comme erreurs critiques
            return;
        }

        // ✅ CORRECTION 1: Filtrer les erreurs de logging pour éviter la boucle infinie
        if (this.isLoggingError(message, error)) {
            if (__DEV__) {
                this.originalConsole?.warn('[RemoteLogging] ⚠️ Erreur de logging filtrée (méthode error):', message);
            }
            return;
        }

        this.addToQueue({
            level: 'error',
            message,
            component,
            data: error ? {
                message: error?.message,
                name: error?.name,
                code: error?.code,
                ...(typeof error === 'object' ? error : { raw: String(error) }),
            } : undefined,
            timestamp: new Date().toISOString(),
            userId: this.userId,
            deviceInfo: this.getDeviceInfo(),
            stack: stack || error?.stack,
        });
    }

    /**
     * Logger une info (méthode manuelle)
     */
    info(message: string, component?: string, data?: any) {
        this.addToQueue({
            level: 'info',
            message,
            component,
            data,
            timestamp: new Date().toISOString(),
            userId: this.userId,
            deviceInfo: this.getDeviceInfo(),
        });
    }

    /**
     * Logger un debug (méthode manuelle)
     */
    debug(message: string, component?: string, data?: any) {
        if (__DEV__) {
            // En dev, logger aussi dans la console
            this.originalConsole?.debug(`[${component || 'App'}] ${message}`, data);
        }

        this.addToQueue({
            level: 'debug',
            message,
            component,
            data,
            timestamp: new Date().toISOString(),
            userId: this.userId,
            deviceInfo: this.getDeviceInfo(),
        });
    }
}

// ✅ CRITIQUE : Créer l'instance IMMÉDIATEMENT au chargement du module
// Cela garantit que l'interception se fait AVANT que d'autres fichiers soient chargés
export const remoteLoggingService = new RemoteLoggingService();

// ✅ DOUBLE VÉRIFICATION : Intercepter aussi au niveau global si possible
// (pour les cas où le module est chargé après d'autres fichiers)
if (typeof global !== 'undefined' && !(global as any).__REMOTE_LOGGING_INTERCEPTED__) {
    (global as any).__REMOTE_LOGGING_INTERCEPTED__ = true;

    // Log de confirmation
    console.log('[RemoteLoggingService] ✅ Interception globale activée - Tous les logs seront capturés');
}

export default remoteLoggingService;
