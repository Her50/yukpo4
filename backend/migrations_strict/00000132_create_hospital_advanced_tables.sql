-- Migration: Tables avancées pour Hôpitaux/Cliniques
-- Date: 2025-01-27
-- Description: Tables pour consultations, urgences, créneaux horaires et analytics
-- Compatible SQLx offline mode

-- ============================================================================
-- 1. TABLE : Consultations médicales
-- ============================================================================
CREATE TABLE IF NOT EXISTS hospital_consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id INTEGER NOT NULL REFERENCES hopitaux_cliniques(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id INTEGER, -- ID du médecin (peut être NULL si non spécifié)
    doctor_name VARCHAR(255), -- Nom du médecin
    specialty VARCHAR(100), -- Spécialité
    appointment_date TIMESTAMPTZ NOT NULL,
    appointment_duration_minutes INTEGER DEFAULT 30,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
    symptoms TEXT, -- Symptômes décrits par le patient
    diagnosis TEXT, -- Diagnostic (rempli après consultation)
    prescription JSONB, -- Prescription médicale (médicaments, posologie, etc.)
    notes TEXT, -- Notes additionnelles
    consultation_fee DECIMAL(10,2), -- Frais de consultation
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ -- Date de fin de consultation
);

CREATE INDEX IF NOT EXISTS idx_hospital_consultations_hospital ON hospital_consultations(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_consultations_user ON hospital_consultations(user_id);
CREATE INDEX IF NOT EXISTS idx_hospital_consultations_service ON hospital_consultations(service_id);
CREATE INDEX IF NOT EXISTS idx_hospital_consultations_date ON hospital_consultations(appointment_date);
CREATE INDEX IF NOT EXISTS idx_hospital_consultations_status ON hospital_consultations(status);
CREATE INDEX IF NOT EXISTS idx_hospital_consultations_specialty ON hospital_consultations(specialty) WHERE specialty IS NOT NULL;

-- ============================================================================
-- 2. TABLE : Urgences médicales
-- ============================================================================
CREATE TABLE IF NOT EXISTS hospital_emergencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id INTEGER NOT NULL REFERENCES hopitaux_cliniques(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    severity_level INTEGER NOT NULL CHECK (severity_level >= 1 AND severity_level <= 5), -- 1=Critique, 5=Non urgent
    symptoms TEXT NOT NULL, -- Symptômes décrits
    arrival_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    triage_time TIMESTAMPTZ, -- Heure du triage
    treatment_start_time TIMESTAMPTZ, -- Heure de début de traitement
    treatment_end_time TIMESTAMPTZ, -- Heure de fin de traitement
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'triaged', 'in_treatment', 'discharged', 'transferred', 'cancelled')),
    diagnosis TEXT, -- Diagnostic
    treatment_description TEXT, -- Description du traitement
    wait_time_minutes INTEGER, -- Temps d'attente calculé
    treatment_duration_minutes INTEGER, -- Durée du traitement
    transferred_to_hospital_id INTEGER, -- Si transféré vers un autre hôpital
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hospital_emergencies_hospital ON hospital_emergencies(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_emergencies_user ON hospital_emergencies(user_id);
CREATE INDEX IF NOT EXISTS idx_hospital_emergencies_status ON hospital_emergencies(status);
CREATE INDEX IF NOT EXISTS idx_hospital_emergencies_severity ON hospital_emergencies(severity_level);
CREATE INDEX IF NOT EXISTS idx_hospital_emergencies_arrival ON hospital_emergencies(arrival_time);
CREATE INDEX IF NOT EXISTS idx_hospital_emergencies_pending ON hospital_emergencies(hospital_id, status) WHERE status IN ('pending', 'triaged', 'in_treatment');

-- ============================================================================
-- 3. TABLE : Créneaux horaires de consultation
-- ============================================================================
CREATE TABLE IF NOT EXISTS hospital_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id INTEGER NOT NULL REFERENCES hopitaux_cliniques(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    doctor_id INTEGER, -- ID du médecin (optionnel)
    doctor_name VARCHAR(255), -- Nom du médecin
    specialty VARCHAR(100), -- Spécialité
    slot_date DATE NOT NULL,
    slot_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'cancelled', 'blocked')),
    consultation_id UUID REFERENCES hospital_consultations(id) ON DELETE SET NULL, -- Si réservé, lien vers consultation
    notes TEXT, -- Notes additionnelles (ex: "Bloqué pour réunion")
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(hospital_id, slot_date, slot_time, doctor_id) -- Éviter les doublons
);

CREATE INDEX IF NOT EXISTS idx_hospital_slots_hospital ON hospital_slots(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_slots_service ON hospital_slots(service_id);
CREATE INDEX IF NOT EXISTS idx_hospital_slots_date ON hospital_slots(slot_date, slot_time);
CREATE INDEX IF NOT EXISTS idx_hospital_slots_status ON hospital_slots(status);
CREATE INDEX IF NOT EXISTS idx_hospital_slots_specialty ON hospital_slots(specialty) WHERE specialty IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hospital_slots_available ON hospital_slots(hospital_id, slot_date, status) WHERE status = 'available';

-- ============================================================================
-- 4. TABLE : Statistiques et analytics des hôpitaux
-- ============================================================================
CREATE TABLE IF NOT EXISTS hospital_analytics (
    id SERIAL PRIMARY KEY,
    hospital_id INTEGER NOT NULL REFERENCES hopitaux_cliniques(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    -- Métriques consultations
    total_consultations INTEGER DEFAULT 0,
    completed_consultations INTEGER DEFAULT 0,
    cancelled_consultations INTEGER DEFAULT 0,
    no_show_consultations INTEGER DEFAULT 0,
    -- Métriques urgences
    total_emergencies INTEGER DEFAULT 0,
    avg_wait_time_minutes DECIMAL(10,2),
    avg_treatment_duration_minutes DECIMAL(10,2),
    -- Revenus
    total_revenue DECIMAL(10,2) DEFAULT 0,
    consultation_revenue DECIMAL(10,2) DEFAULT 0,
    emergency_revenue DECIMAL(10,2) DEFAULT 0,
    -- Satisfaction
    avg_rating DECIMAL(3,2), -- Note moyenne sur 5
    total_ratings INTEGER DEFAULT 0,
    -- Taux d'occupation
    occupation_rate DECIMAL(5,2), -- Pourcentage
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(hospital_id, date)
);

CREATE INDEX IF NOT EXISTS idx_hospital_analytics_hospital ON hospital_analytics(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_analytics_date ON hospital_analytics(date);
CREATE INDEX IF NOT EXISTS idx_hospital_analytics_service ON hospital_analytics(service_id);

-- ============================================================================
-- 5. FONCTIONS : Calcul automatique des statistiques
-- ============================================================================

-- Fonction pour calculer le temps d'attente moyen des urgences
CREATE OR REPLACE FUNCTION calculate_hospital_avg_wait_time(hospital_id_param INTEGER, date_param DATE DEFAULT CURRENT_DATE)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    avg_wait DECIMAL(10,2);
BEGIN
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (treatment_start_time - arrival_time)) / 60), 0)
    INTO avg_wait
    FROM hospital_emergencies
    WHERE hospital_id = hospital_id_param
        AND DATE(arrival_time) = date_param
        AND treatment_start_time IS NOT NULL
        AND status IN ('in_treatment', 'discharged', 'transferred');
    
    RETURN ROUND(avg_wait, 2);
END;
$$ LANGUAGE plpgsql;

-- Fonction pour calculer le taux d'occupation des créneaux
CREATE OR REPLACE FUNCTION calculate_hospital_occupation_rate(hospital_id_param INTEGER, date_param DATE DEFAULT CURRENT_DATE)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    total_slots INTEGER;
    booked_slots INTEGER;
    occupation_rate DECIMAL(5,2);
BEGIN
    SELECT COUNT(*)
    INTO total_slots
    FROM hospital_slots
    WHERE hospital_id = hospital_id_param
        AND slot_date = date_param
        AND status IN ('available', 'booked');
    
    SELECT COUNT(*)
    INTO booked_slots
    FROM hospital_slots
    WHERE hospital_id = hospital_id_param
        AND slot_date = date_param
        AND status = 'booked';
    
    IF total_slots > 0 THEN
        occupation_rate := (booked_slots::DECIMAL / total_slots::DECIMAL) * 100;
    ELSE
        occupation_rate := 0;
    END IF;
    
    RETURN ROUND(occupation_rate, 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. TRIGGERS : Mise à jour automatique des analytics
-- ============================================================================

-- Trigger pour mettre à jour les analytics quand une consultation change de statut
CREATE OR REPLACE FUNCTION update_hospital_analytics_on_consultation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO hospital_analytics (hospital_id, service_id, date, total_consultations, completed_consultations, cancelled_consultations, no_show_consultations)
    VALUES (
        NEW.hospital_id,
        NEW.service_id,
        DATE(NEW.appointment_date),
        CASE WHEN NEW.status IN ('scheduled', 'confirmed', 'in_progress', 'completed') THEN 1 ELSE 0 END,
        CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
        CASE WHEN NEW.status = 'cancelled' THEN 1 ELSE 0 END,
        CASE WHEN NEW.status = 'no_show' THEN 1 ELSE 0 END
    )
    ON CONFLICT (hospital_id, date)
    DO UPDATE SET
        total_consultations = hospital_analytics.total_consultations + 
            CASE WHEN NEW.status IN ('scheduled', 'confirmed', 'in_progress', 'completed') THEN 1 ELSE 0 END,
        completed_consultations = hospital_analytics.completed_consultations + 
            CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
        cancelled_consultations = hospital_analytics.cancelled_consultations + 
            CASE WHEN NEW.status = 'cancelled' THEN 1 ELSE 0 END,
        no_show_consultations = hospital_analytics.no_show_consultations + 
            CASE WHEN NEW.status = 'no_show' THEN 1 ELSE 0 END,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Pas de trigger automatique pour éviter la surcharge, on utilisera des jobs programmés

-- ============================================================================
-- 7. INDEX pour recherches fréquentes
-- ============================================================================

-- Index composé pour recherche de créneaux disponibles
CREATE INDEX IF NOT EXISTS idx_hospital_slots_available_search 
    ON hospital_slots(hospital_id, slot_date, status, specialty) 
    WHERE status = 'available';

-- Index pour recherche urgences en attente
CREATE INDEX IF NOT EXISTS idx_hospital_emergencies_waiting 
    ON hospital_emergencies(hospital_id, severity_level, arrival_time) 
    WHERE status IN ('pending', 'triaged');

COMMENT ON TABLE hospital_consultations IS 'Consultations médicales planifiées dans les hôpitaux/cliniques';
COMMENT ON TABLE hospital_emergencies IS 'Urgences médicales traitées dans les hôpitaux';
COMMENT ON TABLE hospital_slots IS 'Créneaux horaires disponibles pour consultations';
COMMENT ON TABLE hospital_analytics IS 'Statistiques quotidiennes des hôpitaux pour analytics';

