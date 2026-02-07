# Correction des problèmes de connexion réseau Gradle

## Problème identifié

Les commandes PowerShell échouaient avec l'erreur :
```
Le jeton «&&» n'est pas un séparateur d'instruction valide.
```

**Cause** : PowerShell n'accepte pas `&&` comme séparateur de commandes. Il faut utiliser `;` à la place.

## Corrections apportées

### 1. Configuration réseau améliorée (`gradle.properties`)

Ajout de propriétés pour améliorer la résilience des connexions réseau :

```properties
# Timeouts réseau augmentés (2 minutes)
systemProp.org.gradle.internal.http.connectionTimeout=120000
systemProp.org.gradle.internal.http.socketTimeout=120000
systemProp.http.connectionTimeout=120000
systemProp.http.socketTimeout=120000
systemProp.https.connectionTimeout=120000
systemProp.https.socketTimeout=120000

# Retries améliorés
systemProp.org.gradle.internal.repository.max.retries=5
systemProp.org.gradle.internal.repository.initial.backoff=2000
```

### 2. Timeout wrapper Gradle (`gradle-wrapper.properties`)

Augmentation du timeout réseau de 60s à 120s :
```properties
networkTimeout=120000
```

### 3. Configuration repositories (`settings.gradle`)

La configuration des repositories reste optimisée pour éviter les timeouts.

## Commandes PowerShell corrigées

### ❌ Incorrect (ne fonctionne pas en PowerShell)
```powershell
cd C:\Users\23767\yukpomnang2 && git show ...
```

### ✅ Correct (utilise `;` au lieu de `&&`)
```powershell
cd C:\Users\23767\yukpomnang2; git show ...
```

## Exemples d'utilisation

### Comparer avec un commit de référence
```powershell
# Voir settings.gradle d'un commit spécifique
cd C:\Users\23767\yukpomnang2; git show a9b9a4acc64e7f35add72d7057e2d92943be7866:mobile/android/settings.gradle

# Voir package.json et filtrer les dépendances expo
cd C:\Users\23767\yukpomnang2; git show a9b9a4acc64e7f35add72d7057e2d92943be7866:mobile/package.json | Select-String -Pattern "expo" | Select-Object -First 10

# Voir l'historique des commits
cd C:\Users\23767\yukpomnang2; git log --oneline --all -20 -- mobile/android/settings.gradle mobile/package.json | Select-Object -First 20
```

### Tester la configuration réseau
```powershell
cd C:\Users\23767\yukpomnang2\mobile\android
.\test-network-config.ps1
```

### Exécuter Gradle avec logs détaillés
```powershell
cd C:\Users\23767\yukpomnang2\mobile\android
.\gradlew --info --stacktrace build
```

## Vérifications

1. ✅ Timeouts réseau augmentés à 120 secondes
2. ✅ Retries configurés (5 tentatives avec backoff de 2s)
3. ✅ Configuration des repositories optimisée
4. ✅ Script de test réseau créé

## Prochaines étapes

Si les problèmes de connexion persistent :

1. Vérifier la connectivité réseau :
   ```powershell
   Test-NetConnection -ComputerName repo1.maven.org -Port 443
   ```

2. Vérifier les proxies :
   ```powershell
   $env:HTTP_PROXY
   $env:HTTPS_PROXY
   ```

3. Nettoyer le cache Gradle :
   ```powershell
   cd C:\Users\23767\yukpomnang2\mobile\android
   .\gradlew clean --refresh-dependencies
   ```

4. Utiliser un miroir Maven local si disponible

