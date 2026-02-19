# 🔐 Étape : Connexion à Azure (Manuelle - 1 minute)

**Date** : 2026-02-14  
**Action** : Se connecter à Azure pour permettre au script de continuer

---

## ✅ CE QUI EST DÉJÀ FAIT

- ✅ Azure CLI installé
- ✅ Script de migration créé (`scripts/migrate-aws-to-azure-auto.ps1`)
- ✅ Script prêt à récupérer les variables AWS et créer toutes les ressources

---

## 📋 ÉTAPE SIMPLE : Se Connecter à Azure

### Ouvrir PowerShell et exécuter :

```powershell
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" login
```

**Ce qui va se passer** :
1. Un navigateur va s'ouvrir automatiquement
2. Connectez-vous avec votre compte Azure (celui que vous avez utilisé pour créer le compte)
3. Autorisez l'accès
4. Retournez dans PowerShell - vous verrez "You have logged in"

---

## 🚀 APRÈS LA CONNEXION : Exécuter la Migration

**Une fois connecté**, exécutez le script complet :

```powershell
cd C:\Users\23767\yukpomnang2
.\scripts\migrate-aws-to-azure-auto.ps1
```

**Le script va automatiquement** :
1. ✅ Récupérer toutes les variables d'environnement depuis AWS
2. ✅ Créer le Resource Group
3. ✅ Créer la base de données PostgreSQL (vide)
4. ✅ Créer l'App Service Plan
5. ✅ Créer l'App Service (backend)
6. ✅ Configurer toutes les variables d'environnement
7. ✅ Générer automatiquement les mots de passe
8. ✅ Configurer le health check
9. ✅ Afficher toutes les informations importantes

**Temps d'exécution** : ~10-15 minutes (principalement l'attente de création de la base de données)

---

## ✅ VÉRIFIER LA CONNEXION

**Après `az login`**, vérifiez que vous êtes connecté :

```powershell
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" account show
```

**Résultat attendu** : Affiche les informations de votre abonnement Azure

---

## 🎯 RÉSUMÉ

1. **Se connecter** : `az login` (ouvre un navigateur)
2. **Vérifier** : `az account show`
3. **Exécuter la migration** : `.\scripts\migrate-aws-to-azure-auto.ps1`

**C'est tout !** Le script fait le reste automatiquement.

---

**Date** : 2026-02-14  
**Statut** : Guide créé - Connexion manuelle requise (1 minute)



