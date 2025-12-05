# 📋 Guide : Configurer Bucket Policy Wasabi - Étape par Étape

## ⚠️ ATTENTION : Vous êtes au mauvais endroit !

La page **"Policies"** est pour les IAM policies (gestion des utilisateurs), **PAS** pour la bucket policy.

## ✅ Bonne procédure

### Étape 1 : Aller dans "Buckets"
1. Dans le menu de gauche, cliquez sur **"Buckets"** (avec l'icône de bucket 🪣)
2. Vous verrez la liste de tous vos buckets

### Étape 2 : Sélectionner votre bucket
1. Trouvez le bucket : **`yukpo-video-prod`**
2. Cliquez sur le **nom du bucket** (pas sur une icône, sur le nom)

### Étape 3 : Ouvrir les Permissions
1. Une fois dans le bucket, cherchez un onglet ou un menu :
   - **"Permissions"** ou
   - **"Access Control"** ou
   - **"Bucket Settings"** ou
   - **"Policy"** ou
   - Un icône d'engrenage ⚙️ ou de cadenas 🔒
2. Cliquez dessus

### Étape 4 : Ajouter la Bucket Policy
1. Cherchez une section **"Bucket Policy"** ou **"Policy Editor"**
2. Il y aura probablement un bouton :
   - **"Edit Policy"** ou
   - **"Add Policy"** ou
   - **"Set Policy"**
3. Cliquez dessus

### Étape 5 : Coller le code
1. Un éditeur de texte/JSON s'ouvrira
2. Collez cette policy :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::yukpo-video-prod/*"
    }
  ]
}
```

3. **Sauvegardez** (bouton "Save" ou "Apply")

### Étape 6 : Vérifier "Block Public Access"
1. Dans la même page de permissions, cherchez :
   - **"Block Public Access"** ou
   - **"Public Access Settings"**
2. Si c'est activé (ON), **désactivez-le**
3. Sauvegardez

## 🎯 Résumé visuel

```
Wasabi Console
├── Sidebar (gauche)
│   └── "Buckets" ← CLIQUEZ ICI
│       └── "yukpo-video-prod" ← CLIQUEZ ICI
│           └── "Permissions" ou "Access Control" ← CLIQUEZ ICI
│               └── "Bucket Policy" ← COLLEZ LE CODE ICI
```

## ❓ Si vous ne trouvez pas "Bucket Policy"

Wasabi peut avoir une interface différente. Cherchez :

1. **Dans l'onglet "Permissions"** du bucket
2. **"Access Control"** puis **"Bucket Policy"**
3. **"Settings"** puis **"Permissions"**
4. Un bouton **"Make Public"** ou **"Public Access"**

## 📸 Alternative : Interface Graphique

Si Wasabi propose une interface graphique (pas d'éditeur JSON) :
- Cherchez une option **"Allow Public Read"** ou **"Public Access"**
- Activez-la pour les objets du bucket

## ✅ Après avoir configuré

Testez dans le navigateur :
- URL : `https://yukpo-video-prod.s3.eu-central-1.wasabisys.com/uploads/videos/un-fichier.mp4`
- Si vous voyez la vidéo ou une erreur 404 (pas AccessDenied) → ✅ Ça marche !



