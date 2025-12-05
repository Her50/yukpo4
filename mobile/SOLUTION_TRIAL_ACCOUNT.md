# 🔧 Solution pour Compte Trial Wasabi

## ⚠️ Problème identifié

Vous êtes sur un compte **Trial/Free** et "Public Access Override" n'est pas visible.

Selon la documentation Wasabi :
> "Public access is allowed only by certain paid (not trial) accounts."

## ✅ Solution 1 : Essayer la Bucket Policy quand même

Parfois, la Bucket Policy peut fonctionner même sans "Public Access Override" :

### Actions à faire :
1. **Allez dans "Permissions"** (onglet que vous avez trouvé)
2. **Cliquez sur "Edit"** dans "Bucket Policy"
3. **Collez ce code** :

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

4. **Sauvegardez**
5. **Testez** : Essayez d'accéder à une vidéo via le Worker

### Si ça ne marche pas → Solution 2 ci-dessous

## ✅ Solution 2 : Utiliser Wasabi Direct (sans Cloudflare Worker)

Si la Bucket Policy ne fonctionne pas avec un compte trial, utilisez Wasabi directement :

### Configuration dans `mobile/.env` :

```env
# Utiliser Wasabi directement (sans Cloudflare CDN)
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
EXPO_PUBLIC_WASABI_DIRECT_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
```

### Avantages :
- ✅ Fonctionne immédiatement (pas besoin d'accès public)
- ✅ Pas de configuration supplémentaire
- ✅ Vous pouvez tester l'application

### Inconvénients :
- ⚠️ Pas de cache CDN (performance moindre)
- ⚠️ Latence plus élevée pour utilisateurs éloignés

## ✅ Solution 3 : Passer à un compte payant Wasabi

1. **Upgrade votre compte Wasabi** vers un plan payant
2. L'option "Public Access Override" devrait apparaître
3. Activez-la et configurez la Bucket Policy

## ✅ Solution 4 : Contacter Wasabi Support

Contactez Wasabi pour demander l'activation de l'accès public :
- **Email** : support@wasabi.com
- **Demandez** : "Can you enable public access for my trial account bucket `yukpo-video-prod`?"

## 🎯 Recommandation

**Pour l'instant** :
1. ✅ **Essayez d'abord** de coller la Bucket Policy (Solution 1)
2. ✅ **Testez** si ça fonctionne
3. ✅ Si ça ne marche pas, utilisez Wasabi Direct (Solution 2)
4. ✅ **Plus tard**, passez à un compte payant pour avoir Cloudflare CDN

## 📝 Action immédiate

1. **Allez dans "Permissions"**
2. **Cliquez sur "Edit"** dans "Bucket Policy"
3. **Collez le code JSON** ci-dessus
4. **Sauvegardez**
5. **Testez** : Ouvrez `https://cdn.yukpomnang.com/uploads/videos/un-fichier.mp4` dans votre navigateur

Dites-moi si la Bucket Policy se sauvegarde et si le test fonctionne !



