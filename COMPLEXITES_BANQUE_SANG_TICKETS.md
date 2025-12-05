# 🔴 Complexités Critiques - Banque de Sang & Tickets de Voyage

## 1. 🩸 Banque de Sang - Complexités Techniques

### A. Compatibilité Groupes Sanguins

**Problème :** Un donneur O+ ne peut pas donner à un receveur A-, mais le système actuel ne vérifie que l'exact match.

**Solution à Implémenter :**

```rust
// backend/src/services/blood_compatibility_service.rs

pub struct BloodCompatibilityService;

impl BloodCompatibilityService {
    /// Retourne les groupes compatibles pour un groupe requis
    pub fn get_compatible_donor_groups(required_group: &str) -> Vec<String> {
        match required_group {
            "O+" => vec!["O+", "O-"],
            "O-" => vec!["O-"],
            "A+" => vec!["A+", "A-", "O+", "O-"],
            "A-" => vec!["A-", "O-"],
            "B+" => vec!["B+", "B-", "O+", "O-"],
            "B-" => vec!["B-", "O-"],
            "AB+" => vec!["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"],
            "AB-" => vec!["AB-", "A-", "B-", "O-"],
            _ => vec![],
        }
    }

    /// Vérifie si un donneur peut donner à un receveur
    pub fn can_donate(donor_group: &str, receiver_group: &str) -> bool {
        Self::get_compatible_donor_groups(receiver_group)
            .contains(&donor_group.to_string())
    }
}
```

**Modification Requise :**
- Fichier : `backend/src/controllers/blood_donation_matching_controller.rs`
- Fonction : `create_blood_donation_request` (ligne ~100)
- Ajouter : Filtrer donneurs par compatibilité, pas seulement match exact

---

### B. Gestion Délais Entre Dons

**Problème :** Un donneur ne peut donner que tous les 2-3 mois. Le système doit vérifier `next_donation_available_date`.

**Solution à Implémenter :**

```rust
// Dans blood_donation_matching_controller.rs

// Vérifier disponibilité donneur avant matching
let available_donors = sqlx::query_as::<_, DonorInfo>(
    r#"
    SELECT 
        ubg.user_id,
        ubg.groupe_sanguin,
        ubg.is_available_for_donation,
        ubg.next_donation_available_date,
        u.gps
    FROM user_blood_groups ubg
    JOIN users u ON ubg.user_id = u.id
    WHERE ubg.groupe_sanguin = ANY($1) -- Groupes compatibles
    AND ubg.is_available_for_donation = true
    AND (ubg.next_donation_available_date IS NULL 
         OR ubg.next_donation_available_date <= NOW())
    AND u.gps IS NOT NULL
    "#
)
.bind(compatible_groups) // Utiliser BloodCompatibilityService
.fetch_all(&state.pg)
.await?;
```

**Modification Requise :**
- Fichier : `backend/src/controllers/blood_donation_matching_controller.rs`
- Fonction : Matching SQL (ligne ~200)
- Ajouter : Filtre `next_donation_available_date <= NOW()`

---

### C. Notifications Intelligentes

**Problème :** Notifier tous les donneurs peut créer du spam. Il faut prioriser et limiter.

**Solution à Implémenter :**

```rust
// Dans blood_donation_matching_controller.rs

// 1. Prioriser donneurs proches (< 10km)
let nearby_donors: Vec<_> = matches
    .into_iter()
    .filter(|m| m.distance_km.unwrap_or(f64::MAX) < 10.0)
    .collect();

// 2. Limiter nombre de notifications
let donors_to_notify: Vec<_> = nearby_donors
    .into_iter()
    .take(10) // Maximum 10 notifications
    .collect();

// 3. Espacer notifications (1 seconde entre chaque)
for (index, donor) in donors_to_notify.iter().enumerate() {
    if index > 0 {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
    }
    // Envoyer notification
}
```

**Modification Requise :**
- Fichier : `backend/src/controllers/blood_donation_matching_controller.rs`
- Fonction : `notify_donors_for_request_internal` (ligne ~250)
- Ajouter : Tri par distance, limite, espacement

---

### D. Statistiques et Dashboard

**Problème :** Pas de vue d'ensemble pour les banques de sang.

**Solution à Implémenter :**

```rust
// backend/src/controllers/blood_bank_controller.rs

/// GET /api/banques-sang/{id}/statistics
pub async fn get_blood_bank_statistics(
    State(state): State<Arc<AppState>>,
    Path(banque_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    // Stocks par groupe
    // Demandes actives
    // Matches réussis
    // Taux de réponse donneurs
    // ...
}
```

**Fichier à Créer/Modifier :**
- `backend/src/controllers/blood_bank_controller.rs` (nouveau endpoint)

---

## 2. 🚌 Tickets de Voyage - Complexités Techniques

### A. Gestion Conflits Réservations

**Problème :** Deux utilisateurs peuvent réserver le même siège simultanément.

**Solution à Implémenter :**

```rust
// backend/src/controllers/bus_ticket_controller.rs

pub async fn create_reservations(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateReservationsRequest>,
) -> AppResult<impl IntoResponse> {
    // Utiliser transaction avec SELECT FOR UPDATE
    let mut tx = state.pg.begin().await?;
    
    for seat_request in &payload.seats {
        // Verrouiller le siège
        let seat_available: bool = sqlx::query_scalar(
            r#"
            SELECT available 
            FROM bus_seats 
            WHERE product_id = $1 AND seat_number = $2
            FOR UPDATE -- Verrou exclusif
            "#
        )
        .bind(payload.product_id)
        .bind(seat_request.seat_number)
        .fetch_one(&mut *tx)
        .await?;
        
        if !seat_available {
            tx.rollback().await?;
            return Err(AppError::BadRequest(
                format!("Siège {} déjà réservé", seat_request.seat_number)
            ));
        }
        
        // Réserver le siège
        sqlx::query(
            r#"
            UPDATE bus_seats 
            SET available = false, reserved_by = $1
            WHERE product_id = $2 AND seat_number = $3
            "#
        )
        .bind(user_id)
        .bind(payload.product_id)
        .bind(seat_request.seat_number)
        .execute(&mut *tx)
        .await?;
    }
    
    tx.commit().await?;
    // Créer réservation...
}
```

**Alternative avec Redis (pour scalabilité) :**
```rust
// Utiliser verrous distribués Redis
use redis::Commands;

let lock_key = format!("bus_seat_lock:{}:{}", product_id, seat_number);
let mut conn = state.redis_client.get_connection()?;

// Acquérir verrou (expire après 30 secondes)
let lock_acquired: bool = conn.set_nx(&lock_key, user_id)
    .and_then(|_| conn.expire(&lock_key, 30))
    .unwrap_or(false);

if !lock_acquired {
    return Err(AppError::Conflict("Siège en cours de réservation"));
}

// Réserver...
// Libérer verrou après réservation
let _: () = conn.del(&lock_key)?;
```

**Modification Requise :**
- Fichier : `backend/src/controllers/bus_ticket_controller.rs`
- Fonction : `create_reservations`
- Ajouter : Transaction avec `SELECT FOR UPDATE` ou verrous Redis

---

### B. Annulations et Remboursements

**Problème :** Pas de système d'annulation avec politique de remboursement.

**Solution à Implémente :**

```rust
// backend/src/controllers/bus_ticket_controller.rs

/// PATCH /api/bus-tickets/reservations/{id}/cancel
pub async fn cancel_reservation(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(reservation_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    // 1. Récupérer réservation
    let reservation = sqlx::query_as::<_, BusReservation>(
        r#"
        SELECT * FROM bus_reservations
        WHERE id = $1 AND user_id = $2
        "#
    )
    .bind(reservation_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await?;
    
    let reservation = reservation.ok_or_else(|| 
        AppError::NotFound("Réservation non trouvée".to_string())
    )?;
    
    // 2. Calculer remboursement selon délai
    let departure_time = reservation.departure_time;
    let now = chrono::Utc::now();
    let hours_until_departure = (departure_time - now).num_hours();
    
    let refund_percentage = if hours_until_departure > 24 {
        100.0 // Remboursement 100%
    } else if hours_until_departure > 12 {
        50.0  // Remboursement 50%
    } else {
        0.0   // Pas de remboursement
    };
    
    // 3. Libérer siège
    sqlx::query(
        r#"
        UPDATE bus_seats
        SET available = true, reserved_by = NULL
        WHERE product_id = $1 AND seat_number = $2
        "#
    )
    .bind(reservation.product_id)
    .bind(reservation.seat_number)
    .execute(&state.pg)
    .await?;
    
    // 4. Rembourser si applicable
    if refund_percentage > 0.0 {
        let refund_amount = reservation.amount * (refund_percentage / 100.0);
        // Utiliser PaymentService pour remboursement
        // ...
    }
    
    // 5. Marquer réservation comme annulée
    sqlx::query(
        r#"
        UPDATE bus_reservations
        SET status = 'cancelled', cancelled_at = NOW()
        WHERE id = $1
        "#
    )
    .bind(reservation_id)
    .execute(&state.pg)
    .await?;
    
    Ok(Json(json!({ "success": true, "refund_percentage": refund_percentage })))
}
```

**Modification Requise :**
- Fichier : `backend/src/controllers/bus_ticket_controller.rs`
- Fonction : Nouveau endpoint `cancel_reservation`
- Ajouter : Route dans `specialized_services_routes.rs`

---

### C. Overbooking (Optionnel mais Recommandé)

**Problème :** Gérer plus de réservations que de sièges disponibles.

**Solution à Implémenter :**

```rust
// backend/src/services/bus_overbooking_service.rs

pub struct BusOverbookingService {
    pool: Arc<PgPool>,
}

impl BusOverbookingService {
    /// Vérifier si overbooking possible
    pub async fn can_overbook(&self, product_id: &str, requested_seats: i32) -> bool {
        let total_seats: i32 = sqlx::query_scalar(
            r#"
            SELECT total_seats FROM bus_products WHERE id = $1
            "#
        )
        .bind(product_id)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);
        
        let reserved_seats: i32 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM bus_reservations
            WHERE product_id = $1 AND status IN ('pending', 'confirmed')
            "#
        )
        .bind(product_id)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);
        
        // Permettre 10% d'overbooking
        let max_allowed = (total_seats as f64 * 1.1) as i32;
        (reserved_seats + requested_seats) <= max_allowed
    }
    
    /// Ajouter à liste d'attente
    pub async fn add_to_waitlist(
        &self,
        product_id: &str,
        user_id: i32,
        seat_number: i32,
    ) -> AppResult<i32> {
        // Créer entrée liste d'attente
        // Notifier si siège libéré
    }
}
```

**Fichier à Créer :**
- `backend/src/services/bus_overbooking_service.rs`

---

### D. Suivi Temps Réel (Optionnel)

**Problème :** Passagers veulent savoir statut bus (en route, retard, annulé).

**Solution à Implémenter :**

```rust
// backend/src/services/bus_tracking_service.rs

pub struct BusTrackingService {
    pool: Arc<PgPool>,
    redis: Arc<redis::Client>,
}

impl BusTrackingService {
    /// Mettre à jour statut bus
    pub async fn update_bus_status(
        &self,
        product_id: &str,
        status: BusStatus, // "on_time", "delayed", "cancelled"
        delay_minutes: Option<i32>,
    ) -> AppResult<()> {
        // 1. Mettre à jour en base
        sqlx::query(
            r#"
            UPDATE bus_products
            SET status = $1, delay_minutes = $2, updated_at = NOW()
            WHERE id = $3
            "#
        )
        .bind(status.to_string())
        .bind(delay_minutes)
        .bind(product_id)
        .execute(&*self.pool)
        .await?;
        
        // 2. Notifier tous les passagers
        let passengers = self.get_passengers_for_product(product_id).await?;
        for passenger in passengers {
            // Envoyer notification push
            // ...
        }
    }
}
```

**Fichier à Créer :**
- `backend/src/services/bus_tracking_service.rs`

---

## 📋 Checklist Implémentation

### Banque de Sang
- [ ] Créer `blood_compatibility_service.rs`
- [ ] Modifier matching pour utiliser compatibilité
- [ ] Ajouter vérification `next_donation_available_date`
- [ ] Améliorer notifications (priorité, limite, espacement)
- [ ] Créer endpoint statistiques
- [ ] Créer écrans mobile (3)
- [ ] Créer pages web (3)

### Tickets Bus
- [ ] Ajouter transaction `SELECT FOR UPDATE` dans réservations
- [ ] Créer endpoint annulation avec remboursement
- [ ] Créer service overbooking (optionnel)
- [ ] Créer service tracking temps réel (optionnel)
- [ ] Créer écrans mobile (3)
- [ ] Créer pages web (3)

---

**Note** : Ces complexités sont critiques pour la production. Les implémenter garantit un système robuste et fiable.

