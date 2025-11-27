# 🚀 Extraction Rapide des Logs Mobiles

## Méthode la Plus Rapide (Windows PowerShell)

```powershell
# Copier les logs et extraire en une commande
Get-Content logbackend1.md | Select-String -Pattern "📱\[MOBILE|MobileLog" | Out-File mobile_logs.txt
```

## Méthode la Plus Rapide (Linux/Mac)

```bash
# Copier les logs et extraire en une commande
grep -E "📱\[MOBILE|MobileLog|MobileLogs" logbackend1.md > mobile_logs.txt
```

## Identification Visuelle

Les logs mobiles commencent maintenant par :
- **📱[MOBILE]** - Préfixe unique avec emoji
- Format : `📱[MOBILE] [LEVEL] [Component] | User:ID | Device:Platform/Version`

## Exemple de Log Mobile

```
📱[MOBILE] [ERROR] [HomeScreen] | User:11 | Device:ios/17.0 Erreur chargement
📱[MOBILE] [INFO] [LinearAutocompleteEditor] | User:11 Affichage tableau
📱[MOBILE-BATCH] Reçu 10 logs mobile (batch: abc123)
```

## Filtrage par Type

### Erreurs uniquement
```bash
grep "📱\[MOBILE\] \[ERROR\]" logbackend1.md > mobile_errors.txt
```

### Par composant
```bash
grep "📱\[MOBILE\].*\[HomeScreen\]" logbackend1.md > mobile_homescreen.txt
```

### Par utilisateur
```bash
grep "📱\[MOBILE\].*User:11" logbackend1.md > mobile_user11.txt
```

