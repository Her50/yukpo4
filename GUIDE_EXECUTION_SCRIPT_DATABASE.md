# 📋 Guide d'Exécution du Script de Configuration Base de Données

**Date**: 2026-02-15  
**Script**: `scripts/configure-database-accessibility-simple.ps1`

---

## ⚠️ Problème Identifié

Le script nécessite `gcloud CLI` dans le PATH, mais il n'est pas détecté dans la session PowerShell actuelle.

---

## ✅ Solutions

### Option 1: Ajouter gcloud au PATH (Recommandé)

**Windows** :
1. Trouver le chemin d'installation de gcloud :
   - Par défaut : `C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin`
   - Ou : `C:\Users\<USER>\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin`

2. Ajouter au PATH :
   ```powershell
   # Temporaire (session actuelle)
   $env:Path += ";C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin"
   
   # Permanent (ajouter dans Variables d'environnement système)
   [System.Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin", "User")
   ```

3. Vérifier :
   ```powershell
   gcloud --version
   ```

### Option 2: Utiliser le Chemin Complet

Modifier le script pour utiliser le chemin complet de gcloud :

```powershell
# Dans le script, remplacer :
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {

# Par :
$gcloudPath = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
if (-not (Test-Path $gcloudPath)) {
    # Essayer un autre chemin
    $gcloudPath = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
}

if (-not (Test-Path $gcloudPath)) {
    Write-Host "[ERREUR] gcloud CLI non trouve" -ForegroundColor Red
    exit 1
}

# Utiliser $gcloudPath au lieu de gcloud dans toutes les commandes
```

### Option 3: Exécuter depuis Google Cloud Shell

Utiliser Google Cloud Shell (navigateur) où gcloud est déjà installé :

1. Aller sur https://console.cloud.google.com
2. Cliquer sur l'icône Cloud Shell (en haut à droite)
3. Télécharger le script et l'exécuter

---

## 🚀 Exécution du Script

Une fois gcloud dans le PATH :

```powershell
# Exécuter le script
.\scripts\configure-database-accessibility-simple.ps1

# Ou avec paramètres personnalisés
.\scripts\configure-database-accessibility-simple.ps1 -ProjectId "yukpo-project" -Region "europe-west1"
```

---

## 📋 Ce que le Script Fait

1. **Étape 1/5** : Crée une IP statique pour Cloud NAT
2. **Étape 2/5** : Crée un routeur Cloud
3. **Étape 3/5** : Crée un Cloud NAT
4. **Étape 4/5** : Crée un VPC Connector
5. **Étape 5/5** : Attache le VPC Connector à Cloud Run

---

## 🔧 Commandes Manuelles (Alternative)

Si le script ne fonctionne pas, exécuter ces commandes manuellement :

```bash
# 1. Créer IP statique
gcloud compute addresses create cloud-run-nat-ip \
  --region=europe-west1 \
  --project=yukpo-project

# 2. Créer routeur
gcloud compute routers create cloud-run-router \
  --region=europe-west1 \
  --network=default \
  --project=yukpo-project

# 3. Créer Cloud NAT
gcloud compute routers nats create cloud-run-nat \
  --router=cloud-run-router \
  --region=europe-west1 \
  --nat-external-ip-pool=cloud-run-nat-ip \
  --nat-all-subnet-ip-ranges \
  --project=yukpo-project

# 4. Récupérer l'IP NAT
NAT_IP=$(gcloud compute addresses describe cloud-run-nat-ip \
  --region=europe-west1 \
  --format="value(address)" \
  --project=yukpo-project)

echo "IP NAT: $NAT_IP"

# 5. Créer VPC Connector
gcloud compute networks vpc-access connectors create yukpo-connector \
  --region=europe-west1 \
  --subnet=default \
  --subnet-project=yukpo-project \
  --min-instances=2 \
  --max-instances=3 \
  --machine-type=e2-micro \
  --project=yukpo-project

# 6. Attacher à Cloud Run
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --vpc-connector=yukpo-connector \
  --vpc-egress=all-traffic \
  --project=yukpo-project
```

---

## ✅ Vérification

Après exécution, vérifier :

```bash
# Vérifier l'IP NAT
gcloud compute addresses describe cloud-run-nat-ip \
  --region=europe-west1 \
  --format="value(address)" \
  --project=yukpo-project

# Vérifier le VPC Connector
gcloud compute networks vpc-access connectors describe yukpo-connector \
  --region=europe-west1 \
  --project=yukpo-project

# Vérifier la configuration Cloud Run
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="get(spec.template.spec.vpcAccess)" \
  --project=yukpo-project
```

---

## 📝 Prochaine Étape

**Autoriser l'IP NAT dans AWS RDS Security Group** :

1. Récupérer l'IP NAT (voir commande ci-dessus)
2. Aller dans AWS Console → RDS → Security Groups
3. Sélectionner le Security Group de votre instance RDS
4. Inbound Rules → Edit inbound rules
5. Add rule :
   - Type: `PostgreSQL`
   - Port: `5432`
   - Source: `<IP_NAT>/32`
6. Save rules

---

**✅ Une fois l'IP NAT autorisée dans AWS RDS, la base de données sera accessible depuis Cloud Run !**

