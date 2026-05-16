// @ts-check
import { WS_BASE_URL } from '../config/api.config';
import { withWsToken } from '../config/websocket';

let ws: WebSocket | null = null;
let listeners: ((data: string) => void)[] = [];

/**
 * Initialise la connexion WebSocket si ce n'est pas déjà fait
 */
export function initAccessWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  // ✅ 2026-05-16 — withWsToken ajoute ?token=<jwt> (requis par le backend
  // depuis le hardening WS — voir backend/src/websocket/ws_auth.rs).
  const wsUrl = withWsToken(`${WS_BASE_URL}/ws/access`);
  if (!wsUrl) return;

  console.log('📡 Connexion WebSocket Access à:', wsUrl.replace(/token=[^&]+/, 'token=***'));

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
