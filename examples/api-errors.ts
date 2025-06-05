/**
 * API Errors Example
 *
 * This example demonstrates how to use BaseError in an API context,
 * including mapping errors to HTTP responses and creating a consistent
 * error handling system.
import { BaseError } from '../src/index.js';

 */
// Define a base API error class
class ApiError extends BaseError<"ApiError"> {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    cause?: unknown,
  ) {
    super("ApiError", message, cause);
  }

  // Convert to an API response
  toResponse() {
    return {
      error: {
        type: this.name,
        message: this.message,
        timestamp: this.timestampIso,
        // Include additional fields for non-production environments
        ...(process.env.NODE_ENV !== "production" && {
          stack: this.stack,
          cause: (this as unknown as Record<string, unknown>).cause,
        }),
      },
      statusCode: this.statusCode,
    };
  }
}

// Define specific API error types
class BadRequestError extends ApiError {
  constructor(message: string, cause?: unknown) {
    super(message, 400, cause);
    Object.defineProperty(this, "name", { value: "BadRequestError" });
  }
}

class UnauthorizedError extends ApiError {
  constructor(message: string = "Unauthorized", cause?: unknown) {
    super(message, 401, cause);
    Object.defineProperty(this, "name", { value: "UnauthorizedError" });
  }
}

class ForbiddenError extends ApiError {
  constructor(message: string = "Forbidden", cause?: unknown) {
    super(message, 403, cause);
    Object.defineProperty(this, "name", { value: "ForbiddenError" });
  }
}

class NotFoundError extends ApiError {
  constructor(resource: string, id?: string, cause?: unknown) {
    const message = id
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    super(message, 404, cause);
    Object.defineProperty(this, "name", { value: "NotFoundError" });
  }
}

class ConflictError extends ApiError {
  constructor(message: string, cause?: unknown) {
    super(message, 409, cause);
    Object.defineProperty(this, "name", { value: "ConflictError" });
  }
}

// Simulate Express-like middleware for error handling
function errorHandler(error: unknown) {
  console.log("API Error Handler:");

  // Convert any error to an ApiError
  let apiError: ApiError;

  if (error instanceof ApiError) {
    apiError = error;
  } else if (error instanceof Error) {
    apiError = new ApiError(error.message, 500, error);
  } else {
    apiError = new ApiError(String(error), 500);
  }

  // Get the response object
  const response = apiError.toResponse();

  // In a real API, we would set the status code and send the response
  console.log(`Status: ${response.statusCode}`);
  console.log("Response Body:", JSON.stringify(response.error, null, 2));

  return response;
}

// Example API route handlers
function getUser(id: string) {
  // Simulate user not found
  if (id === "missing") {
    throw new NotFoundError("User", id);
  }

  // Simulate unauthorized access
  if (id === "protected") {
    throw new UnauthorizedError("Authentication required to access this user");
  }

  // Simulate forbidden access (user exists but access is forbidden)
  if (id === "forbidden") {
    throw new ForbiddenError("Access to this user is forbidden");
  }

  return { id, name: "John Doe", email: "john@example.com" };
}

function createUser(userData: unknown) {
  // Simulate validation error
  if (!userData || typeof userData !== "object") {
    throw new BadRequestError("Invalid user data");
  }

  const user = userData as Record<string, unknown>;

  if (!user.email) {
    throw new BadRequestError("Email is required");
  }

  // Simulate conflict
  if (user.email === "existing@example.com") {
    throw new ConflictError("User with this email already exists");
  }

  return { id: "new-user-123", ...user };
}

// Example usage
function main() {
  console.log("API Errors Example\n");

  // Example 1: Not Found Error
  try {
    console.log("Example 1: Getting a non-existent user");
    const user = getUser("missing");
    console.log("User:", user);
  } catch (error) {
    errorHandler(error);
  }

  console.log("\n---\n");

  // Example 2: Unauthorized Error
  try {
    console.log("Example 2: Accessing a protected user");
    const user = getUser("protected");
    console.log("User:", user);
  } catch (error) {
    errorHandler(error);
  }

  console.log("\n---\n");

  // Example 3: Bad Request Error
  try {
    console.log("Example 3: Creating a user with invalid data");
    const user = createUser(null);
    console.log("Created user:", user);
  } catch (error) {
    errorHandler(error);
  }

  console.log("\n---\n");

  // Example 4: Conflict Error
  try {
    console.log("Example 4: Creating a user with an existing email");
    const user = createUser({ name: "Jane", email: "existing@example.com" });
    console.log("Created user:", user);
  } catch (error) {
    errorHandler(error);
  }

  console.log("\n---\n");

  // Example 5: Successful operation
  try {
    console.log("Example 5: Getting an existing user");
    const user = getUser("valid-id");
    console.log("User:", user);
  } catch (error) {
    errorHandler(error);
  }

  console.log("\n---\n");

  // Example 6: Forbidden Error
  try {
    console.log("Example 6: Accessing a forbidden user");
    const user = getUser("forbidden");
    console.log("User:", user);
  } catch (error) {
    errorHandler(error);
  }

  console.log("\n---\n");

  // Example 7: Handling unknown errors
  try {
    console.log("Example 7: Handling an unknown error");
    throw new Error("Something unexpected happened");
  } catch (error) {
    errorHandler(error);
  }
}

// Run the example
main();
