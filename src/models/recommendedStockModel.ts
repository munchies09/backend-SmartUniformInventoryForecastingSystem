import mongoose, { Schema, Document } from 'mongoose';

// Recommended stock from Google Colab analysis
export interface IRecommendedStock extends Document {
  category: string;
  type: string;
  size: string | null;
  gender?: 'male' | 'female' | null; // Gender for Uniform No 3 (male/female), null for others
  recommendedStock: number; // Recommended stock level from Colab
  currentStock: number; // Current stock at time of recommendation
  forecastedDemand?: number; // Forecasted demand (if available)
  reorderQuantity?: number; // How many units to reorder
  analysisDate: Date; // When this recommendation was generated
  notes?: string; // Any notes from Colab analysis
  source: string; // e.g., "google_colab", "manual"
}

const recommendedStockSchema = new Schema<IRecommendedStock>({
  category: {
    type: String,
    required: true,
    enum: ['Uniform No 3', 'Uniform No 4', 'T-Shirt', 'Others'],
    index: true
  },
  type: {
    type: String,
    required: true,
    index: true
  },
  size: {
    type: String,
    default: null, // Nullable for accessories
    index: true
  },
  gender: {
    type: String,
    enum: {
      values: ['male', 'female'],
      message: 'Gender must be either "male" or "female"'
    },
    default: null, // null for items without gender distinction
    required: false,
    index: true,
    validate: {
      validator: function(value: any) {
        // Allow null, undefined, or valid enum values
        return value === null || value === undefined || ['male', 'female'].includes(value);
      },
      message: 'Gender must be "male", "female", or null'
    }
  },
  recommendedStock: {
    type: Number,
    required: true,
    min: 0
  },
  currentStock: {
    type: Number,
    required: true,
    min: 0
  },
  forecastedDemand: {
    type: Number,
    default: undefined,
    min: 0
  },
  reorderQuantity: {
    type: Number,
    default: undefined,
    min: 0
  },
  analysisDate: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  notes: {
    type: String,
    default: undefined
  },
  source: {
    type: String,
    required: true,
    default: 'google_colab',
    enum: ['google_colab', 'manual', 'system', 'ml_model']
  }
}, { timestamps: true });

// Compound index for quick lookup of latest recommendations
recommendedStockSchema.index({ category: 1, type: 1, size: 1, analysisDate: -1 });

// Unique index to prevent duplicate recommendations for same item on same day
recommendedStockSchema.index(
  { category: 1, type: 1, size: 1, analysisDate: 1 },
  { unique: true, partialFilterExpression: { source: 'google_colab' } }
);

export const RecommendedStock = mongoose.model<IRecommendedStock>(
  'RecommendedStock',
  recommendedStockSchema
);
