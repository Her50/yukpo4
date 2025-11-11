const fs = require('fs');
const path = require('path');

class LogAnalyzer {
    constructor() {
        this.logFile = path.join(__dirname, 'logs', 'app-logs.log');
        this.errorFile = path.join(__dirname, 'logs', 'errors.log');
        this.performanceFile = path.join(__dirname, 'logs', 'performance.log');
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data,
            pid: process.pid
        };

        // Écrire dans le fichier de logs principal
        fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');

        // Si c'est une erreur, l'écrire aussi dans le fichier d'erreurs
        if (level === 'ERROR' || level === 'FATAL') {
            fs.appendFileSync(this.errorFile, JSON.stringify(logEntry) + '\n');
        }

        // Si c'est une info de performance, l'écrire dans le fichier de performance
        if (level === 'PERFORMANCE') {
            fs.appendFileSync(this.performanceFile, JSON.stringify(logEntry) + '\n');
        }

        console.log(`[${timestamp}] ${level}: ${message}`);
    }

    analyzeErrors() {
        if (!fs.existsSync(this.errorFile)) {
            return { errors: [], suggestions: [], severity: 'LOW' };
        }

        const errorLines = fs.readFileSync(this.errorFile, 'utf8').split('\n').filter(line => line.trim());
        const errors = errorLines.map(line => {
            try {
                return JSON.parse(line);
            } catch {
                return { message: line, timestamp: new Date().toISOString(), level: 'ERROR' };
            }
        });

        const suggestions = this.generateSuggestions(errors);
        const severity = this.calculateSeverity(errors);
        
        return { errors: errors.slice(-50), suggestions, severity }; // Garder seulement les 50 dernières erreurs
    }

    generateSuggestions(errors) {
        const suggestions = [];
        const errorCounts = {};
        
        // Compter les erreurs par type
        errors.forEach(error => {
            const message = error.message.toLowerCase();
            let type = 'unknown';
            
            if (message.includes('network') || message.includes('connection') || message.includes('fetch')) {
                type = 'network';
            } else if (message.includes('gps') || message.includes('location') || message.includes('geolocation')) {
                type = 'gps';
            } else if (message.includes('update') || message.includes('download') || message.includes('ota')) {
                type = 'update';
            } else if (message.includes('crash') || message.includes('fatal') || message.includes('exception')) {
                type = 'crash';
            } else if (message.includes('permission') || message.includes('unauthorized')) {
                type = 'permission';
            } else if (message.includes('memory') || message.includes('heap')) {
                type = 'memory';
            }
            
            errorCounts[type] = (errorCounts[type] || 0) + 1;
        });
        
        // Générer des suggestions basées sur les erreurs les plus fréquentes
        Object.entries(errorCounts).forEach(([type, count]) => {
            if (count >= 2) { // Seulement si l'erreur se répète
                switch (type) {
                    case 'network':
                        suggestions.push({
                            type: 'network',
                            priority: count >= 5 ? 'HIGH' : 'MEDIUM',
                            message: `Problème de connexion réseau détecté (${count} occurrences)`,
                            solution: 'Vérifier la connexion internet et l\'URL de l\'API',
                            actions: [
                                'Vérifier la connectivité réseau',
                                'Tester l\'URL de l\'API: https://yukpomnang.onrender.com',
                                'Vérifier les paramètres de proxy/firewall'
                            ]
                        });
                        break;
                        
                    case 'gps':
                        suggestions.push({
                            type: 'gps',
                            priority: 'MEDIUM',
                            message: `Problème de géolocalisation détecté (${count} occurrences)`,
                            solution: 'Activer les services de localisation et vérifier les permissions',
                            actions: [
                                'Vérifier que la géolocalisation est activée',
                                'Accorder les permissions de localisation',
                                'Tester la géolocalisation dans un navigateur'
                            ]
                        });
                        break;
                        
                    case 'update':
                        suggestions.push({
                            type: 'update',
                            priority: 'HIGH',
                            message: `Problème de mise à jour détecté (${count} occurrences)`,
                            solution: 'Désactiver les mises à jour automatiques dans la configuration',
                            actions: [
                                'Vérifier la configuration updates dans app.json',
                                'Désactiver les mises à jour OTA',
                                'Utiliser un build local stable'
                            ]
                        });
                        break;
                        
                    case 'crash':
                        suggestions.push({
                            type: 'crash',
                            priority: 'CRITICAL',
                            message: `Crash de l'application détecté (${count} occurrences)`,
                            solution: 'Redémarrer l\'application et vérifier les dépendances',
                            actions: [
                                'Redémarrer l\'application complètement',
                                'Vérifier les logs détaillés',
                                'Tester avec un App.tsx minimal',
                                'Vérifier la compatibilité des dépendances'
                            ]
                        });
                        break;
                        
                    case 'permission':
                        suggestions.push({
                            type: 'permission',
                            priority: 'MEDIUM',
                            message: `Problème de permissions détecté (${count} occurrences)`,
                            solution: 'Vérifier les permissions de l\'application',
                            actions: [
                                'Vérifier les permissions dans app.json',
                                'Accorder les permissions manuellement',
                                'Vérifier les permissions système'
                            ]
                        });
                        break;
                        
                    case 'memory':
                        suggestions.push({
                            type: 'memory',
                            priority: 'HIGH',
                            message: `Problème de mémoire détecté (${count} occurrences)`,
                            solution: 'Optimiser l\'utilisation de la mémoire',
                            actions: [
                                'Fermer les autres applications',
                                'Redémarrer l\'appareil',
                                'Vérifier les fuites mémoire dans le code'
                            ]
                        });
                        break;
                }
            }
        });
        
        return suggestions.sort((a, b) => {
            const priorityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    calculateSeverity(errors) {
        if (errors.length === 0) return 'LOW';
        
        const criticalErrors = errors.filter(e => 
            e.message.toLowerCase().includes('fatal') || 
            e.message.toLowerCase().includes('crash') ||
            e.message.toLowerCase().includes('exception')
        ).length;
        
        const highErrors = errors.filter(e => 
            e.message.toLowerCase().includes('error') ||
            e.message.toLowerCase().includes('failed')
        ).length;
        
        if (criticalErrors > 0) return 'CRITICAL';
        if (highErrors > 5) return 'HIGH';
        if (highErrors > 2) return 'MEDIUM';
        return 'LOW';
    }

    getPerformanceMetrics() {
        if (!fs.existsSync(this.performanceFile)) {
            return { metrics: [], average: {} };
        }

        const performanceLines = fs.readFileSync(this.performanceFile, 'utf8').split('\n').filter(line => line.trim());
        const metrics = performanceLines.map(line => {
            try {
                return JSON.parse(line);
            } catch {
                return null;
            }
        }).filter(Boolean);

        // Calculer les moyennes
        const averages = {};
        const metricTypes = ['loadTime', 'renderTime', 'apiResponseTime'];
        
        metricTypes.forEach(type => {
            const values = metrics.filter(m => m.data && m.data[type]).map(m => m.data[type]);
            if (values.length > 0) {
                averages[type] = values.reduce((a, b) => a + b, 0) / values.length;
            }
        });

        return { metrics: metrics.slice(-20), average: averages }; // Garder les 20 dernières métriques
    }

    generateReport() {
        const errorAnalysis = this.analyzeErrors();
        const performanceMetrics = this.getPerformanceMetrics();
        
        return {
            timestamp: new Date().toISOString(),
            summary: {
                totalErrors: errorAnalysis.errors.length,
                severity: errorAnalysis.severity,
                suggestions: errorAnalysis.suggestions.length,
                performanceMetrics: Object.keys(performanceMetrics.average).length
            },
            errors: errorAnalysis.errors,
            suggestions: errorAnalysis.suggestions,
            performance: performanceMetrics,
            recommendations: this.generateRecommendations(errorAnalysis, performanceMetrics)
        };
    }

    generateRecommendations(errorAnalysis, performanceMetrics) {
        const recommendations = [];
        
        // Recommandations basées sur les erreurs
        if (errorAnalysis.severity === 'CRITICAL') {
            recommendations.push({
                priority: 'URGENT',
                action: 'Redémarrer immédiatement l\'application',
                reason: 'Erreurs critiques détectées'
            });
        }
        
        if (errorAnalysis.suggestions.some(s => s.type === 'update')) {
            recommendations.push({
                priority: 'HIGH',
                action: 'Désactiver les mises à jour automatiques',
                reason: 'Erreurs de mise à jour répétées'
            });
        }
        
        // Recommandations basées sur les performances
        if (performanceMetrics.average.loadTime > 3000) {
            recommendations.push({
                priority: 'MEDIUM',
                action: 'Optimiser le temps de chargement',
                reason: 'Temps de chargement élevé détecté'
            });
        }
        
        if (performanceMetrics.average.apiResponseTime > 5000) {
            recommendations.push({
                priority: 'MEDIUM',
                action: 'Vérifier la connectivité API',
                reason: 'Temps de réponse API élevé'
            });
        }
        
        return recommendations;
    }

    clearLogs() {
        [this.logFile, this.errorFile, this.performanceFile].forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
        this.log('INFO', 'Logs effacés');
    }

    exportLogs(outputPath) {
        const report = this.generateReport();
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
        this.log('INFO', `Rapport exporté vers ${outputPath}`);
        return outputPath;
    }
}

module.exports = LogAnalyzer;
