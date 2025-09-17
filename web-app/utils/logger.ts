/**
 * Logging utility
 * Centralized logging with different levels and formats
 */

import { Request, Response } from 'express';
import { Logger as ILogger, LogLevel } from '../types';
import * as fs from 'fs';
import * as path from 'path';

interface LogLevels {
  error: number;
  warn: number;
  info: number;
  debug: number;
}

interface LogStats {
  fileSize: number;
  totalLines: number;
  levelCounts: {
    error: number;
    warn: number;
    info: number;
    debug: number;
  };
  lastModified: Date;
  firstLine: string | null;
  lastLine: string | null;
}

interface LoggingConfig {
  level: LogLevel;
  format: string;
  enableConsole: boolean;
  enableFile: boolean;
  logFile: string;
}

class Logger implements ILogger {
  private logLevel: LogLevel;
  private enableConsole: boolean;
  private enableFile: boolean;
  private logFile: string;
  private levels: LogLevels;

  constructor() {
    // Import config dynamically to avoid circular dependencies
    let loggingConfig: LoggingConfig;
    try {
      const config = require('../config/config');
      loggingConfig = config.default?.logging || config.logging;
    } catch (error) {
      // Fallback configuration if config is not available
      loggingConfig = {
        level: 'info' as LogLevel,
        format: 'combined',
        enableConsole: true,
        enableFile: false,
        logFile: 'logs/app.log'
      };
    }
    
    this.logLevel = loggingConfig.level;
    this.enableConsole = loggingConfig.enableConsole;
    this.enableFile = loggingConfig.enableFile;
    this.logFile = loggingConfig.logFile;
    
    // Create logs directory if it doesn't exist
    if (this.enableFile) {
      const logDir = path.dirname(this.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    }
    
    // Define log levels
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  /**
   * Check if log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  /**
   * Format log message
   */
  private formatMessage(level: LogLevel, message: string, meta: any = {}): string {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }

  /**
   * Write to console
   */
  private writeToConsole(level: LogLevel, message: string, meta: any): void {
    if (!this.enableConsole) return;
    
    const formattedMessage = this.formatMessage(level, message, meta);
    
    switch (level) {
      case 'error':
        console.error(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'info':
        console.info(formattedMessage);
        break;
      case 'debug':
        console.debug(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }

  /**
   * Write to file
   */
  private writeToFile(level: LogLevel, message: string, meta: any): void {
    if (!this.enableFile) return;
    
    const formattedMessage = this.formatMessage(level, message, meta);
    
    try {
      fs.appendFileSync(this.logFile, formattedMessage + '\n');
    } catch (error: any) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Log message
   */
  private log(level: LogLevel, message: string, meta: any = {}): void {
    if (!this.shouldLog(level)) return;
    
    this.writeToConsole(level, message, meta);
    this.writeToFile(level, message, meta);
  }

  /**
   * Error level logging
   */
  error(message: string, meta: any = {}): void {
    this.log('error', message, meta);
  }

  /**
   * Warning level logging
   */
  warn(message: string, meta: any = {}): void {
    this.log('warn', message, meta);
  }

  /**
   * Info level logging
   */
  info(message: string, meta: any = {}): void {
    this.log('info', message, meta);
  }

  /**
   * Debug level logging
   */
  debug(message: string, meta: any = {}): void {
    this.log('debug', message, meta);
  }

  /**
   * Log HTTP request
   */
  logRequest(req: Request, res: Response, responseTime: number): void {
    const meta = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: (req as any).user ? (req as any).user.id : 'anonymous'
    };
    
    const level: LogLevel = res.statusCode >= 400 ? 'error' : 'info';
    this.log(level, `${req.method} ${req.originalUrl} ${res.statusCode}`, meta);
  }

  /**
   * Log API call
   */
  logApiCall(userId: string, endpoint: string, method: string, status: number, responseTime: number, error: Error | null = null): void {
    const meta = {
      userId,
      endpoint,
      method,
      status,
      responseTime: `${responseTime}ms`,
      error: error ? error.message : null
    };
    
    const level: LogLevel = status >= 400 ? 'error' : 'info';
    this.log(level, `API Call: ${method} ${endpoint}`, meta);
  }

  /**
   * Log authentication event
   */
  logAuth(event: string, userId: string, success: boolean, details: any = {}): void {
    const meta = {
      event,
      userId,
      success,
      ...details
    };
    
    const level: LogLevel = success ? 'info' : 'warn';
    this.log(level, `Auth Event: ${event}`, meta);
  }

  /**
   * Log system event
   */
  logSystem(event: string, details: any = {}): void {
    const meta = {
      event,
      ...details
    };
    
    this.log('info', `System Event: ${event}`, meta);
  }

  /**
   * Get log statistics
   */
  getLogStats(): LogStats | { error: string } {
    if (!this.enableFile || !fs.existsSync(this.logFile)) {
      return { error: 'Log file not available' };
    }
    
    try {
      const stats = fs.statSync(this.logFile);
      const content = fs.readFileSync(this.logFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      const levelCounts = {
        error: 0,
        warn: 0,
        info: 0,
        debug: 0
      };
      
      lines.forEach(line => {
        if (line.includes('ERROR:')) levelCounts.error++;
        else if (line.includes('WARN:')) levelCounts.warn++;
        else if (line.includes('INFO:')) levelCounts.info++;
        else if (line.includes('DEBUG:')) levelCounts.debug++;
      });
      
      return {
        fileSize: stats.size,
        totalLines: lines.length,
        levelCounts,
        lastModified: stats.mtime,
        firstLine: lines[0] || null,
        lastLine: lines[lines.length - 1] || null
      };
    } catch (error: any) {
      return { error: error.message };
    }
  }
}

// Export singleton instance
export default new Logger();
