# 🔧 Correction AccessDenied Wasabi - Étapes Simples

## ✅ Le Worker fonctionne !
L'erreur "AccessDenied" signifie que :
- ✅ Le Worker Cloudflare fait bien la requête vers Wasabi
- ❌ **Wasabi refuse l'accès** (bucket pas public)

## 🛠️ Solution : Rendre le bucket Wasabi public

### Étape 1 : Ouvrir Wasabi Console
1. Allez sur : **https://console.wasabisys.com**
2. Connectez-vous avec vos identifiants

### Étape 2 : Trouver votre bucket
1. Dans le menu, cliquez sur **"Buckets"**
2. Trouvez le bucket : **`yukpo-video-prod`**
3. Cliquez sur le nom du bucket

### Étape 3 : Configurer les permissions
1. **Onglet "Permissions"** ou **"Access Control"**
2. Cherchez **"Bucket Policy"** ou **"Public Access"**

### Étape 4 : Ajouter une Bucket Policy
1. Cliquez sur **"Edit Bucket Policy"** ou **"Add Policy"**
2. Collez cette policy (remplacez le nom du bucket si différent) :

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

3. **Sauvegardez** la policy

### Étape 5 : Vérifier "Block Public Access"
1. Cherchez **"Block Public Access"** ou **"Block Public Access settings"**
2. Si c'est **activé** (ON) :
   - Cliquez sur **"Edit"**
   - **Désactivez** toutes les options :
     - ☐ Block public access to buckets
     - ☐ Block public access to buckets granted through new access control lists (ACLs)
     - ☐ Block public access to buckets granted through any access control lists (ACLs)
     - ☐ Block public access to buckets granted through new public bucket or access point policies
   - Cliquez sur **"Save"**

### Étape 6 : Tester
1. Testez directement Wasabi :
   - Ouvrez : `https://yukpo-video-prod.s3.eu-central-1.wasabisys.com/uploads/videos/un-nom-de-fichier.mp4`
   - Remplacez `un-nom-de-fichier.mp4` par un vrai nom de fichier vidéo dans votre bucket
   - Si vous voyez la vidéo ou une erreur 404 (pas AccessDenied) → ✅ **Ça marche !**

2. Testez via le Worker :
   - Ouvrez : `https://cdn.yukpomnang.com/uploads/videos/un-nom-de-fichier.mp4`
   - Devrait maintenant fonctionner !

## ⚠️ Alternative : Utiliser le chemin exact

Si vous ne savez pas quel fichier tester, regardez dans Wasabi Console :
1. Ouvrez le bucket `yukpo-video-prod`
2. Naviguez dans les dossiers pour trouver un fichier vidéo
3. Cliquez sur le fichier pour voir son URL complète
4. Testez cette URL directement dans le navigateur

## 📝 Note
Une fois le bucket public, le Worker pourra récupérer les vidéos depuis Wasabi et les servir via Cloudflare CDN avec cache.

