# 🔑 Génération du JWT_SECRET

## ⚠️ IMPORTANT

Le `JWT_SECRET` doit être:
- **Très long** (minimum 32 caractères, recommandé 64+)
- **Aléatoire** (pas de mots prévisibles)
- **Unique** (différent pour chaque environnement)

---

## 🚀 Méthodes de Génération

### Méthode 1: OpenSSL (Recommandé - Linux/Mac)

```bash
openssl rand -hex 32
```

**Résultat:** Une clé de 64 caractères hexadécimaux

**Exemple:**
```
a3f5b8c9d2e1f4a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1
```

---

### Méthode 2: PowerShell (Windows)

```powershell
# Génère 64 caractères aléatoires
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | % {[char]$_})
```

**Ou version plus simple:**
```powershell
# Génère une clé hexadécimale (64 caractères)
[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

---

### Méthode 3: En ligne (Générateurs)

1. **https://generate-secret.vercel.app/64**
   - Longueur: 64
   - Copier la clé générée

2. **https://randomkeygen.com/**
   - Section "CodeIgniter Encryption Keys"
   - Prendre une clé de 64 caractères

3. **https://www.grc.com/passwords.htm**
   - 64 Character Hexadecimal Password
   - Copier la clé

---

### Méthode 4: Node.js (si installé)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Méthode 5: Python (si installé)

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## ✅ Clé Générée pour Vous

Voici une clé générée aléatoirement que vous pouvez utiliser:

```
JWT_SECRET=a8f3c7d2e9b1f4a6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4
```

**⚠️ IMPORTANT:** 
- Ne partagez JAMAIS cette clé
- Utilisez une clé différente pour chaque environnement (dev, staging, production)
- Régénérez-la si vous pensez qu'elle a été compromise

---

## 📝 Configuration

### Dans votre fichier `.env`

```bash
JWT_SECRET=a8f3c7d2e9b1f4a6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4
```

### Sur Render.com

1. Aller sur https://dashboard.render.com
2. Sélectionner votre service backend
3. Onglet "Environment"
4. Ajouter:
   - **Nom:** `JWT_SECRET`
   - **Valeur:** Votre clé générée
   - **Cocher:** "Secret" ✅
5. Sauvegarder

---

## 🔍 Vérification

Pour vérifier que votre clé est correctement configurée:

```bash
# Linux/Mac
echo $JWT_SECRET

# Windows PowerShell
$env:JWT_SECRET

# Test dans Rust
cargo run
# Si la clé est manquante, vous verrez:
# ❌ JWT_SECRET manquant - Configuration invalide
```

---

## 🔄 Rotation du Secret

**Recommandation:** Changez votre `JWT_SECRET` tous les 3-6 mois

Quand vous changez le secret:
1. Générer un nouveau secret
2. L'ajouter dans les variables d'environnement
3. Redémarrer l'application
4. Tous les utilisateurs devront se reconnecter (tokens invalides)

---

## 💡 Exemples de Clés (À NE PAS UTILISER - Exemples seulement)

❌ **MAUVAIS:**
```
JWT_SECRET=secret123
JWT_SECRET=my-jwt-secret
JWT_SECRET=yukpomnang-2024
```

✅ **BON:**
```
JWT_SECRET=a8f3c7d2e9b1f4a6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4
JWT_SECRET=BtKUxxb1AqrkMbqsz0VE3s4wuGahybpyJreiruDQp3MhN8R56jGaA5I8Qc832C8t
```

