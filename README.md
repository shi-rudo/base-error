# @shirudo/base-error

A robust, cross-environment base error class for TypeScript applications that works seamlessly across Node.js, modern browsers, and edge runtimes (like Cloudflare Workers, Deno Deploy, and Vercel Edge Functions).

## Features

- 🌐 **Cross-platform compatibility**: Works in Node.js, browsers, and edge runtimes
- 🔍 **Rich stack traces**: Captures the best possible stack trace for the current environment
- 🔄 **Error cause chain**: Preserves the error cause chain, even in environments without native support
- ⏱️ **Built-in timestamps**: Includes both numeric (epoch) and ISO string timestamps
- 🧬 **Proper inheritance**: Maintains prototype chain for reliable `instanceof` checks
- 📊 **JSON serialization**: Built-in `toJSON` method for easy logging

## Installation

```bash
npm install @shirudo/base-error
```

## Usage

### Basic Usage

```typescript
import { BaseError } from "@shirudo/base-error";

// Create a custom error class
class UserNotFoundError extends BaseError<"UserNotFoundError"> {
  constructor(userId: string) {
    super("UserNotFoundError", `User ${userId} not found`);
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

### JSON Serialization

```typescript
import { BaseError } from "@shirudo/base-error";

class ApiError extends BaseError<"ApiError"> {
  constructor(statusCode: number, message: string, cause?: unknown) {
    super("ApiError", message, cause);
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

### Type Narrowing with instanceof

```typescript
import { BaseError } from "@shirudo/base-error";

class NotFoundError extends BaseError<"NotFoundError"> {
  constructor(resourceId: string) {
    super("NotFoundError", `Resource ${resourceId} not found`);
  }
}

class ValidationError extends BaseError<"ValidationError"> {
  constructor(field: string, message: string) {
    super("ValidationError", `${field}: ${message}`);
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
