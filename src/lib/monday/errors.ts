export class MondayApiError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
    readonly status?: number,
  ) {
    super(message);
    this.name = "MondayApiError";
  }
}

export class MondayConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MondayConfigError";
  }
}
