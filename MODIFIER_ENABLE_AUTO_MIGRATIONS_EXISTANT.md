# 🔧 Modifier ENABLE_AUTO_MIGRATIONS Existante

**Situation** : La variable existe déjà mais utilise `ValueFrom` (valeur depuis Secrets Manager).

---

## ✅ OPTION 1 : Modifier le Type de Valeur (Recommandé - Plus Simple)

### Étapes :

1. **Dans la section de la variable `ENABLE_AUTO_MIGRATIONS`** que vous voyez :
   - **Cliquez** sur le dropdown **"Type de valeur"** (actuellement sur `ValueFrom`)
   - **Sélectionnez** **"Valeur"** (pas "ValueFrom")

2. **Dans le champ "Valeur"** :
   - **Supprimez** l'ARN actuel (`arn:aws:secretsmanager:...`)
   - **Tapez** directement : `true`

3. **Sauvegardez** :
   - Faites défiler jusqu'en bas de la page
   - Cliquez sur **"Créer"** (Create)

---

## ✅ OPTION 2 : Modifier dans Secrets Manager

Si vous préférez garder `ValueFrom`, modifiez la valeur dans Secrets Manager :

### Étapes :

1. **Aller dans AWS Secrets Manager** :
   - Console AWS → **Secrets Manager**
   - Cherchez le secret correspondant à l'ARN visible dans le champ "Valeur"

2. **Modifier la valeur** :
   - Ouvrez le secret
   - Modifiez la valeur de `ENABLE_AUTO_MIGRATIONS` à `true`
   - Sauvegardez

3. **Redémarrer le service** :
   - Retournez dans ECS → Service → Mettre à jour
   - Cochez "Forcer un nouveau déploiement"

---

## 🎯 RECOMMANDATION : Option 1

**Pourquoi** : Plus simple et direct. Vous changez juste le type de `ValueFrom` à `Valeur` et mettez `true`.

---

## 📋 INSTRUCTIONS DÉTAILLÉES (Option 1)

1. **Trouvez la variable `ENABLE_AUTO_MIGRATIONS`** dans la liste
2. **Cliquez** sur le dropdown **"Type de valeur"** (à droite de "Clé")
3. **Sélectionnez** **"Valeur"** dans la liste déroulante
4. **Cliquez** dans le champ **"Valeur"** (en dessous)
5. **Supprimez** tout le texte (l'ARN)
6. **Tapez** : `true`
7. **Faites défiler** jusqu'en bas de la page
8. **Cliquez** sur **"Créer"** (Create)

---

## ✅ VÉRIFICATION APRÈS

Après avoir créé la nouvelle révision et mis à jour le service, vérifiez dans les logs :

```bash
aws logs tail /ecs/yukpo-backend-service --since 10m --region eu-west-1 --filter-pattern "ENABLE_AUTO_MIGRATIONS" --format short
```

Vous devriez voir :
```
🔍 ENABLE_AUTO_MIGRATIONS: raw='true', parsed=true
✅ Tables de base (users, services) vérifiées - Exécution des migrations automatiques...
```


