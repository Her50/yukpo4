# 🚀 Installer sqlx avec curl (Alternative à wget)

**Date**: 2026-02-13  
**Problème**: `wget` non installé sur l'instance EC2

---

## ✅ **SOLUTION - Utiliser curl**

Sur votre instance EC2, exécutez ces commandes :

```bash
# 1. Télécharger le binaire précompilé avec curl
cd /tmp
curl -L -o sqlx-cli.tar.gz https://github.com/launchbadge/sqlx/releases/download/v0.8.6/sqlx-cli-v0.8.6-x86_64-unknown-linux-musl.tar.gz

# 2. Extraire
tar -xzf sqlx-cli.tar.gz

# 3. Installer
sudo mv sqlx /usr/local/bin/
chmod +x /usr/local/bin/sqlx

# 4. Vérifier
sqlx --version
```

Vous devriez voir :
```
sqlx-cli 0.8.6
```

---

## 🔧 **ALTERNATIVE - Installer wget d'abord**

Si vous préférez utiliser `wget` :

```bash
# Installer wget
sudo yum install -y wget

# Puis utiliser les commandes originales
cd /tmp
wget https://github.com/launchbadge/sqlx/releases/download/v0.8.6/sqlx-cli-v0.8.6-x86_64-unknown-linux-musl.tar.gz
tar -xzf sqlx-cli-v0.8.6-x86_64-unknown-linux-musl.tar.gz
sudo mv sqlx /usr/local/bin/
chmod +x /usr/local/bin/sqlx
sqlx --version
```

---

## ✅ **RECOMMANDATION**

**Utilisez `curl`** (première solution) car il est généralement déjà installé sur Amazon Linux 2023.

---

**Exécutez les commandes avec `curl` ci-dessus et dites-moi si ça fonctionne !**

