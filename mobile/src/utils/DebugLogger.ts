import AsyncStorage from '@react-native-async-storage/async-storage';

interface LogEntry {
    timestamp: string;
    level: 'LOG' | 'WARN' | 'ERROR' | 'CRASH';
    component: string;
    message: string;
    data?: any;
    stack?: string;
}

class DebugLogger {
    private logs: LogEntry[] = [];
    private maxLogs = 1000;
    private isInitialized = false;

    constructor() {
        this.initialize();
    }

    private async initialize() {
        try {
            // Récupérer les logs précédents
            const savedLogs = await AsyncStorage.getItem('debug_logs');
            if (savedLogs) {
                this.logs = JSON.parse(savedLogs);
            }

            // Intercepter console.log, console.error, etc.
            this.interceptConsole();
            this.isInitialized = true;

            this.log('DEBUG_LOGGER', 'Logger initialisé avec succès', {
                previousLogs: this.logs.length
            });
        } catch (error) {
            console.error('Erreur initialisation DebugLogger:', error);
        }
    }

    private interceptConsole() {
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;

        console.log = (...args) => {
            originalLog(...args);
            this.log('CONSOLE', args.join(' '), args.length > 1 ? args : undefined);
        };

        console.warn = (...args) => {
            originalWarn(...args);
            this.warn('CONSOLE', args.join(' '), args.length > 1 ? args : undefined);
        };

        console.error = (...args) => {
            originalError(...args);
            this.error('CONSOLE', args.join(' '), args.length > 1 ? args : undefined);
        };
    }

    public log(component: string, message: string, data?: any) {
        this.addLog('LOG', component, message, data);
    }

    public warn(component: string, message: string, data?: any) {
        this.addLog('WARN', component, message, data);
    }

    public error(component: string, message: string, data?: any, stack?: string) {
        this.addLog('ERROR', component, message, data, stack);
    }

    public crash(component: string, message: string, error: any) {
        const stack = error?.stack || new Error().stack;
        this.addLog('CRASH', component, message, error, stack);
    }

    private addLog(level: LogEntry['level'], component: string, message: string, data?: any, stack?: string) {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            component,
            message,
            data,
            stack
        };

        this.logs.push(entry);

        // Limiter le nombre de logs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // Sauvegarder immédiatement
        this.saveLogs();

        // Afficher dans la console normale aussi
        const consoleMessage = `[${level}] ${component}: ${message}`;
        switch (level) {
            case 'LOG':
                console.log(consoleMessage, data || '');
                break;
            case 'WARN':
                console.warn(consoleMessage, data || '');
                break;
            case 'ERROR':
            case 'CRASH':
                console.error(consoleMessage, data || '', stack || '');
                break;
        }
    }

    private async saveLogs() {
        try {
            await AsyncStorage.setItem('debug_logs', JSON.stringify(this.logs));
        } catch (error) {
            console.error('Erreur sauvegarde logs:', error);
        }
    }

    public getAllLogs(): LogEntry[] {
        return [...this.logs];
    }

    public getRecentLogs(count: number = 100): LogEntry[] {
        return this.logs.slice(-count);
    }

    public getErrorLogs(): LogEntry[] {
        return this.logs.filter(log => log.level === 'ERROR' || log.level === 'CRASH');
    }

    public async exportLogs(): Promise<string> {
        const logs = this.getAllLogs();
        const exportData = {
            exportDate: new Date().toISOString(),
            deviceInfo: {
                // Ajouter des infos sur l'appareil si possible
                platform: 'React Native',
                timestamp: Date.now()
            },
            logs: logs,
            summary: {
                totalLogs: logs.length,
                errors: logs.filter(l => l.level === 'ERROR').length,
                crashes: logs.filter(l => l.level === 'CRASH').length,
                warnings: logs.filter(l => l.level === 'WARN').length
            }
        };

        return JSON.stringify(exportData, null, 2);
    }

    public async clearLogs() {
        this.logs = [];
        await AsyncStorage.removeItem('debug_logs');
        this.log('DEBUG_LOGGER', 'Logs effacés');
    }

    public getLogsSummary() {
        const logs = this.getAllLogs();
        return {
            total: logs.length,
            errors: logs.filter(l => l.level === 'ERROR').length,
            crashes: logs.filter(l => l.level === 'CRASH').length,
            warnings: logs.filter(l => l.level === 'WARN').length,
            lastLog: logs[logs.length - 1]?.timestamp
        };
    }
}

// Instance singleton
export const debugLogger = new DebugLogger();

// Hook pour utiliser le logger dans les composants
export const useDebugLogger = () => {
    return {
        log: debugLogger.log.bind(debugLogger),
        warn: debugLogger.warn.bind(debugLogger),
        error: debugLogger.error.bind(debugLogger),
        crash: debugLogger.crash.bind(debugLogger),
        getLogs: debugLogger.getAllLogs.bind(debugLogger),
        exportLogs: debugLogger.exportLogs.bind(debugLogger),
        clearLogs: debugLogger.clearLogs.bind(debugLogger),
        getSummary: debugLogger.getLogsSummary.bind(debugLogger)
    };
};

export default debugLogger;
