import mongoose from 'mongoose';

const batchSchema = new mongoose.Schema({
  id: String,
  batchNumber: Number,
  year: Number,
  totalMembers: Number,
  status: {
    type: String,
    enum: ['active', 'completed']
  },
  createdDate: String
});

export const Batch = mongoose.model('Batch', batchSchema);
