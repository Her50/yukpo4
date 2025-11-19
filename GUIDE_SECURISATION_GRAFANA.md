# 🔒 Guide de Sécurisation Grafana

## 🎯 Objectif

Sécuriser l'accès à Grafana en changeant le mot de passe admin par défaut et en configurant l'authentification.

---

## 🔐 Étape 1 : Changer le Mot de Passe Admin

### Méthode 1 : Via l'Interface Grafana (Recommandé)

1. **Accéder à Grafana** :
   ```
   http://46.224.14.85:3002
   ```

2. **Se connecter** :
   - Login: `admin`
   - Password: `admin` (mot de passe par défaut)

3. **Changer le mot de passe** :
   - Cliquer sur l'icône **profil** (en bas à gauche)
   - Menu : **Profile** → **Change Password**
   - Entrer :
     - **Old password** : `admin`
     - **New password** : [Votre nouveau mot de passe fort]
     - **Confirm password** : [Confirmer]
   - Cliquer **Change Password**

4. **Confirmer** :
   - Vous serez déconnecté automatiquement
   - Reconnectez-vous avec le nouveau mot de passe

### Méthode 2 : Via l'API Grafana

```bash
# Sur Hetzner
ssh root@46.224.14.85

# Changer le mot de passe via API
curl -X PUT http://localhost:3002/api/user/password \
  -u admin:admin \
  -H "Content-Type: application/json" \
  -d '{
    "oldPassword": "admin",
    "newPassword": "VotreNouveauMotDePasseFort123!",
    "confirmNew": "VotreNouveauMotDePasseFort123!"
  }'
```

### Méthode 3 : Via Variables d'Environnement (Docker Compose)

**Modifier `docker-compose.yml`** :

```yaml
grafana:
  environment:
    - GF_SECURITY_ADMIN_USER=admin
    - GF_SECURITY_ADMIN_PASSWORD=VotreNouveauMotDePasseFort123!  # ⚠️ À changer
    - GF_SECURITY_ADMIN_PASSWORD_FILE=/run/secrets/grafana_password  # Optionnel : fichier secret
```

**Redémarrer Grafana** :
```bash
cd /opt/yukpo
docker compose restart grafana
```

**⚠️ Attention** : Cette méthode expose le mot de passe dans le fichier. Utilisez plutôt un fichier secret ou changez via l'interface.

---

## 🔒 Étape 2 : Configurer l'Authentification (Optionnel mais Recommandé)

### Option A : Authentification Basique Nginx

**Créer un fichier de mots de passe** :
```bash
# Sur Hetzner
ssh root@46.224.14.85
cd /opt/yukpo

# Installer htpasswd
apt-get update && apt-get install -y apache2-utils

# Créer un utilisateur
htpasswd -c /opt/yukpo/nginx/.htpasswd admin
# Entrer le mot de passe quand demandé
```

**Configurer Nginx** :
```nginx
# /opt/yukpo/nginx/grafana.conf
server {
    listen 80;
    server_name grafana.yukpo.com;  # Ou IP: 46.224.14.85

    location / {
        auth_basic "Grafana Access";
        auth_basic_user_file /etc/nginx/.htpasswd;
        
        proxy_pass http://grafana:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Option B : Authentification OAuth (Google, GitHub, etc.)

**Dans Grafana** :
1. Configuration → Authentication
2. Configurer OAuth provider (Google, GitHub, etc.)
3. Suivre la documentation Grafana pour votre provider

---

## 🛡️ Étape 3 : Configurer SSL/TLS (Production)

### Option A : Nginx avec Let's Encrypt

```bash
# Sur Hetzner
apt-get install -y certbot python3-certbot-nginx

# Obtenir un certificat
certbot --nginx -d grafana.yukpo.com

# Renouvellement automatique
certbot renew --dry-run
```

### Option B : Traefik avec Let's Encrypt

Si vous utilisez Traefik, configurer les labels :

```yaml
grafana:
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.grafana.rule=Host(`grafana.yukpo.com`)"
    - "traefik.http.routers.grafana.tls.certresolver=letsencrypt"
```

---

## 🔥 Étape 4 : Configurer le Firewall

### Sur Hetzner

```bash
# Autoriser seulement certaines IPs (optionnel)
ufw allow from VOTRE_IP to any port 3002
ufw deny 3002

# Ou autoriser tout (moins sécurisé)
ufw allow 3002
```

### Via Hetzner Cloud Console

1. Aller sur : https://console.hetzner.cloud
2. Sélectionner votre serveur
3. Firewall → Créer une règle
4. Autoriser port 3002 seulement depuis certaines IPs

---

## 📊 Étape 5 : Configurer les Permissions Utilisateurs

### Créer des Utilisateurs avec Permissions Limitées

1. **Dans Grafana** :
   - Administration → Users → New User
   - Créer un utilisateur avec rôle "Viewer" (lecture seule)
   - Ou "Editor" (peut modifier les dashboards)

2. **Organisations** :
   - Créer des organisations séparées si nécessaire
   - Assigner des utilisateurs à des organisations

---

## 🔍 Étape 6 : Activer les Logs d'Audit

**Dans Grafana** :
1. Configuration → Preferences → Logs
2. Activer "Log successful logins"
3. Activer "Log failed logins"

**Vérifier les logs** :
```bash
# Sur Hetzner
docker compose logs grafana | grep -i "login\|auth\|failed"
```

---

## ✅ Checklist de Sécurisation

- [ ] Mot de passe admin changé (via interface ou API)
- [ ] Mot de passe fort utilisé (min 12 caractères, majuscules, chiffres, symboles)
- [ ] Authentification Nginx configurée (optionnel)
- [ ] SSL/TLS configuré (production)
- [ ] Firewall configuré (limiter accès si possible)
- [ ] Utilisateurs avec permissions limitées créés
- [ ] Logs d'audit activés
- [ ] Variables d'environnement sécurisées (pas de mots de passe en clair)

---

## 🧪 Test de Sécurité

### Test 1 : Vérifier que l'Ancien Mot de Passe ne Fonctionne Plus

```bash
# Tester avec l'ancien mot de passe
curl -u admin:admin http://46.224.14.85:3002/api/user
# Devrait retourner une erreur 401
```

### Test 2 : Vérifier que le Nouveau Mot de Passe Fonctionne

```bash
# Tester avec le nouveau mot de passe
curl -u admin:VotreNouveauMotDePasse http://46.224.14.85:3002/api/user
# Devrait retourner les informations utilisateur
```

---

## 📝 Bonnes Pratiques

1. **Mots de passe forts** : Minimum 12 caractères, mixte majuscules/minuscules, chiffres, symboles
2. **Rotation des mots de passe** : Changer tous les 90 jours
3. **Accès limité** : Utiliser un VPN ou whitelist IP si possible
4. **Monitoring** : Surveiller les tentatives de connexion échouées
5. **Backup** : Sauvegarder régulièrement la configuration Grafana

---

## 🚨 En Cas de Compromission

1. **Changer immédiatement le mot de passe**
2. **Vérifier les logs** pour activité suspecte
3. **Révoquer les sessions actives** :
   ```bash
   # Dans Grafana
   Administration → Users → [Utilisateur] → Revoke all sessions
   ```
4. **Vérifier les dashboards** modifiés récemment
5. **Vérifier les data sources** configurées

---

**Grafana sécurisé ! 🔒**

