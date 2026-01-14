import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { UniformInventory } from '../src/models/uniformModel';

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI as string;

async function addImageAndSizeChartFields() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected successfully\n');

    // Find all inventory items without image or sizeChart fields
    const itemsWithoutFields = await UniformInventory.find({
      $or: [
        { image: { $exists: false } },
        { sizeChart: { $exists: false } }
      ]
    });

    console.log(`📋 Found ${itemsWithoutFields.length} inventory items missing image or sizeChart fields`);

    if (itemsWithoutFields.length === 0) {
      console.log('✅ All inventory items already have image and sizeChart fields');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Update all items to explicitly set image and sizeChart to null if they don't exist
    let updated = 0;
    for (const item of itemsWithoutFields) {
      const updateData: any = {};
      
      if (!item.image && item.image !== null) {
        updateData.image = null;
      }
      
      if (!item.sizeChart && item.sizeChart !== null) {
        updateData.sizeChart = null;
      }

      if (Object.keys(updateData).length > 0) {
        await UniformInventory.findByIdAndUpdate(item._id, { $set: updateData });
        updated++;
        const fields = Object.keys(updateData).join(', ');
        console.log(`  ✓ Updated ${item.name || item.type} (${item.category} - ${item.type}): Added ${fields}`);
      }
    }

    console.log(`\n✅ Successfully updated ${updated} inventory items with image and sizeChart fields`);
    
    // Also update all items that might have undefined values
    const updateResult = await UniformInventory.updateMany(
      {
        $or: [
          { image: undefined },
          { sizeChart: undefined }
        ]
      },
      {
        $set: {
          image: null,
          sizeChart: null
        }
      }
    );

    if (updateResult.modifiedCount > 0) {
      console.log(`✅ Also updated ${updateResult.modifiedCount} items with undefined values`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error during migration:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the migration
addImageAndSizeChartFields();
