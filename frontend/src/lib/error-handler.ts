/**
 * Error handling utilities for user-friendly error messages
 * Prevents raw stack traces and technical errors from being shown to users
 */

/**
 * Convert any error into a user-friendly message
 */
export function getUserFriendlyError(error: unknown): string {
  // Handle null/undefined
  if (!error) {
    return 'An unexpected error occurred. Please try again.';
  }

  // Extract error message
  let errorMessage = '';
  
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (typeof error === 'object' && 'message' in error) {
    errorMessage = String((error as any).message);
  } else {
    errorMessage = String(error);
  }

  // Magic Link specific errors
  if (errorMessage.includes('User denied signing')) {
    return 'You cancelled the signature request. Please try again to place your trade.';
  }
  
  if (errorMessage.includes('User denied transaction')) {
    return 'You cancelled the transaction. Please try again.';
  }
  
  if (errorMessage.includes('Magic RPC Error')) {
    // Extract the actual error message after the error code
    const match = errorMessage.match(/Internal error: (.+)/);
    if (match) {
      return getUserFriendlyError(match[1]);
    }
    return 'Authentication error. Please try again.';
  }

  // Network errors
  if (errorMessage.includes('fetch failed') || errorMessage.includes('NetworkError')) {
    return 'Network error. Please check your connection and try again.';
  }
  
  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return 'Request timed out. Please try again.';
  }

  // Contract errors
  if (errorMessage.includes('CONTRACT_REVERT_EXECUTED')) {
    return 'Transaction failed. Please check your balance and try again.';
  }
  
  if (errorMessage.includes('Insufficient')) {
    // Keep insufficient balance messages as they're already user-friendly
    return errorMessage;
  }
  
  if (errorMessage.includes('Invalid signature')) {
    return 'Signature verification failed. Please try signing again.';
  }

  // Wallet errors
  if (errorMessage.includes('No account found') || errorMessage.includes('not logged in')) {
    return 'Please log in to continue.';
  }
  
  if (errorMessage.includes('Proxy wallet')) {
    // Keep proxy wallet messages as they're already user-friendly
    return errorMessage;
  }

  // API errors
  if (errorMessage.includes('Failed to fetch')) {
    return 'Unable to connect to server. Please try again.';
  }

  // Generic errors - check if message is already user-friendly
  // (doesn't contain technical terms like "undefined", "null", stack traces, etc.)
  const technicalTerms = [
    'undefined',
    'null',
    'NaN',
    'at Object',
    'at async',
    'TypeError',
    'ReferenceError',
    'SyntaxError',
    'RangeError',
    'stack trace',
    'callstack',
    '.tsx:',
    '.ts:',
    '.js:',
  ];

  const hasTechnicalTerms = technicalTerms.some(term => 
    errorMessage.toLowerCase().includes(term.toLowerCase())
  );

  if (hasTechnicalTerms) {
    return 'An unexpected error occurred. Please try again or contact support if the issue persists.';
  }

  // If message seems user-friendly, return it
  // Limit length to avoid showing entire stack traces
  if (errorMessage.length > 200) {
    return 'An error occurred. Please try again or contact support if the issue persists.';
  }

  return errorMessage;
}

/**
 * Log error for debugging while showing user-friendly message
 */
export function handleError(error: unknown, context?: string): string {
  const friendlyMessage = getUserFriendlyError(error);
  
  // Log full error for debugging
  if (context) {
    console.error(`[${context}] Error:`, error);
  } else {
    console.error('Error:', error);
  }
  
  return friendlyMessage;
}

/**
 * Sanitize API error responses
 */
export function sanitizeApiError(error: any): { error: string } {
  const message = getUserFriendlyError(error);
  return { error: message };
}
