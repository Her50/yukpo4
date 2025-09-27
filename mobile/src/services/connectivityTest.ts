// Service de test de connectivité pour l'application mobile
import { API_BASE_URL } from '../config/api';

export interface ConnectivityResult {
    success: boolean;
    endpoint: string;
    status?: number;
    error?: string;
    responseTime?: number;
}

// Test de connectivité vers un endpoint spécifique
export const testEndpoint = async (endpoint: string): Promise<ConnectivityResult> => {
    const startTime = Date.now();

    try {
        console.log(`[ConnectivityTest] Testing endpoint: ${API_BASE_URL}${endpoint}`);

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(10000), // 10 secondes timeout
        });

        const responseTime = Date.now() - startTime;

        return {
            success: response.ok,
            endpoint,
            status: response.status,
            responseTime,
        };
    } catch (error: any) {
        const responseTime = Date.now() - startTime;

        return {
            success: false,
            endpoint,
            error: error.message || 'Unknown error',
            responseTime,
        };
    }
};

// Test de connectivité vers le backend principal
export const testBackendConnectivity = async (): Promise<ConnectivityResult> => {
    return testEndpoint('/healthz');
};

// Test de connectivité vers l'API utilisateur (nécessite authentification)
export const testUserApiConnectivity = async (): Promise<ConnectivityResult> => {
    return testEndpoint('/api/user/me');
};

// Test de connectivité vers l'API des services
export const testServicesApiConnectivity = async (): Promise<ConnectivityResult> => {
    return testEndpoint('/api/services');
};

// Test complet de connectivité
export const runFullConnectivityTest = async (): Promise<{
    backend: ConnectivityResult;
    userApi: ConnectivityResult;
    servicesApi: ConnectivityResult;
    timestamp: number;
}> => {
    console.log('[ConnectivityTest] Starting full connectivity test...');

    const [backend, userApi, servicesApi] = await Promise.all([
        testBackendConnectivity(),
        testUserApiConnectivity(),
        testServicesApiConnectivity(),
    ]);

    const result = {
        backend,
        userApi,
        servicesApi,
        timestamp: Date.now(),
    };

    console.log('[ConnectivityTest] Full test completed:', result);

    return result;
};

// Service de vérification périodique de connectivité
export class ConnectivityMonitor {
    private intervalId: NodeJS.Timeout | null = null;
    private onStatusChange?: (connected: boolean) => void;

    constructor(onStatusChange?: (connected: boolean) => void) {
        this.onStatusChange = onStatusChange;
    }

    start(intervalMs: number = 30000): void {
        if (this.intervalId) {
            this.stop();
        }

        console.log(`[ConnectivityMonitor] Starting monitoring with ${intervalMs}ms interval`);

        this.intervalId = setInterval(async () => {
            try {
                const result = await testBackendConnectivity();
                this.onStatusChange?.(result.success);
            } catch (error) {
                console.error('[ConnectivityMonitor] Error during connectivity check:', error);
                this.onStatusChange?.(false);
            }
        }, intervalMs);
    }

    stop(): void {
        if (this.intervalId) {
            console.log('[ConnectivityMonitor] Stopping monitoring');
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    isMonitoring(): boolean {
        return this.intervalId !== null;
    }
}

export default {
    testEndpoint,
    testBackendConnectivity,
    testUserApiConnectivity,
    testServicesApiConnectivity,
    runFullConnectivityTest,
    ConnectivityMonitor,
};
