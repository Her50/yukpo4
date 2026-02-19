# Spécifications Techniques - Application Mobile Microfinance

## 1. Architecture Système

### 1.1 Stack Technologique

```
Frontend Mobile:
├── React Native / Expo SDK 52
├── TypeScript
├── React Navigation
├── React Query (gestion état serveur)
└── AsyncStorage (cache local)

Backend:
├── Rust 1.75+
├── Axum (framework web)
├── SQLx (ORM/query builder)
├── PostgreSQL 15+
└── JWT (authentification)

Infrastructure:
├── Serveur: Cloud (AWS/GCP/Azure) ou On-premise
├── Base de données: PostgreSQL avec extensions
├── Stockage fichiers: S3 ou équivalent
└── CDN: Pour assets statiques
```

### 1.2 Structure Base de Données

#### Schéma Principal

```sql
-- Clients
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_client VARCHAR(50) UNIQUE NOT NULL,
    nom VARCHAR(255) NOT NULL,
    prenom VARCHAR(255),
    telephone VARCHAR(50) UNIQUE,
    email VARCHAR(255),
    adresse TEXT,
    date_naissance DATE,
    profession VARCHAR(255),
    date_inscription TIMESTAMP DEFAULT NOW(),
    statut VARCHAR(50) DEFAULT 'actif', -- actif, suspendu, ferme
    chef_secteur_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Demandes de Prêt
CREATE TABLE demandes_pret (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) NOT NULL,
    numero_demande VARCHAR(50) UNIQUE NOT NULL,
    montant_souhaite DECIMAL(15,2) NOT NULL,
    duree_mois INTEGER NOT NULL,
    objectif TEXT,
    garanties TEXT,
    statut VARCHAR(50) DEFAULT 'en_attente', -- en_attente, approuve_chef, analyse_comite, accorde, refuse, annule
    date_demande TIMESTAMP DEFAULT NOW(),
    date_approbation_chef TIMESTAMP,
    chef_secteur_id UUID REFERENCES users(id),
    date_decision_comite TIMESTAMP,
    comite_credit_id UUID REFERENCES users(id),
    decision_comite VARCHAR(50), -- accorde, refuse
    motif_refus TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Prêts
CREATE TABLE prets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    demande_pret_id UUID REFERENCES demandes_pret(id) UNIQUE,
    client_id UUID REFERENCES clients(id) NOT NULL,
    numero_pret VARCHAR(50) UNIQUE NOT NULL,
    montant_initial DECIMAL(15,2) NOT NULL,
    taux_interet DECIMAL(5,2) NOT NULL,
    duree_mois INTEGER NOT NULL,
    periode_differe_mois INTEGER DEFAULT 0,
    date_debut DATE NOT NULL,
    date_premiere_echeance DATE NOT NULL,
    date_fin DATE,
    montant_total DECIMAL(15,2) GENERATED ALWAYS AS (
        montant_initial + (montant_initial * taux_interet / 100 * duree_mois / 12)
    ) STORED,
    statut VARCHAR(50) DEFAULT 'actif', -- actif, rembourse, defaut, rachete
    reconnaissance_dette_validee BOOLEAN DEFAULT FALSE,
    date_validation_rd TIMESTAMP,
    date_virement TIMESTAMP,
    reference_virement VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tableau d'Amortissement
CREATE TABLE amortissements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pret_id UUID REFERENCES prets(id) NOT NULL,
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
    montant_paye DECIMAL(15,2) DEFAULT 0,
    statut VARCHAR(50) DEFAULT 'en_attente', -- en_attente, paye, en_retard, partiel, defaut
    jours_retard INTEGER DEFAULT 0,
    penalite DECIMAL(15,2) DEFAULT 0,
    sanction_financiere DECIMAL(15,2) DEFAULT 0,
    niveau_sanction INTEGER DEFAULT 0, -- 0: aucune, 1-3: niveaux de sanction
    date_derniere_alerte DATE, -- Date dernière notification envoyée
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(pret_id, numero_echeance)
);

-- Preuves de Paiement (envoyées par clients)
CREATE TABLE preuves_paiement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) NOT NULL,
    pret_id UUID REFERENCES prets(id),
    amortissement_id UUID REFERENCES amortissements(id),
    type_preuve VARCHAR(50) NOT NULL, -- photo, pdf, scan
    fichier_path VARCHAR(500) NOT NULL,
    fichier_url VARCHAR(500),
    montant_extrait DECIMAL(15,2), -- Montant extrait par OCR
    date_extrait DATE, -- Date extraite par OCR
    reference_extrait VARCHAR(255), -- Référence extraite par OCR
    statut_ocr VARCHAR(50) DEFAULT 'en_attente', -- en_attente, traite, erreur
    confiance_ocr DECIMAL(5,2), -- Score de confiance OCR (0-100)
    valide BOOLEAN DEFAULT FALSE,
    valide_par UUID REFERENCES users(id),
    date_validation TIMESTAMP,
    motif_rejet TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Configuration Sanctions
CREATE TABLE configuration_sanctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_mensualites_seuil INTEGER NOT NULL, -- Seuil déclenchant sanction
    niveau_sanction INTEGER NOT NULL, -- 1, 2, 3
    type_sanction VARCHAR(50) NOT NULL, -- pourcentage_capital, montant_fixe, pourcentage_mensualite
    valeur_sanction DECIMAL(10,2) NOT NULL, -- Pourcentage ou montant
    description TEXT,
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(nombre_mensualites_seuil, niveau_sanction)
);

-- Historique Sanctions
CREATE TABLE historique_sanctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pret_id UUID REFERENCES prets(id) NOT NULL,
    client_id UUID REFERENCES clients(id) NOT NULL,
    niveau_sanction INTEGER NOT NULL,
    nombre_mensualites_manquees INTEGER NOT NULL,
    montant_sanction DECIMAL(15,2) NOT NULL,
    capital_restant_du DECIMAL(15,2) NOT NULL,
    date_application DATE NOT NULL,
    applique_par UUID REFERENCES users(id), -- NULL si automatique
    applique_automatiquement BOOLEAN DEFAULT TRUE,
    notification_envoyee BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Versements
CREATE TABLE versements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pret_id UUID REFERENCES prets(id),
    amortissement_id UUID REFERENCES amortissements(id),
    preuve_paiement_id UUID REFERENCES preuves_paiement(id), -- Lien vers preuve envoyée par client
    client_id UUID REFERENCES clients(id) NOT NULL,
    type_versement VARCHAR(50) NOT NULL, -- remboursement, epargne, dividende, interet_epargne
    montant DECIMAL(15,2) NOT NULL,
    date_versement DATE NOT NULL,
    mode_paiement VARCHAR(50), -- mobile_money, virement, especes, cheque
    reference_paiement VARCHAR(255),
    reçu_path VARCHAR(500), -- Chemin fichier reçu scanné (si upload gestionnaire)
    reçu_ocr_data JSONB, -- Données extraites par OCR
    source_versement VARCHAR(50) DEFAULT 'gestionnaire', -- gestionnaire, client_app, systeme_externe
    valide BOOLEAN DEFAULT FALSE,
    valide_par UUID REFERENCES users(id),
    date_validation TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Épargne Mensuelle
CREATE TABLE epargne_mensuelle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) NOT NULL,
    mois DATE NOT NULL, -- Premier jour du mois
    montant_janvier DECIMAL(15,2) DEFAULT 0,
    montant_fevrier DECIMAL(15,2) DEFAULT 0,
    montant_mars DECIMAL(15,2) DEFAULT 0,
    montant_avril DECIMAL(15,2) DEFAULT 0,
    montant_mai DECIMAL(15,2) DEFAULT 0,
    montant_juin DECIMAL(15,2) DEFAULT 0,
    montant_juillet DECIMAL(15,2) DEFAULT 0,
    montant_aout DECIMAL(15,2) DEFAULT 0,
    montant_septembre DECIMAL(15,2) DEFAULT 0,
    montant_octobre DECIMAL(15,2) DEFAULT 0,
    montant_novembre DECIMAL(15,2) DEFAULT 0,
    montant_decembre DECIMAL(15,2) DEFAULT 0,
    -- Année suivante (24 mois comme Excel)
    montant_janvier_2 DECIMAL(15,2) DEFAULT 0,
    montant_fevrier_2 DECIMAL(15,2) DEFAULT 0,
    -- ... jusqu'à décembre_2
    total_mensuel DECIMAL(15,2) GENERATED ALWAYS AS (
        montant_janvier + montant_fevrier + ... + montant_decembre_2
    ) STORED,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(client_id, mois)
);

-- Cumul Épargne
CREATE TABLE cumul_epargne (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) NOT NULL,
    date_calcul DATE NOT NULL,
    cumul_total DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(client_id, date_calcul)
);

-- Apports Mensuels
CREATE TABLE apports_mensuels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) NOT NULL,
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

-- Recouvrement Dettes
CREATE TABLE recouvrement_dettes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pret_id UUID REFERENCES prets(id) NOT NULL,
    client_id UUID REFERENCES clients(id) NOT NULL,
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
    statut VARCHAR(50) DEFAULT 'en_cours', -- en_cours, recouvre, en_retard
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Utilisateurs (Gestionnaires)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nom VARCHAR(255) NOT NULL,
    prenom VARCHAR(255),
    role VARCHAR(50) NOT NULL, -- client, chef_secteur, comite_credit, gestionnaire_financier, admin
    secteur VARCHAR(255),
    actif BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Audit Trail
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 1.3 Fonctions PostgreSQL

```sql
-- Calculer taux d'intérêt selon montant
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

-- Générer tableau d'amortissement
CREATE OR REPLACE FUNCTION generer_amortissement(
    p_pret_id UUID
) RETURNS VOID AS $$
DECLARE
    v_pret RECORD;
    v_mensualite DECIMAL;
    v_capital_restant DECIMAL;
    v_interet DECIMAL;
    v_capital DECIMAL;
    v_date_echeance DATE;
    i INTEGER;
BEGIN
    SELECT * INTO v_pret FROM prets WHERE id = p_pret_id;
    
    -- Calcul mensualité (formule standard)
    v_mensualite := calculer_mensualite(
        v_pret.montant_initial,
        v_pret.taux_interet,
        v_pret.duree_mois
    );
    
    v_capital_restant := v_pret.montant_initial;
    v_date_echeance := v_pret.date_premiere_echeance;
    
    -- Générer échéances
    FOR i IN 1..v_pret.duree_mois LOOP
        v_interet := v_capital_restant * v_pret.taux_interet / 100 / 12;
        v_capital := v_mensualite - v_interet;
        v_capital_restant := v_capital_restant - v_capital;
        
        INSERT INTO amortissements (
            pret_id, numero_echeance, date_echeance,
            capital_initial, interet, mensualite
        ) VALUES (
            p_pret_id, i, v_date_echeance,
            v_capital_restant + v_capital, v_interet, v_mensualite
        );
        
        v_date_echeance := v_date_echeance + INTERVAL '1 month';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Calculer mensualité
CREATE OR REPLACE FUNCTION calculer_mensualite(
    capital DECIMAL,
    taux_annuel DECIMAL,
    duree_mois INTEGER
) RETURNS DECIMAL AS $$
DECLARE
    taux_mensuel DECIMAL;
BEGIN
    taux_mensuel := taux_annuel / 100 / 12;
    RETURN capital * taux_mensuel * POWER(1 + taux_mensuel, duree_mois) /
           (POWER(1 + taux_mensuel, duree_mois) - 1);
END;
$$ LANGUAGE plpgsql;
```

## 2. API Endpoints

### 2.1 Authentification

```
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/auth/me
```

### 2.2 Clients

```
GET    /api/clients                    # Liste (pagination, filtres)
POST   /api/clients                    # Créer
GET    /api/clients/:id                # Détails
PUT    /api/clients/:id                # Modifier
DELETE /api/clients/:id                # Supprimer (soft delete)
GET    /api/clients/:id/historique     # Historique complet
```

### 2.3 Demandes de Prêt

```
GET    /api/demandes-pret              # Liste
POST   /api/demandes-pret              # Créer (client)
GET    /api/demandes-pret/:id          # Détails
PUT    /api/demandes-pret/:id/approver # Approuver (chef secteur)
PUT    /api/demandes-pret/:id/decider  # Décider (comité)
DELETE /api/demandes-pret/:id          # Annuler
```

### 2.4 Prêts

```
GET    /api/prets                      # Liste
POST   /api/prets                      # Créer (après accord)
GET    /api/prets/:id                  # Détails
GET    /api/prets/:id/amortissement    # Tableau amortissement
PUT    /api/prets/:id/valider-rd       # Valider reconnaissance dette
POST   /api/prets/:id/virer            # Initier virement
GET    /api/prets/:id/statut           # Statut et solde
```

### 2.5 Remboursements

```
GET    /api/versements                 # Liste
POST   /api/versements                 # Enregistrer versement
POST   /api/versements/scan            # Upload et analyse reçu
GET    /api/versements/:id             # Détails
PUT    /api/versements/:id/valider     # Valider versement
GET    /api/amortissements/:id        # Détails échéance
PUT    /api/amortissements/:id/payer   # Enregistrer paiement
```

### 2.6 Épargne

```
GET    /api/clients/:id/epargne       # Épargne mensuelle
POST   /api/clients/:id/epargne       # Ajouter versement
GET    /api/clients/:id/epargne/cumul # Cumul épargne
GET    /api/clients/:id/apports       # Apports mensuels
```

### 2.7 Rachat Prêts

```
GET    /api/rachats                   # Liste
POST   /api/rachats                   # Demander rachat
GET    /api/rachats/:id               # Détails
PUT    /api/rachats/:id/valider       # Valider rachat
```

### 2.8 Synthèses et Rapports

```
GET    /api/synthese/cassation        # Synthèse cassation
GET    /api/synthese/recap-pret       # Récapitulatif prêts
GET    /api/synthese/apports          # Apports mensuels
GET    /api/rapports/dashboard         # Dashboard général
GET    /api/rapports/recouvrement     # Rapport recouvrement
```

## 3. Services Backend (Rust)

### 3.1 Service Calcul Financier

```rust
pub struct CalculFinancierService;

impl CalculFinancierService {
    pub fn calculer_taux_interet(montant: Decimal, taux_base: Decimal) -> Decimal {
        if montant < Decimal::from(1_000_000) {
            taux_base * Decimal::from_str("1.5").unwrap()
        } else {
            taux_base * Decimal::from_str("1.0").unwrap()
        }
    }
    
    pub fn calculer_mensualite(
        capital: Decimal,
        taux_annuel: Decimal,
        duree_mois: i32
    ) -> Result<Decimal, Error> {
        let taux_mensuel = taux_annuel / Decimal::from(100) / Decimal::from(12);
        let numerateur = capital * taux_mensuel * (Decimal::from(1) + taux_mensuel).powi(duree_mois);
        let denominateur = (Decimal::from(1) + taux_mensuel).powi(duree_mois) - Decimal::from(1);
        Ok(numerateur / denominateur)
    }
    
    pub fn generer_amortissement(
        pret: &Pret,
    ) -> Result<Vec<Amortissement>, Error> {
        // Implémentation génération tableau
    }
}
```

### 3.2 Service Workflow

```rust
pub struct WorkflowService;

impl WorkflowService {
    pub async fn soumettre_demande(
        demande: DemandePret,
    ) -> Result<DemandePret, Error> {
        // Créer demande avec statut "en_attente"
        // Notifier chef de secteur
    }
    
    pub async fn approuver_chef_secteur(
        demande_id: Uuid,
        chef_id: Uuid,
    ) -> Result<(), Error> {
        // Changer statut à "approuve_chef"
        // Notifier comité de crédit
    }
    
    pub async fn decider_comite(
        demande_id: Uuid,
        decision: DecisionComite,
        comite_id: Uuid,
    ) -> Result<(), Error> {
        // Enregistrer décision
        // Si accordé: créer prêt, générer amortissement
        // Notifier client
    }
}
```

### 3.3 Service Contrôle Échéances

```rust
pub struct ControleEcheancesService;

impl ControleEcheancesService {
    pub async fn verifier_echeances_retard() -> Result<Vec<EcheanceRetard>, Error> {
        // Vérifier toutes échéances en retard
        // Calculer jours de retard
        // Mettre à jour statuts
    }
    
    pub async fn envoyer_alertes_proactives() -> Result<(), Error> {
        // Envoyer alertes J-7, J-3, J-1
        // Notifications push + email
    }
    
    pub async fn calculer_retard(
        echeance: &Amortissement,
    ) -> Result<i32, Error> {
        // Calculer jours de retard depuis date échéance
    }
    
    pub async fn mettre_a_jour_statut_echeance(
        echeance_id: Uuid,
    ) -> Result<(), Error> {
        // Mettre à jour statut selon retard
        // en_attente -> en_retard -> defaut
    }
}
```

### 3.4 Service Sanctions Financières

```rust
pub struct SanctionsService;

impl SanctionsService {
    pub async fn verifier_et_appliquer_sanctions(
        pret_id: Uuid,
    ) -> Result<Vec<Sanction>, Error> {
        // Compter mensualités non payées
        // Vérifier seuils configurés
        // Appliquer sanctions automatiquement
        // Notifier client et gestionnaire
    }
    
    pub async fn calculer_sanction(
        niveau: i32,
        capital_restant: Decimal,
        config: &ConfigurationSanction,
    ) -> Result<Decimal, Error> {
        // Calculer montant sanction selon type
        // Pourcentage capital ou montant fixe
    }
    
    pub async fn compter_mensualites_manquees(
        pret_id: Uuid,
    ) -> Result<i32, Error> {
        // Compter échéances consécutives non payées
    }
    
    pub async fn enregistrer_sanction(
        sanction: Sanction,
    ) -> Result<Uuid, Error> {
        // Enregistrer dans historique
        // Ajouter au solde client
        // Générer notification
    }
}
```

### 3.5 Service Preuves de Paiement

```rust
pub struct PreuvePaiementService;

impl PreuvePaiementService {
    pub async fn upload_preuve(
        client_id: Uuid,
        pret_id: Option<Uuid>,
        echeance_id: Option<Uuid>,
        fichier: Vec<u8>,
        type_fichier: String,
    ) -> Result<Uuid, Error> {
        // Sauvegarder fichier
        // Créer enregistrement preuve
        // Lancer traitement OCR
        // Notifier gestionnaire
    }
    
    pub async fn traiter_ocr(
        preuve_id: Uuid,
    ) -> Result<DonneesOCR, Error> {
        // Appeler service OCR
        // Extraire montant, date, référence
        // Calculer score confiance
        // Mettre à jour preuve
    }
    
    pub async fn valider_preuve(
        preuve_id: Uuid,
        gestionnaire_id: Uuid,
    ) -> Result<(), Error> {
        // Valider preuve
        // Créer versement associé
        // Mettre à jour échéance
        // Notifier client
    }
    
    pub async fn rejeter_preuve(
        preuve_id: Uuid,
        gestionnaire_id: Uuid,
        motif: String,
    ) -> Result<(), Error> {
        // Rejeter preuve avec motif
        // Notifier client
    }
}
```

### 3.6 Service Fintech (Phase Future)

```rust
pub struct FintechService;

impl FintechService {
    // Note: Service prévu pour phase future
    // Architecture préparée mais non implémentée initialement
    
    pub async fn virer_pret(
        pret_id: Uuid,
        montant: Decimal,
        compte_client: String,
    ) -> Result<String, Error> {
        // Initier virement via API fintech
        // Enregistrer référence transaction
        // Mettre à jour statut prêt
    }
    
    pub async fn collecter_paiement(
        client_id: Uuid,
        montant: Decimal,
        mode_paiement: ModePaiement,
    ) -> Result<String, Error> {
        // Initier collecte via API
        // Retourner référence
    }
    
    pub async fn reconcilier_transaction(
        reference: String,
    ) -> Result<Transaction, Error> {
        // Vérifier statut transaction
        // Mettre à jour base de données
    }
}
```

## 4. Interface Mobile

### 4.1 Écrans Principaux

```
AppNavigator
├── AuthStack
│   ├── LoginScreen
│   └── ForgotPasswordScreen
├── ClientStack
│   ├── DashboardScreen
│   ├── MesPretsScreen
│   ├── DemanderPretScreen
│   ├── MonEpargneScreen
│   └── HistoriqueScreen
└── GestionnaireStack
    ├── DashboardGestionnaireScreen
    ├── DemandesEnAttenteScreen
    ├── ClientsScreen
    ├── PretsScreen
    ├── VersementsScreen
    └── RapportsScreen
```

### 4.2 Composants Clés

```typescript
// Calcul taux
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

// Générer amortissement
const genererAmortissement = (
  montant: number,
  taux: number,
  duree: number,
  dateDebut: Date,
  differe: number = 0
) => {
  const mensualite = calculerMensualite(montant, taux, duree);
  const echeances = [];
  let capitalRestant = montant;
  let dateEcheance = new Date(dateDebut);
  
  // Ajouter période différé
  dateEcheance.setMonth(dateEcheance.getMonth() + differe);
  
  for (let i = 1; i <= duree; i++) {
    const interet = capitalRestant * taux / 100 / 12;
    const capital = mensualite - interet;
    capitalRestant -= capital;
    
    echeances.push({
      numero: i,
      dateEcheance: new Date(dateEcheance),
      capitalInitial: capitalRestant + capital,
      capitalRembourse: 0,
      interet,
      mensualite,
      statut: 'en_attente'
    });
    
    dateEcheance.setMonth(dateEcheance.getMonth() + 1);
  }
  
  return echeances;
};
```

## 5. Sécurité

### 5.1 Authentification

- JWT avec refresh tokens
- Expiration tokens: 15 min (access), 7 jours (refresh)
- Rotation automatique refresh tokens
- Blacklist tokens révoqués

### 5.2 Autorisation

- RBAC (Role-Based Access Control)
- Permissions granulaires par endpoint
- Validation côté serveur obligatoire

### 5.3 Chiffrement

- TLS 1.3 pour toutes communications
- Chiffrement au repos (AES-256)
- Hashage mots de passe (bcrypt, cost 12)
- Signature électronique (certificats X.509)

### 5.4 Audit

- Logs toutes actions critiques
- Traçabilité modifications données financières
- Conservation logs: 7 ans (conformité)

## 6. Performance

### 6.1 Optimisations

- Index base de données sur colonnes fréquentes
- Cache Redis pour données fréquentes
- Pagination toutes listes
- Lazy loading relations
- Compression réponses API (gzip)

### 6.2 Métriques Cibles

- Temps réponse API: < 200ms (p95)
- Temps chargement écran: < 1s
- Disponibilité: 99.9%
- Throughput: 1000 req/s

## 7. Tests

### 7.1 Backend (Rust)

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_calcul_taux_interet() {
        assert_eq!(calculer_taux_interet(500000, 1.0), 1.5);
        assert_eq!(calculer_taux_interet(2000000, 1.0), 1.0);
    }
    
    #[tokio::test]
    async fn test_workflow_demande() {
        // Test workflow complet
    }
}
```

### 7.2 Frontend (Jest + React Native Testing Library)

```typescript
describe('Calculs financiers', () => {
  it('calcule correctement le taux', () => {
    expect(calculerTauxInteret(500000)).toBe(1.5);
    expect(calculerTauxInteret(2000000)).toBe(1.0);
  });
  
  it('génère tableau amortissement', () => {
    const echeances = genererAmortissement(1000000, 1.5, 12, new Date());
    expect(echeances).toHaveLength(12);
  });
});
```

### 7.3 E2E (Playwright/Detox)

- Tests workflows complets
- Tests intégration fintech (mock)
- Tests performance

## 8. Déploiement

### 8.1 Environnements

- **Development**: Local
- **Staging**: Cloud (tests)
- **Production**: Cloud (haute disponibilité)

### 8.2 CI/CD

- GitHub Actions / GitLab CI
- Tests automatiques
- Déploiement automatique staging
- Déploiement manuel production (approbation)

### 8.3 Monitoring

- Logs centralisés (ELK Stack)
- Métriques (Prometheus + Grafana)
- Alertes (PagerDuty / OpsGenie)
- Health checks automatiques

---

*Document technique pour l'équipe de développement*


