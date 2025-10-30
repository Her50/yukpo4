# Guide de débogage des notifications - Yukpomnang

## Problème identifié

Le badge de notification affiche un nombre (par exemple "1") alors qu'aucune notification n'apparaît dans la liste. C'est ce qu'on appelle une **notification fantôme**.

## Solutions

### 1. Solution rapide : Nettoyer les notifications fantômes (Mobile)

#### Étape 1 : Activer le débogage
1. Ouvrez l'application Yukpomnang
2. Sur l'écran d'accueil (Home)
3. **Appuyez longuement** (1 seconde) sur l'icône de notification 🔔 en haut à droite

#### Étape 2 : Lancer le nettoyage
1. Un dialogue apparaîtra avec les options suivantes :
   - **Annuler** : Fermer sans rien faire
   - **Nettoyer** : Réinitialiser toutes les notifications

2. Sélectionnez **"Nettoyer"**
3. Le système marquera toutes les notifications comme lues
4. Le badge devrait disparaître

### 2. Vérification manuelle (Backend)

Si le problème persiste, vérifiez la base de données :

```sql
-- Compter les notifications non lues pour un utilisateur
SELECT COUNT(*) 
FROM notifications 
WHERE user_id = <USER_ID> AND is_read = FALSE;

-- Afficher toutes les notifications d'un utilisateur
SELECT id, notification_type, title, message, is_read, created_at 
FROM notifications 
WHERE user_id = <USER_ID> 
ORDER BY created_at DESC 
LIMIT 10;

-- Nettoyer les notifications fantômes (marquer comme lues)
UPDATE notifications 
SET is_read = TRUE 
WHERE user_id = <USER_ID> AND is_read = FALSE;
```

### 3. Recharger l'application (si le texte "Boutique..." persiste)

Le texte de navigation devrait afficher **"Boutique | Services"** et non "Boutique...". Si vous voyez encore "Boutique...", c'est un problème de cache :

#### Sur Android/iOS :
1. Fermez complètement l'application
2. Redémarrez-la

#### En développement (Metro) :
```bash
# Dans le terminal où Metro tourne
r  # Appuyez sur 'r' pour recharger

# Ou effacer le cache complètement
npx react-native start --reset-cache
```

## Causes possibles des notifications fantômes

1. **Notifications mal formatées** : Notifications en base de données sans titre ou message
2. **Erreurs de création** : Échec partiel lors de la création d'une notification
3. **Désynchronisation** : Le count ne correspond pas à la réalité de la table
4. **Notifications orphelines** : Notifications liées à des services supprimés

## Prévention

### Code ajouté pour prévenir les problèmes futurs :

1. **Validation automatique** (`debugNotifications.ts`) :
   - Vérifie la cohérence entre le count et les notifications réelles
   - Détecte les notifications mal formatées
   - Logs détaillés pour le diagnostic

2. **Débogage automatique en dev** :
   - En mode développement (`__DEV__`), chaque fois qu'une notification est détectée, le système vérifie sa validité
   - Les incohérences sont loggées dans la console

3. **Route DELETE ajoutée** :
   - Permet maintenant de supprimer les notifications depuis l'interface
   - Backend : `DELETE /api/notifications/{notification_id}`

## Vérifications post-correction

Après avoir appliqué une solution, vérifiez :

1. ✅ Le badge de notification affiche le bon nombre (ou 0)
2. ✅ Quand on clique sur 🔔, les notifications s'affichent correctement
3. ✅ Après avoir créé un service, une notification apparaît
4. ✅ Le texte dans la navigation est "Boutique | Services"

## Support technique

Si le problème persiste après avoir essayé toutes les solutions :

1. **Activez les logs détaillés** :
   ```typescript
   // Dans la console Metro (terminal de développement)
   // Cherchez les lignes commençant par [HomeScreen] ou [NotificationHistoryModal]
   ```

2. **Vérifiez les logs backend** :
   ```bash
   # Cherchez les lignes concernant les notifications
   [NotificationService]
   [NotificationController]
   ```

3. **Consultez le rapport de débogage complet** :
   - Dans la console de développement après un long press sur 🔔
   - Cherchez la section "RAPPORT DE DÉBOGAGE DES NOTIFICATIONS"

## Fichiers modifiés

### Backend
- `backend/src/routes/notification_routes.rs` : Ajout de la route DELETE
- `backend/src/controllers/notification_controller.rs` : Ajout du contrôleur delete_notification
- `backend/src/services/notification_service.rs` : Ajout de la fonction delete_notification

### Frontend
- `mobile/src/utils/debugNotifications.ts` : Nouveau fichier avec utilitaires de débogage
- `mobile/src/screens/HomeScreen.tsx` : Ajout de la fonction de débogage et long press
- `mobile/src/navigation/AppNavigator.tsx` : Texte déjà correct ("Boutique | Services")

## Notes importantes

⚠️ **Avant de déployer en production** :
- Testez la création de services pour vérifier que les notifications fonctionnent
- Vérifiez que le badge s'affiche correctement
- Assurez-vous que les notifications se marquent comme lues

✅ **En production** :
- Le débogage automatique est désactivé (seulement en `__DEV__`)
- Le long press sur 🔔 reste actif pour le support client

