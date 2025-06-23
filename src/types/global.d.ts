/**
 * Global type augmentations for BaseError functionality.
 * This file extends built-in interfaces to support cross-runtime error handling.
 */

declare global {
  /**
   * Extends the ErrorConstructor interface to include V8-specific stack trace utilities.
   * These are available in Node.js and V8-based runtimes (Cloudflare Workers, Deno, etc.).
   */
  interface ErrorConstructor {
    /**
     * V8-specific method to capture stack traces.
     * Available in Node.js and V8-based environments.
     * @param targetObject - The object to attach the stack trace to
     * @param constructorOpt - Constructor function to omit from the stack trace
     */
    captureStackTrace?(
      targetObject: object,
      constructorOpt?: (...args: unknown[]) => unknown,
    ): void;

    /**
     * V8-specific property to control stack trace depth.
     * We avoid redeclaring this if it's already defined to prevent conflicts.
     */
    stackTraceLimit?: number;
  }
}

// This export makes the file a module, ensuring proper type merging
export {};
