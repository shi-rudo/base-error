// src/BaseError.ts

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
 * This class includes support for default and localized user-friendly messages.
 *
 * @example
 * ```ts
 * // Using automatic name inference (recommended)
 * class UserNotFoundError extends BaseError<'UserNotFoundError'> {
 * constructor(userId: string) {
 * super(`User with id ${userId} not found in database lookup`); // Technical message
 * this.withUserMessage(`User ${userId} was not found.`); // User-friendly message
 * }
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

  // --- New properties for user-friendly messages ---
  private _defaultUserMessage?: string;
  private _localizedMessages: Record<string, string> = {};

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

  // ————————————————————————————————————————————————————————————————
  // Methods for User-Friendly Messages
  // ————————————————————————————————————————————————————————————————

  /**
   * Sets the default user-friendly message.
   * This is used as a fallback when a specific localization is not available.
   * @param message The default user-friendly message (typically in English).
   * @returns The error instance for chaining.
   */
  public withUserMessage(message: string): this {
    this._defaultUserMessage = message;
    return this;
  }

  /**
   * Adds a user-friendly message for a specific language.
   * Can be called multiple times for different languages.
   * @param lang The language code (e.g., 'de', 'es', 'fr-CA').
   * @param message The localized message.
   * @returns The error instance for chaining.
   */
  public addLocalizedMessage(lang: string, message: string): this {
    this._localizedMessages[lang] = message;
    return this;
  }

  /**
   * Retrieves the most appropriate user-friendly message based on language preference.
   * The fallback order is: preferred language -> fallback language -> default message.
   * @param options - Language preference options.
   * @returns The user-friendly message, or `undefined` if none is set.
   */
  public getUserMessage(options?: {
    preferredLang?: string;
    fallbackLang?: string;
  }): string | undefined {
    const { preferredLang, fallbackLang } = options || {};

    // 1. Try to get the message for the preferred language.
    if (preferredLang && this._localizedMessages[preferredLang]) {
      return this._localizedMessages[preferredLang];
    }

    // 2. If not found, try the fallback language (e.g., 'en').
    if (fallbackLang && this._localizedMessages[fallbackLang]) {
      return this._localizedMessages[fallbackLang];
    }

    // 3. If still not found, return the default user message.
    return this._defaultUserMessage;
  }

  /** Serialises the error for JSON logs */
  public toJSON(): Record<string, unknown> {
    const { name, message, timestamp, timestampIso, stack } = this;
    const cause = (this as unknown as Record<string, unknown>).cause;

    const json: Record<string, unknown> = {
      name,
      message, // The original technical message
      timestamp,
      timestampIso,
      stack,
      cause: cause instanceof Error ? cause.toString() : cause,
    };

    // Add user messages to the JSON output for logging if they exist
    if (this._defaultUserMessage) {
      json.userMessage = this._defaultUserMessage;
    }
    if (Object.keys(this._localizedMessages).length > 0) {
      json.localizedMessages = this._localizedMessages;
    }

    return json;
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
