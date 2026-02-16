-- ✅ Migration 2026-02-16: Correction des noms complets dupliqués
-- 
-- Cette migration corrige les noms complets qui contiennent des duplications
-- comme "LELE Hernandez LELE Hernandez" -> "LELE Hernandez"
--
-- Elle normalise aussi les noms complets à partir de nom et prenom si nécessaire

-- Fonction SQL pour normaliser un nom complet (équivalent à normalize_full_name en Rust)
CREATE OR REPLACE FUNCTION normalize_full_name_sql(input_name TEXT)
RETURNS TEXT AS $$
DECLARE
    words TEXT[];
    normalized_words TEXT[];
    i INT;
    current_word TEXT;
    last_word TEXT;
BEGIN
    -- Si le nom est vide ou NULL, retourner une chaîne vide
    IF input_name IS NULL OR TRIM(input_name) = '' THEN
        RETURN '';
    END IF;

    -- Diviser en mots, supprimer les espaces multiples
    words := string_to_array(TRIM(input_name), ' ');
    
    -- Filtrer les mots vides
    words := array_remove(words, '');

    -- Si aucun mot, retourner vide
    IF array_length(words, 1) IS NULL THEN
        RETURN '';
    END IF;

    -- Supprimer les duplications consécutives (insensible à la casse)
    last_word := '';
    FOR i IN 1..array_length(words, 1) LOOP
        current_word := words[i];
        
        -- Ne pas ajouter si c'est le même mot que le précédent (insensible à la casse)
        IF last_word = '' OR LOWER(current_word) != LOWER(last_word) THEN
            normalized_words := array_append(normalized_words, current_word);
            last_word := current_word;
        END IF;
    END LOOP;

    -- Rejoindre avec un seul espace
    RETURN array_to_string(normalized_words, ' ');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction pour construire nom_complet à partir de nom, prenom et nom_complet existant
CREATE OR REPLACE FUNCTION build_full_name_sql(
    p_nom TEXT,
    p_prenom TEXT,
    p_nom_complet TEXT
)
RETURNS TEXT AS $$
DECLARE
    nom_trimmed TEXT;
    prenom_trimmed TEXT;
    nom_complet_trimmed TEXT;
    result TEXT;
BEGIN
    -- Priorité 1: Utiliser nom_complet si fourni et non vide
    IF p_nom_complet IS NOT NULL AND TRIM(p_nom_complet) != '' THEN
        RETURN normalize_full_name_sql(p_nom_complet);
    END IF;

    -- Priorité 2: Construire à partir de nom et prenom
    nom_trimmed := NULLIF(TRIM(p_nom), '');
    prenom_trimmed := NULLIF(TRIM(p_prenom), '');

    IF nom_trimmed IS NOT NULL AND prenom_trimmed IS NOT NULL THEN
        -- Construire "prenom nom" et normaliser
        result := normalize_full_name_sql(prenom_trimmed || ' ' || nom_trimmed);
        RETURN result;
    ELSIF nom_trimmed IS NOT NULL THEN
        RETURN normalize_full_name_sql(nom_trimmed);
    ELSIF prenom_trimmed IS NOT NULL THEN
        RETURN normalize_full_name_sql(prenom_trimmed);
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ✅ CORRECTION 1: Normaliser tous les nom_complet existants qui ont des duplications
UPDATE users
SET nom_complet = normalize_full_name_sql(nom_complet)
WHERE nom_complet IS NOT NULL
  AND nom_complet != normalize_full_name_sql(nom_complet);

-- ✅ CORRECTION 2: Reconstruire nom_complet à partir de nom et prenom pour les cas où
-- nom_complet est NULL ou vide mais nom et prenom existent
UPDATE users
SET nom_complet = build_full_name_sql(nom, prenom, nom_complet)
WHERE (nom_complet IS NULL OR TRIM(nom_complet) = '')
  AND (nom IS NOT NULL OR prenom IS NOT NULL)
  AND (TRIM(COALESCE(nom, '')) != '' OR TRIM(COALESCE(prenom, '')) != '');

-- ✅ CORRECTION 3: Reconstruire nom_complet si nom ou prenom ont été mis à jour
-- mais que nom_complet n'a pas été recalculé (cas où nom_complet contient des duplications)
UPDATE users
SET nom_complet = build_full_name_sql(nom, prenom, nom_complet)
WHERE (nom IS NOT NULL OR prenom IS NOT NULL)
  AND (TRIM(COALESCE(nom, '')) != '' OR TRIM(COALESCE(prenom, '')) != '')
  AND (
    -- Si nom_complet ne correspond pas à la construction attendue
    nom_complet IS NULL
    OR nom_complet != build_full_name_sql(nom, prenom, nom_complet)
  );

-- ✅ TRIGGER: Normaliser automatiquement nom_complet lors des INSERT/UPDATE
CREATE OR REPLACE FUNCTION normalize_users_nom_complet()
RETURNS TRIGGER AS $$
BEGIN
    -- Si nom ou prenom sont modifiés, reconstruire nom_complet
    IF (TG_OP = 'UPDATE' AND (OLD.nom IS DISTINCT FROM NEW.nom OR OLD.prenom IS DISTINCT FROM NEW.prenom))
       OR (TG_OP = 'INSERT' AND (NEW.nom IS NOT NULL OR NEW.prenom IS NOT NULL)) THEN
        NEW.nom_complet := build_full_name_sql(NEW.nom, NEW.prenom, NEW.nom_complet);
    ELSIF NEW.nom_complet IS NOT NULL AND TRIM(NEW.nom_complet) != '' THEN
        -- Sinon, normaliser le nom_complet fourni directement
        NEW.nom_complet := normalize_full_name_sql(NEW.nom_complet);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger s'il n'existe pas déjà
DROP TRIGGER IF EXISTS trigger_normalize_users_nom_complet ON users;
CREATE TRIGGER trigger_normalize_users_nom_complet
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION normalize_users_nom_complet();

-- Index pour améliorer les performances des recherches par nom_complet
CREATE INDEX IF NOT EXISTS idx_users_nom_complet_normalized 
ON users (LOWER(TRIM(nom_complet)))
WHERE nom_complet IS NOT NULL;

-- Commentaire sur la fonction
COMMENT ON FUNCTION normalize_full_name_sql(TEXT) IS 
'Normalise un nom complet en supprimant les duplications consécutives et les espaces multiples. Exemple: "LELE  Hernandez LELE  Hernandez" -> "LELE Hernandez"';

COMMENT ON FUNCTION build_full_name_sql(TEXT, TEXT, TEXT) IS 
'Construit un nom_complet à partir de nom, prenom et nom_complet existant en évitant les duplications. Priorité: nom_complet > prenom + nom > nom seul > prenom seul';

COMMENT ON FUNCTION normalize_users_nom_complet() IS 
'Trigger qui normalise automatiquement nom_complet lors des INSERT/UPDATE pour éviter les duplications';

