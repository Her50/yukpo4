-- Migration: Tables avancées pour Laboratoires/Imagerie
-- Date: 2025-01-27
-- Description: Tables pour examens, types d'examens et analytics
-- Compatible SQLx offline mode

-- ============================================================================
-- 1. TABLE : Types d'examens proposés par laboratoire
-- ============================================================================
CREATE TABLE IF NOT EXISTS lab_examination_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL, -- Nom de l'examen (ex: "Numération formule sanguine")
    category VARCHAR(100), -- Catégorie (ex: "blood", "imaging", "urine", "stool")
    price DECIMAL(10,2) NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 15, -- Durée estimée de l'examen
    requires_preparation BOOLEAN DEFAULT FALSE,
    preparation_instructions TEXT, -- Instructions de préparation (ex: "Jeûne 12h")
    description TEXT, -- Description détaillée
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(lab_id, name) -- Un examen unique par laboratoire
);

CREATE INDEX IF NOT EXISTS idx_lab_examination_types_lab ON lab_examination_types(lab_id);
CREATE INDEX IF NOT EXISTS idx_lab_examination_types_category ON lab_examination_types(category);
CREATE INDEX IF NOT EXISTS idx_lab_examination_types_available ON lab_examination_types(is_available) WHERE is_available = TRUE;

-- ============================================================================
-- 2. TABLE : Examens médicaux réalisés
-- ============================================================================
CREATE TABLE IF NOT EXISTS lab_examinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    examination_type_id UUID REFERENCES lab_examination_types(id) ON DELETE SET NULL,
    examination_type_name VARCHAR(200) NOT NULL, -- Nom (copié pour historique)
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_date TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'failed')),
    preparation_instructions TEXT, -- Instructions données au patient
    preparation_completed BOOLEAN DEFAULT FALSE, -- Le patient a-t-il suivi les instructions ?
    results JSONB, -- Résultats de l'examen (structure variable selon type)
    ai_analysis JSONB, -- Analyse IA des résultats (détection anomalies, interprétation)
    ai_confidence DECIMAL(5,2), -- Niveau de confiance de l'IA (0-100)
    interpretation TEXT, -- Interprétation des résultats par le médecin
    doctor_notes TEXT, -- Notes du médecin
    examination_fee DECIMAL(10,2),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
    completed_at TIMESTAMPTZ, -- Date de fin d'examen
    results_available_at TIMESTAMPTZ, -- Date de disponibilité des résultats
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_examinations_lab ON lab_examinations(lab_id);
CREATE INDEX IF NOT EXISTS idx_lab_examinations_user ON lab_examinations(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_examinations_type ON lab_examinations(examination_type_id);
CREATE INDEX IF NOT EXISTS idx_lab_examinations_status ON lab_examinations(status);
CREATE INDEX IF NOT EXISTS idx_lab_examinations_date ON lab_examinations(appointment_date);
CREATE INDEX IF NOT EXISTS idx_lab_examinations_results_available ON lab_examinations(results_available_at) WHERE results IS NOT NULL;

-- ============================================================================
-- 3. TABLE : Analytics des laboratoires
-- ============================================================================
CREATE TABLE IF NOT EXISTS lab_analytics (
    id SERIAL PRIMARY KEY,
    lab_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    -- Métriques examens
    total_examinations INTEGER DEFAULT 0,
    completed_examinations INTEGER DEFAULT 0,
    cancelled_examinations INTEGER DEFAULT 0,
    -- Métriques par catégorie
    blood_examinations INTEGER DEFAULT 0,
    imaging_examinations INTEGER DEFAULT 0,
    other_examinations INTEGER DEFAULT 0,
    -- Métriques revenus
    total_revenue DECIMAL(10,2) DEFAULT 0,
    -- Métriques temps
    avg_processing_time_minutes DECIMAL(10,2), -- Temps moyen de traitement
    avg_results_time_hours DECIMAL(10,2), -- Temps moyen avant disponibilité résultats
    -- Métriques IA
    ai_analyses_count INTEGER DEFAULT 0, -- Nombre d'analyses IA effectuées
    anomalies_detected INTEGER DEFAULT 0, -- Nombre d'anomalies détectées
    -- Satisfaction
    avg_rating DECIMAL(3,2), -- Note moyenne sur 5
    total_ratings INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(lab_id, date)
);

CREATE INDEX IF NOT EXISTS idx_lab_analytics_lab ON lab_analytics(lab_id);
CREATE INDEX IF NOT EXISTS idx_lab_analytics_date ON lab_analytics(date);

-- ============================================================================
-- 4. FONCTIONS : Calcul automatique des statistiques
-- ============================================================================

-- Fonction pour calculer le temps moyen de traitement
CREATE OR REPLACE FUNCTION calculate_lab_avg_processing_time(lab_id_param INTEGER, date_param DATE DEFAULT CURRENT_DATE)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    avg_time DECIMAL(10,2);
BEGIN
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - appointment_date)) / 60), 0)
    INTO avg_time
    FROM lab_examinations
    WHERE lab_id = lab_id_param
        AND DATE(appointment_date) = date_param
        AND completed_at IS NOT NULL
        AND status = 'completed';
    
    RETURN ROUND(avg_time, 2);
END;
$$ LANGUAGE plpgsql;

-- Fonction pour calculer le temps moyen avant disponibilité des résultats
CREATE OR REPLACE FUNCTION calculate_lab_avg_results_time(lab_id_param INTEGER, date_param DATE DEFAULT CURRENT_DATE)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    avg_time DECIMAL(10,2);
BEGIN
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (results_available_at - completed_at)) / 3600), 0)
    INTO avg_time
    FROM lab_examinations
    WHERE lab_id = lab_id_param
        AND DATE(completed_at) = date_param
        AND results_available_at IS NOT NULL
        AND completed_at IS NOT NULL
        AND status = 'completed';
    
    RETURN ROUND(avg_time, 2);
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE lab_examination_types IS 'Types d''examens proposés par chaque laboratoire';
COMMENT ON TABLE lab_examinations IS 'Examens médicaux réalisés dans les laboratoires';
COMMENT ON TABLE lab_analytics IS 'Statistiques quotidiennes des laboratoires pour analytics';





