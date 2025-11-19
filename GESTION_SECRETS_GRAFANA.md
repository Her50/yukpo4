# 🔐 Gestion des Secrets Grafana - Connexions Transparentes

## 📋 Système de Gestion Automatique

Un système de gestion de secrets a été mis en place pour permettre des connexions transparentes à Grafana.

---

## 🔒 Fichiers de Secrets

### Fichier Principal : `/opt/yukpo/.grafana-secrets`

**Contenu** :
```bash
GRAFANA_URL=http://localhost:3002
GRAFANA_USER=admin
GRAFANA_PASSWORD=[mot_de_passe_genere]
```

**Permissions** : `600` (lecture/écriture uniquement pour root)

### Fichier d'Environnement : `/opt/yukpo/.grafana-env`

**Contenu** :
```bash
export GRAFANA_URL="http://localhost:3002"
export GRAFANA_USER="admin"
export GRAFANA_PASSWORD="[mot_de_passe_genere]"
```

**Usage** : Pour charger dans les scripts bash

---

## 🚀 Utilisation

### Méthode 1 : Charger dans un Script

```bash
# Charger les credentials
source /opt/yukpo/.grafana-env

# Utiliser dans les commandes
curl -u "$GRAFANA_USER:$GRAFANA_PASSWORD" "$GRAFANA_URL/api/dashboards"
```

### Méthode 2 : Utiliser le Script de Chargement

```bash
# Charger les credentials
source /opt/yukpo/load-grafana-credentials.sh

# Les variables sont maintenant disponibles
curl -u "$GRAFANA_USER:$GRAFANA_PASSWORD" "$GRAFANA_URL/api/dashboards"
```

### Méthode 3 : Lire Directement le Fichier

```bash
# Lire le mot de passe
GRAFANA_PASSWORD=$(grep GRAFANA_PASSWORD /opt/yukpo/.grafana-secrets | cut -d= -f2)

# Utiliser
curl -u "admin:$GRAFANA_PASSWORD" http://localhost:3002/api/dashboards
```

---

## 🔧 Intégration dans les Scripts

### Exemple : Script qui utilise Grafana

```bash
#!/bin/bash

# Charger les credentials
source /opt/yukpo/load-grafana-credentials.sh

# Utiliser dans les commandes
curl -s -u "$GRAFANA_USER:$GRAFANA_PASSWORD" \
    "$GRAFANA_URL/api/dashboards" | jq .
```

### Exemple : Script PowerShell (Windows)

```powershell
# Lire depuis le serveur Hetzner
$secrets = ssh root@46.224.14.85 "cat /opt/yukpo/.grafana-secrets"
$password = ($secrets | Select-String "GRAFANA_PASSWORD").ToString().Split("=")[1]

# Utiliser
$headers = @{
    Authorization = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:$password"))
}
Invoke-RestMethod -Uri "http://46.224.14.85:3002/api/dashboards" -Headers $headers
```

---

## 🔄 Mise à Jour du Mot de Passe

### Si vous changez le mot de passe manuellement

```bash
# Mettre à jour le fichier de secrets
echo "GRAFANA_PASSWORD=nouveau_mot_de_passe" >> /opt/yukpo/.grafana-secrets
chmod 600 /opt/yukpo/.grafana-secrets
```

### Via le script automatique

```bash
bash /tmp/configurer-grafana-automatique.sh
# Le script mettra à jour automatiquement les fichiers
```

---

## 🔐 Sécurité

### Bonnes Pratiques

1. **Permissions** : Fichiers en `600` (lecture/écriture root uniquement)
2. **Backup** : Sauvegarder les fichiers de secrets en sécurité
3. **Rotation** : Changer le mot de passe régulièrement
4. **Accès** : Limiter l'accès SSH au serveur

### Backup des Secrets

```bash
# Créer un backup chiffré
tar -czf grafana-secrets-backup.tar.gz /opt/yukpo/.grafana-secrets
gpg --encrypt grafana-secrets-backup.tar.gz
```

---

## 📝 Récupération du Mot de Passe

### Si vous avez perdu le mot de passe

**Option 1 : Lire depuis le fichier de secrets**
```bash
ssh root@46.224.14.85 "cat /opt/yukpo/.grafana-secrets | grep GRAFANA_PASSWORD"
```

**Option 2 : Réinitialiser via Docker**
```bash
ssh root@46.224.14.85
cd /opt/yukpo
docker compose exec grafana grafana-cli admin reset-admin-password nouveau_mot_de_passe
```

**Option 3 : Réinitialiser via API (si vous avez encore accès)**
```bash
# Utiliser l'ancien mot de passe
curl -X PUT http://localhost:3002/api/user/password \
  -u admin:ancien_mot_de_passe \
  -H "Content-Type: application/json" \
  -d '{"oldPassword":"ancien","newPassword":"nouveau","confirmNew":"nouveau"}'
```

---

## ✅ Checklist

- [x] Fichier de secrets créé (`/opt/yukpo/.grafana-secrets`)
- [x] Fichier d'environnement créé (`/opt/yukpo/.grafana-env`)
- [x] Script de chargement créé (`load-grafana-credentials.sh`)
- [x] Permissions sécurisées (600)
- [ ] Backup des secrets créé
- [ ] Documentation partagée avec l'équipe (si applicable)

---

**Système de gestion de secrets configuré ! Les connexions peuvent maintenant être transparentes.** ✅

