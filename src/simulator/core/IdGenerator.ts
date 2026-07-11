/** Small deterministic ID generator used by tests and scripted scenarios. */
export class IdGenerator {
  private nextValue: number;

  constructor(private readonly initialValue = 1) {
    this.nextValue = initialValue;
  }

  next(prefix: string): string {
    const id = `${prefix}-${this.nextValue}`;
    this.nextValue += 1;
    return id;
  }

  reset(): void {
    this.nextValue = this.initialValue;
  }
}
