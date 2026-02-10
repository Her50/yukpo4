# 🔓 Réactiver un Compte Hetzner Désactivé

## ⚠️ Problème Identifié

Votre compte Hetzner est désactivé, ce qui explique pourquoi :
- Les connexions SSH échouent
- Le serveur ne répond pas
- Les workflows GitHub Actions ne peuvent pas se connecter

## 🔍 Causes Possibles d'une Désactivation

1. **Facture impayée** (cause la plus fréquente)
2. **Violation des conditions d'utilisation**
3. **Suspicion de fraude ou activité suspecte**
4. **Dépassement de crédit/limite**
5. **Compte inactif pendant une longue période**

## ✅ Solutions pour Réactiver

### Solution 1 : Vérifier et Payer les Factures (Prioritaire)

1. **Connectez-vous au panel Hetzner** :
   - https://console.hetzner.cloud/
   - Essayez de vous connecter avec vos identifiants

2. **Si vous pouvez vous connecter** :
   - Allez dans **"Billing"** → **"Invoices"**
   - Vérifiez s'il y a des factures impayées
   - Payez les factures en attente
   - Le compte sera réactivé automatiquement après paiement

3. **Si vous ne pouvez PAS vous connecter** :
   - Le compte est peut-être complètement suspendu
   - Contactez le support Hetzner (voir Solution 2)

### Solution 2 : Contacter le Support Hetzner (Recommandé)

1. **Email du support** :
   - **Email** : support@hetzner.com
   - **Ou** : https://console.hetzner.cloud/support

2. **Informations à fournir** :
   - Votre email de compte Hetzner
   - Votre numéro de client (si vous l'avez)
   - L'IP de votre serveur : `46.224.14.85`
   - La raison de la désactivation (si connue)
   - Preuve de paiement (si facture impayée)

3. **Message type** :
   ```
   Bonjour,
   
   Mon compte Hetzner Cloud a été désactivé et je souhaite le réactiver.
   
   Informations du compte :
   - Email : [votre email]
   - Serveur IP : 46.224.14.85
   - Numéro de client : [si disponible]
   
   Pouvez-vous m'aider à réactiver mon compte ?
   
   Cordialement,
   ```

### Solution 3 : Vérifier l'Email de Notification

1. **Vérifiez votre email** (celui utilisé pour Hetzner)
2. **Cherchez des emails de Hetzner** avec :
   - Sujet : "Account suspended", "Payment required", "Account deactivated"
   - Expéditeur : billing@hetzner.com ou support@hetzner.com
3. **Lisez l'email** pour comprendre la raison et les actions à prendre

### Solution 4 : Vérifier le Statut du Serveur

Même si le compte est désactivé, vérifiez si le serveur répond encore :

```powershell
# Test de ping
Test-Connection -ComputerName 46.224.14.85 -Count 4

# Test de port SSH
Test-NetConnection -ComputerName 46.224.14.85 -Port 22
```

Si le serveur ne répond pas, il a probablement été arrêté par Hetzner.

## 🔄 Après Réactivation

Une fois le compte réactivé :

1. **Vérifiez que le serveur est en ligne** :
   - Panel Hetzner → Servers → Vérifiez l'état
   - Si le serveur est arrêté, démarrez-le

2. **Testez la connexion SSH** :
   ```powershell
   ssh root@46.224.14.85
   ```

3. **Relancez les workflows GitHub Actions** :
   - https://github.com/Her50/yukpo4/actions/workflows/setup-hetzner-ssh-auto.yml

## 📞 Contacts Support Hetzner

- **Email** : support@hetzner.com
- **Support en ligne** : https://console.hetzner.cloud/support
- **Téléphone** : Vérifiez sur https://www.hetzner.com/contact
- **Horaires** : Généralement 24/7 pour les urgences

## ⏱️ Délais de Réactivation

- **Facture impayée** : Immédiat après paiement (quelques minutes à quelques heures)
- **Suspicion de fraude** : Nécessite vérification manuelle (1-3 jours ouvrables)
- **Violation ToS** : Dépend de la gravité (peut prendre plusieurs jours)

## 💡 Prévention Future

Pour éviter une nouvelle désactivation :

1. **Activez le paiement automatique** :
   - Panel Hetzner → Billing → Payment Methods
   - Configurez un paiement automatique

2. **Configurez des alertes** :
   - Panel Hetzner → Billing → Alerts
   - Recevez des notifications avant épuisement de crédit

3. **Surveillez vos factures** :
   - Vérifiez régulièrement les factures en attente
   - Maintenez un solde positif

## 🚨 Urgence

Si votre application est en production et que le serveur est arrêté :

1. **Contactez immédiatement le support Hetzner**
2. **Expliquez l'urgence** (application en production)
3. **Proposez de payer immédiatement** si c'est une question de facture
4. **Demandez une réactivation prioritaire**

## 📋 Checklist de Réactivation

- [ ] Vérifier les factures impayées dans le panel
- [ ] Payer les factures en attente
- [ ] Vérifier l'email de notification Hetzner
- [ ] Contacter le support si nécessaire
- [ ] Vérifier l'état du serveur après réactivation
- [ ] Tester la connexion SSH
- [ ] Relancer les workflows GitHub Actions
- [ ] Configurer le paiement automatique (prévention)

