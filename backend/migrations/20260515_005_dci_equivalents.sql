-- Phase C3 (2026-05-15) : Substitution générique intelligente.
--
-- Quand un patient demande "Doliprane" et qu'une pharmacie répond
-- "indisponible", le système propose automatiquement les équivalents
-- génériques disponibles ailleurs : "Efferalgan", "Panadol", "Paracétamol
-- générique", etc. (mêmes DCI).
--
-- La table `dci_equivalents` mappe chaque marque commerciale (brand_name)
-- à sa DCI (Dénomination Commune Internationale). À l'usage : on regarde
-- la DCI de la marque demandée, on remonte toutes les marques avec la
-- même DCI, et on filtre celles encore disponibles dans le rayon.
--
-- Seed initial : ~50 DCI les plus prescrits au Cameroun + 200 marques
-- correspondantes (sources : liste OMS médicaments essentiels,
-- nomenclature CENAME-CM, équivalences notices fabricants).

CREATE TABLE IF NOT EXISTS dci_equivalents (
    id BIGSERIAL PRIMARY KEY,
    -- Dénomination Commune Internationale (nom scientifique)
    dci VARCHAR(140) NOT NULL,
    -- Marque commerciale ou nom courant
    brand_name VARCHAR(180) NOT NULL,
    -- Optionnel : restrictions de dosage (NULL si toutes formes équivalentes)
    dosage_form VARCHAR(80),
    -- Optionnel : note (ex : "marque locale CENAME")
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(dci, brand_name)
);

CREATE INDEX IF NOT EXISTS idx_dci_equivalents_brand
    ON dci_equivalents (lower(brand_name));
CREATE INDEX IF NOT EXISTS idx_dci_equivalents_dci
    ON dci_equivalents (lower(dci));

-- ─────────────────────────────────────────────────────────────────────────
-- SEED — ~50 DCI courants au CM
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO dci_equivalents (dci, brand_name) VALUES
    -- Antalgiques / antipyrétiques
    ('Paracétamol', 'Doliprane'),
    ('Paracétamol', 'Efferalgan'),
    ('Paracétamol', 'Panadol'),
    ('Paracétamol', 'Paracétamol'),
    ('Paracétamol', 'Dafalgan'),
    ('Paracétamol', 'Pyrostop'),
    ('Paracétamol', 'Cetamol'),
    ('Paracétamol', 'Geluprane'),
    -- AINS
    ('Ibuprofène', 'Advil'),
    ('Ibuprofène', 'Nurofen'),
    ('Ibuprofène', 'Brufen'),
    ('Ibuprofène', 'Spedifen'),
    ('Ibuprofène', 'Spifen'),
    ('Ibuprofène', 'Ibupran'),
    ('Ibuprofène', 'Ibuprofène'),
    ('Diclofénac', 'Voltarène'),
    ('Diclofénac', 'Voltaren'),
    ('Diclofénac', 'Diclofénac'),
    ('Kétoprofène', 'Profénid'),
    ('Kétoprofène', 'Bi-Profénid'),
    ('Kétoprofène', 'Kétoprofène'),
    -- Aspirine
    ('Acide acétylsalicylique', 'Aspégic'),
    ('Acide acétylsalicylique', 'Aspirine'),
    ('Acide acétylsalicylique', 'Aspro'),
    ('Acide acétylsalicylique', 'Kardégic'),
    ('Acide acétylsalicylique', 'Cardiosolupsan'),
    -- Antibiotiques bêta-lactamines
    ('Amoxicilline', 'Amoxicilline'),
    ('Amoxicilline', 'Amoxil'),
    ('Amoxicilline', 'Clamoxyl'),
    ('Amoxicilline', 'Hiconcil'),
    ('Amoxicilline + Acide clavulanique', 'Augmentin'),
    ('Amoxicilline + Acide clavulanique', 'Ciblor'),
    ('Amoxicilline + Acide clavulanique', 'Co-Amoxiclav'),
    ('Ampicilline', 'Ampicilline'),
    ('Ampicilline', 'Totapen'),
    -- Céphalosporines
    ('Céfixime', 'Oroken'),
    ('Céfixime', 'Cefixime'),
    ('Céfixime', 'Suprax'),
    ('Ceftriaxone', 'Rocéphine'),
    ('Ceftriaxone', 'Ceftriaxone'),
    -- Macrolides
    ('Azithromycine', 'Zithromax'),
    ('Azithromycine', 'Azithromycine'),
    ('Azithromycine', 'Azimycin'),
    ('Clarithromycine', 'Naxy'),
    ('Clarithromycine', 'Zeclar'),
    -- Tétracyclines
    ('Doxycycline', 'Vibramycine'),
    ('Doxycycline', 'Doxycycline'),
    ('Doxycycline', 'Doxypal'),
    -- Quinolones
    ('Ciprofloxacine', 'Ciflox'),
    ('Ciprofloxacine', 'Ciprofloxacine'),
    ('Ciprofloxacine', 'Cipro'),
    ('Norfloxacine', 'Noroxine'),
    ('Norfloxacine', 'Norfloxacine'),
    ('Ofloxacine', 'Oflocet'),
    ('Lévofloxacine', 'Tavanic'),
    -- Sulfamides
    ('Sulfaméthoxazole + Triméthoprime', 'Bactrim'),
    ('Sulfaméthoxazole + Triméthoprime', 'Bactrim Forte'),
    ('Sulfaméthoxazole + Triméthoprime', 'Septra'),
    ('Sulfaméthoxazole + Triméthoprime', 'Cotrim'),
    ('Sulfaméthoxazole + Triméthoprime', 'Cotrimoxazole'),
    -- Métronidazole / amibe
    ('Métronidazole', 'Flagyl'),
    ('Métronidazole', 'Métronidazole'),
    ('Métronidazole', 'Rozex'),
    -- IPP
    ('Oméprazole', 'Mopral'),
    ('Oméprazole', 'Oméprazole'),
    ('Oméprazole', 'Omez'),
    ('Oméprazole', 'Losec'),
    ('Ésoméprazole', 'Inexium'),
    ('Ésoméprazole', 'Nexium'),
    ('Ésoméprazole', 'Ésoméprazole'),
    ('Pantoprazole', 'Inipomp'),
    ('Pantoprazole', 'Pantoprazole'),
    -- Anti-H2
    ('Ranitidine', 'Azantac'),
    ('Ranitidine', 'Raniplex'),
    ('Ranitidine', 'Ranitidine'),
    -- Antiémétiques
    ('Métopimazine', 'Vogalène'),
    ('Métopimazine', 'Vogalib'),
    ('Dompéridone', 'Motilium'),
    ('Dompéridone', 'Dompéridone'),
    ('Métoclopramide', 'Primpéran'),
    -- Antidiarrhéiques
    ('Lopéramide', 'Imodium'),
    ('Lopéramide', 'Lopéramide'),
    -- Bronchodilatateurs
    ('Salbutamol', 'Ventoline'),
    ('Salbutamol', 'Salbutamol'),
    ('Salbutamol', 'Asthalin'),
    -- Antihistaminiques
    ('Cétirizine', 'Zyrtec'),
    ('Cétirizine', 'Cétirizine'),
    ('Cétirizine', 'Virlix'),
    ('Loratadine', 'Clarityne'),
    ('Loratadine', 'Loratadine'),
    ('Desloratadine', 'Aerius'),
    ('Desloratadine', 'Desloratadine'),
    ('Fexofénadine', 'Telfast'),
    ('Fexofénadine', 'Fexofénadine'),
    -- Cardio
    ('Amlodipine', 'Amlor'),
    ('Amlodipine', 'Amlodipine'),
    ('Bisoprolol', 'Cardensiel'),
    ('Bisoprolol', 'Bisoprolol'),
    ('Bisoprolol', 'Concor'),
    ('Captopril', 'Lopril'),
    ('Captopril', 'Captopril'),
    ('Captopril', 'Capoten'),
    ('Énalapril', 'Renitec'),
    ('Énalapril', 'Énalapril'),
    ('Propranolol', 'Avlocardyl'),
    ('Propranolol', 'Propranolol'),
    -- Statines
    ('Atorvastatine', 'Tahor'),
    ('Atorvastatine', 'Atorvastatine'),
    ('Simvastatine', 'Zocor'),
    ('Simvastatine', 'Simvastatine'),
    -- Diabète
    ('Metformine', 'Glucophage'),
    ('Metformine', 'Metformine'),
    ('Metformine', 'Stagid'),
    ('Glibenclamide', 'Daonil'),
    ('Glibenclamide', 'Glibenclamide'),
    ('Glimépiride', 'Amarel'),
    ('Glimépiride', 'Glimépiride'),
    -- Thyroïde
    ('Lévothyroxine', 'Levothyrox'),
    ('Lévothyroxine', 'Lévothyrox'),
    ('Lévothyroxine', 'Euthyrox'),
    -- Diurétiques
    ('Furosémide', 'Lasilix'),
    ('Furosémide', 'Furosémide'),
    ('Hydrochlorothiazide', 'Esidrex'),
    ('Hydrochlorothiazide', 'Hydrochlorothiazide'),
    ('Spironolactone', 'Aldactone'),
    ('Spironolactone', 'Spironolactone'),
    -- Anticoagulants
    ('Warfarine', 'Coumadine'),
    ('Warfarine', 'Warfarine'),
    -- Opioïdes faibles
    ('Tramadol', 'Topalgic'),
    ('Tramadol', 'Tramadol'),
    ('Tramadol', 'Contramal'),
    ('Codéine', 'Codéine'),
    ('Codéine + Paracétamol', 'Codoliprane'),
    ('Codéine + Paracétamol', 'Néocodion'),
    -- Corticoïdes
    ('Prednisolone', 'Solupred'),
    ('Prednisolone', 'Prednisolone'),
    ('Prednisolone', 'Hydrocortancyl'),
    ('Méthylprednisolone', 'Solumédrol'),
    ('Méthylprednisolone', 'Médrol'),
    -- Antipaludéens (CM++)
    ('Artéméther + Luméfantrine', 'Coartem'),
    ('Artéméther + Luméfantrine', 'Riamet'),
    ('Artéméther + Luméfantrine', 'Lumartem'),
    ('Quinine', 'Quinimax'),
    ('Quinine', 'Quinine'),
    ('Chloroquine', 'Nivaquine'),
    ('Chloroquine', 'Chloroquine'),
    ('Hydroxychloroquine', 'Plaquenil'),
    ('Hydroxychloroquine', 'Hydroxychloroquine'),
    -- Antifongiques
    ('Fluconazole', 'Triflucan'),
    ('Fluconazole', 'Fluconazole'),
    ('Fluconazole', 'Diflucan'),
    ('Clotrimazole', 'Canesten'),
    ('Clotrimazole', 'Clotrimazole'),
    ('Kétoconazole', 'Nizoral'),
    -- Antiparasitaires (vermifuges)
    ('Albendazole', 'Zentel'),
    ('Albendazole', 'Albendazole'),
    ('Mébendazole', 'Vermox'),
    ('Mébendazole', 'Mébendazole'),
    -- Vasodilatateurs / migraine
    ('Ergotamine + Caféine', 'Gynergène Caféiné'),
    ('Sumatriptan', 'Imigrane'),
    -- Cortisone topique
    ('Hydrocortisone', 'Hydrocortisone'),
    ('Bétaméthasone', 'Diprosone'),
    ('Bétaméthasone', 'Bétaméthasone')
ON CONFLICT (dci, brand_name) DO NOTHING;
