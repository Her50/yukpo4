-- Script pour insérer des notifications de test
-- Date: 2025-11-01
-- Description: Insérer des notifications variées pour tester le système

-- ✅ Notifications pour l'utilisateur avec ID = 1
-- (Remplacer par l'ID de votre utilisateur de test)

-- Notification de bienvenue
INSERT INTO notifications (user_id, notification_type, title, message, data, is_read, created_at)
VALUES (
    1,
    'system_alert',
    'Bienvenue sur Yukpomnang ! 🎉',
    'Votre compte a été créé avec succès. Commencez à explorer nos services.',
    '{"category": "system", "action_url": "/services", "priority": "normal"}'::jsonb,
    false,
    NOW() - INTERVAL '2 hours'
);

-- Notification de nouveau service
INSERT INTO notifications (user_id, notification_type, title, message, data, is_read, created_at)
VALUES (
    1,
    'service_created',
    'Service créé avec succès ✓',
    'Votre service "Réparation smartphone" a été créé et est maintenant actif.',
    '{"category": "service", "service_id": 123, "action_url": "/mes-services", "priority": "normal"}'::jsonb,
    false,
    NOW() - INTERVAL '1 hour'
);

-- Notification de message reçu
INSERT INTO notifications (user_id, notification_type, title, message, data, is_read, created_at)
VALUES (
    1,
    'new_message',
    'Nouveau message 💬',
    'Vous avez reçu un nouveau message concernant votre service.',
    '{"category": "chat", "from": "Jean Dupont", "service_id": 123, "action_url": "/messages/456", "priority": "high"}'::jsonb,
    false,
    NOW() - INTERVAL '30 minutes'
);

-- Notification de paiement
INSERT INTO notifications (user_id, notification_type, title, message, data, is_read, created_at)
VALUES (
    1,
    'payment_received',
    'Paiement reçu 💰',
    'Vous avez reçu un paiement de 5000 FCFA pour votre service.',
    '{"category": "payment", "amount": 5000, "currency": "XAF", "action_url": "/wallet", "priority": "high"}'::jsonb,
    false,
    NOW() - INTERVAL '15 minutes'
);

-- Notification de crédit ajouté
INSERT INTO notifications (user_id, notification_type, title, message, data, is_read, created_at)
VALUES (
    1,
    'tokens_added',
    'Crédits ajoutés ⚡',
    'Votre compte a été crédité de 1000 tokens.',
    '{"category": "payment", "tokens": 1000, "action_url": "/recharge", "priority": "normal"}'::jsonb,
    false,
    NOW() - INTERVAL '5 minutes'
);

-- Notification d'alerte sécurité (déjà lue)
INSERT INTO notifications (user_id, notification_type, title, message, data, is_read, created_at)
VALUES (
    1,
    'security_alert',
    'Nouvelle connexion détectée 🔐',
    'Une nouvelle connexion à votre compte a été détectée depuis un nouvel appareil.',
    '{"category": "security", "device": "iPhone 12", "location": "Yaoundé", "priority": "high"}'::jsonb,
    true,
    NOW() - INTERVAL '1 day'
);

-- Notification de promotion
INSERT INTO notifications (user_id, notification_type, title, message, data, is_read, created_at)
VALUES (
    1,
    'promotion',
    'Offre spéciale 🎁',
    'Profitez de -50% sur votre prochaine publicité !',
    '{"category": "promotion", "discount": 50, "valid_until": "2025-12-31", "action_url": "/publicites/create", "priority": "normal"}'::jsonb,
    false,
    NOW() - INTERVAL '3 hours'
);

-- Notification de service expirant bientôt
INSERT INTO notifications (user_id, notification_type, title, message, data, is_read, created_at)
VALUES (
    1,
    'service_expiring',
    'Service expire bientôt ⏰',
    'Votre service "Vente de téléphones" expire dans 2 jours. Pensez à le renouveler.',
    '{"category": "service", "service_id": 124, "expires_at": "2025-11-03", "action_url": "/mes-services/124", "priority": "high"}'::jsonb,
    false,
    NOW() - INTERVAL '10 minutes'
);

-- ✅ Afficher le résumé
SELECT 
    COUNT(*) as total_notifications,
    SUM(CASE WHEN is_read = false THEN 1 ELSE 0 END) as non_lues,
    SUM(CASE WHEN is_read = true THEN 1 ELSE 0 END) as lues
FROM notifications
WHERE user_id = 1;

-- ✅ Afficher toutes les notifications de l'utilisateur
SELECT 
    id,
    notification_type,
    title,
    message,
    is_read,
    created_at
FROM notifications
WHERE user_id = 1
ORDER BY created_at DESC;

-- ✅ Instructions pour adapter à votre utilisateur :
-- 1. Remplacer "1" par l'ID de votre utilisateur de test
-- 2. Exécuter ce script : psql -h localhost -U postgres -d yukpomnang < insert_test_notifications.sql
-- 3. Ou copier-coller dans pgAdmin ou votre client SQL préféré


