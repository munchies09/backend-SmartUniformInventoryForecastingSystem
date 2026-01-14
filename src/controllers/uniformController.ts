import { Request, Response } from 'express';
import { UniformInventory, MemberUniform, IUniformItem } from '../models/uniformModel';
import { ShirtPrice } from '../models/shirtPriceModel';
import { AuthRequest } from '../middleware/auth';
import mongoose from 'mongoose';

// ===============================
// VALIDATION HELPERS
// ===============================

// Valid categories - 5-category structure with backward compatibility support
const VALID_CATEGORIES = [
  'Uniform No 3',
  'Uniform No 4',
  'Accessories No 3',
  'Accessories No 4',
  'Shirt',
  'T-Shirt' // Backward compatibility - will be normalized to "Shirt"
] as const;

// Valid types by category (canonical labels)
// NOTE: Categories are now separated - accessories have their own categories
const VALID_TYPES: Record<string, string[]> = {
  'Uniform No 3': [
    // Main uniform items only (NO accessories)
    'Uniform No 3 Male', 'Cloth No 3', // Backward compatible
    'Uniform No 3 Female', 'Pants No 3', // Backward compatible
    'PVC Shoes',
    'Beret'
  ],
  'Uniform No 4': [
    // Main uniform items only (NO accessories)
    'Uniform No 4', 'Cloth No 4', 'Pants No 4', // Backward compatible (merged type)
    'Boot'
  ],
  'Accessories No 3': [
    // Accessories for Uniform No 3
    'Apulet',
    'Integrity Badge',
    'Shoulder Badge', // NOT "Gold Badge" - Gold Badge was migrated to Shoulder Badge
    'Cel Bar',
    'Beret Logo Pin',
    'Belt No 3',
    'Nametag', // When associated with Uniform No 3 context
    'Name Tag',
    'Name Tag No 3'
  ],
  'Accessories No 4': [
    // Accessories for Uniform No 4
    'APM Tag',
    'Belt No 4',
    'Nametag', // When associated with Uniform No 4 context
    'Name Tag',
    'Name Tag No 4'
  ],
  'Shirt': [
    'Digital Shirt', 'Digital',
    'Inner APM Shirt', 'Inner APM',
    'Company Shirt', 'Company'
  ]
};

// Types that require sizes (all others don't have sizes)
const TYPES_WITH_SIZES: Record<string, string[]> = {
  'Uniform No 3': ['Uniform No 3 Male', 'Cloth No 3', 'Uniform No 3 Female', 'Pants No 3', 'PVC Shoes', 'Beret'],
  'Uniform No 4': ['Uniform No 4', 'Cloth No 4', 'Pants No 4', 'Boot'],
  'Accessories No 3': [], // Accessories don't have sizes (except Nametag uses "N/A")
  'Accessories No 4': [], // Accessories don't have sizes (except Nametag uses "N/A")
  'Shirt': ['Digital Shirt', 'Digital', 'Inner APM Shirt', 'Inner APM', 'Company Shirt', 'Company']
};

// Items that are custom-ordered (don't require inventory check)
// These items are ordered per user with custom details (e.g., name on nametag)
const CUSTOM_ORDERED_ITEMS: string[] = [
  'Nametag',
  'Name Tag',
  'Name Tag No 3',
  'Name Tag No 4',
  'Nameplate',
  'Name Plate'
];

// Helper function to check if item is custom-ordered (skips inventory check)
function isCustomOrderedItem(type: string): boolean {
  const normalizedType = type.trim().toLowerCase();
  return CUSTOM_ORDERED_ITEMS.some(customItem => 
    normalizedType === customItem.toLowerCase() ||
    normalizedType.includes('nametag') ||
    normalizedType.includes('name tag') ||
    normalizedType.includes('nameplate')
  );
}

// Helper function to check if an item TYPE is an accessory (regardless of category)
// This is critical because frontend might send accessories with category "Uniform No 3"
function isAccessoryType(type: string): boolean {
  if (!type || typeof type !== 'string') return false;
  
  const typeLower = type.trim().toLowerCase();
  
  // List of accessory types for Uniform No 3
  const accessoryTypesNo3 = [
    'apulet',
    'integrity badge',
    'shoulder badge',
    'gold badge', // Legacy - will be normalized to Shoulder Badge
    'cel bar',
    'beret logo pin',
    'belt no 3',
    'nametag',
    'name tag',
    'name tag no 3',
    'nameplate'
  ];
  
  // List of accessory types for Uniform No 4
  const accessoryTypesNo4 = [
    'apm tag',
    'belt no 4',
    'nametag',
    'name tag',
    'name tag no 4'
  ];
  
  // CRITICAL: First check if it's a MAIN ITEM (these are NOT accessories)
  // "Beret" is a MAIN ITEM in Uniform No 3, NOT an accessory (unlike "Beret Logo Pin" which IS an accessory)
  const mainItems = [
    'beret',           // Main item - NOT "Beret Logo Pin" (which IS an accessory)
    'pvc shoes',       // Main item
    'boot',            // Main item
    'uniform no 3 male', 'cloth no 3',
    'uniform no 3 female', 'pants no 3',
    'uniform no 4', 'cloth no 4', 'pants no 4'
  ];
  
  // If it's a main item, return false immediately (NOT an accessory)
  for (const mainItem of mainItems) {
    // Use exact match for main items to avoid false positives
    // Example: "Beret" should match "beret" exactly, but NOT match "beret logo pin"
    if (typeLower === mainItem.toLowerCase()) {
      return false; // Main item, NOT an accessory
    }
  }
  
  // Now check if type matches any accessory type
  const allAccessoryTypes = [...accessoryTypesNo3, ...accessoryTypesNo4];
  
  return allAccessoryTypes.some(accType => {
    const accTypeLower = accType.toLowerCase();
    
    // Exact match
    if (typeLower === accTypeLower) return true;
    
    // For multi-word accessories (like "beret logo pin"), check if type contains the full phrase
    // But avoid matching single words that are part of multi-word accessories
    // Example: "Beret Logo Pin" should match "beret logo pin", but "Beret" should NOT
    if (accTypeLower.split(' ').length > 1) {
      // For multi-word accessories, require the type to contain the full accessory name
      // But exclude if the type is just a single word that's part of the accessory name
      // Example: "beret logo pin" contains "beret", but "beret" alone should NOT match
      return typeLower.includes(accTypeLower) && typeLower.split(' ').length > 1;
    } else {
      // For single-word accessories, use exact match only
      return typeLower === accTypeLower;
    }
  });
}

// Helper function to normalize type name (handles backward compatibility)
function normalizeTypeName(category: string, type: string): string {
  if (!type || typeof type !== 'string') return type;
  
  const catLower = category?.toLowerCase() || '';
  const typeLower = type.toLowerCase();
  
  // Uniform No 3 types
  if (typeLower.includes('cloth no 3') && typeLower.includes('male')) return 'Uniform No 3 Male';
  if (typeLower.includes('pants no 3') && typeLower.includes('female')) return 'Uniform No 3 Female';
  if (typeLower === 'cloth no 3' || typeLower.includes('cloth no 3')) return 'Uniform No 3 Male';
  if (typeLower === 'pants no 3' || typeLower.includes('pants no 3')) return 'Uniform No 3 Female';
  
  // Uniform No 4 types
  if (typeLower.includes('cloth no 4') || typeLower.includes('pants no 4') || typeLower === 'uniform no 4') {
    return 'Uniform No 4';
  }
  
  // Shirt types
  if (typeLower === 'digital' || (typeLower.includes('digital') && !typeLower.includes('shirt'))) {
    return 'Digital Shirt';
  }
  if (typeLower === 'company' || (typeLower.includes('company') && !typeLower.includes('shirt'))) {
    return 'Company Shirt';
  }
  if (typeLower.includes('inner apm') || typeLower === 'innerapm') {
    return 'Inner APM Shirt';
  }
  
  // Accessories - ensure correct names
  if (typeLower.includes('gold badge')) return 'Shoulder Badge'; // Migrate Gold Badge to Shoulder Badge
  if (typeLower.includes('apm tag')) return 'APM Tag';
  
  // Nametag - normalize based on category and type suffix
  // CRITICAL: "Nametag No 3" and "Nametag No 4" are DIFFERENT items
  if (typeLower.includes('nametag') || typeLower.includes('name tag')) {
    // If type explicitly includes "No 3" or "No 4", preserve it
    if (typeLower.includes('no 4') || typeLower.includes('no. 4')) {
      return 'Name Tag No 4'; // Normalize to canonical form
    }
    if (typeLower.includes('no 3') || typeLower.includes('no. 3')) {
      return 'Name Tag No 3'; // Normalize to canonical form
    }
    
    // If just "Nametag" or "Name Tag" without suffix, determine from category
    if (catLower.includes('no 4') || catLower.includes('accessories no 4')) {
      return 'Name Tag No 4'; // Default to No 4 if category is No 4
    }
    if (catLower.includes('no 3') || catLower.includes('accessories no 3')) {
      return 'Name Tag No 3'; // Default to No 3 if category is No 3
    }
    
    // Fallback: if category is unclear, preserve original but normalize format
    return type; // Return original (frontend should send explicit "No 3" or "No 4")
  }
  
  return type; // Return original if no normalization needed
}

// Helper function to normalize category for storage (STRICT - only accepts 5 categories from frontend)
// ACCEPTS these 5 categories: "Uniform No 3", "Uniform No 4", "Accessories No 3", "Accessories No 4", "Shirt"
// NO backward compatibility - frontend MUST send correct categories
function normalizeCategoryForStorage(category: string, itemType: string): string {
  if (!category || typeof category !== 'string') {
    throw new Error(`Invalid category: "${category}". Must be one of: Uniform No 3, Uniform No 4, Accessories No 3, Accessories No 4, Shirt`);
  }
  
  const catLower = category.toLowerCase().trim();
  
  // ✅ ACCEPT "Accessories No 3" from frontend (NEW category)
  if (catLower === 'accessories no 3' || catLower === 'accessories no. 3' || catLower === 'accessory no 3') {
    return 'Accessories No 3';
  }
  
  // ✅ ACCEPT "Accessories No 4" from frontend (NEW category)
  if (catLower === 'accessories no 4' || catLower === 'accessories no. 4' || catLower === 'accessory no 4') {
    return 'Accessories No 4';
  }
  
  // ✅ ACCEPT "Shirt" from frontend (NEW category, replaces "T-Shirt")
  // ✅ BACKWARD COMPATIBILITY: Also accept "T-Shirt" and normalize to "Shirt"
  if (catLower === 'shirt' || catLower === 'shirts' || catLower === 't-shirt' || catLower === 'tshirt' || catLower === 't shirt') {
    return 'Shirt'; // Normalize "T-Shirt" to "Shirt"
  }
  
  // ✅ ACCEPT "Uniform No 3" from frontend (main items only - NO accessories)
  // Main items in Uniform No 3: "Uniform No 3 Male", "Uniform No 3 Female", "Beret", "PVC Shoes"
  // ✅ BACKWARD COMPATIBILITY: If accessory is sent with "Uniform No 3", normalize to "Accessories No 3"
  if (catLower === 'uniform no 3' || catLower === 'uniform no. 3') {
    // Check if item is an accessory using the isAccessoryType function (which correctly excludes "Beret")
    const isAccessory = isAccessoryType(itemType);
    
    if (isAccessory) {
      // BACKWARD COMPATIBILITY: Normalize accessories sent with old category to new category
      // Determine which accessories category based on item type
      const typeLower = (itemType || '').toLowerCase();
      const accessoryTypesNo4 = ['apm tag', 'belt no 4'];
      const isNo4Accessory = accessoryTypesNo4.some(acc => typeLower.includes(acc));
      
      // Check for nametag context
      if (typeLower.includes('nametag') || typeLower.includes('name tag')) {
        // Could be No 3 or No 4 - default to No 3 if sent with "Uniform No 3"
        return 'Accessories No 3';
      }
      
      return isNo4Accessory ? 'Accessories No 4' : 'Accessories No 3';
    }
    // Main items like "Beret", "PVC Shoes" are allowed in "Uniform No 3"
    return 'Uniform No 3';
  }
  
  // ✅ ACCEPT "Uniform No 4" from frontend (main items only - NO accessories)
  // Main items in Uniform No 4: "Uniform No 4", "Boot"
  // ✅ BACKWARD COMPATIBILITY: If accessory is sent with "Uniform No 4", normalize to "Accessories No 4"
  if (catLower === 'uniform no 4' || catLower === 'uniform no. 4') {
    // Check if item is an accessory using the isAccessoryType function
    const isAccessory = isAccessoryType(itemType);
    
    if (isAccessory) {
      // BACKWARD COMPATIBILITY: Normalize accessories sent with old category to new category
      return 'Accessories No 4';
    }
    // Main items like "Boot", "Uniform No 4" are allowed in "Uniform No 4"
    return 'Uniform No 4';
  }
  
  // ❌ REJECT any other category
  throw new Error(`Invalid category: "${category}". Valid categories are: Uniform No 3, Uniform No 4, Accessories No 3, Accessories No 4, Shirt (or T-Shirt for backward compatibility)`);
}

// Helper function to validate category (with backward compatibility)
function isValidCategory(category: string): boolean {
  if (!category || typeof category !== 'string') return false;
  
  const catLower = category.toLowerCase().trim();
  
  // Accept the 5 main categories plus backward-compatible "T-Shirt"
  const validCategoriesLower = VALID_CATEGORIES.map(c => c.toLowerCase());
  return validCategoriesLower.includes(catLower);
}

// Helper function to validate Base64 image format
function validateBase64Image(image: string): { valid: boolean; error?: string } {
  if (!image || typeof image !== 'string') {
    return { valid: false, error: 'Image must be a valid string' };
  }

  // Check if it's a Base64 data URL
  if (!image.startsWith('data:image/')) {
    // Allow URLs as well (for future cloud storage support)
    if (image.startsWith('http://') || image.startsWith('https://')) {
      return { valid: true };
    }
    return { valid: false, error: 'Invalid image format. Must be a valid Base64 image string (starting with data:image/) or a valid URL.' };
  }

  // Validate Base64 data URL format: data:image/[type];base64,[data]
  const base64Regex = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i;
  if (!base64Regex.test(image)) {
    return { valid: false, error: 'Invalid image format. Supported formats: PNG, JPEG, JPG, GIF, WEBP.' };
  }

  // Validate size (max 10MB Base64 string)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (image.length > maxSize) {
    return { valid: false, error: 'Image too large. Maximum size is 10MB.' };
  }

  // Extract and validate Base64 data
  const base64Data = image.split(',')[1];
  if (!base64Data) {
    return { valid: false, error: 'Invalid Base64 image format. Missing data.' };
  }

  // Basic Base64 validation (should only contain valid Base64 characters)
  const base64RegexData = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64RegexData.test(base64Data)) {
    return { valid: false, error: 'Invalid Base64 data format.' };
  }

  return { valid: true };
}

// Helper function to validate type for category
// UPDATED: Now allows ANY type string as long as category is valid (supports custom types)
function isValidType(category: string, type: string): boolean {
  // First check if category is valid
  if (!isValidCategory(category)) {
    return false;
  }
  
  // Check if type is a valid string (non-empty)
  if (!type || typeof type !== 'string' || type.trim().length === 0) {
    return false;
  }
  
  // Allow any type string - no restriction to predefined types
  // This enables custom item types from the frontend
  return true;
  
  // Optional: Still check predefined types for backward compatibility
  // If you want to keep predefined type validation as a preference but allow custom types:
  // const allowed = VALID_TYPES[category];
  // if (allowed) {
  //   const normalizedInput = normalizeTypeForMatching(type);
  //   if (allowed.some(t => normalizeTypeForMatching(t) === normalizedInput)) {
  //     return true; // Predefined type found
  //   }
  // }
  // return true; // Allow custom types
}

// Helper function to check if type requires size
// UPDATED: More flexible - checks predefined types OR detects size requirement from type name
// CRITICAL: First check if it's an accessory - accessories NEVER require sizes
function requiresSize(category: string, type: string): boolean {
  if (!type || typeof type !== 'string') return false;
  
  // CRITICAL: Check if it's an accessory FIRST - accessories never require sizes
  // "Beret Logo Pin" is an accessory, so it should NOT require a size
  // Only "Beret" (the main item) requires a size
  const isAccessory = isAccessoryType(type);
  if (isAccessory) {
    return false; // Accessories never require sizes
  }
  
  const typeLower = type.toLowerCase();
  
  // Check predefined types that require sizes
  const allowed = TYPES_WITH_SIZES[category];
  if (allowed) {
    const normalizedInput = normalizeTypeForMatching(type);
    if (allowed.some(t => normalizeTypeForMatching(t) === normalizedInput)) {
      return true; // Predefined type that requires size
    }
  }
  
  // For custom types, check if type name suggests it needs a size
  // Items with "shoe", "boot", "shirt", "cloth", "pants", "uniform" typically need sizes
  // NOTE: "beret" keyword is for main item "Beret", NOT "Beret Logo Pin" (which is an accessory)
  const sizeKeywords = ['shoe', 'boot', 'shirt', 'cloth', 'pants', 'uniform'];
  const hasSizeKeyword = sizeKeywords.some(keyword => typeLower.includes(keyword));
  
  // Special case: "Beret" (main item) requires size, but we check for exact match only
  // This prevents "Beret Logo Pin" from matching (which is already excluded above as accessory)
  if (typeLower === 'beret') {
    return true; // Main item "Beret" requires size
  }
  
  // If it's a custom type with size-related keywords, assume it needs a size
  // Otherwise, assume it's an accessory (no size required)
  return hasSizeKeyword;
}

// Helper function to calculate stock status based on quantity
function calculateStockStatus(quantity: number): 'In Stock' | 'Low Stock' | 'Out of Stock' {
  if (quantity === 0) {
    return 'Out of Stock';
  } else if (quantity <= 10) {
    return 'Low Stock';
  } else {
    return 'In Stock';
  }
}

// Helper function to extract numeric part from size (e.g., "UK 7" -> "7", "7" -> "7")
function extractNumericSize(size: string | null | undefined): string | null {
  if (!size || size === '' || size === 'N/A' || size.toLowerCase() === 'n/a') {
    return null;
  }
  // Extract numbers from the size string (handles "UK 7", "7", "UK7", "Size 7", etc.)
  const numericMatch = size.toString().match(/\d+(\.\d+)?/);
  return numericMatch ? numericMatch[0] : null;
}

// Helper function to normalize size for matching
// Removes all spaces and converts to uppercase for consistent matching
function normalizeSize(size: string | null | undefined): string | null {
  if (!size || size === '' || size === 'N/A' || size.toLowerCase() === 'n/a') {
    return null;
  }
  // Trim whitespace, remove all spaces, and convert to uppercase for consistent matching
  // This handles "UK 7" vs "UK7" vs "uk 7" etc.
  return size.trim().replace(/\s+/g, '').toUpperCase();
}

// Helper function to get size variations for flexible matching
function getSizeVariations(size: string | null | undefined): string[] {
  if (!size) return [];
  const trimmed = size.trim();
  const variations = [
    trimmed, // Original
    trimmed.replace(/\s+/g, ''), // No spaces
    trimmed.replace(/\s+/g, ' '), // Single space normalized
    trimmed.toUpperCase(), // Uppercase
    trimmed.toLowerCase(), // Lowercase
    trimmed.replace(/\s+/g, '').toUpperCase(), // No spaces, uppercase
    trimmed.replace(/\s+/g, '').toLowerCase() // No spaces, lowercase
  ];
  // Remove duplicates
  return [...new Set(variations)];
}

// Helper function to normalize type for matching (removes common suffixes like "Shirt", "No 3", etc.)
// Also handles backward compatibility: maps old type names to new gender-specific names
function normalizeTypeForMatching(type: string): string {
  if (!type) return '';
  
  const trimmed = type.trim();
  
  // Map old type names to new names for backward compatibility
  // Uniform No 3 (gender-specific):
  // "Cloth No 3" → "Uniform No 3 Male"
  // "Pants No 3" → "Uniform No 3 Female"
  if (trimmed.toLowerCase() === 'cloth no 3' || trimmed.toLowerCase() === 'cloth no. 3') {
    return 'uniform no 3 male';
  }
  if (trimmed.toLowerCase() === 'pants no 3' || trimmed.toLowerCase() === 'pants no. 3') {
    return 'uniform no 3 female';
  }
  
  // Uniform No 4 (merged - cloth and pants come as a pair):
  // "Cloth No 4" → "Uniform No 4"
  // "Pants No 4" or "Pant No 4" → "Uniform No 4"
  if (trimmed.toLowerCase() === 'cloth no 4' || trimmed.toLowerCase() === 'cloth no. 4') {
    return 'uniform no 4';
  }
  if (trimmed.toLowerCase() === 'pants no 4' || trimmed.toLowerCase() === 'pants no. 4' ||
      trimmed.toLowerCase() === 'pant no 4' || trimmed.toLowerCase() === 'pant no. 4') {
    return 'uniform no 4';
  }
  
  // Gold Badge → Shoulder Badge (backward compatibility)
  if (trimmed.toLowerCase() === 'gold badge') {
    return 'shoulder badge';
  }
  
  // Remove common suffixes and normalize
  return trimmed
    .toLowerCase()
    .replace(/\s*shirt\s*/gi, '') // Remove "Shirt" or "shirt"
    .replace(/\s*no\s*\d+\s*/gi, '') // Remove "No 3", "no 3", etc.
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

// Helper function to format uniform items with status fields
// CRITICAL: Normalizes categories in response to ensure 5-category structure
function formatUniformItemsWithStatus(
  items: any[],
  uniformCreatedAt: Date,
  uniformUpdatedAt: Date
): any[] {
  return items.map((item: any) => {
    try {
      // Ensure item has required fields before normalizing
      if (!item || typeof item !== 'object') {
        console.warn('⚠️  Invalid item in formatUniformItemsWithStatus:', item);
        return null; // Skip invalid items
      }
      
      // Normalize category and type for response (ensure accessories are in correct categories)
      const normalizedType = normalizeTypeName(item.category || '', item.type || '');
      const normalizedCategory = normalizeCategoryForStorage(item.category || '', normalizedType);
      
      // Ensure size is always a string (empty string for accessories, not null)
      let itemSize = item.size;
      if (itemSize === null || itemSize === undefined || itemSize === 'N/A' || String(itemSize).toLowerCase() === 'n/a') {
        itemSize = ''; // Empty string for accessories (schema requires String, not null)
      } else {
        itemSize = String(itemSize).trim();
      }
      
      const itemData: any = {
        category: normalizedCategory || item.category || 'Uniform No 3', // Fallback if normalization fails
        type: normalizedType || item.type || '', // Fallback if normalization fails
        size: itemSize, // Always a string (empty string for accessories)
        quantity: item.quantity !== undefined && item.quantity !== null ? Number(item.quantity) : 1,
        notes: item.notes || null
      };

      // Add status fields if they exist in the item, otherwise calculate default
      if (item.status !== undefined && item.status !== null) {
        // Use status from database if available
        itemData.status = item.status;
        
        // Include missingCount if status is "Missing"
        // CRITICAL: Always include missingCount when status is "Missing" (for frontend display)
        if (item.status === 'Missing') {
          if (item.missingCount !== undefined && item.missingCount !== null && Number(item.missingCount) > 0) {
            itemData.missingCount = Number(item.missingCount);
          } else {
            // If status is Missing but missingCount is not set or is 0, default to 1 (first time marked as Missing)
            itemData.missingCount = 1;
            console.log(`⚠️  Item ${item.type} has status "Missing" but missingCount is ${item.missingCount || 'not set'} - defaulting to 1`);
          }
        }
        
        // Include receivedDate if status is "Available"
        if (item.status === 'Available') {
          if (item.receivedDate) {
            itemData.receivedDate = item.receivedDate instanceof Date 
              ? item.receivedDate.toISOString() 
              : item.receivedDate;
          } else {
            // Default to uniform creation date if receivedDate not set
            itemData.receivedDate = uniformCreatedAt?.toISOString() || new Date().toISOString();
          }
        }
      } else {
        // Default behavior: items in uniform are "Available"
        // Use uniform createdAt as receivedDate (when uniform was first created/issued)
        itemData.status = 'Available';
        itemData.receivedDate = uniformCreatedAt?.toISOString() || new Date().toISOString();
      }

      return itemData;
    } catch (formatError: any) {
      console.error('❌ Error formatting uniform item:', formatError, item);
      // Return a safe fallback item
      return {
        category: item?.category || 'Uniform No 3',
        type: item?.type || 'Unknown',
        size: item?.size || '',
        quantity: item?.quantity || 1,
        notes: item?.notes || null,
        status: 'Available',
        receivedDate: uniformCreatedAt?.toISOString() || new Date().toISOString()
      };
    }
  }).filter(item => item !== null); // Remove any null items from formatting errors
}

// Helper function to find inventory item with case-insensitive and flexible matching
// CRITICAL: Normalizes category before searching to support 5-category structure
async function findInventoryItem(
  category: string, 
  type: string, 
  size: string | null | undefined,
  session?: mongoose.ClientSession
): Promise<(import('../models/uniformModel').IUniformInventory & mongoose.Document) | null> {
  // Validate required parameters
  if (!category || !type) {
    console.error('❌ findInventoryItem called with undefined category or type:', { category, type, size });
    return null;
  }
  
  // CRITICAL: Normalize category and type before searching
  // This ensures accessories are searched in the correct category (Accessories No 3/4, not Uniform No 3/4)
  const normalizedType = normalizeTypeName(category, type);
  const normalizedCategory = normalizeCategoryForStorage(category, normalizedType);
  
  const normalizedSize = normalizeSize(size);
  const normalizedTypeForMatching = normalizeTypeForMatching(normalizedType);
  
  // Build query for category - try both normalized and original category for backward compatibility
  // Some items in database might still have old categories, so we search both
  const categoryQuery = {
    $or: [
      { category: { $regex: new RegExp(`^${String(normalizedCategory).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
      { category: { $regex: new RegExp(`^${String(category).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
    ]
  };
  
  // Add debug logging
  console.log('Searching for inventory item:', {
    originalCategory: category,
    normalizedCategory: normalizedCategory,
    originalType: type,
    normalizedType: normalizedType,
    normalizedTypeForMatching: normalizedTypeForMatching,
    originalSize: size,
    normalizedSize: normalizedSize
  });
  
  // Fetch all items matching category (try both normalized and original), then filter by type and size in memory
  // This allows flexible type matching (handles "Digital Shirt" vs "Digital" etc.)
  // And handles backward compatibility with old category names
  let allItems;
  if (session) {
    allItems = await UniformInventory.find(categoryQuery).session(session);
  } else {
    allItems = await UniformInventory.find(categoryQuery);
  }
  
  if (allItems.length === 0) {
    console.log('No items found for category:', { category });
    return null;
  }
  
  console.log(`Found ${allItems.length} items matching category. Checking type and size...`);
  console.log('Available types:', [...new Set(allItems.map(item => item.type))]);
  
  // First filter by type with flexible matching
  // Use normalizedType (already normalized) for matching, but also try original type for backward compatibility
  const typeMatchedItems = allItems.filter(item => {
    // Normalize item type from database (might have old type names)
    const itemNormalizedType = normalizeTypeName(item.category, item.type);
    const itemNormalizedTypeForMatching = normalizeTypeForMatching(itemNormalizedType);
    const searchNormalizedTypeForMatching = normalizedTypeForMatching;
    
    // Strategy 1: Exact normalized match (after type normalization)
    if (itemNormalizedTypeForMatching === searchNormalizedTypeForMatching) return true;
    if (normalizeTypeForMatching(item.type) === searchNormalizedTypeForMatching) return true;
    
    // Strategy 2: One contains the other (handles "Digital Shirt" matching "Digital")
    if (itemNormalizedTypeForMatching.includes(searchNormalizedTypeForMatching) || 
        searchNormalizedTypeForMatching.includes(itemNormalizedTypeForMatching)) {
      return true;
    }
    
    // Strategy 3: Case-insensitive regex match (original types)
    const itemTypeLower = item.type.toLowerCase();
    const searchTypeLower = normalizedType.toLowerCase(); // Use normalized type
    const originalTypeLower = type.toLowerCase(); // Also try original type
    if (itemTypeLower === searchTypeLower || itemTypeLower === originalTypeLower) return true;
    if (itemTypeLower.includes(searchTypeLower) || searchTypeLower.includes(itemTypeLower)) return true;
    if (itemTypeLower.includes(originalTypeLower) || originalTypeLower.includes(itemTypeLower)) return true;
    
    // Strategy 4: Match normalized type names directly
    const itemNormalizedDirect = normalizeTypeForMatching(item.type);
    if (itemNormalizedDirect === normalizedTypeForMatching) return true;
    
    return false;
  });
  
  if (typeMatchedItems.length === 0) {
    console.log('❌ No matching type found. Available types:', [...new Set(allItems.map(item => item.type))]);
    return null;
  }
  
  console.log(`Found ${typeMatchedItems.length} items matching type. Checking sizes...`);
  console.log('Available sizes for matched type:', typeMatchedItems.map(item => item.size));
  
  // Then filter by size with flexible matching
  let result: (import('../models/uniformModel').IUniformInventory & mongoose.Document) | null = null;
  
  if (normalizedSize === null) {
    // For null size, find items with null, empty, or missing size
    result = typeMatchedItems.find(item => 
      !item.size || 
      item.size === null || 
      item.size === '' || 
      item.size.trim() === '' ||
      item.size.toLowerCase() === 'n/a'
    ) || null;
  } else {
    // For non-null size, match by normalizing both values (remove spaces, uppercase)
    // Also try matching with original size variations and numeric extraction
    const searchNumeric = extractNumericSize(size);
    
    result = typeMatchedItems.find(item => {
      if (!item.size) return false;
      
      // Strategy 1: Normalize both for comparison (remove spaces, uppercase)
      const itemNormalized = normalizeSize(item.size);
      if (itemNormalized === normalizedSize) return true;
      
      // Strategy 2: Direct comparison (case-insensitive, trimmed)
      const itemTrimmed = item.size.trim();
      const searchTrimmed = size ? size.trim() : '';
      if (itemTrimmed.toLowerCase() === searchTrimmed.toLowerCase()) return true;
      
      // Strategy 3: Match with spaces removed (case-insensitive)
      const itemNoSpaces = itemTrimmed.replace(/\s+/g, '').toUpperCase();
      const searchNoSpaces = searchTrimmed.replace(/\s+/g, '').toUpperCase();
      if (itemNoSpaces === searchNoSpaces) return true;
      
      // Strategy 4: Extract and compare numeric parts (handles "UK 7" matching "7")
      if (searchNumeric) {
        const itemNumeric = extractNumericSize(item.size);
        if (itemNumeric && itemNumeric === searchNumeric) {
          console.log(`✅ Matched by numeric part: "${item.size}" matches "${size}" (both have numeric part: ${searchNumeric})`);
          return true;
        }
      }
      
      return false;
    }) || null;
  }
  
  if (result) {
    console.log('✅ Found matching inventory item:', {
      category: result.category,
      type: result.type,
      size: result.size,
      quantity: result.quantity,
      normalizedSize: normalizeSize(result.size)
    });
  } else {
    console.log('❌ No matching size found. Available sizes for type:', 
      typeMatchedItems.map(item => ({ 
        original: item.size, 
        normalized: normalizeSize(item.size) 
      }))
    );
  }
  
  return result;
}

// ===============================
// INVENTORY DEDUCTION ENDPOINT
// ===============================

export const deductInventory = async (req: AuthRequest, res: Response) => {
  // ⚠️ WARNING: This endpoint may be redundant if frontend also calls POST /api/members/uniform
  // If items already exist in user's uniform, this will skip deduction (by design)
  console.log(`\n🟠 ===== DEDUCT INVENTORY REQUEST (Legacy Endpoint) =====`);
  console.log(`⚠️  Note: If frontend also calls POST /api/members/uniform, items may already exist and deduction will be skipped`);
  
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Check authentication
    if (!req.user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    const { items } = req.body;

    // Validate request body
    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: 'Items array is required and must not be empty' 
      });
    }

    // Validate each item
    for (const item of items) {
      if (!item.category || !item.type || item.quantity === undefined) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ 
          success: false, 
          message: 'Each item must have: category, type, and quantity. Size is optional.' 
        });
      }
      if (typeof item.quantity !== 'number' || item.quantity < 1) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ 
          success: false, 
          message: 'Quantity must be a number >= 1' 
        });
      }
    }

    const errors: any[] = [];
    const deducted: any[] = [];
    const inventoryUpdates: Array<{ 
      item: any; 
      inventoryItem: import('../models/uniformModel').IUniformInventory & mongoose.Document; 
      deduction: number 
    }> = [];

    // Fetch existing uniform to calculate net change
    const uniform = await MemberUniform.findOne({ sispaId: req.user.sispaId }).session(session) || null;

    // Step 1: Validate all items and check stock availability
    for (const item of items) {
      // Skip inventory check for custom-ordered items (e.g., Nametag)
      if (isCustomOrderedItem(item.type)) {
        console.log(`⏭️  Skipping inventory deduction for custom-ordered item: ${item.type}`);
        continue; // Skip this item - no inventory deduction needed
      }
      // Find matching inventory item
      const inventoryItem = await findInventoryItem(
        item.category,
        item.type,
        item.size, // Pass original size, not normalized
        session
      );
     
      const normalizedSize = normalizeSize(item.size);

      if (!inventoryItem) {
        errors.push({
          category: item.category,
          type: item.type,
          size: normalizedSize,
          message: 'Item not found in inventory'
        });
        continue;
      }
      
      // 🔹 FIND EXISTING USER UNIFORM ITEM (FOR UPDATE CASE)
      const existingItem = uniform?.items.find(
        (u: any) =>
          u.category === item.category &&
          u.type === item.type &&
          normalizeSize(u.size) === normalizedSize
      );

       // 🔁 FIND OLD ITEM WITH SAME CATEGORY & TYPE BUT DIFFERENT SIZE
       const oldItemDifferentSize = uniform?.items.find(
         u =>
           u.category === item.category &&
           u.type === item.type &&
           normalizeSize(u.size) !== normalizedSize
       );

      // 🔹 CALCULATE NET CHANGE (FIX)
      // If there's a size change, we need to handle it differently
      let previousQty = existingItem ? existingItem.quantity : 0;
      
      // If changing size, the old item quantity should be considered
      if (oldItemDifferentSize && !existingItem) {
        // Size change: old size exists, new size doesn't
        // We'll return old quantity to inventory, so deduction is full new quantity
        previousQty = 0;
      } else if (oldItemDifferentSize && existingItem) {
        // Both old and new sizes exist - this shouldn't happen normally, but handle it
        // Deduction is the difference between new and existing new size quantity
        previousQty = existingItem.quantity;
      }
      
      const deduction = item.quantity - previousQty;
      
      if (deduction > 0 && inventoryItem.quantity < deduction) {
        errors.push({
          category: item.category,
          type: item.type,
          size: normalizedSize,
          requested: deduction,
          available: inventoryItem.quantity,
          message: 'Insufficient stock'
        });
      }

      if (oldItemDifferentSize && uniform) {
        const oldInventoryItem = await findInventoryItem(
          oldItemDifferentSize.category,
          oldItemDifferentSize.type,
          oldItemDifferentSize.size,
          session
        );
      
        if (oldInventoryItem) {
          // Return old quantity to inventory
          oldInventoryItem.quantity += oldItemDifferentSize.quantity;
          await oldInventoryItem.save({ session });
          console.log(`✅ Returned ${oldItemDifferentSize.quantity} to inventory: ${oldItemDifferentSize.type} (${oldItemDifferentSize.size || 'no size'})`);
        }
      
        // Remove old item from uniform (will be replaced with new size in Step 3)
        uniform.items = uniform.items.filter(
          u => u !== oldItemDifferentSize
        );
        console.log(`🔄 Removed old size item: ${oldItemDifferentSize.type} (${oldItemDifferentSize.size || 'no size'})`);
      }
      
      // Only add to inventoryUpdates if there's actually a deduction needed
      if (deduction > 0) {
        inventoryUpdates.push({
          item,
          inventoryItem,
          deduction: deduction
        });
      } else if (deduction < 0) {
        // Quantity decreased - return the difference to inventory
        const returnAmount = Math.abs(deduction);
        if (inventoryItem) {
          inventoryUpdates.push({
            item,
            inventoryItem,
            deduction: deduction // Negative deduction means we're returning to inventory
          });
          console.log(`ℹ️  Quantity decreased for ${item.type} (${normalizedSize || 'no size'}): returning ${returnAmount} to inventory`);
        }
      } else {
        // No change in quantity (deduction = 0)
        // This happens when item already exists in user's uniform with the same quantity
        console.log(`ℹ️  No quantity change for ${item.type} (${normalizedSize || 'no size'}): ${item.quantity} (item already exists in uniform)`);
      }
    }

    // If any errors, rollback and return
    if (errors.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: errors.some(e => e.message.includes('Insufficient stock')) 
          ? 'Insufficient stock for some items'
          : 'Some items not found in inventory',
        errors
      });
    }

    // Step 2: Deduct inventory for all items (all or nothing)
    for (const update of inventoryUpdates) {
      // Handle both positive (deduction) and negative (return) deductions
      const newQuantity = update.inventoryItem.quantity - update.deduction;
      const newStatus = calculateStockStatus(newQuantity);

      await UniformInventory.findByIdAndUpdate(
        update.inventoryItem._id,
        { 
          $inc: { quantity: -update.deduction }, // Negative deduction means adding back
          status: newStatus
        },
        { session }
      );

      deducted.push({
        category: update.item.category,
        type: update.item.type,
        size: normalizeSize(update.item.size),
        quantityDeducted: update.deduction,
        remainingStock: newQuantity
      });

      console.log(`Deducted ${update.deduction} from inventory: ${update.item.type} (${normalizeSize(update.item.size) || 'no size'}) - Remaining: ${newQuantity}`);
    }

    // Step 3: Update user's uniform collection
    if (uniform) {
      // Update or add items to uniform
      for (const item of items) {
        if (isCustomOrderedItem(item.type)) {
          continue; // Skip custom-ordered items
        }

        const normalizedSize = normalizeSize(item.size);
        const existingItemIndex = uniform.items.findIndex(
          (u: any) =>
            u.category === item.category &&
            u.type === item.type &&
            normalizeSize(u.size) === normalizedSize
        );

        if (existingItemIndex >= 0) {
          // Update existing item quantity
          uniform.items[existingItemIndex].quantity = item.quantity;
        } else {
          // Add new item
          uniform.items.push({
            category: item.category,
            type: item.type,
            size: item.size,
            quantity: item.quantity
          });
        }
      }
      await uniform.save({ session });
    } else {
      // Create new uniform if it doesn't exist
      const uniformItems = items.filter(item => !isCustomOrderedItem(item.type));
      if (uniformItems.length > 0) {
        const newUniform = new MemberUniform({
          sispaId: req.user.sispaId,
          items: uniformItems
        });
        await newUniform.save({ session });
      }
    }

    // Commit transaction
    if (session.inTransaction()) {
      await session.commitTransaction();
    }
    session.endSession();
    

    res.json({
      success: true,
      message: 'Inventory deducted successfully',
      deducted
    });
  } catch (error: any) {
    // Rollback transaction on error
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    
    console.error('❌ Error deducting inventory:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    return res.status(500).json({ 
      success: false, 
      message: 'Error deducting inventory', 
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
};

// ===============================
// ADMIN ROUTES - INVENTORY MANAGEMENT
// ===============================

export const getUniforms = async (req: Request, res: Response) => {
  try {
    console.log('📦 Fetching inventory items...');
    
    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      console.error('❌ Database not connected');
      return res.status(503).json({ 
        success: false, 
        message: 'Database connection not available' 
      });
    }
    
    // Explicitly select all fields including image and sizeChart
    const inventory = await UniformInventory.find()
      .select('name category type size quantity status recommendedStock lastRecommendationDate image sizeChart createdAt updatedAt')
      .sort({ category: 1, type: 1, size: 1 });
    
    console.log(`✅ Found ${inventory.length} inventory items`);
    
    // Format response to match spec
    // Build maps of images and size charts by category-type for efficient lookup
    // Use normalized categories for consistency
    const imageMap = new Map<string, string | null>();
    const sizeChartMap = new Map<string, string | null>();
    
    // First pass: collect images from all items (using both original and normalized keys)
    inventory.forEach(item => {
      // Normalize category and type for key lookup
      const normalizedType = normalizeTypeName(item.category, item.type);
      const normalizedCategory = normalizeCategoryForStorage(item.category, normalizedType);
      const normalizedKey = `${normalizedCategory}-${normalizedType}`;
      
      // Also create key with original category/type for backward compatibility
      const originalKey = `${item.category}-${item.type}`;
      
      // Store image in map using normalized key
      if (item.image && !imageMap.has(normalizedKey)) {
        imageMap.set(normalizedKey, item.image);
        console.log(`📸 Found image for ${normalizedKey}: length=${item.image.length}`);
      }
      
      // Also store with original key if different
      if (originalKey !== normalizedKey && item.image && !imageMap.has(originalKey)) {
        imageMap.set(originalKey, item.image);
      }
      
      // Store sizeChart in map
      if (item.sizeChart && !sizeChartMap.has(normalizedKey)) {
        sizeChartMap.set(normalizedKey, item.sizeChart);
      }
      if (originalKey !== normalizedKey && item.sizeChart && !sizeChartMap.has(originalKey)) {
        sizeChartMap.set(originalKey, item.sizeChart);
      }
    });
    
    console.log(`📸 Image map contains ${imageMap.size} entries`);

    const formattedInventory = inventory.map(item => {
      const itemDoc = item as any;
      // Normalize category and type for response (ensure accessories are in correct categories)
      const normalizedType = normalizeTypeName(item.category, item.type);
      const normalizedCategory = normalizeCategoryForStorage(item.category, normalizedType);
      const chartKey = `${normalizedCategory}-${normalizedType}`;
      
      // Get image: prefer item's own image, then try map lookup, then null
      let itemImage = item.image || null;
      if (!itemImage) {
        itemImage = imageMap.get(chartKey) || null;
      }
      
      // Get sizeChart: prefer item's own sizeChart, then try map lookup, then null
      let itemSizeChart = item.sizeChart || null;
      if (!itemSizeChart) {
        itemSizeChart = sizeChartMap.get(chartKey) || null;
      }
      
      return {
        id: String(itemDoc._id),
        name: item.name || item.type, // Fallback to type if name missing
        category: normalizedCategory, // Return normalized category
        type: normalizedType, // Return normalized type
        size: item.size,
        quantity: item.quantity || 0, // Default to 0 if missing
        status: item.status || calculateStockStatus(item.quantity || 0),
        image: itemImage, // Include image field
        sizeChart: itemSizeChart, // Include sizeChart field
        createdAt: itemDoc.createdAt,
        updatedAt: itemDoc.updatedAt
      };
    });

    console.log(`✅ Returning ${formattedInventory.length} formatted items`);

    res.json({ 
      success: true, 
      inventory: formattedInventory,
      count: formattedInventory.length
    });
  } catch (error: any) {
    console.error('❌ Error fetching inventory:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching inventory', 
      error: error.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const addUniform = async (req: Request, res: Response) => {
  try {
    const { id, name, category, type, size, quantity, image, sizeChart } = req.body;
    
    // If ID is provided, treat this as an update request
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      if (quantity === undefined) {
      return res.status(400).json({ 
        success: false, 
          message: 'Quantity is required for update' 
      });
    }

      if (typeof quantity !== 'number' || quantity < 0) {
      return res.status(400).json({ 
        success: false, 
          message: 'Quantity must be a number >= 0' 
        });
      }
      
      const status = calculateStockStatus(quantity);
      const updated = await UniformInventory.findByIdAndUpdate(
        id, 
        { quantity, status }, 
        { new: true, runValidators: true }
      );
      
      if (!updated) {
        return res.status(404).json({ 
          success: false, 
          message: 'Inventory item not found' 
      });
    }

      const updatedDoc = updated as any;
      return res.json({
        success: true,
        message: 'Inventory item quantity updated successfully',
        inventory: {
          id: String(updatedDoc._id),
          name: updated.name,
          category: updated.category,
          type: updated.type,
          size: updated.size,
          quantity: updated.quantity,
          status: updated.status,
          image: updated.image || null, // Include image in response
          sizeChart: updated.sizeChart || null, // Include sizeChart in response
          createdAt: updatedDoc.createdAt,
          updatedAt: updatedDoc.updatedAt
        }
      });
    }
    
    // Otherwise, treat as create request
    // Validate required fields (name is optional, will be auto-generated from type)
    if (!category || !type || quantity === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: category, type, and quantity are required (or provide id for update)' 
      });
    }
    
    // Auto-generate name from type if not provided
    const itemName = name || type;

    // CRITICAL: Normalize category and type before validation and storage
    // This handles backward compatibility and ensures correct category structure
    const normalizedType = normalizeTypeName(category, type);
    const normalizedCategory = normalizeCategoryForStorage(category, normalizedType);
    
    console.log(`📋 Category normalization: "${category}" + "${type}" → "${normalizedCategory}" + "${normalizedType}"`);

    // Validate category (check both original and normalized)
    if (!isValidCategory(normalizedCategory) && !isValidCategory(category)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid category "${category}". Must be one of: Uniform No 3, Uniform No 4, Accessories No 3, Accessories No 4, Shirt (or T-Shirt for backward compatibility)` 
      });
    }

    // Validate type - now allows any type string (supports custom types)
    // Use normalized category and type for validation
    if (!isValidType(normalizedCategory, normalizedType)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid type. Type must be a non-empty string.` 
      });
    }

    // Validate size: flexible validation for custom types
    // For predefined types: enforce size requirements
    // For custom types: allow size if provided, allow null if not provided
    // Use normalized category and type for validation
    const isPredefinedType = VALID_TYPES[normalizedCategory]?.some(t => {
      const normalizedInput = normalizeTypeForMatching(normalizedType);
      const normalizedPredefined = normalizeTypeForMatching(t);
      return normalizedInput === normalizedPredefined;
    });
    
    if (isPredefinedType) {
      // For predefined types, use strict validation
      // Use normalized category and type
      if (requiresSize(normalizedCategory, normalizedType)) {
      if (!size) {
        return res.status(400).json({ 
          success: false, 
          message: `Size is required for ${type}` 
        });
      }
    } else {
        // For predefined accessories, size should be null
      if (size !== null && size !== undefined) {
        return res.status(400).json({ 
          success: false, 
          message: `${type} is an accessory and should not have a size. Set size to null.` 
          });
        }
      }
    } else {
      // For custom types: allow size if provided, allow null if not provided
      // Frontend decides whether custom type needs size
      // No strict validation - just ensure format is correct if size is provided
      if (size !== null && size !== undefined && typeof size !== 'string') {
        return res.status(400).json({ 
          success: false, 
          message: 'Size must be a string or null' 
        });
      }
    }

    // Validate quantity
    if (typeof quantity !== 'number' || quantity < 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Quantity must be a number >= 0' 
      });
    }

    // Validate image format if provided
    if (image !== undefined && image !== null && image !== '') {
      const imageValidation = validateBase64Image(image);
      if (!imageValidation.valid) {
        return res.status(400).json({ 
          success: false, 
          message: imageValidation.error || 'Invalid image format'
        });
      }
    }

    // Validate sizeChart format if provided
    if (sizeChart !== undefined && sizeChart !== null && sizeChart !== '') {
      const sizeChartValidation = validateBase64Image(sizeChart);
      if (!sizeChartValidation.valid) {
        return res.status(400).json({ 
          success: false, 
          message: sizeChartValidation.error || 'Invalid size chart format'
        });
      }
    }

    // Normalize size format (remove "UK" prefix for shoes/boots)
    // Use normalized type for size normalization
    let normalizedSize: string | null = null;
    if (requiresSize(normalizedCategory, normalizedType)) {
      if (!size) {
        return res.status(400).json({ 
          success: false, 
          message: `Size is required for ${normalizedType}` 
        });
      }
      
      // Normalize size: remove "UK" prefix for shoes/boots (case-insensitive)
      const sizeStr = String(size).trim();
      const isShoeOrBoot = normalizedType.toLowerCase().includes('shoe') || 
                          normalizedType.toLowerCase().includes('boot') ||
                          normalizedType.toLowerCase() === 'pvc shoes';
      
      if (isShoeOrBoot) {
        // Remove "UK" prefix (case-insensitive, with or without space)
        normalizedSize = sizeStr.replace(/^uk\s*/i, '').trim();
        if (!normalizedSize) {
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid size format. Size cannot be empty after removing "UK" prefix.' 
          });
        }
      } else {
        // For other items, keep as-is but trim
        normalizedSize = sizeStr;
      }
    } else {
      // For accessories, size should be null
      normalizedSize = null;
    }
    
    // Check if item with same (category, type, size) already exists
    // For "Add Size" functionality, we want to prevent duplicates
    // Use normalized category and type for checking (but also check original for backward compatibility)
    const existingItem = await UniformInventory.findOne({
      $or: [
        // Check with normalized category/type
        { category: normalizedCategory, type: normalizedType, size: normalizedSize },
        // Also check with original category/type for backward compatibility
        { category: category, type: type, size: normalizedSize },
        { category: category, type: normalizedType, size: normalizedSize },
        // Check original size too
        ...(size && size !== normalizedSize ? [
          { category: normalizedCategory, type: normalizedType, size: size },
          { category: category, type: type, size: size }
        ] : [])
      ]
    });

    if (existingItem) {
      // Size already exists - return error (don't add to quantity)
      // Display the original size input for better error message
      const sizeDisplay = size || normalizedSize || 'no size';
      return res.status(400).json({ 
        success: false, 
        message: `Size '${sizeDisplay}' already exists for this item type` 
      });
    }

    // Get image from existing items of the same type if not provided
    // This ensures consistency - all sizes of the same type share the same image
    // Check both normalized and original category/type
    let finalImage = image || null;
    if (!finalImage) {
      const existingTypeItemForImage = await UniformInventory.findOne({
        $or: [
          { category: normalizedCategory, type: normalizedType },
          { category: category, type: type },
          { category: normalizedCategory, type: type }
        ]
      });
      if (existingTypeItemForImage && existingTypeItemForImage.image) {
        finalImage = existingTypeItemForImage.image;
      }
    }

    // Get sizeChart from existing items of the same type if not provided
    // This ensures consistency - all sizes of the same type share the same sizeChart
    // Check both normalized and original category/type
    let finalSizeChart = sizeChart || null;
    if (!finalSizeChart) {
      const existingTypeItem = await UniformInventory.findOne({
        $or: [
          { category: normalizedCategory, type: normalizedType },
          { category: category, type: type },
          { category: normalizedCategory, type: type }
        ]
      });
      if (existingTypeItem && existingTypeItem.sizeChart) {
        finalSizeChart = existingTypeItem.sizeChart;
      }
    }

    // Create new item with normalized category and type
    const newInventory = new UniformInventory({
      name: itemName, // Use auto-generated name
      category: normalizedCategory, // Store normalized category
      type: normalizedType, // Store normalized type
      size: normalizedSize,
      quantity,
      status: calculateStockStatus(quantity),
      image: finalImage, // Include image field
      sizeChart: finalSizeChart // Include sizeChart field
    });
    
    await newInventory.save();
    console.log(`✅ Created inventory item: ${normalizedCategory} / ${normalizedType} / ${normalizedSize || 'no size'}`);
    
    // If image was provided and different from existing, update all items of this type
    // Use normalized category/type for update
    if (image && image !== finalImage) {
      await UniformInventory.updateMany(
        {
          $or: [
            { category: normalizedCategory, type: normalizedType },
            { category: category, type: type } // Also update old category/type entries
          ],
          image: { $ne: image }
        },
        { $set: { image: image } }
      );
      console.log(`✅ Updated image for all items of type: ${normalizedCategory} - ${normalizedType}`);
    }

    // If sizeChart was provided and different from existing, update all items of this type
    // Use normalized category/type for update
    if (sizeChart && sizeChart !== finalSizeChart) {
      await UniformInventory.updateMany(
        {
          $or: [
            { category: normalizedCategory, type: normalizedType },
            { category: category, type: type } // Also update old category/type entries
          ],
          sizeChart: { $ne: sizeChart }
        },
        { $set: { sizeChart: sizeChart } }
      );
      console.log(`✅ Updated sizeChart for all items of type: ${normalizedCategory} - ${normalizedType}`);
    }
    
    const newDoc = newInventory as any;
    res.status(201).json({ 
      success: true, 
      message: 'Inventory item created successfully', 
      item: {
        id: String(newDoc._id),
        image: newInventory.image || null, // Include image in response
        name: newInventory.name,
        category: newInventory.category, // Return normalized category
        type: newInventory.type, // Return normalized type
        size: newInventory.size,
        quantity: newInventory.quantity,
        status: newInventory.status,
        sizeChart: newInventory.sizeChart || null, // Include sizeChart in response
        createdAt: newDoc.createdAt,
        updatedAt: newDoc.updatedAt
      }
    });
  } catch (error: any) {
    console.error('Error adding inventory:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'An inventory item with the same category, type, and size already exists. Use PUT to update quantity.' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error adding inventory', 
      error: error.message 
    });
  }
};

export const updateUniform = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { quantity, category, type, size, image, sizeChart } = req.body;

    // Support two update modes:
    // 1. Update by ID with quantity/image/sizeChart (partial updates allowed)
    // 2. Update by ID with category/type/size to find item (if ID is invalid or not provided)
    
    // If ID is provided and valid, use it
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      // Validate image format if provided
      if (image !== undefined && image !== null && image !== '') {
        const imageValidation = validateBase64Image(image);
        if (!imageValidation.valid) {
          return res.status(400).json({ 
            success: false, 
            message: imageValidation.error || 'Invalid image format'
          });
        }
      }

      // Validate sizeChart format if provided
      if (sizeChart !== undefined && sizeChart !== null && sizeChart !== '') {
        const sizeChartValidation = validateBase64Image(sizeChart);
        if (!sizeChartValidation.valid) {
          return res.status(400).json({ 
            success: false, 
            message: sizeChartValidation.error || 'Invalid size chart format'
          });
        }
      }

      // Build update object - allow partial updates (image/sizeChart without quantity)
      const updateData: any = {};
      
      // Update quantity and status if provided
      if (quantity !== undefined) {
        if (typeof quantity !== 'number' || quantity < 0) {
          return res.status(400).json({ 
            success: false, 
            message: 'Quantity must be a number >= 0' 
          });
        }
        updateData.quantity = quantity;
        updateData.status = calculateStockStatus(quantity);
      }

      // Update image if provided
      if (image !== undefined) {
        updateData.image = image === '' || image === null ? null : image;
      }

      // Update sizeChart if provided
      if (sizeChart !== undefined) {
        updateData.sizeChart = sizeChart === '' || sizeChart === null ? null : sizeChart;
      }

      // Check if there's anything to update
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'No fields provided to update. Provide at least one of: quantity, image, or sizeChart' 
        });
      }

    const updated = await UniformInventory.findByIdAndUpdate(
      id, 
        updateData, 
      { new: true, runValidators: true }
    ).select('name category type size quantity status recommendedStock lastRecommendationDate image sizeChart createdAt updatedAt');
      
      // If image was updated, update all items of the same type for consistency
      // Use both original and normalized category/type to catch all items
      if (image !== undefined && updated) {
        const normalizedType = normalizeTypeName(updated.category, updated.type);
        const normalizedCategory = normalizeCategoryForStorage(updated.category, normalizedType);
        const imageValue = image === '' || image === null ? null : image;
        
        // Update all items matching either original or normalized category/type
        const updateResult = await UniformInventory.updateMany(
          {
            $or: [
              { category: updated.category, type: updated.type },
              { category: normalizedCategory, type: normalizedType }
            ],
            _id: { $ne: id }
          },
          { $set: { image: imageValue } }
        );
        console.log(`✅ Updated image for ${updateResult.modifiedCount} items of type: ${updated.category} - ${updated.type} (normalized: ${normalizedCategory} - ${normalizedType})`);
      }

      // If sizeChart was updated, update all items of the same type for consistency
      // Use both original and normalized category/type to catch all items
      if (sizeChart !== undefined && updated) {
        const normalizedType = normalizeTypeName(updated.category, updated.type);
        const normalizedCategory = normalizeCategoryForStorage(updated.category, normalizedType);
        const sizeChartValue = sizeChart === '' || sizeChart === null ? null : sizeChart;
        
        // Update all items matching either original or normalized category/type
        const updateResult = await UniformInventory.updateMany(
          {
            $or: [
              { category: updated.category, type: updated.type },
              { category: normalizedCategory, type: normalizedType }
            ],
            _id: { $ne: id }
          },
          { $set: { sizeChart: sizeChartValue } }
        );
        console.log(`✅ Updated sizeChart for ${updateResult.modifiedCount} items of type: ${updated.category} - ${updated.type} (normalized: ${normalizedCategory} - ${normalizedType})`);
      }

    if (!updated) {
      return res.status(404).json({ 
        success: false, 
        message: 'Inventory item not found' 
      });
    }

      const updateFields = Object.keys(updateData).join(', ');
      console.log(`✅ Updated inventory item: ${updated.type} (${updated.size || 'no size'}) - Fields: ${updateFields}`);
      
      // Log image status for debugging
      if (image !== undefined) {
        const imageLength = updated.image ? updated.image.length : 0;
        const imagePreview = updated.image ? updated.image.substring(0, 50) + '...' : 'null';
        console.log(`📸 Image saved: length=${imageLength}, preview=${imagePreview}`);
      }

    const updatedDoc = updated as any;
      return res.json({ 
      success: true, 
      message: 'Inventory item updated successfully', 
      item: {
        id: String(updatedDoc._id),
        name: updated.name,
        category: updated.category,
        type: updated.type,
        size: updated.size,
        quantity: updated.quantity,
        status: updated.status,
        image: updated.image || null, // Include image in response
        sizeChart: updated.sizeChart || null, // Include sizeChart in response
        createdAt: updatedDoc.createdAt,
        updatedAt: updatedDoc.updatedAt
      }
      });
    }
    
    // If ID is not valid, try to find by category/type/size
    if (category && type) {
      // Validate image format if provided
      if (image !== undefined && image !== null && image !== '') {
        const imageValidation = validateBase64Image(image);
        if (!imageValidation.valid) {
          return res.status(400).json({ 
            success: false, 
            message: imageValidation.error || 'Invalid image format'
          });
        }
      }

      // Validate sizeChart format if provided
      if (sizeChart !== undefined && sizeChart !== null && sizeChart !== '') {
        const sizeChartValidation = validateBase64Image(sizeChart);
        if (!sizeChartValidation.valid) {
          return res.status(400).json({ 
            success: false, 
            message: sizeChartValidation.error || 'Invalid size chart format'
          });
        }
      }

      const normalizedSize = normalizeSize(size);
      
      const item = await UniformInventory.findOne({
        category: { $regex: new RegExp(`^${String(category).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        type: { $regex: new RegExp(`^${String(type).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        size: normalizedSize
      });
      
      if (!item) {
        return res.status(404).json({ 
          success: false, 
          message: `Inventory item not found: ${category} / ${type} / ${size || 'no size'}` 
        });
      }
      
      // Update quantity and status if provided
      if (quantity !== undefined) {
        if (typeof quantity !== 'number' || quantity < 0) {
          return res.status(400).json({ 
            success: false, 
            message: 'Quantity must be a number >= 0' 
          });
        }
        item.quantity = quantity;
        item.status = calculateStockStatus(quantity);
      }

      // Update image if provided
      if (image !== undefined) {
        item.image = image === '' || image === null ? null : image;
      }

      // Update sizeChart if provided
      if (sizeChart !== undefined) {
        item.sizeChart = sizeChart === '' || sizeChart === null ? null : sizeChart;
      }

      // Check if there's anything to update
      if (quantity === undefined && image === undefined && sizeChart === undefined) {
        return res.status(400).json({ 
          success: false, 
          message: 'No fields provided to update. Provide at least one of: quantity, image, or sizeChart' 
        });
      }
      
      await item.save();
      
      // If image was updated, update all items of the same type for consistency
      if (image !== undefined) {
        await UniformInventory.updateMany(
          { category: item.category, type: item.type, _id: { $ne: item._id } },
          { $set: { image: image === '' || image === null ? null : image } }
        );
        console.log(`✅ Updated image for all items of type: ${item.category} - ${item.type}`);
      }

      // If sizeChart was updated, update all items of the same type for consistency
      if (sizeChart !== undefined) {
        await UniformInventory.updateMany(
          { category: item.category, type: item.type, _id: { $ne: item._id } },
          { $set: { sizeChart: sizeChart === '' || sizeChart === null ? null : sizeChart } }
        );
        console.log(`✅ Updated sizeChart for all items of type: ${item.category} - ${item.type}`);
      }
      
      const itemDoc = item as any;
      return res.json({ 
        success: true, 
        message: 'Inventory item updated successfully', 
        item: {
          id: String(itemDoc._id),
          name: item.name,
          category: item.category,
          type: item.type,
          size: item.size,
          quantity: item.quantity,
          status: item.status,
          image: item.image || null, // Include image in response
          sizeChart: item.sizeChart || null, // Include sizeChart in response
          createdAt: itemDoc.createdAt,
          updatedAt: itemDoc.updatedAt
        }
      });
    }
    
    // If neither ID nor category/type provided, return error
    return res.status(400).json({ 
      success: false, 
      message: 'Either valid ID or (category, type, size) is required for update' 
    });
  } catch (error: any) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating inventory', 
      error: error.message 
    });
  }
};

export const deleteUniform = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️ Delete request by ID:', id);
    
    // Validate ID format
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      console.log('❌ Invalid ID format:', id);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid inventory item ID' 
      });
    }
    
    // Try to find the item first for better error messages
    const item = await UniformInventory.findById(id);
    if (!item) {
      // Item doesn't exist - return 404 gracefully (frontend may call DELETE on items that were already deleted)
      console.log(`ℹ️ Item not found with ID: ${id} - returning 404 gracefully`);
      return res.status(404).json({ 
        success: false, 
        message: 'Inventory item not found' 
      });
    }
    
    console.log(`✅ Found item to delete: ${item.type} (${item.size || 'no size'}) - Category: ${item.category}`);
    
    // Delete the item permanently from database
    await UniformInventory.findByIdAndDelete(id);
    
    console.log(`✅ Deleted inventory item: ${item.type} (${item.size || 'no size'}) - ID: ${id}`);
    
    res.json({ 
      success: true, 
      message: 'Inventory item deleted successfully'
    });
  } catch (error: any) {
    console.error('❌ Error deleting inventory:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting inventory item', 
      error: error.message 
    });
  }
};

// Delete inventory item by category, type, and size (alternative to ID-based delete)
export const deleteUniformByAttributes = async (req: Request, res: Response) => {
  try {
    const { category, type, size } = req.body;
    
    console.log('🗑️ Delete request received:', { category, type, size });
    
    if (!category || !type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Category and type are required' 
      });
    }

    // Normalize size for matching - use same logic as add endpoint
    // For shoes/boots: remove "UK" prefix, for others: keep as-is
    let normalizedSize: string | null = null;
    if (size !== null && size !== undefined && size !== '') {
      const sizeStr = String(size).trim();
      const isShoeOrBoot = type.toLowerCase().includes('shoe') || 
                          type.toLowerCase().includes('boot') ||
                          type.toLowerCase() === 'pvc shoes';
      
      if (isShoeOrBoot) {
        // Remove "UK" prefix (case-insensitive, with or without space)
        normalizedSize = sizeStr.replace(/^uk\s*/i, '').trim();
        console.log(`🔍 Size normalization (shoe/boot): "${sizeStr}" → "${normalizedSize}"`);
      } else {
        // For other items, keep as-is but trim
        normalizedSize = sizeStr;
        console.log(`🔍 Size normalization (other): "${sizeStr}" → "${normalizedSize}"`);
      }
    } else {
      normalizedSize = null;
    }
    
    // Build query for category and type (case-insensitive)
    const query: any = {
      category: { $regex: new RegExp(`^${String(category).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      type: { $regex: new RegExp(`^${String(type).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    };

    // Find all items matching category and type
    const allItems = await UniformInventory.find({
      category: query.category,
      type: query.type
    });

    console.log(`📦 Found ${allItems.length} items for category "${category}" and type "${type}"`);
    console.log('Available sizes:', allItems.map(i => i.size));

    if (allItems.length === 0) {
      // Item doesn't exist - return 404 gracefully (frontend may call DELETE on predefined sizes that were never saved)
      console.log(`ℹ️ No items found for category "${category}" and type "${type}" - returning 404 gracefully`);
      return res.status(404).json({ 
        success: false, 
        message: 'Inventory item not found' 
      });
    }

    // Find matching item by size - use multiple matching strategies
    let itemToDelete = null;
    
    if (normalizedSize === null) {
      // Looking for item with null/empty size (accessories)
      itemToDelete = allItems.find(item => 
        !item.size || 
        item.size === null || 
        item.size.trim() === '' ||
        item.size.toLowerCase() === 'n/a'
      );
    } else {
      // Match by size using multiple strategies
      itemToDelete = allItems.find(item => {
        if (!item.size) return false;
        
        const itemSize = String(item.size).trim();
        
        // Strategy 1: Exact match with normalized size
        if (itemSize === normalizedSize) {
          console.log(`✅ Exact match: "${itemSize}" === "${normalizedSize}"`);
          return true;
        }
        
        // Strategy 2: For shoes/boots, also check if item size matches after removing UK prefix
        const isShoeOrBoot = type.toLowerCase().includes('shoe') || 
                            type.toLowerCase().includes('boot') ||
                            type.toLowerCase() === 'pvc shoes';
        if (isShoeOrBoot) {
          const itemWithoutUK = itemSize.replace(/^uk\s*/i, '').trim();
          if (itemWithoutUK === normalizedSize) {
            console.log(`✅ Match after removing UK: "${itemSize}" → "${itemWithoutUK}" === "${normalizedSize}"`);
            return true;
          }
        }
        
        // Strategy 3: Case-insensitive match
        if (itemSize.toLowerCase() === normalizedSize.toLowerCase()) {
          console.log(`✅ Case-insensitive match: "${itemSize}" === "${normalizedSize}"`);
          return true;
        }
        
        // Strategy 4: Extract numeric part and compare (for shoes/boots)
        if (isShoeOrBoot) {
          const itemNumeric = extractNumericSize(itemSize);
          const searchNumeric = extractNumericSize(normalizedSize);
          if (itemNumeric && searchNumeric && itemNumeric === searchNumeric) {
            console.log(`✅ Numeric match: "${itemSize}" (${itemNumeric}) === "${normalizedSize}" (${searchNumeric})`);
            return true;
          }
        }
        
        // Strategy 5: Try matching with spaces removed (handles "X L" vs "XL")
        const itemNoSpaces = itemSize.replace(/\s+/g, '').toUpperCase();
        const searchNoSpaces = normalizedSize.replace(/\s+/g, '').toUpperCase();
        if (itemNoSpaces === searchNoSpaces) {
          console.log(`✅ No-spaces match: "${itemSize}" → "${itemNoSpaces}" === "${searchNoSpaces}"`);
          return true;
        }
        
        // Strategy 6: Direct comparison with original input size (in case normalization changed it)
        if (size && itemSize === String(size).trim()) {
          console.log(`✅ Direct match with original: "${itemSize}" === "${size}"`);
          return true;
        }
        
        return false;
      });
    }

    if (!itemToDelete) {
      // Item doesn't exist - return 404 gracefully (frontend may call DELETE on predefined sizes that were never saved)
      const sizeDisplay = size || 'no size';
      console.log(`ℹ️ Size not found. Searched for: "${normalizedSize}", Available sizes:`, allItems.map(i => i.size));
      console.log(`ℹ️ Returning 404 gracefully - frontend will handle display update`);
      return res.status(404).json({ 
        success: false, 
        message: 'Inventory item not found' 
      });
    }

    console.log(`✅ Found item to delete: ${itemToDelete.type} (${itemToDelete.size || 'no size'}) - ID: ${itemToDelete._id}`);

    // Delete the item permanently
    await UniformInventory.findByIdAndDelete(itemToDelete._id);
    
    console.log(`✅ Deleted inventory item by attributes: ${itemToDelete.type} (${itemToDelete.size || 'no size'})`);

    res.json({ 
      success: true, 
      message: 'Inventory item deleted successfully'
    });
  } catch (error: any) {
    console.error('❌ Error deleting inventory by attributes:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting inventory item', 
      error: error.message 
    });
  }
};

// Delete all inventory items for a specific type
export const deleteUniformByType = async (req: Request, res: Response) => {
  try {
    const { category, type } = req.params;
    
    if (!category || !type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Category and type are required' 
      });
    }

    const result = await UniformInventory.deleteMany({ 
      category: category,
      type: type 
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No inventory items found for this type' 
      });
    }

    res.json({ 
      success: true, 
      message: 'All inventory items for type deleted successfully',
      deletedCount: result.deletedCount
    });
  } catch (error: any) {
    console.error('Error deleting inventory by type:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting inventory items', 
      error: error.message 
    });
  }
};

// ===============================
// MEMBER-SPECIFIC UNIFORM ENDPOINTS (Multiple Items Support)
// ===============================

// Get member's own uniform collection (all items)
export const getOwnUniform = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user.sispaId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const uniform = await MemberUniform.findOne({ sispaId: req.user.sispaId });
    
    if (!uniform) {
      return res.status(404).json({ 
        success: false, 
        message: 'Uniform not found. Please add your uniform items first.',
        items: []
      });
    }

    // Format items to include status fields
    const formattedItems = formatUniformItemsWithStatus(
      uniform.items,
      uniform.createdAt,
      uniform.updatedAt
    );

    res.json({
      success: true,
      uniform: {
        sispaId: uniform.sispaId,
        items: formattedItems,
        itemCount: formattedItems.length,
        updatedAt: uniform.updatedAt,
        createdAt: uniform.createdAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching uniform', 
      error: error.message 
    });
  }
};

// ===============================
// ADMIN: Get member uniform by sispaId
// ===============================
export const getMemberUniformBySispaId = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    const { sispaId } = req.params;

    if (!sispaId) {
      return res.status(400).json({ 
        success: false, 
        message: 'SISPA ID is required' 
      });
    }

    // Find uniform for the specified member
    const uniform = await MemberUniform.findOne({ sispaId: sispaId.trim() });
    
    if (!uniform) {
      return res.status(404).json({ 
        success: false, 
        message: 'Uniform not found for this member',
        items: []
      });
    }

    // Log raw items from database for debugging
    console.log(`📋 Raw items from database for ${sispaId}:`, uniform.items.map((i: any) => 
      `${i.category}/${i.type}/${i.size || 'no size'}`).join(', '));
    console.log(`📋 Items by category:`, uniform.items.reduce((acc: any, item: any) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {}));

    // Format items to include status fields
    // Items in the uniform collection are considered "Available" (they've been issued/received)
    const formattedItems = formatUniformItemsWithStatus(
      uniform.items,
      uniform.createdAt,
      uniform.updatedAt
    );
    
    // Log formatted items for debugging
    console.log(`📋 Formatted items for ${sispaId}:`, formattedItems.map((i: any) => 
      `${i.category}/${i.type}/${i.size || 'no size'}`).join(', '));
    console.log(`📋 Formatted items by category:`, formattedItems.reduce((acc: any, item: any) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {}));

    res.json({
      success: true,
      uniform: {
        sispaId: uniform.sispaId,
        items: formattedItems,
        itemCount: formattedItems.length,
        createdAt: uniform.createdAt,
        updatedAt: uniform.updatedAt
      }
    });
  } catch (error: any) {
    console.error('Error fetching member uniform:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching uniform', 
      error: error.message 
    });
  }
};

// ===============================
// NEW UNIFORM ENDPOINTS FOR /api/members/uniform
// ===============================

// GET /api/members/uniform - Get all uniform items for authenticated member
export const getMemberUniform = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user.sispaId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    const uniform = await MemberUniform.findOne({ sispaId: req.user.sispaId });
    
    if (!uniform) {
      return res.status(404).json({ 
        success: false, 
        message: 'Uniform not found. Please add your uniform items first.',
        items: []
      });
    }

    console.log(`Retrieved uniform collection for ${req.user.sispaId}: ${uniform.items.length} items found`);
    // Count items by normalized categories for better reporting
    const itemsByCategory = uniform.items.reduce((acc: any, item: any) => {
      const normalizedCategory = normalizeCategoryForStorage(item.category, normalizeTypeName(item.category, item.type));
      acc[normalizedCategory] = (acc[normalizedCategory] || 0) + 1;
      return acc;
    }, {});
    
    console.log('Items breakdown (by normalized category):', itemsByCategory);

    // Format items to include status fields
    const formattedItems = formatUniformItemsWithStatus(
      uniform.items,
      uniform.createdAt,
      uniform.updatedAt
    );

    res.json({
      success: true,
      uniform: {
        sispaId: uniform.sispaId,
        items: formattedItems,
        itemCount: formattedItems.length,
        updatedAt: uniform.updatedAt,
        createdAt: uniform.createdAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching uniform', 
      error: error.message 
    });
  }
};

// In-memory cache to prevent duplicate request processing (idempotency)
// Key: userSispaId + itemsHash, Value: { timestamp: number, processing: boolean }
interface RequestCacheEntry {
  timestamp: number;
  processing: boolean;
}
const recentRequests = new Map<string, RequestCacheEntry>();
const REQUEST_DEDUP_WINDOW = 10000; // 10 seconds - prevent duplicate requests within 10 seconds

// Helper function to create a hash of items for deduplication
function hashItems(items: any[]): string {
  const normalized = items
    .map(item =>
      `${String(item.category).trim().toLowerCase()}|` +
      `${String(item.type).trim().toLowerCase()}`
      // ❌ DO NOT INCLUDE SIZE
    )
    .sort()
    .join('::');
  return normalized;
}


// POST /api/members/uniform - Create/add uniform items (adds to existing if exists)
export const createMemberUniform = async (req: AuthRequest, res: Response) => {
  // Log the incoming request to debug
  console.log(`\n🔵 ===== CREATE MEMBER UNIFORM REQUEST =====`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Method: ${req.method}`);
  console.log(`Path: ${req.path}`);
  console.log(`User: ${req.user?.sispaId || 'UNKNOWN'}`);
  console.log(`Request Body Keys:`, Object.keys(req.body || {}));
  console.log(`Request items count: ${req.body?.items?.length || 0}`);
  if (req.body?.items) {
    console.log(`Request items:`, req.body.items.map((i: any) => 
      `${i.category || 'NO_CATEGORY'}/${i.type || 'NO_TYPE'}/${i.size || 'no size'}`).join(', '));
    console.log(`Full request body:`, JSON.stringify(req.body, null, 2));
  } else {
    console.log(`⚠️  WARNING: No items array in request body!`);
    console.log(`Full request body:`, JSON.stringify(req.body, null, 2));
  }
  
  // IDEMPOTENCY CHECK: Prevent duplicate requests
  if (!req.user?.sispaId) {
    return res.status(401).json({ 
      success: false, 
      message: 'User not authenticated' 
    });
  }
  
  const items = req.body?.items || [];
  const itemsHash = hashItems(items);
  const requestKey = `${req.user.sispaId}::${itemsHash}`;
  const now = Date.now();
  
  // Check if this exact request was processed recently or is currently being processed
  const cachedRequest = recentRequests.get(requestKey);
  
  if (cachedRequest) {
    const timeSinceRequest = now - cachedRequest.timestamp;
    
    // If request is currently being processed, block immediately
    if (cachedRequest.processing) {
      console.log(`🚫 DUPLICATE REQUEST BLOCKED - Request is currently being processed`);
      console.log(`   User: ${req.user.sispaId}`);
      console.log(`   Request key: ${requestKey}`);
      console.log(`   Items: ${items.map((i: any) => `${i.type} (${i.size || 'no size'})`).join(', ')}`);
      return res.status(200).json({
        success: true,
        message: 'Request is already being processed. Please wait.',
        duplicate: true,
        processing: true
      });
    }
    
    // If request was processed recently (within window), block it
    if (timeSinceRequest < REQUEST_DEDUP_WINDOW) {
      console.log(`⚠️  DUPLICATE REQUEST DETECTED - Blocking duplicate processing`);
      console.log(`   User: ${req.user.sispaId}`);
      console.log(`   Time since last request: ${timeSinceRequest}ms`);
      console.log(`   Request key: ${requestKey}`);
      console.log(`   Items: ${items.map((i: any) => `${i.type} (${i.size || 'no size'})`).join(', ')}`);
      return res.status(200).json({
        success: true,
        message: 'Request already processed. Please wait a moment before trying again.',
        duplicate: true
      });
    }
  }
  
  // Mark this request as being processed (set processing flag to true)
  recentRequests.set(requestKey, { timestamp: now, processing: true });
  
  // Clean up old entries (older than 20 seconds)
  for (const [key, entry] of recentRequests.entries()) {
    if (now - entry.timestamp > 20000) {
      recentRequests.delete(key);
    }
  }
  
  console.log(`✅ Request accepted - Processing (Request key: ${requestKey})`);
  console.log(`   Items: ${items.map((i: any) => `${i.type} (${i.size || 'no size'})`).join(', ')}`);
  
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!req.user || !req.user.sispaId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    const { items } = req.body;

    // Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide an array of uniform items. Each item must have: category, type, size, and quantity.' 
      });
    }

    // Validate each item
    for (const item of items) {
      if (!item.category || !item.type || item.quantity === undefined) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ 
          success: false, 
          message: 'Each uniform item must have: category, type, and quantity. Size is optional for accessories.' 
        });
      }
      if (typeof item.quantity !== 'number' || item.quantity < 1) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ 
          success: false, 
          message: 'Quantity must be a number and at least 1.' 
        });
      }
    }

    // Check if member already has a uniform collection
    let uniform = await MemberUniform.findOne({ sispaId: req.user.sispaId }).session(session);
    
    // Helper function to create a unique key for item comparison
    const getItemKey = (item: any): string => {
      const size = item.size ? String(item.size).trim() : 'NO_SIZE';
      return `${String(item.category).trim().toLowerCase()}::${String(item.type).trim().toLowerCase()}::${size.toLowerCase()}`;
    };
    
    // STRICT: Validate categories FIRST before normalization
    // This ensures we catch invalid categories early and return 400 instead of 500
    for (const item of items) {
      if (!item.category) {
        return res.status(400).json({
          success: false,
          message: `Missing category for item type "${item.type}". Valid categories are: Uniform No 3, Uniform No 4, Accessories No 3, Accessories No 4, Shirt`
        });
      }

      if (!isValidCategory(item.category)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category "${item.category}" for item type "${item.type}". Valid categories are: Uniform No 3, Uniform No 4, Accessories No 3, Accessories No 4, Shirt`
        });
      }

      // STRICT: Check if accessory types are using correct category
      const isAccessory = isAccessoryType(item.type);
      const catLower = item.category.toLowerCase().trim();

      if (isAccessory && !catLower.includes('accessories')) {
        const typeLower = (item.type || '').toLowerCase();
        const accessoryTypesNo3 = ['apulet', 'integrity badge', 'shoulder badge', 'gold badge', 'cel bar', 'beret logo pin', 'belt no 3'];
        const accessoryTypesNo4 = ['apm tag', 'belt no 4'];
        // Nametag can be in BOTH Accessories No 3 and Accessories No 4 - determine by context
        const isNametag = typeLower.includes('nametag') || typeLower.includes('name tag');
        const shouldBeNo3 = accessoryTypesNo3.some(acc => typeLower.includes(acc));
        const shouldBeNo4 = accessoryTypesNo4.some(acc => typeLower.includes(acc));
        
        let correctCategory = 'Accessories No 3';
        if (shouldBeNo4) {
          correctCategory = 'Accessories No 4';
        } else if (shouldBeNo3 && !isNametag) {
          // Non-nametag No 3 accessories
          correctCategory = 'Accessories No 3';
        } else if (isNametag) {
          // Nametag can be in either category - use context (category sent) to determine
          if (catLower.includes('no 4') || catLower.includes('uniform no 4')) {
            correctCategory = 'Accessories No 4';
          } else {
            // Default to No 3 if sent with "Uniform No 3" or unclear context
            correctCategory = 'Accessories No 3';
          }
        } else if (catLower.includes('no 4') || catLower.includes('uniform no 4')) {
          correctCategory = 'Accessories No 4';
        }
        
        return res.status(400).json({
          success: false,
          message: `Invalid category "${item.category}" for accessory type "${item.type}". Accessories must use category "${correctCategory}" (not "${item.category}").`
        });
      }

      if (catLower === 't-shirt' || catLower === 'tshirt' || catLower === 't shirt') {
        return res.status(400).json({
          success: false,
          message: `Invalid category "${item.category}". Use "Shirt" instead of "T-Shirt".`
        });
      }
    }

    // Normalize items: ensure size is always a string (empty string for accessories, not null)
    // CRITICAL: Also normalize categories and types to support 5-category structure
    // STRICT: Wrap normalization in try-catch to return proper 400 errors instead of 500
    let normalizedInputItems: any[] = [];
    try {
      normalizedInputItems = items.map((item: any) => {
        // Normalize category and type first
        const normalizedType = normalizeTypeName(item.category, item.type);
        const normalizedCategory = normalizeCategoryForStorage(item.category, normalizedType);
        
        let normalizedSize = item.size;
        // Convert null, undefined, "N/A" to empty string for accessories (schema requires String)
        if (!normalizedSize || normalizedSize === 'N/A' || normalizedSize.toLowerCase() === 'n/a') {
          normalizedSize = ''; // Empty string for accessories (schema requires String, not null)
        } else {
          normalizedSize = String(normalizedSize).trim();
        }
        
        return {
          ...item,
          category: normalizedCategory, // Store normalized category
          type: normalizedType, // Store normalized type
          size: normalizedSize // Always a string (empty string for accessories)
        };
      });
    } catch (normalizationError: any) {
      console.error('Category normalization error in createMemberUniform:', normalizationError.message);
      return res.status(400).json({
        success: false,
        message: normalizationError.message || 'Invalid category. Valid categories are: Uniform No 3, Uniform No 4, Accessories No 3, Accessories No 4, Shirt'
      });
    }
    
    console.log(`📋 Category normalization applied:`, normalizedInputItems.map((i: any) => 
      `${i.category}/${i.type} (was: ${items.find((o: any) => o.type === i.type)?.category || 'unknown'})`).join(', '));
    
    // Remove duplicates within the request itself first
    const seenKeys = new Set<string>();
    const uniqueItems: any[] = [];
    for (const item of normalizedInputItems) {
      const key = getItemKey(item);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueItems.push(item);
      } else {
        console.log(`⚠️  Duplicate item in request skipped: ${item.type} (${item.size || 'no size'})`);
      }
    }
    
    console.log(`📦 Request has ${items.length} items, ${uniqueItems.length} unique items after deduplication and normalization`);
    console.log(`   Normalized items:`, uniqueItems.map((i: any) => `${i.type} size:"${i.size || 'EMPTY'}"`).join(', '));
    
    // Determine which items need to be added (for inventory deduction)
    let itemsToDeduct: any[] = [];
    
    if (uniform) {
      // Smart merge: Add new items but avoid exact duplicates
      // Check for duplicates based on category, type, and size
      const existingItems = uniform.items;
      const newItemsToAdd: any[] = [];
      
      for (const newItem of uniqueItems) {
        // Normalize sizes for comparison (empty string and "N/A" should match)
        const normalizeSizeForComparison = (size: any): string => {
          if (!size || size === 'N/A' || String(size).toLowerCase() === 'n/a') return '';
          return String(size).trim();
        };
        
        // Check if this exact item already exists in database (compare normalized sizes)
        const isDuplicate = existingItems.some((existing: any) => {
          const existingSizeNorm = normalizeSizeForComparison(existing.size);
          const newSizeNorm = normalizeSizeForComparison(newItem.size);
          return existing.category === newItem.category &&
          existing.type === newItem.type &&
                 existingSizeNorm === newSizeNorm;
        });
        
        if (!isDuplicate) {
          // Item already normalized in uniqueItems, but ensure quantity is set
          // Normalize: set quantity to 1 (one physical item per entry)
          newItemsToAdd.push({
            ...newItem,
            quantity: 1
          });
          console.log(`✅ Adding new item: ${newItem.type} size:"${newItem.size || 'EMPTY'}" category:${newItem.category}`);
        } else {
          console.log(`⏭️  Skipping duplicate item: ${newItem.type} size:"${newItem.size || 'EMPTY'}"`);
        }
      }
      
      itemsToDeduct = newItemsToAdd; // Only deduct for new items
      
      // Add only non-duplicate items
      if (newItemsToAdd.length > 0) {
        console.log(`📝 Adding ${newItemsToAdd.length} new items to existing uniform collection`);
        console.log(`   Items to add:`, newItemsToAdd.map((i: any) => `${i.category}/${i.type}/size:"${i.size || 'EMPTY'}"`).join(', '));
        
        uniform.items.push(...newItemsToAdd);
        
        try {
        await uniform.save({ session });
          console.log(`✅ Added ${newItemsToAdd.length} new items to existing uniform collection for ${req.user.sispaId}`);
          console.log(`   Total items in collection now: ${uniform.items.length}`);
          console.log(`   Saved uniform ID: ${uniform._id}`);
        } catch (saveError: any) {
          console.error(`❌ ERROR SAVING UNIFORM TO DATABASE:`, saveError);
          console.error(`   Error name:`, saveError.name);
          console.error(`   Error message:`, saveError.message);
          if (saveError.errors) {
            console.error(`   Validation errors:`, JSON.stringify(saveError.errors, null, 2));
          }
          await session.abortTransaction();
          session.endSession();
          return res.status(500).json({
            success: false,
            message: 'Error saving uniform to database',
            error: saveError.message,
            validationErrors: saveError.errors || undefined
          });
        }
      } else {
        await session.commitTransaction();
        session.endSession();
        return res.status(200).json({
          success: true,
          message: 'All items already exist in your uniform collection.',
          uniform: {
            sispaId: uniform.sispaId,
            items: uniform.items,
            itemCount: uniform.items.length
          }
        });
      }
    } else {
      // Create new uniform collection - deduct all items
      // Normalize items: set quantity to 1 for each item (one physical item per entry)
      // CRITICAL: Ensure size is always a string (empty string for accessories, not null)
      const normalizedItems = uniqueItems.map((item: any) => {
        let normalizedSize = item.size;
        if (!normalizedSize || normalizedSize === 'N/A' || normalizedSize.toLowerCase() === 'n/a') {
          normalizedSize = ''; // Use empty string, not null (schema requires String)
        } else {
          normalizedSize = String(normalizedSize).trim();
        }
        
        return {
        ...item,
          size: normalizedSize, // Ensure size is always a string
        quantity: 1 // Always 1 per item for user uniform collection
        };
      });
      itemsToDeduct = normalizedItems;
      uniform = new MemberUniform({
        sispaId: req.user.sispaId,
        items: normalizedItems
      });
      
      console.log(`📝 Creating new uniform collection with ${normalizedItems.length} items for ${req.user.sispaId}`);
      console.log(`   Items to save:`, normalizedItems.map((i: any) => `${i.category}/${i.type}/size:"${i.size}"/qty:${i.quantity}`).join(', '));
      
      try {
        await uniform.save({ session });
        console.log(`✅ New uniform collection saved successfully - ID: ${uniform._id}`);
        console.log(`   Created new uniform collection with ${normalizedItems.length} items for ${req.user.sispaId}`);
      } catch (saveError: any) {
        console.error(`❌ ERROR CREATING UNIFORM IN DATABASE:`, saveError);
        console.error(`   Error name:`, saveError.name);
        console.error(`   Error message:`, saveError.message);
        if (saveError.errors) {
          console.error(`   Validation errors:`, JSON.stringify(saveError.errors, null, 2));
        }
        console.error(`   Items that failed:`, JSON.stringify(normalizedItems, null, 2));
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({
          success: false,
          message: 'Error creating uniform in database',
          error: saveError.message,
          validationErrors: saveError.errors || undefined
        });
      }
    }
    
    console.log(`🔢 Items to deduct from inventory: ${itemsToDeduct.length}`);

    // Deduct inventory for new items (all or nothing)
    // Use a Map to ensure each inventory item is only deducted once (even if same item appears multiple times)
    const inventoryUpdatesMap = new Map<string, { item: any; inventoryId: string; currentQuantity: number; deduction: number }>();
    
    for (const item of itemsToDeduct) {
      // CRITICAL: Skip inventory deduction if status is "Not Available" or "Missing"
      const itemStatus = item.status || 'Available';
      if (itemStatus === 'Not Available' || itemStatus === 'Missing') {
        console.log(`⏭️  Skipping inventory deduction for item with status "${itemStatus}": ${item.type} (${item.size || 'no size'})`);
        continue; // Still save the item, just don't deduct inventory
      }
      
      // Skip inventory check for custom-ordered items (e.g., Nametag)
      if (isCustomOrderedItem(item.type)) {
        console.log(`⏭️  Skipping inventory check for custom-ordered item: ${item.type}`);
        continue; // Skip this item - no inventory deduction needed
      }
      
      // Normalize size: convert empty string, "N/A", null, or undefined to empty string for accessories
      // CRITICAL: Schema requires size to be a String, so use empty string, not null
      let normalizedSize: string | null = item.size;
      if (!normalizedSize || normalizedSize === '' || normalizedSize === 'N/A' || normalizedSize.toLowerCase() === 'n/a') {
        normalizedSize = ''; // Use empty string for accessories (schema requires String, not null)
      } else {
        normalizedSize = String(normalizedSize).trim();
      }
      
      // For items that should have sizes but don't, check if type requires size
      // Use empty string check instead of null check
      if (!normalizedSize && requiresSize(item.category, item.type)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ 
          success: false, 
          message: `Item "${item.type}" requires a size` 
        });
      }
      
      // Find matching inventory item (case-insensitive)
      // Pass original size - findInventoryItem will normalize it internally
      const inventoryItem = await findInventoryItem(
        item.category,
        item.type,
        item.size, // Pass original size, not normalized
        session
      );

      if (!inventoryItem) {
        // Log the missing inventory item but don't block the save
        // Allow members to save items even if not in inventory (admin can add inventory later)
        console.warn(`⚠️  Item not found in inventory - allowing save anyway:`, {
          searched: { category: item.category, type: item.type, size: item.size || 'N/A' }
        });
        
        // Get available sizes for logging
        const allItems = await UniformInventory.find({
          category: { $regex: new RegExp(`^${item.category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          type: { $regex: new RegExp(`^${item.type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        }).limit(10);
        
        console.warn(`   Available sizes in inventory for this type:`, allItems.map(i => i.size).filter(Boolean).join(', ') || 'none');
        console.warn(`   ⚠️  Allowing save without inventory deduction - admin should add inventory for this item`);
        
        // Skip this item for inventory deduction but allow the save to continue
        continue;
      }

      // For user additions, always deduct exactly 1 per item (one physical item)
      // Use inventoryId as key to ensure each inventory item is only deducted once
      const inventoryId = String(inventoryItem._id);
      
      // If this inventory item was already processed, skip it (prevent double deduction)
      if (inventoryUpdatesMap.has(inventoryId)) {
        console.log(`⚠️  Skipping duplicate deduction for inventory item ${inventoryId}: ${item.type} (${item.size || 'no size'})`);
        continue;
      }
      
      if (inventoryItem.quantity < 1) {
        // Log the insufficient inventory but don't block the save
        // Allow members to save items even if inventory is low (admin can restock)
        console.warn(`⚠️  Insufficient inventory - allowing save anyway:`, {
          item: item.type,
          size: normalizedSize || 'N/A',
          available: inventoryItem.quantity,
          requested: 1
        });
        console.warn(`   ⚠️  Allowing save without inventory deduction - admin should restock inventory`);
        
        // Skip this item for inventory deduction but allow the save to continue
        continue;
      }

      // Double-check: Make absolutely sure we're not adding the same inventory item twice
      if (inventoryUpdatesMap.has(inventoryId)) {
        console.error(`❌ CRITICAL ERROR: Attempted to add duplicate inventory item ${inventoryId} to deduction map!`);
        console.error(`   Item: ${item.type} (${item.size || 'no size'})`);
        console.error(`   This should never happen - skipping this item`);
        continue;
      }
      
      inventoryUpdatesMap.set(inventoryId, {
        item,
        inventoryId: inventoryId,
        currentQuantity: inventoryItem.quantity,
        deduction: 1 // Always 1 per item for user uniform collection - HARDCODED
      });
      
      console.log(`📝 Prepared deduction: 1 for ${item.type} (${item.size || 'no size'}) - Inventory ID: ${inventoryId}, Current Stock: ${inventoryItem.quantity}`);
    }
    
    // Convert map to array for processing
    const inventoryUpdates = Array.from(inventoryUpdatesMap.values());
    console.log(`✅ Total unique inventory items to deduct: ${inventoryUpdates.length}`);
    
    // Final safety check: Verify no duplicates in the array
    const inventoryIds = inventoryUpdates.map(u => u.inventoryId);
    const uniqueIds = new Set(inventoryIds);
    if (inventoryIds.length !== uniqueIds.size) {
      console.error(`❌ CRITICAL ERROR: Duplicate inventory IDs found in deduction array!`);
      console.error(`   Total items: ${inventoryIds.length}, Unique IDs: ${uniqueIds.size}`);
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({ 
        success: false, 
        message: 'Internal error: Duplicate inventory items detected. Please try again.' 
      });
    }

    // Deduct inventory (all or nothing)
    // CRITICAL: Always deduct exactly 1 per inventory item, no matter what
    for (const update of inventoryUpdates) {
      // Get current quantity to calculate new status
      const inventoryItem = await UniformInventory.findById(update.inventoryId).session(session);
      if (!inventoryItem) {
        console.warn(`⚠️  Inventory item ${update.inventoryId} not found, skipping`);
        continue;
      }
      
      // FORCE deduction to be exactly 1, regardless of what was calculated
      const deductionAmount = 1;
      const oldQuantity = inventoryItem.quantity;
      const newQuantity = oldQuantity - deductionAmount;
      
      if (newQuantity < 0) {
        // Log insufficient inventory but don't block the save
        // Allow members to save items even if inventory is low/zero (admin can restock)
        console.warn(`⚠️  Insufficient inventory for deduction - allowing save anyway:`, {
          item: update.item.type,
          size: update.item.size || 'N/A',
          available: oldQuantity,
          requested: deductionAmount
        });
        console.warn(`   ⚠️  Skipping inventory deduction - admin should restock inventory`);
        
        // Skip this item for inventory deduction but allow the save to continue
        continue;
      }
      
      const newStatus = calculateStockStatus(newQuantity);
      
      // Actually update and save the inventory item
      inventoryItem.quantity = newQuantity;
      inventoryItem.status = newStatus;
      await inventoryItem.save({ session });
      
      console.log(`✅ DEDUCTED EXACTLY ${deductionAmount} from inventory: ${update.item.type} (${update.item.size || 'no size'}) - ${oldQuantity} → ${newQuantity}, Status: ${newStatus}`);
      console.log(`   ✅ Inventory item saved successfully (ID: ${inventoryItem._id})`);
    }
    
    console.log(`🎯 FINAL: Deducted exactly 1 from ${inventoryUpdates.length} unique inventory item(s)`);
    
    // Reload uniform from database within transaction to verify it's saved
    const savedUniformInTransaction = await MemberUniform.findById(uniform._id).session(session);
    if (!savedUniformInTransaction) {
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({
        success: false,
        message: 'Error: Could not retrieve saved uniform data within transaction'
      });
    }
    
    console.log(`✅ Uniform saved in transaction - SISPA ID: ${savedUniformInTransaction.sispaId}, Items count: ${savedUniformInTransaction.items.length}`);
    console.log(`   Saved items:`, savedUniformInTransaction.items.map((i: any) => `${i.category}/${i.type}/size:"${i.size || 'EMPTY'}"`).join(', '));
    
    // Commit transaction
    try {
    await session.commitTransaction();
      console.log(`✅ Transaction committed successfully`);
    session.endSession();
    } catch (commitError: any) {
      console.error(`❌ ERROR COMMITTING TRANSACTION:`, commitError);
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({
        success: false,
        message: 'Error committing transaction',
        error: commitError.message
      });
    }
    
    // VERIFY: Reload from database after commit to confirm data is saved
    let savedUniform: any;
    try {
      savedUniform = await MemberUniform.findOne({ sispaId: req.user.sispaId });
      if (!savedUniform) {
        console.error(`❌ CRITICAL: Uniform not found after commit! SISPA ID: ${req.user.sispaId}`);
        return res.status(500).json({
          success: false,
          message: 'Error: Uniform data was not saved correctly. Please try again.'
        });
      }
      console.log(`✅ VERIFICATION: Uniform found in database after commit - Items: ${savedUniform.items.length}`);
      console.log(`   Verified items:`, savedUniform.items.map((i: any) => `${i.category}/${i.type}/size:"${i.size || 'EMPTY'}"`).join(', '));
      console.log(`   Uniform ID: ${savedUniform._id}`);
    } catch (verifyError: any) {
      console.error(`❌ ERROR VERIFYING SAVED UNIFORM:`, verifyError);
      // Use the in-transaction uniform as fallback
      savedUniform = savedUniformInTransaction;
    }
    
    // Mark request as completed (but keep in cache to prevent immediate duplicates)
    if (req.user?.sispaId && req.body?.items) {
      const itemsHash = hashItems(req.body.items);
      const requestKey = `${req.user.sispaId}::${itemsHash}`;
      const cachedRequest = recentRequests.get(requestKey);
      if (cachedRequest) {
        // Update timestamp but mark as not processing anymore
        recentRequests.set(requestKey, { timestamp: Date.now(), processing: false });
        console.log(`✅ Request completed - Marked as done (Request key: ${requestKey})`);
      }
    }
    
    console.log(`🔵 ===== END CREATE MEMBER UNIFORM REQUEST =====\n`);

    // Use the reloaded uniform data for response
    const responseMessage = savedUniform.items.length === items.length
      ? 'Uniform collection created successfully'
      : `Uniform items added successfully. ${itemsToDeduct.length} new items added.`;

    // Format items with status fields for response
    const formattedItems = formatUniformItemsWithStatus(
      savedUniform.items,
      savedUniform.createdAt,
      savedUniform.updatedAt
    );

    console.log(`📤 Sending response - Success: true, Items: ${formattedItems.length}`);
    console.log(`   Response items:`, formattedItems.map((i: any) => `${i.category}/${i.type}/${i.size || 'N/A'}`).join(', '));

    res.status(savedUniform.items.length === items.length ? 201 : 200).json({
      success: true,
      message: responseMessage,
      uniform: {
        sispaId: savedUniform.sispaId,
        items: formattedItems,
        itemCount: formattedItems.length
      }
    });
  } catch (error: any) {
    console.error('\n❌❌❌ ERROR IN createMemberUniform ❌❌❌');
    console.error('Error type:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    console.error('User:', req.user?.sispaId);
    
    // Rollback transaction on error
    try {
      if (session && session.inTransaction()) {
      await session.abortTransaction();
        console.log('✅ Transaction aborted due to error');
    }
      if (session) {
    session.endSession();
      }
    } catch (sessionError: any) {
      console.error('Error closing session:', sessionError);
    }
    
    // Remove from cache on error so user can retry
    if (req.user?.sispaId && req.body?.items) {
      const itemsHash = hashItems(req.body.items);
      const requestKey = `${req.user.sispaId}::${itemsHash}`;
      recentRequests.delete(requestKey);
      console.log(`🔄 Removed request from cache due to error - user can retry`);
    }
    
    // Check if this is a validation/category error (should return 400, not 500)
    const errorMessage = error.message || 'Unknown error';
    const isValidationError = errorMessage.includes('Invalid category') || 
                              errorMessage.includes('Valid categories are') ||
                              errorMessage.includes('must use category') ||
                              errorMessage.includes('Use "Shirt" instead') ||
                              error.name === 'ValidationError';
    
    if (isValidationError) {
      console.error('Validation error detected - returning 400 instead of 500');
      if (error.errors) {
        console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ 
          success: false, 
          message: 'Validation error: ' + Object.values(error.errors).map((e: any) => e.message).join(', '), 
          validationErrors: error.errors 
        });
      }
      return res.status(400).json({
        success: false,
        message: errorMessage,
        error: 'Category validation failed'
      });
    }
    
    // Check for duplicate key errors
    if (error.code === 11000 || error.name === 'MongoServerError') {
      console.error('Duplicate key error - uniform might already exist for this user');
      // Try to get existing uniform and return it
      try {
        const existingUniform = await MemberUniform.findOne({ sispaId: req.user?.sispaId });
        if (existingUniform) {
          return res.status(200).json({
            success: true,
            message: 'Uniform already exists (duplicate prevented)',
            uniform: {
              sispaId: existingUniform.sispaId,
              items: existingUniform.items,
              itemCount: existingUniform.items.length
            }
          });
        }
      } catch (findError: any) {
        console.error('Error finding existing uniform:', findError);
      }
    }
    
    console.error('❌❌❌ END ERROR LOG ❌❌❌\n');
    
    res.status(500).json({ 
      success: false, 
      message: 'Error creating/adding uniform: ' + (error.message || 'Unknown error'),
      error: error.message,
      errorType: error.name,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
};

// PUT /api/members/uniform - Replace all uniform items (with inventory deduction)
export const updateMemberUniform = async (req: AuthRequest, res: Response) => {
  // Log the incoming request to debug
  console.log(`\n🟡 ===== UPDATE MEMBER UNIFORM REQUEST =====`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Method: ${req.method}`);
  console.log(`Path: ${req.path}`);
  console.log(`User: ${req.user?.sispaId}`);
  console.log(`Request items count: ${req.body?.items?.length || 0}`);
  if (req.body?.items) {
    console.log(`Request items:`, req.body.items.map((i: any) => `${i.type} (${i.size || 'no size'})`).join(', '));
  }
  
  const session = await mongoose.startSession();
  session.startTransaction();
  console.log('✅ Transaction started');

  // Declare variables outside try block so they're accessible in catch block
  let normalizedItems: any[] = [];
  let validatedItems: any[] = [];

  try {
    if (!req.user || !req.user.sispaId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    const { items } = req.body;

    // Validate items array
    if (!items || !Array.isArray(items)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide an array of uniform items. Each item must have: category, type, size, and quantity.' 
      });
    }

    // STRICT: Validate categories FIRST before any processing
    // This ensures we catch invalid categories early and return 400 instead of 500
      for (const item of items) {
      if (!item.category) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Missing category for item type "${item.type}". Valid categories are: Uniform No 3, Uniform No 4, Accessories No 3, Accessories No 4, Shirt`
        });
      }

      // Validate category - accept valid categories (including backward-compatible ones)
      // BACKWARD COMPATIBILITY: Allow old categories like "T-Shirt" and "Uniform No 3" for accessories
      // They will be normalized later in normalizeCategoryForStorage
      const catLower = item.category.toLowerCase().trim();
      
      // Accept valid categories (including backward-compatible "T-Shirt")
      if (!isValidCategory(item.category)) {
        // Also check for old category patterns that will be normalized
        const isOldCategoryPattern = 
          catLower === 't-shirt' || catLower === 'tshirt' || catLower === 't shirt' ||
          catLower.includes('uniform no 3') || catLower.includes('uniform no 4') ||
          catLower.includes('accessories no 3') || catLower.includes('accessories no 4') ||
          catLower === 'shirt';
        
        if (!isOldCategoryPattern) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: `Invalid category "${item.category}" for item type "${item.type}". Valid categories are: Uniform No 3, Uniform No 4, Accessories No 3, Accessories No 4, Shirt (or T-Shirt for backward compatibility)`
          });
        }
      }
      
      // Note: Category-type matching validation is done AFTER normalization
      // This allows backward compatibility (e.g., "Uniform No 3" + "Apulet" will be normalized to "Accessories No 3" + "Apulet")
    }

    // CRITICAL: Normalize categories and types FIRST before any validation or processing
    // This ensures accessories are in the correct categories and supports 5-category structure
    // STRICT: Wrap normalization in try-catch to return proper 400 errors instead of 500
    try {
      // Log incoming items before normalization for debugging
      console.log(`📥 Incoming items BEFORE normalization:`, items.map((i: any) => 
        `${i.category}/${i.type}/${i.size || 'no size'}`).join(', '));
      
      normalizedItems = items.map((item: any) => {
        const normalizedType = normalizeTypeName(item.category, item.type);
        const normalizedCategory = normalizeCategoryForStorage(item.category, normalizedType);
        
        // CRITICAL: For Nametag, determine category based on normalized type
        // CRITICAL: "Nametag No 3" and "Nametag No 4" are DIFFERENT items - they must be in their respective categories
        let finalCategory = normalizedCategory;
        const typeLower = (item.type || '').toLowerCase();
        const normalizedTypeLower = normalizedType.toLowerCase();
        const isNametag = typeLower.includes('nametag') || typeLower.includes('name tag');
        const catLower = (item.category || '').toLowerCase().trim();
        
        if (isNametag) {
          // Check if normalized type explicitly specifies No 3 or No 4
          const isNametagNo4 = normalizedTypeLower.includes('no 4') || normalizedTypeLower.includes('name tag no 4');
          const isNametagNo3 = normalizedTypeLower.includes('no 3') || normalizedTypeLower.includes('name tag no 3');
          
          if (isNametagNo4) {
            // Type is "Nametag No 4" or "Name Tag No 4" - MUST be in Accessories No 4
            finalCategory = 'Accessories No 4';
            console.log(`✅ Nametag No 4 detected - setting category to "Accessories No 4" (normalized type: "${normalizedType}")`);
          } else if (isNametagNo3) {
            // Type is "Nametag No 3" or "Name Tag No 3" - MUST be in Accessories No 3
            finalCategory = 'Accessories No 3';
            console.log(`✅ Nametag No 3 detected - setting category to "Accessories No 3" (normalized type: "${normalizedType}")`);
          } else {
            // Generic "Nametag" without suffix - use category sent by frontend
            if (catLower === 'accessories no 4' || catLower === 'accessories no. 4' || catLower === 'accessory no 4') {
              finalCategory = 'Accessories No 4';
              console.log(`✅ Preserving "Accessories No 4" category for generic Nametag (frontend sent: "${item.category}")`);
            } else if (catLower === 'accessories no 3' || catLower === 'accessories no. 3' || catLower === 'accessory no 3') {
              finalCategory = 'Accessories No 3';
              console.log(`✅ Preserving "Accessories No 3" category for generic Nametag (frontend sent: "${item.category}")`);
            }
            // Otherwise, use normalized category (for backward compatibility with "Uniform No 3" or "Uniform No 4")
          }
        }
        
        // Normalize size: handle null, empty string, "N/A" for accessories
        // Frontend sends null for accessories, but schema expects empty string or null
        let normalizedSize = item.size;
        if (normalizedSize === null || normalizedSize === undefined || normalizedSize === '' || normalizedSize === 'N/A' || String(normalizedSize).toLowerCase() === 'n/a') {
          // For accessories (no size), use empty string (schema setter will handle it)
          // Check if this is an accessory
          const isAccessory = isAccessoryType(normalizedType);
          if (isAccessory) {
            normalizedSize = ''; // Empty string for accessories (schema will handle null conversion)
          } else {
            // For main items, if size is missing, this might be an error - but let validation handle it
            normalizedSize = ''; // Default to empty string, validation will catch if size is required
          }
        } else {
          normalizedSize = String(normalizedSize).trim(); // Convert to string for main items
        }
        
        return {
          ...item,
          category: finalCategory, // Use final category (preserves Accessories No 4 for Nametag)
          type: normalizedType, // Normalized type
          size: normalizedSize // Normalized size
        };
      });
      
      // Log normalized items for debugging
      console.log(`📤 Normalized items AFTER normalization:`, normalizedItems.map((i: any) => 
        `${i.category}/${i.type}/${i.size || 'no size'}`).join(', '));
    } catch (normalizationError: any) {
      await session.abortTransaction();
      session.endSession();
      console.error('Category normalization error:', normalizationError.message);
      return res.status(400).json({
        success: false,
        message: normalizationError.message || 'Invalid category. Valid categories are: Uniform No 3, Uniform No 4, Accessories No 3, Accessories No 4, Shirt'
      });
    }
    
    console.log(`📋 Category normalization in PUT (early):`, normalizedItems.map((i: any, idx: number) => 
      `${i.category}/${i.type} (original: ${items[idx].category}/${items[idx].type})`).join(', '));

    // Validate each item if array is not empty (use normalized items)
    if (normalizedItems.length > 0) {
      for (const item of normalizedItems) {
        if (!item.category || !item.type || item.quantity === undefined) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ 
            success: false, 
            message: 'Each uniform item must have: category, type, and quantity. Size is optional for accessories.' 
          });
        }
        if (typeof item.quantity !== 'number' || item.quantity < 1) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ 
            success: false, 
            message: 'Quantity must be a number and at least 1.' 
          });
        }
        
        // Validate size: Main items (like "Beret", "Uniform No 3 Male") require a size
        // Accessories don't require sizes (size can be empty string)
        const isAccessory = isAccessoryType(item.type);
        const needsSize = requiresSize(item.category, item.type);
        const hasValidSize = item.size && item.size !== '' && item.size !== null && item.size !== undefined && item.size !== 'N/A';
        
        if (needsSize && !hasValidSize && !isAccessory) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: `Item "${item.type}" in category "${item.category}" requires a size. Please provide a size for this item.`
          });
        }
      }
    }

    // Step 0: Get existing uniform to compare old vs new items
    const existingUniform = await MemberUniform.findOne({ sispaId: req.user.sispaId }).session(session);
    const oldItems = existingUniform?.items || [];
    
    // Normalize old items categories for comparison (old items might have old category structure)
    // Note: Old items in database might have old categories, so we normalize them for comparison
    // But we don't throw errors for old items - we just normalize them
    const normalizedOldItems = oldItems.map((oldItem: any) => {
      try {
        const normalizedOldType = normalizeTypeName(oldItem.category, oldItem.type);
        const normalizedOldCategory = normalizeCategoryForStorage(oldItem.category, normalizedOldType);
        return {
          ...oldItem.toObject ? oldItem.toObject() : oldItem, // Handle Mongoose documents
          category: normalizedOldCategory,
          type: normalizedOldType
        };
      } catch (normalizeError: any) {
        // If normalization fails for old item, log warning but continue
        // (Old items in database might have invalid categories that were migrated)
        console.warn(`⚠️  Warning: Could not normalize old item category "${oldItem.category}" for type "${oldItem.type}":`, normalizeError.message);
        // Return item with original category (will be handled later if needed)
        return {
          ...oldItem.toObject ? oldItem.toObject() : oldItem,
          category: oldItem.category,
          type: oldItem.type
        };
      }
    });
    
    console.log(`📋 Existing uniform has ${oldItems.length} items (normalized: ${normalizedOldItems.length})`);
    console.log(`📋 New request has ${items.length} items (normalized: ${normalizedItems.length})`);
    
    // Helper function to create a key for item comparison (category + type + size)
    const getItemKey = (item: any): string => {
      try {
        const normalizedSize = item.size ? normalizeSize(item.size) : 'NO_SIZE';
        const normalizedCategory = (item.category || '').toLowerCase().trim();
        const normalizedType = normalizeTypeForMatching(item.type || '');
        return `${normalizedCategory}::${normalizedType}::${normalizedSize}`;
      } catch (err) {
        console.error('Error creating item key:', err, item);
        throw new Error(`Invalid item data: ${JSON.stringify(item)}`);
      }
    };
    
    // Create maps for old and new items (use normalized items for consistency)
    const oldItemMap = new Map<string, any>();
    for (const oldItem of normalizedOldItems) {
      if (isCustomOrderedItem(oldItem.type)) continue; // Skip custom-ordered items
      const key = getItemKey(oldItem);
      const existing = oldItemMap.get(key);
      if (existing) {
        existing.quantity = (existing.quantity || 0) + (oldItem.quantity || 1);
      } else {
        oldItemMap.set(key, { ...oldItem, quantity: oldItem.quantity || 1 });
      }
    }
    
    const newItemMap = new Map<string, any>();
    for (const newItem of normalizedItems) {
      if (isCustomOrderedItem(newItem.type)) continue; // Skip custom-ordered items
      const key = getItemKey(newItem);
      const existing = newItemMap.get(key);
      if (existing) {
        existing.quantity = (existing.quantity || 0) + (newItem.quantity || 1);
      } else {
        newItemMap.set(key, { ...newItem, quantity: newItem.quantity || 1 });
      }
    }
    
    console.log(`📊 Item comparison summary (using normalized categories):`, {
      oldItemsCount: oldItemMap.size,
      newItemsCount: newItemMap.size,
      oldItemKeys: Array.from(oldItemMap.keys()),
      newItemKeys: Array.from(newItemMap.keys())
    });
    
    // Step 1: Restore inventory for items that were removed or quantity decreased
    const inventoryRestores: Array<{ item: any; inventoryId: string; restore: number }> = [];
    
    for (const [key, oldItem] of oldItemMap.entries()) {
      const newItem = newItemMap.get(key);
      const oldQuantity = (oldItem.quantity !== undefined && oldItem.quantity !== null) ? oldItem.quantity : 1;
      const newQuantity = newItem ? ((newItem.quantity !== undefined && newItem.quantity !== null) ? newItem.quantity : 1) : 0;
      
      // If item was removed or quantity decreased, restore the difference
      if (!newItem || newQuantity < oldQuantity) {
        const restoreAmount = !newItem ? oldQuantity : (oldQuantity - newQuantity);
        
        // Validate restore amount
        if (restoreAmount <= 0) {
          console.warn(`⚠️  Invalid restore amount: ${restoreAmount} for ${oldItem.type} (${oldItem.size || 'no size'}) - Skipping`);
          continue;
        }
        
        // Find the inventory item for the old item
        // Validate that category and type exist
        if (!oldItem.category || !oldItem.type) {
          console.warn(`⚠️  Skipping restore for item with missing category or type:`, oldItem);
          continue;
        }
        
        const inventoryItem = await findInventoryItem(
          oldItem.category,
          oldItem.type,
          oldItem.size,
          session
        );
        
        if (inventoryItem) {
          inventoryRestores.push({
            item: oldItem,
            inventoryId: String(inventoryItem._id),
            restore: restoreAmount
          });
          console.log(`📦 Will restore ${restoreAmount} to inventory: ${oldItem.type} (${oldItem.size || 'no size'})`);
        } else {
          console.warn(`⚠️  Could not find inventory item to restore: ${oldItem.type} (${oldItem.size || 'no size'}) - This item may have been removed from inventory`);
        }
      }
    }
    
    console.log(`📊 Inventory changes summary:`);
    console.log(`  - Items to restore: ${inventoryRestores.length}`);
    console.log(`  - Old items: ${oldItemMap.size}, New items: ${newItemMap.size}`);
    
    // Step 2: Calculate net changes and prepare deductions for new items or items with increased quantity
    const inventoryUpdates: Array<{ item: any; inventoryId: string; currentQuantity: number; deduction: number }> = [];
    
    for (const [key, newItem] of newItemMap.entries()) {
      // Skip inventory check for custom-ordered items (e.g., Nametag)
      if (isCustomOrderedItem(newItem.type)) {
        console.log(`⏭️  Skipping inventory check for custom-ordered item: ${newItem.type}`);
        continue; // Skip this item - no inventory deduction needed
      }
      
      const oldItem = oldItemMap.get(key);
      const oldQuantity = oldItem ? ((oldItem.quantity !== undefined && oldItem.quantity !== null) ? oldItem.quantity : 1) : 0;
      const newQuantity = (newItem.quantity !== undefined && newItem.quantity !== null) ? newItem.quantity : 1;
      
      console.log(`🔍 Comparing item: ${newItem.type} (${newItem.size || 'no size'})`, {
        key,
        oldItemExists: !!oldItem,
        oldQuantity,
        newQuantity,
        category: newItem.category,
        type: newItem.type,
        size: newItem.size
      });
      
      // Check if this is a size change (same category/type but different size)
      // Check if there's an old item with same category/type but different size
      let isSizeChange = false;
      if (requiresSize(newItem.category, newItem.type)) {
        for (const [oldKey, oldItemCheck] of oldItemMap.entries()) {
          // Skip if it's the same item (same key)
          if (oldKey === key) continue;
          
          const oldCategory = oldItemCheck.category?.toLowerCase().trim() || '';
          const oldType = normalizeTypeForMatching(oldItemCheck.type || '');
          const newCategory = newItem.category?.toLowerCase().trim() || '';
          const newType = normalizeTypeForMatching(newItem.type || '');
          
          // Check if same category and type but different size (different key means different size)
          if (oldCategory === newCategory && oldType === newType) {
            isSizeChange = true;
            console.log(`🔄 Size change detected: ${newItem.type} from ${oldItemCheck.size || 'no size'} to ${newItem.size || 'no size'}`);
            break;
          }
        }
      }
      
      // CRITICAL: Skip inventory deduction if status is "Not Available" or "Missing"
      const itemStatus = newItem.status || 'Available';
      const shouldSkipDeduction = itemStatus === 'Not Available' || itemStatus === 'Missing';
      
      if (shouldSkipDeduction) {
        console.log(`⏭️  Skipping inventory deduction for item with status "${itemStatus}": ${newItem.type} (${newItem.size || 'no size'})`);
        // Still save the item, just don't deduct inventory
      } else if (!oldItem || isSizeChange || newQuantity > oldQuantity) {
        // Deduct if this is a new item (not in old), size change, OR if quantity increased
        const netIncrease = !oldItem || isSizeChange ? newQuantity : (newQuantity - oldQuantity);
        
        console.log(`🔍 Processing item for deduction: ${newItem.type} (${newItem.size || 'no size'})`, {
          isNewItem: !oldItem,
          isSizeChange,
          quantityIncreased: newQuantity > oldQuantity,
          oldQuantity,
          newQuantity,
          netIncrease
        });
        
        // Normalize size: convert empty string, "N/A", null, or undefined to null for accessories
        let normalizedSize: string | null = newItem.size;
        if (!normalizedSize || normalizedSize === '' || normalizedSize === 'N/A' || normalizedSize.toLowerCase() === 'n/a') {
          normalizedSize = null;
        }
        
        // For items that should have sizes but don't, check if type requires size
        if (normalizedSize === null && requiresSize(newItem.category, newItem.type)) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ 
            success: false, 
            message: `Item "${newItem.type}" requires a size` 
          });
        }
        
        // Find matching inventory item (match by category, type, and size) - case-insensitive
        // Pass original size - findInventoryItem will normalize it internally
        // Validate that category and type exist
        if (!newItem.category || !newItem.type) {
          console.warn(`⚠️  Skipping inventory check for item with missing category or type:`, newItem);
          continue;
        }
        
        // CRITICAL: Check if this item TYPE is an accessory (regardless of category)
        // Frontend might send accessories with category "Uniform No 3" (old structure)
        // So we check the TYPE, not just the category - this is the key fix!
        const isAccessoryTypeItem = isAccessoryType(newItem.type);
        const isAccessoryCategory = newItem.category?.toLowerCase().trim().includes('accessories');
        const isAccessory = isAccessoryTypeItem || isAccessoryCategory; // Item is accessory if TYPE is accessory OR category is Accessories
        
        console.log(`🔎 Searching for inventory item: category="${newItem.category}", type="${newItem.type}", size="${newItem.size || 'EMPTY/NULL'}"`);
        console.log(`   isAccessoryTypeItem: ${isAccessoryTypeItem}, isAccessoryCategory: ${isAccessoryCategory}, isAccessory: ${isAccessory}`);
        
        let inventoryItem;
        try {
          // Strategy 1: Try searching with current category/type first
          inventoryItem = await findInventoryItem(
          newItem.category,
          newItem.type,
          newItem.size, // Pass original size, not normalized
          session
        );
          
          if (inventoryItem) {
            console.log(`✅ Strategy 1 SUCCESS: Found with current category/type`);
          }
          
          // Strategy 2: If not found, try with normalized category/type (for items not yet normalized)
          if (!inventoryItem) {
            const normalizedCategory = normalizeCategoryForStorage(newItem.category, newItem.type);
            const normalizedType = normalizeTypeName(newItem.category, newItem.type);
            
            // Only retry if normalized values are different
            if ((normalizedCategory !== newItem.category || normalizedType !== newItem.type)) {
              console.log(`🔄 Strategy 2: Retrying with normalized category/type: "${normalizedCategory}" / "${normalizedType}"`);
              try {
                inventoryItem = await findInventoryItem(
                  normalizedCategory,
                  normalizedType,
                  newItem.size,
                  session
                );
                
                if (inventoryItem) {
                  console.log(`✅ Strategy 2 SUCCESS: Found with normalized category/type: ID=${inventoryItem._id}, quantity=${inventoryItem.quantity}`);
                }
              } catch (retryError: any) {
                console.warn(`⚠️  Error in Strategy 2:`, retryError.message);
              }
            }
          }
          
          // Strategy 3: For accessories, ALWAYS try both new and old categories
          // CRITICAL: Database might have items with EITHER "Accessories No 3" OR "Uniform No 3" category
          // So we try BOTH to ensure we find the item regardless of migration status
          if (!inventoryItem && isAccessory) {
            // Determine which categories to try based on accessory type
            const accessoryTypesNo3 = ['apulet', 'integrity badge', 'shoulder badge', 'gold badge', 'cel bar', 'beret logo pin', 'belt no 3', 'nametag', 'name tag'];
            const accessoryTypesNo4 = ['apm tag', 'belt no 4'];
            
            const typeLower = newItem.type.toLowerCase();
            const catLower = newItem.category?.toLowerCase() || '';
            
            // Determine which categories to try
            const categoriesToTry: string[] = [];
            
            if (accessoryTypesNo3.some(acc => typeLower.includes(acc)) || catLower.includes('no 3')) {
              // Try both "Accessories No 3" and "Uniform No 3"
              if (!catLower.includes('accessories no 3')) categoriesToTry.push('Accessories No 3');
              if (!catLower.includes('uniform no 3')) categoriesToTry.push('Uniform No 3');
            } else if (accessoryTypesNo4.some(acc => typeLower.includes(acc)) || catLower.includes('no 4')) {
              // Try both "Accessories No 4" and "Uniform No 4"
              if (!catLower.includes('accessories no 4')) categoriesToTry.push('Accessories No 4');
              if (!catLower.includes('uniform no 4')) categoriesToTry.push('Uniform No 4');
            }
            
            // Try each category until we find the item
            for (const tryCategory of categoriesToTry) {
              if (inventoryItem) break; // Already found, stop searching
              
              console.log(`🔄 Strategy 3: Retrying with category "${tryCategory}" for accessory "${newItem.type}"`);
              try {
                inventoryItem = await findInventoryItem(
                  tryCategory,
                  newItem.type,
                  newItem.size,
                  session
                );
                
                if (inventoryItem) {
                  console.log(`✅ Strategy 3 SUCCESS: Found with category "${tryCategory}": ID=${inventoryItem._id}, quantity=${inventoryItem.quantity}`);
                  break; // Found it, stop searching
                }
              } catch (retryError: any) {
                console.warn(`⚠️  Error in Strategy 3 (trying category "${tryCategory}"):`, retryError.message);
                // Continue to next category
              }
            }
          }
        } catch (inventoryError: any) {
          console.error(`❌ Error searching for inventory item: ${newItem.category} / ${newItem.type} / ${newItem.size}`, inventoryError);
          
          // For accessories, continue (non-blocking) - allow saving even if inventory search fails
          if (isAccessory) {
            console.log(`⏭️  Error searching inventory for accessory (non-blocking): ${newItem.type} - Continuing without inventory deduction`);
            inventoryItem = null; // Set to null so we skip deduction
          } else {
            // For main items, this is a serious error - re-throw (will be caught by outer catch)
            console.error(`❌ CRITICAL: Error searching inventory for main item - aborting transaction`);
            throw inventoryError; // Re-throw for main items
          }
        }
        
        if (inventoryItem) {
          console.log(`✅ Found inventory item: ID=${inventoryItem._id}, currentQuantity=${inventoryItem.quantity}`);
        } else {
          console.warn(`⚠️  Inventory item NOT found for: ${newItem.category} / ${newItem.type} / ${newItem.size || 'EMPTY/NULL'}`);
          
          // For accessories, allow saving without inventory check (non-blocking)
          if (isAccessory) {
            console.log(`⏭️  Skipping inventory deduction for accessory (inventory not found but allowing save): ${newItem.category} / ${newItem.type}`);
            continue; // Skip inventory deduction for this accessory but allow uniform to save
          }
        }

        // If inventory item still not found after all retries
        // Note: Accessories should have already been skipped with 'continue' above
        if (!inventoryItem) {
          // This should only happen for main items (non-accessories) at this point
          // because accessories are skipped above with 'continue'
          console.error(`❌ CRITICAL: Inventory item NOT found for main item: ${newItem.category} / ${newItem.type}`);
          
          await session.abortTransaction();
          session.endSession();
          
          // Get available sizes for better error message
          try {
            const normalizedCategoryForSearch = normalizeCategoryForStorage(newItem.category, newItem.type);
          const allItems = await UniformInventory.find({
              $or: [
                { category: { $regex: new RegExp(`^${newItem.category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
                // Also try normalized category
                { category: { $regex: new RegExp(`^${normalizedCategoryForSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
              ],
            type: { $regex: new RegExp(`^${newItem.type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
          }).limit(10);
          
          const availableSizes = allItems.map(i => i.size).filter(s => s).join(', ') || 'none';
            const sizeText = newItem.size ? ` size "${newItem.size}"` : ' (no size)';
          
            console.error('❌ Item not found in inventory (main item):', {
            searched: { category: newItem.category, type: newItem.type, size: newItem.size },
              normalizedCategory: normalizedCategoryForSearch,
              available: allItems.map(i => ({ size: i.size, quantity: i.quantity, category: i.category, type: i.type }))
          });
          
          return res.status(400).json({ 
            success: false, 
            message: `Item "${newItem.type}"${sizeText} is not available in inventory. Available sizes: ${availableSizes || 'none'}. Please contact administrator.`,
            searchedSize: newItem.size,
              availableSizes: allItems.map(i => i.size).filter(Boolean),
              searchedCategory: newItem.category,
              searchedType: newItem.type
            });
          } catch (findError: any) {
            console.error('❌ Error finding available items:', findError);
            return res.status(400).json({
              success: false,
              message: `Item "${newItem.type}" is not available in inventory. Please contact administrator.`,
              error: findError.message
          });
          }
        }

        // Check if sufficient quantity available for the net increase
        if (inventoryItem.quantity < netIncrease) {
          await session.abortTransaction();
          session.endSession();
          const sizeText = normalizedSize ? ` size ${normalizedSize}` : '';
          return res.status(400).json({ 
            success: false, 
            message: `Insufficient inventory for "${newItem.type}"${sizeText}. Available: ${inventoryItem.quantity}, Requested: ${netIncrease}` 
          });
        }

        inventoryUpdates.push({
          item: newItem,
          inventoryId: String(inventoryItem._id),
          currentQuantity: inventoryItem.quantity,
          deduction: netIncrease
        });
        
        console.log(`📉 Will deduct ${netIncrease} (net increase) from inventory: ${newItem.type} (${newItem.size || 'no size'})`);
      } else {
        // Item exists with same quantity and no size change - skip deduction
        console.log(`⏭️  Skipping deduction for existing item (no change): ${newItem.type} (${newItem.size || 'no size'}) - Old Qty: ${oldQuantity}, New Qty: ${newQuantity}`);
      }
    }
    
    console.log(`📊 Deduction summary: ${inventoryUpdates.length} items to deduct`);

    // Step 3: First, restore inventory for removed/changed items
    for (const restore of inventoryRestores) {
      const inventoryItem = await UniformInventory.findById(restore.inventoryId).session(session);
      if (!inventoryItem) continue;
      
      const newQuantity = inventoryItem.quantity + restore.restore;
      const newStatus = calculateStockStatus(newQuantity);
      
      await UniformInventory.findByIdAndUpdate(
        restore.inventoryId,
        { 
          $inc: { quantity: restore.restore },
          status: newStatus
        },
        { session }
      );
      
      console.log(`✅ Restored ${restore.restore} to inventory: ${restore.item.type} (${restore.item.size || 'no size'}) - New quantity: ${newQuantity}, Status: ${newStatus}`);
    }
    
    // Step 4: Then, deduct inventory for new/changed items (all or nothing)
    for (const update of inventoryUpdates) {
      // Get current quantity to calculate new status
      const inventoryItem = await UniformInventory.findById(update.inventoryId).session(session);
      if (!inventoryItem) continue;
      
      const newQuantity = inventoryItem.quantity - update.deduction;
      const newStatus = calculateStockStatus(newQuantity);
      
      await UniformInventory.findByIdAndUpdate(
        update.inventoryId,
        { 
          $inc: { quantity: -update.deduction },
          status: newStatus
        },
        { session }
      );
      
      console.log(`📉 Deducted ${update.deduction} from inventory: ${update.item.type} (${update.item.size || 'no size'}) - Remaining: ${newQuantity}, Status: ${newStatus}`);
    }

    // Step 5: Save uniform collection
    // Ensure all items have required fields - size must be a string (use empty string for accessories without size)
    // CRITICAL: Use normalizedItems (already normalized above) - just ensure size is correct format
    validatedItems = normalizedItems.map((item: any) => {
      // Ensure size is always a string (required by schema)
      // Handle null from frontend - convert to empty string for accessories
      let itemSize = item.size;
      if (itemSize === null || itemSize === undefined || itemSize === '' || itemSize === 'N/A' || String(itemSize).toLowerCase() === 'n/a') {
        itemSize = ''; // Empty string for accessories (schema setter will handle it)
      } else {
        itemSize = String(itemSize).trim(); // Convert to string for main items
      }
      
      // Validate category after normalization
      if (!isValidCategory(item.category)) {
        throw new Error(`Invalid category "${item.category}" after normalization. This should not happen.`);
      }
      
      return {
        category: item.category, // Already normalized above
        type: item.type, // Already normalized above
        size: itemSize, // Empty string for accessories, actual size for main items
        quantity: Number(item.quantity) || 1, // Ensure it's a number, default to 1
        color: item.color || null,
        notes: item.notes || null,
        // Include status field if provided (valid values: 'Available', 'Not Available', 'Missing')
        status: (item.status && ['Available', 'Not Available', 'Missing'].includes(item.status)) 
          ? item.status 
          : undefined, // Don't set status if not provided or invalid - schema will handle default
        // Handle missingCount: if status is Missing, default to 1 if not provided (will be incremented on merge if item exists)
        missingCount: (item.status === 'Missing') 
          ? (item.missingCount !== undefined && item.missingCount !== null ? Number(item.missingCount) : 1)
          : undefined,
        receivedDate: (item.status === 'Available' && item.receivedDate) 
          ? (item.receivedDate instanceof Date ? item.receivedDate : new Date(item.receivedDate))
          : undefined
      };
    });
    
    console.log(`📋 Final validated items (all normalized):`, validatedItems.map((i: any) => 
      `${i.category}/${i.type}/size:"${i.size || 'EMPTY'}"`).join(', '));
    console.log(`📋 Validated items JSON:`, JSON.stringify(validatedItems, null, 2));

    let uniform = await MemberUniform.findOne({ sispaId: req.user.sispaId }).session(session);

    if (!uniform) {
      // Create new collection if doesn't exist
      console.log(`📝 Creating NEW uniform collection for ${req.user.sispaId} with ${validatedItems.length} items`);
      uniform = new MemberUniform({
        sispaId: req.user.sispaId,
        items: validatedItems
      });
      
        // Validate before saving
        const validationError = uniform.validateSync();
        if (validationError) {
          console.error('❌ Validation error before save (new uniform):', validationError);
          const errorMessages = Object.values(validationError.errors || {}).map((e: any) => e.message).join(', ');
          throw new Error(`Validation failed: ${errorMessages}`);
        }
        
      await uniform.save({ session });
      console.log(`Created new uniform collection with ${validatedItems.length} items for ${req.user.sispaId} via PUT`);
    } else {
      // FIXED: Merge items instead of replacing (frontend sends items one at a time OR all items at once)
      // CRITICAL: Always merge items with existing items - never replace all items
      // This ensures all previously saved items are preserved
      
      // Define getItemKey function for merging (use same logic for single and multiple items)
      const getItemKey = (item: any): string => {
        try {
          const normalizedSize = item.size ? normalizeSize(item.size) : 'NO_SIZE';
          const normalizedCategory = (item.category || '').toLowerCase().trim();
          const normalizedType = normalizeTypeForMatching(item.type || '');
          return `${normalizedCategory}::${normalizedType}::${normalizedSize}`;
        } catch (err) {
          console.error('Error creating item key:', err, item);
          throw new Error(`Invalid item data: ${JSON.stringify(item)}`);
        }
      };
      
      // Check if request has only 1 item - if so, merge it with existing items
      // If request has multiple items, merge all of them with existing items (don't replace)
      const isSingleItemUpdate = validatedItems.length === 1;
      
      console.log(`🔍 UPDATE MODE CHECK: Request has ${validatedItems.length} item(s), Existing uniform has ${uniform.items.length} item(s)`);
      console.log(`   Is single item update: ${isSingleItemUpdate}`);
      console.log(`   Existing items:`, uniform.items.map((i: any) => `${i.type} (${i.size || 'no size'})`).join(', '));
      console.log(`   New items to merge:`, validatedItems.map((i: any) => `${i.type} (${i.size || 'no size'})`).join(', '));
      
      if (isSingleItemUpdate) {
        // MERGE MODE: Add or update single item without replacing existing items
        const newItem = validatedItems[0];
        console.log(`📝 MERGE MODE: Processing single item: ${newItem.type} (${newItem.size || 'no size'})`);
        console.log(`   Existing items before merge: ${uniform.items.length} items`);
        console.log(`   Existing items:`, uniform.items.map((i: any) => `${i.type} (${i.size || 'no size'})`).join(', '));
        
        const itemKey = getItemKey(newItem);
        console.log(`   New item key: ${itemKey}`);
        
        // Check if this exact item already exists
        const existingItemIndex = uniform.items.findIndex((existing: any) => {
          try {
            const existingKey = getItemKey(existing);
            console.log(`   Comparing with existing item: ${existing.type} (${existing.size || 'no size'}) - Key: ${existingKey}`);
            return existingKey === itemKey;
          } catch (err) {
            console.warn(`⚠️  Error comparing item keys:`, err);
            return false;
          }
        });
        
          if (existingItemIndex >= 0) {
            // Update existing item (preserve status if not provided in new item)
            const existingItem = uniform.items[existingItemIndex];
            const existingStatus = existingItem.status || 'Available';
            const newStatus = newItem.status !== undefined ? newItem.status : existingStatus;
            
            // CRITICAL: Track missingCount - increment when status changes to "Missing"
            let finalMissingCount = existingItem.missingCount || 0;
            if (newStatus === 'Missing') {
              if (existingStatus !== 'Missing') {
                // Status changed from non-Missing to Missing - increment count
                finalMissingCount = (existingItem.missingCount || 0) + 1;
                console.log(`📈 Incremented missingCount for ${newItem.type}: ${existingItem.missingCount || 0} → ${finalMissingCount} (status changed to Missing)`);
              } else if (newItem.missingCount !== undefined) {
                // Status is already Missing, but frontend sent a new missingCount value
                finalMissingCount = Number(newItem.missingCount);
                console.log(`📊 Updated missingCount for ${newItem.type} to ${finalMissingCount} (frontend provided value)`);
              }
              // If status is already Missing and frontend didn't send missingCount, keep existing count
            } else if (existingStatus === 'Missing' && newStatus !== 'Missing') {
              // Status changed from Missing to something else - keep count for history (don't reset)
              console.log(`📋 Status changed from Missing to ${newStatus} for ${newItem.type} - keeping missingCount: ${finalMissingCount}`);
            }
            
            const updatedItem = {
              ...newItem,
              // Preserve existing status-related fields if new item doesn't have them
              status: newStatus,
              missingCount: finalMissingCount > 0 ? finalMissingCount : (newStatus === 'Missing' ? 1 : undefined),
              receivedDate: newItem.receivedDate !== undefined ? newItem.receivedDate : existingItem.receivedDate
            };
            uniform.items[existingItemIndex] = updatedItem;
            console.log(`✅ Updated existing item at index ${existingItemIndex}: ${newItem.type} (${newItem.size || 'no size'}) - Status: ${updatedItem.status || 'not set'}, MissingCount: ${updatedItem.missingCount || 0}`);
          } else {
          // Add new item to existing collection
          uniform.items.push(newItem);
          console.log(`✅ Added NEW item to existing uniform: ${newItem.type} (${newItem.size || 'no size'})`);
        }
        
        // Validate before saving
        const validationError = uniform.validateSync();
        if (validationError) {
          console.error('❌ Validation error before save (merge mode):', validationError);
          const errorMessages = Object.values(validationError.errors || {}).map((e: any) => e.message).join(', ');
          throw new Error(`Validation failed: ${errorMessages}`);
        }
        
      await uniform.save({ session });
        console.log(`✅ MERGED item into uniform collection for ${req.user.sispaId}: Total items now: ${uniform.items.length}`);
        console.log(`   All items after merge:`, uniform.items.map((i: any) => `${i.category}/${i.type}/${i.size || 'no size'}`).join(', '));
      } else {
        // MERGE MODE (multiple items): Frontend sent multiple items - merge with existing items
        // CRITICAL: Don't replace all items - merge new items with existing items
        // This ensures all previously saved items are preserved
        console.log(`📝 MERGE MODE (multiple items): Frontend sent ${validatedItems.length} items - merging with existing ${uniform.items.length} items`);
        
        // Merge each new item with existing items (don't replace)
        // This ensures all previously saved items are preserved
        for (const newItem of validatedItems) {
          const itemKey = getItemKey(newItem);
          
          // Check if this exact item already exists in existing items
          const existingItemIndex = uniform.items.findIndex((existing: any) => {
            try {
              const existingKey = getItemKey(existing);
              return existingKey === itemKey;
            } catch (err) {
              console.warn(`⚠️  Error comparing item keys:`, err);
              return false;
            }
          });
          
          if (existingItemIndex >= 0) {
            // Update existing item (preserve status if not provided in new item)
            const existingItem = uniform.items[existingItemIndex];
            const existingStatus = existingItem.status || 'Available';
            const newStatus = newItem.status !== undefined ? newItem.status : existingStatus;
            
            // CRITICAL: Track missingCount - increment when status changes to "Missing"
            let finalMissingCount = existingItem.missingCount || 0;
            if (newStatus === 'Missing') {
              if (existingStatus !== 'Missing') {
                // Status changed from non-Missing to Missing - increment count
                finalMissingCount = (existingItem.missingCount || 0) + 1;
                console.log(`   📈 Incremented missingCount for ${newItem.type}: ${existingItem.missingCount || 0} → ${finalMissingCount} (status changed to Missing)`);
              } else if (newItem.missingCount !== undefined) {
                // Status is already Missing, but frontend sent a new missingCount value
                finalMissingCount = Number(newItem.missingCount);
                console.log(`   📊 Updated missingCount for ${newItem.type} to ${finalMissingCount} (frontend provided value)`);
              }
              // If status is already Missing and frontend didn't send missingCount, keep existing count
            } else if (existingStatus === 'Missing' && newStatus !== 'Missing') {
              // Status changed from Missing to something else - keep count for history (don't reset)
              console.log(`   📋 Status changed from Missing to ${newStatus} for ${newItem.type} - keeping missingCount: ${finalMissingCount}`);
            }
            
            const updatedItem = {
              ...newItem,
              // Preserve existing status-related fields if new item doesn't have them
              status: newStatus,
              missingCount: finalMissingCount > 0 ? finalMissingCount : (newStatus === 'Missing' ? 1 : undefined),
              receivedDate: newItem.receivedDate !== undefined ? newItem.receivedDate : existingItem.receivedDate
            };
            uniform.items[existingItemIndex] = updatedItem;
            console.log(`   ✅ Updated existing item at index ${existingItemIndex}: ${newItem.type} (${newItem.size || 'no size'}) - Status: ${updatedItem.status || 'not set'}, MissingCount: ${updatedItem.missingCount || 0}`);
          } else {
            // Add new item to existing collection (don't replace - preserve all existing items)
            uniform.items.push(newItem);
            console.log(`   ✅ Added NEW item to existing uniform: ${newItem.type} (${newItem.size || 'no size'})`);
          }
        }
        
        console.log(`   Total items after merge: ${uniform.items.length} items`);
        console.log(`   All items after merge:`, uniform.items.map((i: any) => `${i.category}/${i.type}/${i.size || 'no size'}`).join(', '));
        
        // Validate before saving
        const validationError = uniform.validateSync();
        if (validationError) {
          console.error('❌ Validation error before save (merge mode - multiple items):', validationError);
          const errorMessages = Object.values(validationError.errors || {}).map((e: any) => e.message).join(', ');
          throw new Error(`Validation failed: ${errorMessages}`);
        }
        
        await uniform.save({ session });
        console.log(`✅ MERGED ${validatedItems.length} items into uniform collection for ${req.user.sispaId}: Total items now: ${uniform.items.length}`);
      }
    }

    // Commit transaction
    await session.commitTransaction();
    session.endSession();
    
    // Reload uniform from database to ensure we have the latest data after commit
    const savedUniform = await MemberUniform.findOne({ sispaId: req.user.sispaId });
    if (!savedUniform) {
      return res.status(500).json({
        success: false,
        message: 'Error: Could not retrieve saved uniform data after update'
      });
    }
    
    console.log(`✅ Uniform updated successfully - SISPA ID: ${savedUniform.sispaId}, Items count: ${savedUniform.items.length}`);
    console.log(`   Updated items:`, savedUniform.items.map((i: any) => `${i.category}/${i.type}/${i.size || 'N/A'}`).join(', '));
    console.log(`🟡 ===== END UPDATE MEMBER UNIFORM REQUEST =====\n`);

    // Format items with status fields for response
    const formattedItems = formatUniformItemsWithStatus(
      savedUniform.items,
      savedUniform.createdAt,
      savedUniform.updatedAt
    );

    res.json({
      success: true,
      message: 'Uniform updated successfully',
      uniform: {
        sispaId: savedUniform.sispaId,
        items: formattedItems,
        itemCount: formattedItems.length
      }
    });
  } catch (error: any) {
    // Rollback transaction on error
    console.error('\n❌❌❌ ERROR CAUGHT IN updateMemberUniform ❌❌❌');
    console.error('Error message:', error.message);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    console.error('Error errors:', JSON.stringify(error.errors, null, 2));
    console.error('Error stack:', error.stack);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    console.error('Normalized items that were being saved:', JSON.stringify(normalizedItems || [], null, 2));
    console.error('Validated items that were being saved:', JSON.stringify(validatedItems || [], null, 2));
    
    try {
      if (session && session.inTransaction()) {
        await session.abortTransaction();
      }
      if (session) {
      session.endSession();
      }
    } catch (sessionError: any) {
      console.error('Error closing session:', sessionError);
    }
    
    // Handle Mongoose validation errors (should return 400, not 500)
    if (error.name === 'ValidationError' && error.errors) {
      console.error('Mongoose ValidationError detected - returning 400 instead of 500');
      const validationMessages = Object.values(error.errors).map((e: any) => e.message).join(', ');
      return res.status(400).json({
        success: false,
        message: `Validation error: ${validationMessages}`,
        error: 'Database validation failed',
        validationErrors: error.errors
      });
    }
    
    // Handle duplicate key errors (E11000)
    if (error.code === 11000 || error.name === 'MongoServerError') {
      console.error('Duplicate key error detected - returning 400 instead of 500');
      const duplicateField = Object.keys(error.keyPattern || {})[0];
      return res.status(400).json({
        success: false,
        message: `Duplicate entry detected. A uniform collection already exists for this user.`,
        error: 'Duplicate key error',
        duplicateField
      });
    }
    
    // Check if this is a validation/category error (should return 400, not 500)
    const errorMessage = error.message || 'Unknown error';
    const isValidationError = errorMessage.includes('Invalid category') || 
                              errorMessage.includes('Valid categories are') ||
                              errorMessage.includes('must use category') ||
                              errorMessage.includes('Use "Shirt" instead') ||
                              errorMessage.includes('Validation error');
    
    if (isValidationError) {
      console.error('Validation error detected - returning 400 instead of 500');
      return res.status(400).json({
        success: false,
        message: errorMessage,
        error: 'Validation failed'
      });
    }
    
    const errorStack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
    
    console.error('Sending error response...');
    return res.status(500).json({ 
      success: false, 
      message: 'Error saving uniform to database', 
      error: errorMessage,
      errorType: error.name,
      errorCode: error.code,
      ...(errorStack && { stack: errorStack })
    });
  }
};

// Add member's own uniform items (supports multiple items at once)
export const addOwnUniform = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user.sispaId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { items } = req.body;

    // Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide an array of uniform items. Each item must have: category, type, size, and quantity.' 
      });
    }

    // Validate each item
    for (const item of items) {
      if (!item.category || !item.type || !item.size || item.quantity === undefined) {
        return res.status(400).json({ 
          success: false, 
          message: 'Each uniform item must have: category, type, size, and quantity.' 
        });
      }
      if (item.quantity < 1) {
        return res.status(400).json({ 
          success: false, 
          message: 'Quantity must be at least 1.' 
        });
      }
    }

    // Check if member already has a uniform collection
    let uniform = await MemberUniform.findOne({ sispaId: req.user.sispaId });
    
    if (uniform) {
      // Add new items to existing collection
      uniform.items.push(...items);
      await uniform.save();
      
      return res.status(200).json({
        success: true,
        message: 'Uniform items added successfully',
        uniform: {
          sispaId: uniform.sispaId,
          items: uniform.items,
          itemCount: uniform.items.length
        }
      });
    } else {
      // Create new uniform collection
      const newUniform = new MemberUniform({
        sispaId: req.user.sispaId,
        items: items
      });
      await newUniform.save();

      return res.status(201).json({
        success: true,
        message: 'Uniform collection created successfully',
        uniform: {
          sispaId: newUniform.sispaId,
          items: newUniform.items,
          itemCount: newUniform.items.length
        }
      });
    }
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: 'Error adding uniform', 
      error: error.message 
    });
  }
};

// Update member's own uniform (replace all items or update specific items)
export const updateOwnUniform = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user.sispaId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { items, replaceAll } = req.body;

    // If items provided, validate them
    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (!item.category || !item.type || !item.size || item.quantity === undefined) {
          return res.status(400).json({ 
            success: false, 
            message: 'Each uniform item must have: category, type, size, and quantity.' 
          });
        }
        if (item.quantity < 1) {
          return res.status(400).json({ 
            success: false, 
            message: 'Quantity must be at least 1.' 
          });
        }
      }
    }

    let uniform = await MemberUniform.findOne({ sispaId: req.user.sispaId });

    if (!uniform) {
      // Create new if doesn't exist
      if (items && Array.isArray(items)) {
        uniform = new MemberUniform({
          sispaId: req.user.sispaId,
          items: items
        });
        await uniform.save();
        
        return res.json({
          success: true,
          message: 'Uniform collection created successfully',
          uniform: {
            sispaId: uniform.sispaId,
            items: uniform.items,
            itemCount: uniform.items.length
          }
        });
      } else {
        return res.status(404).json({ 
          success: false, 
          message: 'Uniform not found. Use POST to create a new uniform collection.' 
        });
      }
    }

    // Update items
    if (replaceAll && items && Array.isArray(items)) {
      // Replace all items
      uniform.items = items;
    } else if (items && Array.isArray(items)) {
      // Replace all items (default behavior)
      uniform.items = items;
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide items array to update.' 
      });
    }

    await uniform.save();

    res.json({
      success: true,
      message: 'Uniform updated successfully',
      uniform: {
        sispaId: uniform.sispaId,
        items: uniform.items,
        itemCount: uniform.items.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: 'Error updating uniform', 
      error: error.message 
    });
  }
};

// Add a single uniform item to member's collection
export const addUniformItem = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user.sispaId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { category, type, size, quantity, color, notes } = req.body;

    if (!category || !type || !size || quantity === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: category, type, size, and quantity are required' 
      });
    }

    if (quantity < 1) {
      return res.status(400).json({ 
        success: false, 
        message: 'Quantity must be at least 1' 
      });
    }

    let uniform = await MemberUniform.findOne({ sispaId: req.user.sispaId });

    if (!uniform) {
      // Create new collection with this item
      uniform = new MemberUniform({
        sispaId: req.user.sispaId,
        items: [{ category, type, size, quantity, color: color || null, notes: notes || null }]
      });
    } else {
      // Add item to existing collection
      uniform.items.push({ category, type, size, quantity, color: color || null, notes: notes || null });
    }

    await uniform.save();

    res.json({
      success: true,
      message: 'Uniform item added successfully',
      uniform: {
        sispaId: uniform.sispaId,
        items: uniform.items,
        itemCount: uniform.items.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: 'Error adding uniform item', 
      error: error.message 
    });
  }
};

// Delete a specific uniform item from member's collection
export const deleteUniformItem = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user.sispaId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { itemIndex } = req.body; // Index of item to delete

    if (itemIndex === undefined || typeof itemIndex !== 'number') {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide itemIndex (number) to delete' 
      });
    }

    const uniform = await MemberUniform.findOne({ sispaId: req.user.sispaId });

    if (!uniform) {
      return res.status(404).json({ 
        success: false, 
        message: 'Uniform collection not found' 
      });
    }

    if (itemIndex < 0 || itemIndex >= uniform.items.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid item index' 
      });
    }

    // Remove item at index
    uniform.items.splice(itemIndex, 1);
    await uniform.save();

    res.json({
      success: true,
      message: 'Uniform item deleted successfully',
      uniform: {
        sispaId: uniform.sispaId,
        items: uniform.items,
        itemCount: uniform.items.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting uniform item', 
      error: error.message 
    });
  }
};

// ===============================
// SIZE CHART MANAGEMENT
// ===============================

// GET /api/inventory/size-charts - Get all size charts grouped by category and type
export const getSizeCharts = async (req: Request, res: Response) => {
  try {
    // Get all inventory items with size charts
    const itemsWithCharts = await UniformInventory.find({
      sizeChart: { $exists: true, $ne: null }
    }).select('category type sizeChart');

    // Group by category-type and get unique size charts
    const sizeChartMap: Record<string, string> = {};
    
    itemsWithCharts.forEach(item => {
      const key = `${item.category}-${item.type}`;
      if (item.sizeChart && !sizeChartMap[key]) {
        sizeChartMap[key] = item.sizeChart;
      }
    });

    // Also return as array format for easier frontend consumption
    const sizeChartsArray = Object.entries(sizeChartMap).map(([key, sizeChart]) => {
      const [category, ...typeParts] = key.split('-');
      const type = typeParts.join('-');
      return {
        category,
        type,
        sizeChart
      };
    });

    res.json({
      success: true,
      sizeCharts: sizeChartMap, // Object format: "Category-Type": "url"
      sizeChartsArray // Array format for easier iteration
    });
  } catch (error: any) {
    console.error('Error fetching size charts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching size charts',
      error: error.message
    });
  }
};

// ===============================
// SHIRT PRICE MANAGEMENT
// ===============================

// GET /api/inventory/shirt-prices - Get all shirt prices
export const getShirtPrices = async (req: AuthRequest, res: Response) => {
  try {
    // Get all shirt prices (or create defaults if they don't exist)
    const shirtTypes = ['Digital Shirt', 'Company Shirt', 'Inner APM Shirt'];
    const prices: any = {};

    for (const type of shirtTypes) {
      let priceDoc = await ShirtPrice.findOne({ type });
      if (!priceDoc) {
        // Create default entry with null price
        priceDoc = new ShirtPrice({ type, price: null });
        await priceDoc.save();
      }
      // Map to camelCase for frontend
      const key = type === 'Digital Shirt' ? 'digitalShirt' :
                   type === 'Company Shirt' ? 'companyShirt' :
                   'innerApmShirt';
      prices[key] = priceDoc.price;
    }

    res.json({
      success: true,
      prices
    });
  } catch (error: any) {
    console.error('Error fetching shirt prices:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching shirt prices',
      error: error.message
    });
  }
};

// PUT /api/inventory/shirt-prices - Update shirt price (Admin only)
export const updateShirtPrice = async (req: AuthRequest, res: Response) => {
  try {
    const { type, price } = req.body;

    // Validate shirt type
    const validTypes = ['Digital Shirt', 'Company Shirt', 'Inner APM Shirt'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid shirt type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Validate price (can be null to unset, or a positive number)
    if (price !== null && (typeof price !== 'number' || price < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a positive number or null to unset'
      });
    }

    // Update or create shirt price
    const priceDoc = await ShirtPrice.findOneAndUpdate(
      { type },
      { price, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'Shirt price updated successfully',
      price: {
        type: priceDoc.type,
        price: priceDoc.price
      }
    });
  } catch (error: any) {
    console.error('Error updating shirt price:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating shirt price',
      error: error.message 
    });
  }
};
