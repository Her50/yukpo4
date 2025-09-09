// src/utils/AdminAccessAudit.ts
export class WebSocketProvider {
    private socket: WebSocket;
  
    constructor(url: string) {
      this.socket = new WebSocket(url.replace('AdminAccessAudit://', 'ws://'));
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
  