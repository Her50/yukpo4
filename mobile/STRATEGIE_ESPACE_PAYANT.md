# 💰 STRATÉGIE ESPACE PAYANT - ARCHITECTURE

## 🎯 **CONCEPT : Monétisation par espace de stockage médias**

---

## 📦 **NIVEAUX D'ABONNEMENT SUGGÉRÉS**

### 🆓 **GRATUIT (Free)**
**Limite : 10 MB total**
```
✅ 2 produits max
✅ 5 images/produit (qualité 50%)
✅ 1 vidéo/produit (20s max)
✅ Compression automatique activée
✅ Parfait pour démarrer
```

**Calcul :**
- 2 produits × 5 photos × 150 KB = 1.5 MB
- 2 produits × 1 vidéo × 4 MB = 8 MB
- **Total : ~9.5 MB** ✅ Dans la limite

**Prix : GRATUIT**

---

### 💎 **PREMIUM (Recommandé)**
**Limite : 50 MB total**
```
✅ 10 produits max
✅ 8 images/produit (qualité 70%)
✅ 2 vidéos/produit (30s max)
✅ Compression optimisée (meilleure qualité)
✅ Support prioritaire
```

**Calcul :**
- 10 produits × 8 photos × 250 KB = 20 MB
- 10 produits × 2 vidéos × 6 MB = 60 MB... ⚠️
- Avec limite 50MB : ~5-6 produits complets possible

**Prix suggéré : 2000-3000 FCFA/mois**

---

### 🏢 **BUSINESS**
**Limite : 200 MB total**
```
✅ 50 produits max
✅ 10 images/produit (qualité 85%)
✅ 3 vidéos/produit (60s max)
✅ Compression minimale (haute qualité)
✅ Support VIP
✅ Analytics avancés
```

**Prix suggéré : 5000-8000 FCFA/mois**

---

### 🌟 **ENTERPRISE**
**Limite : ILLIMITÉ (CDN)**
```
✅ Produits illimités
✅ Images illimitées (qualité 100%)
✅ Vidéos illimitées (aucune compression)
✅ CDN mondial (Cloudinary/AWS S3)
✅ API dédiée
✅ Support premium 24/7
```

**Prix suggéré : Sur devis / 15000+ FCFA/mois**

---

## 🔧 **IMPLÉMENTATION TECHNIQUE**

### 1. Base de données - Table `user_quotas`

```sql
CREATE TABLE user_quotas (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) UNIQUE,
    plan_type VARCHAR(20) DEFAULT 'free', -- 'free', 'premium', 'business', 'enterprise'
    
    -- Limites de stockage
    max_storage_mb INTEGER DEFAULT 10,
    current_storage_mb DECIMAL(10, 2) DEFAULT 0,
    
    -- Limites de produits
    max_products INTEGER DEFAULT 2,
    current_products INTEGER DEFAULT 0,
    
    -- Limites médias par produit
    max_images_per_product INTEGER DEFAULT 5,
    max_videos_per_product INTEGER DEFAULT 1,
    video_max_duration_seconds INTEGER DEFAULT 20,
    
    -- Qualité compression
    image_quality DECIMAL(3, 2) DEFAULT 0.50, -- 0.50 = 50%
    video_quality DECIMAL(3, 2) DEFAULT 0.50,
    image_max_width INTEGER DEFAULT 1024,
    
    -- Dates
    plan_started_at TIMESTAMPTZ DEFAULT NOW(),
    plan_expires_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Backend - Endpoint pour récupérer les quotas

```rust
// backend/src/controllers/quota_controller.rs

pub async fn get_user_quota(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> Result<Json<Value>, StatusCode> {
    let quota = sqlx::query_as!(
        UserQuota,
        "SELECT * FROM user_quotas WHERE user_id = $1",
        user.id
    )
    .fetch_optional(&state.pg)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let quota = quota.unwrap_or_else(|| {
        // Créer quota par défaut si n'existe pas
        UserQuota::default_for_user(user.id)
    });
    
    Ok(Json(json!({
        "plan_type": quota.plan_type,
        "max_storage_mb": quota.max_storage_mb,
        "current_storage_mb": quota.current_storage_mb,
        "storage_percentage": (quota.current_storage_mb / quota.max_storage_mb as f64 * 100.0),
        "max_products": quota.max_products,
        "current_products": quota.current_products,
        "max_images_per_product": quota.max_images_per_product,
        "max_videos_per_product": quota.max_videos_per_product,
        "image_quality": quota.image_quality,
        "video_quality": quota.video_quality
    })))
}
```

### 3. Mobile - Hook pour les quotas

```typescript
// mobile/src/hooks/useUserQuota.ts

export const useUserQuota = () => {
  const [quota, setQuota] = useState({
    plan_type: 'free',
    max_storage_mb: 10,
    current_storage_mb: 0,
    max_products: 2,
    current_products: 0,
    max_images_per_product: 5,
    max_videos_per_product: 1,
    image_quality: 0.5,
    video_quality: 0.5
  });

  const loadQuota = async () => {
    const response = await apiGet('/api/user/quota');
    if (response.success) {
      setQuota(response.data);
    }
  };

  useEffect(() => {
    loadQuota();
  }, []);

  return { quota, refreshQuota: loadQuota };
};
```

### 4. Mobile - Utilisation dans ProductManager

```typescript
// ProductManagerMobile.tsx

const { quota } = useUserQuota();

// Vérifier avant d'ajouter image
if (currentImagesCount >= quota.max_images_per_product) {
  Alert.alert(
    'Limite atteinte',
    `Votre plan "${quota.plan_type}" limite à ${quota.max_images_per_product} images par produit.\n\n✨ Passez à Premium pour plus d'images !`
  );
  return;
}

// Utiliser la qualité du plan
const manipulatedImage = await manipulateAsync(
  asset.uri,
  [{ resize: { width: 1024 } }],
  { compress: quota.image_quality } // 0.5 pour free, 0.7 pour premium, etc.
);
```

### 5. Mobile - UI Upgrade plan

```typescript
// Écran "Mon Compte" avec jauge d'espace

<View style={styles.quotaCard}>
  <Text style={styles.quotaTitle}>
    📦 Espace utilisé : {quota.current_storage_mb} / {quota.max_storage_mb} MB
  </Text>
  
  <ProgressBar progress={quota.current_storage_mb / quota.max_storage_mb} />
  
  {quota.current_storage_mb / quota.max_storage_mb > 0.8 && (
    <TouchableOpacity onPress={() => navigation.navigate('UpgradePlan')}>
      <Text style={styles.upgradeText}>
        ⚠️ Plus de 80% utilisé ! Passer à Premium pour 50 MB
      </Text>
    </TouchableOpacity>
  )}
</View>
```

---

## 💰 **MODÈLE ÉCONOMIQUE**

### Pricing suggéré (Cameroun - FCFA)

| Plan | Prix/mois | Espace | Images/produit | Vidéos/produit | Qualité |
|------|-----------|--------|----------------|----------------|---------|
| **Free** | 0 FCFA | 10 MB | 5 | 1 | 50% |
| **Premium** | 2500 FCFA | 50 MB | 8 | 2 | 70% |
| **Business** | 7500 FCFA | 200 MB | 10 | 3 | 85% |
| **Enterprise** | Sur devis | Illimité | Illimité | Illimité | 100% |

### Calcul de rentabilité

**Coûts serveur estimés :**
- Stockage 100GB : ~5$/mois (AWS S3)
- Bande passante 1TB : ~10$/mois
- Serveur backend : ~25$/mois (Render)
- **TOTAL : ~40$/mois = 24,000 FCFA**

**Revenus avec 100 users :**
- 50 users Free (0 FCFA) : 0 FCFA
- 30 users Premium (2500 FCFA) : 75,000 FCFA
- 15 users Business (7500 FCFA) : 112,500 FCFA
- 5 users Enterprise (20,000 FCFA) : 100,000 FCFA
- **TOTAL : 287,500 FCFA/mois** 💰

**Profit : ~260,000 FCFA/mois** 🎉

---

## 🎯 **VOTRE QUESTION PRINCIPALE - CLARIFIÉE**

### "Compression nécessaire avec 10MB ?"

**Regardons un cas RÉEL :**

**Scénario : Vendeur de téléphones (2 produits)**

**Produit 1 - iPhone 14 :**
```
SANS compression :
- 5 photos originales : 10 MB
- 1 vidéo 20s : 30 MB
TOTAL : 40 MB ❌ IMPOSSIBLE

AVEC compression 50% :
- 5 photos 1024px : 750 KB
- 1 vidéo 20s : 4 MB
TOTAL : 4.75 MB ✅ OK
```

**Produit 2 - Samsung S23 :**
```
AVEC compression 50% :
- 5 photos : 750 KB
- 1 vidéo : 4 MB
TOTAL : 4.75 MB ✅ OK
```

**GRAND TOTAL : 9.5 MB** ✅ Passe juste !

**SANS compression : 80 MB** ❌ 8× trop grand !

---

### 📊 **TABLEAU RÉCAPITULATIF**

| Limite Backend | Sans compression | Avec compression 50% | Produits possibles |
|----------------|------------------|----------------------|-------------------|
| 2 MB (défaut) | 0 produit | 0-1 produit simple | ❌ Insuffisant |
| **10 MB (actuel)** | 0 produit | **2-3 produits** | ✅ **OPTIMAL** |
| 50 MB (premium) | 1-2 produits | 10-15 produits | ✅ Très bien |
| 200 MB (business) | 5-8 produits | 50+ produits | ✅ Excellent |

---

## ✅ **CONFIGURATION FINALE - VÉRIFICATION**

### Variables d'environnement harmonisées :

**Tous les fichiers utilisent maintenant :**
```typescript
process.env.EXPO_PUBLIC_API_URL // ← Variable principale (eas.json)
```

**Avec fallback sécurisé :**
```typescript
|| 'https://yukpomnang.onrender.com' // ← Si variable absente
```

**Pour changer de serveur :**
```json
// mobile/eas.json (1 SEUL endroit à modifier)
"env": {
  "EXPO_PUBLIC_API_URL": "https://api.monserveur.com",
  "EXPO_PUBLIC_WS_URL": "wss://api.monserveur.com"
}
```

**Aucun autre fichier à toucher !** 🎉

---

## 🚀 **ACTIONS REQUISES MAINTENANT**

### ⚠️ **CRITIQUE : 2 déploiements nécessaires**

#### 1. **Backend (PRIORITÉ #1)**
```bash
# Sur Render.com dashboard :
1. Sélectionner service "yukpomnang-backend"
2. Manual Deploy → Deploy latest commit
3. Attendre 5-10 minutes
4. Vérifier logs : Chercher "DefaultBodyLimit"
```

**Sans ce déploiement, l'erreur 413 persistera !**

#### 2. **Mobile (PRIORITÉ #2)**
```bash
cd mobile
npx eas build --platform android --profile preview
```

**Corrections incluses :**
- ✅ Compression optimisée 50%
- ✅ Limites : 5 images, 2 vidéos
- ✅ Variables harmonisées
- ✅ 42 catégories modalités
- ✅ KeyboardAvoidingView
- ✅ GPS configuré

---

## 💡 **RÉPONSE FINALE**

### **OUI, la compression reste nécessaire même à 10MB**

**Pourquoi :**
- Photos originales = 2-4 MB chacune
- Vidéos originales = 30-50 MB chacune
- **Impossible de créer même 1 produit sans compression !**

**Avec compression 50% :**
- Photos = 100-200 KB chacune
- Vidéos = 3-5 MB chacune
- **Possibilité de créer 2-3 produits complets** ✅

**Votre stratégie payante pour augmenter l'espace est excellente !** 
Cela permettra aux users premium d'avoir :
- Plus de produits
- Meilleure qualité (70-85%)
- Plus de médias par produit

---

**Voulez-vous que je lance le build mobile maintenant ?**

