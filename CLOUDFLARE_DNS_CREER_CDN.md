# ✅ Cloudflare DNS : Créer le Sous-domaine CDN

## 🎯 Vous Êtes au Bon Endroit !

Vous êtes dans **Cloudflare DNS** pour `yukpomnang.com`.

---

## 🖱️ Action Immédiate

### **Cliquez sur le Bouton Bleu** :

**"Ajouter un enregistrement"** (Add a record)

C'est le **bouton bleu avec un "+"** en haut à droite du tableau DNS.

---

## 📋 Après Avoir Cliqué

Un formulaire s'ouvrira. Remplissez :

1. **Type** : Sélectionnez **"CNAME"** dans le menu déroulant

2. **Nom** : Tapez **`cdn`**
   - ⚠️ **Important** : Juste `cdn`, pas `cdn.yukpomnang.com`

3. **Cible** : Laissez vide ou mettez `yukpomnang.com`
   - (Cloudflare remplira automatiquement)

4. **Proxy** : ✅ **Activé** (nuage orange)
   - ⚠️ **TRÈS IMPORTANT** : Le nuage doit être **orange** (activé)
   - Si c'est gris, cliquez dessus pour l'activer

5. **TTL** : Laissez "Auto"

6. **Cliquez sur "Sauvegarder"** ou "Save"

---

## ✅ Résultat Attendu

Après sauvegarde, vous verrez un nouvel enregistrement dans le tableau :

```
Type: CNAME
Nom: cdn
Contenu: yukpomnang.com
Statut du proxy: Procuration (nuage orange)
TTL: Auto
```

**Cela créera** : `cdn.yukpomnang.com`

---

## 🎯 Résumé

1. ✅ Cliquez sur **"Ajouter un enregistrement"** (bouton bleu)
2. ✅ Type : **CNAME**
3. ✅ Nom : **`cdn`**
4. ✅ Proxy : **✅ Activé** (nuage orange)
5. ✅ Sauvegardez

---

*Date : 2025-12-03*  
*Créer sous-domaine CDN dans Cloudflare*

