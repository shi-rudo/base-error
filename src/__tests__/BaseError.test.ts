import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BaseError } from "../BaseError.js";

// Ensure consistent behavior in tests
beforeEach(() => {
  // Reset any mocks
  vi.restoreAllMocks();

  // Ensure stack traces are consistent in tests
  vi.spyOn(Error, "captureStackTrace");
});

// Test error class that extends BaseError (legacy explicit name approach)
class TestError extends BaseError<"TestError"> {
  constructor(message: string, cause?: unknown) {
    super("TestError", message, cause);
  }

  toJSON() {
    // Call parent toJSON to include user messages, then add custom logic
    const baseJson = super.toJSON();
    return {
      ...baseJson,
      // Override cause formatting for test consistency
      cause: (() => {
        const causeValue = (this as unknown as Record<string, unknown>).cause;
        return causeValue instanceof Error ? causeValue.toString() : causeValue;
      })(),
    };
  }
}

// Test error class using automatic name inference
class AutoNamedError extends BaseError<"AutoNamedError"> {
  constructor(message: string, cause?: unknown) {
    super(message, cause); // Automatic name inference
  }
}

// Another test error class for automatic name inference
class ValidationError extends BaseError<"ValidationError"> {
  constructor(field: string, message: string) {
    super(`${field}: ${message}`); // Automatic name inference without cause
  }
}

describe("BaseError", () => {
  // Mock Date for consistent timestamps in tests
  const mockDate = new Date("2025-01-01T00:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should create an error with the correct name and message", () => {
    const error = new TestError("Something went wrong");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(BaseError);
    expect(error.name).toBe("TestError");
    expect(error.message).toBe("Something went wrong");
  });

  it("should include timestamps", () => {
    const error = new TestError("Test");

    expect(error.timestamp).toBe(mockDate.getTime());
    expect(error.timestampIso).toBe(mockDate.toISOString());
  });

  it("should include a stack trace", () => {
    const error = new TestError("Test");

    // Just verify that a stack trace exists and is a string
    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe("string");
  });

  it("should handle error causes", () => {
    const cause = new Error("Root cause");
    const error = new TestError("Wrapper error", cause);

    // Access the cause property which is not in the standard Error type
    expect((error as unknown as Record<string, unknown>).cause).toBe(cause);
    expect(error.toString()).toContain("Caused by: Error: Root cause");
  });

  it("should serialize to JSON correctly", () => {
    const cause = new Error("Root cause");
    const error = new TestError("Test error", cause);

    const json = error.toJSON();

    // Check the basic structure of the JSON output
    expect(json).toMatchObject({
      name: "TestError",
      message: "Test error",
      timestamp: mockDate.getTime(),
      timestampIso: mockDate.toISOString(),
      cause: "Error: Root cause",
    });

    // Verify stack is a string if it exists
    if ("stack" in json) {
      expect(typeof json.stack).toBe("string");
    }
  });

  it("should handle undefined cause", () => {
    const error = new TestError("Test");

    // Access the cause property which is not in the standard Error type
    expect((error as unknown as Record<string, unknown>).cause).toBeUndefined();
    expect(error.toString()).not.toContain("Caused by");
  });

  it("should maintain prototype chain", () => {
    const error = new TestError("Test");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(BaseError);
    expect(error).toBeInstanceOf(TestError);
  });

  describe("Automatic Name Inference (v2.0+)", () => {
    it("should automatically infer error name from class name", () => {
      const error = new AutoNamedError("Something went wrong");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(AutoNamedError);
      expect(error.name).toBe("AutoNamedError");
      expect(error.message).toBe("Something went wrong");
    });

    it("should automatically infer error name with cause", () => {
      const cause = new Error("Root cause");
      const error = new AutoNamedError("Wrapper error", cause);

      expect(error.name).toBe("AutoNamedError");
      expect(error.message).toBe("Wrapper error");
      expect((error as unknown as Record<string, unknown>).cause).toBe(cause);
      expect(error.toString()).toContain("Caused by: Error: Root cause");
    });

    it("should work with different error class names", () => {
      const error = new ValidationError("email", "must be a valid email");

      expect(error.name).toBe("ValidationError");
      expect(error.message).toBe("email: must be a valid email");
      expect(error).toBeInstanceOf(ValidationError);
    });

    it("should include timestamps with automatic name inference", () => {
      const error = new AutoNamedError("Test");

      expect(error.timestamp).toBe(mockDate.getTime());
      expect(error.timestampIso).toBe(mockDate.toISOString());
    });

    it("should include stack trace with automatic name inference", () => {
      const error = new AutoNamedError("Test");

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe("string");
      // Just verify that a stack trace exists (content varies by environment)
      expect(error.stack!.length).toBeGreaterThan(0);
    });

    it("should serialize to JSON correctly with automatic name", () => {
      const cause = new Error("Root cause");
      const error = new AutoNamedError("Test error", cause);

      const json = error.toJSON();

      expect(json).toMatchObject({
        name: "AutoNamedError",
        message: "Test error",
        timestamp: mockDate.getTime(),
        timestampIso: mockDate.toISOString(),
        cause: "Error: Root cause", // BaseError.toJSON() converts Error causes to strings
      });

      if ("stack" in json) {
        expect(typeof json.stack).toBe("string");
      }
    });

    it("should handle undefined cause with automatic name inference", () => {
      const error = new AutoNamedError("Test");

      expect(
        (error as unknown as Record<string, unknown>).cause,
      ).toBeUndefined();
      expect(error.toString()).not.toContain("Caused by");
      expect(error.toString()).toBe("[AutoNamedError] Test");
    });
  });

  describe("User Message Functionality", () => {
    it("should set and retrieve default user message", () => {
      const error = new TestError("Technical error message");

      error.withUserMessage("Something went wrong. Please try again.");

      expect(error.getUserMessage()).toBe(
        "Something went wrong. Please try again.",
      );
    });

    it("should return undefined when no user message is set", () => {
      const error = new TestError("Technical error message");

      expect(error.getUserMessage()).toBeUndefined();
    });

    it("should allow method chaining with withUserMessage", () => {
      const error = new TestError("Technical error message");

      const result = error.withUserMessage("User friendly message");

      expect(result).toBe(error); // Should return the same instance for chaining
      expect(error.getUserMessage()).toBe("User friendly message");
    });

    it("should add and retrieve localized messages", () => {
      const error = new TestError("Technical error message");

      error.addLocalizedMessage("en", "Something went wrong.");
      error.addLocalizedMessage("es", "Algo salió mal.");
      error.addLocalizedMessage("de", "Etwas ist schief gelaufen.");

      expect(error.getUserMessage({ preferredLang: "en" })).toBe(
        "Something went wrong.",
      );
      expect(error.getUserMessage({ preferredLang: "es" })).toBe(
        "Algo salió mal.",
      );
      expect(error.getUserMessage({ preferredLang: "de" })).toBe(
        "Etwas ist schief gelaufen.",
      );
    });

    it("should allow method chaining with addLocalizedMessage", () => {
      const error = new TestError("Technical error message");

      const result = error
        .addLocalizedMessage("en", "English message")
        .addLocalizedMessage("es", "Spanish message");

      expect(result).toBe(error); // Should return the same instance for chaining
      expect(error.getUserMessage({ preferredLang: "en" })).toBe(
        "English message",
      );
      expect(error.getUserMessage({ preferredLang: "es" })).toBe(
        "Spanish message",
      );
    });

    it("should fall back to fallback language when preferred language is not available", () => {
      const error = new TestError("Technical error message");

      error.addLocalizedMessage("en", "English message");
      error.addLocalizedMessage("es", "Spanish message");

      // Request French (not available), fallback to English
      expect(
        error.getUserMessage({
          preferredLang: "fr",
          fallbackLang: "en",
        }),
      ).toBe("English message");
    });

    it("should fall back to default user message when neither preferred nor fallback language is available", () => {
      const error = new TestError("Technical error message");

      error.withUserMessage("Default user message");
      error.addLocalizedMessage("es", "Spanish message");

      // Request French (not available), fallback to German (not available), use default
      expect(
        error.getUserMessage({
          preferredLang: "fr",
          fallbackLang: "de",
        }),
      ).toBe("Default user message");
    });

    it("should return undefined when no messages are available", () => {
      const error = new TestError("Technical error message");

      expect(
        error.getUserMessage({
          preferredLang: "fr",
          fallbackLang: "de",
        }),
      ).toBeUndefined();
    });

    it("should work with automatic name inference", () => {
      const error = new AutoNamedError("Technical error message");

      error
        .withUserMessage("User friendly message")
        .addLocalizedMessage("es", "Mensaje en español");

      expect(error.getUserMessage()).toBe("User friendly message");
      expect(error.getUserMessage({ preferredLang: "es" })).toBe(
        "Mensaje en español",
      );
    });

    it("should include user messages in JSON serialization", () => {
      const error = new TestError("Technical error message");

      error
        .withUserMessage("Default user message")
        .addLocalizedMessage("en", "English message")
        .addLocalizedMessage("es", "Spanish message");

      const json = error.toJSON();

      expect(json).toHaveProperty("userMessage", "Default user message");
      expect(json).toHaveProperty("localizedMessages", {
        en: "English message",
        es: "Spanish message",
      });
    });

    it("should not include user messages in JSON when none are set", () => {
      const error = new TestError("Technical error message");

      const json = error.toJSON();

      expect(json).not.toHaveProperty("userMessage");
      expect(json).not.toHaveProperty("localizedMessages");
    });

    it("should handle empty localized messages object in JSON", () => {
      const error = new TestError("Technical error message");

      error.withUserMessage("Default message only");

      const json = error.toJSON();

      expect(json).toHaveProperty("userMessage", "Default message only");
      expect(json).not.toHaveProperty("localizedMessages"); // Empty object should not be included
    });

    it("should support complex language codes", () => {
      const error = new TestError("Technical error message");

      error
        .addLocalizedMessage("en-US", "American English message")
        .addLocalizedMessage("en-GB", "British English message")
        .addLocalizedMessage("fr-CA", "Canadian French message");

      expect(error.getUserMessage({ preferredLang: "en-US" })).toBe(
        "American English message",
      );
      expect(error.getUserMessage({ preferredLang: "en-GB" })).toBe(
        "British English message",
      );
      expect(error.getUserMessage({ preferredLang: "fr-CA" })).toBe(
        "Canadian French message",
      );
    });

    it("should preserve message priority order: preferred -> fallback -> default", () => {
      const error = new TestError("Technical error message");

      error
        .withUserMessage("Default message")
        .addLocalizedMessage("en", "English message")
        .addLocalizedMessage("es", "Spanish message")
        .addLocalizedMessage("fr", "French message");

      // Test all combinations
      expect(error.getUserMessage({ preferredLang: "fr" })).toBe(
        "French message",
      );
      expect(
        error.getUserMessage({ preferredLang: "de", fallbackLang: "en" }),
      ).toBe("English message");
      expect(
        error.getUserMessage({ preferredLang: "de", fallbackLang: "it" }),
      ).toBe("Default message");
      expect(error.getUserMessage()).toBe("Default message");
    });
  });
});
