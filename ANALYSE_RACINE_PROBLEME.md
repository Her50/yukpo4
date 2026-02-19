# 🔍 Analyse de la Racine du Problème

**Date** : 17 Février 2026 22:05  
**Problème** : Le secret contient encore des retours à la ligne malgré les corrections

---

## 🎯 Hypothèses sur la Racine du Problème

### Hypothèse 1 : Le Secret dans GCP Contient Vraiment des Retours à la Ligne

**Scénario** : Les versions précédentes du secret ont été créées avec `echo -n` qui ne fonctionne pas dans PowerShell, ajoutant des retours à la ligne. Même si on crée une nouvelle version propre, l'ancienne version corrompue pourrait être utilisée.

**Vérification** : Tester avec l'API REST directement pour voir le contenu réel du secret.

### Hypothèse 2 : La Commande `gcloud secrets versions access` Ajoute des Retours à la Ligne

**Scénario** : La commande `gcloud` elle-même ajoute des retours à la ligne lors de la lecture, même si le secret stocké est propre.

**Vérification** : Utiliser l'API REST directement pour éviter `gcloud`.

### Hypothèse 3 : PowerShell Ajoute des Retours à la Ligne lors de la Redirection

**Scénario** : PowerShell ajoute automatiquement des retours à la ligne lors de la redirection de sortie (`>` ou `|`).

**Vérification** : Utiliser `--out-file` avec fichier binaire et lire directement les octets.

### Hypothèse 4 : Le Wrapper Nettoie mais le Problème Revient

**Scénario** : Le wrapper `startup-wrapper.sh` nettoie `DATABASE_URL` au démarrage, mais si le secret est recréé avec des retours à la ligne, le problème revient.

**Vérification** : Vérifier que tous les scripts qui créent/mettent à jour le secret utilisent la méthode corrigée.

---

## 🔍 Tests Effectués

### Test 1 : Lecture Directe avec gcloud

**Résultat** : Erreur ou sortie incorrecte

### Test 2 : Lecture avec `--out-file` (binaire)

**Résultat** : Fichier de 3 octets seulement (BOM UTF-8) - Le secret semble vide ou la commande échoue

### Test 3 : Lecture avec `--format=value`

**Résultat** : À tester

### Test 4 : Lecture avec API REST Directement

**Résultat** : À tester - C'est la méthode la plus fiable pour voir le contenu réel

---

## 💡 Solution Proposée

### 1. Utiliser l'API REST pour Vérifier le Contenu Réel

```powershell
$token = gcloud auth print-access-token
$url = "https://secretmanager.googleapis.com/v1/projects/yukpo-project/secrets/database-url/versions/8:access"
$headers = @{ "Authorization" = "Bearer $token" }
$response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
$payload = $response.payload.data
$decoded = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($payload))
```

### 2. Si le Secret Contient Vraiment des Retours à la Ligne

**Action** : Créer une nouvelle version avec le contenu nettoyé via API REST

### 3. Si le Secret est Propre mais gcloud Ajoute des Retours à la Ligne

**Action** : Utiliser l'API REST pour créer/mettre à jour les secrets au lieu de `gcloud`

---

## 🎯 Prochaine Étape

**Tester avec l'API REST directement** pour voir le contenu réel du secret stocké dans GCP Secret Manager.

---

**Date** : 17 Février 2026 22:05 UTC  
**Statut** : 🔍 Analyse en cours


