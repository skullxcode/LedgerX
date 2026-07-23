/**
 * Custom error types for better error handling and standardized logging across the application.
 */

// ============================================================================
// BASE ERROR
// ============================================================================

/**
 * The base application error class that all custom errors should extend.
 * Provides a standardized structure for JSON serialization.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Serializes the error to a plain object suitable for API responses or logging.
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

// ============================================================================
// SPECIFIC ERRORS
// ============================================================================

/**
 * Thrown when input data fails schema or format validation.
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Thrown when a requested resource (like a document or user) cannot be found.
 */
export class NotFoundError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'NOT_FOUND', 404, details);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Thrown when the user is not authenticated or lacks required permissions.
 */
export class AuthorizationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'UNAUTHORIZED', 401, details);
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * Thrown when a state conflict occurs (e.g., trying to void an already voided transaction).
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CONFLICT', 409, details);
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * Thrown when the user hits an API rate limit.
 */
export class RateLimitError extends AppError {
  constructor(message: string, retryAfter?: number) {
    super(message, 'RATE_LIMIT', 429, { retryAfter });
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

// ============================================================================
// ERROR HANDLERS
// ============================================================================

/**
 * Type guard to check if an unknown error is an instance of AppError.
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Intercepts errors safely and returns a standardized error response object.
 * Logs unknown errors automatically.
 * 
 * @param error - The error thrown in a catch block.
 * @param context - Optional context string for logging (e.g., 'API Route Handler').
 */
export function handleError(error: unknown, context?: string) {
  if (isAppError(error)) {
    return error.toJSON();
  }

  if (error instanceof Error) {
    console.error(`Error${context ? ` in ${context}` : ''}:`, error.message);
    return {
      name: error.name,
      message: error.message,
      code: 'UNKNOWN_ERROR',
      statusCode: 500,
    };
  }

  console.error(`Unknown error${context ? ` in ${context}` : ''}:`, error);
  return {
    message: 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
  };
}
