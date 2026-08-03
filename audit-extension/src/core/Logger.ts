import * as vscode from 'vscode';

/**
 * Centralized logging through a VS Code OutputChannel.
 * A single shared channel for the whole extension, injected into components.
 */
export class Logger {
  private readonly channel: vscode.OutputChannel;

  constructor(name = 'Audit Extension') {
    this.channel = vscode.window.createOutputChannel(name);
  }

  private write(level: string, message: string): void {
    const ts = new Date().toISOString();
    this.channel.appendLine(`[${ts}] [${level}] ${message}`);
  }

  info(message: string): void {
    this.write('INFO', message);
  }

  warn(message: string): void {
    this.write('WARN', message);
  }

  error(message: string, err?: unknown): void {
    const detail = err instanceof Error ? ` — ${err.stack ?? err.message}` : '';
    this.write('ERROR', message + detail);
  }

  show(): void {
    this.channel.show(true);
  }

  dispose(): void {
    this.channel.dispose();
  }
}
