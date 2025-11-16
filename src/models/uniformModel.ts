import mongoose from 'mongoose';

const uniformSchema = new mongoose.Schema({
  id: String,
  category: String,
  type: String,
  size: String,
  quantity: Number,
  status: {
    type: String,
    enum: ['in-stock', 'low-stock', 'out-of-stock']
  },
  // Link uniform to member (for member's personal uniform)
  memberId: {
    type: String,
    ref: 'Member',
    required: false // Not required for inventory items, required for member uniforms
  }
});

export const Uniform = mongoose.model('Uniform', uniformSchema);
