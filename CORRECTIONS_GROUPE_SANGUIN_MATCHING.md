# ✅ Corrections apportées - Groupe sanguin et matching

## 🔍 Problème identifié

**Situation actuelle** :
- Le matching utilise uniquement la table `user_blood_groups`
- Si un utilisateur n'a pas d'entrée dans `user_blood_groups`, il ne sera **jamais matché**
- Pas de champ `groupe_sanguin` dans la table `users`
- Pas de mécanisme pour proposer à l'utilisateur de renseigner son groupe sanguin

## ✅ Solutions implémentées

### 1. Ajout champ `groupe_sanguin` dans `users`

**Fichier** : `backend/migrations/20251127_add_blood_group_to_users.sql`
- ✅ Colonne `groupe_sanguin` ajoutée (optionnelle)
- ✅ Contrainte CHECK pour valider les valeurs
- ✅ Index pour recherche rapide
- ✅ Ajoutée dans `0000_create_all_tables.sql`

### 2. Détection réponse favorable et proposition groupe sanguin

**Fichier** : `backend/src/controllers/blood_donation_matching_controller.rs`

**Modification `update_match_status`** :
- ✅ Détecte si l'utilisateur n'a pas de groupe sanguin (ni dans `user_blood_groups` ni dans `users.groupe_sanguin`)
- ✅ Retourne `should_prompt_blood_group: true` dans la réponse si :
  - Le statut est `"accepted"` (réponse favorable)
  - ET l'utilisateur n'a pas de groupe sanguin renseigné

**Réponse JSON** :
```json
{
  "success": true,
  "match_id": "...",
  "new_status": "accepted",
  "should_prompt_blood_group": true  // ✅ NOUVEAU
}
```

### 3. Mise à jour `create_or_update_blood_group`

**Modification** :
- ✅ Met à jour **aussi** `users.groupe_sanguin` en plus de `user_blood_groups`
- ✅ Synchronisation automatique entre les deux tables

### 4. Amélioration fonction SQL `find_potential_blood_donors`

**Fichier** : `backend/migrations/20251127_blood_donation_matching_system.sql`

**Modification** :
- ✅ Ajout d'un `UNION ALL` pour chercher aussi dans `users.groupe_sanguin`
- ✅ Uniquement si l'utilisateur n'a **pas** d'entrée dans `user_blood_groups`
- ✅ Permet de matcher des utilisateurs qui ont renseigné leur groupe sanguin dans `users` mais pas encore dans `user_blood_groups`

**Logique** :
```sql
-- 1. Chercher dans user_blood_groups (priorité)
SELECT ... FROM user_blood_groups ubg ...

UNION ALL

-- 2. Chercher dans users.groupe_sanguin si pas d'entrée dans user_blood_groups
SELECT ... FROM users u
WHERE u.groupe_sanguin = ANY(v_compatible_groups)
  AND NOT EXISTS (SELECT 1 FROM user_blood_groups WHERE user_id = u.id)
```

## 📋 Flux utilisateur suggéré

### 1. Utilisateur reçoit notification de don de sang
- Notification push envoyée via `notify_donors_for_request`

### 2. Utilisateur répond favorablement
- Appelle `POST /api/blood-donation/matches/update-status` avec `new_status: "accepted"`

### 3. Backend détecte absence groupe sanguin
- Retourne `should_prompt_blood_group: true` dans la réponse

### 4. Frontend/Mobile affiche toast/modal
- Propose : "Voulez-vous renseigner votre groupe sanguin pour faciliter les futurs matchings ?"
- Options : "Oui, renseigner" / "Plus tard"

### 5. Utilisateur renseigne son groupe sanguin
- Appelle `POST /api/blood-donation/donor/blood-group` avec `groupe_sanguin: "O+"`
- Backend met à jour :
  - `users.groupe_sanguin = "O+"`
  - `user_blood_groups` (crée entrée si n'existe pas)

## 🔧 Fichiers modifiés

1. ✅ `backend/migrations/20251127_add_blood_group_to_users.sql` (NOUVEAU)
2. ✅ `backend/migrations/0000_create_all_tables.sql` (MODIFIÉ - colonne ajoutée)
3. ✅ `backend/src/controllers/blood_donation_matching_controller.rs` (MODIFIÉ)
4. ✅ `backend/migrations/20251127_blood_donation_matching_system.sql` (MODIFIÉ - UNION ALL)

## ⚠️ Note importante sur la fonction SQL

La modification avec `UNION ALL` nécessite que les deux requêtes retournent les mêmes colonnes. Le problème est que `blood_group_id` est NULL pour les utilisateurs qui n'ont que `users.groupe_sanguin`.

**Solution** : La fonction `find_potential_blood_donors` retourne `blood_group_id` qui peut être NULL. Dans ce cas, lors de la création du match, il faudra créer une entrée dans `user_blood_groups` automatiquement.

## 🎯 Prochaines étapes (Frontend/Mobile)

1. **Détecter `should_prompt_blood_group`** dans la réponse de `update_match_status`
2. **Afficher toast/modal** proposant de renseigner le groupe sanguin
3. **Appeler `create_or_update_blood_group`** si l'utilisateur accepte
4. **Afficher message de confirmation**

## ✅ Résultat

- ✅ Champ `groupe_sanguin` dans `users` (optionnel)
- ✅ Détection réponse favorable (`accepted`)
- ✅ Flag `should_prompt_blood_group` retourné
- ✅ Matching amélioré (cherche aussi dans `users.groupe_sanguin`)
- ✅ Synchronisation automatique entre `users` et `user_blood_groups`

