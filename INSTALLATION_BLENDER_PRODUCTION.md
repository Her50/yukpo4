# 🎨 Installation Blender en Production (Render/AWS)

## ⚠️ IMPORTANT

**Le chemin Windows ne fonctionne PAS en production!**

En production, les serveurs utilisent **Linux**, donc le chemin doit être différent.

---

## 🚀 Option 1: Installation via Dockerfile (RECOMMANDÉ)

### Pour Render.com

Ajoutez dans votre `backend/Dockerfile` ou créez un `render.yaml`:

```dockerfile
# Dans votre Dockerfile
FROM rust:1.75-slim as builder

# ... vos étapes de build existantes ...

# Image finale
FROM debian:bookworm-slim

# Installer Blender pour Linux
RUN apt-get update && apt-get install -y \
    wget \
    xz-utils \
    && wget https://download.blender.org/release/Blender4.0/blender-4.0.0-linux-x64.tar.xz \
    && tar -xf blender-4.0.0-linux-x64.tar.xz \
    && mv blender-4.0.0-linux-x64 /opt/blender \
    && rm blender-4.0.0-linux-x64.tar.xz \
    && ln -s /opt/blender/blender /usr/local/bin/blender \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ... reste de votre Dockerfile ...
```

### Configuration Render

Dans Render.com, ajoutez la variable d'environnement:

```env
BLENDER_PATH=/usr/local/bin/blender
```

---

## 🚀 Option 2: Installation via Build Command (Render)

Si vous n'utilisez pas Docker, ajoutez dans les **Build Commands** de Render:

```bash
# Dans Render Dashboard → Service → Settings → Build Command
apt-get update && \
apt-get install -y wget xz-utils && \
wget https://download.blender.org/release/Blender4.0/blender-4.0.0-linux-x64.tar.xz && \
tar -xf blender-4.0.0-linux-x64.tar.xz && \
mv blender-4.0.0-linux-x64 /opt/blender && \
rm blender-4.0.0-linux-x64.tar.xz && \
ln -s /opt/blender/blender /usr/local/bin/blender && \
cd backend && cargo build --release
```

Puis configurez:
```env
BLENDER_PATH=/usr/local/bin/blender
```

---

## 🚀 Option 3: AWS EC2 / Serveur Linux

### Installation manuelle sur EC2:

```bash
# Se connecter à votre instance EC2
ssh -i votre-cle.pem ubuntu@votre-ip

# Installer Blender
sudo apt-get update
sudo apt-get install -y wget xz-utils

# Télécharger et installer Blender
cd /tmp
wget https://download.blender.org/release/Blender4.0/blender-4.0.0-linux-x64.tar.xz
tar -xf blender-4.0.0-linux-x64.tar.xz
sudo mv blender-4.0.0-linux-x64 /opt/blender
sudo ln -s /opt/blender/blender /usr/local/bin/blender

# Vérifier l'installation
blender --version
```

### Configuration dans .env ou variables d'environnement:

```env
BLENDER_PATH=/usr/local/bin/blender
```

---

## 📋 Tableau récapitulatif

| Environnement | Chemin BLENDER_PATH | Comment installer |
|---------------|---------------------|-------------------|
| **Windows (local)** | `C:\Program Files\Blender Foundation\Blender 4.0\blender.exe` | Script PowerShell fourni |
| **Render (Docker)** | `/usr/local/bin/blender` | Ajouter dans Dockerfile |
| **Render (Build)** | `/usr/local/bin/blender` | Ajouter dans Build Command |
| **AWS EC2** | `/usr/local/bin/blender` | Installation manuelle via SSH |
| **AWS ECS/Fargate** | `/usr/local/bin/blender` | Ajouter dans Dockerfile |
| **Docker local** | `/usr/local/bin/blender` | Ajouter dans Dockerfile |

---

## ✅ Vérification

Après installation, vérifiez que Blender fonctionne:

```bash
# Sur Linux
blender --version

# Devrait afficher:
# Blender 4.0.0
```

---

## 🔧 Dépannage

### Blender non trouvé en production

1. **Vérifiez le chemin:**
   ```bash
   which blender
   # ou
   ls -la /usr/local/bin/blender
   ```

2. **Vérifiez les permissions:**
   ```bash
   chmod +x /opt/blender/blender
   ```

3. **Vérifiez la variable d'environnement:**
   ```bash
   echo $BLENDER_PATH
   ```

### Erreur "blender: command not found"

- Le lien symbolique n'est pas créé → Réexécutez: `ln -s /opt/blender/blender /usr/local/bin/blender`
- Blender n'est pas dans le PATH → Utilisez le chemin complet: `/opt/blender/blender`

---

## 📝 Notes importantes

- **Taille:** Blender fait environ 300-400 MB, prévoyez de l'espace disque
- **Performance:** Le rendu Blender est gourmand en CPU/GPU
- **Alternative:** Pour la production, envisagez d'utiliser un service de rendu externe si Blender est trop lourd

