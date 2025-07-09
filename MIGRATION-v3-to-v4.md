# Migration Guide: BaseError v3 → v4

This guide helps you migrate from BaseError v3.x to v4.x. The primary goal of version 4 is to improve ecosystem compatibility and safety by removing global type pollution.

## 📋 Quick Summary / TL;DR

**For most users, no code changes are required.** The breaking change only affects projects that relied on the *global types* this library previously provided for non-standard `Error` properties.

-   **The Change**: `BaseError` no longer modifies TypeScript's global `ErrorConstructor` type.
-   **Who is Affected?**: You are only affected if your own code, outside of `BaseError` subclasses, directly uses `Error.captureStackTrace` and relied on this library to make it type-safe.
-   **Who is NOT Affected?**: If you only use this library to create custom error classes by extending `BaseError`, your code will work without any changes.

## ✨ The Key Change: No More Global Scope Pollution

Version 4 embraces modern JavaScript ecosystem standards, particularly those enforced by newer registries like **JSR**. The key principle is that a package should **never modify the global scope**, including at the type level.

In v3, `BaseError` augmented the global `ErrorConstructor` type to add definitions for V8-specific properties like `captureStackTrace`. While convenient, this is a form of global side effect that can cause conflicts in large projects.

**Version 4 removes this global type augmentation.** This leads to:
-   ✅ **Better Isolation**: Your project's global types are no longer affected by this library.
-   ✅ **Improved Compatibility**: Prevents type conflicts with other libraries and tools.
-   ✅ **JSR-Ready**: The library is now fully compliant with strict, modern package standards.

## ⚠️ Breaking Change: Removal of Global Type Augmentations

The only breaking change is the removal of the global types for `Error.captureStackTrace`.

### The Impact

In v3, the following code would type-check successfully anywhere in your project, because `BaseError` made the types globally available:

```typescript
// This code worked in a project using BaseError v3
// even if BaseError was not imported in this file.

function getCustomStack() {
  const target = {};
  // This line will now cause a TypeScript error in v4
  Error.captureStackTrace?.(target, getCustomStack);
  return (target as { stack?: string }).stack;
}
```

In v4, the code above will produce a TypeScript error:
```
Property 'captureStackTrace' does not exist on type 'ErrorConstructor'.
```

### Migration Strategy

If your code is affected, you must now provide the type definition locally where it is needed, without modifying the global scope. The recommended approach is to use a local interface and a type assertion.

**Before (Code that worked with v3, but fails with v4):**
```typescript
// src/utils/tracer.ts

function traceSomething() {
  const myCustomObject = {};
  // Fails in v4: 'captureStackTrace' does not exist on 'ErrorConstructor'
  Error.captureStackTrace?.(myCustomObject, traceSomething);
  return myCustomObject;
}
```

**After (v4-compatible fix):**
```typescript
// src/utils/tracer.ts

// 1. Define a local interface with the V8-specific properties
interface V8ErrorConstructor extends ErrorConstructor {
  captureStackTrace?(targetObject: object, constructorOpt?: Function): void;
}

// 2. Use a type assertion to safely access the property
const V8Error = Error as V8ErrorConstructor;

function traceSomething() {
  const myCustomObject = {};
  // This now works and is type-safe
  V8Error.captureStackTrace?.(myCustomObject, traceSomething);
  return myCustomObject;
}
```
This pattern ensures type safety while keeping your project's global scope clean.

## ✅ Who is NOT Affected?

If your usage is limited to creating custom error classes, you do not need to make any changes. The internal logic of `BaseError` has already been updated to use the new, safer pattern.

This code continues to work perfectly in v4 with no modifications:
```typescript
// This code is 100% compatible with v4. No changes needed.
import { BaseError } from "@shirudo/base-error";

class UserNotFoundError extends BaseError<"UserNotFoundError"> {
  constructor(userId: string) {
    super(`User ${userId} not found`);
  }
}

try {
  throw new UserNotFoundError("user-123");
} catch (error) {
  console.log(error.toString());
  // The stack trace will still be correctly captured and filtered.
}
```

## 🔧 How to Upgrade

1.  **Update your dependency:**
    ```bash
    # npm
    npm install @shirudo/base-error@^4.0.0

    # yarn
    yarn add @shirudo/base-error@^4.0.0

    # pnpm
    pnpm add @shirudo/base-error@^4.0.0
    ```

2.  **Run your type-checker:**
    ```bash
    tsc --noEmit
    ```

3.  **Fix errors:** If the type-checker reports errors related to `Error.captureStackTrace`, apply the migration strategy described above. For most projects, no errors will be found.

## 💬 Getting Help

If you encounter issues during migration that are not covered by this guide, please open an issue on [GitHub](https://github.com/shi-rudo/base-error-ts/issues).

