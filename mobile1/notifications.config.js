// Configuration des notifications push - Yukpomnang Mobile
// Ce fichier configure les notifications push pour iOS et Android

module.exports = {
    // Configuration générale
    general: {
        enabled: true,
        debug: false,
        sound: true,
        vibration: true,
        badge: true
    },

    // Configuration iOS
    ios: {
        // Certificats de notification
        development: {
            apnsKeyId: process.env.EXPO_PUBLIC_APNS_KEY_ID,
            apnsTeamId: process.env.EXPO_PUBLIC_APNS_TEAM_ID,
            apnsBundleId: 'com.yukpomnang.mobile'
        },
        production: {
            apnsKeyId: process.env.EXPO_PUBLIC_APNS_KEY_ID,
            apnsTeamId: process.env.EXPO_PUBLIC_APNS_TEAM_ID,
            apnsBundleId: 'com.yukpomnang.mobile'
        }
    },

    // Configuration Android
    android: {
        // Clé FCM
        fcmServerKey: process.env.EXPO_PUBLIC_FCM_SERVER_KEY,
        fcmSenderId: process.env.EXPO_PUBLIC_FCM_SENDER_ID,
        packageName: 'com.yukpomnang.mobile'
    },

    // Types de notifications
    notificationTypes: {
        // Notifications de service
        serviceRequest: {
            title: 'Nouvelle demande de service',
            body: 'Vous avez reçu une nouvelle demande de service',
            sound: 'default',
            priority: 'high',
            category: 'service'
        },

        serviceAccepted: {
            title: 'Service accepté',
            body: 'Votre demande de service a été acceptée',
            sound: 'default',
            priority: 'high',
            category: 'service'
        },

        serviceCompleted: {
            title: 'Service terminé',
            body: 'Votre service a été marqué comme terminé',
            sound: 'default',
            priority: 'normal',
            category: 'service'
        },

        // Notifications de chat
        newMessage: {
            title: 'Nouveau message',
            body: 'Vous avez reçu un nouveau message',
            sound: 'default',
            priority: 'high',
            category: 'chat'
        },

        // Notifications d'IA
        aiSuggestion: {
            title: 'Suggestion IA',
            body: 'L\'IA a une nouvelle suggestion pour vous',
            sound: 'default',
            priority: 'normal',
            category: 'ai'
        },

        // Notifications système
        systemUpdate: {
            title: 'Mise à jour système',
            body: 'Une mise à jour est disponible',
            sound: 'default',
            priority: 'normal',
            category: 'system'
        },

        // Notifications de sécurité
        securityAlert: {
            title: 'Alerte de sécurité',
            body: 'Une activité suspecte a été détectée',
            sound: 'default',
            priority: 'high',
            category: 'security'
        }
    },

    // Configuration des canaux Android
    androidChannels: {
        service: {
            id: 'service_channel',
            name: 'Services',
            description: 'Notifications liées aux services',
            importance: 'high',
            sound: 'default',
            vibration: true,
            lights: true
        },

        chat: {
            id: 'chat_channel',
            name: 'Messages',
            description: 'Notifications de messages',
            importance: 'high',
            sound: 'default',
            vibration: true,
            lights: true
        },

        ai: {
            id: 'ai_channel',
            name: 'IA',
            description: 'Notifications de l\'IA',
            importance: 'normal',
            sound: 'default',
            vibration: false,
            lights: false
        },

        system: {
            id: 'system_channel',
            name: 'Système',
            description: 'Notifications système',
            importance: 'normal',
            sound: 'default',
            vibration: false,
            lights: false
        },

        security: {
            id: 'security_channel',
            name: 'Sécurité',
            description: 'Alertes de sécurité',
            importance: 'high',
            sound: 'default',
            vibration: true,
            lights: true
        }
    },

    // Configuration des actions de notification
    notificationActions: {
        // Actions pour les services
        serviceActions: [
            {
                id: 'accept_service',
                title: 'Accepter',
                icon: 'check',
                destructive: false
            },
            {
                id: 'decline_service',
                title: 'Refuser',
                icon: 'close',
                destructive: true
            }
        ],

        // Actions pour les messages
        messageActions: [
            {
                id: 'reply_message',
                title: 'Répondre',
                icon: 'reply',
                destructive: false
            },
            {
                id: 'mark_read',
                title: 'Marquer comme lu',
                icon: 'check',
                destructive: false
            }
        ],

        // Actions pour l'IA
        aiActions: [
            {
                id: 'view_suggestion',
                title: 'Voir',
                icon: 'eye',
                destructive: false
            },
            {
                id: 'dismiss_suggestion',
                title: 'Ignorer',
                icon: 'close',
                destructive: false
            }
        ]
    },

    // Configuration des permissions
    permissions: {
        ios: [
            'alert',
            'badge',
            'sound',
            'carPlay',
            'criticalAlert',
            'provisional'
        ],
        android: [
            'android.permission.RECEIVE_BOOT_COMPLETED',
            'android.permission.VIBRATE',
            'android.permission.WAKE_LOCK'
        ]
    },

    // Configuration des triggers
    triggers: {
        // Trigger basé sur la localisation
        location: {
            enabled: true,
            radius: 1000, // 1km
            accuracy: 'high'
        },

        // Trigger basé sur le temps
        time: {
            enabled: true,
            timezone: 'Europe/Paris'
        },

        // Trigger basé sur les événements
        events: {
            enabled: true,
            types: ['service_request', 'message_received', 'ai_suggestion']
        }
    },

    // Configuration des analytics
    analytics: {
        enabled: true,
        trackDelivery: true,
        trackOpen: true,
        trackClick: true,
        trackDismiss: true
    }
};

