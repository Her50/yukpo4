# Configuration du domaine yukpo.cm pour Cloud Run

## Objectif
Remplacer les URLs de partage externe longues et peu attractives par un domaine personnalisé court et professionnel.

**Avant :**
```
https://yukpo-backend-376093909298.europe-west1.run.app/product/123
```

**Après :**
```
https://yukpo.cm/product/123
https://yukpo.cm/service/456
https://yukpo.cm/download
```

## Prérequis

### 1. Acheter le domaine yukpo.cm
- Registrar recommandés : Namecheap, GoDaddy, Google Domains
- Prix estimé : 15-30 USD/an pour un `.cm` (Cameroun)
- Alternative : `yukpo.com` si `.cm` n'est pas disponible

### 2. Accès GCP
- Projet : `yukpo-project`
- Service Cloud Run : `yukpo-backend`
- Région : `europe-west1`

## Configuration étape par étape

### Étape 1 : Mapper le domaine sur Cloud Run

```powershell
# Exécuter le script automatisé
.\scripts\configure_custom_domain.ps1
```

**OU manuellement :**

```bash
gcloud run domain-mappings create \
  --service=yukpo-backend \
  --domain=yukpo.cm \
  --region=europe-west1 \
  --project=yukpo-project
```

### Étape 2 : Obtenir les enregistrements DNS

```bash
gcloud run domain-mappings describe \
  --domain=yukpo.cm \
  --region=europe-west1 \
  --project=yukpo-project
```

Vous obtiendrez quelque chose comme :

```
resourceRecords:
- name: yukpo.cm
  rrdata: ghs.googlehosted.com
  type: CNAME
```

### Étape 3 : Configurer le DNS chez votre registrar

**Connectez-vous à votre registrar** (Namecheap, GoDaddy, etc.) et ajoutez :

| Type  | Name | Value                | TTL  |
|-------|------|----------------------|------|
| CNAME | @    | ghs.googlehosted.com | Auto |

**OU si CNAME sur @ n'est pas supporté :**

| Type | Name | Value          | TTL  |
|------|------|----------------|------|
| A    | @    | 216.239.32.21  | Auto |
| A    | @    | 216.239.34.21  | Auto |
| A    | @    | 216.239.36.21  | Auto |
| A    | @    | 216.239.38.21  | Auto |
| AAAA | @    | 2001:4860:4802:32::15 | Auto |
| AAAA | @    | 2001:4860:4802:34::15 | Auto |
| AAAA | @    | 2001:4860:4802:36::15 | Auto |
| AAAA | @    | 2001:4860:4802:38::15 | Auto |

### Étape 4 : Vérifier la propagation DNS

```bash
# Attendre 5-60 minutes, puis vérifier
nslookup yukpo.cm
```

### Étape 5 : Activer HTTPS automatique

Cloud Run active automatiquement le certificat SSL via Google-managed certificates. Aucune action requise.

### Étape 6 : Mettre à jour l'app mobile

Une fois le domaine actif, mettre à jour les constantes dans l'app mobile :

**Fichier à modifier :** `mobile/src/config/environment.ts`

```typescript
// Avant
export const SHARE_BASE_URL = 'https://yukpo-backend-376093909298.europe-west1.run.app';

// Après
export const SHARE_BASE_URL = 'https://yukpo.cm';
```

## Vérification finale

Testez les URLs :
- ✅ `https://yukpo.cm/product/123`
- ✅ `https://yukpo.cm/service/456`
- ✅ `https://yukpo.cm/download`
- ✅ `https://yukpo.cm/track/789`

## Coût

- **Domaine** : ~15-30 USD/an
- **Cloud Run** : Pas de coût supplémentaire (inclus dans le service existant)
- **Certificat SSL** : Gratuit (Google-managed)

## Alternatives si yukpo.cm n'est pas disponible

1. `yukpo.com` (international)
2. `yukpomnang.cm` (nom complet)
3. `getyukpo.com` (style startup)
4. `app.yukpo.cm` (sous-domaine si vous possédez déjà yukpo.cm)

## Maintenance

Le certificat SSL se renouvelle automatiquement. Aucune maintenance requise après la configuration initiale.
