# 📱 Configuration des Push Notifications - Yukpomnang

## ✅ Système Implémenté

### 🎯 **Fonctionnalités**
- ✅ Notifications même app fermée
- ✅ Notifications d'appels entrants avec sonnerie
- ✅ Badge de notifications non lues
- ✅ Son custom pour appels
- ✅ Vibration sur Android
- ✅ Gestion foreground/background/fermée

---

## 🔧 **Configuration requise**

### **1. Expo Notifications (Déjà configuré ✅)**

Le système utilise **Expo Push Notifications** qui est gratuit et simple :

```bash
# Déjà installé dans package.json
npx expo install expo-notifications expo-device
```

### **2. Configuration app.json (Déjà fait ✅)**

```json
{
  "expo": {
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#6366F1"
    },
    "android": {
      "googleServicesFile": "./google-services.json",
      "useNextNotificationsApi": true,
      "permissions": ["POST_NOTIFICATIONS", "VIBRATE"]
    },
    "ios": {
      "usesApnsForNotifications": true
    },
    "plugins": [
      ["expo-notifications", {
        "icon": "./assets/notification-icon.png",
        "color": "#6366F1",
        "sounds": ["./assets/sounds/call_ringtone.mp3"]
      }]
    ]
  }
}
```

### **3. Project ID Expo (Déjà configuré ✅)**

```
Project ID: 39f01dbb-43a0-4fd9-9ba6-a5db1e999ec8
```

---

## 🚀 **Comment ça fonctionne**

### **Scénario 1: App OUVERTE**
1. Utilisateur A appelle utilisateur B
2. WebSocket envoie signal temps réel
3. Sonnerie locale immédiate chez B
4. Modal d'appel s'affiche

### **Scénario 2: App en ARRIÈRE-PLAN**
1. Utilisateur A appelle utilisateur B
2. Backend envoie push notification via Expo
3. Notification système apparaît
4. Son de sonnerie personnalisé
5. Tap ouvre l'app avec modal d'appel

### **Scénario 3: App FERMÉE**
1. Utilisateur A appelle utilisateur B
2. Backend envoie push notification
3. **Notification système même app fermée** 📱
4. **Sonnerie même téléphone verrouillé** 🔔
5. Tap lance l'app et modal d'appel

---

## 📋 **Endpoints Backend implémentés**

### **Push Notifications**
- `POST /api/push/register` - Enregistrer token push
- `PATCH /api/push/deactivate` - Désactiver token
- `POST /api/push/send` - Envoyer notification (admin)

### **WebRTC Calls**
- `POST /api/webrtc/notify-call` - Notifier appel entrant

### **Notifications Système**
- `GET /api/notifications/user/:id` - Liste notifications
- `GET /api/notifications/user/:id/unread-count` - Compter non lues
- `PATCH /api/notifications/:id/read` - Marquer lue
- `PATCH /api/notifications/user/:id/mark-all-read` - Tout marquer lu

---

## 🗄️ **Base de données**

### **Table: user_push_tokens**
```sql
- id (SERIAL PRIMARY KEY)
- user_id (INTEGER, FK users)
- push_token (TEXT UNIQUE) -- Token Expo
- device_type (VARCHAR: ios/android/web)
- device_id (VARCHAR)
- is_active (BOOLEAN)
- created_at, updated_at, last_used_at
```

### **Table: notifications**
```sql
- id (SERIAL PRIMARY KEY)
- user_id (INTEGER, FK users)
- type (VARCHAR: service_created, incoming_call, etc.)
- title, message (TEXT)
- data (JSONB) -- Données additionnelles
- is_read (BOOLEAN)
- created_at, read_at
```

---

## 🔔 **Types de notifications implémentées**

### **Automatiques**
- ✅ `service_created` - Service créé avec succès
- ✅ `service_activated` - Service activé
- ✅ `service_deactivated` - Service désactivé
- ✅ `incoming_call` - Appel audio/vidéo entrant

### **À implémenter (optionnel)**
- `low_balance` - Solde faible
- `payment_received` - Paiement reçu
- `new_message` - Nouveau message
- `new_review` - Nouvel avis

---

## 📱 **Fichiers mobiles créés/modifiés**

### **Créés**
- `src/services/pushNotifications.ts` - Service push notifications
- `src/components/PushNotificationManager.tsx` - Gestionnaire global

### **Modifiés**
- `App.tsx` - Ajout PushNotificationManager
- `app.json` - Configuration notifications
- `src/contexts/AuthContext.tsx` - Enregistrement token au login
- `src/components/WebRTCCallModal.tsx` - Envoi push lors d'appel

---

## 🛠️ **Backend créé/modifié**

### **Créés**
- `migrations/20251017_create_push_tokens_table.sql`
- `migrations/20251017_create_notifications_table.sql`
- `src/services/push_notification_service.rs`
- `src/controllers/push_controller.rs`
- `src/controllers/webrtc_controller.rs`
- `src/routes/push_routes.rs`
- `src/routes/webrtc_routes.rs`

### **Modifiés**
- `src/services/notification_service.rs` - Fonctions complètes
- `src/services/creer_service.rs` - Notification lors création
- `src/controllers/service_controller.rs` - Notification activation/désactivation

---

## ⚡ **Pour tester**

### **1. Appliquer les migrations**
```bash
cd backend
sqlx migrate run
```

### **2. Rebuild l'app mobile**
```bash
cd mobile
npx eas build --platform android --profile preview
```

### **3. Tester appel entrant**
1. Connectez 2 comptes sur 2 téléphones
2. Depuis téléphone A, appeler téléphone B
3. Sur téléphone B (même app fermée):
   - 📱 Notification apparaît
   - 🔔 Sonnerie se déclenche
   - 👆 Tap ouvre l'app avec appel

---

## 🎯 **Avantages Expo Push Notifications**

✅ **Gratuit** jusqu'à 1 million de notifications/mois
✅ **Pas de config Firebase/APNS** complexe
✅ **Fonctionne iOS + Android** avec le même code
✅ **API simple** : un POST suffit
✅ **Gestion automatique** des tokens invalides
✅ **Dashboard Expo** pour suivre les envois

---

## 📊 **Limites**

- ⚠️ Maximum 100 notifications par seconde
- ⚠️ Message max 4 KB
- ⚠️ Fonctionne que si Expo Services sont actifs

Pour production à grande échelle, migrer vers Firebase Cloud Messaging direct.

---

## 🔐 **Sécurité**

- ✅ Tokens push chiffrés côté Expo
- ✅ Authentification JWT requise pour enregistrer token
- ✅ Vérification user_id côté serveur
- ✅ Nettoyage automatique vieux tokens

---

**Système prêt à l'emploi ! 🚀**

