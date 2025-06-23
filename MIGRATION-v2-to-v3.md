# Migration Guide: BaseError v2 → v3

This guide helps you migrate from BaseError v2.x to v3.x. Version 3 introduces significant improvements to stack trace handling, cause property management, and type safety while maintaining backward compatibility for most use cases.

## 📋 Quick Summary

**Most applications can upgrade to v3 without code changes.** The breaking changes primarily affect:
- Advanced error cause handling patterns
- Custom stack trace manipulation
- TypeScript type augmentations for Error constructor

## 🔄 What's New in v3

### ✨ Major Improvements

1. **Enhanced Stack Trace Filtering**: Internal BaseError frames are now automatically filtered out
2. **Improved Cause Handling**: Better serialization and cross-runtime compatibility
3. **Cleaner Type Organization**: Global type augmentations moved to dedicated files
4. **Better Error Resilience**: Graceful handling of edge cases and runtime failures

### 🏗️ Internal Architecture Changes

- Stack capture strategy no longer pollutes global `Error.stackTraceLimit`
- Enhanced cause serialization with circular reference handling
- Improved cross-runtime compatibility detection
- Cleaner separation of type declarations

## 🚀 Installation

```bash
# Upgrade to v3
npm install @shirudo/base-error@^3.0.0

# Or with yarn
yarn add @shirudo/base-error@^3.0.0

# Or with pnpm
pnpm add @shirudo/base-error@^3.0.0
```

## ✅ What Stays the Same

### Basic Usage (No Changes Required)

```typescript
// ✅ This code works identically in v2 and v3
import { BaseError } from "@shirudo/base-error";

class UserNotFoundError extends BaseError<"UserNotFoundError"> {
  constructor(userId: string) {
    super(`User ${userId} not found`);
    this.withUserMessage("User not found. Please try again.");
  }
}

// Usage remains the same
throw new UserNotFoundError("user-123");
```

### Error Cause Handling (Mostly Compatible)

```typescript
// ✅ This code works in both v2 and v3
class ServiceError extends BaseError<"ServiceError"> {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

try {
  throw new Error("Database connection failed");
} catch (dbError) {
  throw new ServiceError("Service unavailable", dbError);
}
```

### User Messages (No Changes)

```typescript
// ✅ All user message functionality unchanged
const error = new UserNotFoundError("user-123");
error.withUserMessage("Default message")
     .addLocalizedMessage("es", "Mensaje en español")
     .addLocalizedMessage("fr", "Message en français");

const message = error.getUserMessage({ 
  preferredLang: "es", 
  fallbackLang: "en" 
});
```

## ⚠️ Breaking Changes

### 1. Constructor Overloading (REMOVED)

**v2 (Legacy Constructor):**
```typescript
// ❌ This no longer works in v3
class MyError extends BaseError<"MyError"> {
  constructor(messageOrCause: string | unknown, cause?: unknown) {
    if (typeof messageOrCause === "string") {
      super(messageOrCause, cause);
    } else {
      super("Default message", messageOrCause);
    }
  }
}
```

**v3 (Simplified Constructor):**
```typescript
// ✅ Use this pattern instead
class MyError extends BaseError<"MyError"> {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
  
  // If you need a factory for different construction patterns
  static fromCause(cause: unknown): MyError {
    return new MyError("An error occurred", cause);
  }
  
  static withDefaultMessage(cause?: unknown): MyError {
    return new MyError("Default error message", cause);
  }
}

// Usage
throw MyError.fromCause(originalError);
throw MyError.withDefaultMessage();
```

### 2. Global Type Augmentations

**v2 (Global Pollution):**
```typescript
// ❌ If you were relying on global Error type extensions
declare global {
  interface ErrorConstructor {
    captureStackTrace?(error: Error, constructorOpt?: Function): void;
    stackTraceLimit: number | undefined;
  }
}
```

**v3 (Clean Type Organization):**
```typescript
// ✅ Types are now properly organized and imported automatically
// No action needed - BaseError handles this internally
import { BaseError } from "@shirudo/base-error";

// The types are available when you use BaseError
class MyError extends BaseError<"MyError"> {
  constructor(message: string) {
    super(message);
    // Error.captureStackTrace is properly typed if available
  }
}
```

### 3. Stack Trace Limit Behavior

**v2 (Global State Modification):**
```typescript
// ❌ v2 could permanently modify Error.stackTraceLimit
const originalLimit = Error.stackTraceLimit;
const error = new MyError("test");
// Error.stackTraceLimit might be different now
```

**v3 (No Global Side Effects):**
```typescript
// ✅ v3 preserves the original Error.stackTraceLimit
const originalLimit = Error.stackTraceLimit;
const error = new MyError("test");
// Error.stackTraceLimit is guaranteed to be unchanged
console.log(Error.stackTraceLimit === originalLimit); // true
```

### 4. Cause Serialization Format

**v2 (toString() Serialization):**
```typescript
const cause = new Error("Root cause");
const error = new MyError("Wrapper", cause);
const json = error.toJSON();
console.log(json.cause); // "Error: Root cause" (string)
```

**v3 (Rich Object Serialization):**
```typescript
const cause = new Error("Root cause");
const error = new MyError("Wrapper", cause);
const json = error.toJSON();
console.log(json.cause); 
// {
//   name: "Error",
//   message: "Root cause", 
//   stack: "Error: Root cause\n    at ...",
//   cause: undefined
// }
```

**Migration Strategy for Cause Serialization:**
If you were parsing the string representation of causes, update your code:

```typescript
// ❌ v2 pattern
function extractCauseMessage(errorJson: any): string | undefined {
  if (typeof errorJson.cause === 'string') {
    const match = errorJson.cause.match(/^(\w+): (.+)$/);
    return match ? match[2] : errorJson.cause;
  }
  return undefined;
}

// ✅ v3 pattern
function extractCauseMessage(errorJson: any): string | undefined {
  if (errorJson.cause && typeof errorJson.cause === 'object') {
    return errorJson.cause.message;
  }
  if (typeof errorJson.cause === 'string') {
    return errorJson.cause;
  }
  return undefined;
}
```

## 🔧 Migration Steps

### Step 1: Update Dependencies

```bash
npm install @shirudo/base-error@^3.0.0
```

### Step 2: Remove Legacy Constructor Patterns

Search your codebase for legacy constructor patterns and update them:

```bash
# Search for potential legacy patterns
grep -r "typeof.*messageOrCause" src/
grep -r "string | unknown" src/ | grep constructor
```

### Step 3: Update Cause Handling (If Needed)

If you have code that processes error JSON and expects string causes:

```typescript
// Update error processing functions
function processErrorCause(cause: unknown): string {
  // v3-compatible cause processing
  if (cause && typeof cause === 'object' && 'message' in cause) {
    return String(cause.message);
  }
  return String(cause);
}
```

### Step 4: Remove Global Type Declarations (If Any)

If you had custom global Error type augmentations, you can remove them:

```typescript
// ❌ Remove these if present
declare global {
  interface ErrorConstructor {
    captureStackTrace?(error: Error, constructorOpt?: Function): void;
    stackTraceLimit: number | undefined;
  }
}
```

### Step 5: Test Your Application

Run your test suite to ensure everything works:

```bash
npm test
```

Pay special attention to:
- Error construction patterns
- Error serialization/deserialization
- Stack trace processing
- Cause chain handling

## 🧪 Testing Your Migration

### Test Error Construction

```typescript
import { BaseError } from "@shirudo/base-error";

class TestError extends BaseError<"TestError"> {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

// Test basic construction
const error1 = new TestError("Test message");
console.assert(error1.name === "TestError");
console.assert(error1.message === "Test message");

// Test with cause
const cause = new Error("Original error");
const error2 = new TestError("Wrapper error", cause);
console.assert((error2 as any).cause === cause);

// Test JSON serialization
const json = error2.toJSON();
console.assert(typeof json.cause === 'object');
console.assert(json.cause.message === "Original error");
```

### Test Stack Traces

```typescript
function createError() {
  return new TestError("Stack test");
}

const error = createError();
console.log(error.stack);

// Verify internal frames are filtered out
if (error.stack) {
  console.assert(!error.stack.includes('#captureStack'));
  console.assert(!error.stack.includes('#filterInternalFrames'));
  console.assert(error.stack.includes('createError'));
}
```

## 🆘 Troubleshooting

### Issue: "Cannot resolve './types/global.js'"

This usually happens in bundler configurations. BaseError v3 uses proper type-only imports that should be handled automatically.

**Solution:** Ensure your bundler/TypeScript configuration is up to date:

```json
{
  "compilerOptions": {
    "moduleResolution": "Node16" // or "NodeNext"
  }
}
```

### Issue: Stack traces include internal methods

If you still see internal BaseError methods in stack traces:

**Check:** Ensure you're using the latest v3 version:
```bash
npm list @shirudo/base-error
```

**Verify:** The stack filtering is working:
```typescript
const error = new MyError("test");
console.log(error.stack?.includes('#captureStack')); // Should be false
```

### Issue: Cause serialization breaks existing code

If your code expects string cause serialization:

**Quick Fix:** Override `toJSON()` in your error classes:
```typescript
class MyError extends BaseError<"MyError"> {
  toJSON() {
    const json = super.toJSON();
    // Convert cause back to string for compatibility
    if (json.cause && typeof json.cause === 'object') {
      json.cause = String(json.cause.message || json.cause);
    }
    return json;
  }
}
```

## 📚 Additional Resources

- [BaseError v3 Documentation](README.md)
- [Examples Directory](examples/)
- [TypeScript Configuration Guide](https://www.typescriptlang.org/tsconfig)
- [GitHub Issues](https://github.com/shi-rudo/base-error-ts/issues)

## 💬 Getting Help

If you encounter issues during migration:

1. Check the [troubleshooting section](#-troubleshooting) above
2. Review the [examples directory](examples/) for updated patterns
3. Open an issue on [GitHub](https://github.com/shi-rudo/base-error-ts/issues)
4. Include your current code and the specific error you're encountering

---

**Happy migrating! 🚀**

The BaseError v3 improvements provide better debugging, enhanced cross-runtime compatibility, and cleaner architecture while maintaining the same great developer experience you're used to. 