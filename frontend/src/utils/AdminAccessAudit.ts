// src/utils/AdminAccessAudit.ts
export class WebSocketProvider {
    private socket: WebSocket;
  
    constructor(url: string) {
      // Détecter le bon protocole selon l'environnement
      const isSecure = window.location.protocol === 'https:';
      const wsProtocol = isSecure ? 'wss://' : 'ws://';
      this.socket = new WebSocket(url.replace('AdminAccessAudit://', wsProtocol));
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
  