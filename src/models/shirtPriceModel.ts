import mongoose, { Schema, Document } from 'mongoose';

// Shirt price model for storing shirt prices
export interface IShirtPrice extends Document {
  type: string; // "Digital Shirt", "Company Shirt", "Inner APM Shirt"
  price: number | null; // Price in RM, or null if not set
  updatedAt: Date;
}

const shirtPriceSchema = new Schema<IShirtPrice>({
  type: {
    type: String,
    required: true,
    unique: true,
    enum: ['Digital Shirt', 'Company Shirt', 'Inner APM Shirt'],
    index: true
  },
  price: {
    type: Number,
    default: null,
    min: 0
  }
}, { 
  timestamps: { createdAt: false, updatedAt: true } // Only track updatedAt
});

export const ShirtPrice = mongoose.model<IShirtPrice>('ShirtPrice', shirtPriceSchema);
