-- Migration: Tables avancées pour Bourse du Livre avec IA et analytics
-- Date: 2025-01-27
-- Description: Tables pour échanges, recommandations IA, historique prix et analytics
-- Compatible SQLx offline mode

-- Extension PostGIS pour géolocalisation (déjà créée normalement)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- 1. TABLE : Échanges de livres (historique et tracking)
-- ============================================================================
-- Protection: Vérifier que la table livres_scolaires existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'livres_scolaires') THEN
        CREATE TABLE IF NOT EXISTS book_exchanges (
            id SERIAL PRIMARY KEY,
            livre_offert_id INTEGER NOT NULL REFERENCES livres_scolaires(id) ON DELETE CASCADE,
            livre_souhaite_id INTEGER NOT NULL REFERENCES livres_scolaires(id) ON DELETE CASCADE,
    initiateur_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    troc_id INTEGER REFERENCES troc_livres_scolaires(id) ON DELETE SET NULL,
    
    -- Type d'échange
    exchange_type VARCHAR(50) NOT NULL CHECK (exchange_type IN ('troc', 'achat', 'vente', 'don')),
    prix_negocie DECIMAL(10, 2), -- Prix négocié si achat/vente
    
    -- Statut
    statut VARCHAR(50) NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'accepte', 'refuse', 'complete', 'annule')),
    
    -- Évaluation
    rating_initiateur INTEGER CHECK (rating_initiateur >= 1 AND rating_initiateur <= 5),
    rating_participant INTEGER CHECK (rating_participant >= 1 AND rating_participant <= 5),
    comment_initiateur TEXT,
    comment_participant TEXT,
    
    -- Dates
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_echange TIMESTAMPTZ, -- Date prévue pour l'échange
    date_complete TIMESTAMPTZ -- Date de finalisation
    
            -- Contraintes
            -- CONSTRAINT unique_exchange UNIQUE (livre_offert_id, livre_souhaite_id, initiateur_id, participant_id)
        );

        CREATE INDEX IF NOT EXISTS idx_book_exchanges_livre_offert ON book_exchanges(livre_offert_id);
        CREATE INDEX IF NOT EXISTS idx_book_exchanges_livre_souhaite ON book_exchanges(livre_souhaite_id);
        CREATE INDEX IF NOT EXISTS idx_book_exchanges_initiateur ON book_exchanges(initiateur_id, statut);
        CREATE INDEX IF NOT EXISTS idx_book_exchanges_participant ON book_exchanges(participant_id, statut);
        CREATE INDEX IF NOT EXISTS idx_book_exchanges_statut ON book_exchanges(statut, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_book_exchanges_troc ON book_exchanges(troc_id) WHERE troc_id IS NOT NULL;
    END IF;
END $$;

-- ============================================================================
-- 2. TABLE : Recommandations IA de livres
-- ============================================================================
-- Protection: Vérifier que la table livres_scolaires existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'livres_scolaires') THEN
        CREATE TABLE IF NOT EXISTS book_recommendations (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            livre_id INTEGER REFERENCES livres_scolaires(id) ON DELETE CASCADE,
    
    -- Critères de recommandation
    classe_actuelle TEXT,
    classe_souhaitee TEXT,
    matiere TEXT,
    niveau TEXT,
    
    -- Résultats IA
    score_recommendation DECIMAL(5, 2) NOT NULL, -- Score 0-100
    reasoning TEXT, -- Explication de la recommandation
    alternative_books INTEGER[], -- IDs de livres alternatifs
    
    -- Métadonnées
    model_used VARCHAR(100), -- Modèle IA utilisé
    tokens_consumed INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL -- Expiration du cache
    
            -- Contraintes
            -- CONSTRAINT unique_recommendation UNIQUE (user_id, livre_id, classe_actuelle, classe_souhaitee, matiere)
        );

        CREATE INDEX IF NOT EXISTS idx_book_recommendations_user ON book_recommendations(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_book_recommendations_livre ON book_recommendations(livre_id);
        CREATE INDEX IF NOT EXISTS idx_book_recommendations_score ON book_recommendations(score_recommendation DESC);
        -- Index sur expires_at pour les requêtes de filtrage
        -- Note: Les index partiels avec NOW() ne sont pas supportés (fonction non-IMMUTABLE)
        -- Le filtrage WHERE expires_at > NOW() sera fait dans les requêtes SQL
        CREATE INDEX IF NOT EXISTS idx_book_recommendations_expires ON book_recommendations(expires_at);
    END IF;
END $$;

-- ============================================================================
-- 3. TABLE : Historique des prix (pour suggestions prix IA)
-- ============================================================================
-- Protection: Vérifier que la table livres_scolaires existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'livres_scolaires') THEN
        CREATE TABLE IF NOT EXISTS book_price_history (
            id SERIAL PRIMARY KEY,
            livre_id INTEGER REFERENCES livres_scolaires(id) ON DELETE CASCADE,
    
    -- Informations livre
    titre TEXT NOT NULL,
    auteur TEXT,
    editeur TEXT,
    isbn TEXT,
    classe TEXT,
    matiere TEXT,
    etat_livre TEXT,
    
    -- Prix
    prix_vente DECIMAL(10, 2) NOT NULL,
    prix_achat DECIMAL(10, 2), -- Prix d'achat si disponible
    devise VARCHAR(10) DEFAULT 'XAF',
    
    -- Source
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('echange', 'achat', 'vente', 'estimation_ia', 'marche')),
    source_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Localisation
    ville TEXT,
    quartier TEXT,
    gps TEXT,
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            is_verified BOOLEAN DEFAULT false -- Prix vérifié par admin
        );

        CREATE INDEX IF NOT EXISTS idx_book_price_history_livre ON book_price_history(livre_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_book_price_history_isbn ON book_price_history(isbn) WHERE isbn IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_book_price_history_classe_matiere ON book_price_history(classe, matiere);
        CREATE INDEX IF NOT EXISTS idx_book_price_history_ville ON book_price_history(ville, quartier);
        CREATE INDEX IF NOT EXISTS idx_book_price_history_date ON book_price_history(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_book_price_history_verified ON book_price_history(is_verified, created_at DESC) WHERE is_verified = true;
    END IF;
END $$;

-- ============================================================================
-- 4. TABLE : Analytics Bourse du Livre
-- ============================================================================
-- Protection: Vérifier que la table livres_scolaires existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'livres_scolaires') THEN
        CREATE TABLE IF NOT EXISTS book_analytics (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            livre_id INTEGER REFERENCES livres_scolaires(id) ON DELETE CASCADE,
    
    -- Métriques
    nombre_vues INTEGER DEFAULT 0,
    nombre_contacts INTEGER DEFAULT 0,
    nombre_echanges_completes INTEGER DEFAULT 0,
    nombre_echanges_annules INTEGER DEFAULT 0,
    
    -- Scores
    score_popularite DECIMAL(5, 2) DEFAULT 0, -- Score de popularité (0-100)
    score_satisfaction DECIMAL(5, 2), -- Score moyen de satisfaction (1-5)
    
    -- Démographie
    repartition_classes JSONB, -- {"6ème": 10, "5ème": 25, ...}
    repartition_villes JSONB, -- {"Douala": 15, "Yaoundé": 20, ...}
    
    -- Période
    periode_debut DATE NOT NULL,
    periode_fin DATE NOT NULL,
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
            -- Contraintes
            CONSTRAINT unique_analytics UNIQUE (user_id, livre_id, periode_debut, periode_fin)
        );

        CREATE INDEX IF NOT EXISTS idx_book_analytics_user ON book_analytics(user_id, periode_debut DESC);
        CREATE INDEX IF NOT EXISTS idx_book_analytics_livre ON book_analytics(livre_id, periode_debut DESC);
        CREATE INDEX IF NOT EXISTS idx_book_analytics_periode ON book_analytics(periode_debut, periode_fin);
    END IF;
END $$;

-- ============================================================================
-- TRIGGERS POUR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_book_exchanges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Protection: Vérifier que la table existe avant de créer le trigger
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'book_exchanges') THEN
        DROP TRIGGER IF EXISTS trigger_update_book_exchanges_updated_at ON book_exchanges;
        CREATE TRIGGER trigger_update_book_exchanges_updated_at
        BEFORE UPDATE ON book_exchanges
        FOR EACH ROW
        EXECUTE FUNCTION update_book_exchanges_updated_at();
    END IF;
END $$;

CREATE OR REPLACE FUNCTION update_book_analytics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Protection: Vérifier que la table existe avant de créer le trigger
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'book_analytics') THEN
        DROP TRIGGER IF EXISTS trigger_update_book_analytics_updated_at ON book_analytics;
        CREATE TRIGGER trigger_update_book_analytics_updated_at
        BEFORE UPDATE ON book_analytics
        FOR EACH ROW
        EXECUTE FUNCTION update_book_analytics_updated_at();
    END IF;
END $$;

-- ============================================================================
-- FONCTIONS UTILITAIRES
-- ============================================================================

-- Fonction pour calculer le prix moyen suggéré pour un livre
CREATE OR REPLACE FUNCTION calculate_suggested_price(
    p_livre_id INTEGER,
    p_ville TEXT DEFAULT NULL,
    p_etat_livre TEXT DEFAULT NULL
) RETURNS DECIMAL(10, 2) AS $$
DECLARE
    v_avg_price DECIMAL(10, 2);
BEGIN
    SELECT AVG(prix_vente) INTO v_avg_price
    FROM book_price_history
    WHERE livre_id = p_livre_id
        AND is_verified = true
        AND created_at >= NOW() - INTERVAL '6 months'
        AND (p_ville IS NULL OR ville = p_ville)
        AND (p_etat_livre IS NULL OR etat_livre = p_etat_livre);
    
    RETURN COALESCE(v_avg_price, 0);
END;
$$ LANGUAGE plpgsql;

-- Fonction pour nettoyer les recommandations expirées
CREATE OR REPLACE FUNCTION cleanup_expired_recommendations()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM book_recommendations
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

-- Commentaires (protégés)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'book_exchanges') THEN
        COMMENT ON TABLE book_exchanges IS 'Historique et tracking des échanges de livres (troc, achat, vente, don)';
        COMMENT ON COLUMN book_exchanges.exchange_type IS 'Type d''échange: troc, achat, vente, don';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'book_recommendations') THEN
        COMMENT ON TABLE book_recommendations IS 'Recommandations IA de livres avec scores et reasoning';
        COMMENT ON COLUMN book_recommendations.score_recommendation IS 'Score de recommandation IA (0-100)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'book_price_history') THEN
        COMMENT ON TABLE book_price_history IS 'Historique des prix pour suggestions prix IA basées sur marché';
        COMMENT ON COLUMN book_price_history.source_type IS 'Source du prix: echange, achat, vente, estimation_ia, marche';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'book_analytics') THEN
        COMMENT ON TABLE book_analytics IS 'Analytics pour prestataires : vues, contacts, échanges, popularité';
        COMMENT ON COLUMN book_analytics.score_popularite IS 'Score de popularité calculé (0-100)';
    END IF;
END $$;

