# @shirudo/base-error

A robust, cross-environment base error class for TypeScript applications that works seamlessly across Node.js, modern browsers, and edge runtimes (like Cloudflare Workers, Deno Deploy, and Vercel Edge Functions).

## Features

- 🌐 **Cross-platform compatibility**: Works in Node.js, browsers, and edge runtimes
- 🔍 **Rich stack traces**: Captures the best possible stack trace for the current environment
- 🔄 **Error cause chain**: Preserves the error cause chain, even in environments without native support
- ⏱️ **Built-in timestamps**: Includes both numeric (epoch) and ISO string timestamps
- 🧬 **Proper inheritance**: Maintains prototype chain for reliable `instanceof` checks
- 📊 **JSON serialization**: Built-in `toJSON` method for easy logging
- ✨ **Automatic name inference**: No need to specify the error name twice (v2.0+)

## Installation

```bash
npm install @shirudo/base-error
```

## Usage

### Basic Usage

```typescript
import { BaseError } from "@shirudo/base-error";

// Create a custom error class using automatic name inference (recommended)
class UserNotFoundError extends BaseError<"UserNotFoundError"> {
  constructor(userId: string) {
    super(`User ${userId} not found`);
  }
}

// Legacy approach with explicit name (still supported)
class UserNotFoundErrorLegacy extends BaseError<"UserNotFoundErrorLegacy"> {
  constructor(userId: string) {
    super("UserNotFoundErrorLegacy", `User ${userId} not found`);
  }
}

// Throw the error
throw new UserNotFoundError("user-123");
```

### With Error Cause

```typescript
import { BaseError } from "@shirudo/base-error";

class DatabaseError extends BaseError<"DatabaseError"> {
  constructor(message: string, cause?: unknown) {
    super("DatabaseError", message, cause);
  }
}

class UserServiceError extends BaseError<"UserServiceError"> {
  constructor(message: string, cause?: unknown) {
    super("UserServiceError", message, cause);
  }
}

try {
  // Some database operation that fails
  throw new Error("Connection refused");
} catch (dbError) {
  // Wrap the low-level error with more context
  throw new UserServiceError("Failed to fetch user data", dbError);
}
```

### Automatic Name Inference (v2.0+)

Starting from version 2.0, you can omit the error name parameter and BaseError will automatically use the class name:

```typescript
import { BaseError } from "@shirudo/base-error";

// New simplified syntax (recommended)
class UserNotFoundError extends BaseError<"UserNotFoundError"> {
  constructor(userId: string) {
    super(`User ${userId} not found`); // Name is automatically inferred
  }
}

class ValidationError extends BaseError<"ValidationError"> {
  constructor(field: string, message: string, cause?: unknown) {
    super(`Validation failed for ${field}: ${message}`, cause);
  }
}

// Legacy syntax still works for backward compatibility
class LegacyError extends BaseError<"LegacyError"> {
  constructor(message: string) {
    super("LegacyError", message); // Explicit name
  }
}
```

### JSON Serialization

```typescript
import { BaseError } from "@shirudo/base-error";

class ApiError extends BaseError<"ApiError"> {
  constructor(statusCode: number, message: string, cause?: unknown) {
    super(message, cause); // Using automatic name inference
    this.statusCode = statusCode;
  }

  statusCode: number;

  // Override toJSON to include custom properties
  toJSON() {
    const json = super.toJSON();
    return {
      ...json,
      statusCode: this.statusCode,
    };
  }
}

const error = new ApiError(404, "Resource not found");
console.log(JSON.stringify(error, null, 2));
```

### Error Codes with Union Types

For applications that need consistent error codes, you can use union types with BaseError:

```typescript
import { BaseError } from "@shirudo/base-error";

// Define your error codes as a union type
type ErrorCode =
  | "USER_NOT_FOUND"
  | "USER_NOT_AUTHORIZED"
  | "USER_NOT_AUTHENTICATED"
  | "USER_QUOTA_LIMIT_REACHED";

// Base class for all user-related errors
class UserError<T extends ErrorCode> extends BaseError<T> {
  constructor(
    public readonly code: T,
    message: string,
    public readonly userId?: string,
    cause?: unknown,
  ) {
    super(message, cause); // Using automatic name inference
    this.code = code;
  }

  // Override toJSON to include the error code
  toJSON() {
    return {
      ...super.toJSON(),
      code: this.code,
      userId: this.userId,
    };
  }
}

// Specific error classes
class UserNotFoundError extends UserError<"USER_NOT_FOUND"> {
  constructor(userId: string) {
    super("USER_NOT_FOUND", `User with ID ${userId} was not found`, userId);
  }
}

class UserNotAuthorizedError extends UserError<"USER_NOT_AUTHORIZED"> {
  constructor(userId: string, resource: string) {
    super(
      "USER_NOT_AUTHORIZED",
      `User ${userId} is not authorized to access ${resource}`,
      userId,
    );
  }
}

// Type-safe error handling
function handleUserError(error: unknown): void {
  if (error instanceof UserError) {
    // TypeScript knows the error code is from the ErrorCode union
    switch (error.code) {
      case "USER_NOT_FOUND":
        console.log("→ Redirecting to user registration page");
        break;
      case "USER_NOT_AUTHORIZED":
        console.log("→ Redirecting to access denied page");
        break;
      case "USER_NOT_AUTHENTICATED":
        console.log("→ Redirecting to login page");
        break;
      case "USER_QUOTA_LIMIT_REACHED":
        console.log("→ Showing upgrade options");
        break;
    }
  }
}
```

### Type Narrowing with instanceof

```typescript
import { BaseError } from "@shirudo/base-error";

class NotFoundError extends BaseError<"NotFoundError"> {
  constructor(resourceId: string) {
    super(`Resource ${resourceId} not found`); // Using automatic name inference
  }
}

class ValidationError extends BaseError<"ValidationError"> {
  constructor(field: string, message: string) {
    super(`${field}: ${message}`); // Using automatic name inference
    this.field = field;
  }

  field: string;
}

function handleError(error: unknown) {
  // Type narrowing with instanceof
  if (error instanceof NotFoundError) {
    // TypeScript knows this is a NotFoundError
    // error.name has IntelliSense and is typed as "NotFoundError"
    console.log(`Got a ${error.name} with message: ${error.message}`);
    // Handle 404 case
  } else if (error instanceof ValidationError) {
    // TypeScript knows this is a ValidationError
    // error.name is typed as "ValidationError" and field is available
    console.log(`Validation failed for field: ${error.field}`);
    console.log(`Error type: ${error.name}, message: ${error.message}`);
    // Handle validation error
  } else if (error instanceof BaseError) {
    // TypeScript knows this is some kind of BaseError
    // error.name is typed based on the generic parameter
    console.log(`Unknown error type: ${error.name}`);
    console.log(`Occurred at: ${error.timestampIso}`);
  } else {
    console.log("Unknown error:", error);
  }
}
```

## API

### `BaseError<T extends string>`

```typescript
class BaseError<T extends string> extends Error {
  // Automatic name inference (recommended)
  constructor(message: string, cause?: unknown);
  // Explicit name (legacy)
  constructor(name: T, message: string, cause?: unknown);

  // Properties
  readonly name: T; // Error type name
  readonly timestamp: number; // Epoch-ms timestamp
  readonly timestampIso: string; // ISO-8601 timestamp
  readonly stack?: string; // Stack trace
  readonly cause?: unknown; // Error cause (if provided)

  // Methods
  toJSON(): Record<string, unknown>; // Serialize to JSON
}
```

## TypeScript Support

This package is written in TypeScript and includes type definitions. The generic type parameter `T` allows you to specify the exact name of your error class for improved type safety.

## License

MIT
