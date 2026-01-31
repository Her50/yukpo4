# 🔍 Diagnostic : Impossible de se Connecter à la Console AWS

## 📋 Symptômes

- ❌ Impossible d'accéder à la console AWS
- ✅ Internet fonctionne normalement
- ✅ Autres sites web accessibles

---

## 🔍 Causes Possibles

### 1. Problème DNS

**Symptôme** : Le site ne charge pas, erreur "DNS_PROBE_FINISHED_NXDOMAIN"

**Solution** :
```powershell
# Tester la résolution DNS
nslookup console.aws.amazon.com

# Si échec, essayer un autre DNS
# Changer le DNS vers 8.8.8.8 (Google) ou 1.1.1.1 (Cloudflare)
```

### 2. Problème de Certificat SSL/TLS

**Symptôme** : Erreur "Votre connexion n'est pas privée" ou "NET::ERR_CERT_AUTHORITY_INVALID"

**Solution** :
- Vérifier la date/heure de votre système (doit être correcte)
- Essayer un autre navigateur
- Vider le cache SSL du navigateur

### 3. Blocage par Pare-feu/Proxy

**Symptôme** : Timeout, connexion refusée

**Solution** :
- Vérifier les paramètres de proxy
- Vérifier les règles de pare-feu Windows
- Essayer depuis un autre réseau (hotspot mobile)

### 4. Problème de Navigateur

**Symptôme** : Erreurs spécifiques au navigateur

**Solution** :
- Essayer un autre navigateur (Chrome, Firefox, Edge)
- Désactiver les extensions (mode incognito)
- Vider le cache et les cookies
- Réinitialiser les paramètres réseau du navigateur

### 5. Compte AWS Suspendu/Bloqué

**Symptôme** : Page de connexion charge mais connexion échoue

**Solution** :
- Vérifier l'email associé au compte AWS
- Contacter le support AWS
- Vérifier les factures impayées

### 6. Maintenance AWS

**Symptôme** : Erreur 503 ou page de maintenance

**Solution** :
- Vérifier le statut AWS : https://status.aws.amazon.com/
- Attendre la fin de la maintenance

### 7. Problème de Région

**Symptôme** : Console charge mais certaines régions inaccessibles

**Solution** :
- Essayer une autre région AWS
- URL directe : https://console.aws.amazon.com/ec2/v2/home?region=us-east-1

---

## 🔧 Tests de Diagnostic

### Test 1 : Vérifier la Résolution DNS

```powershell
# Test DNS
nslookup console.aws.amazon.com
nslookup signin.aws.amazon.com

# Si échec, essayer avec un autre DNS
nslookup console.aws.amazon.com 8.8.8.8
```

### Test 2 : Tester la Connexion HTTPS

```powershell
# Test connexion HTTPS
Test-NetConnection -ComputerName console.aws.amazon.com -Port 443

# Ou avec curl
curl -I https://console.aws.amazon.com
```

### Test 3 : Vérifier les Paramètres Proxy

```powershell
# Vérifier les paramètres proxy Windows
netsh winhttp show proxy

# Si un proxy est configuré, essayer de le désactiver temporairement
netsh winhttp reset proxy
```

### Test 4 : Vérifier la Date/Heure

```powershell
# Vérifier la date/heure système
Get-Date

# Si incorrecte, synchroniser avec Internet
w32tm /resync
```

### Test 5 : Tester depuis un Autre Réseau

- Essayer depuis un hotspot mobile
- Essayer depuis un autre ordinateur
- Essayer depuis un VPN

---

## 🎯 Solutions par Ordre de Probabilité

### Solution 1 : Vider le Cache du Navigateur (Le Plus Probable)

**Chrome** :
1. `Ctrl + Shift + Delete`
2. Sélectionner "Tout le temps"
3. Cocher "Images et fichiers en cache"
4. Cliquer "Effacer les données"

**Firefox** :
1. `Ctrl + Shift + Delete`
2. Sélectionner "Tout"
3. Cocher "Cache"
4. Cliquer "Effacer maintenant"

**Edge** :
1. `Ctrl + Shift + Delete`
2. Sélectionner "Tout le temps"
3. Cocher "Images et fichiers en cache"
4. Cliquer "Effacer maintenant"

### Solution 2 : Changer le DNS

**Windows** :
1. Ouvrir "Paramètres réseau"
2. Modifier les options de l'adaptateur
3. Clic droit sur votre connexion → Propriétés
4. IPv4 → Propriétés
5. Utiliser les serveurs DNS suivants :
   - **DNS préféré** : `8.8.8.8` (Google)
   - **DNS alternatif** : `1.1.1.1` (Cloudflare)
6. OK → Fermer

**Via PowerShell (Admin)** :
```powershell
# Changer le DNS pour la connexion active
Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | Set-DnsClientServerAddress -ServerAddresses 8.8.8.8,1.1.1.1
```

### Solution 3 : Désactiver le Proxy

**Windows** :
1. Paramètres → Réseau et Internet → Proxy
2. Désactiver "Utiliser un serveur proxy"
3. Désactiver "Détection automatique des paramètres"

**Via PowerShell (Admin)** :
```powershell
# Désactiver le proxy
netsh winhttp reset proxy
```

### Solution 4 : Réinitialiser la Stack TCP/IP

**Via PowerShell (Admin)** :
```powershell
# Réinitialiser la stack réseau
netsh winsock reset
netsh int ip reset
ipconfig /flushdns
ipconfig /release
ipconfig /renew

# Redémarrer l'ordinateur après
```

### Solution 5 : Essayer un Autre Navigateur

- Chrome
- Firefox
- Edge
- Safari (si Mac)

### Solution 6 : Mode Incognito/Privé

- `Ctrl + Shift + N` (Chrome)
- `Ctrl + Shift + P` (Firefox/Edge)

### Solution 7 : Vérifier les Extensions du Navigateur

- Désactiver toutes les extensions
- Désactiver les bloqueurs de publicité
- Désactiver les VPN/proxy dans le navigateur

---

## 🔍 Vérifications Spécifiques AWS

### 1. Vérifier le Statut AWS

URL : https://status.aws.amazon.com/

Vérifier si AWS signale des problèmes.

### 2. Essayer une URL Directe

Au lieu de `console.aws.amazon.com`, essayer :
- `https://us-east-1.console.aws.amazon.com/` (US East)
- `https://eu-west-1.console.aws.amazon.com/` (Europe)
- `https://ap-southeast-1.console.aws.amazon.com/` (Asie)

### 3. Vérifier le Compte AWS

- Vérifier l'email associé au compte
- Vérifier les factures impayées
- Vérifier si le compte est suspendu

### 4. Contacter le Support AWS

Si rien ne fonctionne :
- Support AWS : https://console.aws.amazon.com/support/
- Email : support@aws.amazon.com
- Chat : Disponible dans la console (si accessible)

---

## 📊 Checklist de Diagnostic

- [ ] Test DNS : `nslookup console.aws.amazon.com`
- [ ] Test HTTPS : `Test-NetConnection -ComputerName console.aws.amazon.com -Port 443`
- [ ] Vérifier les paramètres proxy
- [ ] Vérifier la date/heure système
- [ ] Vider le cache du navigateur
- [ ] Essayer un autre navigateur
- [ ] Essayer le mode incognito
- [ ] Désactiver les extensions
- [ ] Changer le DNS
- [ ] Essayer depuis un autre réseau
- [ ] Vérifier le statut AWS : https://status.aws.amazon.com/
- [ ] Essayer une URL directe de région

---

## 🎯 Actions Immédiates

1. **Tester la résolution DNS** :
   ```powershell
   nslookup console.aws.amazon.com
   ```

2. **Vider le cache du navigateur** (le plus simple)

3. **Essayer un autre navigateur** (test rapide)

4. **Vérifier le statut AWS** : https://status.aws.amazon.com/

5. **Essayer une URL directe de région** :
   ```
   https://us-east-1.console.aws.amazon.com/ec2/v2/home
   ```

---

**Date** : 2026-01-30  
**Statut** : Diagnostic en cours

