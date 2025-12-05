# 💊 Implémentation Complète - Pharmacies Produits

## 🎯 Objectif

Permettre aux pharmacies de gérer leurs produits (médicaments) avec prix et stock, et aux clients de :
- Rechercher un médicament
- Comparer les prix entre pharmacies
- Calculer le budget global pour une liste de médicaments
- Commander avec livraison

---

## 📋 Plan d'Implémentation

### 1. Base de Données

#### Migration SQL
```sql
-- Table des produits de pharmacie
CREATE TABLE IF NOT EXISTS pharmacy_products (
    id SERIAL PRIMARY KEY,
    pharmacy_service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    nom_produit VARCHAR(255) NOT NULL,
    description TEXT,
    prix NUMERIC(10, 2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    disponible BOOLEAN NOT NULL DEFAULT true,
    unite VARCHAR(50) DEFAULT 'unité', -- "boîte", "flacon", "plaquette", "unité"
    code_barre VARCHAR(100), -- Optionnel
    categorie VARCHAR(100), -- "antalgique", "antibiotique", etc.
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX idx_pharmacy_products_service_id ON pharmacy_products(pharmacy_service_id);
CREATE INDEX idx_pharmacy_products_nom ON pharmacy_products(nom_produit);
CREATE INDEX idx_pharmacy_products_disponible ON pharmacy_products(disponible);
CREATE INDEX idx_pharmacy_products_categorie ON pharmacy_products(categorie);

-- Index pour recherche full-text (si PostgreSQL avec pg_trgm)
CREATE INDEX idx_pharmacy_products_nom_trgm ON pharmacy_products USING gin(nom_produit gin_trgm_ops);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_pharmacy_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pharmacy_products_updated_at
    BEFORE UPDATE ON pharmacy_products
    FOR EACH ROW
    EXECUTE FUNCTION update_pharmacy_products_updated_at();
```

---

### 2. Backend - Modèle

#### `backend/src/models/pharmacy_product.rs`
```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PharmacyProduct {
    pub id: i32,
    pub pharmacy_service_id: i32,
    pub nom_produit: String,
    pub description: Option<String>,
    pub prix: rust_decimal::Decimal,
    pub stock: i32,
    pub disponible: bool,
    pub unite: String,
    pub code_barre: Option<String>,
    pub categorie: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

---

### 3. Backend - Service

#### `backend/src/services/pharmacy_product_service.rs`
```rust
use crate::models::pharmacy_product::PharmacyProduct;
use crate::core::types::{AppError, AppResult};
use sqlx::PgPool;
use std::sync::Arc;

pub struct PharmacyProductService {
    pool: Arc<PgPool>,
}

impl PharmacyProductService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    // Créer un produit
    pub async fn create_product(
        &self,
        pharmacy_service_id: i32,
        nom_produit: String,
        prix: rust_decimal::Decimal,
        stock: i32,
        unite: String,
        description: Option<String>,
        code_barre: Option<String>,
        categorie: Option<String>,
    ) -> AppResult<PharmacyProduct> {
        let product = sqlx::query_as::<_, PharmacyProduct>(
            r#"
            INSERT INTO pharmacy_products (
                pharmacy_service_id, nom_produit, description,
                prix, stock, disponible, unite, code_barre, categorie
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
            "#
        )
        .bind(pharmacy_service_id)
        .bind(nom_produit)
        .bind(description)
        .bind(prix)
        .bind(stock)
        .bind(stock > 0)
        .bind(unite)
        .bind(code_barre)
        .bind(categorie)
        .fetch_one(&*self.pool)
        .await?;

        Ok(product)
    }

    // Rechercher produits (toutes pharmacies)
    pub async fn search_products(
        &self,
        query: &str,
        user_lat: Option<f64>,
        user_lng: Option<f64>,
        radius_km: Option<f64>,
        min_price: Option<rust_decimal::Decimal>,
        max_price: Option<rust_decimal::Decimal>,
        only_available: bool,
    ) -> AppResult<Vec<(PharmacyProduct, Option<f64>)>> {
        // Requête avec recherche full-text et filtres
        let mut sql = String::from(
            r#"
            SELECT 
                pp.*,
                CASE 
                    WHEN $3 IS NOT NULL AND $4 IS NOT NULL AND s.gps IS NOT NULL
                    THEN (
                        6371 * acos(
                            cos(radians($3)) * cos(radians((s.gps->>'lat')::float))
                            * cos(radians((s.gps->>'lng')::float) - radians($4))
                            + sin(radians($3)) * sin(radians((s.gps->>'lat')::float))
                        )
                    )
                    ELSE NULL
                END as distance_km
            FROM pharmacy_products pp
            JOIN services s ON pp.pharmacy_service_id = s.id
            WHERE pp.nom_produit ILIKE $1
            "#,
        );

        if only_available {
            sql.push_str(" AND pp.disponible = true AND pp.stock > 0");
        }

        if min_price.is_some() {
            sql.push_str(" AND pp.prix >= $5");
        }

        if max_price.is_some() {
            sql.push_str(" AND pp.prix <= $6");
        }

        sql.push_str(" ORDER BY pp.prix ASC");

        if user_lat.is_some() && user_lng.is_some() && radius_km.is_some() {
            sql.push_str(", distance_km ASC");
        }

        // Exécution avec paramètres dynamiques
        // ... (implémentation complète)
    }

    // Calculer budget global
    pub async fn calculate_budget(
        &self,
        items: Vec<(i32, i32)>, // (product_id, quantity)
        user_lat: Option<f64>,
        user_lng: Option<f64>,
    ) -> AppResult<BudgetCalculation> {
        // Calculer le budget pour chaque pharmacie
        // Retourner la pharmacie la moins chère et comparaison
        // ... (implémentation)
    }
}
```

---

### 4. Backend - Contrôleur

#### `backend/src/controllers/pharmacy_product_controller.rs`
```rust
// Endpoints :
// GET /api/pharmacies/products/search?query=paracetamol&lat=&lng=&radius=
// POST /api/pharmacies/products/budget
// GET /api/pharmacies/:id/products
// POST /api/pharmacies/:id/products
// PATCH /api/pharmacies/products/:id
// DELETE /api/pharmacies/products/:id
```

---

### 5. Mobile - Écran Recherche

#### `mobile/src/screens/specialized/PharmacieProductSearchScreen.tsx`
- Barre de recherche
- Filtres : prix min/max, disponible, rayon
- Liste résultats avec :
  - Nom produit
  - Prix par pharmacie
  - Distance
  - Disponibilité
- Tri : prix croissant, distance, disponibilité

---

### 6. Mobile - Calcul Budget

#### `mobile/src/components/specialized/PharmacieBudgetCalculator.tsx`
- Liste produits avec quantités
- Calcul total par pharmacie
- Affichage pharmacie la moins chère
- Option "Commander avec livraison"

---

### 7. Mobile - Gestion Produits (Prestataire)

#### Intégration dans `PharmacieFormScreen.tsx`
- Section "Mes Produits"
- Ajout/modification produits
- Gestion stock et prix
- Import CSV (optionnel)

---

## 🎯 Fonctionnalités Avancées (Rivaliser avec Géants)

### 1. Alertes Prix
- Notifications si prix baisse
- Historique des prix
- Graphiques évolution prix

### 2. Substitution Générique
- Détection médicaments génériques
- Suggestion automatique
- Comparaison prix générique vs original

### 3. Vérification Interactions
- API externe pour interactions médicamenteuses
- Alerte si interactions détectées

### 4. Recommandations
- "Autres utilisateurs ont aussi acheté"
- "Produits similaires"
- "Meilleures offres"

---

## ✅ Checklist Implémentation

### Phase 1 : Base
- [ ] Migration SQL
- [ ] Modèle Rust
- [ ] Service Rust
- [ ] Contrôleur Rust
- [ ] Routes API

### Phase 2 : Mobile Prestataire
- [ ] Section produits dans PharmacieFormScreen
- [ ] Écran gestion produits
- [ ] CRUD produits

### Phase 3 : Mobile Client
- [ ] Écran recherche produits
- [ ] Comparaison prix
- [ ] Calcul budget
- [ ] Intégration commande

### Phase 4 : Web
- [ ] Pages équivalentes
- [ ] Interface recherche
- [ ] Comparaison visuelle

### Phase 5 : Avancé
- [ ] Alertes prix
- [ ] Historique
- [ ] Substitution générique
- [ ] Interactions médicamenteuses

