/**
 * Database Migration Script: Uniform No 3 Type Names
 * 
 * This script updates existing database documents to use gender-specific type names:
 * 1. "Cloth No 3" → "Uniform No 3 Male" (in UniformInventory and MemberUniform)
 * 2. "Pants No 3" → "Uniform No 3 Female" (in UniformInventory and MemberUniform)
 * 
 * Run this script after updating the backend to use gender-specific types.
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

async function migrateUniformNo3Types() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected successfully\n');

    let totalUpdated = 0;

    // ============================================
    // 1. Migrate UniformInventory: Update type field
    // ============================================
    console.log('📦 Step 1: Updating UniformInventory documents...');
    
    // Find all inventory items with old type names
    const inventoryItemsToUpdate = await UniformInventory.find({
      category: 'Uniform No 3',
      type: { $in: ['Cloth No 3', 'Pants No 3'] }
    });

    console.log(`   Found ${inventoryItemsToUpdate.length} inventory items to update`);

    let updatedInventory = 0;
    for (const item of inventoryItemsToUpdate) {
      let newType: string;
      if (item.type === 'Cloth No 3') {
        newType = 'Uniform No 3 Male';
      } else if (item.type === 'Pants No 3') {
        newType = 'Uniform No 3 Female';
      } else {
        continue; // Skip if not matching
      }

      await UniformInventory.findByIdAndUpdate(item._id, { type: newType });
      updatedInventory++;
      console.log(`   ✅ Updated: ${item.type} → ${newType} (ID: ${item._id})`);
    }

    console.log(`   ✅ Updated ${updatedInventory} UniformInventory documents`);
    totalUpdated += updatedInventory;

    // ============================================
    // 2. Migrate MemberUniform: Update type in items array
    // ============================================
    console.log('\n👕 Step 2: Updating MemberUniform documents...');
    
    // Find all member uniforms that have items with old type names
    const memberUniforms = await MemberUniform.find({
      'items.category': 'Uniform No 3',
      'items.type': { $in: ['Cloth No 3', 'Pants No 3'] }
    });

    console.log(`   Found ${memberUniforms.length} member uniform documents to check`);

    let updatedMemberUniforms = 0;
    let updatedItems = 0;

    for (const uniform of memberUniforms) {
      let hasUpdates = false;
      
      // Update each item in the items array
      for (let i = 0; i < uniform.items.length; i++) {
        const item = uniform.items[i];
        
        if (item.category === 'Uniform No 3') {
          if (item.type === 'Cloth No 3') {
            uniform.items[i].type = 'Uniform No 3 Male';
            hasUpdates = true;
            updatedItems++;
            console.log(`   ✅ Updated item: ${item.type} → Uniform No 3 Male (Member: ${uniform.sispaId})`);
          } else if (item.type === 'Pants No 3') {
            uniform.items[i].type = 'Uniform No 3 Female';
            hasUpdates = true;
            updatedItems++;
            console.log(`   ✅ Updated item: ${item.type} → Uniform No 3 Female (Member: ${uniform.sispaId})`);
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
    // 3. Verify migration
    // ============================================
    console.log('\n🔍 Step 3: Verifying migration...');
    
    // Check for any remaining old type names
    const remainingInventory = await UniformInventory.countDocuments({
      category: 'Uniform No 3',
      type: { $in: ['Cloth No 3', 'Pants No 3'] }
    });

    const remainingMemberUniforms = await MemberUniform.countDocuments({
      'items.category': 'Uniform No 3',
      'items.type': { $in: ['Cloth No 3', 'Pants No 3'] }
    });

    if (remainingInventory === 0 && remainingMemberUniforms === 0) {
      console.log('   ✅ Verification passed: No old type names found');
    } else {
      console.log(`   ⚠️  Warning: Found ${remainingInventory} inventory items and ${remainingMemberUniforms} member uniform items with old type names`);
      console.log('   💡 You may need to run this migration again or check for case sensitivity issues');
    }

    // Count new type names
    const newMaleInventory = await UniformInventory.countDocuments({
      category: 'Uniform No 3',
      type: 'Uniform No 3 Male'
    });

    const newFemaleInventory = await UniformInventory.countDocuments({
      category: 'Uniform No 3',
      type: 'Uniform No 3 Female'
    });

    const newMaleMemberUniforms = await MemberUniform.countDocuments({
      'items.category': 'Uniform No 3',
      'items.type': 'Uniform No 3 Male'
    });

    const newFemaleMemberUniforms = await MemberUniform.countDocuments({
      'items.category': 'Uniform No 3',
      'items.type': 'Uniform No 3 Female'
    });

    console.log('\n📊 Migration Summary:');
    console.log(`   Inventory - Uniform No 3 Male: ${newMaleInventory} items`);
    console.log(`   Inventory - Uniform No 3 Female: ${newFemaleInventory} items`);
    console.log(`   Member Uniforms - Uniform No 3 Male: ${newMaleMemberUniforms} documents`);
    console.log(`   Member Uniforms - Uniform No 3 Female: ${newFemaleMemberUniforms} documents`);

    // ============================================
    // Summary
    // ============================================
    console.log('\n' + '='.repeat(50));
    console.log('✅ Migration completed successfully!');
    console.log(`   Total documents updated: ${totalUpdated}`);
    console.log(`   Total items updated: ${updatedItems}`);
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
console.log('🚀 Starting Uniform No 3 Type Name Migration...\n');
migrateUniformNo3Types();
