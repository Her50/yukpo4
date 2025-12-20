# 🏥 PROMPT : Amélioration Services Spécialisés Yukpomnang

## 📋 **CONTEXTE ET OBJECTIF**

Améliorer les services spécialisés de Yukpomnang (Hôpital/Clinique, Pharmacie, Laboratoire/Imagerie, Banque de Sang) pour atteindre le **leadership technique mondial #1**, en s'inspirant des améliorations réussies du module **Tickets de Bus**.

**Références** :
- `EXPERIENCES_UTILISATEUR_UNIQUES_YUKPO.md` - Expériences uniques déjà implémentées
- `backend/CONFIRMATION_LEADERSHIP_MONDIAL.md` - Standards de leadership technique
- Module Tickets de Bus - Exemple d'amélioration réussie

**Objectif** : Créer une expérience utilisateur exceptionnelle, unique et inégalée pour chaque service spécialisé, avec une architecture scalable capable de gérer des millions de transactions par seconde.

---

## ⚠️ **ÉTAPE PRÉALABLE CRITIQUE : ANALYSE DE L'EXISTANT**

### 🔍 **PHASE 1 : COMPRENDRE AVANT D'IMPLÉMENTER**

**RÈGLE ABSOLUE** : **NE JAMAIS COMMENCER PAR CRÉER OU MODIFIER DU CODE !**

#### **1.1 Analyse Complète de l'Existant**

**Avant toute implémentation, tu DOIS :**

1. ✅ **Parcourir TOUT le code existant** pour chaque service :
   ```bash
   # Rechercher tous les fichiers
   find mobile/src -name "*hopital*" -o -name "*hospital*"
   find mobile/src -name "*pharmacie*" -o -name "*pharmacy*"
   find mobile/src -name "*laboratoire*" -o -name "*lab*"
   find mobile/src -name "*banque*sang*" -o -name "*blood*"
   
   find backend/src -name "*hospital*"
   find backend/src -name "*pharmacy*"
   find backend/src -name "*lab*"
   find backend/src -name "*blood*"
   ```

2. ✅ **Analyser les fichiers clés** :
   - `mobile/src/screens/specialized/Hopital*.tsx`
   - `mobile/src/screens/specialized/Pharmacie*.tsx`
   - `mobile/src/screens/specialized/Laboratoire*.tsx`
   - `mobile/src/screens/specialized/BanqueSang*.tsx`
   - `mobile/src/navigation/AppNavigator.tsx` (routes existantes)
   - `backend/src/controllers/*_controller.rs` (endpoints existants)
   - `backend/src/services/*.rs` (services existants)
   - `backend/migrations/*.sql` (tables existantes)

3. ✅ **Comprendre la logique métier** :
   - Comment fonctionne actuellement chaque service ?
   - Quels sont les flux utilisateur existants ?
   - Quelles sont les données stockées ?
   - Quels sont les endpoints existants ?

4. ✅ **Identifier la philosophie de design** :
   - Comment sont structurés les écrans ?
   - Quels patterns sont utilisés ?
   - Quelle est l'architecture choisie ?
   - Comment sont gérés les états ?

5. ✅ **Repérer ce qui fonctionne déjà** :
   - Quelles fonctionnalités existent déjà ?
   - Qu'est-ce qui est bien implémenté ?
   - Qu'est-ce qui peut être réutilisé ?

6. ✅ **Identifier les gaps RÉELS** :
   - Qu'est-ce qui manque vraiment (pas supposé) ?
   - Qu'est-ce qui doit être amélioré ?
   - Qu'est-ce qui doit être créé (et seulement ce qui n'existe pas) ?

#### **1.2 Outils d'Analyse**

```bash
# Analyser les imports et dépendances
grep -r "Hopital" mobile/src
grep -r "hospital" backend/src

# Vérifier les routes existantes
grep -r "Hopital" mobile/src/navigation

# Vérifier les endpoints backend
grep -r "/api/hopitaux" backend/src
grep -r "/api/pharmacies" backend/src
grep -r "/api/laboratoires" backend/src
grep -r "/api/banques-sang" backend/src
```

#### **1.3 Questions à Se Poser Avant d'Implémenter**

Pour chaque service, répondre à ces questions :

1. **Architecture existante** :
   - Comment sont structurés les écrans actuellement ?
   - Y a-t-il déjà un système de navigation ?
   - Comment sont gérés les états (Context, Redux, useState) ?

2. **Backend existant** :
   - Quels endpoints existent déjà ?
   - Quelle est la structure des données ?
   - Y a-t-il déjà des services métier ?

3. **Base de données** :
   - Quelles tables existent déjà ?
   - Quels sont les schémas actuels ?
   - Y a-t-il des relations déjà définies ?

4. **Logique métier** :
   - Comment fonctionne la réservation actuellement ?
   - Comment sont gérées les recherches ?
   - Comment sont gérés les paiements (si applicable) ?

5. **UX/UI existante** :
   - Quel est le design actuel ?
   - Quels composants sont réutilisés ?
   - Quelle est la cohérence visuelle ?

#### **1.4 Documenter l'Existant**

**Créer un document d'analyse pour chaque service** :

```markdown
# Analyse Existant - [Service]

## Fichiers Existants
- Écrans : [liste avec chemins]
- Contrôleurs : [liste avec chemins]
- Services : [liste avec chemins]
- Tables DB : [liste avec migrations]

## Fonctionnalités Existantes
- ✅ [Fonctionnalité 1] : [Description détaillée]
- ✅ [Fonctionnalité 2] : [Description détaillée]
- ❌ [Fonctionnalité manquante] : [Description]

## Architecture Actuelle
- Structure : [Description]
- Patterns : [Description]
- État : [Description]

## Gaps Identifiés
- [Gap 1] : [Description précise]
- [Gap 2] : [Description précise]

## Plan d'Amélioration
- [Amélioration 1] : [Basée sur l'existant, pas recréation]
- [Amélioration 2] : [Basée sur l'existant, pas recréation]
```

#### **1.5 Principe de Non-Duplication**

**RÈGLE** : Si quelque chose existe déjà et fonctionne, **NE PAS LE REFAIRE** !

- ✅ **Améliorer** ce qui existe
- ✅ **Étendre** ce qui existe
- ✅ **Optimiser** ce qui existe
- ❌ **NE PAS** recréer ce qui existe déjà

#### **1.6 Comprendre la Philosophie**

**Avant d'ajouter du code, comprendre** :

1. **Philosophie de code** :
   - Comment sont nommées les variables/fonctions ?
   - Quels sont les conventions de nommage ?
   - Comment sont structurés les fichiers ?

2. **Philosophie UX** :
   - Quelle est l'expérience utilisateur visée ?
   - Comment sont gérées les interactions ?
   - Quelle est la logique de navigation ?

3. **Philosophie métier** :
   - Comment sont gérés les cas d'usage ?
   - Quelle est la logique de validation ?
   - Comment sont gérées les erreurs ?

#### **1.7 Checklist Pré-Implémentation**

**Avant de commencer à coder, vérifier** :

- [ ] J'ai parcouru TOUS les fichiers existants du service
- [ ] J'ai compris la logique métier actuelle
- [ ] J'ai identifié ce qui existe déjà
- [ ] J'ai identifié ce qui manque vraiment (pas supposé)
- [ ] J'ai compris la philosophie de design
- [ ] J'ai documenté l'existant
- [ ] J'ai un plan d'amélioration basé sur l'existant
- [ ] Je ne vais pas refaire ce qui existe déjà

**SEULEMENT APRÈS cette analyse, tu peux commencer à implémenter !**

---

## 🎯 **PRINCIPES DIRECTEURS**

### 1. **UX Unique et Expérience Exceptionnelle**

**Référence** : `EXPERIENCES_UTILISATEUR_UNIQUES_YUKPO.md`

- ✅ **Design moderne et attrayant** : Interface visuellement exceptionnelle
- ✅ **Fluidité dans l'utilisation** : Animations fluides, transitions douces
- ✅ **Navigation intuitive** : Accès naturels, logique claire
- ✅ **Engagement utilisateur** : Fonctionnalités qui captivent
- ✅ **Responsivité** : Adaptation parfaite à tous les écrans
- ✅ **Performance perçue** : Skeleton loading, cache intelligent

### 2. **Expérience Client vs Prestataire**

**Référence** : Module Tickets de Bus (exemple réussi)

- ✅ **Côté Client** : Recherche, réservation, suivi, historique, notifications
- ✅ **Côté Prestataire** : Dashboard analytics, gestion, statistiques, optimisation
- ✅ **Séparation claire** : Guards de navigation (`mobile/src/utils/navigationGuards.ts`)
- ✅ **Fonctionnalités uniques** : Chaque rôle a ses propres avantages

### 3. **Scalabilité et Performance**

**Référence** : Architecture Yukpomnang (backend Rust, Redis cluster, read replicas)

- ✅ **Millions de transactions/seconde** : Architecture optimisée
- ✅ **Scaling horizontal** : Support Redis cluster, read replicas PostgreSQL
- ✅ **Cache multi-niveaux** : L1 (mémoire), L2 (Redis), L4 (base de données)
- ✅ **Optimisation requêtes** : Index, pagination, lazy loading
- ✅ **Queue distribuée** : Traitement asynchrone des opérations lourdes

---

## 🏗️ **CONTRAINTES TECHNIQUES**

### 1. **Migrations Base de Données**

**RÈGLE CRITIQUE** : Toutes les migrations doivent être :

- ✅ **Intégrées dans `auto_migrate.rs`** : Fonction `ensure_*_tables()` dans `backend/src/migrations/auto_migrate.rs`
- ✅ **Format `0000...`** : Si nouvelle migration SQL, format `0000_create_*.sql` dans `backend/migrations/`
- ✅ **Appelée dans `run_auto_migrations()`** : Ajout dans la fonction principale

**Exemple** :
```rust
// backend/src/migrations/auto_migrate.rs
async fn ensure_hospital_pharmacy_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des tables hospital, pharmacy...");
    let migration_sql = include_str!("../../migrations/0000_create_hospital_pharmacy_tables.sql");
    execute_multiple_sql_commands(pool, migration_sql).await?;
    info!("✅ Tables hospital, pharmacy créées/vérifiées");
    Ok(())
}

pub async fn run_auto_migrations(pool: &PgPool) {
    // ... migrations existantes ...
    
    // ✅ NOUVEAU : Tables services spécialisés
    match ensure_hospital_pharmacy_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: hospital, pharmacy tables OK"),
        Err(e) => error!("❌ Erreur migration auto: {}", e),
    }
}
```

### 2. **Backend Render - Coordonnées**

**Base de données Render** :
```
Hostname: dpg-d2t7ntbuibrs73eh9tvg-a
Database: yukpo_db
Username: yukpo_db_user
URL: postgresql://user:password@host:port/database
```

**IMPORTANT** :
- ✅ Utiliser `SQLX_OFFLINE=true` pour développement local
- ✅ Régénérer `sqlx-data.json` après chaque migration : `cargo sqlx prepare -- --lib`
- ✅ Appliquer les migrations sur Render via `auto_migrate` au démarrage

### 3. **Intégration IA**

**RÈGLE** : Utiliser le système IA existant (`backend/src/services/app_ia.rs`) avec des prompts spécialisés.

**Créer des services IA spécialisés** :
- ✅ `backend/src/services/hospital_ai_service.rs` - IA pour hôpitaux
- ✅ `backend/src/services/pharmacy_ai_service.rs` - IA pour pharmacies
- ✅ `backend/src/services/lab_ai_service.rs` - IA pour laboratoires
- ✅ `backend/src/services/blood_bank_ai_service.rs` - IA pour banques de sang

**Exemple de structure** :
```rust
// backend/src/services/hospital_ai_service.rs
use crate::services::app_ia::AppIA;
use crate::core::types::AppResult;
use std::sync::Arc;

pub async fn generate_hospital_recommendations(
    app_ia: Arc<AppIA>,
    symptoms: &str,
    location: Option<&str>,
) -> AppResult<String> {
    let prompt = format!(
        r#"
Tu es l'assistant médical intelligent de Yukpomnang.

CONTEXTE :
- Symptômes : {}
- Localisation : {}

TON RÔLE :
- Recommander les hôpitaux/cliniques les plus adaptés
- Proposer des spécialités pertinentes
- Donner des conseils de santé (sans diagnostic médical)
- Escalader vers urgence si nécessaire

IMPORTANT :
- Ne jamais faire de diagnostic médical
- Toujours recommander de consulter un professionnel
- En cas d'urgence, diriger vers les urgences
"#,
        symptoms, location.unwrap_or("Non spécifiée")
    );

    let (model_name, response, _) = app_ia.predict(&prompt).await?;
    Ok(response)
}
```

**Intégration dans les contrôleurs** :
```rust
// backend/src/controllers/hospital_controller.rs
use crate::services::hospital_ai_service::generate_hospital_recommendations;

pub async fn search_hospitals_with_ai(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<SearchRequest>,
) -> AppResult<impl IntoResponse> {
    // ... recherche classique ...
    
    // ✅ IA : Recommandations intelligentes
    if let Some(symptoms) = &payload.symptoms {
        let ai_recommendations = generate_hospital_recommendations(
            state.ia.clone(),
            symptoms,
            payload.location.as_deref(),
        ).await?;
        
        // Ajouter aux résultats
    }
    
    // ...
}
```

---

## 📊 **PLAN D'AMÉLIORATION PAR SERVICE**

**⚠️ RAPPEL CRITIQUE** : Avant d'implémenter quoi que ce soit pour chaque service, **TU DOIS D'ABORD** :
1. ✅ Analyser l'existant (voir section précédente)
2. ✅ Comprendre la logique/philosophie
3. ✅ Identifier ce qui existe déjà
4. ✅ Ne créer que ce qui manque vraiment

### 🏥 **1. HÔPITAL/CLINIQUE**

#### **Étape 0 : Analyse de l'Existant (OBLIGATOIRE)**
- [ ] Parcourir `mobile/src/screens/specialized/Hopital*.tsx`
- [ ] Vérifier `backend/src/controllers/hopital_controller.rs` (si existe)
- [ ] Analyser les tables existantes dans les migrations
- [ ] Comprendre la logique de recherche/réservation actuelle
- [ ] Identifier les gaps réels (ne pas supposer)

#### **Contexte et Objectif**
- **Contexte** : Services médicaux d'urgence et planifiés, consultations, hospitalisations
- **Objectif** : Faciliter l'accès aux soins, réduire les temps d'attente, améliorer la coordination

#### **Fonctionnalités Client (à améliorer/créer selon l'existant)**
1. ✅ **Recherche intelligente** :
   - Recherche par symptômes (IA)
   - Recherche par spécialité
   - Recherche par proximité GPS
   - Filtres : urgence, disponibilité, notation

2. ✅ **Recommandations IA** :
   - Analyse des symptômes
   - Suggestions d'hôpitaux adaptés
   - Escalade automatique vers urgence si nécessaire

3. ✅ **Réservation de consultation** :
   - Sélection créneau horaire
   - Confirmation instantanée
   - Rappels automatiques (push, SMS)

4. ✅ **Suivi médical** :
   - Historique consultations
   - Dossiers médicaux (si autorisé)
   - Prescriptions numériques

5. ✅ **Urgences** :
   - Détection automatique urgence
   - Redirection vers urgences
   - Temps d'attente en temps réel

#### **Fonctionnalités Prestataire (à améliorer/créer selon l'existant)**
1. ✅ **Dashboard Analytics** :
   - Taux d'occupation
   - Temps d'attente moyen
   - Revenus par spécialité
   - Graphiques interactifs

2. ✅ **Gestion créneaux** :
   - Planification automatique
   - Optimisation IA des horaires
   - Alertes surcharges

3. ✅ **Gestion urgences** :
   - Triage intelligent
   - Priorisation automatique
   - Alertes staff

4. ✅ **Statistiques performance** :
   - Taux de satisfaction
   - Temps de traitement
   - Efficacité par service

#### **Tables Base de Données (si nécessaire)**
```sql
-- Consultations
CREATE TABLE IF NOT EXISTS hospital_consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id INTEGER REFERENCES services(id),
    user_id INTEGER REFERENCES users(id),
    doctor_id INTEGER,
    specialty VARCHAR(100),
    appointment_date TIMESTAMPTZ,
    status VARCHAR(20),
    symptoms TEXT,
    diagnosis TEXT,
    prescription JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Urgences
CREATE TABLE IF NOT EXISTS hospital_emergencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id INTEGER REFERENCES services(id),
    user_id INTEGER REFERENCES users(id),
    severity_level INTEGER CHECK (severity_level >= 1 AND severity_level <= 5),
    symptoms TEXT,
    arrival_time TIMESTAMPTZ,
    triage_time TIMESTAMPTZ,
    treatment_start_time TIMESTAMPTZ,
    status VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Créneaux
CREATE TABLE IF NOT EXISTS hospital_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id INTEGER REFERENCES services(id),
    doctor_id INTEGER,
    specialty VARCHAR(100),
    slot_date DATE,
    slot_time TIME,
    duration_minutes INTEGER,
    status VARCHAR(20), -- available, booked, cancelled
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hospital_consultations_hospital ON hospital_consultations(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_consultations_user ON hospital_consultations(user_id);
CREATE INDEX IF NOT EXISTS idx_hospital_slots_hospital ON hospital_slots(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_slots_date ON hospital_slots(slot_date, slot_time);
```

#### **Endpoints Backend (à créer/améliorer selon l'existant)**
```
GET  /api/hospitals/search?query=...&location=...&specialty=...
POST /api/hospitals/recommendations (IA)
GET  /api/hospitals/{id}/availability
POST /api/hospitals/{id}/book-appointment
GET  /api/hospitals/{id}/wait-times
GET  /api/hospitals/{id}/emergency-status
GET  /api/hospitals/consultations (client)
GET  /api/hospitals/{id}/analytics (prestataire)
POST /api/hospitals/{id}/manage-slots (prestataire)
```

---

### 💊 **2. PHARMACIE**

#### **Étape 0 : Analyse de l'Existant (OBLIGATOIRE)**
- [ ] Parcourir `mobile/src/screens/specialized/Pharmacie*.tsx`
- [ ] Vérifier `backend/src/controllers/pharmacy_controller.rs` (si existe)
- [ ] Analyser les tables existantes dans les migrations
- [ ] Comprendre la logique de recherche/commande actuelle
- [ ] Identifier les gaps réels (ne pas supposer)

#### **Contexte et Objectif**
- **Contexte** : Vente de médicaments, conseils pharmaceutiques, livraison
- **Objectif** : Faciliter l'accès aux médicaments, vérifier disponibilité, conseils personnalisés

#### **Fonctionnalités Client (à améliorer/créer selon l'existant)**
1. ✅ **Recherche médicaments** :
   - Recherche par nom, DCI, symptôme
   - Vérification disponibilité en temps réel
   - Alternatives si indisponible (IA)

2. ✅ **Conseils IA** :
   - Interactions médicamenteuses
   - Posologie recommandée
   - Précautions d'emploi

3. ✅ **Réservation médicaments** :
   - Réservation en ligne
   - Notification disponibilité
   - Retrait en pharmacie

4. ✅ **Livraison** :
   - Commande en ligne
   - Livraison à domicile
   - Suivi en temps réel

5. ✅ **Historique prescriptions** :
   - Prescriptions sauvegardées
   - Renouvellements automatiques
   - Rappels de prise

#### **Fonctionnalités Prestataire (à améliorer/créer selon l'existant)**
1. ✅ **Dashboard Analytics** :
   - Ventes par médicament
   - Stock en temps réel
   - Alertes rupture stock
   - Revenus par période

2. ✅ **Gestion stock** :
   - Inventaire automatique
   - Alertes seuils
   - Commandes automatiques (IA)

3. ✅ **Optimisation prix** :
   - Analyse concurrentielle
   - Recommandations prix (IA)
   - Promotions intelligentes

#### **Tables Base de Données (si nécessaire)**
```sql
-- Médicaments
CREATE TABLE IF NOT EXISTS pharmacy_medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id INTEGER REFERENCES services(id),
    name VARCHAR(200) NOT NULL,
    dci VARCHAR(200), -- Dénomination Commune Internationale
    dosage VARCHAR(100),
    form VARCHAR(50), -- comprimé, sirop, etc.
    stock_quantity INTEGER DEFAULT 0,
    price DECIMAL(10,2),
    requires_prescription BOOLEAN DEFAULT FALSE,
    expiry_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Commandes
CREATE TABLE IF NOT EXISTS pharmacy_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id INTEGER REFERENCES services(id),
    user_id INTEGER REFERENCES users(id),
    prescription_id UUID,
    status VARCHAR(20), -- pending, confirmed, preparing, ready, delivered
    total_amount DECIMAL(10,2),
    delivery_address TEXT,
    delivery_method VARCHAR(20), -- pickup, delivery
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Réservations
CREATE TABLE IF NOT EXISTS pharmacy_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id INTEGER REFERENCES services(id),
    user_id INTEGER REFERENCES users(id),
    medication_id UUID REFERENCES pharmacy_medications(id),
    quantity INTEGER,
    status VARCHAR(20), -- pending, available, collected, expired
    expiry_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_medications_pharmacy ON pharmacy_medications(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_medications_name ON pharmacy_medications(name);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_user ON pharmacy_orders(user_id);
```

#### **Endpoints Backend (à créer/améliorer selon l'existant)**
```
GET  /api/pharmacies/search?query=...&location=...
GET  /api/pharmacies/{id}/medications?search=...
POST /api/pharmacies/{id}/check-availability
POST /api/pharmacies/{id}/reserve-medication
POST /api/pharmacies/{id}/order
GET  /api/pharmacies/{id}/interactions (IA)
GET  /api/pharmacies/orders (client)
GET  /api/pharmacies/{id}/analytics (prestataire)
POST /api/pharmacies/{id}/manage-stock (prestataire)
```

---

### 🔬 **3. LABORATOIRE/IMAGERIE**

#### **Étape 0 : Analyse de l'Existant (OBLIGATOIRE)**
- [ ] Parcourir `mobile/src/screens/specialized/Laboratoire*.tsx`
- [ ] Vérifier `backend/src/controllers/lab_controller.rs` (si existe)
- [ ] Analyser les tables existantes dans les migrations
- [ ] Comprendre la logique de recherche/réservation actuelle
- [ ] Identifier les gaps réels (ne pas supposer)

#### **Contexte et Objectif**
- **Contexte** : Analyses médicales, imagerie (radiologie, échographie, etc.)
- **Objectif** : Faciliter la prise de rendez-vous, suivi des résultats, interprétation IA

#### **Fonctionnalités Client (à améliorer/créer selon l'existant)**
1. ✅ **Recherche examens** :
   - Recherche par type d'examen
   - Recherche par spécialité
   - Comparaison prix

2. ✅ **Réservation examens** :
   - Sélection créneau
   - Préparation (jeûne, etc.)
   - Rappels automatiques

3. ✅ **Résultats en ligne** :
   - Consultation résultats
   - Interprétation IA (basique)
   - Partage avec médecin

4. ✅ **Historique examens** :
   - Tous les résultats
   - Évolution dans le temps
   - Graphiques de tendance

#### **Fonctionnalités Prestataire (à améliorer/créer selon l'existant)**
1. ✅ **Dashboard Analytics** :
   - Examens par type
   - Taux de positivité
   - Revenus par examen
   - Temps de traitement

2. ✅ **Gestion examens** :
   - Planification automatique
   - Optimisation créneaux (IA)
   - Alertes retards

3. ✅ **Analyse IA** :
   - Détection anomalies (basique)
   - Recommandations examens complémentaires
   - Priorisation urgences

#### **Tables Base de Données (si nécessaire)**
```sql
-- Examens
CREATE TABLE IF NOT EXISTS lab_examinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_id INTEGER REFERENCES services(id),
    user_id INTEGER REFERENCES users(id),
    examination_type VARCHAR(100),
    appointment_date TIMESTAMPTZ,
    status VARCHAR(20), -- scheduled, in_progress, completed, cancelled
    preparation_instructions TEXT,
    results JSONB,
    ai_analysis JSONB, -- Analyse IA
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Types d'examens
CREATE TABLE IF NOT EXISTS lab_examination_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_id INTEGER REFERENCES services(id),
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100), -- blood, imaging, etc.
    price DECIMAL(10,2),
    duration_minutes INTEGER,
    requires_preparation BOOLEAN DEFAULT FALSE,
    preparation_instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_examinations_lab ON lab_examinations(lab_id);
CREATE INDEX IF NOT EXISTS idx_lab_examinations_user ON lab_examinations(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_examinations_type ON lab_examinations(examination_type);
```

#### **Endpoints Backend (à créer/améliorer selon l'existant)**
```
GET  /api/labs/search?query=...&examination_type=...
GET  /api/labs/{id}/examination-types
POST /api/labs/{id}/book-examination
GET  /api/labs/examinations/{id}/results
POST /api/labs/examinations/{id}/analyze (IA)
GET  /api/labs/examinations (client)
GET  /api/labs/{id}/analytics (prestataire)
```

---

### 🩸 **4. BANQUE DE SANG**

#### **Étape 0 : Analyse de l'Existant (OBLIGATOIRE)**
- [ ] Parcourir `mobile/src/screens/specialized/BanqueSang*.tsx`
- [ ] Vérifier `backend/src/controllers/blood_bank_controller.rs` (si existe)
- [ ] Analyser les tables existantes dans les migrations
- [ ] Comprendre la logique de matching actuelle
- [ ] Identifier les gaps réels (ne pas supposer)

#### **Contexte et Objectif**
- **Contexte** : Don de sang, demande de sang, matching donneurs/receveurs
- **Objectif** : Faciliter les dons, optimiser les stocks, matching intelligent

#### **Fonctionnalités Client (à améliorer/créer selon l'existant)**
1. ✅ **Demande de sang** :
   - Création demande
   - Matching automatique avec donneurs (IA)
   - Suivi demande

2. ✅ **Don de sang** :
   - Prise de rendez-vous
   - Rappels automatiques
   - Historique dons

3. ✅ **Alertes urgentes** :
   - Notifications besoins urgents
   - Géolocalisation proche
   - Incitation au don

4. ✅ **Suivi santé** :
   - Résultats analyses post-don
   - Historique dons
   - Badges et récompenses

#### **Fonctionnalités Prestataire (à améliorer/créer selon l'existant)**
1. ✅ **Dashboard Analytics** :
   - Stock par groupe sanguin
   - Demandes en attente
   - Taux de don
   - Prévisions besoins (IA)

2. ✅ **Gestion stock** :
   - Suivi en temps réel
   - Alertes seuils critiques
   - Optimisation distribution

3. ✅ **Matching intelligent** :
   - Matching automatique (IA)
   - Priorisation urgences
   - Notifications donneurs

#### **Tables Base de Données (si nécessaire)**
```sql
-- Demandes de sang
CREATE TABLE IF NOT EXISTS blood_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id INTEGER REFERENCES services(id),
    user_id INTEGER REFERENCES users(id),
    blood_group VARCHAR(10) NOT NULL,
    quantity_units INTEGER,
    urgency_level INTEGER CHECK (urgency_level >= 1 AND urgency_level <= 5),
    reason TEXT,
    status VARCHAR(20), -- pending, matched, fulfilled, cancelled
    matched_donor_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dons de sang
CREATE TABLE IF NOT EXISTS blood_donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id INTEGER REFERENCES services(id),
    user_id INTEGER REFERENCES users(id),
    blood_group VARCHAR(10) NOT NULL,
    donation_date TIMESTAMPTZ,
    quantity_units INTEGER,
    test_results JSONB,
    status VARCHAR(20), -- scheduled, completed, rejected
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock
CREATE TABLE IF NOT EXISTS blood_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id INTEGER REFERENCES services(id),
    blood_group VARCHAR(10) NOT NULL,
    quantity_units INTEGER DEFAULT 0,
    expiry_date DATE,
    status VARCHAR(20), -- available, reserved, expired
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blood_requests_bank ON blood_requests(bank_id);
CREATE INDEX IF NOT EXISTS idx_blood_requests_group ON blood_requests(blood_group, status);
CREATE INDEX IF NOT EXISTS idx_blood_donations_user ON blood_donations(user_id);
CREATE INDEX IF NOT EXISTS idx_blood_stock_bank ON blood_stock(bank_id, blood_group);
```

#### **Endpoints Backend (à créer/améliorer selon l'existant)**
```
POST /api/blood-banks/{id}/request-blood
POST /api/blood-banks/{id}/book-donation
GET  /api/blood-banks/{id}/match-donors (IA)
GET  /api/blood-banks/{id}/stock
GET  /api/blood-banks/requests (client)
GET  /api/blood-banks/donations (client)
GET  /api/blood-banks/{id}/analytics (prestataire)
POST /api/blood-banks/{id}/update-stock (prestataire)
```

---

## 🚀 **ARCHITECTURE ET SCALABILITÉ**

### 1. **Scaling Horizontal**

**Référence** : Architecture Yukpomnang existante

**Redis Cluster** :
```rust
// backend/src/state.rs
pub struct AppState {
    // ...
    pub redis_cluster_nodes: Vec<String>, // Support cluster
    pub redis_pool: Option<Arc<deadpool_redis::Pool>>,
    // ...
}
```

**Read Replicas PostgreSQL** :
```rust
pub struct AppState {
    pub pg: PgPool, // Master (écritures)
    pub pg_read: Option<PgPool>, // Read replica (lectures)
    // ...
}
```

### 2. **Cache Multi-Niveaux**

**L1 (Mémoire)** : Cache local dans l'application
**L2 (Redis)** : Cache distribué pour données fréquentes
**L4 (Base de données)** : Index optimisés, vues matérialisées

### 3. **Queue Distribuée**

**Traitement asynchrone** :
- Notifications push
- Envoi emails/SMS
- Génération rapports
- Analyses IA lourdes

### 4. **Optimisations Requêtes**

```sql
-- Index pour recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_hospital_specialty ON services(specialty) WHERE service_type = 'hospital';
CREATE INDEX IF NOT EXISTS idx_pharmacy_medication_name ON pharmacy_medications(name);
CREATE INDEX IF NOT EXISTS idx_lab_examination_type ON lab_examinations(examination_type);
CREATE INDEX IF NOT EXISTS idx_blood_request_group ON blood_requests(blood_group, status);

-- Index géographiques (PostGIS)
CREATE INDEX IF NOT EXISTS idx_services_location ON services USING GIST(location);
```

---

## 📱 **NAVIGATION ET ACCÈS**

### 1. **Routes Navigation**

**Référence** : `mobile/src/navigation/AppNavigator.tsx`

**Toutes les routes doivent être déclarées dans `AppNavigator.tsx`** :
```typescript
// mobile/src/navigation/AppNavigator.tsx
<Stack.Screen name="HospitalSearch" component={HospitalSearchScreen} />
<Stack.Screen name="HospitalDetails" component={HospitalDetailsScreen} />
<Stack.Screen name="HospitalBooking" component={HospitalBookingScreen} />
<Stack.Screen name="PharmacySearch" component={PharmacySearchScreen} />
// ... etc
```

### 2. **Guards de Navigation**

**Référence** : `mobile/src/utils/navigationGuards.ts`

**Protéger les écrans prestataires** :
```typescript
// mobile/src/screens/HospitalManagementScreen.tsx
import { requireProvider } from '../utils/navigationGuards';

useEffect(() => {
    if (!requireProvider(user, navigation)) {
        return;
    }
    loadData();
}, [user]);
```

### 3. **Accès Naturels**

- ✅ **Deep linking** : Liens directs vers services
- ✅ **Notifications** : Redirection automatique
- ✅ **Recherche globale** : Accès depuis HomeScreen
- ✅ **Historique** : Accès rapide aux réservations

---

## ✅ **CHECKLIST DE VALIDATION**

### Phase Pré-Implémentation (OBLIGATOIRE)
- [ ] Analyse complète de l'existant effectuée
- [ ] Documentation de l'existant créée
- [ ] Logique/philosophie comprise
- [ ] Gaps réels identifiés (pas supposés)
- [ ] Plan d'amélioration basé sur l'existant
- [ ] Aucune duplication de code existant

### Backend
- [ ] Migrations créées et intégrées dans `auto_migrate.rs`
- [ ] Endpoints créés avec JWT protection
- [ ] Services IA créés avec prompts spécialisés
- [ ] Tests unitaires et d'intégration
- [ ] Documentation API

### Frontend
- [ ] Écrans créés (client + prestataire)
- [ ] Routes déclarées dans `AppNavigator.tsx`
- [ ] Guards de navigation ajoutés
- [ ] Services API créés
- [ ] Composants réutilisables

### Base de Données
- [ ] Tables créées avec index optimisés
- [ ] Migrations appliquées sur Render
- [ ] `sqlx-data.json` régénéré
- [ ] Vérification avec `cargo check`

### IA
- [ ] Services IA créés
- [ ] Prompts spécialisés définis
- [ ] Intégration dans contrôleurs
- [ ] Tests de génération

### UX/UI
- [ ] Design moderne et attrayant
- [ ] Animations fluides
- [ ] Navigation intuitive
- [ ] Skeleton loading
- [ ] Mode offline (si applicable)

### Scalabilité
- [ ] Cache multi-niveaux
- [ ] Queue distribuée
- [ ] Optimisation requêtes
- [ ] Support scaling horizontal

---

## 🎯 **RÉSULTAT ATTENDU**

Après implémentation, chaque service spécialisé doit avoir :
- ✅ **Expérience utilisateur unique** : Inégalée dans le monde
- ✅ **Fonctionnalités complètes** : Client + Prestataire
- ✅ **IA intégrée** : Recommandations intelligentes
- ✅ **Navigation fluide** : 100% fonctionnelle
- ✅ **Scalabilité** : Millions de transactions/seconde
- ✅ **Performance** : Temps de réponse < 200ms

**Yukpomnang sera alors le LEADER TECHNIQUE MONDIAL #1 sur TOUS les services spécialisés !** 🏆

---

*Prompt créé le : 2025-01-27*  
*Version : 2.0*  
*Basé sur les améliorations réussies du module Tickets de Bus*  
*Références : EXPERIENCES_UTILISATEUR_UNIQUES_YUKPO.md, CONFIRMATION_LEADERSHIP_MONDIAL.md*
