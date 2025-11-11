import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getWebSocketUrl } from '@/config/websocket';
import { useUser } from './useUser';

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';

export interface DeliveryLocationEvent {
  event: 'location';
  latitude: number;
  longitude: number;
  speed_kmh?: number;
  bearing?: number;
  accuracy_meters?: number;
  timestamp?: string;
}

export interface DeliveryStatusEvent {
  event: 'status';
  status: string;
  cancel_reason?: string | null;
  timestamp?: string;
}

export interface DeliveryPricingEvent {
  event: 'pricing';
  base_price_cents: number;
  distance_price_cents: number;
  surcharge_cents: number;
  discount_cents: number;
  shopping_cost_cents?: number;
  shopping_discount_cents?: number;
  currency: string;
  timestamp?: string;
}

export interface ShoppingStatusEvent {
  event: 'shopping_status';
  status: string;
  metadata?: unknown;
  timestamp?: string;
}

export interface ConnectedEvent {
  event: 'connected';
  delivery_id: string;
  user_id?: number;
  timestamp?: string;
}

export type DeliveryTrackingEvent =
  | DeliveryLocationEvent
  | DeliveryStatusEvent
  | DeliveryPricingEvent
  | ShoppingStatusEvent
  | ConnectedEvent;

interface TrackingState {
  connectionState: ConnectionState;
  deliveryStatus?: string;
  shoppingStatus?: string;
  lastLocation?: DeliveryLocationEvent;
  pricing?: DeliveryPricingEvent;
  events: DeliveryTrackingEvent[];
  error?: string;
}

const buildWebSocketUrl = (deliveryId: string, token?: string | null) => {
  const url = getWebSocketUrl('deliveryTracking', deliveryId);
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (token) {
      parsed.searchParams.set('token', token);
    }
    return parsed.toString();
  } catch (error) {
    console.error('[useCourierShopping] URL invalide', error);
    return null;
  }
};

export const useCourierShopping = (deliveryId?: string | null) => {
  const { user } = useUser();
  const [state, setState] = useState<TrackingState>({
    connectionState: 'idle',
    events: [],
  });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<number | undefined>(undefined);

  const connect = useCallback(() => {
    if (!deliveryId) {
      return;
    }

    const token = localStorage.getItem('token');
    const url = buildWebSocketUrl(deliveryId, token);

    if (!url) {
      setState((prev) => ({
        ...prev,
        connectionState: 'error',
        error: 'URL WebSocket invalide',
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      connectionState: 'connecting',
      error: undefined,
    }));

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempts.current = 0;
        setState((prev) => ({
          ...prev,
          connectionState: 'connected',
          error: undefined,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const payload: DeliveryTrackingEvent = JSON.parse(event.data);
          setState((prev) => {
            const events = [payload, ...prev.events].slice(0, 50);
            let deliveryStatus = prev.deliveryStatus;
            let shoppingStatus = prev.shoppingStatus;
            let lastLocation = prev.lastLocation;
            let pricing = prev.pricing;

            switch (payload.event) {
              case 'status':
                deliveryStatus = payload.status;
                break;
              case 'shopping_status':
                shoppingStatus = payload.status;
                break;
              case 'location':
                lastLocation = payload;
                break;
              case 'pricing':
                pricing = payload;
                break;
              default:
                break;
            }

            return {
              ...prev,
              events,
              deliveryStatus,
              shoppingStatus,
              lastLocation,
              pricing,
            };
          });
        } catch (error) {
          console.error('[useCourierShopping] Erreur parsing message', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[useCourierShopping] WebSocket error', error);
        setState((prev) => ({
          ...prev,
          connectionState: 'error',
          error: 'Erreur de connexion temps réel',
        }));
      };

      ws.onclose = () => {
        setState((prev) => ({
          ...prev,
          connectionState: 'closed',
        }));

        // Tentative de reconnexion limitée
        if (reconnectAttempts.current < 3) {
          reconnectAttempts.current += 1;
          const timeout = window.setTimeout(() => {
            connect();
          }, 2000 * reconnectAttempts.current);
          reconnectTimeoutRef.current = timeout;
        }
      };
    } catch (error) {
      console.error('[useCourierShopping] Impossible d\'ouvrir la connexion', error);
      setState((prev) => ({
        ...prev,
        connectionState: 'error',
        error: 'Impossible d\'ouvrir la connexion WebSocket',
      }));
    }
  }, [deliveryId]);

  const disconnect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      wsRef.current.close();
    }
    wsRef.current = null;
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    reconnectAttempts.current = 0;
  }, []);

  useEffect(() => {
    if (!deliveryId) {
      return;
    }

    connect();

    return () => {
      disconnect();
    };
  }, [deliveryId, connect, disconnect]);

  const resetHistory = useCallback(() => {
    setState((prev) => ({
      ...prev,
      events: [],
    }));
  }, []);

  return useMemo(
    () => ({
      ...state,
      connect,
      disconnect,
      resetHistory,
      isCourier: user?.role === 'user',
    }),
    [state, connect, disconnect, resetHistory, user?.role],
  );
};

export default useCourierShopping;

