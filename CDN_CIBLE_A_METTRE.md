# 📝 CDN : Que Mettre dans "Cible" ?

## 🎯 Réponse Simple

**Dans le champ "Cible"**, mettez :

```
yukpomnang.com
```

---

## 📋 Explication

Pour un CNAME `cdn`, la cible doit pointer vers votre domaine principal `yukpomnang.com`.

**Cela créera** : `cdn.yukpomnang.com` → pointe vers `yukpomnang.com`

---

## ✅ Vérification

Après avoir rempli :

- **Type** : CNAME ✅
- **Nom** : `cdn` ✅
- **Cible** : `yukpomnang.com` ✅
- **Proxy** : ✅ Activé (nuage orange) ✅
- **TTL** : Auto ✅

**Cliquez sur "Sauvegarder"** ou "Save"

---

## 🔄 Note Importante

**Plus tard**, vous configurerez Workers ou Page Rules pour que `cdn.yukpomnang.com` lise depuis Wasabi. Pour l'instant, le CNAME pointe vers votre domaine principal, ce qui est correct.

---

*Date : 2025-12-03*  
*Cible pour CDN CNAME*

