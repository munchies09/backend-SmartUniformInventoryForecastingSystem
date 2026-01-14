/**
 * Migration Script: Rename "Gold Badge" to "Shoulder Badge"
 * 
 * This script updates all database records that reference "Gold Badge" to use "Shoulder Badge" instead.
 * 
 * Usage:
 *   npm run migrate-gold-to-shoulder-badge
 * 
 * Or run directly:
 *   ts-node scripts/migrateGoldToShoulderBadge.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { UniformInventory, MemberUniform } from '../src/models/uniformModel';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-uniform';

/**
 * Main migration function
 */
async function migrateGoldToShoulderBadge() {
  try {
    console.log('🔄 Starting migration: Gold Badge → Shoulder Badge');
    console.log('Connecting to MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    let totalUpdated = 0;

    // ========================================
    // 1. Update UniformInventory Collection
    // ========================================
    console.log('\n📦 Updating UniformInventory collection...');
    
    const inventoryResult = await UniformInventory.updateMany(
      { type: 'Gold Badge' },
      { $set: { type: 'Shoulder Badge' } }
    );
    
    console.log(`   ✅ Updated ${inventoryResult.modifiedCount} inventory items`);
    totalUpdated += inventoryResult.modifiedCount;

    // Verify inventory update
    const remainingGoldBadgeInventory = await UniformInventory.countDocuments({ type: 'Gold Badge' });
    const shoulderBadgeInventory = await UniformInventory.countDocuments({ type: 'Shoulder Badge' });
    console.log(`   📊 Remaining "Gold Badge" in inventory: ${remainingGoldBadgeInventory}`);
    console.log(`   📊 Total "Shoulder Badge" in inventory: ${shoulderBadgeInventory}`);

    // ========================================
    // 2. Update MemberUniform Collection (items array)
    // ========================================
    console.log('\n👤 Updating MemberUniform collection...');
    
    // Find all member uniforms that contain "Gold Badge" in items array
    const memberUniforms = await MemberUniform.find({
      'items.type': 'Gold Badge'
    });

    let memberUniformsUpdated = 0;
    for (const uniform of memberUniforms) {
      let updated = false;
      
      // Update each item that has type "Gold Badge"
      for (let i = 0; i < uniform.items.length; i++) {
        if (uniform.items[i].type === 'Gold Badge') {
          uniform.items[i].type = 'Shoulder Badge';
          updated = true;
        }
      }
      
      if (updated) {
        await uniform.save();
        memberUniformsUpdated++;
      }
    }

    console.log(`   ✅ Updated ${memberUniformsUpdated} member uniform records`);
    console.log(`   ✅ Updated items in ${memberUniforms.length} uniform collections`);
    totalUpdated += memberUniformsUpdated;

    // Count updated items in member uniforms
    const remainingGoldBadgeInUniforms = await MemberUniform.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.type': 'Gold Badge' } },
      { $count: 'count' }
    ]);
    const shoulderBadgeInUniforms = await MemberUniform.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.type': 'Shoulder Badge' } },
      { $count: 'count' }
    ]);
    
    const remainingCount = remainingGoldBadgeInUniforms[0]?.count || 0;
    const shoulderCount = shoulderBadgeInUniforms[0]?.count || 0;
    
    console.log(`   📊 Remaining "Gold Badge" items in member uniforms: ${remainingCount}`);
    console.log(`   📊 Total "Shoulder Badge" items in member uniforms: ${shoulderCount}`);

    // ========================================
    // 3. Summary
    // ========================================
    console.log('\n' + '='.repeat(50));
    console.log('✅ Migration completed successfully!');
    console.log('='.repeat(50));
    // Count total items updated in member uniforms
    let totalItemsUpdated = 0;
    for (const uniform of memberUniforms) {
      totalItemsUpdated += uniform.items.filter((item: any) => item.type === 'Shoulder Badge').length;
    }
    
    console.log(`📊 Total records updated: ${totalUpdated}`);
    console.log(`   - Inventory items: ${inventoryResult.modifiedCount}`);
    console.log(`   - Member uniform records: ${memberUniformsUpdated}`);
    console.log(`   - Total items updated in member uniforms: ${totalItemsUpdated} items across ${memberUniforms.length} collections`);
    
    if (remainingGoldBadgeInventory > 0 || remainingCount > 0) {
      console.log('\n⚠️  WARNING: Some "Gold Badge" records still remain:');
      if (remainingGoldBadgeInventory > 0) {
        console.log(`   - ${remainingGoldBadgeInventory} inventory items`);
      }
      if (remainingCount > 0) {
        console.log(`   - ${remainingCount} items in member uniforms`);
      }
      console.log('   Please review these records manually.');
    } else {
      console.log('\n✅ All "Gold Badge" records have been successfully migrated to "Shoulder Badge"!');
    }

  } catch (error: any) {
    console.error('\n❌ Error during migration:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  } finally {
    // Close MongoDB connection
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// ========================================
// Rollback function (optional)
// ========================================
async function rollbackShoulderToGoldBadge() {
  try {
    console.log('🔄 Starting rollback: Shoulder Badge → Gold Badge');
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Update inventory
    const inventoryResult = await UniformInventory.updateMany(
      { type: 'Shoulder Badge' },
      { $set: { type: 'Gold Badge' } }
    );
    console.log(`✅ Rolled back ${inventoryResult.modifiedCount} inventory items`);

    // Update member uniforms
    const memberUniforms = await MemberUniform.find({
      'items.type': 'Shoulder Badge'
    });

    let memberUniformsRolledBack = 0;
    for (const uniform of memberUniforms) {
      let updated = false;
      for (let i = 0; i < uniform.items.length; i++) {
        if (uniform.items[i].type === 'Shoulder Badge') {
          uniform.items[i].type = 'Gold Badge';
          updated = true;
        }
      }
      if (updated) {
        await uniform.save();
        memberUniformsRolledBack++;
      }
    }
    console.log(`✅ Rolled back ${memberUniformsRolledBack} member uniform records`);

    console.log('\n✅ Rollback completed!');
  } catch (error: any) {
    console.error('\n❌ Error during rollback:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// ========================================
// Main execution
// ========================================
if (require.main === module) {
  // Check command line arguments
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'rollback') {
    console.log('⚠️  WARNING: This will rollback Shoulder Badge to Gold Badge!');
    rollbackShoulderToGoldBadge()
      .then(() => {
        console.log('✅ Rollback completed successfully');
        process.exit(0);
      })
      .catch((error) => {
        console.error('❌ Rollback failed:', error);
        process.exit(1);
      });
  } else {
    migrateGoldToShoulderBadge()
      .then(() => {
        console.log('\n✅ Migration completed successfully');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
      });
  }
}

export { migrateGoldToShoulderBadge, rollbackShoulderToGoldBadge };
