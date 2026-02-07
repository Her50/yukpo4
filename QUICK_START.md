# 🚀 Quick Start - Configuration HTTPS

**Temps estimé**: 20-45 minutes

## 📋 En 3 Étapes Simples

### 1️⃣ Comment savoir où est géré votre DNS ?

**Méthode rapide** (PowerShell):
```powershell
Resolve-DnsName -Name "yukpomnang.com" -Type NS
```

**Résultat**:
- Si vous voyez `ns1.cloudflare.com` → **Cloudflare** → [Instructions](#cloudflare)
- Si vous voyez `ns1.godaddy.com` → **GoDaddy** → [Instructions](#godaddy)
- Si vous voyez `ns-xxx.awsdns-xx.com` → **AWS Route 53** → [Instructions](#route-53)
- Si vous voyez `ns1.namecheap.com` → **Namecheap** → [Instructions](#instructions-générales)
- Autre ? → [Instructions Générales](#instructions-générales)

**Autres méthodes**:
- Vérifiez vos emails de facture du domaine
- Connectez-vous à Cloudflare, GoDaddy, AWS, etc. pour vérifier
- Voir `GUIDE_ETAPES_MANUEL.md` section "ÉTAPE 1" pour plus de détails

---

### 2️⃣ Ajoutez ces 2 enregistrements CNAME

#### Enregistrement 1:
```
Type: CNAME
Name: api
Value: yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com
TTL: 300
```

#### Enregistrement 2:
```
Type: CNAME
Name: _07560c403145510b496c9b8313c6c600.api
Value: _91b2a9695a4220c151e8615cde4edbd2.jkddzztszm.acm-validations.aws.
TTL: 300
```

---

### 3️⃣ Lancez le script automatique

```powershell
.\scripts\wait-and-automate-https.ps1
```

Le script va automatiquement :
- ✅ Vérifier les DNS
- ⏳ Attendre la validation (10-35 min)
- 🔧 Ajouter le listener HTTPS
- ✅ Tester la connexion

---

## 📝 Instructions Détaillées par Fournisseur

### Cloudflare

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → Sélectionnez `yukpomnang.com`
2. **DNS** → **Records** → **Add record**
3. Ajoutez les 2 CNAME ci-dessus
4. **Save**

### GoDaddy

1. [GoDaddy](https://www.godaddy.com) → **My Products** → **DNS**
2. Sélectionnez `yukpomnang.com`
3. **Add** → Ajoutez les 2 CNAME ci-dessus
4. **Save**

### Route 53

1. [AWS Console](https://console.aws.amazon.com) → **Route 53** → **Hosted zones**
2. Sélectionnez `yukpomnang.com`
3. **Create record** → Ajoutez les 2 CNAME ci-dessus
4. **Create records**

### Instructions Générales

1. Connectez-vous à votre fournisseur DNS
2. Trouvez la section **DNS** ou **Zone DNS**
3. Ajoutez les 2 enregistrements CNAME ci-dessus
4. Sauvegardez

---

## ✅ Vérification

Après 2-5 minutes, vérifiez :

```powershell
Resolve-DnsName -Name "api.yukpomnang.com" -Type CNAME
```

Si vous voyez `yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com`, c'est bon ! ✅

---

## 🎯 C'est tout !

Une fois les DNS ajoutés, lancez simplement :

```powershell
.\scripts\wait-and-automate-https.ps1
```

Et attendez que le script termine. Tout le reste est automatique ! 🚀

---

**Besoin d'aide ?** Voir `GUIDE_ETAPES_MANUEL.md` pour un guide détaillé.

