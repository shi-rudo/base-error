// Type augmentation for ErrorConstructor to include non‑standard V8 helpers
// (present in Node.js and any V8‑based runtime such as most “edge” functions)
declare global {
  // Extend the existing ErrorConstructor interface
  interface ErrorConstructor {
    captureStackTrace?(
      error: Error,
      constructorOpt?: (...args: unknown[]) => unknown,
    ): void;
    // stackTraceLimit is already defined in lib.dom.d.ts as number | undefined
    // We need to match that type exactly to avoid conflicts
    stackTraceLimit: number | undefined;
  }
}

/**
 * Application-specific base error that works across full Node.js, isolate "edge"
 * runtimes (Cloudflare Workers, Deno Deploy, Vercel Edge Functions) and modern
 * browsers. It preserves the native `cause` field where available, falls back
 * gracefully where it is not, and produces the richest stack trace the host
 * can provide.
 *
 * @example
 * ```ts
 * // Using automatic name inference (recommended)
 * class UserNotFoundError extends BaseError<'UserNotFoundError'> {
 *   constructor(userId: string) {
 *     super(`User ${userId} not found`);
 *   }
 * }
 *
 * // Using explicit name (legacy)
 * class UserNotFoundError extends BaseError<'UserNotFoundError'> {
 *   constructor(userId: string) {
 *     super('UserNotFoundError', `User ${userId} not found`);
 *   }
 * }
 * ```
 */
export class BaseError<T extends string> extends Error {
  public readonly name: T;

  /** Epoch-ms timestamp (numeric) */
  public readonly timestamp: number = Date.now();

  /** ISO-8601 timestamp (string) for log aggregators that prefer text */
  public readonly timestampIso: string = new Date().toISOString();

  /** Rich, filtered stack where the host supports it. */
  public readonly stack?: string;

  /**
   * Creates a new BaseError instance.
   *
   * @overload
   * @param message – Human-readable explanation (name will be inferred from constructor)
   * @param cause   – Optional underlying error or extra context
   */
  public /*#__PURE__*/ constructor(message: string, cause?: unknown);
  /**
   * Creates a new BaseError instance.
   *
   * @overload
   * @param name    – Error identifier (usually the subclass name)
   * @param message – Human-readable explanation
   * @param cause   – Optional underlying error or extra context
   */
  public /*#__PURE__*/ constructor(name: T, message: string, cause?: unknown);
  /**
   * Implementation of the overloaded constructor.
   */
  // The /*#__PURE__*/ pragma lets tree-shakers know the constructor is side-effect free
  public /*#__PURE__*/ constructor(
    nameOrMessage: T | string,
    messageOrCause?: string | unknown,
    cause?: unknown,
  ) {
    // Determine if we're using the new single-parameter form or the legacy form
    const isNewForm = typeof messageOrCause !== "string";

    let actualMessage: string;
    let actualCause: unknown;

    if (isNewForm) {
      // New form: constructor(message, cause?)
      actualMessage = nameOrMessage as string;
      actualCause = messageOrCause;
    } else {
      // Legacy form: constructor(name, message, cause?)
      actualMessage = messageOrCause as string;
      actualCause = cause;
    }

    // Call super with just the message parameter to ensure compatibility with all environments
    super(actualMessage);

    // Set the name after super() call
    const actualName: T = isNewForm
      ? (this.constructor.name as T)
      : (nameOrMessage as T);

    // Handle cause separately to support environments that don't have native cause support
    if (actualCause !== undefined) {
      try {
        // Try to set cause using modern error options if supported
        Object.defineProperty(this, "cause", {
          value: actualCause,
          configurable: true,
          writable: true,
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_) {
        // Fallback for environments where defineProperty fails
        // Need to use any here as cause is not in the standard Error type
        (this as unknown as Record<string, unknown>).cause = actualCause;
      }
    }

    // Preserve prototype chain for `instanceof` checks after transpilation.
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = actualName;

    // Cross-runtime best-effort stack collection
    this.stack = this.#captureStack();

    // Guarantee a `cause` field on older runtimes so callers can rely on it.
    if (
      actualCause !== undefined &&
      !(this as unknown as Record<string, unknown>).cause
    ) {
      (this as unknown as Record<string, unknown>).cause = actualCause;
    }
  }

  /** Serialises the error for JSON logs */
  public toJSON(): Record<string, unknown> {
    const { name, message, timestamp, timestampIso, stack } = this;
    const cause = (this as unknown as Record<string, unknown>).cause;

    return {
      name,
      message,
      timestamp,
      timestampIso,
      stack,
      cause: cause instanceof Error ? cause.toString() : cause,
    };
  }

  /** Readable one-liner plus optional nested cause. */
  public toString(): string {
    const cause = (this as unknown as Record<string, unknown>).cause;
    return `[${this.name}] ${this.message}${
      cause ? `\nCaused by: ${cause}` : ""
    }`;
  }

  // ————————————————————————————————————————————————————————————————
  // Internal helpers
  // ————————————————————————————————————————————————————————————————

  /**
   * Attempts to generate the most informative stack trace available in the
   * current environment while keeping the method side‑effect free for bundlers.
   */
  /*#__PURE__*/ #captureStack(): string | undefined {
    const originalLimit = Error.stackTraceLimit;

    try {
      Error.stackTraceLimit = 20;
      const err = new Error();

      if (typeof Error.captureStackTrace === "function") {
        // Node.js / V8: we can filter out the constructor frame.
        Error.captureStackTrace(err, this.constructor);
        return err.stack;
      }

      if (err.stack) {
        // All modern JS engines expose a `.stack` string.
        const lines = err.stack.split("\n");
        lines[0] = `${this.name}: ${this.message}`; // Replace generic header.
        return lines.join("\n");
      }

      // Very old or extremely minimal engines: last‑chance effort.
      try {
        throw err;
      } catch (e) {
        return (e as Error).stack;
      }
    } finally {
      Error.stackTraceLimit = originalLimit;
    }
  }
}
