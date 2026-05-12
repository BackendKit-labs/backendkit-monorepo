import { IAnimation } from '../core/animation.interface.js';
import { AnimationType } from '../types/animation-types.js';

export class AnimationRegistry {
  private registry: Map<string, IAnimation> = new Map();

  register(animation: IAnimation): void {
    if (this.registry.has(animation.id)) {
      throw new Error(`Animation with id '${animation.id}' is already registered`);
    }
    this.registry.set(animation.id, animation);
  }

  unregister(id: string): boolean {
    return this.registry.delete(id);
  }

  get(id: string): IAnimation | undefined {
    return this.registry.get(id);
  }

  getAll(): IAnimation[] {
    return Array.from(this.registry.values());
  }

  getByType(type: AnimationType): IAnimation[] {
    return this.getAll().filter((a) => a.type === type);
  }

  get count(): number {
    return this.registry.size;
  }

  clear(): void {
    this.registry.clear();
  }
}
