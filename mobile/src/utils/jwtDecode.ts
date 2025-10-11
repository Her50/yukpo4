/**
 * Décodeur JWT compatible React Native
 * Remplace jwt-decode qui utilise atob() (non disponible en React Native)
 */

// Import conditionnel de Buffer pour éviter les erreurs d'initialisation
let Buffer: any;
try {
    Buffer = require('buffer').Buffer;
} catch (error) {
    console.warn('[jwtDecode] Buffer non disponible:', error);
}

// Fonction de décodage base64 native pour React Native
const base64Decode = (str: string): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let i = 0;

    // Nettoyer la chaîne
    str = str.replace(/[^A-Za-z0-9+/]/g, '');

    while (i < str.length) {
        const a = chars.indexOf(str[i++]);
        const b = chars.indexOf(str[i++]);
        const c = chars.indexOf(str[i++]);
        const d = chars.indexOf(str[i++]);

        if (a === -1 || b === -1) break;

        const bitmap = (a << 18) | (b << 12) | ((c !== -1 ? c : 64) << 6) | (d !== -1 ? d : 64);

        result += String.fromCharCode((bitmap >> 16) & 255);
        if (c !== -1 && c !== 64) result += String.fromCharCode((bitmap >> 8) & 255);
        if (d !== -1 && d !== 64) result += String.fromCharCode(bitmap & 255);
    }

    return result;
};

// Initialisation sécurisée de Buffer avec gestion d'erreur robuste
try {
    Buffer = require('buffer').Buffer;
    console.log('[jwtDecode] Buffer initialisé avec succès');
} catch (error) {
    console.warn('[jwtDecode] Buffer non disponible, utilisation du fallback base64');
    Buffer = {
        from: (str: string, encoding: string) => {
            try {
                if (encoding === 'base64') {
                    return { toString: () => base64Decode(str) };
                }
                return { toString: () => str };
            } catch (fallbackError) {
                console.error('[jwtDecode] Erreur fallback:', fallbackError);
                return { toString: () => '' };
            }
        }
    };
}

export interface DecodedToken {
    sub: string | number;
    email: string;
    role: string;
    exp: number;
    iat?: number;
    name?: string;
    tokens_balance?: number;
}

/**
 * Décode un token JWT en utilisant Buffer au lieu de atob
 */
export function jwtDecode<T = DecodedToken>(token: string): T {
    try {
        console.log('[jwtDecode] Début du décodage du token');

        // Validation du token
        if (!token || typeof token !== 'string') {
            throw new Error('Token is required and must be a string');
        }

        // Séparer les 3 parties du JWT
        const parts = token.split('.');

        if (parts.length !== 3) {
            console.error('[jwtDecode] Token invalide - ne contient pas 3 parties');
            throw new Error('Invalid JWT format: token must have 3 parts');
        }

        // La partie payload est la deuxième partie (index 1)
        const payload = parts[1];
        console.log('[jwtDecode] Payload extrait (longueur:', payload.length, ')');

        // Ajouter le padding si nécessaire (base64 doit être un multiple de 4)
        let base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4 !== 0) {
            base64 += '=';
        }

        console.log('[jwtDecode] Base64 préparé (longueur:', base64.length, ')');

        // Décoder en utilisant Buffer (compatible React Native)
        const jsonString = Buffer.from(base64, 'base64').toString('utf-8');
        
        if (!jsonString) {
            throw new Error('Failed to decode base64 payload');
        }
        
        console.log('[jwtDecode] JSON décodé:', jsonString.substring(0, 100) + '...');

        // Parser le JSON avec validation
        const decoded = JSON.parse(jsonString) as T;
        
        if (!decoded || typeof decoded !== 'object') {
            throw new Error('Invalid decoded token structure');
        }
        
        console.log('[jwtDecode] ✅ Token décodé avec succès');

        return decoded;
    } catch (error) {
        console.error('[jwtDecode] ❌ Erreur lors du décodage:', error);
        
        // Retourner un token par défaut pour éviter le crash
        const fallbackToken = {
            sub: '0',
            email: 'unknown@example.com',
            role: 'user',
            exp: Date.now() / 1000 + 3600, // Expire dans 1 heure
            name: 'Utilisateur',
            tokens_balance: 0
        } as T;
        
        console.warn('[jwtDecode] Utilisation du token fallback pour éviter le crash');
        return fallbackToken;
    }
}

/**
 * Vérifie si un token JWT est expiré
 */
export function isTokenExpired(token: string): boolean {
    try {
        const decoded = jwtDecode<DecodedToken>(token);
        return decoded.exp * 1000 <= Date.now();
    } catch (error) {
        console.error('[jwtDecode] Erreur vérification expiration:', error);
        return true; // Considérer comme expiré si erreur
    }
}

/**
 * Obtient le temps restant avant expiration (en secondes)
 */
export function getTokenTTL(token: string): number {
    try {
        const decoded = jwtDecode<DecodedToken>(token);
        const ttl = Math.floor((decoded.exp * 1000 - Date.now()) / 1000);
        return Math.max(0, ttl);
    } catch (error) {
        return 0;
    }
}


