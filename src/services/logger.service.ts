import { Injectable } from '@nestjs/common';

@Injectable()
export class LoggerService {
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 
    (process.env.LOG_LEVEL as any) || 'info';

  /**
   * Log uma mensagem com o nível especificado
   * @param level Nível do log (debug, info, warn, error)
   * @param message Mensagem a ser logada
   * @param data Dados adicionais opcionais
   */
  log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any): void {
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
      
      // Usar console.log para debug, console[level] para outros
      const consoleMethod = level === 'debug' ? 'log' : level;
      if (data !== undefined) {
        console[consoleMethod](`${prefix} ${message}`, data);
      } else {
        console[consoleMethod](`${prefix} ${message}`);
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

