# 📱 Guide d'Extraction des Logs Mobiles

## 🎯 Problème
Les logs mobiles sont mélangés avec les logs backend, ce qui rend leur identification difficile.

## ✅ Solution

### 1. Formatage Amélioré des Logs Mobiles

Les logs mobiles sont maintenant formatés avec un préfixe distinctif :
- **Format** : `📱[MOBILE] [LEVEL] [Component] | User:ID | Device:Platform/Version`
- **Exemple** : `📱[MOBILE] [ERROR] [HomeScreen] | User:11 | Device:ios/17.0`

### 2. Scripts d'Extraction

Trois scripts sont disponibles pour extraire rapidement les logs mobiles :

#### A. Script Bash (Linux/Mac)
```bash
# Depuis un fichier
./scripts/extract_mobile_logs.sh logbackend1.md mobile_logs.txt

# Depuis stdin (pipe)
cat logbackend1.md | ./scripts/extract_mobile_logs.sh - mobile_logs.txt
```

#### B. Script PowerShell (Windows)
```powershell
# Depuis un fichier
.\scripts\extract_mobile_logs.ps1 -InputFile logbackend1.md -OutputFile mobile_logs.txt

# Depuis stdin
Get-Content logbackend1.md | Select-String -Pattern "📱\[MOBILE|MobileLog" | Out-File mobile_logs.txt
```

#### C. Script Python (Multi-plateforme)
```bash
# Depuis un fichier
python scripts/extract_mobile_logs.py logbackend1.md mobile_logs.txt

# Depuis stdin
cat logbackend1.md | python scripts/extract_mobile_logs.py - mobile_logs.txt
```

### 3. Extraction Manuelle avec grep

#### Linux/Mac
```bash
grep -E "📱\[MOBILE|MobileLog|MobileLogs" logbackend1.md > mobile_logs.txt
```

#### Windows (PowerShell)
```powershell
Select-String -Path logbackend1.md -Pattern "📱\[MOBILE|MobileLog|MobileLogs" | Out-File mobile_logs.txt
```

#### Windows (CMD)
```cmd
findstr /C:"📱[MOBILE" /C:"MobileLog" logbackend1.md > mobile_logs.txt
```

### 4. Extraction par Niveau de Log

#### Erreurs uniquement
```bash
grep "📱\[MOBILE\] \[ERROR\]" logbackend1.md > mobile_errors.txt
```

#### Warnings uniquement
```bash
grep "📱\[MOBILE\] \[WARN\]" logbackend1.md > mobile_warnings.txt
```

#### Par composant
```bash
grep "📱\[MOBILE\].*\[HomeScreen\]" logbackend1.md > mobile_homescreen.txt
```

### 5. Extraction avec Filtres Avancés

#### Par utilisateur
```bash
grep "📱\[MOBILE\].*User:11" logbackend1.md > mobile_user11.txt
```

#### Par device
```bash
grep "📱\[MOBILE\].*Device:ios" logbackend1.md > mobile_ios.txt
```

#### Par période (si timestamp présent)
```bash
grep "2025-11-27T11:1.*📱\[MOBILE" logbackend1.md > mobile_11h.txt
```

## 🔍 Identification Visuelle

Les logs mobiles sont facilement identifiables grâce à :
- **Emoji** : 📱 au début
- **Préfixe** : `[MOBILE]` en majuscules
- **Format structuré** : `[LEVEL] [Component] | User:ID | Device:Platform`

## 📊 Exemple de Log Mobile

```
📱[MOBILE] [ERROR] [HomeScreen] | User:11 | Device:ios/17.0 Erreur chargement services
📱[MOBILE] [ERROR] [HomeScreen] Data: {"error": "Network timeout"}
📱[MOBILE] [ERROR] [HomeScreen] Stack: Error: Network timeout at...
📱[MOBILE] [INFO] [LinearAutocompleteEditor] | User:11 Affichage tableau caractéristiques
📱[MOBILE-BATCH] Reçu 10 logs mobile (batch: abc123)
```

## 🚀 Workflow Recommandé

1. **Copier les logs backend** dans un fichier (ex: `logbackend1.md`)
2. **Extraire les logs mobiles** avec un des scripts
3. **Analyser** le fichier `mobile_logs.txt` généré
4. **Filtrer par niveau/composant** si nécessaire

## 💡 Astuce

Pour une extraction en temps réel depuis les logs backend :
```bash
tail -f backend.log | grep "📱\[MOBILE" > mobile_logs_live.txt
```

