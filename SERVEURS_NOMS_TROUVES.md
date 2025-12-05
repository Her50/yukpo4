# ✅ Serveurs de Noms Cloudflare Trouvés

## 🎯 Vos Serveurs Cloudflare

**Les 2 serveurs de noms Cloudflare à utiliser** :

```
isaac.ns.cloudflare.com
jillian.ns.cloudflare.com
```

---

## 📋 Action dans Namecheap

### **Étapes Détaillées** :

1. **Allez dans** : https://www.namecheap.com
2. **Connectez-vous** à votre compte
3. **Domain List** → Cliquez sur `yukpomnang.com`
4. **Advanced DNS** → **Nameservers**
5. **Sélectionnez** : "Custom nameservers"

6. **Supprimez les anciens serveurs** (ceux avec la croix rouge) :
   - `dns1.registrar-servers.com` ❌
   - `dns2.registrar-servers.com` ❌

7. **Ajoutez les 2 nouveaux serveurs Cloudflare** :
   - `isaac.ns.cloudflare.com` ✅
   - `jillian.ns.cloudflare.com` ✅

8. **Sauvegardez** les modifications

---

## ⏱️ Délai de Propagation

**Temps** : 24-48 heures (souvent 1-2 heures)

**Vérification** :
- Cloudflare Dashboard vous notifiera quand c'est actif
- Le statut passera de "Serveurs de noms invalides" à "Actif"

---

## ✅ Après Propagation

Une fois les DNS propagés :

1. **Créer sous-domaine CDN** : `cdn.yukpomnang.com`
2. **Configurer Workers/Page Rules**
3. **Mettre à jour** `mobile/.env`

---

*Date : 2025-12-03*  
*Serveurs de noms Cloudflare*

