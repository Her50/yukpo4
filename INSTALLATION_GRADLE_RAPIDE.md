# 🚀 Installation rapide de Gradle 8.8

## ✅ Téléchargement déjà effectué

Vous avez téléchargé **gradle-8.8-all.zip** ou **gradle-8.8-bin.zip**

## 📋 Deux méthodes d'installation

---

### 🤖 MÉTHODE 1 : Automatique (RECOMMANDÉE)

#### Étape 1 : Ouvrir PowerShell en Administrateur
1. Appuyez sur `Windows + X`
2. Cliquez sur "**Windows PowerShell (Admin)**" ou "**Terminal (Admin)**"

#### Étape 2 : Exécuter le script
```powershell
cd C:\Users\23767\yukpomnang2
.\scripts\install-gradle-manual.ps1
```

Le script va :
- ✓ Chercher le fichier ZIP dans vos Téléchargements
- ✓ L'extraire dans `C:\Gradle\gradle-8.8`
- ✓ Configurer GRADLE_HOME
- ✓ Ajouter Gradle au PATH
- ✓ Vérifier l'installation

#### Étape 3 : Redémarrer le terminal
1. Fermez TOUS les terminaux
2. Ouvrez un nouveau PowerShell

#### Étape 4 : Vérifier
```powershell
gradle --version
```

---

### 🛠️ MÉTHODE 2 : Manuelle

#### Étape 1 : Extraire le ZIP
1. Allez dans **Téléchargements**
2. Trouvez **gradle-8.8-all.zip** (ou gradle-8.8-bin.zip)
3. Clic droit → **Extraire tout...**
4. Extrayez dans `C:\Gradle\`
5. Renommez le dossier en **gradle-8.8** si nécessaire

Vous devez avoir : `C:\Gradle\gradle-8.8\bin\gradle.bat`

#### Étape 2 : Variables d'environnement

**Option A : PowerShell Admin**
```powershell
# Copier-coller ces 3 commandes :
[System.Environment]::SetEnvironmentVariable('GRADLE_HOME', 'C:\Gradle\gradle-8.8', 'Machine')

$path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
[System.Environment]::SetEnvironmentVariable('Path', "$path;C:\Gradle\gradle-8.8\bin", 'Machine')

Write-Host "✅ Gradle configuré!"
```

**Option B : Interface graphique**
1. Clic droit sur **Ce PC** → **Propriétés**
2. **Paramètres système avancés**
3. **Variables d'environnement**
4. Dans "Variables système" :
   - Cliquez **Nouvelle** :
     - Nom : `GRADLE_HOME`
     - Valeur : `C:\Gradle\gradle-8.8`
   - Sélectionnez **Path** → **Modifier**
   - Cliquez **Nouveau**
   - Ajoutez : `C:\Gradle\gradle-8.8\bin`
   - **OK** partout

#### Étape 3 : Redémarrer le terminal
Fermez TOUS les terminaux et rouvrez-en un nouveau

#### Étape 4 : Vérifier
```powershell
gradle --version
```

---

## ✅ Vérification réussie

Vous devriez voir :

```
------------------------------------------------------------
Gradle 8.8
------------------------------------------------------------

Build time:   2024-05-31 21:46:56 UTC
Revision:     4bd1b3d3fc3f31db5a26eecb416a165b8cc36082

Kotlin:       1.9.22
Groovy:       3.0.21
JVM:          17.0.x
OS:           Windows 10 10.0 amd64
```

---

## ❌ Problèmes courants

### "gradle n'est pas reconnu"
**Cause** : Terminal pas redémarré ou PATH incorrect

**Solutions** :
```powershell
# 1. Vérifier le PATH dans la session actuelle
$env:Path

# 2. Si Gradle n'y est pas, ajouter temporairement :
$env:Path += ";C:\Gradle\gradle-8.8\bin"

# 3. Tester
gradle --version

# 4. Redémarrer le terminal pour rendre permanent
```

### "Could not find or load main class"
**Cause** : Extraction incomplète ou Java manquant

**Solutions** :
```powershell
# Vérifier que gradle.bat existe
Test-Path C:\Gradle\gradle-8.8\bin\gradle.bat

# Vérifier Java
java -version
```

Si Java n'est pas installé → Installez JDK 17

### Mauvaise version affichée
**Cause** : Ancien Gradle dans le PATH avant le nouveau

**Solution** :
```powershell
# Voir quel gradle est utilisé
where.exe gradle

# Le premier doit être C:\Gradle\gradle-8.8\bin\gradle.bat
# Sinon, réorganiser le PATH pour mettre C:\Gradle\gradle-8.8\bin en premier
```

---

## 🎯 Prochaines étapes

Après l'installation de Gradle :

1. **Vérifier les autres prérequis** :
   ```powershell
   # Java JDK 17
   java -version
   
   # Android SDK
   $env:ANDROID_HOME
   ```

2. **Tester le build Android** :
   ```powershell
   cd mobile\android
   .\gradlew assembleRelease
   ```

3. **Suivre le guide complet** :
   - `GUIDE_BUILD_ANDROID_LOCAL.md`
   - `INSTALLATION_ANDROID_COMPLETE.md`

---

## 📚 Fichiers utiles

- **Guide détaillé** : `INSTALLATION_GRADLE_MANUEL.md`
- **Script automatique** : `scripts\install-gradle-manual.ps1`
- **Build Android** : `GUIDE_BUILD_ANDROID_LOCAL.md`
- **Android Studio** : `APRES_INSTALLATION_ANDROID_STUDIO.md`

---

## 🆘 Besoin d'aide ?

Si rien ne fonctionne :
1. Vérifiez les permissions (exécutez en Admin)
2. Désactivez temporairement l'antivirus
3. Vérifiez l'intégrité du fichier ZIP téléchargé
4. Réessayez le téléchargement depuis : https://gradle.org/releases/

