/**
 * Script de test/diagnostic pour la détection des produits existants
 * 
 * Ce script capture toutes les informations nécessaires pour analyser
 * pourquoi la détection des produits peut échouer.
 */

import { apiGet } from '../services/api';
import { normalizeServiceProducts } from './productNormalizer';

export interface DetectionTestResult {
    timestamp: string;
    userId: string | number;
    email: string;
    attempts: Array<{
        endpoint: string;
        success: boolean;
        error?: any;
        responseStructure?: any;
        servicesFound?: number;
        servicesWithProducts?: number;
        productsFound?: number;
        sampleService?: any;
        sampleProducts?: any;
    }>;
    finalDecision: 'AjouterProduitSimple' | 'FormulaireYukpoIntelligent' | 'ERROR';
    hasExistingServiceWithProducts: boolean;
    firstServiceId: number | null;
    reason: string;
    diagnostic: {
        allServices: any[];
        allProducts: any[];
        servicesStructure: any;
        productsStructure: any;
    };
}

/**
 * Test complet de détection des produits
 */
export const runProductDetectionTest = async (
    userId: string | number,
    email: string
): Promise<DetectionTestResult> => {
    const result: DetectionTestResult = {
        timestamp: new Date().toISOString(),
        userId,
        email,
        attempts: [],
        finalDecision: 'ERROR',
        hasExistingServiceWithProducts: false,
        firstServiceId: null,
        reason: '',
        diagnostic: {
            allServices: [],
            allProducts: [],
            servicesStructure: {},
            productsStructure: {}
        }
    };

    console.log('[ProductDetectionTest] 🧪 Début du test de détection pour:', email);

    // Helper: Vérifier si un service a des produits
    const serviceHasProducts = (service: any): boolean => {
        try {
            const produits = normalizeServiceProducts(service.data?.produits || service.produits);
            return Array.isArray(produits) && produits.length > 0;
        } catch (error) {
            console.error('[ProductDetectionTest] Erreur serviceHasProducts:', error);
            return false;
        }
    };

    // TENTATIVE 1: /api/prestataire/services
    try {
        console.log('[ProductDetectionTest] 📡 Tentative 1: /api/prestataire/services');
        const prestataireServicesResponse = await apiGet('/api/prestataire/services');

        const attempt1 = {
            endpoint: '/api/prestataire/services',
            success: prestataireServicesResponse.success,
            responseStructure: {
                hasData: !!prestataireServicesResponse.data,
                isArray: Array.isArray(prestataireServicesResponse.data),
                length: Array.isArray(prestataireServicesResponse.data)
                    ? prestataireServicesResponse.data.length
                    : 0,
                type: typeof prestataireServicesResponse.data,
                keys: prestataireServicesResponse.data && typeof prestataireServicesResponse.data === 'object'
                    ? Object.keys(prestataireServicesResponse.data)
                    : []
            },
            servicesFound: 0,
            servicesWithProducts: 0,
            productsFound: 0,
            sampleService: null as any,
            sampleProducts: null as any
        };

        if (prestataireServicesResponse.success && Array.isArray(prestataireServicesResponse.data)) {
            attempt1.servicesFound = prestataireServicesResponse.data.length;
            result.diagnostic.allServices = prestataireServicesResponse.data;

            for (const service of prestataireServicesResponse.data) {
                if (serviceHasProducts(service)) {
                    attempt1.servicesWithProducts++;
                    const produits = normalizeServiceProducts(service.data?.produits || service.produits);
                    attempt1.productsFound += produits.length;

                    if (!attempt1.sampleService) {
                        attempt1.sampleService = {
                            id: service.id || service.service_id,
                            hasData: !!service.data,
                            hasProduits: !!service.data?.produits,
                            hasProduitsDirect: !!service.produits,
                            produitsType: typeof (service.data?.produits || service.produits),
                            produitsStructure: service.data?.produits || service.produits
                        };
                        attempt1.sampleProducts = produits.slice(0, 2); // Premier 2 produits
                    }

                    if (!result.hasExistingServiceWithProducts) {
                        result.hasExistingServiceWithProducts = true;
                        result.firstServiceId = service.id || service.service_id || null;
                    }
                }
            }
        } else if (!prestataireServicesResponse.success) {
            attempt1.error = prestataireServicesResponse.error || 'Unknown error';
        }

        result.attempts.push(attempt1);
        console.log('[ProductDetectionTest] ✅ Tentative 1 terminée:', attempt1);
    } catch (error: any) {
        result.attempts.push({
            endpoint: '/api/prestataire/services',
            success: false,
            error: {
                message: error?.message,
                stack: error?.stack,
                response: error?.response?.data
            }
        });
        console.error('[ProductDetectionTest] ❌ Erreur tentative 1:', error);
    }

    // FALLBACK 1: /api/services/last
    if (!result.hasExistingServiceWithProducts) {
        try {
            console.log('[ProductDetectionTest] 📡 Fallback 1: /api/services/last');
            const lastServiceResponse = await apiGet('/api/services/last');

            const attempt2 = {
                endpoint: '/api/services/last',
                success: lastServiceResponse.success,
                responseStructure: {
                    hasData: !!lastServiceResponse.data,
                    type: typeof lastServiceResponse.data,
                    keys: lastServiceResponse.data && typeof lastServiceResponse.data === 'object'
                        ? Object.keys(lastServiceResponse.data)
                        : []
                },
                servicesFound: 0,
                servicesWithProducts: 0,
                productsFound: 0,
                sampleService: null as any,
                sampleProducts: null as any
            };

            if (lastServiceResponse.data) {
                const serviceData = (lastServiceResponse.data as any)?.data || lastServiceResponse.data;
                attempt2.servicesFound = 1;

                if (serviceHasProducts(serviceData)) {
                    attempt2.servicesWithProducts = 1;
                    const produits = normalizeServiceProducts(serviceData.data?.produits || serviceData.produits);
                    attempt2.productsFound = produits.length;

                    attempt2.sampleService = {
                        id: serviceData.id || serviceData.service_id,
                        hasData: !!serviceData.data,
                        hasProduits: !!serviceData.data?.produits,
                        hasProduitsDirect: !!serviceData.produits,
                        produitsType: typeof (serviceData.data?.produits || serviceData.produits),
                        produitsStructure: serviceData.data?.produits || serviceData.produits
                    };
                    attempt2.sampleProducts = produits.slice(0, 2);

                    result.hasExistingServiceWithProducts = true;
                    result.firstServiceId = serviceData.id || serviceData.service_id || null;
                }
            } else if (!lastServiceResponse.success) {
                attempt2.error = lastServiceResponse.error || 'Unknown error';
            }

            result.attempts.push(attempt2);
            console.log('[ProductDetectionTest] ✅ Fallback 1 terminé:', attempt2);
        } catch (error: any) {
            result.attempts.push({
                endpoint: '/api/services/last',
                success: false,
                error: {
                    message: error?.message,
                    stack: error?.stack
                }
            });
            console.error('[ProductDetectionTest] ❌ Erreur fallback 1:', error);
        }
    }

    // FALLBACK 2: /api/services/my-services
    if (!result.hasExistingServiceWithProducts) {
        try {
            console.log('[ProductDetectionTest] 📡 Fallback 2: /api/services/my-services');
            const servicesResponse = await apiGet('/api/services/my-services');

            const attempt3 = {
                endpoint: '/api/services/my-services',
                success: servicesResponse.success,
                responseStructure: {
                    hasData: !!servicesResponse.data,
                    isArray: Array.isArray(servicesResponse.data),
                    length: Array.isArray(servicesResponse.data)
                        ? servicesResponse.data.length
                        : 0
                },
                servicesFound: 0,
                servicesWithProducts: 0,
                productsFound: 0,
                sampleService: null as any,
                sampleProducts: null as any
            };

            if (servicesResponse.success && Array.isArray(servicesResponse.data)) {
                attempt3.servicesFound = servicesResponse.data.length;

                for (const service of servicesResponse.data) {
                    if (serviceHasProducts(service)) {
                        attempt3.servicesWithProducts++;
                        const produits = normalizeServiceProducts(service.data?.produits || service.produits);
                        attempt3.productsFound += produits.length;

                        if (!attempt3.sampleService) {
                            attempt3.sampleService = {
                                id: service.id || service.service_id,
                                hasData: !!service.data,
                                hasProduits: !!service.data?.produits,
                                hasProduitsDirect: !!service.produits,
                                produitsType: typeof (service.data?.produits || service.produits),
                                produitsStructure: service.data?.produits || service.produits
                            };
                            attempt3.sampleProducts = produits.slice(0, 2);
                        }

                        if (!result.hasExistingServiceWithProducts) {
                            result.hasExistingServiceWithProducts = true;
                            result.firstServiceId = service.id || service.service_id || null;
                        }
                    }
                }
            } else if (!servicesResponse.success) {
                attempt3.error = servicesResponse.error || 'Unknown error';
            }

            result.attempts.push(attempt3);
            console.log('[ProductDetectionTest] ✅ Fallback 2 terminé:', attempt3);
        } catch (error: any) {
            result.attempts.push({
                endpoint: '/api/services/my-services',
                success: false,
                error: {
                    message: error?.message,
                    stack: error?.stack
                }
            });
            console.error('[ProductDetectionTest] ❌ Erreur fallback 2:', error);
        }
    }

    // FALLBACK 3: /api/products/my-products
    if (!result.hasExistingServiceWithProducts) {
        try {
            console.log('[ProductDetectionTest] 📡 Fallback 3: /api/products/my-products');
            const productsResponse = await apiGet('/api/products/my-products');

            const attempt4 = {
                endpoint: '/api/products/my-products',
                success: productsResponse.success,
                responseStructure: {
                    hasData: !!productsResponse.data,
                    isArray: Array.isArray(productsResponse.data),
                    length: Array.isArray(productsResponse.data)
                        ? productsResponse.data.length
                        : 0
                },
                servicesFound: 0,
                servicesWithProducts: 0,
                productsFound: 0,
                sampleService: null as any,
                sampleProducts: null as any
            };

            if (productsResponse.success && Array.isArray(productsResponse.data) && productsResponse.data.length > 0) {
                attempt4.productsFound = productsResponse.data.length;
                result.diagnostic.allProducts = productsResponse.data;

                const firstProduct = productsResponse.data[0];
                attempt4.sampleProducts = [firstProduct];

                const serviceId = firstProduct.service_id
                    || firstProduct.serviceId
                    || firstProduct.service?.id
                    || (firstProduct as any).service_id_from_product
                    || (firstProduct as any).parent_service_id;

                if (serviceId) {
                    attempt4.servicesFound = 1;
                    attempt4.servicesWithProducts = 1;
                    attempt4.sampleService = {
                        serviceId: serviceId,
                        productKeys: Object.keys(firstProduct),
                        hasServiceId: !!firstProduct.service_id,
                        hasServiceIdAlt: !!firstProduct.serviceId,
                        hasServiceObject: !!firstProduct.service
                    };

                    result.hasExistingServiceWithProducts = true;
                    result.firstServiceId = serviceId;
                } else {
                    attempt4.error = 'service_id manquant dans les produits';
                }
            } else if (!productsResponse.success) {
                attempt4.error = productsResponse.error || 'Unknown error';
            }

            result.attempts.push(attempt4);
            console.log('[ProductDetectionTest] ✅ Fallback 3 terminé:', attempt4);
        } catch (error: any) {
            result.attempts.push({
                endpoint: '/api/products/my-products',
                success: false,
                error: {
                    message: error?.message,
                    stack: error?.stack
                }
            });
            console.error('[ProductDetectionTest] ❌ Erreur fallback 3:', error);
        }
    }

    // Décision finale
    if (result.hasExistingServiceWithProducts && result.firstServiceId) {
        result.finalDecision = 'AjouterProduitSimple';
        result.reason = `Service ID ${result.firstServiceId} a des produits`;
    } else {
        result.finalDecision = 'FormulaireYukpoIntelligent';
        result.reason = 'Aucun service avec produits détecté';
    }

    // Analyse de la structure
    if (result.diagnostic.allServices.length > 0) {
        const firstService = result.diagnostic.allServices[0];
        result.diagnostic.servicesStructure = {
            hasId: !!firstService.id,
            hasServiceId: !!firstService.service_id,
            hasData: !!firstService.data,
            dataKeys: firstService.data ? Object.keys(firstService.data) : [],
            hasProduits: !!firstService.data?.produits,
            hasProduitsDirect: !!firstService.produits,
            produitsType: typeof (firstService.data?.produits || firstService.produits),
            produitsIsArray: Array.isArray(firstService.data?.produits || firstService.produits),
            produitsKeys: firstService.data?.produits && typeof firstService.data.produits === 'object'
                ? Object.keys(firstService.data.produits)
                : []
        };
    }

    if (result.diagnostic.allProducts.length > 0) {
        const firstProduct = result.diagnostic.allProducts[0];
        result.diagnostic.productsStructure = {
            keys: Object.keys(firstProduct),
            hasServiceId: !!firstProduct.service_id,
            hasServiceIdAlt: !!firstProduct.serviceId,
            hasServiceObject: !!firstProduct.service,
            serviceIdValue: firstProduct.service_id || firstProduct.serviceId || firstProduct.service?.id
        };
    }

    console.log('[ProductDetectionTest] 🎯 Résultat final:', {
        hasExistingServiceWithProducts: result.hasExistingServiceWithProducts,
        firstServiceId: result.firstServiceId,
        finalDecision: result.finalDecision,
        reason: result.reason
    });

    return result;
};

/**
 * Affiche le résultat du test de manière lisible
 */
export const formatTestResult = (result: DetectionTestResult): string => {
    let output = '\n';
    output += '═══════════════════════════════════════════════════════════════\n';
    output += '🧪 RÉSULTAT DU TEST DE DÉTECTION DES PRODUITS\n';
    output += '═══════════════════════════════════════════════════════════════\n';
    output += `📅 Timestamp: ${result.timestamp}\n`;
    output += `👤 Utilisateur: ${result.email} (ID: ${result.userId})\n`;
    output += '\n';
    output += '📊 TENTATIVES:\n';
    output += '───────────────────────────────────────────────────────────────\n';

    result.attempts.forEach((attempt, index) => {
        output += `\n${index + 1}. ${attempt.endpoint}\n`;
        output += `   ✅ Succès: ${attempt.success ? 'OUI' : 'NON'}\n`;

        if (attempt.error) {
            output += `   ❌ Erreur: ${JSON.stringify(attempt.error, null, 2)}\n`;
        }

        if (attempt.responseStructure) {
            output += `   📦 Structure: ${JSON.stringify(attempt.responseStructure, null, 2)}\n`;
        }

        if (attempt.servicesFound !== undefined) {
            output += `   📋 Services trouvés: ${attempt.servicesFound}\n`;
            output += `   🛍️ Services avec produits: ${attempt.servicesWithProducts}\n`;
            output += `   📦 Produits trouvés: ${attempt.productsFound}\n`;
        }

        if (attempt.sampleService) {
            output += `   🔍 Exemple service: ${JSON.stringify(attempt.sampleService, null, 2)}\n`;
        }

        if (attempt.sampleProducts) {
            output += `   🔍 Exemple produits: ${JSON.stringify(attempt.sampleProducts, null, 2)}\n`;
        }
    });

    output += '\n';
    output += '🎯 DÉCISION FINALE:\n';
    output += '───────────────────────────────────────────────────────────────\n';
    output += `✅ Service avec produits: ${result.hasExistingServiceWithProducts ? 'OUI' : 'NON'}\n`;
    output += `🆔 Service ID: ${result.firstServiceId || 'N/A'}\n`;
    output += `📱 Navigation: ${result.finalDecision}\n`;
    output += `💡 Raison: ${result.reason}\n`;

    output += '\n';
    output += '🔬 DIAGNOSTIC:\n';
    output += '───────────────────────────────────────────────────────────────\n';
    output += `📋 Total services: ${result.diagnostic.allServices.length}\n`;
    output += `🛍️ Total produits: ${result.diagnostic.allProducts.length}\n`;

    if (Object.keys(result.diagnostic.servicesStructure).length > 0) {
        output += `\n📦 Structure services:\n${JSON.stringify(result.diagnostic.servicesStructure, null, 2)}\n`;
    }

    if (Object.keys(result.diagnostic.productsStructure).length > 0) {
        output += `\n📦 Structure produits:\n${JSON.stringify(result.diagnostic.productsStructure, null, 2)}\n`;
    }

    output += '\n';
    output += '═══════════════════════════════════════════════════════════════\n';

    return output;
};

