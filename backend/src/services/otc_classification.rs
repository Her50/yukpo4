//! Classification statique des médicaments OTC (over-the-counter, vente libre)
//! pour le Cameroun.
//!
//! ⚠️ Conformité réglementaire :
//!   - Cette liste est utilisée comme **filtre** avant d'appeler l'IA pour
//!     suggérer une posologie. Si le médicament demandé n'apparaît pas dans
//!     la liste OTC, le service force `requires_prescription: true` SANS
//!     interroger l'IA — ce qui économise des tokens ET garantit que la PWA
//!     n'affichera jamais de posologie chiffrée pour un médicament qui devrait
//!     être prescrit par un médecin.
//!   - Source : adapté du contexte MINSANTE Cameroun / CEMAC. À enrichir
//!     dans `backend/data/otc_medications_cm.json` au fil du temps.
//!   - Comparaison large : normalisation accents/casse + matching DCI OU marque.
//!   - En cas de doute (parsing JSON échoue) → considère TOUT comme prescription
//!     (défaut conservateur).

use once_cell::sync::Lazy;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct OtcEntry {
    dci: String,
    #[serde(default)]
    brands: Vec<String>,
    #[allow(dead_code)]
    #[serde(default)]
    category: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OtcFile {
    #[serde(default)]
    otc: Vec<OtcEntry>,
}

const OTC_JSON: &str = include_str!("../../data/otc_medications_cm.json");

// Charge la liste OTC une fois au démarrage et la met en cache statique.
// Si le fichier est mal formé, on logge et on retourne une liste vide ; toutes
// les requêtes seront alors classées comme prescription (défaut prudent).
static OTC_INDEX: Lazy<Vec<String>> = Lazy::new(|| {
    match serde_json::from_str::<OtcFile>(OTC_JSON) {
        Ok(file) => {
            let mut idx: Vec<String> = Vec::new();
            for entry in &file.otc {
                idx.push(normalize(&entry.dci));
                for b in &entry.brands {
                    idx.push(normalize(b));
                }
            }
            log::info!(
                "[otc_classification] Index chargé : {} clés ({} entrées)",
                idx.len(),
                file.otc.len()
            );
            idx
        }
        Err(e) => {
            log::error!(
                "[otc_classification] Parse JSON échoué : {} — fallback liste vide (tout sera classé prescription)",
                e
            );
            Vec::new()
        }
    }
});

/// Normalise un nom de médicament : minuscules, sans accents, trim, espaces
/// multiples réduits. Permet de matcher "Doliprane" / "doliprane" / "DOLIPRANE"
/// ou "Paracétamol" / "Paracetamol".
fn normalize(s: &str) -> String {
    let lower = s.to_lowercase();
    // Suppression simple des accents courants — sans nécessiter de crate Unicode
    // (suffisant pour le français/portugais usuels). On reste sur de l'ASCII.
    let mut out = String::with_capacity(lower.len());
    for c in lower.chars() {
        let mapped = match c {
            'à' | 'á' | 'â' | 'ã' | 'ä' | 'å' => 'a',
            'è' | 'é' | 'ê' | 'ë' => 'e',
            'ì' | 'í' | 'î' | 'ï' => 'i',
            'ò' | 'ó' | 'ô' | 'õ' | 'ö' => 'o',
            'ù' | 'ú' | 'û' | 'ü' => 'u',
            'ý' | 'ÿ' => 'y',
            'ç' => 'c',
            'ñ' => 'n',
            _ => c,
        };
        out.push(mapped);
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Retourne `true` si le médicament est connu comme OTC (vente libre) selon
/// la liste statique. Le matching est "contient" — utile pour les libellés
/// composés ("paracétamol 500 mg comprimé pelliculé").
pub fn is_otc(medication_name: &str) -> bool {
    if OTC_INDEX.is_empty() {
        return false;
    }
    let needle = normalize(medication_name);
    if needle.is_empty() {
        return false;
    }
    OTC_INDEX.iter().any(|known| {
        // Match dans les deux sens : "doliprane 500 mg" contient "doliprane",
        // et "paracetamol" est contenu dans "paracetamol biogaran".
        needle.contains(known.as_str()) || known.contains(needle.as_str())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paracetamol_is_otc() {
        assert!(is_otc("Paracétamol"));
        assert!(is_otc("paracetamol 500 mg"));
        assert!(is_otc("Doliprane"));
        assert!(is_otc("doliprane 1000"));
    }

    #[test]
    fn antibiotic_is_not_otc() {
        assert!(!is_otc("Amoxicilline"));
        assert!(!is_otc("Azithromycine"));
    }

    #[test]
    fn unknown_is_not_otc() {
        assert!(!is_otc(""));
        assert!(!is_otc("zzzz unknown medicine"));
    }
}
