# Résumé : Docker Auto-Start et Production

## ✅ Réponse à vos questions

### 1. Faut-il ouvrir Docker chaque fois pour LiveKit ?

**En développement :** 
- **OUI**, si Docker Desktop n'est pas configuré pour démarrer automatiquement
- **NON**, si vous configurez l'auto-start (voir ci-dessous)

**En production :**
- **NON**, Docker démarre automatiquement au boot du serveur Linux

---

## 🖥️ Développement Local (Windows)

### Configuration Auto-Start (Recommandé)

#### Option 1 : Script Automatique
```powershell
.\scripts\configurer_docker_auto_start.ps1
```

#### Option 2 : Docker Desktop Settings
1. Ouvrir **Docker Desktop**
2. **Settings** (⚙️) > **General**
3. Cocher **"Start Docker Desktop when you log in"**
4. **Apply & Restart**

**Résultat :** Docker Desktop démarre automatiquement à chaque connexion Windows.

### Démarrage des Services

Une fois Docker démarré (automatiquement ou manuellement) :

```powershell
# Ouvrir un NOUVEAU PowerShell
cd C:\Users\23767\yukpomnang2

# Démarrer tous les services
docker-compose up -d

# OU utiliser le script
.\scripts\verifier_docker_et_demarrer.ps1
```

**Les services (PostgreSQL, LiveKit, etc.) démarrent automatiquement** avec `docker-compose up -d`.

---

## 🚀 Production (Serveur Linux)

### Différences Clés

| Aspect | Développement | Production |
|--------|---------------|------------|
| **Docker** | Docker Desktop (GUI) | Docker Engine (CLI) |
| **Démarrage** | Manuel ou au login | **Automatique au boot** |
| **Services** | `docker-compose up -d` | **Auto-start avec systemd** |

### En Production

1. **Docker démarre automatiquement** au boot du serveur
   ```bash
   sudo systemctl enable docker
   ```

2. **Services démarrent automatiquement** avec un service systemd
   ```bash
   # Créer /etc/systemd/system/yukpo-services.service
   # Démarrer au boot
   sudo systemctl enable yukpo-services
   ```

3. **Pas besoin d'ouvrir Docker** - tout est automatique !

---

## 📋 Workflow Recommandé

### Développement
1. ✅ Configurer auto-start Docker Desktop
2. ✅ Au démarrage Windows → Docker démarre automatiquement
3. ✅ Exécuter `docker-compose up -d` une fois
4. ✅ Les services restent actifs jusqu'à `docker-compose down`

### Production
1. ✅ Docker Engine installé sur serveur Linux
2. ✅ Docker démarre au boot (systemd)
3. ✅ Service systemd pour auto-start des services
4. ✅ Tout démarre automatiquement au boot

---

## 🔧 Scripts Créés

1. **`scripts/configurer_docker_auto_start.ps1`**
   - Configure Docker Desktop pour démarrer automatiquement
   - Crée une tâche planifiée Windows
   - Ajoute au dossier de démarrage

2. **`scripts/GUIDE_DOCKER_DEV_VS_PROD.md`**
   - Guide complet dev vs prod
   - Instructions détaillées

3. **`scripts/verifier_docker_et_demarrer.ps1`**
   - Vérifie Docker et démarre les services

---

## ✅ Prochaines Étapes

### Maintenant (Développement)
1. **Ouvrir un NOUVEAU PowerShell**
2. **Vérifier Docker :**
   ```powershell
   docker --version
   ```
3. **Configurer auto-start :**
   ```powershell
   .\scripts\configurer_docker_auto_start.ps1
   ```
4. **Démarrer les services :**
   ```powershell
   docker-compose up -d
   ```

### Pour la Production
1. Installer Docker Engine sur serveur Linux
2. Configurer systemd pour auto-start
3. Déployer avec `docker-compose up -d`
4. Tout démarre automatiquement au boot

---

**Résumé :** En développement, configurez l'auto-start de Docker Desktop. En production, Docker démarre automatiquement au boot du serveur Linux.

