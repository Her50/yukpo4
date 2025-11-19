# 🏗️ Clarification Architecture - Grafana et Backend

## 📊 Architecture Actuelle

### 1. **Backend (Render - Cloud)**
- **URL** : `https://yukpomnang.onrender.com`
- **Localisation** : Cloud Render (PaaS)
- **Rôle** : Application backend Rust/Axum
- **Métriques** : Expose `/metrics` pour Prometheus

### 2. **Grafana (Hetzner - Serveur Dédié)**
- **URL publique** : `http://46.224.14.85:3002` (accessible depuis internet)
- **URL interne** : `http://localhost:3000` (accessible depuis le serveur Hetzner)
- **Localisation** : Serveur Hetzner (46.224.14.85)
- **Rôle** : Visualisation des métriques
- **Docker** : Tourne dans un container Docker

### 3. **Prometheus (Hetzner - Serveur Dédié)**
- **URL publique** : `http://46.224.14.85:9090`
- **Localisation** : Serveur Hetzner (même serveur que Grafana)
- **Rôle** : Collecte des métriques depuis le backend Render

---

## 🔌 Ports Docker

### Sur Hetzner (Docker Compose)

```yaml
grafana:
  ports:
    - "3002:3000"  # Port externe:Port interne
    # 3002 = accessible depuis internet
    # 3000 = port interne du container
```

**Explication** :
- **Port 3002** : Port exposé publiquement (accessible depuis votre navigateur)
- **Port 3000** : Port interne du container Grafana (accessible depuis le serveur Hetzner)

---

## ✅ Impact du Changement de Mot de Passe

### ❌ N'Impacte PAS le Backend Render

**Pourquoi ?**
- Le backend sur Render est **indépendant** de Grafana
- Grafana est juste un outil de **visualisation**
- Changer le mot de passe Grafana n'affecte que l'**accès à l'interface Grafana**

### ✅ Impacte Seulement l'Accès à Grafana

**Ce qui change** :
- Vous devez utiliser le nouveau mot de passe pour vous connecter à Grafana
- Les autres services (Prometheus, Backend) ne sont **pas affectés**

---

## 🎯 Pourquoi Utiliser le Port 3000 ?

### Script Exécuté SUR Hetzner

Quand vous exécutez le script :
```bash
ssh root@46.224.14.85  # Vous êtes SUR le serveur Hetzner
cd /opt/yukpo
bash changer-password-grafana.sh  # Script s'exécute SUR Hetzner
```

**Depuis le serveur Hetzner** :
- ✅ `http://localhost:3000` → Accessible (port interne du container)
- ❌ `http://localhost:3002` → **NON accessible** (c'est le port externe, pas interne)

**Depuis votre navigateur (votre ordinateur)** :
- ✅ `http://46.224.14.85:3002` → Accessible (port externe)
- ❌ `http://46.224.14.85:3000` → **NON accessible** (port interne, pas exposé)

---

## 🔧 Solution

### Option 1 : Utiliser le Port Interne (Recommandé)

**Dans le script** (exécuté sur Hetzner) :
```bash
GRAFANA_URL="http://localhost:3000"  # Port interne
```

**Avantages** :
- ✅ Fonctionne depuis le serveur Hetzner
- ✅ Pas besoin d'exposer Grafana publiquement pour le script
- ✅ Plus sécurisé

### Option 2 : Utiliser le Port Externe via IP

**Dans le script** (exécuté sur Hetzner) :
```bash
GRAFANA_URL="http://46.224.14.85:3002"  # Port externe
```

**Avantages** :
- ✅ Fonctionne aussi
- ⚠️ Nécessite que le port 3002 soit accessible depuis le serveur lui-même

---

## 📋 Résumé

| Élément | Localisation | Port | Impact Changement MDP |
|---------|--------------|------|----------------------|
| **Backend** | Render (Cloud) | 443 (HTTPS) | ❌ Aucun impact |
| **Grafana** | Hetzner | 3000 (interne) / 3002 (externe) | ✅ Seulement accès Grafana |
| **Prometheus** | Hetzner | 9090 | ❌ Aucun impact |

**Conclusion** : Utiliser le port 3000 (interne) dans le script n'impacte **PAS** la production dans le cloud. C'est juste pour accéder à Grafana depuis le serveur Hetzner.

---

## 🚀 Action à Faire

**Exécuter le script avec le port interne** :
```bash
ssh root@46.224.14.85
cd /opt/yukpo
GRAFANA_URL="http://localhost:3000" GRAFANA_NEW_PASSWORD='VotreMotDePasseSecurise123!' bash changer-password-grafana.sh
```

**Résultat** :
- ✅ Mot de passe Grafana changé
- ✅ Vous pouvez vous connecter avec le nouveau mot de passe sur `http://46.224.14.85:3002`
- ✅ Backend Render : **Aucun impact**

