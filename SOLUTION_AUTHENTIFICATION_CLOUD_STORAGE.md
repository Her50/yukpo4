# 🔧 Solution : Authentification Cloud Storage pour Backend

**Date** : 2026-02-14  
**Problème** : Le backend utilise `aws_sdk_s3` qui nécessite des credentials HMAC, mais Cloud Storage utilise OAuth2.

---

## 🎯 PROBLÈME IDENTIFIÉ

**Le backend utilise `aws_sdk_s3` qui attend des credentials au format AWS (access_key/secret_key), mais Cloud Storage utilise OAuth2 avec des clés JSON de service account.**

**Configuration actuelle** :
- `S3_ACCESS_KEY` = `cloud-storage-sa@yukpo-project.iam.gserviceaccount.com` ❌ (email, pas une clé)
- `S3_SECRET_KEY` = `[A_CONFIGURER_AVEC_CLE_SERVICE_ACCOUNT]` ❌ (placeholder)

---

## ✅ SOLUTIONS POSSIBLES

### Solution 1 : Utiliser Credentials HMAC (Recommandé pour compatibilité)

**Cloud Storage supporte l'API S3 compatible avec des credentials HMAC.**

#### Étape 1 : Créer des Credentials HMAC

1. **Allez sur** : https://console.cloud.google.com/storage/settings
2. **Onglet** : "Interoperability"
3. **Cliquez sur** : "Create a key for a service account"
4. **Sélectionnez** : `cloud-storage-sa@yukpo-project.iam.gserviceaccount.com`
5. **Copiez** :
   - **Access Key** (ex: `GOOG1234567890ABCDEF`)
   - **Secret Key** (ex: `abcdefghijklmnopqrstuvwxyz1234567890`)

#### Étape 2 : Configurer les Variables

**Dans `gcp-env-vars.json`** :
```json
{
  "S3_ACCESS_KEY": "GOOG1234567890ABCDEF",
  "S3_SECRET_KEY": "abcdefghijklmnopqrstuvwxyz1234567890"
}
```

**Dans GitHub Secrets** :
- `GCP_ENV_S3_ACCESS_KEY` = `GOOG1234567890ABCDEF`
- `GCP_ENV_S3_SECRET_KEY` = `abcdefghijklmnopqrstuvwxyz1234567890`

#### Étape 3 : Vérifier la Configuration

**Variables requises** :
- ✅ `S3_BUCKET` = `yukpo-project-yukpo-backend-media`
- ✅ `S3_REGION` = `europe-west1`
- ✅ `S3_ENDPOINT` = `https://storage.googleapis.com`
- ✅ `S3_ACCESS_KEY` = Credential HMAC Access Key
- ✅ `S3_SECRET_KEY` = Credential HMAC Secret Key
- ✅ `S3_FORCE_PATH_STYLE` = `false`

**Le backend utilisera automatiquement ces credentials avec `aws_sdk_s3`.**

---

### Solution 2 : Utiliser Application Default Credentials (Recommandé pour Cloud Run)

**Sur Cloud Run, le service account est automatiquement disponible via Application Default Credentials (ADC).**

#### Modification Requise

**Fichier** : `backend/src/services/media_storage_service.rs`

**Changement** : Détecter Cloud Storage et utiliser ADC au lieu de credentials explicites.

**Code à ajouter** :

```rust
fn build_client(config: &MediaStorageConfig) -> Option<Client> {
    if !(config.has_remote_backend()) {
        return None;
    }

    let _ = config.bucket.as_ref()?;
    
    // Détecter si on utilise Cloud Storage
    let is_cloud_storage = config.endpoint.as_ref()
        .map(|e| e.contains("storage.googleapis.com"))
        .unwrap_or(false);

    let mut builder = S3ConfigBuilder::new();

    if let Some(region) = config.region.as_ref() {
        builder = builder.region(Region::new(region.clone()));
    }
    
    if let Some(endpoint) = config.endpoint.as_ref() {
        builder = builder.endpoint_url(endpoint.clone());
    }

    // Pour Cloud Storage, utiliser ADC si disponible
    if is_cloud_storage {
        // Le SDK aws_sdk_s3 ne supporte pas directement ADC
        // Il faut soit :
        // 1. Utiliser les credentials HMAC (Solution 1)
        // 2. OU migrer vers google-cloud-storage SDK
        // Pour l'instant, on utilise les credentials explicites
        if let (Some(access_key), Some(secret_key)) = (&config.access_key, &config.secret_key) {
            let credentials = Credentials::new(
                access_key,
                secret_key,
                config.session_token.clone(),
                None,
                "media-storage",
            );
            builder = builder.credentials_provider(credentials);
        } else {
            // Fallback: Essayer d'utiliser GOOGLE_APPLICATION_CREDENTIALS
            warn!("[MediaStorage] Cloud Storage détecté mais pas de credentials explicites. Utilisez des credentials HMAC.");
            return None;
        }
    } else {
        // Pour AWS/Wasabi, utiliser les credentials normaux
        let access_key = config.access_key.as_ref()?.clone();
        let secret_key = config.secret_key.as_ref()?.clone();
        
        let credentials = Credentials::new(
            &access_key,
            &secret_key,
            config.session_token.clone(),
            None,
            "media-storage",
        );
        builder = builder.credentials_provider(credentials);
    }

    if config.force_path_style {
        builder = builder.force_path_style(true);
    }

    let conf = builder.build();
    let client = Client::from_conf(conf);

    Some(client)
}
```

**⚠️ LIMITATION** : Le SDK `aws_sdk_s3` ne supporte pas directement Application Default Credentials. Il faut utiliser les credentials HMAC (Solution 1).

---

### Solution 3 : Migrer vers google-cloud-storage SDK (Optionnel)

**Alternative** : Utiliser le SDK natif GCP `google-cloud-storage` au lieu de `aws_sdk_s3`.

**Avantages** :
- Support natif pour Application Default Credentials
- Meilleure intégration avec GCP
- Pas besoin de credentials HMAC

**Inconvénients** :
- Nécessite une refactorisation importante du code
- Perte de compatibilité avec AWS/Wasabi

**Recommandation** : Utiliser la Solution 1 (Credentials HMAC) pour garder la compatibilité.

---

## 🚀 SOLUTION RECOMMANDÉE

**Utiliser les Credentials HMAC (Solution 1)** :

1. ✅ **Créer des credentials HMAC** via la console GCP
2. ✅ **Configurer les variables** `S3_ACCESS_KEY` et `S3_SECRET_KEY`
3. ✅ **Le backend utilisera automatiquement** ces credentials avec `aws_sdk_s3`

**Avantages** :
- ✅ Pas de modification de code nécessaire
- ✅ Compatible avec le code existant
- ✅ Fonctionne avec `aws_sdk_s3`
- ✅ Compatible avec AWS/Wasabi si besoin

---

## 📋 CHECKLIST

### Étape 1 : Créer Credentials HMAC
- [ ] Aller sur https://console.cloud.google.com/storage/settings
- [ ] Onglet "Interoperability"
- [ ] Créer une clé pour `cloud-storage-sa@yukpo-project.iam.gserviceaccount.com`
- [ ] Copier Access Key et Secret Key

### Étape 2 : Configurer Variables
- [ ] Mettre à jour `gcp-env-vars.json` avec les credentials HMAC
- [ ] Configurer `GCP_ENV_S3_ACCESS_KEY` dans GitHub Secrets
- [ ] Configurer `GCP_ENV_S3_SECRET_KEY` dans GitHub Secrets

### Étape 3 : Vérifier
- [ ] Vérifier que toutes les variables sont configurées
- [ ] Tester un upload après déploiement
- [ ] Vérifier que le fichier est dans Cloud Storage
- [ ] Vérifier que l'URL CDN fonctionne

---

## ✅ RÉSULTAT

**Une fois les credentials HMAC configurés, le système sera 100% opérationnel :**

- ✅ Backend → Cloud Storage (via credentials HMAC)
- ✅ Cloud Storage → Cloud CDN (via backend bucket)
- ✅ Cloud CDN → Clients (via Load Balancer)

---

**Date** : 2026-02-14  
**Statut** : ⚠️ **CREDENTIALS HMAC À CRÉER**

