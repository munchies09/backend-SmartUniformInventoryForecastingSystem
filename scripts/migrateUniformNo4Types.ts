/**
 * Database Migration Script: Uniform No 4 Type Names
 * 
 * This script updates existing database documents to merge Cloth No 4 and Pants No 4 into a single type:
 * 1. "Cloth No 4" → "Uniform No 4" (in UniformInventory and MemberUniform)
 * 2. "Pants No 4" or "Pant No 4" → "Uniform No 4" (in UniformInventory and MemberUniform)
 * 
 * Note: Cloth and Pants come as a pair, so they are merged into a single "Uniform No 4" type.
 * 
 * Run this script after updating the backend to use the merged type.
 * 
 * ⚠️ IMPORTANT: Backup your database before running this migration!
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { UniformInventory } from '../src/models/uniformModel';
import { MemberUniform } from '../src/models/uniformModel';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGODB_URI || 
                  process.env.MONGO_URI || 
                  'mongodb://127.0.0.1:27017/smartuniforminventoryforecastingsystem';

async function migrateUniformNo4Types() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected successfully\n');

    let totalUpdated = 0;

    // ============================================
    // 1. Migrate UniformInventory: Handle duplicates and update type field
    // ============================================
    console.log('📦 Step 1: Updating UniformInventory documents...');
    
    // Find all inventory items with old type names (exclude already migrated items)
    const inventoryItemsToUpdate = await UniformInventory.find({
      category: 'Uniform No 4',
      type: { $in: ['Cloth No 4', 'Pants No 4', 'Pant No 4'] }
    });
    
    // Also check for any existing "Uniform No 4" items that might need quantity merging
    const existingUniformNo4Items = await UniformInventory.find({
      category: 'Uniform No 4',
      type: 'Uniform No 4'
    });
    
    console.log(`   Found ${existingUniformNo4Items.length} existing "Uniform No 4" items (may need quantity merging)`);

    console.log(`   Found ${inventoryItemsToUpdate.length} inventory items to update`);

    // Group items by size to identify duplicates
    const itemsBySize = new Map<string, Array<{ id: any; type: string; quantity: number }>>();
    
    for (const item of inventoryItemsToUpdate) {
      const sizeKey = item.size || 'NO_SIZE';
      if (!itemsBySize.has(sizeKey)) {
        itemsBySize.set(sizeKey, []);
      }
      itemsBySize.get(sizeKey)!.push({
        id: item._id,
        type: item.type,
        quantity: item.quantity || 0
      });
    }

    console.log(`   Grouped into ${itemsBySize.size} size groups`);

    let updatedInventory = 0;
    let mergedDuplicates = 0;
    let deletedDuplicates = 0;

    // Process each size group
    for (const [sizeKey, items] of itemsBySize.entries()) {
      const size = sizeKey === 'NO_SIZE' ? null : sizeKey;
      
      // Check if there are duplicates (multiple items with same size)
      if (items.length > 1) {
        console.log(`   🔄 Found ${items.length} items for size "${size || 'N/A'}" - merging quantities`);
        
        // Calculate total quantity
        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
        
        // Check if "Uniform No 4" already exists for this size
        const existingUniformNo4 = await UniformInventory.findOne({
          category: 'Uniform No 4',
          type: 'Uniform No 4',
          size: size
        });

        if (existingUniformNo4) {
          // Update existing entry with merged quantity
          const newQuantity = existingUniformNo4.quantity + totalQuantity;
          await UniformInventory.findByIdAndUpdate(existingUniformNo4._id, {
            quantity: newQuantity
          });
          console.log(`   ✅ Merged ${items.length} items into existing Uniform No 4 (size: ${size || 'N/A'}) - Total: ${newQuantity}`);
          
          // Delete all old items
          for (const item of items) {
            await UniformInventory.findByIdAndDelete(item.id);
            deletedDuplicates++;
          }
          mergedDuplicates += items.length;
        } else {
          // Update first item to "Uniform No 4" with merged quantity
          const firstItem = items[0];
          await UniformInventory.findByIdAndUpdate(firstItem.id, {
            type: 'Uniform No 4',
            quantity: totalQuantity
          });
          console.log(`   ✅ Merged ${items.length} items into Uniform No 4 (size: ${size || 'N/A'}) - Total: ${totalQuantity}`);
          updatedInventory++;
          
          // Delete remaining duplicate items
          for (let i = 1; i < items.length; i++) {
            await UniformInventory.findByIdAndDelete(items[i].id);
            deletedDuplicates++;
          }
          mergedDuplicates += items.length - 1;
        }
      } else {
        // Single item - just update the type
        const item = items[0];
        const oldType = item.type;
        
        // Check if "Uniform No 4" already exists for this size
        const existingUniformNo4 = await UniformInventory.findOne({
          category: 'Uniform No 4',
          type: 'Uniform No 4',
          size: size
        });

        if (existingUniformNo4) {
          // Merge quantity into existing entry
          const newQuantity = existingUniformNo4.quantity + item.quantity;
          await UniformInventory.findByIdAndUpdate(existingUniformNo4._id, {
            quantity: newQuantity
          });
          // Delete the old item
          await UniformInventory.findByIdAndDelete(item.id);
          console.log(`   ✅ Merged ${oldType} into existing Uniform No 4 (size: ${size || 'N/A'}) - Total: ${newQuantity}`);
          mergedDuplicates++;
          deletedDuplicates++;
        } else {
          // Update to new type
          await UniformInventory.findByIdAndUpdate(item.id, { type: 'Uniform No 4' });
          updatedInventory++;
          console.log(`   ✅ Updated: ${oldType} → Uniform No 4 (size: ${size || 'N/A'})`);
        }
      }
    }

    console.log(`   ✅ Updated ${updatedInventory} UniformInventory documents`);
    console.log(`   ✅ Merged ${mergedDuplicates} duplicate items`);
    console.log(`   ✅ Deleted ${deletedDuplicates} duplicate entries`);
    totalUpdated += updatedInventory;

    // ============================================
    // 2. Migrate MemberUniform: Update type in items array
    // ============================================
    console.log('\n👕 Step 2: Updating MemberUniform documents...');
    
    // Find all member uniforms that have items with old type names
    const memberUniforms = await MemberUniform.find({
      'items.category': 'Uniform No 4',
      'items.type': { $in: ['Cloth No 4', 'Pants No 4', 'Pant No 4'] }
    });

    console.log(`   Found ${memberUniforms.length} member uniform documents to check`);

    let updatedMemberUniforms = 0;
    let updatedItems = 0;

    for (const uniform of memberUniforms) {
      let hasUpdates = false;
      
      // Update each item in the items array
      for (let i = 0; i < uniform.items.length; i++) {
        const item = uniform.items[i];
        
        if (item.category === 'Uniform No 4') {
          const oldType = item.type;
          if (oldType === 'Cloth No 4' || oldType === 'Pants No 4' || oldType === 'Pant No 4') {
            uniform.items[i].type = 'Uniform No 4';
            hasUpdates = true;
            updatedItems++;
            console.log(`   ✅ Updated item: ${oldType} → Uniform No 4 (Member: ${uniform.sispaId})`);
          }
        }
      }

      // Save the document if any items were updated
      if (hasUpdates) {
        await uniform.save();
        updatedMemberUniforms++;
      }
    }

    console.log(`   ✅ Updated ${updatedMemberUniforms} MemberUniform documents`);
    console.log(`   ✅ Updated ${updatedItems} individual items`);
    totalUpdated += updatedMemberUniforms;

    // ============================================
    // 3. Handle duplicate entries (same size, different old types)
    // ============================================
    console.log('\n🔄 Step 3: Checking for duplicate entries...');
    
    // Find inventory items that might have duplicates (same category, size, but different old types)
    // These should be merged into a single "Uniform No 4" entry
    const duplicateCheck = await UniformInventory.aggregate([
      {
        $match: {
          category: 'Uniform No 4',
          type: 'Uniform No 4'
        }
      },
      {
        $group: {
          _id: { category: '$category', size: '$size' },
          items: { $push: '$$ROOT' },
          count: { $sum: 1 }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]);

    if (duplicateCheck.length > 0) {
      console.log(`   ⚠️  Found ${duplicateCheck.length} potential duplicate groups`);
      console.log('   💡 These may need manual review to merge quantities');
      
      for (const group of duplicateCheck) {
        console.log(`   📋 Group: ${group._id.category} / Size: ${group._id.size || 'N/A'} - ${group.count} items`);
        const totalQuantity = group.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
        console.log(`      Total quantity: ${totalQuantity}`);
      }
    } else {
      console.log('   ✅ No duplicate entries found');
    }

    // ============================================
    // 4. Verify migration
    // ============================================
    console.log('\n🔍 Step 4: Verifying migration...');
    
    // Check for any remaining old type names
    const remainingInventory = await UniformInventory.countDocuments({
      category: 'Uniform No 4',
      type: { $in: ['Cloth No 4', 'Pants No 4', 'Pant No 4'] }
    });

    const remainingMemberUniforms = await MemberUniform.countDocuments({
      'items.category': 'Uniform No 4',
      'items.type': { $in: ['Cloth No 4', 'Pants No 4', 'Pant No 4'] }
    });

    if (remainingInventory === 0 && remainingMemberUniforms === 0) {
      console.log('   ✅ Verification passed: No old type names found');
    } else {
      console.log(`   ⚠️  Warning: Found ${remainingInventory} inventory items and ${remainingMemberUniforms} member uniform items with old type names`);
      console.log('   💡 You may need to run this migration again or check for case sensitivity issues');
    }

    // Count new type names
    const newUniformNo4Inventory = await UniformInventory.countDocuments({
      category: 'Uniform No 4',
      type: 'Uniform No 4'
    });

    const newUniformNo4MemberUniforms = await MemberUniform.countDocuments({
      'items.category': 'Uniform No 4',
      'items.type': 'Uniform No 4'
    });

    console.log('\n📊 Migration Summary:');
    console.log(`   Inventory - Uniform No 4: ${newUniformNo4Inventory} items`);
    console.log(`   Member Uniforms - Uniform No 4: ${newUniformNo4MemberUniforms} documents`);

    // ============================================
    // Summary
    // ============================================
    console.log('\n' + '='.repeat(50));
    console.log('✅ Migration completed successfully!');
    console.log(`   Total documents updated: ${totalUpdated}`);
    console.log(`   Total items updated: ${updatedItems}`);
    if (duplicateCheck.length > 0) {
      console.log(`   ⚠️  ${duplicateCheck.length} duplicate groups found - may need manual review`);
    }
    console.log('='.repeat(50));

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Migration error:', error);
    console.error('Error stack:', error.stack);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Run migration
console.log('🚀 Starting Uniform No 4 Type Name Migration...\n');
console.log('📝 Note: Cloth No 4 and Pants No 4 will be merged into "Uniform No 4"\n');
migrateUniformNo4Types();
