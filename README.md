# @shirudo/base-error

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![npm](https://img.shields.io/npm/v/@shirudo/base-error?color=blue)](https://www.npmjs.com/package/@shirudo/base-error)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@shirudo/base-error)](https://bundlephobia.com/package/@shirudo/base-error)
[![Tests](https://github.com/shi-rudo/base-error-ts/actions/workflows/tests.yml/badge.svg)](https://github.com/shi-rudo/base-error-ts/actions/workflows/tests.yml)

A robust, cross-environment base error class for TypeScript applications that works seamlessly across Node.js, modern browsers, and edge runtimes (like Cloudflare Workers, Deno Deploy, and Vercel Edge Functions).

It provides rich, filterable stack traces and advanced features **without polluting the global scope or causing type conflicts.**

## Features

- 🌐 **Cross-platform compatibility**: Works in Node.js, browsers, and edge runtimes
- 🚫 **No global scope pollution (v4+)**: Type-safe and isolated, won't conflict with other libraries
- 🔍 **Rich stack traces**: Captures the best possible stack trace for the current environment
- 🔄 **Error cause chain**: Preserves the error cause chain, even in environments without native support
- ⏱️ **Built-in timestamps**: Includes both numeric (epoch) and ISO string timestamps
- 🧬 **Proper inheritance**: Maintains prototype chain for reliable `instanceof` checks
- 📊 **JSON serialization**: Built-in `toJSON` method for easy logging
- ✨ **Automatic name inference**: No need to specify the error name twice
- 👤 **User-friendly messages**: Built-in support for user-friendly error messages and internationalization

## Installation

```bash
npm install @shirudo/base-error
```


## Usage

### Basic Usage

```typescript
import { BaseError } from "@shirudo/base-error";

// Create a custom error class using automatic name inference
class UserNotFoundError extends BaseError<"UserNotFoundError"> {
  constructor(userId: string) {
    super(`User ${userId} not found`);
    // Optional: Add user-friendly message for end users
    this.withUserMessage("The requested user could not be found.");
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
    super(message, cause);
  }
}

class UserServiceError extends BaseError<"UserServiceError"> {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
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

### Automatic Name Inference

BaseError automatically infers the error name from the class name, eliminating the need to specify it twice:

```typescript
import { BaseError } from "@shirudo/base-error";

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

### User-Friendly Messages (v2.1+)

BaseError supports user-friendly messages that can be localized for different languages, making it perfect for applications that need to show end-user error messages:

```typescript
import { BaseError } from "@shirudo/base-error";

class UserNotFoundError extends BaseError<"UserNotFoundError"> {
  constructor(userId: string) {
    super(`User with id ${userId} not found in database lookup`); // Technical message
    
    // Set user-friendly message
    this.withUserMessage(`User ${userId} was not found.`);
    
    // Add localized messages
    this.addLocalizedMessage("en", "User not found. Please check the user ID and try again.")
        .addLocalizedMessage("es", "Usuario no encontrado. Verifique el ID de usuario e inténtelo de nuevo.")
        .addLocalizedMessage("fr", "Utilisateur introuvable. Veuillez vérifier l'ID utilisateur et réessayer.")
        .addLocalizedMessage("de", "Benutzer nicht gefunden. Bitte überprüfen Sie die Benutzer-ID und versuchen Sie es erneut.");
  }
}

// Usage in error handling
try {
  throw new UserNotFoundError("user-123");
} catch (error) {
  if (error instanceof UserNotFoundError) {
    // Get localized message based on user preference
    const userMessage = error.getUserMessage({ 
      preferredLang: "es", 
      fallbackLang: "en" 
    });
    console.log("User message:", userMessage); // "Usuario no encontrado..."
    
    // Technical message for logging
    console.log("Technical message:", error.message); // "User with id user-123 not found..."
  }
}
```

#### User Message API

The user message functionality provides four methods:

1. **`withUserMessage(message: string)`** - Sets the default user-friendly message
2. **`addLocalizedMessage(lang: string, message: string)`** - Adds a localized message for a specific language (prevents duplicates)
3. **`updateLocalizedMessage(lang: string, message: string)`** - Updates or sets a localized message (allows overwriting)
4. **`getUserMessage(options?)`** - Retrieves the appropriate message based on language preferences

```typescript
import { BaseError } from "@shirudo/base-error";

class ValidationError extends BaseError<"ValidationError"> {
  constructor(field: string, technicalReason: string) {
    super(`Validation failed for field '${field}': ${technicalReason}`);
    
    // Chain method calls for fluent API
    this.withUserMessage("Please check your input and try again.")
        .addLocalizedMessage("en", "Please check your input and try again.")
        .addLocalizedMessage("es", "Por favor, revise su entrada e inténtelo de nuevo.")
        .addLocalizedMessage("fr", "Veuillez vérifier votre saisie et réessayer.")
        .addLocalizedMessage("de", "Bitte überprüfen Sie Ihre Eingabe und versuchen Sie es erneut.");
  }
}

const error = new ValidationError("email", "invalid format");

// Get message with different language preferences
error.getUserMessage(); // Default message
error.getUserMessage({ preferredLang: "es" }); // Spanish message
error.getUserMessage({ preferredLang: "it", fallbackLang: "en" }); // English (fallback)
error.getUserMessage({ preferredLang: "pt", fallbackLang: "it" }); // Default message (no match)

// Duplicate prevention
try {
  error.addLocalizedMessage("en", "Another English message"); // Throws error
} catch (e) {
  console.log(e.message); // "Localized message for language 'en' already exists..."
}

// Use updateLocalizedMessage to intentionally overwrite
error.updateLocalizedMessage("en", "Updated English message"); // Works fine
```

#### JSON Serialization with User Messages

User messages are automatically included in JSON serialization:

```typescript
const error = new ValidationError("email", "invalid format");

console.log(JSON.stringify(error, null, 2));
// Output:
// {
//   "name": "ValidationError",
//   "message": "Validation failed for field 'email': invalid format",
//   "timestamp": 1704067200000,
//   "timestampIso": "2025-01-01T00:00:00.000Z",
//   "stack": "...",
//   "userMessage": "Please check your input and try again.",
//   "localizedMessages": {
//     "en": "Please check your input and try again.",
//     "es": "Por favor, revise su entrada e inténtelo de nuevo.",
//     "fr": "Veuillez vérifier votre saisie et réessayer.",
//     "de": "Bitte überprüfen Sie Ihre Eingabe und versuchen Sie es erneut."
//   }
// }
```

#### Language Fallback Strategy

The `getUserMessage()` method uses a three-tier fallback strategy:

1. **Preferred language** - If specified and available
2. **Fallback language** - If preferred is not available but fallback is
3. **Default message** - If neither preferred nor fallback languages are available
4. **`undefined`** - If no user messages have been set

```typescript
const error = new ValidationError("email", "invalid format");

// Only set some languages
error.withUserMessage("Default message")
     .addLocalizedMessage("en", "English message")
     .addLocalizedMessage("fr", "French message");

// Fallback examples
error.getUserMessage({ preferredLang: "fr" }); // → "French message"
error.getUserMessage({ preferredLang: "es", fallbackLang: "en" }); // → "English message" 
error.getUserMessage({ preferredLang: "es", fallbackLang: "de" }); // → "Default message"
error.getUserMessage({ preferredLang: "es" }); // → "Default message"
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
    super(message, cause);
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

## Utilities

### `guard` function

The package includes a `guard` utility function for runtime assertions with TypeScript type narrowing:

```typescript
import { BaseError, guard } from "@shirudo/base-error";

class UserNotFoundError extends BaseError<"UserNotFoundError"> {
  constructor(userId: string) {
    super(`User ${userId} not found`);
  }
}

class ValidationError extends BaseError<"ValidationError"> {
  constructor(message: string) {
    super(message);
  }
}

// Basic usage
function processUser(user: User | null) {
  // Assert that user exists, throw custom error if not
  guard(user, new UserNotFoundError("current-user"));

  // TypeScript now knows user is not null
  console.log(user.name); // No TypeScript error
}

// Validation example
function validateEmail(email: string) {
  const isValid = email.includes("@") && email.includes(".");
  guard(isValid, new ValidationError("Invalid email format"));

  // Continue with valid email
  return email.toLowerCase();
}

// Works with any truthy/falsy values
function processArray(items: unknown[]) {
  guard(items.length > 0, new ValidationError("Array cannot be empty"));

  // Process non-empty array
  return items.map((item) => String(item));
}
```

The `guard` function:

- Throws the provided `BaseError` instance when the condition is falsy
- Provides TypeScript type narrowing through assertion signatures
- Works with any truthy/falsy values, not just booleans
- Maintains the full error context and stack trace

## API

### `BaseError<T extends string>`

```typescript
class BaseError<T extends string> extends Error {
  // Constructor with automatic name inference
  constructor(message: string, cause?: unknown);

  // Properties
  readonly name: T; // Error type name (automatically inferred)
  readonly timestamp: number; // Epoch-ms timestamp
  readonly timestampIso: string; // ISO-8601 timestamp
  readonly stack?: string; // Stack trace
  readonly cause?: unknown; // Error cause (if provided)

  // Methods
  toJSON(): Record<string, unknown>; // Serialize to JSON
  
  // User Message Methods (v2.1+)
  withUserMessage(message: string): this; // Set default user-friendly message
  addLocalizedMessage(lang: string, message: string): this; // Add localized message (prevents duplicates)
  updateLocalizedMessage(lang: string, message: string): this; // Update/set localized message (allows overwriting)
  getUserMessage(options?: { 
    preferredLang?: string; 
    fallbackLang?: string; 
  }): string | undefined; // Get appropriate user message
}
```

## TypeScript Support

This package is written in TypeScript and includes type definitions. The generic type parameter `T` allows you to specify the exact name of your error class for improved type safety.

## License

MIT
