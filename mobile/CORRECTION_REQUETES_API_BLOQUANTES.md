# Correction des requêtes API bloquantes dans HomeScreen

## Date: 2025-12-11

## Problème identifié
Les logs backend montrent de nombreuses requêtes avec `responseBytes=114` (probablement des erreurs 404/401) qui sont faites en boucle toutes les 5 minutes. Ces requêtes échouées pourraient causer des blocages dans l'interface utilisateur.

## Analyse des logs backend
```
2025-12-11T06:49:44Z clientIP="129.0.77.246" requestID="b1322ba7-980d-409f" responseTimeMS=729 responseBytes=114
2025-12-11T06:49:46Z clientIP="129.0.77.246" requestID="6cb98c6b-7394-462c" responseTimeMS=109 responseBytes=114
...
```

**Caractéristiques observées:**
- `responseBytes=114` : Très petit, probablement une erreur HTTP (404, 401, etc.)
- Fréquence élevée : Requêtes toutes les 1-2 secondes
- User-Agent: `okhttp/4.12.0` (Android)
- Même IP client : `129.0.77.246`

## Cause racine
Le `setInterval` dans `HomeScreen.tsx` rafraîchit les notifications toutes les 5 minutes sans mécanisme de gestion d'erreur robuste. Si ces requêtes échouent (404, 401, timeout), elles continuent à être faites en boucle, ce qui peut :
1. Surcharger le backend
2. Causer des problèmes de performance dans le frontend
3. Potentiellement bloquer l'UI si les erreurs ne sont pas correctement gérées

## Corrections appliquées

### 1. Mécanisme de backoff exponentiel
**Avant:**
```typescript
const interval = setInterval(() => {
    refreshNotifications();
}, 300000); // 5 minutes fixe
```

**Après:**
```typescript
let consecutiveErrors = 0;
let currentInterval = 300000; // 5 minutes par défaut

const refreshNotifications = async () => {
    try {
        const count = await loadUnreadNotificationsCount();
        dispatch({ type: 'SET_UNREAD_NOTIFICATIONS', payload: count });
        consecutiveErrors = 0; // Réinitialiser en cas de succès
        currentInterval = 300000; // Réinitialiser à 5 minutes
    } catch (error) {
        consecutiveErrors++;
        // Backoff exponentiel - doubler l'intervalle à chaque erreur
        if (consecutiveErrors < 3) {
            currentInterval = Math.min(currentInterval * 2, 1800000); // Max 30 minutes
            // Redémarrer l'intervalle avec le nouvel intervalle
            if (intervalId) {
                clearInterval(intervalId);
            }
            intervalId = setInterval(refreshNotifications, currentInterval);
        }
    }
};
```

### 2. Protection contre les requêtes simultanées
**Ajouté:**
```typescript
let isRefreshing = false;

const refreshNotifications = async () => {
    if (isRefreshing) {
        console.log('[HomeScreen] ⏸️ Rafraîchissement notifications déjà en cours, ignoré');
        return;
    }
    isRefreshing = true;
    try {
        // ... requête API ...
    } finally {
        isRefreshing = false;
    }
};
```

### 3. Arrêt automatique après erreurs répétées
**Ajouté:**
```typescript
// Arrêter les requêtes si trop d'erreurs consécutives (max 3 erreurs)
if (consecutiveErrors >= 3) {
    console.warn('[HomeScreen] ⚠️ Trop d\'erreurs consécutives, arrêt du rafraîchissement automatique');
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    return;
}
```

### 4. Délai initial pour ne pas bloquer le rendu
**Ajouté:**
```typescript
// Premier rafraîchissement avec délai pour ne pas bloquer le rendu initial
const initialTimeout = setTimeout(() => {
    refreshNotifications();
}, 2000); // 2 secondes après le montage
```

## Comportement après correction

### Scénario 1: Requêtes réussies
- Intervalle normal : 5 minutes
- Pas de backoff
- Rafraîchissement continu

### Scénario 2: 1 erreur
- Intervalle doublé : 10 minutes
- Retry automatique
- Compteur d'erreurs : 1/3

### Scénario 3: 2 erreurs consécutives
- Intervalle doublé : 20 minutes
- Retry automatique
- Compteur d'erreurs : 2/3

### Scénario 4: 3 erreurs consécutives
- **Arrêt automatique** du rafraîchissement
- Plus de requêtes en boucle
- Log d'avertissement

### Scénario 5: Succès après erreurs
- Réinitialisation du compteur d'erreurs
- Retour à l'intervalle normal (5 minutes)
- Reprise du rafraîchissement automatique

## Avantages

1. **Réduction de la charge backend** : Moins de requêtes en cas d'erreur
2. **Meilleure performance** : Pas de requêtes simultanées
3. **Résilience** : Arrêt automatique après erreurs répétées
4. **Expérience utilisateur** : Pas de blocage de l'UI
5. **Récupération automatique** : Retour à la normale en cas de succès

## Fichiers modifiés

- `mobile/src/screens/HomeScreen.tsx`
  - Lignes 530-569: Ajout du mécanisme de backoff exponentiel et protection contre les requêtes en boucle

## Tests recommandés

1. **Test de succès** : Vérifier que les notifications se rafraîchissent normalement toutes les 5 minutes
2. **Test d'erreur unique** : Simuler une erreur et vérifier que l'intervalle double
3. **Test d'erreurs multiples** : Simuler 3 erreurs consécutives et vérifier l'arrêt automatique
4. **Test de récupération** : Après des erreurs, vérifier que le rafraîchissement reprend en cas de succès
5. **Test de requêtes simultanées** : Vérifier qu'une nouvelle requête n'est pas lancée si une est déjà en cours

## Notes importantes

- Le backoff exponentiel double l'intervalle à chaque erreur, avec un maximum de 30 minutes
- Après 3 erreurs consécutives, le rafraîchissement automatique s'arrête complètement
- Le rafraîchissement peut être relancé manuellement via pull-to-refresh
- Le délai initial de 2 secondes évite de bloquer le rendu initial de l'écran

## Monitoring recommandé

Pour surveiller l'efficacité de cette correction :
1. Surveiller les logs backend pour voir la réduction des requêtes avec `responseBytes=114`
2. Surveiller les logs frontend pour voir les messages de backoff et d'arrêt automatique
3. Surveiller les métriques de performance de l'application mobile

