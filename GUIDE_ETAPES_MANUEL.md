# 📋 Guide Étape par Étape - Actions Manuelles

**Date**: 2026-02-02

## 🎯 Objectif

Configurer HTTPS pour que le mobile puisse se connecter au backend via `https://api.yukpomnang.com`

## ✅ Ce qui est déjà fait (automatique)

- ✅ Certificat ACM créé pour `api.yukpomnang.com`
- ✅ Configuration mobile mise à jour
- ✅ Scripts d'automatisation créés

## ⚠️ Ce que VOUS devez faire manuellement

### ÉTAPE 1: Identifier où est géré votre DNS

Le domaine `yukpomnang.com` doit être géré quelque part. Voici **comment le trouver** :

#### 🔍 Méthode 1: Vérifier qui a enregistré le domaine

**Sur Windows (PowerShell)**:
```powershell
whois yukpomnang.com | Select-String "Registrar"
```

**Sur Mac/Linux**:
```bash
whois yukpomnang.com | grep -i registrar
```

**Résultat**: Vous verrez le nom du registrar (ex: "GoDaddy", "Namecheap", "Cloudflare")

#### 🔍 Méthode 2: Vérifier les serveurs DNS

**Sur Windows (PowerShell)**:
```powershell
Resolve-DnsName -Name "yukpomnang.com" -Type NS
```

**Sur Mac/Linux**:
```bash
dig NS yukpomnang.com
```

**Résultat**: Vous verrez les serveurs DNS (ex: `ns1.cloudflare.com`, `ns1.godaddy.com`, etc.)

**Comment interpréter**:
- Si vous voyez `ns1.cloudflare.com` ou `ns2.cloudflare.com` → **Cloudflare**
- Si vous voyez `ns1.godaddy.com` ou `ns2.godaddy.com` → **GoDaddy**
- Si vous voyez `ns-xxx.awsdns-xx.com` → **AWS Route 53**
- Si vous voyez `dns1.ovh.net` → **OVH**
- Si vous voyez `ns1.namecheap.com` → **Namecheap**

#### 🔍 Méthode 3: Vérifier vos comptes

Connectez-vous et vérifiez si vous avez le domaine dans :

1. **Cloudflare** → [dash.cloudflare.com](https://dash.cloudflare.com)
   - Si vous voyez `yukpomnang.com` dans la liste → C'est Cloudflare

2. **GoDaddy** → [godaddy.com](https://www.godaddy.com)
   - My Products → Si vous voyez `yukpomnang.com` → C'est GoDaddy

3. **AWS Route 53** → [console.aws.amazon.com/route53](https://console.aws.amazon.com/route53)
   - Hosted zones → Si vous voyez `yukpomnang.com` → C'est Route 53

4. **Namecheap** → [namecheap.com](https://www.namecheap.com)
   - Domain List → Si vous voyez `yukpomnang.com` → C'est Namecheap

5. **OVH** → [ovh.com/manager](https://www.ovh.com/manager)
   - Web Cloud → Domaines → Si vous voyez `yukpomnang.com` → C'est OVH

#### 🔍 Méthode 4: Vérifier vos emails

Cherchez dans vos emails :
- Email de confirmation d'achat du domaine
- Email de facture du domaine
- Email de renouvellement du domaine

Ces emails indiquent généralement le registrar.

#### 📝 Résumé

**Si vous ne savez toujours pas** :
1. Exécutez `whois yukpomnang.com` pour voir le registrar
2. Exécutez `Resolve-DnsName -Name "yukpomnang.com" -Type NS` pour voir les serveurs DNS
3. Connectez-vous aux plateformes courantes (Cloudflare, GoDaddy, etc.) pour vérifier

---

### ÉTAPE 2: Ajouter les 2 enregistrements DNS

Une fois que vous savez où est géré votre DNS, ajoutez ces **2 enregistrements CNAME** :

#### 📝 Enregistrement 1: CNAME pour l'API

**Type**: `CNAME`  
**Nom/Host**: `api` (ou `api.yukpomnang.com` selon votre interface)  
**Valeur/Target**: `yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com`  
**TTL**: `300` (ou valeur par défaut)

**Exemple visuel**:
```
Type: CNAME
Name: api
Value: yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com
TTL: 300
```

#### 📝 Enregistrement 2: CNAME pour Validation ACM

**Type**: `CNAME`  
**Nom/Host**: `_07560c403145510b496c9b8313c6c600.api` (ou `_07560c403145510b496c9b8313c6c600.api.yukpomnang.com`)  
**Valeur/Target**: `_91b2a9695a4220c151e8615cde4edbd2.jkddzztszm.acm-validations.aws.`  
**TTL**: `300` (ou valeur par défaut)

**Exemple visuel**:
```
Type: CNAME
Name: _07560c403145510b496c9b8313c6c600.api
Value: _91b2a9695a4220c151e8615cde4edbd2.jkddzztszm.acm-validations.aws.
TTL: 300
```

---

### ÉTAPE 3: Instructions par Fournisseur DNS

**✅ Votre DNS est géré par CLOUDFLARE !**

Voir `INSTRUCTIONS_CLOUDFLARE.md` pour les instructions détaillées spécifiques à Cloudflare.

#### 🌐 Si vous utilisez **Cloudflare**:

1. Connectez-vous à [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Sélectionnez le domaine `yukpomnang.com`
3. Allez dans **DNS** → **Records**
4. Cliquez sur **Add record**
5. Ajoutez les 2 enregistrements CNAME ci-dessus
6. Cliquez sur **Save**

#### 🌐 Si vous utilisez **GoDaddy**:

1. Connectez-vous à [GoDaddy](https://www.godaddy.com)
2. Allez dans **My Products** → **DNS**
3. Sélectionnez `yukpomnang.com`
4. Cliquez sur **Add** pour ajouter un enregistrement
5. Ajoutez les 2 enregistrements CNAME ci-dessus
6. Cliquez sur **Save**

#### 🌐 Si vous utilisez **AWS Route 53**:

1. Connectez-vous à [AWS Console](https://console.aws.amazon.com)
2. Allez dans **Route 53** → **Hosted zones**
3. Sélectionnez la zone pour `yukpomnang.com`
4. Cliquez sur **Create record**
5. Ajoutez les 2 enregistrements CNAME ci-dessus
6. Cliquez sur **Create records**

#### 🌐 Si vous utilisez **Namecheap**:

1. Connectez-vous à [Namecheap](https://www.namecheap.com)
2. Allez dans **Domain List** → **Manage** pour `yukpomnang.com`
3. Allez dans **Advanced DNS**
4. Cliquez sur **Add New Record**
5. Ajoutez les 2 enregistrements CNAME ci-dessus
6. Cliquez sur **Save All Changes**

#### 🌐 Si vous utilisez **OVH**:

1. Connectez-vous à [OVH Manager](https://www.ovh.com/manager)
2. Allez dans **Web Cloud** → **Domaines**
3. Sélectionnez `yukpomnang.com`
4. Allez dans **Zone DNS**
5. Cliquez sur **Ajouter une entrée**
6. Ajoutez les 2 enregistrements CNAME ci-dessus
7. Cliquez sur **Valider**

---

### ÉTAPE 4: Vérifier que les DNS sont actifs

Attendez **2-5 minutes** après avoir ajouté les enregistrements, puis vérifiez :

**Sur Windows (PowerShell)**:
```powershell
Resolve-DnsName -Name "api.yukpomnang.com" -Type CNAME
```

**Sur Mac/Linux**:
```bash
nslookup api.yukpomnang.com
```

**Résultat attendu**: Vous devriez voir `yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com`

---

### ÉTAPE 5: Lancer l'automatisation

Une fois les DNS ajoutés et vérifiés, exécutez ce script qui va automatiquement :

1. ✅ Vérifier que les DNS sont en place
2. ⏳ Attendre la validation du certificat (5-30 minutes)
3. 🔧 Ajouter le listener HTTPS sur l'ALB
4. ✅ Tester la connexion HTTPS

**Commande**:
```powershell
.\scripts\wait-and-automate-https.ps1
```

**Ce script va**:
- Vérifier périodiquement si les DNS sont actifs
- Attendre la validation du certificat ACM
- Ajouter automatiquement le listener HTTPS
- Tester la connexion HTTPS

**Temps estimé**: 10-35 minutes (selon la vitesse de validation ACM)

---

### ÉTAPE 6: Vérification finale

Une fois le script terminé, testez manuellement :

```bash
curl -v https://api.yukpomnang.com/health
```

**Résultat attendu**: Réponse `200 OK` avec les données du health check

---

## 📊 Résumé des Étapes

| Étape | Action | Qui ? | Temps |
|-------|--------|-------|-------|
| 1 | Identifier le fournisseur DNS | Vous | 2 min |
| 2 | Ajouter 2 enregistrements CNAME | Vous | 5 min |
| 3 | Vérifier les DNS | Vous | 2 min |
| 4 | Lancer le script d'automatisation | Vous | 1 min |
| 5 | Attendre (automatique) | Script | 10-35 min |
| 6 | Vérification finale | Vous | 1 min |

**Total**: ~20-45 minutes

---

## ⚠️ Problèmes Courants

### Les DNS ne se propagent pas
- **Solution**: Attendez 5-10 minutes, la propagation peut prendre du temps

### Le certificat ne se valide pas
- **Vérifiez**: Que l'enregistrement de validation ACM a bien été ajouté
- **Vérifiez**: Que le nom de l'enregistrement est exactement `_07560c403145510b496c9b8313c6c600.api.yukpomnang.com`

### Le script échoue
- **Vérifiez**: Que les DNS sont bien actifs avec `Resolve-DnsName`
- **Relancez**: Le script après quelques minutes

---

## 📞 Besoin d'aide ?

Si vous avez des questions ou des problèmes :

1. Vérifiez `ENREGISTREMENTS_DNS_A_CREER.md` pour les détails des enregistrements
2. Vérifiez `GUIDE_AUTOMATISATION_COMPLETE.md` pour plus d'infos sur le script
3. Vérifiez les logs du script pour voir où ça bloque

---

## ✅ Checklist

- [ ] J'ai identifié où est géré mon DNS
- [ ] J'ai ajouté l'enregistrement CNAME pour `api.yukpomnang.com`
- [ ] J'ai ajouté l'enregistrement CNAME pour la validation ACM
- [ ] J'ai vérifié que les DNS sont actifs
- [ ] J'ai lancé le script `wait-and-automate-https.ps1`
- [ ] Le script a terminé avec succès
- [ ] J'ai testé `https://api.yukpomnang.com/health`

Une fois toutes ces cases cochées, votre backend sera accessible via HTTPS ! 🎉

