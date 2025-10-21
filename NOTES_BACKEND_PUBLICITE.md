# Notes Backend - Module Publicité

## 📋 Fonctionnalités à implémenter côté Backend

### 1. ✅ Sauvegarde des médias publicitaires en BDD

**Endpoints nécessaires :**
- `POST /api/publicites/create`
  - Sauvegarder `videos` (base64) et `thumbnails` (base64) dans la table `publicites`
  - Structure proposée :
    ```sql
    CREATE TABLE publicites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        titre VARCHAR(255) NOT NULL,
        description TEXT,
        produits_indexes TEXT[], -- Array de 'serviceId_productIndex'
        videos TEXT[], -- Array de base64
        thumbnails TEXT[], -- Array de base64 miniatures
        duree_jours INTEGER NOT NULL,
        cout INTEGER NOT NULL, -- En FCFA
        zone_geographique VARCHAR(50) DEFAULT 'local', -- 'local', 'regional', 'international'
        geo_publicitaire POINT, -- Coordonnées GPS du centre de la zone publicitaire
        rayon_km INTEGER, -- Rayon en km (pour local/regional)
        status VARCHAR(20) DEFAULT 'active', -- 'active', 'expired', 'pending'
        vues INTEGER DEFAULT 0,
        clics INTEGER DEFAULT 0,
        date_debut TIMESTAMP DEFAULT NOW(),
        date_fin TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE INDEX idx_publicites_zone ON publicites(zone_geographique);
    CREATE INDEX idx_publicites_status ON publicites(status);
    CREATE INDEX idx_publicites_geo ON publicites USING GIST(geo_publicitaire);
    ```

- `GET /api/publicites/actives`
  - Récupérer les publicités actives
  - Filtrer par catégories (user behavior)
  - Trier par pertinence

- `GET /api/publicites/dashboard`
  - Stats globales : total_vues, total_clics, taux_conversion_moyen, budget_total_depense
  - Liste des publicités de l'utilisateur avec métriques

- `GET /api/publicites/:id`
  - Récupérer les détails d'une publicité pour modification/relance

- `POST /api/publicites/:id/update`
  - Mettre à jour une publicité existante

- `POST /api/publicites/track-click`
  - Enregistrer un clic sur une publicité
  - Incrémenter le compteur `clics`

### 2. ✅ Geo_publicitaire pour priorité de recherche

**Logique de recherche améliorée :**

Lors d'une recherche (`POST /api/search/direct`), prioriser les produits en promotion selon :

1. **Marquer les produits en publicité active**
   ```sql
   -- Ajouter colonne en_promotion aux produits retournés
   SELECT 
       p.*,
       CASE 
           WHEN EXISTS (
               SELECT 1 FROM publicites pub 
               WHERE p.service_id::text || '_' || p.product_index::text = ANY(pub.produits_indexes)
               AND pub.status = 'active'
               AND pub.date_fin > NOW()
           ) THEN true
           ELSE false
       END as en_promotion,
       -- Récupérer les données de publicité pour calcul de proximité
       (SELECT zone_geographique FROM publicites pub 
        WHERE p.service_id::text || '_' || p.product_index::text = ANY(pub.produits_indexes)
        AND pub.status = 'active' LIMIT 1) as pub_zone,
       (SELECT geo_publicitaire FROM publicites pub 
        WHERE p.service_id::text || '_' || p.product_index::text = ANY(pub.produits_indexes)
        AND pub.status = 'active' LIMIT 1) as pub_geo,
       (SELECT rayon_km FROM publicites pub 
        WHERE p.service_id::text || '_' || p.product_index::text = ANY(pub.produits_indexes)
        AND pub.status = 'active' LIMIT 1) as pub_rayon
   FROM produits p
   WHERE ... (conditions de recherche)
   ```

2. **Calculer la proximité avec l'utilisateur (optionnel)**
   - Si `pub_zone = 'local'` : vérifier distance GPS ≤ `pub_rayon` (ex: 20-50 km)
   - Si `pub_zone = 'regional'` : vérifier même pays
   - Si `pub_zone = 'international'` : toujours inclure

3. **Booster le score de recherche**
   ```rust
   // Dans le moteur de recherche Rust
   let mut score = base_semantic_score;
   
   // ✅ BONUS PROMO : +100 points (très élevé pour priorité maximale)
   if product.en_promotion {
       score += 100.0; // Priorité absolue pour affichage
       
       // Bonus additionnel selon zone (optionnel, déjà très haut)
       let zone_bonus = match product.pub_zone.as_deref() {
           Some("local") if distance_km <= product.pub_rayon => 20.0,
           Some("regional") if same_country => 10.0,
           Some("international") => 5.0,
           _ => 0.0
       };
       
       score += zone_bonus;
   }
   ```

4. **Tri final des résultats**
   - **Produits en publicité** : score de base + 100 (minimum)
   - **Produits normaux** : score de base (0-50 typiquement)
   - **Tri décroissant par score** → Produits en promo apparaissent TOUJOURS en premier

**⚠️ IMPORTANT** : Le tri est également appliqué côté client (mobile/frontend) comme sécurité :
```typescript
products.sort((a, b) => {
    // 1. Priorité PROMO (absolu)
    const promoA = a.en_promotion ? 1 : 0;
    const promoB = b.en_promotion ? 1 : 0;
    if (promoA !== promoB) return promoB - promoA;
    
    // 2. Score pertinence
    if (a.score !== b.score) return b.score - a.score;
    
    // 3. Distance proximité
    return (a.distance || Infinity) - (b.distance || Infinity);
});
```

### 3. Endpoints Analytics

- `POST /api/publicites/track-view`
  - Enregistrer une vue
  - Payload : `{ publicite_id, user_id }`

- `POST /api/publicites/track-click`
  - Enregistrer un clic
  - Payload : `{ publicite_id, user_id }`

- `GET /api/publicites/analytics/:id`
  - Statistiques détaillées d'une publicité
  - Retourner : vues, clics, taux de conversion, ROI

### 4. Tâche planifiée (Cron)

Créer une tâche qui s'exécute quotidiennement pour :
- Désactiver les publicités expirées (`status = 'expired'` si `date_fin < NOW()`)
- Envoyer des notifications aux prestataires (7 jours avant expiration)

```rust
async fn check_expired_publicites() {
    // Marquer comme expirées
    sqlx::query!(
        "UPDATE publicites SET status = 'expired' WHERE date_fin < NOW() AND status = 'active'"
    )
    .execute(&pool)
    .await?;
    
    // Notifications pour publicités proches de l'expiration
    let expiring_soon = sqlx::query!(
        "SELECT * FROM publicites WHERE date_fin < NOW() + INTERVAL '7 days' AND status = 'active'"
    )
    .fetch_all(&pool)
    .await?;
    
    for pub in expiring_soon {
        // Envoyer notification au prestataire
        send_notification(pub.user_id, "Votre publicité expire dans 7 jours");
    }
}
```

## 🎯 Points clés

1. **Tarification** : 500 FCFA/jour + 2000 FCFA/vidéo
2. **Conversion devise** : Automatique selon devise prestataire
3. **Zone géographique** : Local (ville), Régional (pays), International
4. **Priorité recherche** : Produits en publicité active dans zone compatible
5. **Analytics** : Vues, clics, taux de conversion
6. **Modification** : Possible via endpoint `/update`
7. **Relance** : Créer nouvelle publicité avec mêmes paramètres

## 🔄 Workflow complet

```
Création → Paiement → Activation → Affichage priorisé → Analytics → Expiration → Relance possible
```

