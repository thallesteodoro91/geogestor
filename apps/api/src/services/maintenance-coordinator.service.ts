import { AsyncLocalStorage } from 'node:async_hooks';

type MaintenanceOperation = 'backup' | 'migration' | 'reset' | 'sqlite-maintenance';

export class MaintenanceCoordinator {
  private static context = new AsyncLocalStorage<{ operation: MaintenanceOperation }>();
  private static tail: Promise<void> = Promise.resolve();
  private static activeOperation: MaintenanceOperation | null = null;
  private static waiting = 0;

  static async runExclusive<T>(operation: MaintenanceOperation, task: () => Promise<T>): Promise<T> {
    if (this.context.getStore()) return task();

    const previous = this.tail;
    let release: () => void = () => undefined;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.waiting += 1;
    await previous;
    this.waiting -= 1;
    this.activeOperation = operation;

    try {
      return await this.context.run({ operation }, task);
    } finally {
      this.activeOperation = null;
      release();
    }
  }

  static snapshot() {
    return {
      activeOperation: this.activeOperation,
      waiting: this.waiting
    };
  }
}
