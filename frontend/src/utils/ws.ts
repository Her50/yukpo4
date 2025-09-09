import React from 'react';
// @ts-check
let ws: WebSocket | null = null;
let listeners: ((data: string) => void)[] = [];

/**
 * Initialise la connexion WebSocket si ce n’est pas déjà fait
 */
export function initAccessWebSocket() {
  // WebSockets temporairement désactivés
  console.log('🔌 WebSockets désactivés par configuration');
  return;
  
  // if (ws && ws.readyState === WebSocket.OPEN) return;

  // ws = new WebSocket(`ws://${window.location.host}/ws/access`);

  // ws.onmessage = (event) => {
  //   for (const cb of listeners) {
  //     cb(event.data);
  //   }
  // };

  // ws.onopen = () => console.log('📡 WebSocket Access connecté');
  // ws.onclose = () => console.warn('🔌 WebSocket Access déconnecté');
  // ws.onerror = (e) => console.error('❌ Erreur WebSocket Access :', e);
}

/**
 * Permet à un composant de réagir aux événements WebSocket
 */
export function subscribeAccessUpdates(callback: (data: string) => void) {
  // WebSockets temporairement désactivés
  console.log('🔌 WebSockets désactivés par configuration');
  return;
  
  // listeners.push(callback);
  // initAccessWebSocket();
}

/**
 * Nettoyage d’un listener
 */
export function unsubscribeAccessUpdates(callback: (data: string) => void) {
  // WebSockets temporairement désactivés
  console.log('🔌 WebSockets désactivés par configuration');
  return;
  
  // listeners = listeners.filter((cb) => cb !== callback);
}
