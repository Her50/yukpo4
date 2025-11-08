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
    "src/tasks/reactivate_service.rs",
    "src/tasks/service_deactivation.rs"
)

# Mappings de correction (liste de paires pour éviter les clés dupliquées)
$replacements = @(
    @{ Pattern = "d\?"; Replacement = "dé" }
    @{ Pattern = "r\?"; Replacement = "ré" }
    @{ Pattern = "v\?"; Replacement = "vé" }
    @{ Pattern = "c\?"; Replacement = "cé" }
    @{ Pattern = "n\?"; Replacement = "né" }
    @{ Pattern = "p\?"; Replacement = "pé" }
    @{ Pattern = "s\?"; Replacement = "sé" }
    @{ Pattern = "t\?"; Replacement = "té" }
    @{ Pattern = "l\?"; Replacement = "lé" }
    @{ Pattern = "m\?"; Replacement = "mé" }
    @{ Pattern = "h\?"; Replacement = "hé" }
    @{ Pattern = "b\?"; Replacement = "bé" }
    @{ Pattern = "g\?"; Replacement = "gé" }
    @{ Pattern = "f\?"; Replacement = "fé" }
    @{ Pattern = "j\?"; Replacement = "jé" }
    @{ Pattern = "k\?"; Replacement = "ké" }
    @{ Pattern = "q\?"; Replacement = "qué" }
    @{ Pattern = "w\?"; Replacement = "wé" }
    @{ Pattern = "x\?"; Replacement = "xé" }
    @{ Pattern = "y\?"; Replacement = "yé" }
    @{ Pattern = "z\?"; Replacement = "zé" }
    @{ Pattern = "a\?"; Replacement = "à" }
    @{ Pattern = "e\?"; Replacement = "è" }
    @{ Pattern = "i\?"; Replacement = "ì" }
    @{ Pattern = "o\?"; Replacement = "ò" }
    @{ Pattern = "u\?"; Replacement = "ù" }
    @{ Pattern = "A\?"; Replacement = "À" }
    @{ Pattern = "E\?"; Replacement = "È" }
    @{ Pattern = "I\?"; Replacement = "Ì" }
    @{ Pattern = "O\?"; Replacement = "Ò" }
    @{ Pattern = "U\?"; Replacement = "Ù" }
    @{ Pattern = "c\?"; Replacement = "ç" }
    @{ Pattern = "C\?"; Replacement = "Ç" }
    @{ Pattern = "n\?"; Replacement = "ñ" }
    @{ Pattern = "N\?"; Replacement = "Ñ" }
    @{ Pattern = "a\?"; Replacement = "â" }
    @{ Pattern = "e\?"; Replacement = "ê" }
    @{ Pattern = "i\?"; Replacement = "î" }
    @{ Pattern = "o\?"; Replacement = "ô" }
    @{ Pattern = "u\?"; Replacement = "û" }
    @{ Pattern = "A\?"; Replacement = "Â" }
    @{ Pattern = "E\?"; Replacement = "Ê" }
    @{ Pattern = "I\?"; Replacement = "Î" }
    @{ Pattern = "O\?"; Replacement = "Ô" }
    @{ Pattern = "U\?"; Replacement = "Û" }
    @{ Pattern = "a\?"; Replacement = "ä" }
    @{ Pattern = "e\?"; Replacement = "ë" }
    @{ Pattern = "i\?"; Replacement = "ï" }
    @{ Pattern = "o\?"; Replacement = "ö" }
    @{ Pattern = "u\?"; Replacement = "ü" }
    @{ Pattern = "A\?"; Replacement = "Ä" }
    @{ Pattern = "E\?"; Replacement = "Ë" }
    @{ Pattern = "I\?"; Replacement = "Ï" }
    @{ Pattern = "O\?"; Replacement = "Ö" }
    @{ Pattern = "U\?"; Replacement = "Ü" }
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Correction de $file..."
        $content = Get-Content $file -Raw -Encoding UTF8
        
        foreach ($replacement in $replacements) {
            $content = $content -replace $replacement.Pattern, $replacement.Replacement
        }
        
        Set-Content $file -Value $content -Encoding UTF8
        Write-Host "  ✓ $file corrigé"
    }
    else {
        Write-Host "  ⚠ $file non trouvé"
    }
}

Write-Host "Correction terminée !" 