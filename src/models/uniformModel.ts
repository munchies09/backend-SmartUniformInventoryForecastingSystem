import mongoose, { Schema, Document } from 'mongoose';

// Individual uniform item schema
export interface IUniformItem {
  category: string; // e.g., "Shirt", "Pants", "Shoes", "Hat", "Jacket"
  type: string; // e.g., "Polo Shirt", "Long Pants", "Sneakers"
  size: string; // e.g., "S", "M", "L", "XL", "42", "10"
  quantity: number; // How many of this item
  color?: string; // Optional color
  notes?: string; // Optional notes
}

// Uniform inventory item (for admin inventory management)
export interface IUniformInventory extends Document {
  id: string;
  category: string;
  type: string;
  size: string;
  quantity: number;
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
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
  id: { type: String, required: true },
  category: { type: String, required: true },
  type: { type: String, required: true },
  size: { type: String, required: true },
  quantity: { type: Number, required: true, default: 0 },
  status: {
    type: String,
    enum: ['in-stock', 'low-stock', 'out-of-stock'],
    default: 'out-of-stock'
  }
}, { timestamps: true });

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
    size: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1, min: 1 },
    color: { type: String, default: null },
    notes: { type: String, default: null }
  }],
}, { timestamps: true });

// Export both models
export const UniformInventory = mongoose.model<IUniformInventory>('UniformInventory', uniformInventorySchema);
export const MemberUniform = mongoose.model<IMemberUniform>('MemberUniform', memberUniformSchema);

// Keep old Uniform model for backward compatibility (will be deprecated)
export const Uniform = UniformInventory;
