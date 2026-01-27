import mongoose, { Schema, Document } from 'mongoose';

// Individual uniform item schema
export interface IUniformItem {
  category: string; // e.g., "Shirt", "Pants", "Shoes", "Hat", "Jacket"
  type: string; // e.g., "Polo Shirt", "Long Pants", "Sneakers"
  size: string; // e.g., "S", "M", "L", "XL", "42", "10"
  quantity: number; // How many of this item
  color?: string; // Optional color
  notes?: string; // Optional notes
  status?: 'Available' | 'Not Available' | 'Missing'; // Optional status field
  missingCount?: number; // Optional: count of times this item has been missing for this user
  receivedDate?: Date | string; // Optional: date when item was received/issued (ISO date string)
}

// Uniform inventory item (for admin inventory management)
export interface IUniformInventory extends Document {
  name: string;
  category: string; // "Uniform No 3", "Uniform No 4", "Accessories No 3", "Accessories No 4", "Shirt" (or "T-Shirt" for backward compatibility)
  type: string;
  size: string | null; // Nullable for accessories
  quantity: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  recommendedStock?: number; // Recommended stock level from Colab
  lastRecommendationDate?: Date; // When recommendation was last updated
  image?: string | null; // Base64 encoded image or URL (optional, same for all sizes of same type)
  sizeChart?: string | null; // URL or path to size chart image (optional, same for all sizes of same type)
  price?: number | null; // Price in RM (optional, mainly for shirt items)
}

// Member's uniform collection (stores all uniform items for a user)
export interface IMemberUniform extends Document {
  sispaId: string; // Link to member
  items: IUniformItem[]; // Array of uniform items
  updatedAt: Date;
  createdAt: Date;
}

// Inventory schema (for admin - stock management)
const uniformInventorySchema = new Schema<IUniformInventory>({
  name: { type: String, required: true },
  category: { 
    type: String, 
    required: true,
    // Removed enum restriction - categories are validated in controller (5-category structure)
    // Valid categories: "Uniform No 3", "Uniform No 4", "Accessories No 3", "Accessories No 4", "Shirt"
    // Backward compatibility: "T-Shirt" is also accepted and normalized to "Shirt"
    index: true
  },
  type: { 
    type: String, 
    required: true,
    index: true
  },
  size: { 
    type: mongoose.Schema.Types.Mixed, // Use Mixed to allow both String and null
    default: null, // Nullable for accessories
    required: false, // Make it optional - accessories don't have sizes
    // Allow null or empty string for accessories
    set: function(value: any) {
      if (value === null || value === undefined || value === '' || value === 'N/A' || String(value).toLowerCase() === 'n/a') {
        return null; // Keep null for accessories (database compatible)
      }
      return String(value).trim(); // Convert to string and trim for main items
    },
    index: true
  },
  quantity: { type: Number, required: true, default: 0, min: 0 },
  status: { 
    type: String, 
    enum: ['In Stock', 'Low Stock', 'Out of Stock'],
    default: 'Out of Stock',
    index: true
  },
  recommendedStock: {
    type: Number,
    default: undefined,
    min: 0
  },
  lastRecommendationDate: {
    type: Date,
    default: undefined
  },
  image: {
    type: String,
    default: null, // Optional - Base64 encoded image or URL
    required: false
  },
  sizeChart: {
    type: String,
    default: null, // Optional - URL or path to size chart image
    required: false
  },
  price: {
    type: Number,
    default: null, // Optional - Price in RM (mainly for shirt items)
    required: false,
    min: 0
  }
}, { 
  timestamps: true,
  // Unique constraint on (category, type, size) to prevent duplicates
  // Note: MongoDB handles null as a value in unique indexes, so multiple nulls are allowed
  // We need a compound unique index for proper duplicate prevention
});

// Create compound unique index on (category, type, size)
uniformInventorySchema.index({ category: 1, type: 1, size: 1 }, { unique: true });

// Performance indexes for common queries
// Index for category queries (already exists as single field, but compound helps sorting)
uniformInventorySchema.index({ category: 1, type: 1 }); // For category+type queries
uniformInventorySchema.index({ category: 1, status: 1 }); // For category+status filtering
uniformInventorySchema.index({ type: 1, size: 1 }); // For type+size queries
uniformInventorySchema.index({ status: 1 }); // For status filtering (already exists, but explicit)
uniformInventorySchema.index({ createdAt: -1 }); // For sorting by creation date
uniformInventorySchema.index({ updatedAt: -1 }); // For sorting by update date

// Member uniform schema (for users - their personal uniform collection)
const memberUniformSchema = new Schema<IMemberUniform>({
  sispaId: {
    type: String,
    ref: 'Member',
    required: true,
    unique: true // One uniform collection per user
  },
  items: [{
    category: { type: String, required: true },
    type: { type: String, required: true },
    size: { 
      type: String, 
      required: false, // Make it optional - accessories can have null/empty size
      // Normalize: null or empty string for accessories, actual size for main items
      // Frontend can send null or empty string for accessories
      // CRITICAL: Mongoose String type doesn't accept null, so we convert null to empty string
      set: function(value: any) {
        // Handle null/undefined/empty/N/A for accessories
        if (value === null || value === undefined || value === '' || value === 'N/A' || String(value).toLowerCase() === 'n/a') {
          return ''; // Use empty string for accessories (Mongoose String type requires non-null)
        }
        return String(value).trim(); // Convert to string and trim for main items
      },
      default: '', // Default to empty string for accessories
      validate: {
        validator: function(value: any) {
          // Allow empty string for accessories, or any non-empty string for main items
          return value === null || value === undefined || value === '' || (typeof value === 'string' && value.trim().length > 0);
        },
        message: 'Size must be a string (empty string for accessories, or actual size for main items)'
      }
    },
    quantity: { type: Number, required: true, default: 1, min: 1 },
    color: { type: String, default: null },
    notes: { type: String, default: null },
    status: { 
      type: String, 
      enum: ['Available', 'Not Available', 'Missing'],
      default: undefined,
      required: false
    },
    missingCount: { 
      type: Number, 
      default: 0,
      required: false,
      min: 0
    },
    receivedDate: { 
      type: Date, 
      default: undefined,
      required: false
    }
  }],
}, { timestamps: true });

// Export both models
export const UniformInventory = mongoose.model<IUniformInventory>('UniformInventory', uniformInventorySchema);
export const MemberUniform = mongoose.model<IMemberUniform>('MemberUniform', memberUniformSchema);

// Keep old Uniform model for backward compatibility (will be deprecated)
export const Uniform = UniformInventory;
