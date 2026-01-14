import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { UniformInventory } from '../src/models/uniformModel';

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI as string;

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

async function addStatusToInventory() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected successfully');

    // Find all inventory items without status or with null status
    const items = await UniformInventory.find({
      $or: [
        { status: { $exists: false } },
        { status: null }
      ]
    });

    console.log(`\n📋 Found ${items.length} inventory items without status field`);

    if (items.length === 0) {
      console.log('✅ All inventory items already have status field');
      process.exit(0);
    }

    // Update each item with calculated status
    let updated = 0;
    for (const item of items) {
      const status = calculateStockStatus(item.quantity);
      await UniformInventory.findByIdAndUpdate(item._id, { status });
      updated++;
      console.log(`  ✓ Updated ${item.name} (${item.category} - ${item.type}): ${item.quantity} → ${status}`);
    }

    console.log(`\n✅ Successfully updated ${updated} inventory items with status field`);
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
addStatusToInventory();

