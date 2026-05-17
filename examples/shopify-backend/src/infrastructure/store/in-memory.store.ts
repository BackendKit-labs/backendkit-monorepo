export class InMemoryStore<T extends { id: string }> {
  private readonly data = new Map<string, T>();

  findById(id: string): T | undefined {
    return this.data.get(id);
  }

  findAll(predicate?: (item: T) => boolean): T[] {
    const all = Array.from(this.data.values());
    return predicate ? all.filter(predicate) : all;
  }

  save(item: T): T {
    this.data.set(item.id, { ...item });
    return item;
  }

  update(id: string, partial: Partial<T>): T | undefined {
    const existing = this.data.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...partial };
    this.data.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.data.delete(id);
  }

  count(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }
}
