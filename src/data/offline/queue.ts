/** Cola duradera y serializada: una operación solo se elimina tras confirmación del servidor. */
export interface PendingLog {
  op?: 'insert' | 'delete';
  clientId: string;
  habitId: string;
  dayKey: string;
  value: number;
  tz: string;
  note?: string | null;
}
export interface QueueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export class LogQueue {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private storage: QueueStorage, private key: string) {}
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn);
    this.tail = result.catch(() => {});
    return result;
  }
  private async read(): Promise<PendingLog[]> {
    const raw = await this.storage.getItem(this.key);
    return raw ? JSON.parse(raw) : [];
  }
  list() { return this.serial(() => this.read()); }
  clear() { return this.serial(() => this.storage.setItem(this.key, '[]')); }
  add(log: PendingLog) {
    return this.serial(async () => {
      const rows = await this.read();
      if (!rows.some((r) => r.clientId === log.clientId)) rows.push(log);
      await this.storage.setItem(this.key, JSON.stringify(rows));
    });
  }
  remove(id: string) {
    return this.serial(async () => {
      await this.storage.setItem(this.key, JSON.stringify((await this.read()).filter((r) => r.clientId !== id)));
    });
  }
  flush(send: (log: PendingLog) => Promise<void>, isCurrent: () => boolean) {
    return this.serial(async () => {
      const rows = await this.read();
      while (rows.length && isCurrent()) {
        await send(rows[0]!); // En error conserva este elemento y los posteriores.
        rows.shift();
        await this.storage.setItem(this.key, JSON.stringify(rows));
      }
      return rows.length;
    });
  }
}
