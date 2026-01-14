/**
 * Batch Normalization Utility
 * 
 * Normalizes batch values to "Kompeni {number}" format
 * Handles various input formats and extracts the number
 */

/**
 * Normalizes batch value to "Kompeni {number}" format
 * @param batch - Raw batch value (string, null, or undefined)
 * @returns Normalized batch value in "Kompeni {number}" format, or null if invalid
 * 
 * @example
 * normalizeBatch("Kompeni 9")      // "Kompeni 9"
 * normalizeBatch("kompeni 9")      // "Kompeni 9"
 * normalizeBatch("Kompeni9")       // "Kompeni 9"
 * normalizeBatch("kompeni9")       // "Kompeni 9"
 * normalizeBatch("9")              // "Kompeni 9"
 * normalizeBatch("Kompeni No 9")   // "Kompeni 9"
 * normalizeBatch("")                // null
 * normalizeBatch(null)              // null
 */
export function normalizeBatch(batch: string | null | undefined): string | null {
  // Handle null, undefined, or empty string
  if (!batch || typeof batch !== 'string' || batch.trim() === '') {
    return null;
  }
  
  const trimmed = batch.trim();
  
  // Extract number from string (handles various formats)
  const numberMatch = trimmed.match(/\d+/);
  if (!numberMatch) {
    // No number found, return null
    return null;
  }
  
  const number = numberMatch[0];
  
  // Return normalized format: "Kompeni {number}"
  return `Kompeni ${number}`;
}

/**
 * Normalizes batch value for display (ensures consistent format)
 * This is used when returning batch values in API responses
 * @param batch - Batch value from database
 * @returns Normalized batch value or null
 */
export function normalizeBatchForResponse(batch: string | null | undefined): string | null {
  return normalizeBatch(batch);
}
