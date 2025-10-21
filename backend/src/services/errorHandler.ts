import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
  details?: any;
}

export class CustomError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', isOperational: boolean = true, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Predefined error types
export const ErrorTypes = {
  VALIDATION_ERROR: (message: string, details?: any) => 
    new CustomError(message, 400, 'VALIDATION_ERROR', true, details),
  
  AUTHENTICATION_ERROR: (message: string = 'Authentication required') => 
    new CustomError(message, 401, 'AUTHENTICATION_ERROR'),
  
  AUTHORIZATION_ERROR: (message: string = 'Insufficient permissions') => 
    new CustomError(message, 403, 'AUTHORIZATION_ERROR'),
  
  NOT_FOUND: (message: string = 'Resource not found') => 
    new CustomError(message, 404, 'NOT_FOUND'),
  
  RATE_LIMIT_ERROR: (message: string = 'Too many requests') => 
    new CustomError(message, 429, 'RATE_LIMIT_ERROR'),
  
  DUPLICATE_ERROR: (message: string = 'Duplicate resource') => 
    new CustomError(message, 409, 'DUPLICATE_ERROR'),
  
  EXTERNAL_SERVICE_ERROR: (message: string = 'External service unavailable') => 
    new CustomError(message, 502, 'EXTERNAL_SERVICE_ERROR'),
  
  INTERNAL_ERROR: (message: string = 'Internal server error') => 
    new CustomError(message, 500, 'INTERNAL_ERROR'),
  
  GEMINI_API_ERROR: (message: string = 'AI service unavailable') => 
    new CustomError(message, 503, 'GEMINI_API_ERROR'),
  
  SOLANA_ERROR: (message: string = 'Blockchain service error') => 
    new CustomError(message, 502, 'SOLANA_ERROR'),
  
  PAYOUT_ERROR: (message: string = 'Payout service error') => 
    new CustomError(message, 502, 'PAYOUT_ERROR')
};

// Error logging
export function logError(error: AppError, context?: any): void {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    error: {
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      stack: error.stack,
      isOperational: error.isOperational,
      details: error.details
    },
    context
  };

  if (error.statusCode >= 500) {
    console.error(`[ERROR] ${timestamp}`, JSON.stringify(logData, null, 2));
  } else {
    console.warn(`[WARN] ${timestamp}`, JSON.stringify(logData, null, 2));
  }
}

// Error response formatter
export function formatErrorResponse(error: AppError): {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
} {
  return {
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString()
    }
  };
}

// Global error handler middleware
export function errorHandler(
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error
  logError(error, {
    method: req.method,
    url: req.url,
    userId: req.body?.userId,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  // Handle different error types
  if (error.name === 'ValidationError') {
    const validationError = ErrorTypes.VALIDATION_ERROR(
      'Invalid request data',
      error.details
    );
    res.status(validationError.statusCode).json(formatErrorResponse(validationError));
    return;
  }

  if (error.name === 'CastError') {
    const castError = ErrorTypes.VALIDATION_ERROR('Invalid data format');
    res.status(castError.statusCode).json(formatErrorResponse(castError));
    return;
  }

  if (error.name === 'MongoError' && error.code === 11000) {
    const duplicateError = ErrorTypes.DUPLICATE_ERROR('Resource already exists');
    res.status(duplicateError.statusCode).json(formatErrorResponse(duplicateError));
    return;
  }

  // Handle operational errors (expected errors)
  if (error.isOperational) {
    res.status(error.statusCode || 500).json(formatErrorResponse(error));
    return;
  }

  // Handle programming errors (unexpected errors)
  const internalError = ErrorTypes.INTERNAL_ERROR(
    process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : error.message
  );
  
  res.status(internalError.statusCode).json(formatErrorResponse(internalError));
}

// Async error wrapper
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Error recovery strategies
export class ErrorRecovery {
  static async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  static async fallbackResponse<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>
  ): Promise<T> {
    try {
      return await primaryOperation();
    } catch (error) {
      console.warn('Primary operation failed, using fallback:', error);
      return await fallbackOperation();
    }
  }
}

// Circuit breaker pattern for external services
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000,
    private resetTimeout: number = 30000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new CustomError('Service temporarily unavailable', 503, 'CIRCUIT_BREAKER_OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}

// Health check error tracking
export class HealthMonitor {
  private static errors: Map<string, { count: number; lastError: Date }> = new Map();

  static recordError(service: string, error: Error): void {
    const existing = this.errors.get(service) || { count: 0, lastError: new Date() };
    this.errors.set(service, {
      count: existing.count + 1,
      lastError: new Date()
    });
  }

  static getServiceHealth(service: string): {
    healthy: boolean;
    errorCount: number;
    lastError?: Date;
  } {
    const errorData = this.errors.get(service);
    const healthy = !errorData || errorData.count < 5;
    
    return {
      healthy,
      errorCount: errorData?.count || 0,
      lastError: errorData?.lastError
    };
  }

  static resetService(service: string): void {
    this.errors.delete(service);
  }
}
