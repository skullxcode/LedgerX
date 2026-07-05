/**
 * Input validation utilities
 */

import { ValidationError } from './errors';

/**
 * Validate string input
 */
export function validateString(
  value: any,
  fieldName: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  } = {}
): string {
  const { required = true, minLength = 0, maxLength = 10000, pattern } = options;

  if (value === null || value === undefined) {
    if (required) {
      throw new ValidationError(`${fieldName} is required`);
    }
    return '';
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();

  if (required && trimmed.length === 0) {
    throw new ValidationError(`${fieldName} cannot be empty`);
  }

  if (trimmed.length < minLength) {
    throw new ValidationError(
      `${fieldName} must be at least ${minLength} characters long`
    );
  }

  if (trimmed.length > maxLength) {
    throw new ValidationError(
      `${fieldName} must not exceed ${maxLength} characters`
    );
  }

  if (pattern && !pattern.test(trimmed)) {
    throw new ValidationError(`${fieldName} format is invalid`);
  }

  return trimmed;
}

/**
 * Validate number input
 */
export function validateNumber(
  value: any,
  fieldName: string,
  options: {
    required?: boolean;
    min?: number;
    max?: number;
    integer?: boolean;
  } = {}
): number {
  const { required = true, min = -Infinity, max = Infinity, integer = false } = options;

  if (value === null || value === undefined) {
    if (required) {
      throw new ValidationError(`${fieldName} is required`);
    }
    return 0;
  }

  const num = Number(value);

  if (isNaN(num)) {
    throw new ValidationError(`${fieldName} must be a valid number`);
  }

  if (integer && !Number.isInteger(num)) {
    throw new ValidationError(`${fieldName} must be an integer`);
  }

  if (num < min) {
    throw new ValidationError(`${fieldName} must be at least ${min}`);
  }

  if (num > max) {
    throw new ValidationError(`${fieldName} must not exceed ${max}`);
  }

  return num;
}

/**
 * Validate email format
 */
export function validateEmail(value: any, fieldName: string = 'Email'): string {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return validateString(value, fieldName, {
    required: true,
    minLength: 5,
    maxLength: 254,
    pattern: emailPattern,
  });
}

/**
 * Validate phone number (basic format)
 */
export function validatePhone(value: any, fieldName: string = 'Phone'): string {
  const phonePattern = /^[\d\s\-\+\(\)]{10,}$/;
  return validateString(value, fieldName, {
    required: true,
    minLength: 10,
    maxLength: 20,
    pattern: phonePattern,
  });
}

/**
 * Validate array
 */
export function validateArray<T>(
  value: any,
  fieldName: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    itemValidator?: (item: any, index: number) => T;
  } = {}
): T[] {
  const { required = true, minLength = 0, maxLength = 10000, itemValidator } = options;

  if (!Array.isArray(value)) {
    if (required) {
      throw new ValidationError(`${fieldName} must be an array`);
    }
    return [];
  }

  if (value.length < minLength) {
    throw new ValidationError(
      `${fieldName} must have at least ${minLength} items`
    );
  }

  if (value.length > maxLength) {
    throw new ValidationError(
      `${fieldName} must not exceed ${maxLength} items`
    );
  }

  if (itemValidator) {
    return value.map((item, index) => itemValidator(item, index));
  }

  return value;
}

/**
 * Validate object structure
 */
export function validateObject<T>(
  value: any,
  fieldName: string,
  validators: Record<keyof T, (v: any) => any>
): T {
  if (!value || typeof value !== 'object') {
    throw new ValidationError(`${fieldName} must be an object`);
  }

  const result: any = {};

  for (const [key, validator] of Object.entries(validators)) {
    try {
      result[key] = (validator as (v: any) => any)(value[key]);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ValidationError(
          `Invalid value for ${fieldName}.${key}: ${error.message}`
        );
      }
      throw error;
    }
  }

  return result as T;
}

/**
 * Sanitize string input (prevent injection attacks)
 */
export function sanitizeString(value: string): string {
  return value
    .trim()
    .replace(/[<>\"'&]/g, (char) => {
      const escapeMap: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;',
      };
      return escapeMap[char];
    });
}
