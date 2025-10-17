// DebugLogger pour capturer les logs et erreurs
interface LogEntry {
    timestamp: Date;
    level: 'log' | 'warn' | 'error' | 'crash';
    category: string;
    message: string;
    data?: any;
}

class DebugLoggerClass {
    private logs: LogEntry[] = [];
    private maxLogs = 100;

    log(category: string, message: string, data?: any) {
        this.addLog('log', category, message, data);
        console.log(`[${category}] ${message}`, data || '');
    }

    warn(category: string, message: string, data?: any) {
        this.addLog('warn', category, message, data);
        console.warn(`[${category}] ${message}`, data || '');
    }

    error(category: string, message: string, data?: any) {
        this.addLog('error', category, message, data);
        console.error(`[${category}] ${message}`, data || '');
    }

    crash(category: string, message: string, error?: Error, errorInfo?: any) {
        this.addLog('crash', category, message, { error: error?.message, stack: error?.stack, errorInfo });
        console.error(`[CRASH] [${category}] ${message}`, error, errorInfo);
    }

    private addLog(level: LogEntry['level'], category: string, message: string, data?: any) {
        const logEntry: LogEntry = {
            timestamp: new Date(),
            level,
            category,
            message,
            data
        };

        this.logs.unshift(logEntry);

        // Garder seulement les derniers logs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(0, this.maxLogs);
        }
    }

    getLogs(): LogEntry[] {
        return [...this.logs];
    }

    getCrashLogs(): LogEntry[] {
        return this.logs.filter(log => log.level === 'crash');
    }

    clearLogs() {
        this.logs = [];
    }

    exportLogs(): string {
        return JSON.stringify(this.logs, null, 2);
    }
}

export const debugLogger = new DebugLoggerClass();
