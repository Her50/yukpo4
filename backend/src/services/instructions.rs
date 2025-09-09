use std::fs;

/// R?cup?re dynamiquement le contenu du fichier d'instruction.
/// En mode debug : lit depuis le fichier ? chaque appel (hot reload)
/// En mode release : met en cache ? la premi?re lecture
pub fn get_instruction_template() -> String {
    let chemin = "src/instructions/full_instruction_yukpo.txt";

    // Ajout d'une directive pour les services tarissables et sp?cifiques
    let base_instruction = "Analyse le besoin utilisateur et g?n?re un JSON structur? d?crivant le service. Si le service est tarissable, ajoute les champs 'is_tarissable' (bool?en) et 'vitesse_tarissement' (lente, moyenne, rapide). Pour les services sp?cifiques comme l'immobilier, inclue un champ 'gps' pour la g?olocalisation.";

    // En mode debug => toujours recharger le fichier
    #[cfg(debug_assertions)]
    {
        match fs::read_to_string(chemin) {
            Ok(content) => format!("{}\n{}", base_instruction, content),
            Err(e) => {
                eprintln!("?? Erreur de lecture du fichier instruction : {e}");
                base_instruction.to_string()
            }
        }
    }

    // En mode release => cache en m?moire (OnceLock)
    #[cfg(not(debug_assertions))]
    {
        fs::read_to_string(chemin).unwrap_or_else(|e| {
            eprintln!("?? Erreur de lecture du fichier instruction : {e}");
            base_instruction.to_string()
        })
    }
}





