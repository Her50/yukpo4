// src/utils/AdminAccessAudit.ts
import { withWsToken } from '../config/websocket';

export class WebSocketProvider {
    private socket: WebSocket;

    constructor(url: string) {
      // Détecter le bon protocole selon l'environnement
      const isSecure = window.location.protocol === 'https:';
      const wsProtocol = isSecure ? 'wss://' : 'ws://';
      const finalUrl = withWsToken(url.replace('AdminAccessAudit://', wsProtocol));
      this.socket = new WebSocket(finalUrl ?? url);
    }
  
    on(event: string, callback: (data: any) => void) {
      this.socket.addEventListener("message", (e) => {
        const data = JSON.parse(e.data);
        if (data.type === event) {
          callback(data.payload);
        }
      });
    }
  
    close() {
      this.socket.close();
    }
  }
  