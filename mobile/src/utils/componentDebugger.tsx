/**
 * Component Debugger - Outil de débogage pour identifier les problèmes de rendu
 * Log les props, children, et état des composants suspects
 */

import React from 'react';

interface ComponentDebugInfo {
    componentName: string;
    props: any;
    children: any;
    timestamp: string;
    stackTrace?: string;
}

class ComponentDebugger {
    private static instance: ComponentDebugger;
    private debugLog: ComponentDebugInfo[] = [];
    private maxLogs = 50;
    private enabled = __DEV__; // ✅ Activé uniquement en développement (cleanChildren gère déjà les primitives)

    static getInstance(): ComponentDebugger {
        if (!ComponentDebugger.instance) {
            ComponentDebugger.instance = new ComponentDebugger();
        }
        return ComponentDebugger.instance;
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }

    /**
     * Log les informations d'un composant avant le rendu
     */
    logComponent(componentName: string, props: any, children: any) {
        if (!this.enabled) return;

        try {
            // Capturer la stack trace
            const stackTrace = new Error().stack;

            // Analyser les children pour détecter les strings non wrappées
            const childrenAnalysis = this.analyzeChildren(children);

            const debugInfo: ComponentDebugInfo = {
                componentName,
                props: this.sanitizeProps(props),
                children: childrenAnalysis,
                timestamp: new Date().toISOString(),
                stackTrace: stackTrace?.split('\n').slice(0, 10).join('\n'), // Limiter à 10 lignes
            };

            this.debugLog.unshift(debugInfo);

            // Garder seulement les derniers logs
            if (this.debugLog.length > this.maxLogs) {
                this.debugLog = this.debugLog.slice(0, this.maxLogs);
            }

            // Si on détecte un problème potentiel, logger immédiatement
            if (childrenAnalysis.hasStringChild || childrenAnalysis.hasPrimitiveChild) {
                const warningMessage = `⚠️ [ComponentDebugger] ${componentName} - Détection de children primitifs: ${childrenAnalysis.preview}`;

                // ✅ CRITIQUE: Logger dans la console (sera intercepté par remoteLoggingService)
                console.warn(warningMessage, {
                    componentName,
                    hasStringChild: childrenAnalysis.hasStringChild,
                    hasPrimitiveChild: childrenAnalysis.hasPrimitiveChild,
                    childrenType: childrenAnalysis.childrenType,
                    childrenPreview: childrenAnalysis.preview,
                });

                // ✅ CRITIQUE: Envoyer directement au backend via remoteLoggingService
                try {
                    const { remoteLoggingService } = require('../services/remoteLoggingService');
                    remoteLoggingService.warn(
                        warningMessage,
                        'ComponentDebugger',
                        {
                            componentName,
                            hasStringChild: childrenAnalysis.hasStringChild,
                            hasPrimitiveChild: childrenAnalysis.hasPrimitiveChild,
                            childrenType: childrenAnalysis.childrenType,
                            childrenPreview: childrenAnalysis.preview,
                            props: this.sanitizeProps(props),
                            stackTrace: stackTrace?.split('\n').slice(0, 5).join('\n'),
                        }
                    );
                } catch (e) {
                    // Ignorer si le service n'est pas disponible
                }
            }
        } catch (error) {
            console.error('[ComponentDebugger] Erreur lors du logging:', error);
        }
    }

    /**
     * Analyser les children pour détecter les problèmes
     */
    private analyzeChildren(children: any): {
        hasStringChild: boolean;
        hasPrimitiveChild: boolean;
        childrenType: string;
        preview: string;
    } {
        if (children == null) {
            return {
                hasStringChild: false,
                hasPrimitiveChild: false,
                childrenType: 'null',
                preview: 'null',
            };
        }

        if (typeof children === 'string') {
            return {
                hasStringChild: true,
                hasPrimitiveChild: true,
                childrenType: 'string',
                preview: `"${children.substring(0, 50)}${children.length > 50 ? '...' : ''}"`,
            };
        }

        if (typeof children === 'number' || typeof children === 'boolean') {
            return {
                hasStringChild: false,
                hasPrimitiveChild: true,
                childrenType: typeof children,
                preview: String(children),
            };
        }

        if (Array.isArray(children)) {
            const hasPrimitive = children.some(
                child => typeof child === 'string' || typeof child === 'number' || typeof child === 'boolean'
            );
            const hasString = children.some(child => typeof child === 'string');

            return {
                hasStringChild: hasString,
                hasPrimitiveChild: hasPrimitive,
                childrenType: 'array',
                preview: `Array(${children.length}) - ${hasPrimitive ? '⚠️ Contient des primitives' : 'OK'}`,
            };
        }

        if (React.isValidElement(children)) {
            return {
                hasStringChild: false,
                hasPrimitiveChild: false,
                childrenType: 'ReactElement',
                preview: `${children.type?.toString() || 'Unknown'}`,
            };
        }

        return {
            hasStringChild: false,
            hasPrimitiveChild: false,
            childrenType: typeof children,
            preview: String(children).substring(0, 50),
        };
    }

    /**
     * Nettoyer les props pour éviter les références circulaires
     */
    private sanitizeProps(props: any): any {
        if (!props || typeof props !== 'object') {
            return props;
        }

        const sanitized: any = {};
        for (const key in props) {
            if (key === 'children') {
                sanitized[key] = this.analyzeChildren(props[key]);
            } else if (typeof props[key] === 'function') {
                sanitized[key] = '[Function]';
            } else if (typeof props[key] === 'object' && props[key] !== null) {
                try {
                    sanitized[key] = JSON.stringify(props[key]).substring(0, 100);
                } catch {
                    sanitized[key] = '[Object]';
                }
            } else {
                sanitized[key] = props[key];
            }
        }
        return sanitized;
    }

    /**
     * Obtenir les logs récents
     */
    getRecentLogs(count: number = 10): ComponentDebugInfo[] {
        return this.debugLog.slice(0, count);
    }

    /**
     * Obtenir les logs avec problèmes
     */
    getProblematicLogs(): ComponentDebugInfo[] {
        return this.debugLog.filter(log => {
            const analysis = log.children as any;
            return analysis?.hasStringChild || analysis?.hasPrimitiveChild;
        });
    }

    /**
     * Exporter tous les logs
     */
    exportLogs(): string {
        return JSON.stringify(this.debugLog, null, 2);
    }

    /**
     * Vider les logs
     */
    clearLogs() {
        this.debugLog = [];
    }

    /**
     * Envoyer les logs problématiques au backend
     */
    async sendProblematicLogsToBackend(): Promise<void> {
        const problematicLogs = this.getProblematicLogs();
        if (problematicLogs.length === 0) return;

        try {
            const { remoteLoggingService } = require('../services/remoteLoggingService');

            // Envoyer chaque log problématique
            for (const log of problematicLogs) {
                remoteLoggingService.warn(
                    `⚠️ [ComponentDebugger] ${log.componentName} - Children primitifs détectés`,
                    'ComponentDebugger',
                    {
                        componentName: log.componentName,
                        childrenAnalysis: log.children,
                        props: log.props,
                        timestamp: log.timestamp,
                        stackTrace: log.stackTrace,
                    }
                );
            }

            // Flush immédiat pour envoyer les logs
            await remoteLoggingService.flush();
        } catch (e) {
            console.error('[ComponentDebugger] Erreur envoi logs au backend:', e);
        }
    }

    /**
     * Envoyer tous les logs récents au backend (pour debug)
     */
    async sendAllLogsToBackend(count: number = 20): Promise<void> {
        const recentLogs = this.getRecentLogs(count);
        if (recentLogs.length === 0) return;

        try {
            const { remoteLoggingService } = require('../services/remoteLoggingService');

            remoteLoggingService.info(
                `[ComponentDebugger] ${recentLogs.length} logs récents`,
                'ComponentDebugger',
                { logs: recentLogs }
            );

            // Flush immédiat pour envoyer les logs
            await remoteLoggingService.flush();
        } catch (e) {
            console.error('[ComponentDebugger] Erreur envoi logs au backend:', e);
        }
    }
}

export const componentDebugger = ComponentDebugger.getInstance();

/**
 * HOC pour wrapper un composant avec le debugger
 */
export function withComponentDebugger<P extends object>(
    Component: React.ComponentType<P>,
    componentName: string
): React.ComponentType<P> {
    return React.memo((props: P): React.ReactElement => {
        React.useEffect(() => {
            componentDebugger.logComponent(componentName, props, (props as any).children);
        });

        return React.createElement(Component, props);
    }) as unknown as React.ComponentType<P>;
}
