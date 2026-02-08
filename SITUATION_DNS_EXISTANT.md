# ⚠️ Situation: DNS Existant pour api.yukpomnang.com

**Date**: 2026-02-02

## 🔍 Découverte

**Le sous-domaine `api.yukpomnang.com` existe déjà !**

Cela signifie qu'il y a probablement déjà un enregistrement DNS pour ce sous-domaine qui pointe vers quelque chose d'autre.

## 📋 Options

### Option 1: Modifier l'enregistrement DNS existant (Recommandé)

Si `api.yukpomnang.com` pointe actuellement vers un ancien serveur ou une autre infrastructure :

1. **Identifier où est géré votre DNS** (Route 53, Cloudflare, GoDaddy, etc.)
2. **Modifier l'enregistrement CNAME existant** pour `api.yukpomnang.com`
3. **Nouvelle valeur**: `yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com`
4. **Ajouter l'enregistrement de validation ACM** (nouveau, pour valider le certificat)

### Option 2: Utiliser un autre sous-domaine

Si vous ne voulez pas modifier `api.yukpomnang.com` :

1. **Créer un nouveau certificat** pour un autre sous-domaine :
   - `backend.yukpomnang.com`
   - `api-new.yukpomnang.com`
   - `app.yukpomnang.com`
   - etc.

2. **Créer les enregistrements DNS** pour ce nouveau sous-domaine

3. **Mettre à jour la config mobile** avec le nouveau domaine

## 🎯 Recommandation

**Option 1 est recommandée** si :
- `api.yukpomnang.com` pointe vers un ancien serveur
- Vous voulez utiliser le même domaine pour le nouveau backend

**Option 2 est recommandée** si :
- `api.yukpomnang.com` est encore utilisé par un service actif
- Vous voulez garder l'ancien service en fonctionnement

## 📝 Actions Requises

### Si vous choisissez Option 1 (Modifier l'existant) :

1. **Modifier l'enregistrement CNAME existant** :
   - `api.yukpomnang.com` → `yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com`

2. **Ajouter l'enregistrement de validation ACM** (nouveau) :
   - `_07560c403145510b496c9b8313c6c600.api.yukpomnang.com` → `_91b2a9695a4220c151e8615cde4edbd2.jkddzztszm.acm-validations.aws.`

3. **Attendre la validation** (5-30 minutes)

4. **Exécuter le script** :
   ```powershell
   .\scripts\check-certificate-and-add-listener.ps1
   ```

### Si vous choisissez Option 2 (Nouveau sous-domaine) :

1. **Me dire quel sous-domaine utiliser** (ex: `backend.yukpomnang.com`)

2. **Je créerai un nouveau certificat** pour ce sous-domaine

3. **Vous ajouterez les enregistrements DNS** pour ce nouveau sous-domaine

4. **Je mettrai à jour la config mobile** avec le nouveau domaine

## ⚠️ Important

- **Le certificat ACM a été créé pour `api.yukpomnang.com`**
- **Si vous changez de sous-domaine, il faudra créer un nouveau certificat**
- **Le certificat actuel ne fonctionnera que pour `api.yukpomnang.com`**

## 🔍 Vérification

Pour vérifier ce que pointe actuellement `api.yukpomnang.com` :

```powershell
Resolve-DnsName -Name "api.yukpomnang.com" -Type CNAME
```

Ou :

```bash
nslookup api.yukpomnang.com
```




