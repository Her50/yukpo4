# 🔄 Guide : Scripts de Mise à Jour Automatique DNS

**Date**: 2026-02-14  
**Objectif**: Mise à jour automatique du DNS Cloudflare quand l'IP ECS change

---

## 📋 Scripts Créés

### 1. `scripts/mettre-a-jour-dns-cloudflare-auto.ps1`

**Fonction** : Vérifie l'IP ECS actuelle et met à jour Cloudflare automatiquement si elle a changé.

**Utilisation** :
```powershell
powershell -ExecutionPolicy Bypass -File scripts\mettre-a-jour-dns-cloudflare-auto.ps1
```

**Paramètres** (optionnels) :
- `-CloudflareAPIKey` : Token Cloudflare (défaut: token actuel)
- `-CloudflareZoneID` : Zone ID (défaut: zone yukpomnang.com)
- `-Subdomain` : Sous-domaine (défaut: "api")
- `-Region` : Région AWS (défaut: "eu-west-1")
- `-Cluster` : Cluster ECS (défaut: "yukpo-cluster")
- `-Service` : Service ECS (défaut: "yukpo-backend-service")

**Exemple** :
```powershell
powershell -ExecutionPolicy Bypass -File scripts\mettre-a-jour-dns-cloudflare-auto.ps1 `
    -CloudflareAPIKey "VOTRE_TOKEN" `
    -Subdomain "api"
```

### 2. `scripts/planifier-mise-a-jour-dns.ps1`

**Fonction** : Crée une tâche planifiée Windows pour exécuter le script automatiquement.

**Utilisation** :
```powershell
# Exécuter en tant qu'administrateur
powershell -ExecutionPolicy Bypass -File scripts\planifier-mise-a-jour-dns.ps1
```

**Paramètres** :
- `-IntervalMinutes` : Intervalle entre les vérifications (défaut: 15 minutes)

**Exemple** :
```powershell
# Vérifier toutes les 30 minutes
powershell -ExecutionPolicy Bypass -File scripts\planifier-mise-a-jour-dns.ps1 -IntervalMinutes 30
```

---

## 🚀 Configuration Automatique

### Option 1 : Tâche Planifiée Windows (Recommandé)

1. **Ouvrir PowerShell en tant qu'administrateur**

2. **Exécuter le script de planification** :
```powershell
cd C:\Users\23767\yukpomnang2
powershell -ExecutionPolicy Bypass -File scripts\planifier-mise-a-jour-dns.ps1
```

3. **Vérifier que la tâche est créée** :
```powershell
Get-ScheduledTask -TaskName "Yukpo-DNS-Cloudflare-AutoUpdate"
```

4. **Tester immédiatement** :
```powershell
Start-ScheduledTask -TaskName "Yukpo-DNS-Cloudflare-AutoUpdate"
```

### Option 2 : Exécution Manuelle Périodique

Exécutez le script manuellement quand vous voulez vérifier/mettre à jour :

```powershell
powershell -ExecutionPolicy Bypass -File scripts\mettre-a-jour-dns-cloudflare-auto.ps1
```

### Option 3 : Via GitHub Actions (Futur)

Vous pouvez créer une action GitHub qui s'exécute périodiquement :

```yaml
name: Update DNS Cloudflare
on:
  schedule:
    - cron: '*/15 * * * *'  # Toutes les 15 minutes
  workflow_dispatch:

jobs:
  update-dns:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - name: Update DNS
        run: |
          powershell -ExecutionPolicy Bypass -File scripts\mettre-a-jour-dns-cloudflare-auto.ps1
        env:
          CLOUDFLARE_API_KEY: ${{ secrets.CLOUDFLARE_API_KEY }}
```

---

## 🔍 Vérification

### Vérifier que le script fonctionne

```powershell
# Exécuter le script
powershell -ExecutionPolicy Bypass -File scripts\mettre-a-jour-dns-cloudflare-auto.ps1

# Vérifier le DNS
nslookup api.yukpomnang.com

# Tester la connexion
Invoke-WebRequest -Uri "https://api.yukpomnang.com/health" -Method GET
```

### Vérifier la tâche planifiée

```powershell
# Lister la tâche
Get-ScheduledTask -TaskName "Yukpo-DNS-Cloudflare-AutoUpdate"

# Voir les détails
Get-ScheduledTaskInfo -TaskName "Yukpo-DNS-Cloudflare-AutoUpdate"

# Voir l'historique d'exécution
Get-WinEvent -LogName Microsoft-Windows-TaskScheduler/Operational | 
    Where-Object { $_.Message -like "*Yukpo-DNS*" } | 
    Select-Object -First 10
```

---

## 🛠️ Désactiver la Mise à Jour Automatique

### Supprimer la tâche planifiée

```powershell
Unregister-ScheduledTask -TaskName "Yukpo-DNS-Cloudflare-AutoUpdate" -Confirm:$false
```

---

## ⚠️ Notes Importantes

### 1. Permissions

- Le script nécessite les permissions AWS CLI configurées
- Le token Cloudflare doit avoir les permissions "Zone DNS Edit"

### 2. Intervalle Recommandé

- **15 minutes** : Bon compromis entre réactivité et nombre de requêtes
- **30 minutes** : Si l'IP change rarement
- **5 minutes** : Si vous avez besoin d'une mise à jour très rapide

### 3. Coûts

- Cloudflare API : Gratuit (limite de taux)
- AWS CLI : Gratuit (appels API inclus)
- Tâche planifiée Windows : Gratuit

### 4. Logs

Le script affiche les informations dans la console. Pour logger dans un fichier :

```powershell
powershell -ExecutionPolicy Bypass -File scripts\mettre-a-jour-dns-cloudflare-auto.ps1 | 
    Tee-Object -FilePath "dns-update.log" -Append
```

---

## 🔄 Migration vers Load Balancer

Quand le Load Balancer sera activé, vous pourrez :

1. **Désactiver la tâche planifiée** :
```powershell
Unregister-ScheduledTask -TaskName "Yukpo-DNS-Cloudflare-AutoUpdate" -Confirm:$false
```

2. **Configurer Route 53 vers le Load Balancer** :
```powershell
powershell -ExecutionPolicy Bypass -File scripts\mettre-a-jour-dns-route53.ps1
```

3. **Mettre à jour Cloudflare** pour pointer vers le Load Balancer (CNAME au lieu de A)

---

## 📞 Support

**Token Cloudflare** : `SIlEiOG1y92DC2_Kg1u2_tlpCXiwi98kYlNzRsmL`  
**Zone ID** : `98970e23637def46d0a62c789ed66039`  
**Domaine** : `api.yukpomnang.com`

**Besoin d'aide ?** Les scripts sont prêts à être utilisés !


