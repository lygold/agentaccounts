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

/**
 * Thrown when a read succeeds but the result does not belong to the
 * authenticated agent. Treat as a 403 at the request boundary. Ported from
 * sikkumPigisha for the /sikkum wizard's Monday reads (Phase 8).
 */
export class MondayOwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MondayOwnershipError";
  }
}
