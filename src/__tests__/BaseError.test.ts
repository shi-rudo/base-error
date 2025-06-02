import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { BaseError } from '../BaseError.js';

// Ensure consistent behavior in tests
beforeEach(() => {
  // Reset any mocks
  vi.restoreAllMocks();

  // Ensure stack traces are consistent in tests
  vi.spyOn(Error, 'captureStackTrace');
});

// Test error class that extends BaseError
class TestError extends BaseError<'TestError'> {
  constructor(message: string, cause?: unknown) {
    super('TestError', message, cause);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      timestamp: this.timestamp,
      timestampIso: this.timestampIso,
      stack: this.stack,
      cause: (this as any).cause instanceof Error ? (this as any).cause.toString() : (this as any).cause
    };
  }
}

describe('BaseError', () => {
  // Mock Date for consistent timestamps in tests
  const mockDate = new Date('2025-01-01T00:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create an error with the correct name and message', () => {
    const error = new TestError('Something went wrong');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(BaseError);
    expect(error.name).toBe('TestError');
    expect(error.message).toBe('Something went wrong');
  });

  it('should include timestamps', () => {
    const error = new TestError('Test');

    expect(error.timestamp).toBe(mockDate.getTime());
    expect(error.timestampIso).toBe(mockDate.toISOString());
  });

  it('should include a stack trace', () => {
    const error = new TestError('Test');

    // Just verify that a stack trace exists and is a string
    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe('string');
  });

  it('should handle error causes', () => {
    const cause = new Error('Root cause');
    const error = new TestError('Wrapper error', cause);

    // @ts-ignore - cause is not in the type definition but should be present
    expect(error.cause).toBe(cause);
    expect(error.toString()).toContain('Caused by: Error: Root cause');
  });

  it('should serialize to JSON correctly', () => {
    const cause = new Error('Root cause');
    const error = new TestError('Test error', cause);

    const json = error.toJSON();

    // Check the basic structure of the JSON output
    expect(json).toMatchObject({
      name: 'TestError',
      message: 'Test error',
      timestamp: mockDate.getTime(),
      timestampIso: mockDate.toISOString(),
      cause: 'Error: Root cause'
    });

    // Verify stack is a string if it exists
    if ('stack' in json) {
      expect(typeof json.stack).toBe('string');
    }
  });

  it('should handle undefined cause', () => {
    const error = new TestError('Test');

    // @ts-ignore - cause is not in the type definition but should be undefined
    expect(error.cause).toBeUndefined();
    expect(error.toString()).not.toContain('Caused by');
  });

  it('should maintain prototype chain', () => {
    const error = new TestError('Test');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(BaseError);
    expect(error).toBeInstanceOf(TestError);
  });
});
