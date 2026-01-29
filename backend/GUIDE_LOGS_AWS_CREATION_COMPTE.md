# 🔍 Guide : Voir les Logs Backend AWS lors de la Création de Compte

## 📍 Où sont les logs ?

Les logs du backend AWS sont dans **CloudWatch Logs** avec cette configuration :

- **Log Group** : `/ecs/yukpomnang-backend` (ou similaire selon votre configuration Terraform)
- **Log Stream Prefix** : `backend`
- **Région** : `us-east-1` (ou votre région AWS)

## 🎯 Méthode 1 : Via AWS Console (Le plus simple)

### Étape 1 : Accéder à CloudWatch Logs

1. Allez sur **AWS Console** → **CloudWatch**
2. Dans le menu de gauche, cliquez sur **Logs** → **Log groups**
3. Recherchez le log group : `/ecs/yukpomnang-backend` ou `/ecs/yukpomnang-backend-service`

### Étape 2 : Voir les logs en temps réel

1. Cliquez sur le log group
2. Vous verrez les **log streams** (un par conteneur/tâche ECS)
3. Cliquez sur le stream le plus récent (celui avec la date/heure la plus récente)
4. Les logs s'affichent en temps réel

### Étape 3 : Filtrer les logs de création de compte

Dans la barre de recherche des logs, utilisez ces filtres :

```
register_user
```

ou

```
[register_user]
```

ou pour voir les erreurs :

```
ERROR register_user
```

ou

```
❌ register_user
```

## 🎯 Méthode 2 : Via AWS CLI (En ligne de commande)

### Voir les logs récents (dernière heure)

```powershell
aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1
```

### Filtrer les logs de création de compte

```powershell
# Voir uniquement les logs de registration
aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1 | Select-String "register_user"

# Voir les erreurs de registration
aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1 | Select-String "register_user.*ERROR|register_user.*❌"

# Voir tous les logs d'erreur
aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1 | Select-String "ERROR|❌"
```

### Voir les logs en temps réel (streaming)

```powershell
aws logs tail /ecs/yukpomnang-backend --follow --region us-east-1
```

Puis dans un autre terminal, essayez de créer un compte pour voir les logs apparaître en temps réel.

## 🔍 Messages de log à rechercher

### Messages de succès
```
✅ [register_user] ✅ Partenaire créé dans delivery_partners
✅ User créé avec succès
```

### Messages d'erreur courants

1. **Email déjà utilisé** :
```
[register_user] Email déjà utilisé: ...
[register_user] ❌ Email déjà utilisé
```

2. **Erreur de base de données** :
```
[register_user] DB error (check exists): ...
[register_user] DB error (insert): ...
```

3. **Erreur de validation** :
```
[register_user] ❌ Type de partenaire invalide
[register_user] ❌ partner_type manquant ou vide
[register_user] ❌ partner_name manquant ou vide
```

4. **Erreur de création du partenaire** :
```
[register_user] ❌ Erreur création partenaire dans delivery_partners
```

5. **Erreur JWT** :
```
JWT_SECRET manquant
```

## 🐛 Diagnostic des erreurs de création de compte

### Erreur 1 : "Email déjà utilisé"

**Dans les logs, vous verrez** :
```
[register_user] Email déjà utilisé: user@example.com
```

**Solution** : Utiliser un autre email ou se connecter avec cet email.

### Erreur 2 : "Erreur de base de données"

**Dans les logs, vous verrez** :
```
[register_user] DB error (check exists): Database(PgDatabaseError { ... })
[register_user] DB error (insert): Database(PgDatabaseError { ... })
```

**Causes possibles** :
- Table `users` n'existe pas ou a une structure incorrecte
- Problème de connexion à la base de données
- Contrainte de clé étrangère violée

**Vérification** :
```sql
-- Vérifier que la table users existe
SELECT * FROM information_schema.tables WHERE table_name = 'users';

-- Vérifier la structure de la table
\d users
```

### Erreur 3 : "Type de partenaire invalide"

**Dans les logs, vous verrez** :
```
[register_user] ❌ Type de partenaire invalide: 'xxx'. Types valides: ...
```

**Solution** : Utiliser un type de partenaire valide (restaurant, boutique, etc.)

### Erreur 4 : "partner_type manquant"

**Dans les logs, vous verrez** :
```
[register_user] ❌ partner_type manquant ou vide pour inscription partenaire
```

**Solution** : S'assurer que `is_partner=true` inclut un `partner_type` valide.

### Erreur 5 : "Erreur création partenaire"

**Dans les logs, vous verrez** :
```
[register_user] ❌ Erreur création partenaire dans delivery_partners: ...
```

**Causes possibles** :
- Table `delivery_partners` n'existe pas
- Contrainte de clé étrangère
- Erreur de validation

**Vérification** :
```sql
-- Vérifier que la table delivery_partners existe
SELECT * FROM information_schema.tables WHERE table_name = 'delivery_partners';
```

## 📋 Checklist de diagnostic

Quand vous ne pouvez pas créer un compte, vérifiez dans les logs :

- [ ] Le frontend envoie bien la requête (chercher `Appel register_user`)
- [ ] L'email n'est pas déjà utilisé (chercher `Email déjà utilisé`)
- [ ] La validation passe (chercher `Validation partenaire` ou erreurs de validation)
- [ ] La connexion DB fonctionne (chercher `DB error`)
- [ ] L'insertion dans `users` réussit (chercher `DB error (insert)`)
- [ ] Si partenaire, la création dans `delivery_partners` réussit (chercher `Erreur création partenaire`)
- [ ] Le JWT est généré (chercher `JWT_SECRET manquant`)

## 🚀 Commandes rapides

### Voir les 50 dernières lignes de logs
```powershell
aws logs tail /ecs/yukpomnang-backend --since 10m --region us-east-1 | Select-Object -Last 50
```

### Voir uniquement les erreurs des 30 dernières minutes
```powershell
aws logs tail /ecs/yukpomnang-backend --since 30m --region us-east-1 | Select-String "ERROR|❌|error"
```

### Voir les logs d'une tentative de création de compte spécifique
```powershell
# Remplacez user@example.com par l'email utilisé
aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1 | Select-String "register_user|user@example.com"
```

## 💡 Astuce : Logs en temps réel pendant le test

1. **Terminal 1** : Ouvrir les logs en streaming
```powershell
aws logs tail /ecs/yukpomnang-backend --follow --region us-east-1 | Select-String "register_user"
```

2. **Terminal 2 ou Frontend** : Essayer de créer un compte

3. **Terminal 1** : Voir les logs apparaître en temps réel

## 🔧 Si le log group n'existe pas

Si vous ne trouvez pas le log group `/ecs/yukpomnang-backend`, vérifiez :

1. **Le nom exact du log group** :
```powershell
aws logs describe-log-groups --region us-east-1 --query 'logGroups[?contains(logGroupName, `yukpomnang`) || contains(logGroupName, `backend`) || contains(logGroupName, `ecs`)].logGroupName' --output table
```

2. **Les logs peuvent être dans un autre groupe** selon votre configuration Terraform. Vérifiez `infra/aws/main.tf` ligne 653 pour le nom exact.

## 📊 Exemple de logs de succès

```
2026-01-29T20:00:00.000Z [INFO] Appel register_user pour email=user@example.com, role=user
2026-01-29T20:00:00.100Z [INFO] [register_user] ✅ User créé avec succès, id=123
2026-01-29T20:00:00.200Z [INFO] [register_user] ✅ Partenaire créé dans delivery_partners pour user_id=123
```

## 📊 Exemple de logs d'erreur

```
2026-01-29T20:00:00.000Z [INFO] Appel register_user pour email=user@example.com, role=partenaire
2026-01-29T20:00:00.050Z [ERROR] [register_user] ❌ partner_type manquant ou vide pour inscription partenaire
```

ou

```
2026-01-29T20:00:00.000Z [INFO] Appel register_user pour email=user@example.com, role=user
2026-01-29T20:00:00.100Z [ERROR] [register_user] DB error (insert): Database(PgDatabaseError { severity: Error, code: "23505", message: "duplicate key value violates unique constraint", ... })
```

## 🎯 Prochaines étapes

1. **Accédez aux logs CloudWatch** via AWS Console
2. **Filtrez par `register_user`** pour voir les tentatives de création
3. **Identifiez l'erreur** dans les logs
4. **Consultez cette section** pour trouver la solution correspondante

