# Corrections - Écran d'inscription coursier

## Date: 2025-12-13

## Problèmes corrigés

### 1. ✅ Nom complet affiché en double

**Problème**: Le champ "Nom complet" affichait le nom de l'utilisateur en double (ex: "Jean Dupont Jean Dupont")

**Solution**: 
- Ajout d'une fonction `getCleanName()` qui :
  - Nettoie les espaces multiples
  - Détecte les duplications (nom répété deux fois)
  - Retourne seulement la première moitié si c'est dupliqué
- Utilisation d'un `useRef` pour éviter les mises à jour multiples

**Code**:
```typescript
const getCleanName = (name: string | undefined): string => {
    if (!name) return '';
    const cleaned = name.trim().replace(/\s+/g, ' ');
    const parts = cleaned.split(' ');
    if (parts.length >= 4) {
        const firstHalf = parts.slice(0, Math.floor(parts.length / 2)).join(' ');
        const secondHalf = parts.slice(Math.floor(parts.length / 2)).join(' ');
        if (firstHalf === secondHalf) {
            return firstHalf; // Retourner seulement la première moitié si c'est dupliqué
        }
    }
    return cleaned;
};
```

### 2. ✅ Chargement automatique du téléphone depuis WhatsApp

**Problème**: Le champ téléphone restait vide même si l'utilisateur avait déjà un service/produit avec un numéro WhatsApp

**Solution**:
- Ajout d'une fonction `loadUserPhoneFromServices()` qui :
  - Récupère les services de l'utilisateur via `/api/prestataire/services`
  - Cherche le WhatsApp dans différentes structures possibles :
    - `serviceData.whatsapp`
    - `serviceData.whatsapp_contact?.valeur`
    - `serviceData.contact?.whatsapp`
    - `serviceData.contact_whatsapp?.valeur`
    - `serviceData.telephone_whatsapp?.valeur`
  - Charge automatiquement le premier WhatsApp trouvé dans le champ téléphone
  - Ne s'exécute que si le champ téléphone est vide (ne pas écraser une valeur existante)

**Code**:
```typescript
const loadUserPhoneFromServices = async () => {
    if (!user?.id || phone) return; // Ne pas écraser si déjà rempli

    try {
        const { apiGet } = require('../../services/api');
        const response = await apiGet('/api/prestataire/services');
        const services = response.data || response;

        if (Array.isArray(services) && services.length > 0) {
            for (const service of services) {
                const serviceData = service.data || service;
                const whatsapp = serviceData.whatsapp || 
                               serviceData.whatsapp_contact?.valeur ||
                               serviceData.contact?.whatsapp ||
                               serviceData.contact_whatsapp?.valeur ||
                               serviceData.telephone_whatsapp?.valeur;

                if (whatsapp && typeof whatsapp === 'string' && whatsapp.trim().length > 0) {
                    setPhone(whatsapp.trim());
                    return;
                }
            }
        }
    } catch (error) {
        console.error('[CourierRegistrationScreen] Erreur chargement téléphone depuis services:', error);
    }
};
```

## Fichier modifié

- `mobile/src/screens/delivery/CourierRegistrationScreen.tsx`

## Changements

1. ✅ Ajout de `useRef` dans les imports React
2. ✅ Ajout de la fonction `getCleanName()` pour nettoyer le nom
3. ✅ Modification de l'initialisation de `fullName` pour utiliser `getCleanName()`
4. ✅ Ajout de `loadUserPhoneFromServices()` pour charger le téléphone
5. ✅ Appel de `loadUserPhoneFromServices()` dans le `useEffect` initial

## Comportement attendu

1. **Nom complet**:
   - S'affiche correctement sans duplication
   - Si le nom est dupliqué (ex: "Jean Dupont Jean Dupont"), seul "Jean Dupont" s'affiche
   - Les espaces multiples sont nettoyés

2. **Téléphone**:
   - Si l'utilisateur a déjà un service/produit avec WhatsApp, le numéro est chargé automatiquement
   - Si l'utilisateur n'a pas de service ou pas de WhatsApp, le champ reste vide (comportement normal)
   - Si l'utilisateur modifie manuellement le téléphone, la valeur n'est pas écrasée

## Tests à effectuer

1. ✅ Ouvrir l'écran d'inscription coursier
2. ✅ Vérifier que le nom complet ne s'affiche pas en double
3. ✅ Vérifier que le téléphone est chargé automatiquement si l'utilisateur a un service avec WhatsApp
4. ✅ Vérifier que le téléphone reste vide si l'utilisateur n'a pas de service
5. ✅ Vérifier que le téléphone peut être modifié manuellement





