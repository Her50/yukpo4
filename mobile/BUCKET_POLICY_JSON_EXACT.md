# 📋 JSON Bucket Policy - Code Exact à Coller

## ✅ Code JSON complet

Copiez-collez exactement ce code dans l'éditeur de Bucket Policy :

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

## 📝 Où le coller

1. **Allez dans l'onglet "Permissions"** (pas "Access Control")
2. **Trouvez la section "Bucket Policy"**
3. **Cliquez sur "Edit"** (bouton violet)
4. **L'éditeur de code s'ouvre** (fond bleu foncé)
5. **Sélectionnez tout le contenu** de l'éditeur (s'il y en a)
6. **Supprimez-le** et **collez le code ci-dessus**
7. **Cliquez sur "Save"** ou **"Apply"**

## ✅ Ce que fait ce code

- ✅ Autorise **tout le monde** (`"Principal": "*"`) à **lire** (`"Action": "s3:GetObject"`)
- ✅ Sur **tous les fichiers** du bucket (`"Resource": "arn:aws:s3:::yukpo-video-prod/*"`)
- ✅ Permet au **Worker Cloudflare** d'accéder aux vidéos
- ✅ Permet aux **utilisateurs** de voir les vidéos

## 🎯 Après avoir collé et sauvegardé

1. Le code devrait être sauvegardé
2. L'avertissement jaune devrait disparaître (ou rester mais ne pas bloquer)
3. Testez : `https://cdn.yukpomnang.com/uploads/videos/un-fichier.mp4`

---

**Copiez le code JSON ci-dessus et collez-le dans l'éditeur de Bucket Policy !**



