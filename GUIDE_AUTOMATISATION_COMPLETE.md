# 🚀 Guide: Automatisation Complète HTTPS

**Date**: 2026-02-02

## ⚠️ Situation

Le DNS pour `yukpomnang.com` n'est **PAS** dans Route 53. Il est probablement géré ailleurs (Cloudflare, GoDaddy, etc.).

**Je ne peux donc PAS ajouter les enregistrements DNS automatiquement.**

## 📋 Étapes Manuelles Requises (Une Seule Fois)

### 1. Ajouter les Enregistrements DNS

Allez dans votre DNS (Cloudflare, GoDaddy, ou autre) et ajoutez ces 2 enregistrements :

#### Enregistrement 1: CNAME pour l'API
- **Type**: CNAME
- **Name**: `api.yukpomnang.com`
- **Value**: `yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com`
- **TTL**: 300

#### Enregistrement 2: CNAME pour Validation ACM
- **Type**: CNAME
- **Name**: `_07560c403145510b496c9b8313c6c600.api.yukpomnang.com`
- **Value**: `_91b2a9695a4220c151e8615cde4edbd2.jkddzztszm.acm-validations.aws.`
- **TTL**: 300

**Voir**: `ENREGISTREMENTS_DNS_A_CREER.md` pour plus de détails

## 🤖 Automatisation (Après Ajout DNS)

Une fois les enregistrements DNS ajoutés, exécutez :

```powershell
.\scripts\automate-https-setup.ps1
```

Ce script va automatiquement :

1. ✅ **Vérifier les enregistrements DNS** (s'assurer qu'ils sont actifs)
2. ⏳ **Attendre la validation du certificat** (vérifie toutes les 30 secondes, max 20 minutes)
3. 🔧 **Ajouter le listener HTTPS** sur l'ALB
4. ✅ **Tester la connexion HTTPS** avec `curl`

## 📊 Paramètres du Script

Le script `automate-https-setup.ps1` accepte des paramètres optionnels :

```powershell
# Intervalle entre vérifications (défaut: 30 secondes)
.\scripts\automate-https-setup.ps1 -WaitInterval 60

# Nombre max de tentatives (défaut: 40 = 20 minutes)
.\scripts\automate-https-setup.ps1 -MaxAttempts 60
```

## ⏱️ Délais Estimés

- **Propagation DNS**: 2-5 minutes
- **Validation ACM**: 5-30 minutes après ajout des DNS
- **Total**: ~10-35 minutes

## ✅ Vérification Manuelle

Si vous voulez vérifier manuellement :

### Vérifier les DNS
```powershell
Resolve-DnsName -Name "api.yukpomnang.com" -Type CNAME
```

### Vérifier le certificat
```bash
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:846505724644:certificate/1d05d964-2fde-457c-9259-ff573b7301b7 \
  --region us-east-1 \
  --query 'Certificate.Status'
```

### Tester HTTPS
```bash
curl -v https://api.yukpomnang.com/health
```

## 🎯 Résumé

| Étape | Action | Automatique ? |
|-------|--------|---------------|
| 1. Ajouter DNS | Manuelle | ❌ Non (DNS externe) |
| 2. Attendre validation | Script | ✅ Oui |
| 3. Ajouter listener HTTPS | Script | ✅ Oui |
| 4. Tester HTTPS | Script | ✅ Oui |

## 📝 Fichiers Créés

- `scripts/automate-https-setup.ps1` - Script d'automatisation complète
- `scripts/check-certificate-and-add-listener.ps1` - Script de vérification et ajout listener
- `ENREGISTREMENTS_DNS_A_CREER.md` - Guide pour les enregistrements DNS

## ⚠️ Notes

- Le script vérifie que les DNS sont actifs avant de continuer
- Si les DNS ne sont pas encore propagés, le script s'arrêtera avec un message d'erreur
- Relancez le script une fois les DNS propagés
- Le script attend automatiquement la validation du certificat (jusqu'à 20 minutes)


