export class Timer {
  private startTime: number;
  private taskName: string;

  constructor(taskName: string) {
    this.taskName = taskName;
    this.startTime = Date.now();
  }

  getElapsedTime(): string {
    const elapsed = Date.now() - this.startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  log(message: string): void {
    console.log(`[${this.getElapsedTime()}] ${message}`);
  }

  logStart(): void {
    console.log(`⏱️ [0m 0s] Iniciando: ${this.taskName}`);
  }

  logEnd(): void {
    console.log(`✅ [${this.getElapsedTime()}] Concluído: ${this.taskName}`);
  }
}