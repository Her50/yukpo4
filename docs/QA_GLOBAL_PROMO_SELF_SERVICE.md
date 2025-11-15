## QA – Self-Service Global Promo & Notifications

### Pré-requis
- Backend lancé (`cargo run`) avec accès à la base Render.
- Token JWT prestataire (utilisateur possédant au moins un service `services.user_id = <prestataire_id>`).
- `psql` ou DataGrip pour vérifier les tables `global_promo_events` et `global_promo_entries`.
- (Facultatif) utilisateur avec token push Expo en base (`user_push_tokens`).

### 1. Vérifier les endpoints `/api/me/global-promos/*`

1. **Lister les campagnes disponibles**  
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
        https://api.yukpo.test/api/me/global-promos/events | jq
   ```  
   - Attendu: `success: true`, tableau `data.events` (statut `scheduled` ou `live`), `data.entries` contenant vos soumissions.

2. **Soumettre un service**  
   ```bash
   EVENT_ID=<uuid_campagne>
   curl -X POST -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
          "serviceId": 2458,
          "promoPriceCfa": 15000,
          "discountPercentage": 25,
          "stockCap": 30,
          "metadata": { "note": "Live samedi 18h" }
        }' \
        https://api.yukpo.test/api/me/global-promos/events/$EVENT_ID/entries | jq
   ```
   - Attendu: `status = "pending_review"`, `submitted_by_user_id = <prestataire_id>`.

3. **Contrôler la base**  
   ```sql
   SELECT status, metadata
   FROM global_promo_entries
   WHERE event_id = '$EVENT_ID' AND service_id = 2458;
   ```  
   - Attendu: ligne présente, statut `pending_review`, metadata contenant `source = self_service`.

4. **Re-lister vos entrées**  
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
        https://api.yukpo.test/api/me/global-promos/entries | jq '.data'
   ```  
   - Attendu: l’entrée soumise apparaît avec le même statut.

### 2. QA Scheduler & Notifications

1. **Préparer le scénario**
   - Mettre `global_promo_events.status = 'scheduled'`, `starts_at` dans le passé, `ends_at` dans le futur.
   - Définir `global_promo_entries.status = 'approved'` pour au moins une entrée (celle du prestataire).

2. **Déclencher manuellement la tâche**
   - Lancer le backend si ce n’est pas déjà fait.
   - Appeler la fonction depuis `psql` ou simplement attendre ~30s (scheduler `tasks::global_promo_scheduler` tourne toutes les 30s). Pour un déclenchement immédiat, dans un shell `cargo run --bin backend` logguera :
     ```
     [GlobalPromo] X évènement(s) passent en statut LIVE
     ```

3. **Vérifier les effets**
   - `SELECT status FROM global_promo_events WHERE id = '$EVENT_ID';` ⇒ `live`.
   - `SELECT status, published_at FROM global_promo_entries WHERE id = '$ENTRY_ID';` ⇒ `published`, `published_at NOT NULL`.
   - Table `notifications` contient une ligne `notification_type = 'global_promo_entry_published'` pour `user_id = <prestataire_id>`.

4. **Push notifications**
   - Assurez-vous qu’un token Expo est enregistré (`SELECT * FROM user_push_tokens WHERE user_id = <prestataire_id>`).
   - Dans les logs backend, vérifier `PushService` → `✅ Push envoyé`.
   - Tester depuis un device Expo pour confirmer la réception. En cas d’erreur, les logs indiqueront la cause (`expo token invalid`, etc.).

5. **Fin de campagne**
   - Forcer `global_promo_events.ends_at = NOW() - interval '1 minute'`.
   - Attendre/tick scheduler → entrée passe `ended`, notification `global_promo_entry_ended` envoyée.

### 3. Nettoyage
- Remettre les statuts (`scheduled` / `approved`) si nécessaire.
- Supprimer les entrées de test :
  ```sql
  DELETE FROM global_promo_entries WHERE submitted_by_user_id = <prestataire_id> AND metadata->>'note' = 'Live samedi 18h';
  ```

