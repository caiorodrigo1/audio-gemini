import { Injectable } from '@nestjs/common';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogTap = (level: LogLevel, message: string, data?: any) => void;

@Injectable()
export class LoggerService {
  private logLevel: LogLevel =
    (process.env.LOG_LEVEL as any) || 'info';
  private taps = new Set<LogTap>();

  addTap(tap: LogTap): () => void {
    this.taps.add(tap);
    return () => this.taps.delete(tap);
  }

  /**
   * Log uma mensagem com o nível especificado
   * @param level Nível do log (debug, info, warn, error)
   * @param message Mensagem a ser logada
   * @param data Dados adicionais opcionais
   */
  log(level: LogLevel, message: string, data?: any): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.logLevel];
    const messageLevel = levels[level];

    // Só logar se o nível da mensagem for >= ao nível configurado
    if (messageLevel >= currentLevel) {
      const prefix = {
        debug: '🔍',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌'
      }[level];

      const consoleMethod = level === 'debug' ? 'log' : level;
      if (data !== undefined) {
        console[consoleMethod](`${prefix} ${message}`, data);
      } else {
        console[consoleMethod](`${prefix} ${message}`);
      }
    }

    // Forward to any registered taps regardless of level filter, so
    // subscribers (e.g. web UI) can decide what to display.
    for (const tap of this.taps) {
      try {
        tap(level, message, data);
      } catch {
        // ignore tap errors
      }
    }
  }
  
  /**
   * Log de debug - apenas visível com LOG_LEVEL=debug
   */
  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }
  
  /**
   * Log informativo - visível por padrão
   */
  info(message: string, data?: any): void {
    this.log('info', message, data);
  }
  
  /**
   * Log de aviso - sempre visível
   */
  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }
  
  /**
   * Log de erro - sempre visível
   */
  error(message: string, data?: any): void {
    this.log('error', message, data);
  }
  
  /**
   * Define o nível de log dinamicamente
   */
  setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logLevel = level;
  }
  
  /**
   * Retorna o nível de log atual
   */
  getLogLevel(): 'debug' | 'info' | 'warn' | 'error' {
    return this.logLevel;
  }
}

