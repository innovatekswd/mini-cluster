import * as signalR from "@microsoft/signalr";

// Get base URL for SignalR hub (same as API but different path)
const getBaseUrl = (): string => {
  // In development, use Vite's same-origin proxy for /terminalhub.
  if (import.meta.env.DEV) {
    return "";
  }
  // In production, use the same origin
  return window.location.origin;
};

export interface TerminalConnection {
  connection: signalR.HubConnection;
  terminalId: string | null;
}

export type TerminalDataCallback = (terminalId: string, data: string) => void;
export type TerminalExitCallback = (terminalId: string, exitCode: number) => void;
export type TerminalErrorCallback = (terminalId: string, error: string) => void;
export type TerminalConnectionClosedCallback = () => void;

class TerminalService {
  private connection: signalR.HubConnection | null = null;
  private onDataCallbacks: Map<string, TerminalDataCallback[]> = new Map();
  private onExitCallbacks: Map<string, TerminalExitCallback[]> = new Map();
  private onErrorCallbacks: Map<string, TerminalErrorCallback[]> = new Map();
  private onConnectionClosedCallbacks: Set<TerminalConnectionClosedCallback> = new Set();
  private activeTerminalIds: Set<string> = new Set();
  private connectionPromise: Promise<signalR.HubConnection> | null = null;
  private isConnecting = false;
  private isIntentionalDisconnect = false;

  async connect(): Promise<signalR.HubConnection> {
    // If already connected, return the connection
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      return this.connection;
    }

    // If currently connecting, wait for that promise
    if (this.connectionPromise && this.isConnecting) {
      return this.connectionPromise;
    }

    // If connection exists but not connected, recreate it
    if (this.connection) {
      const state = this.connection.state;
      if (state === signalR.HubConnectionState.Disconnected || 
          state === signalR.HubConnectionState.Disconnecting) {
        try {
          await this.connection.stop();
        } catch {
          // Ignore stop errors
        }
        this.connection = null;
      }
    }

    this.isConnecting = true;
    const baseUrl = getBaseUrl();
    
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${baseUrl}/terminalhub`, {
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.ServerSentEvents,
      })
      .withServerTimeout(60000)     // Match server's 60s ClientTimeoutInterval
      .withKeepAliveInterval(30000) // Match server's 30s KeepAliveInterval
      .configureLogging(signalR.LogLevel.None)
      .build();

    // Set up event handlers
    this.connection.on("TerminalData", (terminalId: string, data: string) => {
      const callbacks = this.onDataCallbacks.get(terminalId);
      callbacks?.forEach(cb => {
        try {
          cb(terminalId, data);
        } catch (e) {
          console.error("Error in terminal data callback:", e);
        }
      });
    });

    this.connection.on("TerminalExit", (terminalId: string, exitCode: number) => {
      const callbacks = this.onExitCallbacks.get(terminalId);
      callbacks?.forEach(cb => {
        try {
          cb(terminalId, exitCode);
        } catch (e) {
          console.error("Error in terminal exit callback:", e);
        }
      });
    });

    this.connection.on("TerminalError", (terminalId: string, error: string) => {
      const callbacks = this.onErrorCallbacks.get(terminalId);
      callbacks?.forEach(cb => {
        try {
          cb(terminalId, error);
        } catch (e) {
          console.error("Error in terminal error callback:", e);
        }
      });
    });

    // Handle connection close
    this.connection.onclose((error) => {
      const wasIntentional = this.isIntentionalDisconnect;
      if (!wasIntentional) {
        console.warn("SignalR connection closed:", error?.message || "No error");
      }
      this.isConnecting = false;
      this.connectionPromise = null;
      this.connection = null;

      if (!wasIntentional) {
        this.activeTerminalIds.clear();
        this.onConnectionClosedCallbacks.forEach(cb => {
          try {
            cb();
          } catch (e) {
            console.error("Error in terminal connection closed callback:", e);
          }
        });
      }
    });

    this.connection.onreconnecting(() => {
      // SignalR reconnecting
    });

    this.connection.onreconnected(() => {
      // SignalR reconnected
    });

    this.connectionPromise = (async () => {
      try {
        await this.connection!.start();
        return this.connection!;
      } finally {
        this.isConnecting = false;
      }
    })();

    return this.connectionPromise;
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      this.isIntentionalDisconnect = true;
      try {
        await this.connection.stop();
      } finally {
        setTimeout(() => {
          this.isIntentionalDisconnect = false;
        }, 0);
        this.connection = null;
      }
    }
    this.activeTerminalIds.clear();
    this.onDataCallbacks.clear();
    this.onExitCallbacks.clear();
    this.onErrorCallbacks.clear();
  }

  async createTerminal(
    workingDirectory?: string,
    cols: number = 120,
    rows: number = 30
  ): Promise<string> {
    const conn = await this.connect();
    const terminalId = await conn.invoke<string>(
      "CreateTerminal",
      workingDirectory ?? null,
      cols,
      rows
    );
    this.activeTerminalIds.add(terminalId);
    return terminalId;
  }

  async writeToTerminal(terminalId: string, data: string): Promise<void> {
    const conn = await this.connect();
    await conn.invoke("WriteToTerminal", terminalId, data);
  }

  async resizeTerminal(terminalId: string, cols: number, rows: number): Promise<void> {
    const conn = await this.connect();
    await conn.invoke("ResizeTerminal", terminalId, cols, rows);
  }

  async closeTerminal(terminalId: string): Promise<void> {
    // Clean up callbacks
    this.onDataCallbacks.delete(terminalId);
    this.onExitCallbacks.delete(terminalId);
    this.onErrorCallbacks.delete(terminalId);
    this.activeTerminalIds.delete(terminalId);

    const conn = this.connection;
    if (conn?.state === signalR.HubConnectionState.Connected) {
      await conn.invoke("CloseTerminal", terminalId);
    }

    if (this.activeTerminalIds.size === 0 && this.connection) {
      this.isIntentionalDisconnect = true;
      try {
        await this.connection.stop();
      } finally {
        setTimeout(() => {
          this.isIntentionalDisconnect = false;
        }, 0);
        this.connection = null;
        this.connectionPromise = null;
      }
    }
  }

  async getActiveTerminals(): Promise<string[]> {
    const conn = await this.connect();
    return await conn.invoke<string[]>("GetActiveTerminals");
  }

  onData(terminalId: string, callback: TerminalDataCallback): () => void {
    if (!this.onDataCallbacks.has(terminalId)) {
      this.onDataCallbacks.set(terminalId, []);
    }
    this.onDataCallbacks.get(terminalId)!.push(callback);

    return () => {
      const callbacks = this.onDataCallbacks.get(terminalId);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  onExit(terminalId: string, callback: TerminalExitCallback): () => void {
    if (!this.onExitCallbacks.has(terminalId)) {
      this.onExitCallbacks.set(terminalId, []);
    }
    this.onExitCallbacks.get(terminalId)!.push(callback);

    return () => {
      const callbacks = this.onExitCallbacks.get(terminalId);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  onError(terminalId: string, callback: TerminalErrorCallback): () => void {
    if (!this.onErrorCallbacks.has(terminalId)) {
      this.onErrorCallbacks.set(terminalId, []);
    }
    this.onErrorCallbacks.get(terminalId)!.push(callback);

    return () => {
      const callbacks = this.onErrorCallbacks.get(terminalId);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  onConnectionClosed(callback: TerminalConnectionClosedCallback): () => void {
    this.onConnectionClosedCallbacks.add(callback);
    return () => {
      this.onConnectionClosedCallbacks.delete(callback);
    };
  }

  getConnectionState(): signalR.HubConnectionState | null {
    return this.connection?.state ?? null;
  }
}

// Export singleton instance
export const terminalService = new TerminalService();
