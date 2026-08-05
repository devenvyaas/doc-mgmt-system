export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface LogPayload {
  method: string;
  route: string;
  status: number;
  durationMs?: number;
  error?: string | Error;
  details?: Record<string, unknown>;
}

class ServerLogger {
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private log(level: LogLevel, payload: LogPayload) {
    const timestamp = this.formatTimestamp();
    const { method, route, status, durationMs, error, details } = payload;
    const durationStr = durationMs !== undefined ? ` (${durationMs}ms)` : '';

    if (level === 'ERROR' || status >= 400) {
      const errorMsg = error instanceof Error ? error.message : error || 'Unknown Server Error';
      const stack = error instanceof Error && error.stack ? `\nStack: ${error.stack}` : '';
      const detailsStr = details ? ` - Details: ${JSON.stringify(details)}` : '';

      console.error(
        `[SERVER ERROR] [${timestamp}] ${method} ${route} | Status: ${status} | Error: ${errorMsg}${durationStr}${detailsStr}${stack}`
      );
    } else {
      const detailsStr = details ? ` - Details: ${JSON.stringify(details)}` : '';
      console.log(
        `[SERVER SUCCESS] [${timestamp}] ${method} ${route} | Status: ${status}${durationStr}${detailsStr}`
      );
    }
  }

  info(payload: LogPayload) {
    this.log('INFO', payload);
  }

  error(payload: LogPayload) {
    this.log('ERROR', payload);
  }
}

export const logger = new ServerLogger();
