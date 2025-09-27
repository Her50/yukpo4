// @ts-check
let ws: WebSocket | null = null;
let listeners: ((data: string) => void)[] = [];

/**
 * Initialise la connexion WebSocket si ce n'est pas déjà fait
 */
export function initAccessWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  // Déterminer le protocole WebSocket approprié
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = 'yukpomnang.onrender.com';
  const wsUrl = `${protocol}//${host}/ws/access`;

  console.log('📡 Connexion WebSocket Access à:', wsUrl);

  ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    for (const cb of listeners) {
      cb(event.data);
    }
  };

  ws.onopen = () => console.log('📡 WebSocket Access connecté');
  ws.onclose = () => console.warn('🔌 WebSocket Access déconnecté');
  ws.onerror = (e) => console.error('❌ Erreur WebSocket Access :', e);
}

/**
 * Permet à un composant de réagir aux événements WebSocket
 */
export function subscribeAccessUpdates(callback: (data: string) => void) {
  listeners.push(callback);
  initAccessWebSocket();
}

/**
 * Nettoyage d'un listener
 */
export function unsubscribeAccessUpdates(callback: (data: string) => void) {
  listeners = listeners.filter((cb) => cb !== callback);
}
