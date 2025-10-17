# 🔍 ANALYSE PROFONDE - Recherche Mobile vs Frontend

## ⚙️ **CONFIGURATION CONFIRMÉE**

- **Backend utilisé** : `https://yukpomnang.onrender.com` (Render - prod)
- **Frontend** : Fonctionne ✅
- **Mobile** : Ne fonctionne pas ❌

Puisque les deux utilisent le **même backend**, le problème est dans la **requête mobile** ou le **traitement de la réponse**.

## 🔍 **COMPARAISON DÉTAILLÉE DES REQUÊTES**

### Frontend (fonctionne)
```typescript
// frontend/src/pages/HomePage.tsx - Ligne 85-122
const handleSearch = async (input: MultiModalInput) => {
  const response = await fetch('/api/search/direct', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify(input)
  });
  
  const result = await response.json();
  const results = result?.resultats?.resultats || result?.resultats || [];
  
  navigate('/resultat-besoin', {
    state: {
      results: results,
      type: 'recherche_besoin',
      suggestion: result
    }
  });
}
```

### Mobile (ne fonctionne pas)
```typescript
// mobile/src/services/yukpoclient.ts - Ligne 96-132
export async function rechercherServices(input: any): Promise<any> {
  const token = await getToken();
  
  const response = await fetch(`${API_BASE_URL}/api/search/direct`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(input)
  });
  
  const result = await response.json();
  return result; // Retourne TOUT le résultat
}

// mobile/src/screens/HomeScreen.tsx - Ligne 109-190
const handleSearch = async (input: any) => {
  const result = await rechercherServices(input);
  
  // Extraction des résultats
  let results = [];
  if (result?.resultats?.resultats && Array.isArray(result.resultats.resultats)) {
    results = result.resultats.resultats;
  } else if (result?.resultats && Array.isArray(result.resultats)) {
    results = result.resultats;
  } // ... autres cas
  
  (navigation as any).navigate('ResultatBesoin', {
    results: results,
    type: 'recherche_besoin',
    suggestion: result
  });
}
```

## ⚠️ **DIFFÉRENCES DÉTECTÉES**

### 1. **Structure du body envoyé**

Le frontend peut envoyer une structure différente du mobile. Vérifions :

**Frontend - MultiModalInput :**
```typescript
interface MultiModalInput {
  text?: string;
  texte?: string;
  base64_image?: string[];
  audio_base64?: string[];
  video_base64?: string[];
  doc_base64?: string[];
  excel_base64?: string[];
  pdf_base64?: string[];
  gps_mobile?: string;
  gps_zone?: any;
  gps_fixe?: string;
  gps_fixe_coords?: string;
}
```

**Mobile - ChatInputMobile génère :**
```typescript
const input = {
  texte: text.trim(),
  text: text.trim(),
  base64_image: images || [],
  audio_base64: audioUri ? [audioUri] : [],
  video_base64: [],
  doc_base64: documents.map(d => d.uri) || [],
  excel_base64: [],
  pdf_base64: [],
  gps_mobile: gpsData ? `${gpsData.lat},${gpsData.lng}` : undefined,
  gps_zone: gpsData ? [gpsData] : undefined,
  gps_fixe: gpsData ? `${gpsData.lat},${gpsData.lng}` : undefined,
  gps_fixe_coords: gpsData ? JSON.stringify([gpsData]) : undefined,
};
```

### 2. **Gestion du token**

**Frontend :**
```typescript
'Authorization': `Bearer ${localStorage.getItem('token')}`
```

**Mobile :**
```typescript
const token = await AsyncStorage.getItem('auth_token'); // Clé différente !
'Authorization': `Bearer ${token}`
```

🚨 **ERREUR POTENTIELLE #1** : La clé du token est différente !
- Frontend : `'token'`
- Mobile : `'auth_token'`

### 3. **Navigation et passage de données**

**Frontend (React Router) :**
```typescript
navigate('/resultat-besoin', {
  state: {
    results: results, // Passe par le state de navigation
    type: 'recherche_besoin',
    suggestion: result
  }
});
```

**Mobile (React Navigation) :**
```typescript
(navigation as any).navigate('ResultatBesoin', {
  results: results, // Passe par les params de navigation
  type: 'recherche_besoin',
  suggestion: result
});
```

## 🎯 **HYPOTHÈSES D'ERREURS SILENCIEUSES**

### Hypothèse #1 : Token invalide ou absent
Le mobile utilise `'auth_token'` mais le token est peut-être stocké sous `'token'`

**Test :**
```typescript
// Dans HomeScreen.tsx
const token = await AsyncStorage.getItem('auth_token');
console.log('🔑 Token récupéré:', token ? 'Présent' : 'ABSENT');
console.log('🔑 Longueur token:', token?.length);
```

### Hypothèse #2 : Le bouton n'envoie rien
Le bouton "Envoyer" externe n'a PAS accès aux données du formulaire

**Déjà corrigé** : `showSendButton={true}`

### Hypothèse #3 : La réponse est vide
Le backend retourne une réponse vide ou différente

**Test avec logs ajoutés** : Déjà fait ✅

### Hypothèse #4 : Navigation ne passe pas les données
Les données ne sont pas accessibles dans ResultatBesoinScreen

**Test :**
```typescript
// Dans ResultatBesoinScreen.tsx
console.log('📦 Route params:', route.params);
console.log('📦 Initial results:', initialResults);
```

### Hypothèse #5 : Structure de réponse différente
Le backend retourne un format différent pour le mobile

**Peu probable** car même endpoint, mais à vérifier avec les logs

## 🔧 **CORRECTION PRIORITAIRE**

La **clé du token** est probablement différente. Vérifions et unifions :

### Dans yukpoclient.ts :
```typescript
const getToken = async (): Promise<string | null> => {
  // Essayer les deux clés pour compatibilité
  let token = await AsyncStorage.getItem('auth_token');
  if (!token) {
    token = await AsyncStorage.getItem('token'); // Fallback
  }
  return token;
};
```

### Ou dans la fonction de login :
```typescript
// Sauvegarder sous les deux clés pour compatibilité
await AsyncStorage.setItem('auth_token', token);
await AsyncStorage.setItem('token', token); // Compatibilité
```

## 📊 **PLAN DE DIAGNOSTIC**

1. **Vérifier le token** ✅ (Priorité haute)
2. **Vérifier que handleSubmit reçoit les données** ✅ (Déjà corrigé)
3. **Vérifier la réponse API** ✅ (Logs ajoutés)
4. **Vérifier la navigation** ⏳ (À tester)
5. **Vérifier ResultatBesoinScreen** ⏳ (À tester)

## 🚀 **PROCHAINES ÉTAPES**

1. Corriger la récupération du token
2. Tester avec les logs existants
3. Comparer les requêtes exactes (network inspector)
4. Vérifier que ResultatBesoinScreen reçoit bien les données




