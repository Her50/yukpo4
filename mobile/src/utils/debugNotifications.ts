/**
 * Utilitaire de débogage pour les notifications
 * 
 * Ce fichier aide à identifier les problèmes de notifications:
 * - Afficher les notifications en base de données
 * - Comparer le count avec la liste réelle
 * - Identifier les notifications orphelines
 */

import { apiGet } from '../services/api';
import { API_ENDPOINTS } from '../config/api.config';

export interface NotificationDebugInfo {
  unreadCount: number;
  actualNotifications: any[];
  mismatch: boolean;
  ghostNotifications: any[];
}

/**
 * Récupère les informations de débogage pour les notifications
 */
export const debugNotifications = async (userId: string): Promise<NotificationDebugInfo> => {
  try {
    console.log('[DebugNotifications] \uD83D\uDD0D Début du débogage pour user:', userId);

    // 1. Récupérer le count
    const countResponse = await apiGet<{ count: number }>(
      API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT(userId)
    );
    const unreadCount = countResponse.data?.count || 0;
    console.log('[DebugNotifications] \uD83D\uDCCA Count non lues:', unreadCount);

    // 2. Récupérer la liste des notifications
    const listResponse = await apiGet<any[]>(
      API_ENDPOINTS.NOTIFICATIONS.USER_NOTIFICATIONS(userId)
    );
    const notifications = Array.isArray(listResponse.data) ? listResponse.data : [];
    console.log('[DebugNotifications] \uD83D\uDCCB Notifications récupérées:', notifications.length);

    // 3. Filtrer les non lues dans la liste
    const actualUnread = notifications.filter((n: any) => !n.isRead && !n.is_read);
    console.log('[DebugNotifications] \uD83D\uDD14 Non lues dans la liste:', actualUnread.length);

    // 4. Détecter les incohérences
    const mismatch = unreadCount !== actualUnread.length;
    if (mismatch) {
      console.warn('[DebugNotifications] ⚠️ INCOHÉRENCE DÉTECTÉE !');
      console.warn('[DebugNotifications] Count API:', unreadCount);
      console.warn('[DebugNotifications] Réelles:', actualUnread.length);
    }

    // 5. Identifier les notifications "fantômes" (comptées mais non affichables)
    const ghostNotifications = mismatch && unreadCount > actualUnread.length
      ? notifications.filter((n: any) => !n.title || !n.message)
      : [];

    console.log('[DebugNotifications] \uD83D\uDC7B Notifications fantômes:', ghostNotifications.length);
    if (ghostNotifications.length > 0) {
      console.log('[DebugNotifications] \uD83D\uDC7B Détails:', ghostNotifications);
    }

    // 6. Afficher toutes les notifications non lues pour analyse
    if (actualUnread.length > 0) {
      console.log('[DebugNotifications] \uD83D\uDCDD Détails des non lues:');
      actualUnread.forEach((n: any, idx: number) => {
        console.log(`  ${idx + 1}. [${n.type}] ${n.title}: ${n.message} (ID: ${n.id})`);
      });
    }

    return {
      unreadCount,
      actualNotifications: notifications,
      mismatch,
      ghostNotifications,
    };
  } catch (error) {
    console.error('[DebugNotifications] ❌ Erreur:', error);
    throw error;
  }
};

/**
 * Nettoie les notifications fantômes (marque comme lues)
 */
export const cleanupGhostNotifications = async (userId: string): Promise<number> => {
  try {
    const debugInfo = await debugNotifications(userId);
    
    if (!debugInfo.mismatch) {
      console.log('[DebugNotifications] ✅ Pas de notifications fantômes détectées');
      return 0;
    }

    console.log('[DebugNotifications] \uD83E\uDDF9 Nettoyage des notifications fantômes...');
    
    // Marquer toutes les notifications comme lues pour réinitialiser
    const response = await apiGet(
      API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ(userId)
    );

    console.log('[DebugNotifications] ✅ Nettoyage terminé');
    return debugInfo.unreadCount;
  } catch (error) {
    console.error('[DebugNotifications] ❌ Erreur nettoyage:', error);
    throw error;
  }
};

/**
 * Affiche un rapport complet de débogage
 */
export const printNotificationReport = async (userId: string): Promise<void> => {
  console.log('\n' + '='.repeat(60));
  console.log('\uD83D\uDCCA RAPPORT DE DÉBOGAGE DES NOTIFICATIONS');
  console.log('='.repeat(60));
  
  try {
    const info = await debugNotifications(userId);
    
    console.log(`\n✅ Utilisateur: ${userId}`);
    console.log(`\uD83D\uDCCA Count API: ${info.unreadCount}`);
    console.log(`\uD83D\uDCCB Notifications totales: ${info.actualNotifications.length}`);
    console.log(`\uD83D\uDD14 Notifications non lues réelles: ${info.actualNotifications.filter((n: any) => !n.isRead && !n.is_read).length}`);
    console.log(`\uD83D\uDC7B Notifications fantômes: ${info.ghostNotifications.length}`);
    console.log(`⚠️ Incohérence: ${info.mismatch ? 'OUI' : 'NON'}`);
    
    if (info.mismatch) {
      console.log('\n⚠️ RECOMMANDATION:');
      console.log('   Utiliser cleanupGhostNotifications() pour nettoyer');
    }
    
  } catch (error) {
    console.error('\n❌ Erreur lors du rapport:', error);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
};

