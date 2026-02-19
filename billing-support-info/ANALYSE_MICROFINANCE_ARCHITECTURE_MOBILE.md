# Analyse et Architecture Mobile - Système de Gestion Microfinance

## 📊 Analyse du Fichier Excel

### Vue d'ensemble
- **36 feuilles** au total (30 visibles, 6 masquées)
- **6,101 formules** avec **2,978 références croisées**
- Système complexe de gestion de microfinance avec épargne, prêts, amortissements

### Modules Identifiés

#### 1. **Gestion de l'Épargne Mensuelle**
- **Feuille principale**: `epargne_mensuelle` (51 lignes x 28 colonnes)
- **Cumul**: `cumul_epargne` (48 lignes x 6 colonnes)
- **Calculs**: Sommes mensuelles par client, cumuls
- **Formules clés**: `SUM(epargne_mensuelle!C2:AB2)` pour cumul par client

#### 2. **Calcul des Apports Mensuels**
- **Feuille**: `apport_mensuel_calcul` (59 lignes x 82 colonnes)
- **Complexité**: 3,961 formules avec 1,389 références croisées
- **Logique**: 
  - Référence `epargne_mensuelle` pour données de base
  - Calculs proportionnels: `(C2/C$48)*C$53`
  - Calculs conditionnels complexes avec IF

#### 3. **Recouvrement de Dettes**
- **Feuille**: `recouvrement_dette` (43 lignes x 33 colonnes)
- **Formule clé**: `IF(E3<1000000,F3*1.5%,F3*1%)`
  - **Taux d'intérêt**: 1.5% si montant < 1,000,000, sinon 1%
- **Calcul intérêt**: `G3*E3` (taux × montant)

#### 4. **Tableaux d'Amortissement par Client**
- **17 clients** avec feuilles dédiées:
  - Franklin, Sainclair, Narcisse, Valdese, Sammuel, Clemence, Michel, Kelly, Dagober, Brice, Ricard, Tony, Moise, appol, Cheval, Rodine, Fidel, Hernandez, Jackson
- **Structure**: ~400 lignes x 13 colonnes par client
- **Formules récurrentes**:
  - `IF(C13<1000000,F13*1.5%,F13%)` - Calcul taux
  - `C13*J13` - Intérêt
  - `C13+J15` - Capital + Intérêt
  - `C20-D20` - Solde restant

#### 5. **Récapitulatif Prêts**
- **Feuille**: `recap_prêt` (50 lignes x 15 colonnes)
- **421 formules** avec **308 références croisées**
- **Formule principale**: 
  ```
  cumul_epargne!C48 - recap_prêt!B45 + recap_prêt!H45 
  - SUM(recouvrement_dette!I43:AG43) + ...
  ```
- Agrége les données de plusieurs feuilles

#### 6. **Synthèse de Cassation**
- **Feuille**: `Synthese_cassation` (60 lignes x 12 colonnes)
- **456 formules** avec **897 références croisées**
- Référence `apport_mensuel_calcul` pour données consolidées

#### 7. **Gestion des Intérêts**
- **Feuille**: `_interet` (43 lignes x 33 colonnes)
- Référence `recouvrement_dette` pour données de base
- Calculs similaires au recouvrement

### Logique Métier Principale

#### Calcul des Taux d'Intérêt
```excel
IF(montant < 1000000, taux_base * 1.5%, taux_base * 1%)
```
- **Seuil**: 1,000,000 (probablement en francs CFA)
- **Taux réduit**: 1.5% pour montants < seuil
- **Taux standard**: 1% pour montants >= seuil

#### Calculs d'Amortissement
- **Capital**: Montant initial
- **Intérêt**: Capital × Taux
- **Total à rembourser**: Capital + Intérêt
- **Mensualité**: Total / Durée
- **Solde restant**: Capital - Remboursements

#### Flux de Données
```
epargne_mensuelle 
  → apport_mensuel_calcul (calculs complexes)
  → cumul_epargne (agrégation)
  → recap_prêt (récapitulatif)
  → Synthese_cassation (synthèse finale)
```

---

## 📱 Architecture Mobile Proposée

### Stack Technique (Yukpomnang)
- **Frontend**: React Native / Expo (déjà en place)
- **Backend**: Rust / Axum / SQLx (déjà en place)
- **Base de données**: PostgreSQL (déjà en place)

### Structure de Base de Données

#### 1. **Clients (Clients)**
```sql
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom VARCHAR(255) NOT NULL,
    prenom VARCHAR(255),
    telephone VARCHAR(50),
    email VARCHAR(255),
    adresse TEXT,
    date_inscription TIMESTAMP DEFAULT NOW(),
    statut VARCHAR(50) DEFAULT 'actif',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. **Épargne Mensuelle (epargne_mensuelle)**
```sql
CREATE TABLE epargne_mensuelle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id),
    mois DATE NOT NULL, -- Année-Mois
    montant_janvier DECIMAL(15,2) DEFAULT 0,
    montant_fevrier DECIMAL(15,2) DEFAULT 0,
    montant_mars DECIMAL(15,2) DEFAULT 0,
    -- ... jusqu'à décembre (24 mois dans Excel)
    total_mensuel DECIMAL(15,2) GENERATED ALWAYS AS (
        montant_janvier + montant_fevrier + ... + montant_decembre
    ) STORED,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(client_id, mois)
);
```

#### 3. **Cumul Épargne (cumul_epargne)**
```sql
CREATE TABLE cumul_epargne (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id),
    date_calcul DATE NOT NULL,
    cumul_total DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(client_id, date_calcul)
);
```

#### 4. **Prêts (pret)**
```sql
CREATE TABLE prets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id),
    numero_pret VARCHAR(50) UNIQUE,
    montant_initial DECIMAL(15,2) NOT NULL,
    taux_interet DECIMAL(5,2) NOT NULL, -- Calculé selon seuil
    duree_mois INTEGER NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE,
    statut VARCHAR(50) DEFAULT 'actif', -- actif, rembourse, defaut
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Fonction pour calculer taux selon montant
CREATE OR REPLACE FUNCTION calculer_taux_interet(
    montant DECIMAL,
    taux_base DECIMAL DEFAULT 1.0
) RETURNS DECIMAL AS $$
BEGIN
    IF montant < 1000000 THEN
        RETURN taux_base * 1.5;
    ELSE
        RETURN taux_base * 1.0;
    END IF;
END;
$$ LANGUAGE plpgsql;
```

#### 5. **Tableau d'Amortissement (amortissements)**
```sql
CREATE TABLE amortissements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pret_id UUID REFERENCES prets(id),
    numero_echeance INTEGER NOT NULL,
    date_echeance DATE NOT NULL,
    capital_initial DECIMAL(15,2) NOT NULL,
    capital_rembourse DECIMAL(15,2) DEFAULT 0,
    capital_restant DECIMAL(15,2) GENERATED ALWAYS AS (
        capital_initial - capital_rembourse
    ) STORED,
    interet DECIMAL(15,2) NOT NULL,
    mensualite DECIMAL(15,2) NOT NULL,
    date_paiement DATE,
    statut VARCHAR(50) DEFAULT 'en_attente', -- en_attente, paye, en_retard
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(pret_id, numero_echeance)
);
```

#### 6. **Recouvrement Dettes (recouvrement_dette)**
```sql
CREATE TABLE recouvrement_dettes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pret_id UUID REFERENCES prets(id),
    client_id UUID REFERENCES clients(id),
    montant_dette DECIMAL(15,2) NOT NULL,
    taux_interet DECIMAL(5,2) NOT NULL,
    interet_calcule DECIMAL(15,2) GENERATED ALWAYS AS (
        montant_dette * taux_interet / 100
    ) STORED,
    total_a_rembourser DECIMAL(15,2) GENERATED ALWAYS AS (
        montant_dette + interet_calcule
    ) STORED,
    date_echeance DATE NOT NULL,
    date_recouvrement DATE,
    statut VARCHAR(50) DEFAULT 'en_cours',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 7. **Apports Mensuels (apport_mensuel_calcul)**
```sql
CREATE TABLE apports_mensuels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id),
    mois DATE NOT NULL,
    apport_base DECIMAL(15,2) NOT NULL,
    apport_calcule DECIMAL(15,2) NOT NULL,
    pourcentage DECIMAL(5,2),
    total_apport DECIMAL(15,2) GENERATED ALWAYS AS (
        apport_base + apport_calcule
    ) STORED,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(client_id, mois)
);
```

### API Backend (Rust/Axum)

#### Endpoints Principaux

```rust
// Clients
GET    /api/clients                    // Liste clients
POST   /api/clients                    // Créer client
GET    /api/clients/:id                // Détails client
PUT    /api/clients/:id                // Modifier client

// Épargne
GET    /api/clients/:id/epargne       // Épargne mensuelle client
POST   /api/clients/:id/epargne       // Ajouter épargne
GET    /api/clients/:id/epargne/cumul // Cumul épargne

// Prêts
GET    /api/clients/:id/prets         // Prêts d'un client
POST   /api/prets                     // Créer prêt
GET    /api/prets/:id                  // Détails prêt
GET    /api/prets/:id/amortissement    // Tableau amortissement

// Recouvrement
GET    /api/recouvrements              // Liste recouvrements
GET    /api/recouvrements/en_retard    // Dettes en retard
POST   /api/recouvrements/:id/payer    // Enregistrer paiement

// Synthèses
GET    /api/synthese/cassation         // Synthèse cassation
GET    /api/synthese/recap_pret        // Récapitulatif prêts
GET    /api/synthese/apports_mensuels  // Apports mensuels
```

### Services Backend

#### Service Calcul Taux Intérêt
```rust
pub fn calculer_taux_interet(montant: Decimal, taux_base: Decimal) -> Decimal {
    if montant < Decimal::from(1_000_000) {
        taux_base * Decimal::from_str("1.5").unwrap()
    } else {
        taux_base * Decimal::from_str("1.0").unwrap()
    }
}
```

#### Service Calcul Amortissement
```rust
pub struct Amortissement {
    pub numero_echeance: i32,
    pub date_echeance: NaiveDate,
    pub capital_initial: Decimal,
    pub capital_rembourse: Decimal,
    pub interet: Decimal,
    pub mensualite: Decimal,
}

pub fn generer_tableau_amortissement(
    montant: Decimal,
    taux: Decimal,
    duree_mois: i32,
    date_debut: NaiveDate,
) -> Vec<Amortissement> {
    // Implémentation calcul amortissement
    // Similaire aux formules Excel
}
```

### Interface Mobile (React Native)

#### Écrans Principaux

1. **Dashboard**
   - Vue d'ensemble: Total épargne, Prêts actifs, Dettes en retard
   - Graphiques: Évolution épargne, Remboursements

2. **Liste Clients**
   - Recherche, filtres
   - Statut: Actif, En défaut, Remboursé
   - Navigation vers détails client

3. **Détails Client**
   - Informations personnelles
   - Onglets: Épargne, Prêts, Historique
   - Actions: Nouveau prêt, Ajouter épargne

4. **Gestion Épargne**
   - Saisie mensuelle par client
   - Vue calendrier
   - Cumul automatique

5. **Création Prêt**
   - Formulaire: Montant, Durée, Client
   - Calcul automatique taux (selon seuil)
   - Prévisualisation tableau amortissement

6. **Tableau Amortissement**
   - Liste échéances
   - Statut paiement
   - Enregistrement paiements

7. **Recouvrement**
   - Liste dettes en retard
   - Filtres: Client, Date, Montant
   - Enregistrement recouvrements

8. **Synthèses**
   - Synthèse cassation
   - Récapitulatif prêts
   - Apports mensuels

#### Composants Clés

```typescript
// Calcul taux d'intérêt
const calculerTauxInteret = (montant: number, tauxBase: number = 1.0) => {
  return montant < 1000000 ? tauxBase * 1.5 : tauxBase * 1.0;
};

// Calcul mensualité
const calculerMensualite = (
  capital: number,
  taux: number,
  duree: number
) => {
  const tauxMensuel = taux / 100 / 12;
  return (capital * tauxMensuel * Math.pow(1 + tauxMensuel, duree)) /
    (Math.pow(1 + tauxMensuel, duree) - 1);
};

// Générer tableau amortissement
const genererAmortissement = (
  montant: number,
  taux: number,
  duree: number,
  dateDebut: Date
) => {
  const mensualite = calculerMensualite(montant, taux, duree);
  // ... logique similaire Excel
};
```

### Fonctionnalités Avancées

1. **Synchronisation Offline**
   - Stockage local avec SQLite
   - Sync automatique au retour connexion

2. **Notifications**
   - Alertes échéances
   - Rappels paiements
   - Notifications retards

3. **Rapports & Export**
   - PDF tableau amortissement
   - Export Excel (compatibilité)
   - Graphiques évolution

4. **Sécurité**
   - Authentification JWT
   - Chiffrement données sensibles
   - Audit trail

### Migration depuis Excel

1. **Script d'Import**
   - Parser fichier Excel
   - Extraire données
   - Insérer en base

2. **Validation**
   - Vérifier cohérence données
   - Comparer calculs
   - Rapport différences

3. **Tests**
   - Tests unitaires calculs
   - Tests intégration
   - Validation résultats vs Excel

---

## 🚀 Plan d'Implémentation

### Phase 1: Base de Données (1-2 semaines)
- [ ] Créer schéma base de données
- [ ] Migrations SQLx
- [ ] Fonctions PostgreSQL (calculs)

### Phase 2: Backend API (2-3 semaines)
- [ ] Modèles Rust
- [ ] Repositories
- [ ] Services calculs
- [ ] Endpoints API
- [ ] Tests unitaires

### Phase 3: Interface Mobile (3-4 semaines)
- [ ] Écrans principaux
- [ ] Composants réutilisables
- [ ] Logique calculs
- [ ] Intégration API
- [ ] Tests UI

### Phase 4: Migration & Tests (1-2 semaines)
- [ ] Script import Excel
- [ ] Validation données
- [ ] Tests end-to-end
- [ ] Documentation

---

## 📝 Notes Techniques

### Calculs Critiques à Répliquer

1. **Taux d'intérêt conditionnel**
   ```rust
   if montant < 1_000_000 {
       taux_base * 1.5
   } else {
       taux_base * 1.0
   }
   ```

2. **Calculs proportionnels**
   ```rust
   apport_calcule = (apport_base / total_apport) * pourcentage
   ```

3. **Cumuls**
   ```sql
   SELECT SUM(montant) FROM epargne_mensuelle 
   WHERE client_id = ? AND mois <= ?
   ```

4. **Amortissement**
   - Formule standard amortissement constant
   - Calcul mensualité avec intérêts composés

### Points d'Attention

- **Précision décimale**: Utiliser `Decimal` (Rust) / `DECIMAL` (PostgreSQL)
- **Performance**: Index sur `client_id`, `mois`, `date_echeance`
- **Cohérence**: Transactions pour opérations multiples
- **Audit**: Logs toutes modifications financières

---

## ✅ Conclusion

Le système Excel peut être entièrement transposé en application mobile avec:
- **Base de données structurée** (PostgreSQL)
- **API robuste** (Rust/Axum)
- **Interface moderne** (React Native)
- **Calculs automatisés** (backend)
- **Synchronisation** (offline/online)

L'architecture proposée respecte la logique métier Excel tout en apportant:
- **Scalabilité**
- **Sécurité**
- **Maintenabilité**
- **Expérience utilisateur améliorée**


