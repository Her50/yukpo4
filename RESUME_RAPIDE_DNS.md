# ⚡ Résumé Rapide - Ajouter les DNS

**Temps estimé**: 5 minutes

## 🚀 En 7 Étapes Simples

### 1️⃣ Ouvrir Cloudflare
👉 **https://dash.cloudflare.com**

### 2️⃣ Sélectionner le Domaine
👉 Cliquez sur **`yukpomnang.com`**

### 3️⃣ Aller dans DNS
👉 Menu gauche → **DNS**

### 4️⃣ Premier Enregistrement
👉 **Add record** → Remplir :
- **Type**: `CNAME`
- **Name**: `api`
- **Target**: `yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com`
- **Proxy**: **OFF** (nuage GRIS) ⚠️
- **Save**

### 5️⃣ Deuxième Enregistrement
👉 **Add record** → Remplir :
- **Type**: `CNAME`
- **Name**: `_07560c403145510b496c9b8313c6c600.api`
- **Target**: `_91b2a9695a4220c151e8615cde4edbd2.jkddzztszm.acm-validations.aws.`
- **Proxy**: **OFF** (nuage GRIS) ⚠️
- **Save**

### 6️⃣ Attendre 2-5 minutes
⏳ Propagation DNS

### 7️⃣ Lancer le Script
```powershell
.\scripts\wait-and-automate-https.ps1
```

---

## ⚠️ Points Critiques

1. **Proxy OFF** : Nuage doit être GRIS, pas orange
2. **Name** : Juste `api`, pas `api.yukpomnang.com`
3. **Target** : Copier-coller exactement, avec le point final pour la validation

---

## 📖 Guide Complet

Pour plus de détails, voir : **`GUIDE_PAS_A_PAS_CLOUDFLARE.md`**


