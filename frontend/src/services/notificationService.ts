// Service de simulation pour les notifications et conversations
// En production, ceci sera remplacé par de vrais appels API

interface NotificationCount {
  count: number;
}

interface ConversationCount {
  count: number;
}

// Simulation de données pour les tests - Variables mutables pour les tests
let mockNotificationCount = 3; // Simuler 3 notifications non lues
let mockConversationCount = 2; // Simuler 2 conversations non lues

export const notificationService = {
  // Récupérer le nombre de notifications non lues
  async getUnreadNotificationCount(): Promise<NotificationCount> {
    try {
      // En production, remplacer par un vrai appel API
      // const response = await apiGet('/api/notifications/unread-count');
      // return await response.json();
      
      // Simulation avec délai
      await new Promise(resolve => setTimeout(resolve, 500));
      return { count: mockNotificationCount };
    } catch (error) {
      console.error('Erreur lors du chargement des notifications:', error);
      return { count: 0 };
    }
  },

  // Récupérer le nombre de conversations non lues
  async getUnreadConversationCount(): Promise<ConversationCount> {
    try {
      // En production, remplacer par un vrai appel API
      // const response = await apiGet('/api/conversations/unread-count');
      // return await response.json();
      
      // Simulation avec délai
      await new Promise(resolve => setTimeout(resolve, 500));
      return { count: mockConversationCount };
    } catch (error) {
      console.error('Erreur lors du chargement des conversations:', error);
      return { count: 0 };
    }
  },

  // Marquer toutes les notifications comme lues
  async markAllNotificationsAsRead(): Promise<void> {
    try {
      // En production, remplacer par un vrai appel API
      // await apiGet('/api/notifications/mark-all-read');
      
      // Simulation
      await new Promise(resolve => setTimeout(resolve, 300));
      mockNotificationCount = 0;
      console.log('Notifications marquées comme lues');
    } catch (error) {
      console.error('Erreur lors du marquage des notifications:', error);
    }
  },

  // Marquer toutes les conversations comme lues
  async markAllConversationsAsRead(): Promise<void> {
    try {
      // En production, remplacer par un vrai appel API
      // await apiGet('/api/conversations/mark-all-read');
      
      // Simulation
      await new Promise(resolve => setTimeout(resolve, 300));
      mockConversationCount = 0;
      console.log('Conversations marquées comme lues');
    } catch (error) {
      console.error('Erreur lors du marquage des conversations:', error);
    }
  },

  // Méthodes de test pour simuler l'ajout de notifications/conversations
  addTestNotification(): void {
    mockNotificationCount++;
    console.log(`Notification ajoutée. Total: ${mockNotificationCount}`);
  },

  addTestConversation(): void {
    mockConversationCount++;
    console.log(`Conversation ajoutée. Total: ${mockConversationCount}`);
  }
};
