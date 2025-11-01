# 🐛 Debug Scroll Automatique MixedContentCarousel

## 🔍 Problème Rapporté
- **Symptôme** : Pas de scroll automatique dans HomeScreen
- **Situation** : Il y a des produits dans la base de données
- **Composant** : MixedContentCarousel

---

## 🕵️ Points de Vérification

### 1. **Logs Console à Vérifier**

Ouvre la console mobile et cherche ces logs :

```
[MixedContentCarousel] 🎬 Démarrage chargement contenu mixte...
[MixedContentCarousel] 🔗 Appel API: /api/content/mixed?...
[MixedContentCarousel] 📦 Réponse API: { success: true, hasData: true, dataLength: X }
```

**Si tu vois** :
- ✅ `dataLength: 5` ou plus → API fonctionne
- ⚠️ `dataLength: 0` ou `hasData: false` → Problème API backend
- ⚠️ `Pas de contenu mixte, chargement des produits organiques...` → Endpoint `/api/content/mixed` échoue
- ⚠️ `Aucun produit organique trouvé` → Les 2 endpoints échouent

---

### 2. **Conditions du Scroll Automatique**

Le scroll automatique **NE DÉMARRE PAS** si :

#### Condition 1 : Moins de 2 éléments
```typescript
// Ligne 205 de MixedContentCarousel.tsx
if (content.length <= 1 || isPaused) {
    return; // ← PAS DE SCROLL si 1 seul élément !
}
```

**Solution** : Il faut **AU MOINS 2 produits/services** en base de données

#### Condition 2 : isPaused = true
```typescript
const [isPaused, setIsPaused] = useState(false);
```
- Si l'utilisateur a scrollé manuellement, `isPaused` devient `true` pendant 3s
- Vérifie dans la console : `isPaused` devrait être `false`

#### Condition 3 : scrollViewRef null
```typescript
// Ligne 218
if (!scrollViewRef.current) {
    return; // ← PAS DE SCROLL si ref null
}
```

---

### 3. **Endpoints API à Vérifier**

#### Endpoint Principal
```
GET /api/content/mixed?session_id=...&user_id=...&categories=...
```

**Réponse attendue** :
```json
{
  "success": true,
  "data": [
    {
      "type": "organic",
      "is_paid": false,
      "data": { "id": "...", "nom": "...", "images": [...] }
    },
    // ... au moins 2 éléments
  ]
}
```

#### Endpoint Fallback 1
```
GET /api/services/recent?limit=20&include_products=true
```

#### Endpoint Fallback 2
```
GET /api/services?limit=20
```

**Vérification** :
1. Ouvre Postman ou curl
2. Teste : `curl http://localhost:3001/api/services/recent?limit=20`
3. Vérifie qu'il retourne au moins 2 services

---

### 4. **Structure des Données**

Le carousel attend cette structure :

```typescript
{
  data: {
    id: string,
    nom: string,
    images?: string[],
    videos?: string[],
    prix?: number,
    // ...
  }
}
```

**Si les produits n'ont pas d'images** :
- Le délai sera de 5s par défaut
- Mais ça devrait quand même scroller

---

## 🔧 Solutions Selon le Problème

### Problème A : `content.length = 0`

**Diagnostic** : Endpoints API ne retournent rien

**Solution** :
1. Vérifie que tu as des services créés :
   ```sql
   SELECT COUNT(*) FROM services WHERE active = true;
   ```
2. Vérifie le backend Rust :
   ```bash
   cd backend
   cargo run
   # Regarde les logs de l'API
   ```
3. Teste l'endpoint manuellement :
   ```bash
   curl http://localhost:3001/api/services/recent?limit=20
   ```

---

### Problème B : `content.length = 1`

**Diagnostic** : 1 seul produit en DB

**Solution** : **Crée au moins 1 autre service/produit**
- Le scroll automatique nécessite **minimum 2 éléments**

---

### Problème C : `content.length >= 2` mais pas de scroll

**Diagnostic** : Le timer ne se déclenche pas

**Solutions possibles** :

#### Solution 1 : Forcer le scroll initial
Ajoute un log dans le `useEffect` ligne 204 :

```typescript
useEffect(() => {
    console.log('[Scroll Debug]', {
        contentLength: content.length,
        isPaused,
        currentIndex,
        currentItem: content[currentIndex]
    });
    
    if (content.length <= 1 || isPaused) {
        console.log('[Scroll Debug] Scroll annulé:', content.length <= 1 ? 'Pas assez d\'éléments' : 'En pause');
        return;
    }
    // ...
}, [currentIndex, content, isPaused]);
```

#### Solution 2 : Vérifier le timer
Le délai par défaut est **5000ms (5 secondes)**. Attends 5 secondes pour voir si le scroll se déclenche.

#### Solution 3 : Scroll manuel pour tester
- Scrolle manuellement dans le carousel
- Attends 3 secondes (fin de `isPaused`)
- Le scroll auto devrait reprendre

---

## 🧪 Test Rapide

Ajoute ce code temporaire dans `HomeScreen.tsx` après le `<MixedContentCarousel>` :

```typescript
{/* DEBUG: Afficher le nombre d'éléments */}
<Text style={{ textAlign: 'center', marginTop: 10, color: 'red' }}>
    DEBUG: Carousel a {/* Impossible d'accéder à content ici */}
</Text>
```

Ou mieux, modifie temporairement `MixedContentCarousel.tsx` ligne 338 :

```typescript
return (
    <View style={styles.container}>
        {/* DEBUG */}
        <Text style={{ backgroundColor: 'yellow', padding: 10, textAlign: 'center' }}>
            DEBUG: {content.length} éléments - Index: {currentIndex} - Pause: {isPaused ? 'OUI' : 'NON'}
        </Text>
        
        {/* ✅ Barres de progression (comme Instagram Stories) */}
        <View style={styles.progressBars}>
```

---

## 📋 Checklist de Débogage

- [ ] Vérifier console logs : `[MixedContentCarousel]`
- [ ] Compter produits en DB : `SELECT COUNT(*) FROM services;`
- [ ] Tester endpoint : `GET /api/services/recent?limit=20`
- [ ] Vérifier `content.length` (doit être >= 2)
- [ ] Vérifier `isPaused` (doit être false)
- [ ] Attendre 5 secondes (délai par défaut)
- [ ] Ajouter logs de debug dans le useEffect
- [ ] Tester scroll manuel → Auto doit reprendre après 3s

---

## 🎯 Diagnostic Rapide

**Scénario le plus probable** :

1. **Si `content.length = 0`** → Problème backend/API
2. **Si `content.length = 1`** → Crée 1+ service supplémentaire
3. **Si `content.length >= 2` mais pas de scroll** → Timer ne se déclenche pas (bug React Native ou isPaused bloqué)

---

## 🚀 Solution Temporaire

Si rien ne fonctionne, force le scroll initial :

```typescript
// Dans MixedContentCarousel.tsx, ligne 70-84
useEffect(() => {
    if (content.length > 1 && !isPaused) {
        // Déclencher le premier scroll après 500ms
        const initialTimer = setTimeout(() => {
            if (scrollViewRef.current && content.length > 1) {
                console.log('[MixedContentCarousel] 🎬 Démarrage scroll initial');
                const firstScrollPosition = SCREEN_PADDING + (CARD_WIDTH + CARD_MARGIN);
                scrollViewRef.current.scrollTo({
                    x: firstScrollPosition,
                    animated: true,
                });
                setCurrentIndex(1); // ← AJOUTE CETTE LIGNE
            }
        }, 500);
        return () => clearTimeout(initialTimer);
    }
}, [content.length, isPaused]);
```

---

**Dis-moi ce que tu vois dans les logs console et on identifiera le problème exact !** 🔍

