# Script PowerShell pour corriger l'encodage des fichiers Rust
# Remplace les caractères spéciaux corrompus par les bons caractères

$files = @(
    "src/controllers/auth_controller.rs",
    "src/controllers/user_controller.rs",
    "src/controllers/service_controller.rs",
    "src/controllers/media_controller.rs",
    "src/controllers/echange_controller.rs",
    "src/controllers/payment_controller.rs",
    "src/middlewares/check_tokens.rs",
    "src/middlewares/service_interaction.rs",
    "src/services/creer_service.rs",
    "src/services/embedding_tracker.rs",
    "src/services/traiter_echange.rs",
    "src/services/rechercher_besoin.rs",
    "src/services/programme_service.rs",
    "src/services/matching_pipeline.rs",
    "src/services/service_history_service.rs",
    "src/services/embedding_service.rs",
    "src/services/db_optimizer.rs",
    "src/services/alert_service.rs",
    "src/services/service_lifecycle_manager.rs",
    "src/routers/router_yukpo.rs",
    "src/tasks/matching_echange_cron.rs",
    "src/tasks/reactivate_service.rs",
    "src/tasks/service_deactivation.rs"
)

# Mappings de correction
$replacements = @{
    "d\?" = "dé"
    "r\?" = "ré"
    "v\?" = "vé"
    "c\?" = "cé"
    "n\?" = "né"
    "p\?" = "pé"
    "s\?" = "sé"
    "t\?" = "té"
    "l\?" = "lé"
    "m\?" = "mé"
    "h\?" = "hé"
    "b\?" = "bé"
    "g\?" = "gé"
    "f\?" = "fé"
    "j\?" = "jé"
    "k\?" = "ké"
    "q\?" = "qué"
    "w\?" = "wé"
    "x\?" = "xé"
    "y\?" = "yé"
    "z\?" = "zé"
    "a\?" = "à"
    "e\?" = "è"
    "i\?" = "ì"
    "o\?" = "ò"
    "u\?" = "ù"
    "A\?" = "À"
    "E\?" = "È"
    "I\?" = "Ì"
    "O\?" = "Ò"
    "U\?" = "Ù"
    "c\?" = "ç"
    "C\?" = "Ç"
    "n\?" = "ñ"
    "N\?" = "Ñ"
    "a\?" = "â"
    "e\?" = "ê"
    "i\?" = "î"
    "o\?" = "ô"
    "u\?" = "û"
    "A\?" = "Â"
    "E\?" = "Ê"
    "I\?" = "Î"
    "O\?" = "Ô"
    "U\?" = "Û"
    "a\?" = "ä"
    "e\?" = "ë"
    "i\?" = "ï"
    "o\?" = "ö"
    "u\?" = "ü"
    "A\?" = "Ä"
    "E\?" = "Ë"
    "I\?" = "Ï"
    "O\?" = "Ö"
    "U\?" = "Ü"
}

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Correction de $file..."
        $content = Get-Content $file -Raw -Encoding UTF8
        
        foreach ($replacement in $replacements.GetEnumerator()) {
            $content = $content -replace $replacement.Key, $replacement.Value
        }
        
        Set-Content $file -Value $content -Encoding UTF8
        Write-Host "  ✓ $file corrigé"
    } else {
        Write-Host "  ⚠ $file non trouvé"
    }
}

Write-Host "Correction terminée !" 