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
 * // Using automatic name inference
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

  // --- Properties for user-friendly messages ---
  private _defaultUserMessage?: string;
  private _localizedMessages = new Map<string, string>();

  /**
   * Creates a new BaseError instance with automatic name inference.
   *
   * @param message – Human-readable explanation (name will be inferred from constructor)
   * @param cause   – Optional underlying error or extra context
   */
  // The /*#__PURE__*/ pragma lets tree-shakers know the constructor is side-effect free
  public /*#__PURE__*/ constructor(message: string, cause?: unknown) {
    // Always call super with just message for TypeScript compatibility
    super(message);

    // Automatically infer the error name from the constructor name
    this.name = this.constructor.name as T;

    // Handle cause with native support when available, fallback otherwise
    if (cause !== undefined) {
      this.#setCause(cause);
    }

    // Preserve prototype chain for `instanceof` checks after transpilation.
    Object.setPrototypeOf(this, new.target.prototype);

    // Cross-runtime best-effort stack collection
    this.stack = this.#captureStack();
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
   * Throws an error if a message for the given language already exists.
   * @param lang The language code (e.g., 'de', 'es', 'fr-CA').
   * @param message The localized message.
   * @returns The error instance for chaining.
   * @throws Error if a message for the given language already exists.
   */
  public addLocalizedMessage(lang: string, message: string): this {
    if (this._localizedMessages.has(lang)) {
      throw new Error(
        `Localized message for language '${lang}' already exists. Use updateLocalizedMessage() to modify existing messages.`,
      );
    }
    this._localizedMessages.set(lang, message);
    return this;
  }

  /**
   * Updates or sets a user-friendly message for a specific language.
   * This method allows overwriting existing messages for the same language.
   * @param lang The language code (e.g., 'de', 'es', 'fr-CA').
   * @param message The localized message.
   * @returns The error instance for chaining.
   */
  public updateLocalizedMessage(lang: string, message: string): this {
    this._localizedMessages.set(lang, message);
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
    if (preferredLang && this._localizedMessages.has(preferredLang)) {
      return this._localizedMessages.get(preferredLang);
    }

    // 2. If not found, try the fallback language (e.g., 'en').
    if (fallbackLang && this._localizedMessages.has(fallbackLang)) {
      return this._localizedMessages.get(fallbackLang);
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
      cause: this.#serializeCause(cause),
    };

    // Add user messages to the JSON output for logging if they exist
    if (this._defaultUserMessage) {
      json.userMessage = this._defaultUserMessage;
    }
    if (this._localizedMessages.size > 0) {
      json.localizedMessages = Object.fromEntries(this._localizedMessages);
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
   * Sets the cause property using native support when available, with fallback.
   * This provides better compatibility across different JavaScript environments.
   */
  /*#__PURE__*/ #setCause(cause: unknown): void {
    // Try to use native cause support if available
    if (BaseError.#hasNativeCauseSupport()) {
      // For environments with native cause support, we need to reconstruct
      // the error with cause. Since we can't do this in the constructor due to
      // TypeScript limitations, we'll set it manually but make it look native.
      try {
        Object.defineProperty(this, "cause", {
          value: cause,
          configurable: true,
          writable: true,
          enumerable: false, // Keep it non-enumerable like native cause
        });
      } catch {
        // Fallback if defineProperty fails
        (this as unknown as Record<string, unknown>).cause = cause;
      }
    } else {
      // For older environments, set cause manually
      try {
        Object.defineProperty(this, "cause", {
          value: cause,
          configurable: true,
          writable: true,
          enumerable: false,
        });
      } catch {
        // Final fallback for very old environments
        (this as unknown as Record<string, unknown>).cause = cause;
      }
    }
  }

  /**
   * Intelligently serializes the cause for JSON output.
   * Preserves stack traces and nested data instead of just toString().
   */
  /*#__PURE__*/ #serializeCause(cause: unknown): unknown {
    if (cause === undefined || cause === null) {
      return cause;
    }

    if (cause instanceof Error) {
      // For Error objects, preserve stack and nested cause
      return {
        name: cause.name,
        message: cause.message,
        stack: cause.stack,
        // Recursively serialize nested causes
        cause: this.#serializeCause(
          (cause as unknown as Record<string, unknown>).cause,
        ),
      };
    }

    if (typeof cause === "object" && cause !== null) {
      try {
        // For plain objects, try to serialize them directly
        // This preserves structured data that might be useful for debugging
        return JSON.parse(JSON.stringify(cause));
      } catch {
        // If JSON.stringify fails (circular references, etc.), create a more useful representation
        return this.#serializeCircularObject(cause);
      }
    }

    // For primitives (string, number, boolean), return as-is
    return cause;
  }

  /**
   * Creates a more useful representation of circular objects for debugging.
   * Instead of just "[object Object]", it extracts key information.
   */
  /*#__PURE__*/ #serializeCircularObject(obj: object): string {
    const type = obj.constructor?.name || "Object";
    const keys = Object.keys(obj).slice(0, 5); // Show first 5 keys
    const keyInfo = keys.length > 0 ? ` with keys: [${keys.join(", ")}]` : "";
    const moreKeys = Object.keys(obj).length > 5 ? "..." : "";

    return `[Circular ${type}${keyInfo}${moreKeys}]`;
  }

  /**
   * Detects if the runtime supports native Error cause option.
   * Available in Node.js 16.9+ and modern browsers.
   */
  static /*#__PURE__*/ #hasNativeCauseSupport(): boolean {
    // Simple runtime detection without constructor testing
    // Check if we're in Node.js 16.9+ or modern browser environment
    if (typeof process !== "undefined" && process.versions?.node) {
      const [major, minor] = process.versions.node.split(".").map(Number);
      return major > 16 || (major === 16 && minor >= 9);
    }

    // For browser environments, assume modern browsers support it
    // This is a conservative approach that works with current TypeScript
    return typeof window !== "undefined" && "cause" in Error.prototype;
  }

  /**
   * Captures and filters the stack trace without affecting global state.
   * Filters out internal BaseError frames for cleaner stack traces.
   */
  /*#__PURE__*/ #captureStack(): string | undefined {
    // First, try to capture stack directly on this instance when possible
    if (typeof Error.captureStackTrace === "function") {
      // V8/Node.js: Capture stack directly on this instance, excluding constructor
      Error.captureStackTrace(this, this.constructor);
      return this.#filterInternalFrames(this.stack);
    }

    // For non-V8 engines, create a temporary error to get the stack
    let tempStack: string | undefined;
    try {
      throw new Error();
    } catch (e) {
      tempStack = (e as Error).stack;
    }

    if (!tempStack) {
      return undefined;
    }

    // Filter out internal frames and update the header
    return this.#filterInternalFrames(tempStack);
  }

  /**
   * Filters out internal BaseError frames and updates the error header.
   * This provides cleaner stack traces by removing implementation details.
   */
  /*#__PURE__*/ #filterInternalFrames(
    stack: string | undefined,
  ): string | undefined {
    if (!stack) {
      return undefined;
    }

    const lines = stack.split("\n");
    const filteredLines: string[] = [];

    // Update the header with proper error name and message
    filteredLines.push(`${this.name}: ${this.message}`);

    // Filter out internal frames
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      // Skip internal BaseError frames
      if (
        line.includes("#captureStack") ||
        line.includes("#filterInternalFrames") ||
        line.includes("BaseError.constructor") ||
        line.includes("new BaseError") ||
        line.includes("captureStack_fn") || // Compiled private method name
        line.includes("filterInternalFrames_fn") || // Compiled private method name
        // Skip the temporary error creation frame
        (line.includes("Object.<anonymous>") && line.includes("captureStack"))
      ) {
        continue;
      }

      filteredLines.push(line);
    }

    return filteredLines.join("\n");
  }
}
