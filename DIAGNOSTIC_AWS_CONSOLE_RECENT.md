# 🔍 Diagnostic : Perte d'Accès AWS Console (Problème Récent)

## 📋 Situation

- ✅ **Il y a 5 heures** : Console AWS accessible et fonctionnelle
- ❌ **Maintenant** : Impossible d'accéder à la console AWS
- ❌ **Mobile** : Même problème
- ✅ **Internet** : Fonctionne normalement

**Conclusion** : Problème **TEMPORAIRE** ou **RÉCENT**, pas un blocage permanent.

---

## 🔍 Causes Probables (Problème Récent)

### 1. Changement de Configuration Réseau ⚠️ **LE PLUS PROBABLE**

**Causes possibles** :
- Redémarrage du routeur (changement de configuration)
- Mise à jour du routeur (nouvelles règles de pare-feu)
- Changement de DNS automatique
- Changement d'IP publique
- Mise à jour du firmware du routeur

**Solution** :
1. Vérifier si le routeur a été redémarré
2. Vérifier les paramètres du routeur
3. Redémarrer le routeur
4. Vérifier les DNS configurés

### 2. Problème DNS Temporaire

**Causes possibles** :
- Cache DNS corrompu
- Serveur DNS temporairement indisponible
- Changement de DNS automatique

**Solution** :
```powershell
# Vider le cache DNS
ipconfig /flushdns

# Changer temporairement le DNS
# Utiliser 8.8.8.8 (Google) ou 1.1.1.1 (Cloudflare)
```

### 3. Problème ISP Temporaire

**Causes possibles** :
- Maintenance réseau ISP
- Problème de routage temporaire
- Blocage temporaire par l'ISP
- Changement de configuration réseau ISP

**Solution** :
1. Contacter l'ISP
2. Vérifier s'il y a des travaux/maintenance
3. Attendre quelques heures
4. Redémarrer le modem/routeur

### 4. Problème AWS Temporaire

**Causes possibles** :
- Maintenance AWS non annoncée
- Problème régional AWS
- Problème avec AWS Sign-In

**Solution** :
1. Vérifier le statut AWS : https://status.aws.amazon.com/
2. Attendre la résolution
3. Essayer périodiquement

### 5. Changement de Configuration Windows

**Causes possibles** :
- Mise à jour Windows (nouvelles règles de pare-feu)
- Changement de configuration réseau Windows
- Mise à jour antivirus (nouvelles règles)

**Solution** :
1. Vérifier les mises à jour récentes
2. Vérifier les règles de pare-feu
3. Vérifier les paramètres antivirus

---

## 🔧 Solutions Immédiates (Par Ordre de Probabilité)

### Solution 1 : Redémarrer le Routeur/Modem (LE PLUS SIMPLE)

**Actions** :
1. Débrancher le routeur/modem
2. Attendre 30 secondes
3. Rebrancher
4. Attendre la reconnexion complète (2-3 minutes)
5. Tester l'accès AWS

**Pourquoi ça marche souvent** :
- Réinitialise la connexion réseau
- Renouvelle l'IP publique
- Réinitialise les règles de pare-feu
- Vide le cache réseau

### Solution 2 : Vider le Cache DNS

**Via PowerShell (Admin)** :
```powershell
# Vider le cache DNS
ipconfig /flushdns

# Redémarrer le service DNS
Restart-Service -Name Dnscache -Force

# Tester
nslookup console.aws.amazon.com
```

**Via Interface Graphique** :
1. Ouvrir **Invite de commandes** (Admin)
2. Taper : `ipconfig /flushdns`
3. Redémarrer l'ordinateur

### Solution 3 : Changer le DNS

**Windows** :
1. **Paramètres** → **Réseau et Internet** → **État**
2. **Modifier les options de l'adaptateur**
3. Clic droit sur votre connexion → **Propriétés**
4. **IPv4** → **Propriétés**
5. **Utiliser les serveurs DNS suivants** :
   - **DNS préféré** : `8.8.8.8` (Google)
   - **DNS alternatif** : `1.1.1.1` (Cloudflare)
6. **OK** → **Fermer**

**Via PowerShell (Admin)** :
```powershell
# Changer le DNS pour la connexion active
Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | Set-DnsClientServerAddress -ServerAddresses 8.8.8.8,1.1.1.1

# Vider le cache DNS
ipconfig /flushdns
```

### Solution 4 : Réinitialiser la Stack Réseau

**Via PowerShell (Admin)** :
```powershell
# Réinitialiser la stack réseau
netsh winsock reset
netsh int ip reset
ipconfig /flushdns
ipconfig /release
ipconfig /renew

# Redémarrer l'ordinateur
Restart-Computer
```

### Solution 5 : Vérifier les Mises à Jour Récentes

**Windows** :
1. **Paramètres** → **Mise à jour et sécurité**
2. **Historique des mises à jour**
3. Vérifier les mises à jour récentes (dernières 5 heures)
4. Si mise à jour récente, vérifier si elle a changé les paramètres réseau

### Solution 6 : Vérifier le Routeur

**Actions** :
1. Accéder à l'interface du routeur (généralement 192.168.1.1 ou 192.168.0.1)
2. Vérifier les paramètres de pare-feu
3. Vérifier les règles de filtrage
4. Vérifier les DNS configurés
5. Vérifier les logs du routeur

### Solution 7 : Contacter l'ISP

**Si rien ne fonctionne** :
1. Appeler le support de votre FAI
2. Expliquer que vous perdu l'accès à AWS il y a 5 heures
3. Demander s'il y a eu des changements/maintenance
4. Demander de vérifier votre connexion

---

## 🔍 Tests de Diagnostic

### Test 1 : Vérifier le DNS

```powershell
# Tester la résolution DNS
nslookup console.aws.amazon.com
nslookup signin.aws.amazon.com

# Si échec, essayer avec un autre DNS
nslookup console.aws.amazon.com 8.8.8.8
```

### Test 2 : Vérifier la Connexion Réseau

```powershell
# Vérifier la connexion
Test-NetConnection -ComputerName console.aws.amazon.com -Port 443

# Vérifier l'IP publique
Invoke-RestMethod -Uri "https://api.ipify.org"
```

### Test 3 : Vérifier les DNS Configurés

```powershell
# Vérifier les DNS configurés
Get-DnsClientServerAddress | Select-Object InterfaceAlias, ServerAddresses
```

### Test 4 : Vérifier le Routeur

```powershell
# Vérifier la passerelle par défaut
Get-NetRoute -DestinationPrefix "0.0.0.0/0" | Select-Object NextHop

# Tester la connexion au routeur
Test-NetConnection -ComputerName (Get-NetRoute -DestinationPrefix "0.0.0.0/0").NextHop -Port 80
```

---

## 📋 Checklist de Diagnostic

### Actions Simples (Essayer en Premier)
- [ ] Redémarrer le routeur/modem
- [ ] Vider le cache DNS : `ipconfig /flushdns`
- [ ] Redémarrer l'ordinateur
- [ ] Changer le DNS vers 8.8.8.8 / 1.1.1.1

### Vérifications Réseau
- [ ] Vérifier les DNS configurés
- [ ] Vérifier la passerelle par défaut
- [ ] Vérifier l'IP publique
- [ ] Vérifier les paramètres du routeur

### Vérifications Système
- [ ] Vérifier les mises à jour Windows récentes
- [ ] Vérifier les règles de pare-feu
- [ ] Vérifier les paramètres antivirus
- [ ] Vérifier les extensions navigateur

### Tests de Connexion
- [ ] Tester la résolution DNS
- [ ] Tester la connexion HTTPS
- [ ] Tester depuis un autre navigateur
- [ ] Tester depuis un autre appareil

---

## 🎯 Plan d'Action Recommandé

### Étape 1 : Actions Simples (5 minutes)
1. **Redémarrer le routeur/modem**
2. **Vider le cache DNS** : `ipconfig /flushdns`
3. **Redémarrer l'ordinateur**
4. **Tester l'accès AWS**

### Étape 2 : Si Échec - Changer DNS (5 minutes)
1. **Changer le DNS** vers 8.8.8.8 / 1.1.1.1
2. **Vider le cache DNS**
3. **Tester l'accès AWS**

### Étape 3 : Si Échec - Réinitialiser Réseau (10 minutes)
1. **Réinitialiser la stack réseau**
2. **Redémarrer l'ordinateur**
3. **Tester l'accès AWS**

### Étape 4 : Si Échec - Vérifier Routeur (15 minutes)
1. **Accéder à l'interface du routeur**
2. **Vérifier les paramètres**
3. **Vérifier les logs**
4. **Tester l'accès AWS**

### Étape 5 : Si Échec - Contacter Support
1. **Contacter l'ISP**
2. **Vérifier le statut AWS**
3. **Utiliser un VPN temporairement**

---

## 📊 Résumé

**Problème** : Perte d'accès AWS Console après 5 heures de fonctionnement normal

**Causes Probables** :
1. ✅ Changement de configuration réseau (routeur, DNS)
2. ✅ Problème DNS temporaire
3. ✅ Problème ISP temporaire
4. ✅ Mise à jour système récente

**Solutions Prioritaires** :
1. **Redémarrer le routeur** (le plus simple)
2. **Vider le cache DNS**
3. **Changer le DNS**
4. **Réinitialiser la stack réseau**

**Temps Estimé** : 5-30 minutes selon la solution

---

**Date** : 2026-01-30  
**Statut** : 🔄 **Problème temporaire/récent - Solutions simples à essayer**

