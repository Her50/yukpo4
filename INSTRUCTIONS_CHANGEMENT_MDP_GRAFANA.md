# 🔐 Instructions Changement Mot de Passe Grafana

## 📋 Résumé

Le script a été copié sur Hetzner mais la connexion échoue. Voici les étapes à suivre :

## ✅ Script Disponible

**Fichier sur Hetzner** : `/opt/yukpo/changer-password-grafana-fix.sh`

## 🔧 Exécution Manuelle

**Connectez-vous à Hetzner** :
```bash
ssh root@46.224.14.85
cd /opt/yukpo
```

**Exécutez le script** :
```bash
GRAFANA_NEW_PASSWORD='VotreMotDePasseSecurise123!' bash changer-password-grafana-fix.sh
```

## ⚠️ Si le Mot de Passe Actuel n'est pas "admin"

Si le mot de passe actuel a déjà été changé, utilisez :
```bash
GRAFANA_OLD_PASSWORD='ancien_mot_de_passe' GRAFANA_NEW_PASSWORD='nouveau_mot_de_passe' bash changer-password-grafana-fix.sh
```

## 🔍 Vérification

**Vérifier que Grafana est accessible** :
```bash
curl http://localhost:3000/api/health
```

**Tester la connexion** :
```bash
curl -u "admin:admin" http://localhost:3000/api/user
```

## 📝 Note sur les Ports

- **Port 3000** : Port interne du container Grafana (utilisé par le script)
- **Port 3002** : Port externe exposé publiquement (pour votre navigateur)

**Le changement de mot de passe n'impacte PAS le backend Render** - c'est juste pour sécuriser l'accès à Grafana.

## ✅ Après le Changement

**Connectez-vous à Grafana** :
- URL : `http://46.224.14.85:3002`
- Login : `admin`
- Password : `VotreMotDePasseSecurise123!`

---

**Le script est prêt sur le serveur. Exécutez-le manuellement si nécessaire.** ✅

