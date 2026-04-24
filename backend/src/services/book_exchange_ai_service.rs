//! ✅ Service IA pour Bourse du Livre
//!
//! Ce service utilise l'IA pour :
//! - Recommander des livres basés sur classe/matière
//! - Matching intelligent besoins/offres
//! - Suggestions prix basées sur marché
//! - Analyse de compatibilité échanges

use crate::core::types::AppResult;
use crate::models::livre_scolaire::ProgrammeScolaire;
use crate::services::app_ia::AppIA;
use crate::services::ia::prompt_loader::load_prompt_section_with_vars;
use redis::Client as RedisClient;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::str::FromStr;
use std::sync::Arc;

// ============================================================================
// SYSTÈMES SCOLAIRES MULTI-PAYS
// ============================================================================

/// Représente un système scolaire avec sa hiérarchie de classes
pub struct SchoolSystem {
    pub code: &'static str,
    pub name: &'static str,
    pub language: &'static str,
    pub currency: &'static str,
    /// (normalized_class, next_class, level_label) — next_class="" si dernière classe
    pub hierarchy: &'static [(&'static str, &'static str, &'static str)],
}

/// Tous les systèmes scolaires supportés (25 systèmes — couverture mondiale)
pub fn get_all_school_systems() -> Vec<&'static SchoolSystem> {
    vec![
        // Afrique
        &SYSTEM_CAMEROUN_FR,
        &SYSTEM_CAMEROUN_EN,
        &SYSTEM_NIGERIA,
        &SYSTEM_FRANCOPHONE_WEST,
        &SYSTEM_RDC,
        &SYSTEM_GHANA,
        &SYSTEM_KENYA,
        &SYSTEM_SOUTH_AFRICA,
        &SYSTEM_ETHIOPIA,
        &SYSTEM_NORTH_AFRICA_FR,
        &SYSTEM_EGYPT,
        // Europe
        &SYSTEM_FRANCE,
        &SYSTEM_UK,
        &SYSTEM_GERMANY,
        &SYSTEM_SPAIN,
        // Amériques
        &SYSTEM_USA,
        &SYSTEM_BRAZIL,
        &SYSTEM_MEXICO,
        // Asie
        &SYSTEM_INDIA,
        &SYSTEM_CHINA,
        &SYSTEM_JAPAN,
        &SYSTEM_INDONESIA,
        &SYSTEM_PHILIPPINES,
        // Moyen-Orient
        &SYSTEM_TURKEY,
        &SYSTEM_ARAB_GULF,
    ]
}

// -- Cameroun Francophone --
static SYSTEM_CAMEROUN_FR: SchoolSystem = SchoolSystem {
    code: "cm_fr",
    name: "Cameroun (Francophone)",
    language: "fr",
    currency: "XAF",
    hierarchy: &[
        ("sil", "CP", "Primaire"),
        ("cp", "CE1", "Primaire"),
        ("ce1", "CE2", "Primaire"),
        ("ce2", "CM1", "Primaire"),
        ("cm1", "CM2", "Primaire"),
        ("cm2", "6ème", "Primaire"),
        ("6ème", "5ème", "Collège"),
        ("6eme", "5ème", "Collège"),
        ("5ème", "4ème", "Collège"),
        ("5eme", "4ème", "Collège"),
        ("4ème", "3ème", "Collège"),
        ("4eme", "3ème", "Collège"),
        ("3ème", "Seconde", "Collège"),
        ("3eme", "Seconde", "Collège"),
        ("seconde", "Première", "Lycée"),
        ("2nde", "Première", "Lycée"),
        ("première", "Terminale", "Lycée"),
        ("premiere", "Terminale", "Lycée"),
        ("1ère", "Terminale", "Lycée"),
        ("1ere", "Terminale", "Lycée"),
        ("terminale", "", "Lycée"),
        ("tle", "", "Lycée"),
    ],
};

// -- Cameroun Anglophone (GCE system) --
static SYSTEM_CAMEROUN_EN: SchoolSystem = SchoolSystem {
    code: "cm_en",
    name: "Cameroon (Anglophone/GCE)",
    language: "en",
    currency: "XAF",
    hierarchy: &[
        ("class 1", "Class 2", "Primary"),
        ("class1", "Class 2", "Primary"),
        ("class 2", "Class 3", "Primary"),
        ("class2", "Class 3", "Primary"),
        ("class 3", "Class 4", "Primary"),
        ("class3", "Class 4", "Primary"),
        ("class 4", "Class 5", "Primary"),
        ("class4", "Class 5", "Primary"),
        ("class 5", "Class 6", "Primary"),
        ("class5", "Class 6", "Primary"),
        ("class 6", "Form 1", "Primary"),
        ("class6", "Form 1", "Primary"),
        ("form 1", "Form 2", "Secondary"),
        ("form1", "Form 2", "Secondary"),
        ("form 2", "Form 3", "Secondary"),
        ("form2", "Form 3", "Secondary"),
        ("form 3", "Form 4", "Secondary"),
        ("form3", "Form 4", "Secondary"),
        ("form 4", "Form 5", "Secondary"),
        ("form4", "Form 5", "Secondary"),
        ("form 5", "Lower Sixth", "Secondary"),
        ("form5", "Lower Sixth", "Secondary"),
        ("lower sixth", "Upper Sixth", "High School"),
        ("lower 6th", "Upper Sixth", "High School"),
        ("upper sixth", "", "High School"),
        ("upper 6th", "", "High School"),
    ],
};

// -- Nigeria --
static SYSTEM_NIGERIA: SchoolSystem = SchoolSystem {
    code: "ng",
    name: "Nigeria",
    language: "en",
    currency: "NGN",
    hierarchy: &[
        ("primary 1", "Primary 2", "Primary"),
        ("p1", "Primary 2", "Primary"),
        ("primary 2", "Primary 3", "Primary"),
        ("p2", "Primary 3", "Primary"),
        ("primary 3", "Primary 4", "Primary"),
        ("p3", "Primary 4", "Primary"),
        ("primary 4", "Primary 5", "Primary"),
        ("p4", "Primary 5", "Primary"),
        ("primary 5", "Primary 6", "Primary"),
        ("p5", "Primary 6", "Primary"),
        ("primary 6", "JSS 1", "Primary"),
        ("p6", "JSS 1", "Primary"),
        ("jss 1", "JSS 2", "Junior Secondary"),
        ("jss1", "JSS 2", "Junior Secondary"),
        ("jss 2", "JSS 3", "Junior Secondary"),
        ("jss2", "JSS 3", "Junior Secondary"),
        ("jss 3", "SSS 1", "Junior Secondary"),
        ("jss3", "SSS 1", "Junior Secondary"),
        ("sss 1", "SSS 2", "Senior Secondary"),
        ("sss1", "SSS 2", "Senior Secondary"),
        ("sss 2", "SSS 3", "Senior Secondary"),
        ("sss2", "SSS 3", "Senior Secondary"),
        ("sss 3", "", "Senior Secondary"),
        ("sss3", "", "Senior Secondary"),
    ],
};

// -- Afrique francophone (Sénégal, Côte d'Ivoire, Gabon, Togo, Bénin, Burkina, Mali, Niger, Guinée, Congo-Brazza) --
static SYSTEM_FRANCOPHONE_WEST: SchoolSystem = SchoolSystem {
    code: "fr_west",
    name: "Afrique Francophone (Sénégal, Côte d'Ivoire, Gabon, etc.)",
    language: "fr",
    currency: "XOF",
    hierarchy: &[
        ("ci", "CP", "Primaire"),
        ("cp", "CE1", "Primaire"),
        ("ce1", "CE2", "Primaire"),
        ("ce2", "CM1", "Primaire"),
        ("cm1", "CM2", "Primaire"),
        ("cm2", "6ème", "Primaire"),
        ("6ème", "5ème", "Collège"),
        ("6eme", "5ème", "Collège"),
        ("5ème", "4ème", "Collège"),
        ("5eme", "4ème", "Collège"),
        ("4ème", "3ème", "Collège"),
        ("4eme", "3ème", "Collège"),
        ("3ème", "Seconde", "Collège"),
        ("3eme", "Seconde", "Collège"),
        ("seconde", "Première", "Lycée"),
        ("2nde", "Première", "Lycée"),
        ("première", "Terminale", "Lycée"),
        ("premiere", "Terminale", "Lycée"),
        ("1ère", "Terminale", "Lycée"),
        ("1ere", "Terminale", "Lycée"),
        ("terminale", "", "Lycée"),
        ("tle", "", "Lycée"),
    ],
};

// -- RDC (République Démocratique du Congo) --
static SYSTEM_RDC: SchoolSystem = SchoolSystem {
    code: "cd",
    name: "RDC (Congo Kinshasa)",
    language: "fr",
    currency: "CDF",
    hierarchy: &[
        ("1ère primaire", "2ème primaire", "Primaire"),
        ("1ere primaire", "2ème primaire", "Primaire"),
        ("2ème primaire", "3ème primaire", "Primaire"),
        ("2eme primaire", "3ème primaire", "Primaire"),
        ("3ème primaire", "4ème primaire", "Primaire"),
        ("3eme primaire", "4ème primaire", "Primaire"),
        ("4ème primaire", "5ème primaire", "Primaire"),
        ("4eme primaire", "5ème primaire", "Primaire"),
        ("5ème primaire", "6ème primaire", "Primaire"),
        ("5eme primaire", "6ème primaire", "Primaire"),
        ("6ème primaire", "1ère secondaire", "Primaire"),
        ("6eme primaire", "1ère secondaire", "Primaire"),
        ("1ère secondaire", "2ème secondaire", "Secondaire"),
        ("1ere secondaire", "2ème secondaire", "Secondaire"),
        ("2ème secondaire", "3ème secondaire", "Secondaire"),
        ("2eme secondaire", "3ème secondaire", "Secondaire"),
        ("3ème secondaire", "4ème secondaire", "Secondaire"),
        ("3eme secondaire", "4ème secondaire", "Secondaire"),
        ("4ème secondaire", "5ème secondaire", "Secondaire"),
        ("4eme secondaire", "5ème secondaire", "Secondaire"),
        ("5ème secondaire", "6ème secondaire", "Secondaire"),
        ("5eme secondaire", "6ème secondaire", "Secondaire"),
        ("6ème secondaire", "", "Secondaire"),
        ("6eme secondaire", "", "Secondaire"),
    ],
};

// -- Ghana --
static SYSTEM_GHANA: SchoolSystem = SchoolSystem {
    code: "gh",
    name: "Ghana",
    language: "en",
    currency: "GHS",
    hierarchy: &[
        ("primary 1", "Primary 2", "Primary"),
        ("p1", "Primary 2", "Primary"),
        ("primary 2", "Primary 3", "Primary"),
        ("p2", "Primary 3", "Primary"),
        ("primary 3", "Primary 4", "Primary"),
        ("p3", "Primary 4", "Primary"),
        ("primary 4", "Primary 5", "Primary"),
        ("p4", "Primary 5", "Primary"),
        ("primary 5", "Primary 6", "Primary"),
        ("p5", "Primary 6", "Primary"),
        ("primary 6", "JHS 1", "Primary"),
        ("p6", "JHS 1", "Primary"),
        ("jhs 1", "JHS 2", "Junior High"),
        ("jhs1", "JHS 2", "Junior High"),
        ("jhs 2", "JHS 3", "Junior High"),
        ("jhs2", "JHS 3", "Junior High"),
        ("jhs 3", "SHS 1", "Junior High"),
        ("jhs3", "SHS 1", "Junior High"),
        ("shs 1", "SHS 2", "Senior High"),
        ("shs1", "SHS 2", "Senior High"),
        ("shs 2", "SHS 3", "Senior High"),
        ("shs2", "SHS 3", "Senior High"),
        ("shs 3", "", "Senior High"),
        ("shs3", "", "Senior High"),
    ],
};

// -- Kenya / East Africa --
static SYSTEM_KENYA: SchoolSystem = SchoolSystem {
    code: "ke",
    name: "Kenya / East Africa",
    language: "en",
    currency: "KES",
    hierarchy: &[
        ("standard 1", "Standard 2", "Primary"),
        ("std 1", "Standard 2", "Primary"),
        ("standard 2", "Standard 3", "Primary"),
        ("std 2", "Standard 3", "Primary"),
        ("standard 3", "Standard 4", "Primary"),
        ("std 3", "Standard 4", "Primary"),
        ("standard 4", "Standard 5", "Primary"),
        ("std 4", "Standard 5", "Primary"),
        ("standard 5", "Standard 6", "Primary"),
        ("std 5", "Standard 6", "Primary"),
        ("standard 6", "Standard 7", "Primary"),
        ("std 6", "Standard 7", "Primary"),
        ("standard 7", "Standard 8", "Primary"),
        ("std 7", "Standard 8", "Primary"),
        ("standard 8", "Form 1", "Primary"),
        ("std 8", "Form 1", "Primary"),
        ("form 1", "Form 2", "Secondary"),
        ("form1", "Form 2", "Secondary"),
        ("form 2", "Form 3", "Secondary"),
        ("form2", "Form 3", "Secondary"),
        ("form 3", "Form 4", "Secondary"),
        ("form3", "Form 4", "Secondary"),
        ("form 4", "", "Secondary"),
        ("form4", "", "Secondary"),
    ],
};

// -- Afrique du Sud --
static SYSTEM_SOUTH_AFRICA: SchoolSystem = SchoolSystem {
    code: "za",
    name: "South Africa",
    language: "en",
    currency: "ZAR",
    hierarchy: &[
        ("grade r", "Grade 1", "Foundation Phase"),
        ("grade 1", "Grade 2", "Foundation Phase"),
        ("grade 2", "Grade 3", "Foundation Phase"),
        ("grade 3", "Grade 4", "Foundation Phase"),
        ("grade 4", "Grade 5", "Intermediate Phase"),
        ("grade 5", "Grade 6", "Intermediate Phase"),
        ("grade 6", "Grade 7", "Intermediate Phase"),
        ("grade 7", "Grade 8", "Senior Phase"),
        ("grade 8", "Grade 9", "Senior Phase"),
        ("grade 9", "Grade 10", "Senior Phase"),
        ("grade 10", "Grade 11", "FET Phase"),
        ("grade 11", "Grade 12", "FET Phase"),
        ("grade 12", "", "FET Phase"),
    ],
};

// -- Éthiopie --
static SYSTEM_ETHIOPIA: SchoolSystem = SchoolSystem {
    code: "et",
    name: "Ethiopia",
    language: "en",
    currency: "ETB",
    hierarchy: &[
        ("grade 1", "Grade 2", "Primary"),
        ("grade 2", "Grade 3", "Primary"),
        ("grade 3", "Grade 4", "Primary"),
        ("grade 4", "Grade 5", "Primary"),
        ("grade 5", "Grade 6", "Primary"),
        ("grade 6", "Grade 7", "Primary"),
        ("grade 7", "Grade 8", "Primary"),
        ("grade 8", "Grade 9", "Primary"),
        ("grade 9", "Grade 10", "Secondary"),
        ("grade 10", "Grade 11", "Secondary"),
        ("grade 11", "Grade 12", "Preparatory"),
        ("grade 12", "", "Preparatory"),
    ],
};

// -- Afrique du Nord francophone (Maroc, Tunisie, Algérie) --
static SYSTEM_NORTH_AFRICA_FR: SchoolSystem = SchoolSystem {
    code: "ma",
    name: "Maroc / Tunisie / Algérie",
    language: "fr",
    currency: "MAD",
    hierarchy: &[
        ("1ère année primaire", "2ème année primaire", "Primaire"),
        ("1ere annee primaire", "2ème année primaire", "Primaire"),
        ("2ème année primaire", "3ème année primaire", "Primaire"),
        ("2eme annee primaire", "3ème année primaire", "Primaire"),
        ("3ème année primaire", "4ème année primaire", "Primaire"),
        ("3eme annee primaire", "4ème année primaire", "Primaire"),
        ("4ème année primaire", "5ème année primaire", "Primaire"),
        ("4eme annee primaire", "5ème année primaire", "Primaire"),
        ("5ème année primaire", "6ème année primaire", "Primaire"),
        ("5eme annee primaire", "6ème année primaire", "Primaire"),
        ("6ème année primaire", "1ère année collège", "Primaire"),
        ("6eme annee primaire", "1ère année collège", "Primaire"),
        ("1ère année collège", "2ème année collège", "Collège"),
        ("1ere annee college", "2ème année collège", "Collège"),
        ("2ème année collège", "3ème année collège", "Collège"),
        ("2eme annee college", "3ème année collège", "Collège"),
        ("3ème année collège", "Tronc commun", "Collège"),
        ("3eme annee college", "Tronc commun", "Collège"),
        ("tronc commun", "1ère année bac", "Lycée"),
        ("1ère année bac", "2ème année bac", "Lycée"),
        ("1ere annee bac", "2ème année bac", "Lycée"),
        ("2ème année bac", "", "Lycée"),
        ("2eme annee bac", "", "Lycée"),
    ],
};

// -- Égypte --
static SYSTEM_EGYPT: SchoolSystem = SchoolSystem {
    code: "eg",
    name: "Egypt",
    language: "ar",
    currency: "EGP",
    hierarchy: &[
        ("grade 1", "Grade 2", "Primary"),
        ("grade 2", "Grade 3", "Primary"),
        ("grade 3", "Grade 4", "Primary"),
        ("grade 4", "Grade 5", "Primary"),
        ("grade 5", "Grade 6", "Primary"),
        ("grade 6", "Grade 7", "Preparatory"),
        ("grade 7", "Grade 8", "Preparatory"),
        ("grade 8", "Grade 9", "Preparatory"),
        ("grade 9", "Grade 10", "Secondary"),
        ("grade 10", "Grade 11", "Secondary"),
        ("grade 11", "Grade 12", "Secondary"),
        ("grade 12", "", "Secondary"),
        ("thanawiya amma", "", "Secondary"),
    ],
};

// -- France / Belgique / Suisse francophone --
static SYSTEM_FRANCE: SchoolSystem = SchoolSystem {
    code: "fr",
    name: "France / Belgique / Suisse",
    language: "fr",
    currency: "EUR",
    hierarchy: &[
        ("cp", "CE1", "Élémentaire"),
        ("ce1", "CE2", "Élémentaire"),
        ("ce2", "CM1", "Élémentaire"),
        ("cm1", "CM2", "Élémentaire"),
        ("cm2", "6ème", "Élémentaire"),
        ("6ème", "5ème", "Collège"),
        ("6eme", "5ème", "Collège"),
        ("5ème", "4ème", "Collège"),
        ("5eme", "4ème", "Collège"),
        ("4ème", "3ème", "Collège"),
        ("4eme", "3ème", "Collège"),
        ("3ème", "Seconde", "Collège"),
        ("3eme", "Seconde", "Collège"),
        ("seconde", "Première", "Lycée"),
        ("2nde", "Première", "Lycée"),
        ("première", "Terminale", "Lycée"),
        ("premiere", "Terminale", "Lycée"),
        ("1ère", "Terminale", "Lycée"),
        ("1ere", "Terminale", "Lycée"),
        ("terminale", "", "Lycée"),
        ("tle", "", "Lycée"),
    ],
};

// -- Royaume-Uni / Commonwealth (England & Wales) --
static SYSTEM_UK: SchoolSystem = SchoolSystem {
    code: "gb",
    name: "United Kingdom",
    language: "en",
    currency: "GBP",
    hierarchy: &[
        ("year 1", "Year 2", "Key Stage 1"),
        ("year 2", "Year 3", "Key Stage 1"),
        ("year 3", "Year 4", "Key Stage 2"),
        ("year 4", "Year 5", "Key Stage 2"),
        ("year 5", "Year 6", "Key Stage 2"),
        ("year 6", "Year 7", "Key Stage 2"),
        ("year 7", "Year 8", "Key Stage 3"),
        ("year 8", "Year 9", "Key Stage 3"),
        ("year 9", "Year 10", "Key Stage 3"),
        ("year 10", "Year 11", "Key Stage 4 / GCSE"),
        ("year 11", "Year 12", "Key Stage 4 / GCSE"),
        ("year 12", "Year 13", "Sixth Form / A-Level"),
        ("year 13", "", "Sixth Form / A-Level"),
        ("gcse", "Year 12", "Key Stage 4 / GCSE"),
        ("a-level", "", "Sixth Form / A-Level"),
        ("as-level", "Year 13", "Sixth Form / A-Level"),
    ],
};

// -- Allemagne --
static SYSTEM_GERMANY: SchoolSystem = SchoolSystem {
    code: "de",
    name: "Germany / Austria",
    language: "de",
    currency: "EUR",
    hierarchy: &[
        ("klasse 1", "Klasse 2", "Grundschule"),
        ("klasse 2", "Klasse 3", "Grundschule"),
        ("klasse 3", "Klasse 4", "Grundschule"),
        ("klasse 4", "Klasse 5", "Grundschule"),
        ("klasse 5", "Klasse 6", "Sekundarstufe I"),
        ("klasse 6", "Klasse 7", "Sekundarstufe I"),
        ("klasse 7", "Klasse 8", "Sekundarstufe I"),
        ("klasse 8", "Klasse 9", "Sekundarstufe I"),
        ("klasse 9", "Klasse 10", "Sekundarstufe I"),
        ("klasse 10", "Klasse 11", "Sekundarstufe II"),
        ("klasse 11", "Klasse 12", "Sekundarstufe II"),
        ("klasse 12", "Klasse 13", "Sekundarstufe II"),
        ("klasse 13", "", "Abitur"),
        ("abitur", "", "Abitur"),
    ],
};

// -- Espagne / Amérique latine hispanophone --
static SYSTEM_SPAIN: SchoolSystem = SchoolSystem {
    code: "es",
    name: "España / Hispanoamérica",
    language: "es",
    currency: "EUR",
    hierarchy: &[
        ("1° primaria", "2° Primaria", "Primaria"),
        ("1 primaria", "2° Primaria", "Primaria"),
        ("2° primaria", "3° Primaria", "Primaria"),
        ("2 primaria", "3° Primaria", "Primaria"),
        ("3° primaria", "4° Primaria", "Primaria"),
        ("3 primaria", "4° Primaria", "Primaria"),
        ("4° primaria", "5° Primaria", "Primaria"),
        ("4 primaria", "5° Primaria", "Primaria"),
        ("5° primaria", "6° Primaria", "Primaria"),
        ("5 primaria", "6° Primaria", "Primaria"),
        ("6° primaria", "1° ESO", "Primaria"),
        ("6 primaria", "1° ESO", "Primaria"),
        ("1° eso", "2° ESO", "ESO"),
        ("1 eso", "2° ESO", "ESO"),
        ("2° eso", "3° ESO", "ESO"),
        ("2 eso", "3° ESO", "ESO"),
        ("3° eso", "4° ESO", "ESO"),
        ("3 eso", "4° ESO", "ESO"),
        ("4° eso", "1° Bachillerato", "ESO"),
        ("4 eso", "1° Bachillerato", "ESO"),
        ("1° bachillerato", "2° Bachillerato", "Bachillerato"),
        ("1 bachillerato", "2° Bachillerato", "Bachillerato"),
        ("2° bachillerato", "", "Bachillerato"),
        ("2 bachillerato", "", "Bachillerato"),
    ],
};

// -- États-Unis / Canada anglophone --
static SYSTEM_USA: SchoolSystem = SchoolSystem {
    code: "us",
    name: "USA / Canada",
    language: "en",
    currency: "USD",
    hierarchy: &[
        ("kindergarten", "1st Grade", "Elementary"),
        ("1st grade", "2nd Grade", "Elementary"),
        ("grade 1", "2nd Grade", "Elementary"),
        ("2nd grade", "3rd Grade", "Elementary"),
        ("grade 2", "3rd Grade", "Elementary"),
        ("3rd grade", "4th Grade", "Elementary"),
        ("grade 3", "4th Grade", "Elementary"),
        ("4th grade", "5th Grade", "Elementary"),
        ("grade 4", "5th Grade", "Elementary"),
        ("5th grade", "6th Grade", "Elementary"),
        ("grade 5", "6th Grade", "Elementary"),
        ("6th grade", "7th Grade", "Middle School"),
        ("grade 6", "7th Grade", "Middle School"),
        ("7th grade", "8th Grade", "Middle School"),
        ("grade 7", "8th Grade", "Middle School"),
        ("8th grade", "9th Grade", "Middle School"),
        ("grade 8", "9th Grade", "Middle School"),
        ("9th grade", "10th Grade", "High School"),
        ("grade 9", "10th Grade", "High School"),
        ("freshman", "10th Grade", "High School"),
        ("10th grade", "11th Grade", "High School"),
        ("grade 10", "11th Grade", "High School"),
        ("sophomore", "11th Grade", "High School"),
        ("11th grade", "12th Grade", "High School"),
        ("grade 11", "12th Grade", "High School"),
        ("junior", "12th Grade", "High School"),
        ("12th grade", "", "High School"),
        ("grade 12", "", "High School"),
        ("senior", "", "High School"),
    ],
};

// -- Brésil --
static SYSTEM_BRAZIL: SchoolSystem = SchoolSystem {
    code: "br",
    name: "Brasil",
    language: "pt",
    currency: "BRL",
    hierarchy: &[
        ("1° ano", "2° Ano", "Ensino Fundamental I"),
        ("1 ano", "2° Ano", "Ensino Fundamental I"),
        ("2° ano", "3° Ano", "Ensino Fundamental I"),
        ("2 ano", "3° Ano", "Ensino Fundamental I"),
        ("3° ano", "4° Ano", "Ensino Fundamental I"),
        ("3 ano", "4° Ano", "Ensino Fundamental I"),
        ("4° ano", "5° Ano", "Ensino Fundamental I"),
        ("4 ano", "5° Ano", "Ensino Fundamental I"),
        ("5° ano", "6° Ano", "Ensino Fundamental I"),
        ("5 ano", "6° Ano", "Ensino Fundamental I"),
        ("6° ano", "7° Ano", "Ensino Fundamental II"),
        ("6 ano", "7° Ano", "Ensino Fundamental II"),
        ("7° ano", "8° Ano", "Ensino Fundamental II"),
        ("7 ano", "8° Ano", "Ensino Fundamental II"),
        ("8° ano", "9° Ano", "Ensino Fundamental II"),
        ("8 ano", "9° Ano", "Ensino Fundamental II"),
        ("9° ano", "1° Ano EM", "Ensino Fundamental II"),
        ("9 ano", "1° Ano EM", "Ensino Fundamental II"),
        ("1° ano em", "2° Ano EM", "Ensino Médio"),
        ("1 ano em", "2° Ano EM", "Ensino Médio"),
        ("2° ano em", "3° Ano EM", "Ensino Médio"),
        ("2 ano em", "3° Ano EM", "Ensino Médio"),
        ("3° ano em", "", "Ensino Médio"),
        ("3 ano em", "", "Ensino Médio"),
    ],
};

// -- Mexique / Amérique centrale --
static SYSTEM_MEXICO: SchoolSystem = SchoolSystem {
    code: "mx",
    name: "México / América Central",
    language: "es",
    currency: "MXN",
    hierarchy: &[
        ("1° primaria", "2° Primaria", "Primaria"),
        ("2° primaria", "3° Primaria", "Primaria"),
        ("3° primaria", "4° Primaria", "Primaria"),
        ("4° primaria", "5° Primaria", "Primaria"),
        ("5° primaria", "6° Primaria", "Primaria"),
        ("6° primaria", "1° Secundaria", "Primaria"),
        ("1° secundaria", "2° Secundaria", "Secundaria"),
        ("1 secundaria", "2° Secundaria", "Secundaria"),
        ("2° secundaria", "3° Secundaria", "Secundaria"),
        ("2 secundaria", "3° Secundaria", "Secundaria"),
        ("3° secundaria", "1° Preparatoria", "Secundaria"),
        ("3 secundaria", "1° Preparatoria", "Secundaria"),
        ("1° preparatoria", "2° Preparatoria", "Preparatoria"),
        ("1 preparatoria", "2° Preparatoria", "Preparatoria"),
        ("2° preparatoria", "3° Preparatoria", "Preparatoria"),
        ("2 preparatoria", "3° Preparatoria", "Preparatoria"),
        ("3° preparatoria", "", "Preparatoria"),
        ("3 preparatoria", "", "Preparatoria"),
    ],
};

// -- Inde --
static SYSTEM_INDIA: SchoolSystem = SchoolSystem {
    code: "in",
    name: "India (CBSE/ICSE)",
    language: "en",
    currency: "INR",
    hierarchy: &[
        ("class 1", "Class 2", "Primary"),
        ("class 2", "Class 3", "Primary"),
        ("class 3", "Class 4", "Primary"),
        ("class 4", "Class 5", "Primary"),
        ("class 5", "Class 6", "Upper Primary"),
        ("class 6", "Class 7", "Upper Primary"),
        ("class 7", "Class 8", "Upper Primary"),
        ("class 8", "Class 9", "Upper Primary"),
        ("class 9", "Class 10", "Secondary"),
        ("class 10", "Class 11", "Secondary"),
        ("class 11", "Class 12", "Senior Secondary"),
        ("class 12", "", "Senior Secondary"),
        ("std 1", "Std 2", "Primary"),
        ("std 2", "Std 3", "Primary"),
        ("std 3", "Std 4", "Primary"),
        ("std 4", "Std 5", "Primary"),
        ("std 5", "Std 6", "Upper Primary"),
        ("std 6", "Std 7", "Upper Primary"),
        ("std 7", "Std 8", "Upper Primary"),
        ("std 8", "Std 9", "Upper Primary"),
        ("std 9", "Std 10", "Secondary"),
        ("std 10", "Std 11", "Secondary"),
        ("std 11", "Std 12", "Senior Secondary"),
        ("std 12", "", "Senior Secondary"),
    ],
};

// -- Chine --
static SYSTEM_CHINA: SchoolSystem = SchoolSystem {
    code: "cn",
    name: "China (中国)",
    language: "zh",
    currency: "CNY",
    hierarchy: &[
        ("grade 1", "Grade 2", "Primary"),
        ("grade 2", "Grade 3", "Primary"),
        ("grade 3", "Grade 4", "Primary"),
        ("grade 4", "Grade 5", "Primary"),
        ("grade 5", "Grade 6", "Primary"),
        ("grade 6", "Grade 7", "Junior High"),
        ("grade 7", "Grade 8", "Junior High"),
        ("grade 8", "Grade 9", "Junior High"),
        ("grade 9", "Grade 10", "Senior High"),
        ("grade 10", "Grade 11", "Senior High"),
        ("grade 11", "Grade 12", "Senior High"),
        ("grade 12", "", "Senior High"),
        ("小学一年级", "小学二年级", "小学"),
        ("小学六年级", "初一", "小学"),
        ("初一", "初二", "初中"),
        ("初二", "初三", "初中"),
        ("初三", "高一", "初中"),
        ("高一", "高二", "高中"),
        ("高二", "高三", "高中"),
        ("高三", "", "高中"),
    ],
};

// -- Japon --
static SYSTEM_JAPAN: SchoolSystem = SchoolSystem {
    code: "jp",
    name: "Japan (日本)",
    language: "ja",
    currency: "JPY",
    hierarchy: &[
        ("grade 1", "Grade 2", "Elementary"),
        ("grade 2", "Grade 3", "Elementary"),
        ("grade 3", "Grade 4", "Elementary"),
        ("grade 4", "Grade 5", "Elementary"),
        ("grade 5", "Grade 6", "Elementary"),
        ("grade 6", "Grade 7", "Junior High"),
        ("grade 7", "Grade 8", "Junior High"),
        ("grade 8", "Grade 9", "Junior High"),
        ("grade 9", "Grade 10", "Senior High"),
        ("grade 10", "Grade 11", "Senior High"),
        ("grade 11", "Grade 12", "Senior High"),
        ("grade 12", "", "Senior High"),
        ("小1", "小2", "小学校"),
        ("中1", "中2", "中学校"),
        ("中2", "中3", "中学校"),
        ("中3", "高1", "中学校"),
        ("高1", "高2", "高校"),
        ("高2", "高3", "高校"),
        ("高3", "", "高校"),
    ],
};

// -- Indonésie --
static SYSTEM_INDONESIA: SchoolSystem = SchoolSystem {
    code: "id",
    name: "Indonesia",
    language: "id",
    currency: "IDR",
    hierarchy: &[
        ("kelas 1 sd", "Kelas 2 SD", "SD"),
        ("kelas 2 sd", "Kelas 3 SD", "SD"),
        ("kelas 3 sd", "Kelas 4 SD", "SD"),
        ("kelas 4 sd", "Kelas 5 SD", "SD"),
        ("kelas 5 sd", "Kelas 6 SD", "SD"),
        ("kelas 6 sd", "Kelas 7 SMP", "SD"),
        ("kelas 7 smp", "Kelas 8 SMP", "SMP"),
        ("kelas 7", "Kelas 8 SMP", "SMP"),
        ("kelas 8 smp", "Kelas 9 SMP", "SMP"),
        ("kelas 8", "Kelas 9 SMP", "SMP"),
        ("kelas 9 smp", "Kelas 10 SMA", "SMP"),
        ("kelas 9", "Kelas 10 SMA", "SMP"),
        ("kelas 10 sma", "Kelas 11 SMA", "SMA"),
        ("kelas 10", "Kelas 11 SMA", "SMA"),
        ("kelas 11 sma", "Kelas 12 SMA", "SMA"),
        ("kelas 11", "Kelas 12 SMA", "SMA"),
        ("kelas 12 sma", "", "SMA"),
        ("kelas 12", "", "SMA"),
    ],
};

// -- Philippines (K-12) --
static SYSTEM_PHILIPPINES: SchoolSystem = SchoolSystem {
    code: "ph",
    name: "Philippines (K-12)",
    language: "en",
    currency: "PHP",
    hierarchy: &[
        ("grade 1", "Grade 2", "Elementary"),
        ("grade 2", "Grade 3", "Elementary"),
        ("grade 3", "Grade 4", "Elementary"),
        ("grade 4", "Grade 5", "Elementary"),
        ("grade 5", "Grade 6", "Elementary"),
        ("grade 6", "Grade 7", "Elementary"),
        ("grade 7", "Grade 8", "Junior High"),
        ("grade 8", "Grade 9", "Junior High"),
        ("grade 9", "Grade 10", "Junior High"),
        ("grade 10", "Grade 11", "Senior High"),
        ("grade 11", "Grade 12", "Senior High"),
        ("grade 12", "", "Senior High"),
    ],
};

// -- Turquie --
static SYSTEM_TURKEY: SchoolSystem = SchoolSystem {
    code: "tr",
    name: "Türkiye",
    language: "tr",
    currency: "TRY",
    hierarchy: &[
        ("1. sinif", "2. Sınıf", "İlkokul"),
        ("1. sınıf", "2. Sınıf", "İlkokul"),
        ("2. sinif", "3. Sınıf", "İlkokul"),
        ("2. sınıf", "3. Sınıf", "İlkokul"),
        ("3. sinif", "4. Sınıf", "İlkokul"),
        ("3. sınıf", "4. Sınıf", "İlkokul"),
        ("4. sinif", "5. Sınıf", "İlkokul"),
        ("4. sınıf", "5. Sınıf", "İlkokul"),
        ("5. sinif", "6. Sınıf", "Ortaokul"),
        ("5. sınıf", "6. Sınıf", "Ortaokul"),
        ("6. sinif", "7. Sınıf", "Ortaokul"),
        ("6. sınıf", "7. Sınıf", "Ortaokul"),
        ("7. sinif", "8. Sınıf", "Ortaokul"),
        ("7. sınıf", "8. Sınıf", "Ortaokul"),
        ("8. sinif", "9. Sınıf", "Ortaokul"),
        ("8. sınıf", "9. Sınıf", "Ortaokul"),
        ("9. sinif", "10. Sınıf", "Lise"),
        ("9. sınıf", "10. Sınıf", "Lise"),
        ("10. sinif", "11. Sınıf", "Lise"),
        ("10. sınıf", "11. Sınıf", "Lise"),
        ("11. sinif", "12. Sınıf", "Lise"),
        ("11. sınıf", "12. Sınıf", "Lise"),
        ("12. sinif", "", "Lise"),
        ("12. sınıf", "", "Lise"),
    ],
};

// -- Pays du Golfe / Monde arabe (EAU, Arabie Saoudite, Qatar, Koweït, Bahreïn, Oman, Jordanie, Liban) --
static SYSTEM_ARAB_GULF: SchoolSystem = SchoolSystem {
    code: "ae",
    name: "Gulf / Arab World (UAE, Saudi, etc.)",
    language: "ar",
    currency: "AED",
    hierarchy: &[
        ("grade 1", "Grade 2", "Primary"),
        ("grade 2", "Grade 3", "Primary"),
        ("grade 3", "Grade 4", "Primary"),
        ("grade 4", "Grade 5", "Primary"),
        ("grade 5", "Grade 6", "Primary"),
        ("grade 6", "Grade 7", "Intermediate"),
        ("grade 7", "Grade 8", "Intermediate"),
        ("grade 8", "Grade 9", "Intermediate"),
        ("grade 9", "Grade 10", "Secondary"),
        ("grade 10", "Grade 11", "Secondary"),
        ("grade 11", "Grade 12", "Secondary"),
        ("grade 12", "", "Secondary"),
    ],
};

// ============================================================================
// DÉTECTION PAYS PAR GPS (bounding boxes simplifiées)
// ============================================================================

/// Détecte le code pays à partir de coordonnées GPS (lat, lng).
/// Couverture mondiale : Afrique, Europe, Amériques, Asie, Moyen-Orient, Océanie.
/// Retourne "cm" par défaut si aucune correspondance.
pub fn detect_country_from_gps(lat: f64, lng: f64) -> &'static str {
    // Bounding boxes approximatives (code, lat_min, lat_max, lng_min, lng_max)
    // Ordre: les plus petits pays d'abord pour éviter qu'un grand pays englobe un petit
    let countries: &[(&str, f64, f64, f64, f64)] = &[
        // ── Afrique ──
        ("cm", 1.65, 13.10, 8.40, 16.20),     // Cameroun
        ("ng", 4.20, 13.90, 2.67, 14.68),     // Nigeria
        ("sn", 12.30, 16.70, -17.55, -11.35), // Sénégal
        ("ci", 4.30, 10.75, -8.60, -2.50),    // Côte d'Ivoire
        ("ga", -3.95, 2.35, 8.65, 14.55),     // Gabon
        ("cd", -13.46, 5.39, 12.18, 31.31),   // RDC
        ("cg", -5.02, 3.71, 11.12, 18.65),    // Congo-Brazza
        ("gh", 4.73, 11.18, -3.25, 1.20),     // Ghana
        ("ke", -4.72, 5.03, 33.89, 41.91),    // Kenya
        ("tg", 6.10, 11.14, -0.15, 1.81),     // Togo
        ("bj", 6.22, 12.42, 0.76, 3.85),      // Bénin
        ("bf", 9.39, 15.09, -5.52, 2.41),     // Burkina Faso
        ("ml", 10.16, 25.00, -12.24, 4.27),   // Mali
        ("ne", 11.69, 23.53, 0.16, 16.00),    // Niger
        ("gn", 7.19, 12.68, -15.08, -7.64),   // Guinée
        ("tz", -11.75, -0.98, 29.33, 40.44),  // Tanzanie
        ("ug", -1.48, 4.23, 29.57, 35.03),    // Ouganda
        ("rw", -2.84, -1.05, 28.86, 30.90),   // Rwanda
        ("td", 7.44, 23.45, 13.47, 24.00),    // Tchad
        ("cf", 2.22, 11.00, 14.42, 27.46),    // Centrafrique
        ("za", -34.84, -22.13, 16.45, 32.89), // Afrique du Sud
        ("et", 3.40, 14.89, 32.99, 48.00),    // Éthiopie
        ("ma", 27.66, 35.93, -13.17, -1.00),  // Maroc
        ("tn", 30.23, 37.35, 7.52, 11.60),    // Tunisie
        ("dz", 18.97, 37.09, -8.67, 12.00),   // Algérie
        ("eg", 22.00, 31.67, 24.70, 36.90),   // Égypte
        ("mg", -25.61, -11.95, 43.18, 50.48), // Madagascar
        ("mz", -26.87, -10.47, 30.21, 40.84), // Mozambique
        ("ao", -18.04, -4.38, 11.64, 24.08),  // Angola
        ("zm", -18.08, -8.22, 21.99, 33.71),  // Zambie
        ("zw", -22.42, -15.61, 25.24, 33.07), // Zimbabwe
        // ── Europe ──
        ("fr", 41.33, 51.12, -5.14, 9.56),  // France
        ("gb", 49.90, 60.85, -8.62, 1.77),  // Royaume-Uni
        ("de", 47.27, 55.06, 5.87, 15.04),  // Allemagne
        ("es", 35.95, 43.79, -9.30, 4.33),  // Espagne
        ("it", 36.65, 47.09, 6.63, 18.52),  // Italie
        ("pt", 36.96, 42.15, -9.50, -6.19), // Portugal
        ("be", 49.50, 51.50, 2.55, 6.40),   // Belgique
        ("ch", 45.82, 47.81, 5.96, 10.49),  // Suisse
        ("nl", 50.75, 53.47, 3.36, 7.21),   // Pays-Bas
        ("at", 46.37, 49.02, 9.53, 17.16),  // Autriche
        ("pl", 49.00, 54.84, 14.12, 24.15), // Pologne
        ("ro", 43.62, 48.27, 20.26, 29.69), // Roumanie
        ("se", 55.34, 69.06, 11.11, 24.17), // Suède
        // ── Amériques ──
        ("us", 24.52, 49.38, -124.77, -66.95), // USA (48 états)
        ("ca", 41.68, 83.11, -141.00, -52.62), // Canada
        ("mx", 14.53, 32.72, -118.40, -86.71), // Mexique
        ("br", -33.75, 5.27, -73.99, -34.79),  // Brésil
        ("co", -4.23, 12.46, -79.00, -66.87),  // Colombie
        ("ar", -55.06, -21.78, -73.58, -53.64), // Argentine
        ("pe", -18.35, -0.04, -81.33, -68.65), // Pérou
        ("cl", -55.98, -17.50, -75.64, -66.96), // Chili
        // ── Asie ──
        ("in", 6.75, 35.50, 68.16, 97.40),    // Inde
        ("cn", 18.15, 53.56, 73.50, 134.77),  // Chine
        ("jp", 24.25, 45.52, 122.93, 153.99), // Japon
        ("kr", 33.11, 38.62, 124.60, 131.87), // Corée du Sud
        ("id", -11.00, 6.08, 95.01, 141.02),  // Indonésie
        ("ph", 4.59, 21.12, 116.95, 126.60),  // Philippines
        ("vn", 8.56, 23.39, 102.14, 109.46),  // Vietnam
        ("th", 5.61, 20.46, 97.35, 105.64),   // Thaïlande
        ("my", 0.85, 7.36, 99.64, 119.27),    // Malaisie
        ("bd", 20.67, 26.63, 88.01, 92.67),   // Bangladesh
        ("pk", 23.69, 37.08, 60.87, 77.84),   // Pakistan
        // ── Moyen-Orient ──
        ("tr", 35.82, 42.11, 25.66, 44.83), // Turquie
        ("ae", 22.63, 26.08, 51.50, 56.38), // EAU
        ("sa", 16.38, 32.15, 34.57, 55.67), // Arabie Saoudite
        ("iq", 29.06, 37.38, 38.79, 48.57), // Irak
        ("ir", 25.06, 39.78, 44.05, 63.32), // Iran
        ("lb", 33.05, 34.69, 35.10, 36.62), // Liban
        ("jo", 29.18, 33.38, 34.96, 39.30), // Jordanie
        // ── Océanie ──
        ("au", -43.64, -10.06, 113.16, 153.64), // Australie
        ("nz", -47.29, -34.39, 166.43, 178.57), // Nouvelle-Zélande
    ];
    for &(code, lat_min, lat_max, lng_min, lng_max) in countries {
        if lat >= lat_min && lat <= lat_max && lng >= lng_min && lng <= lng_max {
            return code;
        }
    }
    "cm" // Défaut: Cameroun
}

/// Retourne le système scolaire approprié pour un code pays.
/// Couverture mondiale avec regroupements par système similaire.
pub fn get_school_system_for_country(country_code: &str) -> &'static SchoolSystem {
    match country_code {
        // Afrique
        "cm" => &SYSTEM_CAMEROUN_FR,
        "ng" => &SYSTEM_NIGERIA,
        "gh" => &SYSTEM_GHANA,
        "ke" | "tz" | "ug" | "rw" => &SYSTEM_KENYA,
        "cd" => &SYSTEM_RDC,
        "za" | "zw" | "zm" | "mz" | "ao" => &SYSTEM_SOUTH_AFRICA,
        "et" => &SYSTEM_ETHIOPIA,
        "eg" => &SYSTEM_EGYPT,
        "ma" | "tn" | "dz" => &SYSTEM_NORTH_AFRICA_FR,
        "mg" => &SYSTEM_FRANCOPHONE_WEST, // Madagascar système francophone
        "sn" | "ci" | "ga" | "cg" | "tg" | "bj" | "bf" | "ml" | "ne" | "gn" | "td" | "cf" => {
            &SYSTEM_FRANCOPHONE_WEST
        }
        // Europe
        "fr" | "be" | "ch" | "lu" | "mc" => &SYSTEM_FRANCE,
        "gb" | "ie" | "au" | "nz" => &SYSTEM_UK, // Commonwealth
        "de" | "at" => &SYSTEM_GERMANY,
        "es" | "co" | "ar" | "pe" | "cl" | "ve" | "ec" | "bo" | "py" | "uy" | "cr" | "pa"
        | "gt" | "hn" | "sv" | "ni" | "cu" | "do" | "pr" => &SYSTEM_SPAIN,
        "it" | "pt" | "ro" | "nl" | "se" | "pl" => &SYSTEM_FRANCE, // Systèmes similaires au français
        // Amériques
        "us" | "ca" => &SYSTEM_USA,
        "br" => &SYSTEM_BRAZIL,
        "mx" => &SYSTEM_MEXICO,
        // Asie
        "in" | "bd" | "pk" | "lk" | "np" => &SYSTEM_INDIA,
        "cn" | "hk" | "tw" => &SYSTEM_CHINA,
        "jp" => &SYSTEM_JAPAN,
        "id" => &SYSTEM_INDONESIA,
        "ph" => &SYSTEM_PHILIPPINES,
        "kr" | "vn" | "th" | "my" | "mm" | "kh" | "la" => &SYSTEM_USA, // Beaucoup utilisent Grade 1-12
        // Moyen-Orient
        "tr" => &SYSTEM_TURKEY,
        "ae" | "sa" | "qa" | "kw" | "bh" | "om" | "iq" | "jo" | "lb" | "sy" | "ps" => {
            &SYSTEM_ARAB_GULF
        }
        "ir" => &SYSTEM_ARAB_GULF, // Structure similaire Grade 1-12
        // Fallback
        _ => &SYSTEM_USA, // Grade 1-12 est le plus universel comme fallback
    }
}

/// Détecte le système scolaire à partir de GPS.
pub fn detect_school_system_from_gps(lat: f64, lng: f64) -> &'static SchoolSystem {
    let country = detect_country_from_gps(lat, lng);
    get_school_system_for_country(country)
}

// ============================================================================
// FONCTIONS UTILITAIRES MULTI-SYSTÈMES
// ============================================================================

/// Calcule la classe immédiatement supérieure.
/// Essaie d'abord le système détecté par GPS, puis tous les systèmes en fallback.
/// Retourne "" (vide) si c'est la dernière classe du système.
pub fn compute_classe_superieure(classe_actuelle: &str) -> String {
    compute_classe_superieure_with_gps(classe_actuelle, None, None)
}

/// Version GPS-aware de compute_classe_superieure.
pub fn compute_classe_superieure_with_gps(
    classe_actuelle: &str,
    lat: Option<f64>,
    lng: Option<f64>,
) -> String {
    let normalized = classe_actuelle.trim().to_lowercase();

    // 1. Si GPS disponible, essayer le système du pays détecté en priorité
    if let (Some(lat_v), Some(lng_v)) = (lat, lng) {
        if lat_v != 0.0 || lng_v != 0.0 {
            let system = detect_school_system_from_gps(lat_v, lng_v);
            for &(key, next, _) in system.hierarchy {
                if normalized == key {
                    return next.to_string();
                }
            }
        }
    }

    // 2. Fallback: chercher dans TOUS les systèmes
    for system in get_all_school_systems() {
        for &(key, next, _) in system.hierarchy {
            if normalized == key {
                return next.to_string();
            }
        }
    }

    // 3. Si non reconnu, retourner la même classe (l'IA devra affiner)
    classe_actuelle.to_string()
}

/// Vérifie si une classe est la dernière de son système (pas de troc possible, vente uniquement).
/// Fonctionne pour tous les systèmes: Terminale, Upper Sixth, SSS 3, SHS 3, Form 4 (Kenya), 6ème secondaire (RDC)...
pub fn is_classe_terminale(classe: &str) -> bool {
    let normalized = classe.trim().to_lowercase();

    // Chercher dans tous les systèmes: une classe est "terminale" si next_class == ""
    for system in get_all_school_systems() {
        for &(key, next, _) in system.hierarchy {
            if normalized == key && next.is_empty() {
                return true;
            }
        }
    }
    false
}

/// Déduit le niveau scolaire depuis la classe (multi-système).
pub fn compute_niveau_from_classe(classe: &str) -> &'static str {
    let normalized = classe.trim().to_lowercase();
    for system in get_all_school_systems() {
        for &(key, _, level) in system.hierarchy {
            if normalized == key {
                return level;
            }
        }
    }
    "Non déterminé"
}

/// Génère la description complète de la hiérarchie pour un système donné.
/// Utilisé dans les prompts IA pour que l'IA connaisse le système de l'utilisateur.
pub fn get_hierarchy_description_for_prompt(system: &SchoolSystem) -> String {
    let mut levels: Vec<(&str, Vec<String>)> = Vec::new();
    let mut current_level = "";
    let mut current_classes: Vec<String> = Vec::new();

    // Dédupliquer (les alias comme "6eme"/"6ème" ne doivent apparaître qu'une fois)
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();

    for &(key, next, level) in system.hierarchy {
        // Skip les alias (si la classe suivante est la même que celle d'un autre entry)
        let display_name = if next.is_empty() {
            key.to_string()
        } else {
            key.to_string()
        };
        if seen.contains(&display_name) {
            continue;
        }
        seen.insert(display_name.clone());

        if level != current_level {
            if !current_classes.is_empty() {
                levels.push((current_level, current_classes.clone()));
                current_classes.clear();
            }
            current_level = level;
        }
        // Formater: "CM2 → 6ème" ou "Terminale (FIN)"
        if next.is_empty() {
            current_classes.push(format!("{} (FIN - vente uniquement)", key));
        } else {
            current_classes.push(format!("{} → {}", key, next));
        }
    }
    if !current_classes.is_empty() {
        levels.push((current_level, current_classes));
    }

    let mut result = String::new();
    for (level_name, classes) in &levels {
        result.push_str(&format!("  {} : {}\n", level_name, classes.join(", ")));
    }
    result
}

/// Retourne la description multi-système pour le prompt IA quand on ne connaît pas
/// le système exact (fallback universel).
pub fn get_all_systems_description_for_prompt() -> String {
    let mut result = String::new();
    for system in get_all_school_systems() {
        result.push_str(&format!("\n--- {} ---\n", system.name));
        result.push_str(&get_hierarchy_description_for_prompt(system));
    }
    result
}

/// Recommandations de livres basées sur classe/matière
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookRecommendation {
    pub livre_ids: Vec<i32>,
    pub score_recommendation: f64, // 0-100
    pub reasoning: String,
    pub alternative_books: Vec<i32>,
    pub matieres_suggestees: Vec<String>,
}

/// Matching intelligent besoins/offres
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookMatching {
    pub livre_offert_id: i32,
    pub livre_souhaite_id: i32,
    pub participant_id: i32,
    pub score_matching: f64,      // 0-100
    pub score_compatibilite: f64, // 0-100
    pub score_proximite: f64,     // 0-100
    pub reasoning: String,
    pub points_forts: Vec<String>,
    pub points_faibles: Vec<String>,
}

/// Suggestions prix basées sur marché
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceSuggestion {
    pub livre_id: i32,
    pub prix_suggere_min: f64,
    pub prix_suggere_max: f64,
    pub prix_suggere_median: f64,
    pub devise: String,
    pub facteurs_influence: Vec<String>,
    pub comparaison_marche: String,
    pub confidence: f64, // 0-1
}

/// Service IA pour Bourse du Livre
pub struct BookExchangeAIService {
    app_ia: Arc<AppIA>,
}

impl BookExchangeAIService {
    pub fn new(app_ia: Arc<AppIA>) -> Self {
        Self { app_ia }
    }

    /// Génère des recommandations de livres basées sur classe/matière
    pub async fn generate_book_recommendations(
        &self,
        classe_actuelle: &str,
        classe_souhaitee: &str,
        matiere: &str,
        niveau: Option<&str>,
        ville: Option<&str>,
    ) -> AppResult<BookRecommendation> {
        let niveau_str = niveau.unwrap_or("Non spécifié");
        let ville_str = ville.unwrap_or("Non spécifiée");

        // Charger le prompt depuis le fichier markdown
        let mut variables = HashMap::new();
        variables.insert("classe_actuelle".to_string(), classe_actuelle.to_string());
        variables.insert("classe_souhaitee".to_string(), classe_souhaitee.to_string());
        variables.insert("matiere".to_string(), matiere.to_string());
        variables.insert("niveau".to_string(), niveau_str.to_string());
        variables.insert("ville".to_string(), ville_str.to_string());

        let prompt =
            load_prompt_section_with_vars("bourse_livre", "Recommandations de Livres", &variables)
                .await
                .unwrap_or_else(|e| {
                    log::warn!(
                "[BookExchangeAIService] Erreur chargement prompt, utilisation fallback: {}",
                e
            );
                    format!(
                        r#"
Tu es l'assistant intelligent de la Bourse du Livre de Yukpo.

CONTEXTE :
- Classe actuelle de l'élève : {}
- Classe souhaitée : {}
- Matière : {}
- Niveau : {}
- Ville : {}

TON RÔLE :
- Recommander des livres scolaires adaptés à la transition entre les classes
- Suggérer des matières complémentaires si nécessaire
- Proposer des alternatives si livres principaux indisponibles
- Donner des conseils pour faciliter l'apprentissage

IMPORTANT :
- Les recommandations doivent être adaptées au système éducatif camerounais/africain
- Prioriser les livres disponibles dans la région
- Considérer les programmes scolaires officiels

RÉPONSE ATTENDUE (JSON strict) :
{{
    "livre_ids": [1, 2, 3],
    "score_recommendation": 85.5,
    "reasoning": "Explication détaillée des recommandations",
    "alternative_books": [4, 5],
    "matieres_suggestees": ["Mathématiques", "Physique"]
}}
"#,
                        classe_actuelle, classe_souhaitee, matiere, niveau_str, ville_str
                    )
                });

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[BookExchangeAIService] Recommandations générées avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON avec fallback gracieux
        let recommendation: BookRecommendation = match serde_json::from_str(&response) {
            Ok(r) => r,
            Err(e) => {
                log::warn!(
                    "[BookExchangeAIService] Erreur parsing JSON: {}. Réponse: {}",
                    e,
                    response
                );
                // Fallback : retourner une recommandation par défaut
                BookRecommendation {
                    livre_ids: vec![],
                    score_recommendation: 0.0,
                    reasoning: format!(
                        "Recommandation basique pour transition {} vers {} en {}",
                        classe_actuelle, classe_souhaitee, matiere
                    ),
                    alternative_books: vec![],
                    matieres_suggestees: vec![],
                }
            }
        };

        Ok(recommendation)
    }

    /// Matching intelligent besoins/offres
    pub async fn generate_book_matching(
        &self,
        livre_offert_id: i32,
        livre_souhaite_id: i32,
        participant_id: i32,
        distance_km: Option<f64>,
        etat_livre_offert: Option<&str>,
        etat_livre_souhaite: Option<&str>,
    ) -> AppResult<BookMatching> {
        let distance_str = distance_km
            .map(|d| format!("{} km", d))
            .unwrap_or_else(|| "Non spécifiée".to_string());
        let etat_offert = etat_livre_offert.unwrap_or("Non spécifié");
        let etat_souhaite = etat_livre_souhaite.unwrap_or("Non spécifié");

        // Charger le prompt depuis le fichier markdown
        let mut variables = HashMap::new();
        variables.insert("livre_offert_id".to_string(), livre_offert_id.to_string());
        variables.insert(
            "livre_souhaite_id".to_string(),
            livre_souhaite_id.to_string(),
        );
        variables.insert("participant_id".to_string(), participant_id.to_string());
        variables.insert("distance_km".to_string(), distance_str.clone());
        variables.insert("etat_livre_offert".to_string(), etat_offert.to_string());
        variables.insert("etat_livre_souhaite".to_string(), etat_souhaite.to_string());

        let prompt =
            load_prompt_section_with_vars("bourse_livre", "Matching Intelligent", &variables)
                .await
                .unwrap_or_else(|e| {
                    log::warn!(
                "[BookExchangeAIService] Erreur chargement prompt, utilisation fallback: {}",
                e
            );
                    format!(
                        r#"
Tu es l'assistant intelligent de matching pour la Bourse du Livre de Yukpo.

CONTEXTE :
- Livre offert ID : {}
- Livre souhaité ID : {}
- Participant ID : {}
- Distance : {}
- État livre offert : {}
- État livre souhaité : {}

TON RÔLE :
- Analyser la compatibilité de l'échange
- Calculer des scores de matching (compatibilité, proximité)
- Identifier les points forts et faibles de l'échange
- Donner des recommandations pour faciliter l'échange

CRITÈRES DE SCORING :
- Compatibilité : Classe, matière, niveau (0-100)
- Proximité : Distance géographique (0-100, plus proche = meilleur score)
- État : État des livres (0-100)

RÉPONSE ATTENDUE (JSON strict) :
{{
    "livre_offert_id": {},
    "livre_souhaite_id": {},
    "participant_id": {},
    "score_matching": 85.5,
    "score_compatibilite": 90.0,
    "score_proximite": 80.0,
    "reasoning": "Explication détaillée du matching",
    "points_forts": ["Point fort 1", "Point fort 2"],
    "points_faibles": ["Point faible 1"]
}}
"#,
                        livre_offert_id,
                        livre_souhaite_id,
                        participant_id,
                        distance_str,
                        etat_offert,
                        etat_souhaite,
                        livre_offert_id,
                        livre_souhaite_id,
                        participant_id
                    )
                });

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[BookExchangeAIService] Matching généré avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON avec fallback gracieux
        let matching: BookMatching = match serde_json::from_str(&response) {
            Ok(m) => m,
            Err(e) => {
                log::warn!(
                    "[BookExchangeAIService] Erreur parsing JSON: {}. Réponse: {}",
                    e,
                    response
                );
                // Fallback : retourner un matching par défaut
                BookMatching {
                    livre_offert_id,
                    livre_souhaite_id,
                    participant_id,
                    score_matching: 70.0,
                    score_compatibilite: 75.0,
                    score_proximite: distance_km.map(|d| 100.0 - d.min(100.0)).unwrap_or(50.0),
                    reasoning: "Matching basique calculé".to_string(),
                    points_forts: vec![],
                    points_faibles: vec![],
                }
            }
        };

        Ok(matching)
    }

    /// Suggestions prix basées sur marché
    pub async fn generate_price_suggestions(
        &self,
        livre_id: i32,
        titre: &str,
        auteur: Option<&str>,
        editeur: Option<&str>,
        isbn: Option<&str>,
        classe: &str,
        matiere: &str,
        etat_livre: &str,
        ville: Option<&str>,
        prix_marche: Option<f64>, // Prix moyen du marché si disponible
    ) -> AppResult<PriceSuggestion> {
        let auteur_str = auteur.unwrap_or("Non spécifié");
        let editeur_str = editeur.unwrap_or("Non spécifié");
        let isbn_str = isbn.unwrap_or("Non spécifié");
        let ville_str = ville.unwrap_or("Non spécifiée");
        let prix_marche_str = prix_marche
            .map(|p| format!("{} XAF", p as i64))
            .unwrap_or_else(|| "Non disponible".to_string());

        // Charger le prompt depuis le fichier markdown
        let mut variables = HashMap::new();
        variables.insert("livre_id".to_string(), livre_id.to_string());
        variables.insert("titre".to_string(), titre.to_string());
        variables.insert("auteur".to_string(), auteur_str.to_string());
        variables.insert("editeur".to_string(), editeur_str.to_string());
        variables.insert("isbn".to_string(), isbn_str.to_string());
        variables.insert("classe".to_string(), classe.to_string());
        variables.insert("matiere".to_string(), matiere.to_string());
        variables.insert("etat_livre".to_string(), etat_livre.to_string());
        variables.insert("ville".to_string(), ville_str.to_string());
        variables.insert("prix_marche".to_string(), prix_marche_str.clone());

        let prompt = load_prompt_section_with_vars("bourse_livre", "Suggestions Prix", &variables)
            .await
            .unwrap_or_else(|e| {
                log::warn!(
                    "[BookExchangeAIService] Erreur chargement prompt, utilisation fallback: {}",
                    e
                );
                format!(
                    r#"
Tu es l'expert en prix de livres scolaires pour Yukpo.

CONTEXTE :
- Livre ID : {}
- Titre : {}
- Auteur : {}
- Éditeur : {}
- ISBN : {}
- Classe : {}
- Matière : {}
- État : {}
- Ville : {}
- Prix moyen marché : {}

TON RÔLE :
- Suggérer une fourchette de prix adaptée au marché local
- Considérer l'état du livre (Neuf, Très bon, Bon, Acceptable)
- Prendre en compte la localisation (prix peuvent varier selon ville)
- Donner des facteurs d'influence (rareté, demande, saisonnalité)

IMPORTANT :
- Les prix doivent être en XAF (Franc CFA)
- Considérer le pouvoir d'achat local
- Suggérer des prix réalistes et compétitifs

RÉPONSE ATTENDUE (JSON strict) :
{{
    "livre_id": {},
    "prix_suggere_min": 5000.0,
    "prix_suggere_max": 8000.0,
    "prix_suggere_median": 6500.0,
    "devise": "XAF",
    "facteurs_influence": ["Facteur 1", "Facteur 2"],
    "comparaison_marche": "Description de la comparaison avec le marché",
    "confidence": 0.85
}}
"#,
                    livre_id,
                    titre,
                    auteur_str,
                    editeur_str,
                    isbn_str,
                    classe,
                    matiere,
                    etat_livre,
                    ville_str,
                    prix_marche_str,
                    livre_id
                )
            });

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[BookExchangeAIService] Suggestions prix générées avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON avec fallback gracieux
        let suggestion: PriceSuggestion = match serde_json::from_str(&response) {
            Ok(s) => s,
            Err(e) => {
                log::warn!(
                    "[BookExchangeAIService] Erreur parsing JSON: {}. Réponse: {}",
                    e,
                    response
                );
                // Fallback : retourner une suggestion par défaut basée sur l'état
                let prix_base = match etat_livre {
                    "Neuf" => 10000.0,
                    "Très bon" => 7500.0,
                    "Bon" => 5000.0,
                    "Acceptable" => 3000.0,
                    _ => 5000.0,
                };
                PriceSuggestion {
                    livre_id,
                    prix_suggere_min: prix_base * 0.8,
                    prix_suggere_max: prix_base * 1.2,
                    prix_suggere_median: prix_base,
                    devise: "XAF".to_string(),
                    facteurs_influence: vec!["État du livre".to_string(), "Classe".to_string()],
                    comparaison_marche: "Suggestion basée sur état du livre".to_string(),
                    confidence: 0.6,
                }
            }
        };

        Ok(suggestion)
    }

    /// Nettoie la sortie LLM (blocs ```json) et isole le premier objet `{ ... }`.
    pub fn sanitize_recto_verso_llm_json(raw: &str) -> String {
        let mut s = raw.trim().to_string();
        if s.starts_with("```") {
            if let Some(i) = s.find('\n') {
                s = s[i + 1..].to_string();
            }
            if let Some(end) = s.rfind("```") {
                s = s[..end].trim().to_string();
            }
        }
        if let Some(start) = s.find('{') {
            if let Some(end) = s.rfind('}') {
                if end >= start {
                    return s[start..=end].to_string();
                }
            }
        }
        s
    }

    /// Ramène les variantes LLM vers exactement `bon`, `acceptable` ou `rejete`.
    pub fn normalize_etat_classification_llm(raw: &str) -> String {
        let s = raw.trim().to_lowercase();
        let n: String = s
            .chars()
            .map(|c| match c {
                'é' | 'è' | 'ê' | 'ë' => 'e',
                'à' | 'â' => 'a',
                'ù' | 'û' => 'u',
                'î' | 'ï' => 'i',
                'ô' => 'o',
                'ç' => 'c',
                _ => c,
            })
            .collect();

        if n.contains("rejet") {
            return "rejete".to_string();
        }
        match n.as_str() {
            "bon" | "tres bon" => return "bon".to_string(),
            "acceptable" => return "acceptable".to_string(),
            _ => {}
        }
        if (n.starts_with("tres bon")
            || n.contains("excellent")
            || n.contains("comme neuf")
            || n.contains("tres bon etat")
            || n.contains("bon etat"))
            && !n.contains("pas tres bon")
            && !n.contains("pas bon")
        {
            return "bon".to_string();
        }
        if n.contains("acceptable")
            || n.contains("etat moyen")
            || n.contains("usure")
            || n.contains("abime")
            || n.contains("corners")
            || n.contains("annot")
        {
            return "acceptable".to_string();
        }
        if n.contains("bon") && !n.contains("acceptable") {
            return "bon".to_string();
        }
        "acceptable".to_string()
    }

    fn normalize_isbn_key(s: &str) -> String {
        s.chars().filter(|c| c.is_alphanumeric()).collect::<String>().to_lowercase()
    }

    /// Si `prix_detecte` est absent ou nul : `prix_officiel` du programme (ID renvoyé par l'IA ou rapprochement).
    pub fn enrich_prix_from_programmes_officiels(
        analysis: &mut BookRectoVersoAnalysis,
        programmes: &[crate::models::livre_scolaire::ProgrammeScolaire],
    ) {
        use rust_decimal::prelude::ToPrimitive;

        fn prix_manquant(p: Option<f64>) -> bool {
            match p {
                None => true,
                Some(x) => !x.is_finite() || x <= 0.0,
            }
        }

        if !prix_manquant(analysis.prix_detecte) {
            return;
        }

        if let Some(pid) = analysis.programme_scolaire_id {
            if let Some(prog) = programmes.iter().find(|p| p.id == pid && p.is_active) {
                if let Some(v) = prog.prix_officiel.and_then(|d| d.to_f64()) {
                    if v > 0.0 {
                        analysis.prix_detecte = Some(v);
                        if analysis.devise_detectee.as_deref().unwrap_or("").is_empty() {
                            analysis.devise_detectee = prog
                                .devise
                                .clone()
                                .filter(|d| !d.is_empty())
                                .or(Some("XAF".to_string()));
                        }
                        let note = format!(
                            "prix_officiel programme #{} (aucun prix lisible sur les photos)",
                            pid
                        );
                        analysis.notes = Some(match analysis.notes.take() {
                            Some(n) if !n.is_empty() => format!("{} | {}", n, note),
                            _ => note,
                        });
                        return;
                    }
                }
            }
        }

        let isbn_k =
            analysis.isbn.as_deref().map(Self::normalize_isbn_key).filter(|s| !s.is_empty());
        let titre_u = analysis.titre.as_deref().unwrap_or("").trim().to_lowercase();
        let classe_u = analysis.classe_actuelle.as_deref().unwrap_or("").trim().to_lowercase();

        let mut best_score: i32 = 0;
        let mut best_price: f64 = 0.0;
        let mut best_id: Option<i32> = None;

        for prog in programmes.iter().filter(|p| p.is_active) {
            let Some(v) = prog.prix_officiel.and_then(|d| d.to_f64()) else {
                continue;
            };
            if v <= 0.0 {
                continue;
            }

            let mut score: i32 = 0;
            if let Some(ref ik) = isbn_k {
                if prog.isbn_livre.as_deref().map(Self::normalize_isbn_key).as_ref() == Some(ik) {
                    score += 100;
                }
            }
            if !titre_u.is_empty() {
                let tp = prog.titre_livre.to_lowercase();
                if tp.contains(&titre_u) || titre_u.contains(&tp) {
                    score += 45;
                }
            }
            if !classe_u.is_empty() && prog.classe.to_lowercase().trim() == classe_u {
                score += 28;
            }

            if score >= 50 && (score > best_score || (score == best_score && v > best_price)) {
                best_score = score;
                best_price = v;
                best_id = Some(prog.id);
            }
        }

        if best_price > 0.0 {
            analysis.prix_detecte = Some(best_price);
            if analysis.devise_detectee.as_deref().unwrap_or("").is_empty() {
                analysis.devise_detectee = Some("XAF".to_string());
            }
            if analysis.programme_scolaire_id.is_none() {
                analysis.programme_scolaire_id = best_id;
            }
            let note = format!(
                "prix_officiel programme (rapprochement score={})",
                best_score
            );
            analysis.notes = Some(match analysis.notes.take() {
                Some(n) if !n.is_empty() => format!("{} | {}", n, note),
                _ => note,
            });
        }
    }

    /// ✅ V2: Analyse recto-verso d'un livre avec classification 3 niveaux,
    /// détection prix/devise, et vérification programme scolaire
    pub async fn analyze_book_recto_verso(
        &self,
        image_recto_base64: &str,
        image_verso_base64: &str,
        user_lat: Option<f64>,
        user_lng: Option<f64>,
        programmes_disponibles: &str,
    ) -> AppResult<BookRectoVersoAnalysis> {
        log::info!(
            "[BookExchangeAIService] Payload vision: recto_base64_len={}, verso_base64_len={}",
            image_recto_base64.len(),
            image_verso_base64.len()
        );

        let lat = user_lat.unwrap_or(0.0);
        let lng = user_lng.unwrap_or(0.0);

        // ✅ Détecter le système scolaire à partir du GPS de l'utilisateur
        let detected_system = if lat != 0.0 || lng != 0.0 {
            detect_school_system_from_gps(lat, lng)
        } else {
            get_school_system_for_country("cm") // Défaut Cameroun
        };
        let country_code = detect_country_from_gps(lat, lng);
        let hierarchy_desc = get_hierarchy_description_for_prompt(detected_system);

        // Déterminer si les programmes sont disponibles ou si l'IA doit faire un fallback
        let programmes_info = if programmes_disponibles.is_empty()
            || programmes_disponibles == "[]"
            || programmes_disponibles == "Aucun"
        {
            format!(
                "AUCUN programme scolaire n'est encore enregistré pour cette région. \
                Tu DOIS utiliser tes connaissances du système éducatif {} pour déterminer \
                si ce livre correspond au programme officiel actuel. Indique est_au_programme=true \
                si tu es raisonnablement confiant, avec programme_match_details expliquant ton raisonnement. \
                Mets programme_scolaire_id=null dans ce cas.",
                detected_system.name
            )
        } else {
            format!("Programmes scolaires connus : {}", programmes_disponibles)
        };

        log::info!(
            "[BookExchangeAIService] Système scolaire détecté: {} ({}) pour GPS ({}, {})",
            detected_system.name,
            detected_system.code,
            lat,
            lng
        );

        let mut variables = std::collections::HashMap::new();
        variables.insert("user_lat".to_string(), format!("{}", lat));
        variables.insert("user_lng".to_string(), format!("{}", lng));
        variables.insert("pays_detecte".to_string(), country_code.to_uppercase());
        variables.insert(
            "systeme_scolaire".to_string(),
            detected_system.name.to_string(),
        );
        variables.insert(
            "langue_systeme".to_string(),
            detected_system.language.to_string(),
        );
        variables.insert(
            "devise_locale".to_string(),
            detected_system.currency.to_string(),
        );
        variables.insert("hierarchie_classes".to_string(), hierarchy_desc.clone());
        variables.insert(
            "programmes_disponibles".to_string(),
            programmes_info.clone(),
        );

        let prompt = crate::services::ia::prompt_loader::load_prompt_section_with_vars(
            "bourse_livre",
            "Analyse Recto-Verso Livre",
            &variables,
        )
        .await
        .unwrap_or_else(|e| {
            log::warn!(
                "[BookExchangeAIService] Erreur chargement prompt recto-verso, utilisation fallback: {}",
                e
            );
            // Fallback: construire un prompt hyper-contextuel directement
            format!(
                r#"Tu es un expert en analyse de livres scolaires pour la plateforme Yukpo.

CONTEXTE GÉOGRAPHIQUE ET ACADÉMIQUE:
- Localisation utilisateur: lat={lat}, lng={lng}
- Pays détecté: {country}
- Système scolaire: {system_name}
- Langue du système: {lang}
- Devise locale: {currency}

HIÉRARCHIE DES CLASSES ({system_name}):
{hierarchy}
IMPORTANT: La DERNIÈRE classe de la hiérarchie (marquée FIN) n'a PAS de classe supérieure → classe_souhaitee=null, le livre ne peut être que VENDU.

TON RÔLE - ANALYSER LES DEUX FACES DU LIVRE:
1. EXTRACTION: titre, auteur, éditeur, ISBN, classe du livre (classe_actuelle), matière, niveau
2. CLASSE SUPÉRIEURE (OBLIGATOIRE): L'élève a DÉJÀ UTILISÉ ce livre → il passe en classe supérieure.
   classe_souhaitee = classe IMMÉDIATEMENT SUPÉRIEURE selon la hiérarchie ci-dessus.
   Si c'est la dernière classe → classe_souhaitee=null.
3. PRIX & DEVISE (CRITIQUE — le prix détermine la valeur de troc/vente):
   Priorité 1: Lire le prix IMPRIMÉ sur le livre — VERSO (4ème de couverture, code-barres, bandeau prix, autocollant éditeur). Formats: "3 500 FCFA", "Prix: 4500 F", "N 2,500".
   Priorité 2: Si aucun prix visible MAIS tu reconnais le livre (titre+auteur+éditeur), utilise TA CONNAISSANCE pour donner le prix réel en librairie. Ex: "CIAM Maths 3ème" = ~4200 FCFA. Ajoute "prix_estime_par_ia" dans notes.
   Priorité 3: Si tu ne reconnais pas le livre, estime un prix médian selon le niveau (primaire ~3000, collège ~4500, lycée ~6000 {currency}). Ajoute "prix_estime_generique" dans notes.
   NE PAS laisser prix_detecte à null sauf livre totalement illisible. Devise par défaut: {currency}
4. ÉTAT: "bon", "acceptable" ou "rejete" (minuscules sans accent, décision VISUELLE obligatoire)
5. PROGRAMME SCOLAIRE: {programmes}

ADAPTATION INTELLIGENTE:
- Si le livre utilise des appellations différentes du système détecté, ADAPTE-TOI.
- Utilise ta connaissance des systèmes éducatifs africains pour faire la correspondance.
- Si tu détectes que le livre vient d'un système DIFFÉRENT, signale-le dans les notes.

Réponds en JSON strict avec: titre, auteur, editeur, isbn, classe_actuelle, classe_souhaitee, matiere, niveau, prix_detecte, devise_detectee, etat_classification, etat_description, est_au_programme, programme_scolaire_id, programme_match_details, confidence, notes."#,
                lat = lat,
                lng = lng,
                country = country_code.to_uppercase(),
                system_name = detected_system.name,
                lang = detected_system.language,
                currency = detected_system.currency,
                hierarchy = hierarchy_desc,
                programmes = programmes_info,
            )
        });

        let images = vec![
            image_recto_base64.to_string(),
            image_verso_base64.to_string(),
        ];

        let (model_name, response, tokens) =
            self.app_ia.predict_multimodal(&prompt, Some(images)).await.map_err(|e| {
                log::error!(
                    "[BookExchangeAIService] Erreur IA multimodale recto-verso: {}",
                    e
                );
                crate::core::types::AppError::Internal("Erreur analyse IA recto-verso".to_string())
            })?;

        log::info!(
            "[BookExchangeAIService] Analyse recto-verso effectuée avec {} (tokens: {})",
            model_name,
            tokens
        );

        let response_json = Self::sanitize_recto_verso_llm_json(&response);
        let analysis: BookRectoVersoAnalysis = match serde_json::from_str(&response_json) {
            Ok(a) => a,
            Err(e) => {
                log::warn!(
                    "[BookExchangeAIService] Erreur parsing JSON recto-verso: {}. Réponse (500): {}",
                    e,
                    &response[..response.len().min(500)]
                );
                BookRectoVersoAnalysis {
                    titre: None,
                    auteur: None,
                    editeur: None,
                    isbn: None,
                    classe_actuelle: None,
                    classe_souhaitee: None,
                    matiere: None,
                    niveau: None,
                    prix_detecte: None,
                    devise_detectee: Some("XAF".to_string()),
                    etat_classification: "acceptable".to_string(),
                    etat_description: "Analyse partielle, vérification manuelle recommandée"
                        .to_string(),
                    est_au_programme: None,
                    programme_scolaire_id: None,
                    programme_match_details: None,
                    confidence: 0.3,
                    notes: Some(format!("Erreur parsing: {}", e)),
                }
            }
        };

        // ✅ Fallback déterministe (GPS-aware): si l'IA a trouvé classe_actuelle mais pas classe_souhaitee,
        // ou si classe_souhaitee est incorrecte, on la recalcule en tenant compte du système scolaire détecté
        let mut analysis = analysis;
        analysis.etat_classification =
            Self::normalize_etat_classification_llm(&analysis.etat_classification);
        if let Some(ref classe_act) = analysis.classe_actuelle {
            if is_classe_terminale(classe_act) {
                // Dernière classe du système (Terminale, Upper Sixth, SSS 3, etc.)
                // PAS de classe supérieure → classe_souhaitee = None, mode = vente
                log::info!(
                    "[BookExchangeAIService] Classe terminale détectée ({}): classe_souhaitee=None, mode=vente",
                    classe_act
                );
                analysis.classe_souhaitee = None;
            } else {
                let computed = compute_classe_superieure_with_gps(classe_act, user_lat, user_lng);
                if analysis.classe_souhaitee.is_none()
                    || analysis.classe_souhaitee.as_deref() == Some("")
                {
                    log::info!(
                        "[BookExchangeAIService] Fallback classe_souhaitee (système {}): {} → {}",
                        detected_system.name,
                        classe_act,
                        computed
                    );
                    analysis.classe_souhaitee = Some(computed);
                }
            }
        }

        Ok(analysis)
    }

    /// ✅ V2 Phase 2: Extraire la liste de livres d'un fichier programme scolaire
    /// L'admin upload un PDF/Excel/Image et l'IA extrait tous les livres listés
    pub async fn extract_programme_from_file(
        &self,
        file_base64: &str,
        file_type: &str, // "pdf", "excel", "image"
        niveau: &str,
        periode_academique: &str,
        classe: Option<&str>,
    ) -> AppResult<ProgrammeExtractionResult> {
        let classe_str = classe.unwrap_or("Toutes");

        let prompt = format!(
            r#"Tu es un expert mondial en extraction de listes scolaires officielles. Tu traites des documents provenant de n'importe quel pays (Afrique, Europe, Amérique, Asie…) dans n'importe quelle langue.

CONTEXTE :
- Type de fichier : {}
- Niveau déclaré : {}
- Classe déclarée : {}
- Période académique : {}

DOCUMENT : Liste officielle de manuels, fournitures et matériel scolaire émise par un établissement scolaire. Peut être une photo de smartphone, un scan ou un PDF — parfois partiel, flou, ou partiellement manuscrit. La langue du document peut être française, anglaise, arabe, espagnole, ou autre.

RÈGLES D'EXTRACTION EXHAUSTIVE :
1. Extraire TOUTES les lignes : manuels scolaires, cahiers d'exercices (workbook/livret), fournitures, accessoires
2. Si une classe ou série (ex: A, C, D, Sciences, Lettres, Form 4, Year 9…) est visible sur le document, l'utiliser en priorité sur la valeur déclarée
3. Retranscrire les titres tels quels (majuscules, abréviations comprises)
4. Prix dans la devise locale — extraire la valeur numérique brute. Si un prix "ensemble" couvre plusieurs articles d'une même ligne, le répartir (si clair) ou le mettre uniquement sur l'article principal (livre de l'élève).
5. "est_obligatoire" = true si "O", "Oblig.", "✓", "Required", "Must", souligné, ou aucune mention ; false si "R", "Optionnel", "Recommended", "Facultatif"
6. Si le document est illisible ou vide, retourner livres:[] avec confidence < 0.3 et une note explicative
7. Ne pas inventer des titres non visibles dans le document
8. SÉPARATION CRITIQUE : si une ligne regroupe plusieurs articles distincts (ex: "Innovative Mathematics class 1 + Work Bk1", "Parlons Français 6ème + Livret d'activités", "Winners in English + Workbook", "Méthode de lecture + Cahier d'exercices"), créer DEUX entrées distinctes :
   - Article principal → type_article="livre", titre = titre original nettoyé (sans "+ Workbook…")
   - Article secondaire → type_article="workbook" si cahier d'exercices/livret/work book, "cahier" sinon ; titre = "{{titre principal}} — Workbook" ou "{{titre principal}} — Livret"
   Les deux partagent matière, classe et éditeur.
9. Éditeur : toujours extraire quand mentionné (NATHAN, CLE, MONDOUX, CAMBRIDGE, NMI, HABIBI, HUEBER, BELIN, etc.). L'éditeur suit souvent le titre ou l'auteur, parfois en colonne séparée.
10. SECTION ACCESSOIRES / FOURNITURES — OBLIGATOIRE À EXPLORER. Les listes primaires et collège contiennent presque toujours une section "FOURNITURES SCOLAIRES", "MATÉRIEL", "ACCESSOIRES", "ARTICLES DIVERS", "PAPETERIE", parfois en bas ou au verso du document, parfois sous forme de tableau ou liste à puces. Scanner cette section systématiquement et extraire :
    - Cahiers (préciser pagination 32/48/96/100/200 pages, type Seyès/petits carreaux/grands carreaux, format cahier TP / travaux pratiques)
    - Stylos (bille bleu/rouge/vert/noir), crayons HB, crayons de couleur, feutres, surligneurs
    - Gomme, taille-crayon, règle (20/30 cm), équerre, rapporteur, compas, stylo-plume, cartouches
    - Ardoise, craies, chiffon, éponge
    - Blouse / tablier / uniforme / tenue de sport
    - Sac / cartable, trousse, porte-documents, classeurs, chemises cartonnées, pochettes plastifiées
    - Ramette de papier A4, papier dessin, Canson, papier calque, étiquettes
    - Colle, ciseaux, agrafeuse, scotch, perforatrice
    - Calculatrice scientifique (mentionner modèle Casio FX / Texas Instruments si précisé)
    - Dictionnaire (Larousse, Robert, etc.), Bescherelle
    Chaque accessoire va dans le tableau `accessoires`, avec quantité si précisée. Si aucune section accessoires n'est détectable malgré exploration, retourner `accessoires: []` et préciser dans `notes`.

MÉTADONNÉES À EXTRAIRE DE L'EN-TÊTE :
- etablissement_detecte : nom de l'école (null si non visible)
- ville_detectee : ville ou région (null si non visible)
- session_detectee : année scolaire format "AAAA-AAAA" (null si non visible)
- classe_detectee : classe lisible sur le document (null si non visible)

RÉPONSE — JSON BRUT UNIQUEMENT, sans texte avant ni après, sans bloc markdown :
{{
    "livres": [
        {{
            "titre": "Innovative Mathematics class 1",
            "auteur": null,
            "editeur": "NMI",
            "isbn": null,
            "classe": "Class 1",
            "matiere": "Mathematics",
            "prix_officiel": 4500.0,
            "est_obligatoire": true,
            "type_article": "livre"
        }},
        {{
            "titre": "Innovative Mathematics class 1 — Workbook",
            "auteur": null,
            "editeur": "NMI",
            "isbn": null,
            "classe": "Class 1",
            "matiere": "Mathematics",
            "prix_officiel": null,
            "est_obligatoire": true,
            "type_article": "workbook"
        }}
    ],
    "accessoires": [
        {{ "nom": "Cahier 200 pages grands carreaux", "quantite": 3, "gamme": "standard", "prix_indicatif": null, "notes": null }},
        {{ "nom": "Cahier 96 pages Seyès", "quantite": 5, "gamme": "standard", "prix_indicatif": null, "notes": null }},
        {{ "nom": "Stylo bille bleu", "quantite": 4, "gamme": "entree", "prix_indicatif": null, "notes": null }},
        {{ "nom": "Crayon HB", "quantite": 3, "gamme": "entree", "prix_indicatif": null, "notes": null }},
        {{ "nom": "Ardoise + craies + chiffon", "quantite": 1, "gamme": "standard", "prix_indicatif": null, "notes": null }},
        {{ "nom": "Blouse blanche", "quantite": 2, "gamme": "standard", "prix_indicatif": null, "notes": null }}
    ],
    "nombre_total": 12,
    "classes_couvertes": ["Tle C"],
    "matieres_couvertes": ["Mathématiques", "Physique"],
    "etablissement_detecte": "Lycée Général Leclerc",
    "ville_detectee": "Douala",
    "session_detectee": "2025-2026",
    "classe_detectee": "Tle C",
    "notes": null,
    "confidence": 0.92
}}"#,
            file_type, niveau, classe_str, periode_academique
        );

        // Utiliser predict_multimodal si image/PDF, sinon predict textuel
        let (model_name, response, tokens) = if file_type == "image" || file_type == "pdf" {
            self.app_ia
                .predict_multimodal(&prompt, Some(vec![file_base64.to_string()]))
                .await?
        } else {
            // Pour Excel, on envoie comme texte (le contenu sera pré-extrait côté controller)
            self.app_ia.predict(&prompt).await?
        };

        log::info!(
            "[BookExchangeAIService] Extraction programme effectuée avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Strip markdown code blocks if IA wraps response in ```json ... ```
        let clean_response = response
            .trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();

        let result: ProgrammeExtractionResult = match serde_json::from_str(clean_response) {
            Ok(r) => r,
            Err(e) => {
                log::warn!(
                    "[BookExchangeAIService] Erreur parsing extraction: {}. Réponse: {}",
                    e,
                    &clean_response[..clean_response.len().min(500)]
                );
                ProgrammeExtractionResult {
                    livres: vec![],
                    nombre_total: 0,
                    classes_couvertes: vec![],
                    matieres_couvertes: vec![],
                    notes: Some(format!("Erreur parsing: {}", e)),
                    confidence: 0.2,
                    etablissement_detecte: None,
                    ville_detectee: None,
                    session_detectee: None,
                    classe_detectee: None,
                    accessoires: vec![],
                }
            }
        };

        Ok(result)
    }

    /// Clé Redis stable pour le cache prix national ↔ ligne établissement.
    fn prix_national_cache_key(
        pays: &str,
        periode: &str,
        classe: &str,
        matiere: &str,
        titre: &str,
        isbn: Option<&str>,
    ) -> String {
        let mut h = DefaultHasher::new();
        pays.to_lowercase().hash(&mut h);
        periode.to_lowercase().hash(&mut h);
        classe.to_lowercase().hash(&mut h);
        matiere.to_lowercase().hash(&mut h);
        titre.trim().to_lowercase().hash(&mut h);
        isbn.unwrap_or("").to_lowercase().hash(&mut h);
        format!("bourse:livre_prix_national:v1:{:x}", h.finish())
    }

    /// Rapprochement heuristique (ISBN, titre, classe, matière) sur le référentiel national.
    fn best_national_match_for_etablissement(
        programmes: &[ProgrammeScolaire],
        titre: &str,
        classe: &str,
        matiere: &str,
        isbn: Option<&str>,
    ) -> Option<(i32, Decimal)> {
        let isbn_k = isbn.map(Self::normalize_isbn_key).filter(|s| !s.is_empty());
        let titre_u = titre.trim().to_lowercase();
        let classe_u = classe.trim().to_lowercase();
        let matiere_u = matiere.trim().to_lowercase();

        let mut best_score: i32 = 0;
        let mut best_price = Decimal::ZERO;
        let mut best_id: Option<i32> = None;

        for prog in programmes.iter().filter(|p| p.is_active) {
            let Some(v) = prog.prix_officiel else {
                continue;
            };
            if v <= Decimal::ZERO {
                continue;
            }

            let mut score: i32 = 0;
            if let Some(ref ik) = isbn_k {
                if prog.isbn_livre.as_deref().map(Self::normalize_isbn_key).as_ref() == Some(ik) {
                    score += 100;
                }
            }
            if !titre_u.is_empty() {
                let tp = prog.titre_livre.to_lowercase();
                if tp.contains(&titre_u) || titre_u.contains(&tp) {
                    score += 45;
                }
            }
            if !classe_u.is_empty() && prog.classe.to_lowercase().trim() == classe_u {
                score += 28;
            }
            if !matiere_u.is_empty() && prog.matiere.to_lowercase().trim() == matiere_u {
                score += 22;
            }

            if score >= 50 && (score > best_score || (score == best_score && v > best_price)) {
                best_score = score;
                best_price = v;
                best_id = Some(prog.id);
            }
        }

        best_id.map(|id| (id, best_price))
    }

    async fn apply_prix_to_etablissement_row(
        pool: &PgPool,
        row_id: i32,
        prix: Decimal,
        national_id: i32,
    ) {
        if prix <= Decimal::ZERO {
            return;
        }
        if let Err(e) = sqlx::query(
            r#"
            UPDATE programmes_scolaires
            SET prix_officiel = $1, updated_at = NOW()
            WHERE id = $2 AND etablissement_id IS NOT NULL
            "#,
        )
        .bind(prix)
        .bind(row_id)
        .execute(pool)
        .await
        {
            log::warn!(
                "[BookExchangeAIService] enrich_prix MAJ programmes_scolaires id={} national_id={}: {}",
                row_id,
                national_id,
                e
            );
        }
    }

    /// Complète `prix_officiel` (prix neuf référentiel) pour une ligne établissement :
    /// 1) cache Redis, 2) rapprochement SQL/heuristique sur programmes nationaux (`etablissement_id` NULL),
    /// 3) AppIA (`match_livre_to_programme`) si nécessaire, puis re-cache Redis (TTL 7 j).
    pub async fn enrich_etablissement_row_prix_depuis_national(
        &self,
        pool: &PgPool,
        redis: Option<&RedisClient>,
        row_id: i32,
        titre: &str,
        auteur: Option<&str>,
        classe: &str,
        matiere: &str,
        isbn: Option<&str>,
        pays: &str,
        periode: &str,
        prix_actuel: Option<Decimal>,
    ) {
        if prix_actuel.map(|p| p > Decimal::ZERO).unwrap_or(false) {
            return;
        }

        let cache_key = Self::prix_national_cache_key(pays, periode, classe, matiere, titre, isbn);

        #[derive(Serialize, Deserialize)]
        struct PrixNationalCache {
            prix: String,
            programme_national_id: i32,
        }

        if let Some(client) = redis {
            match crate::utils::redis_helper::get_with_retry(client, &cache_key).await {
                Ok(Some(raw)) => {
                    if let Ok(cached) = serde_json::from_str::<PrixNationalCache>(&raw) {
                        if let Ok(d) = Decimal::from_str_exact(&cached.prix)
                            .or_else(|_| Decimal::from_str(&cached.prix))
                        {
                            Self::apply_prix_to_etablissement_row(
                                pool,
                                row_id,
                                d,
                                cached.programme_national_id,
                            )
                            .await;
                            log::info!(
                                target: "yukpo.programme_prix",
                                "[enrich_etablissement_row_prix] cache_hit row_id={}",
                                row_id
                            );
                            return;
                        }
                    }
                }
                Ok(None) => {}
                Err(e) => log::debug!(
                    "[BookExchangeAIService] Redis cache miss/err enrich prix: {}",
                    e
                ),
            }
        }

        let programmes: Vec<ProgrammeScolaire> = sqlx::query_as(
            r#"
            SELECT * FROM programmes_scolaires
            WHERE is_active = true
              AND etablissement_id IS NULL
              AND pays = $1
              AND (periode_academique = $2 OR COALESCE(annee_scolaire, '') = $2)
              AND prix_officiel IS NOT NULL AND prix_officiel > 0
              AND (
                  extraction_status IS NULL
                  OR extraction_status = 'done'
                  OR extraction_status = ''
              )
            ORDER BY id DESC
            LIMIT 280
            "#,
        )
        .bind(pays)
        .bind(periode)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        if let Some((nid, best_price)) =
            Self::best_national_match_for_etablissement(&programmes, titre, classe, matiere, isbn)
        {
            Self::apply_prix_to_etablissement_row(pool, row_id, best_price, nid).await;
            if let Some(client) = redis {
                let c = PrixNationalCache {
                    prix: best_price.to_string(),
                    programme_national_id: nid,
                };
                if let Ok(json) = serde_json::to_string(&c) {
                    let _ = crate::utils::redis_helper::set_with_retry(
                        client,
                        &cache_key,
                        &json,
                        Some(604_800),
                    )
                    .await;
                }
            }
            log::info!(
                target: "yukpo.programme_prix",
                "[enrich_etablissement_row_prix] heuristic row_id={} national_id={}",
                row_id,
                nid
            );
            return;
        }

        if programmes.is_empty() {
            log::debug!(
                "[BookExchangeAIService] Aucun programme national pour pays={} période={} — pas d'enrichissement IA",
                pays,
                periode
            );
            return;
        }

        let slice: Vec<&ProgrammeScolaire> = programmes.iter().take(100).collect();
        let programmes_json = serde_json::to_string(&slice).unwrap_or_else(|_| "[]".to_string());
        let date_troc = chrono::Utc::now().format("%Y-%m-%d").to_string();

        let match_result = self
            .match_livre_to_programme(titre, auteur, classe, matiere, &date_troc, &programmes_json)
            .await;

        let Ok(m) = match_result else {
            return;
        };
        if !m.matched || m.score_match < 0.48 {
            return;
        }
        let Some(p) = m.prix_officiel.filter(|x| x.is_finite() && *x > 0.0) else {
            return;
        };
        let Some(nid) = m.programme_scolaire_id else {
            return;
        };
        let Some(d) = Decimal::from_f64_retain(p) else {
            return;
        };

        Self::apply_prix_to_etablissement_row(pool, row_id, d, nid).await;
        if let Some(client) = redis {
            let c = PrixNationalCache {
                prix: d.to_string(),
                programme_national_id: nid,
            };
            if let Ok(json) = serde_json::to_string(&c) {
                let _ = crate::utils::redis_helper::set_with_retry(
                    client,
                    &cache_key,
                    &json,
                    Some(604_800),
                )
                .await;
            }
        }
        log::info!(
            target: "yukpo.programme_prix",
            "[enrich_etablissement_row_prix] app_ia row_id={} national_id={} score={:.2}",
            row_id,
            nid,
            m.score_match
        );
    }

    /// ✅ V2 Phase 2: Matching intelligent livre ↔ programme scolaire
    /// Prend en compte la date du troc pour matcher le bon programme académique
    pub async fn match_livre_to_programme(
        &self,
        titre_livre: &str,
        auteur_livre: Option<&str>,
        classe: &str,
        matiere: &str,
        date_troc: &str,       // Date ISO pour déterminer la période académique
        programmes_json: &str, // JSON des programmes disponibles
    ) -> AppResult<ProgrammeMatchResult> {
        let auteur = auteur_livre.unwrap_or("Inconnu");

        let prompt = format!(
            r#"Tu es un expert en matching de livres scolaires avec les programmes officiels.

LIVRE À MATCHER :
- Titre : {}
- Auteur : {}
- Classe : {}
- Matière : {}
- Date du troc/échange : {}

PROGRAMMES SCOLAIRES DISPONIBLES (JSON) :
{}

TON RÔLE :
1. Déterminer la période académique correspondant à la date du troc
   - Ex: date "2026-01-15" → période "2025-2026"
   - La rentrée est en septembre, donc sept 2025 → juil 2026 = période "2025-2026"
2. Filtrer les programmes de la bonne période académique
3. Matcher le livre avec le meilleur programme possible
   - Matching flou sur titre (tolérance fautes de frappe, abréviations)
   - Matching sur auteur si disponible
   - Matching exact sur classe et matière
4. Calculer un score de confiance

RÉPONSE ATTENDUE (JSON strict) :
{{
    "matched": true,
    "programme_scolaire_id": 42,
    "periode_academique_detectee": "2025-2026",
    "score_match": 0.92,
    "titre_programme": "Titre officiel dans le programme",
    "est_obligatoire": true,
    "prix_officiel": 5000.0,
    "reasoning": "Explication du matching",
    "alternatives": []
}}"#,
            titre_livre, auteur, classe, matiere, date_troc, programmes_json
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[BookExchangeAIService] Matching programme effectué avec {} (tokens: {})",
            model_name,
            tokens
        );

        let result: ProgrammeMatchResult = match serde_json::from_str(&response) {
            Ok(r) => r,
            Err(e) => {
                log::warn!("[BookExchangeAIService] Erreur parsing matching: {}", e);
                ProgrammeMatchResult {
                    matched: false,
                    programme_scolaire_id: None,
                    periode_academique_detectee: None,
                    score_match: 0.0,
                    titre_programme: None,
                    est_obligatoire: None,
                    prix_officiel: None,
                    reasoning: format!("Matching non résolu: {}", e),
                    alternatives: vec![],
                }
            }
        };

        Ok(result)
    }
}

/// Résultat d'extraction de programme scolaire
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgrammeExtractionResult {
    pub livres: Vec<crate::models::livre_scolaire::LivreExtraitProgramme>,
    pub nombre_total: i32,
    pub classes_couvertes: Vec<String>,
    pub matieres_couvertes: Vec<String>,
    pub notes: Option<String>,
    pub confidence: f64,
    /// Nom d'établissement détecté sur l'entête du document (optionnel).
    #[serde(default)]
    pub etablissement_detecte: Option<String>,
    /// Ville détectée sur l'entête (optionnel).
    #[serde(default)]
    pub ville_detectee: Option<String>,
    /// Session académique détectée ("2025-2026") (optionnel).
    #[serde(default)]
    pub session_detectee: Option<String>,
    /// Classe détectée sur le document (pour détection mismatch).
    #[serde(default)]
    pub classe_detectee: Option<String>,
    /// Accessoires avec quantité et gamme (optionnels).
    #[serde(default)]
    pub accessoires: Vec<AccessoireExtrait>,
}

/// Accessoire scolaire détecté dans une liste (cahier, trousse, compas…).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AccessoireExtrait {
    pub nom: String,
    #[serde(default)]
    pub quantite: Option<i32>,
    /// "entree" | "standard" | "premium"
    #[serde(default)]
    pub gamme: Option<String>,
    #[serde(default)]
    pub prix_indicatif: Option<f64>,
    #[serde(default)]
    pub notes: Option<String>,
}

/// Résultat de matching livre ↔ programme
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgrammeMatchResult {
    pub matched: bool,
    pub programme_scolaire_id: Option<i32>,
    pub periode_academique_detectee: Option<String>,
    pub score_match: f64,
    pub titre_programme: Option<String>,
    pub est_obligatoire: Option<bool>,
    pub prix_officiel: Option<f64>,
    pub reasoning: String,
    pub alternatives: Vec<serde_json::Value>,
}

/// Résultat d'analyse recto-verso d'un livre
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookRectoVersoAnalysis {
    pub titre: Option<String>,
    pub auteur: Option<String>,
    pub editeur: Option<String>,
    pub isbn: Option<String>,
    pub classe_actuelle: Option<String>,
    pub classe_souhaitee: Option<String>,
    pub matiere: Option<String>,
    pub niveau: Option<String>,
    pub prix_detecte: Option<f64>,
    pub devise_detectee: Option<String>,
    pub etat_classification: String, // "bon", "acceptable", "rejete"
    pub etat_description: String,
    pub est_au_programme: Option<bool>,
    pub programme_scolaire_id: Option<i32>,
    pub programme_match_details: Option<String>,
    pub confidence: f64,
    pub notes: Option<String>,
}
