/**
 * Logging utilities for production
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private minLevel: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.minLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;
  }

  private formatLog(entry: LogEntry): string {
    const { timestamp, level, message, context, data } = entry;
    let output = `[${timestamp}] ${level}`;
    if (context) output += ` [${context}]`;
    output += `: ${message}`;
    if (data) output += ` ${JSON.stringify(data)}`;
    return output;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private log(level: LogLevel, message: string, context?: string, data?: Record<string, any>, error?: Error) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
      } : undefined,
    };

    const formatted = this.formatLog(entry);

    // Use appropriate console method
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
        console.error(formatted);
        break;
    }

    // Send to external logging service in production
    if (!this.isDevelopment && level === LogLevel.ERROR) {
      this.reportToExternalService(entry);
    }
  }

  private reportToExternalService(entry: LogEntry) {
    // TODO: Implement external logging (e.g., Sentry, LogRocket, etc.)
    // Example: Sentry.captureException(entry.error);
  }

  debug(message: string, context?: string, data?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  info(message: string, context?: string, data?: Record<string, any>) {
    this.log(LogLevel.INFO, message, context, data);
  }

  warn(message: string, context?: string, data?: Record<string, any>) {
    this.log(LogLevel.WARN, message, context, data);
  }

  error(message: string, error?: Error, context?: string, data?: Record<string, any>) {
    this.log(LogLevel.ERROR, message, context, data, error);
  }
}

export const logger = new Logger();
