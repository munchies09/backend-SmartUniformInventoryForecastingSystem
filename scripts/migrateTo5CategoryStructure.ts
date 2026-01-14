/**
 * Migration script to update existing database records to 5-category structure
 * 
 * This script:
 * 1. Moves accessories from "Uniform No 3" to "Accessories No 3"
 * 2. Moves accessories from "Uniform No 4" to "Accessories No 4"
 * 3. Renames "T-Shirt" to "Shirt"
 * 4. Updates both UniformInventory and MemberUniform collections
 * 
 * Usage: npm run migrate-to-5-category
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { UniformInventory, MemberUniform } from '../src/models/uniformModel';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-uniform';

// Accessory types for Uniform No 3
const ACCESSORY_TYPES_NO3 = [
  'Apulet',
  'Integrity Badge',
  'Shoulder Badge',
  'Gold Badge', // Will be migrated to Shoulder Badge
  'Cel Bar',
  'Beret Logo Pin',
  'Belt No 3',
  'Nametag',
  'Name Tag',
  'Name Tag No 3'
];

// Accessory types for Uniform No 4
const ACCESSORY_TYPES_NO4 = [
  'APM Tag',
  'Belt No 4',
  'Nametag',
  'Name Tag',
  'Name Tag No 4'
];

// Helper function to normalize type name
function normalizeTypeName(category: string, type: string): string {
  if (!type) return type;
  const typeLower = type.toLowerCase();
  
  if (typeLower.includes('cloth no 3') || typeLower === 'cloth no 3') return 'Uniform No 3 Male';
  if (typeLower.includes('pants no 3') || typeLower === 'pants no 3') return 'Uniform No 3 Female';
  if (typeLower.includes('cloth no 4') || typeLower.includes('pants no 4') || typeLower === 'pant no 4') return 'Uniform No 4';
  if (typeLower.includes('gold badge')) return 'Shoulder Badge';
  if (typeLower === 'digital' || (typeLower.includes('digital') && !typeLower.includes('shirt'))) return 'Digital Shirt';
  if (typeLower === 'company' || (typeLower.includes('company') && !typeLower.includes('shirt'))) return 'Company Shirt';
  if (typeLower.includes('inner apm') || typeLower === 'innerapm') return 'Inner APM Shirt';
  
  return type;
}

// Helper function to check if item is an accessory
// NOTE: Main uniform items like "Beret", "Uniform No 3 Male/Female", "Uniform No 4", "PVC Shoes", "Boot" are NOT accessories
function isAccessoryType(type: string, category: string): { isAccessory: boolean; category: string | null } {
  const typeLower = type.toLowerCase().trim();
  const catLower = category.toLowerCase().trim();
  
  // Main uniform items that should NOT be migrated to accessories
  // These are main items that have sizes and should stay in "Uniform No 3" or "Uniform No 4"
  const mainItems = [
    'uniform no 3 male', 'uniform no 3 female', 'cloth no 3', 'pants no 3',
    'uniform no 4', 'cloth no 4', 'pants no 4', 'pant no 4',
    'pvc shoes', 'boot', 'beret'
  ];
  
  // Check if it's a main uniform item (should NOT be migrated) - exact match only
  const isMainItem = mainItems.some(mainItem => typeLower === mainItem);
  
  if (isMainItem) {
    return { isAccessory: false, category: null };
  }
  
  // For accessory matching, use exact match to avoid false positives
  // Check if it's a Uniform No 3 accessory (exact match)
  const isAccessoryNo3 = ACCESSORY_TYPES_NO3.some(acc => {
    const accLower = acc.toLowerCase().trim();
    // Only match if exactly equal (to avoid "Beret" matching "Beret Logo Pin")
    return typeLower === accLower;
  });
  
  // Check if it's a Uniform No 4 accessory (exact match)
  const isAccessoryNo4 = ACCESSORY_TYPES_NO4.some(acc => {
    const accLower = acc.toLowerCase().trim();
    return typeLower === accLower;
  });
  
  // Check if it's a nametag (can be variations)
  const isNametag = (typeLower === 'nametag' || 
                     typeLower === 'name tag' ||
                     typeLower === 'nameplate' ||
                     typeLower === 'name tag no 3' ||
                     typeLower === 'name tag no 4');
  
  if (isAccessoryNo3 || (isNametag && (catLower.includes('uniform no 3') || catLower.includes('no 3')))) {
    return { isAccessory: true, category: 'Accessories No 3' };
  }
  
  if (isAccessoryNo4 || (isNametag && (catLower.includes('uniform no 4') || catLower.includes('no 4')))) {
    return { isAccessory: true, category: 'Accessories No 4' };
  }
  
  return { isAccessory: false, category: null };
}

// Helper function to safely migrate an inventory item (handles duplicates)
async function migrateInventoryItem(
  item: any,
  newCategory: string,
  newType: string
): Promise<{ updated: boolean; merged: boolean; deleted: boolean }> {
  const normalizedSize = item.size || null;
  
  // Check if an item with the target category/type/size already exists
  const existingItem = await UniformInventory.findOne({
    category: newCategory,
    type: newType,
    size: normalizedSize,
    _id: { $ne: item._id } // Exclude the current item
  });
  
  if (existingItem) {
    // Merge quantities and delete the old item
    const mergedQuantity = (existingItem.quantity || 0) + (item.quantity || 0);
    
    await UniformInventory.findByIdAndUpdate(existingItem._id, {
      $set: { quantity: mergedQuantity }
    });
    
    // Delete the old item
    await UniformInventory.findByIdAndDelete(item._id);
    
    console.log(`  🔀 Merged: ${item.type} (qty: ${item.quantity || 0}) into existing "${newType}" (total qty: ${mergedQuantity})`);
    return { updated: false, merged: true, deleted: true };
  } else {
    // No duplicate exists, update the item normally
    await UniformInventory.findByIdAndUpdate(item._id, {
      $set: {
        category: newCategory,
        type: newType
      }
    });
    
    console.log(`  ✅ Updated: ${item.type} → category: "${newCategory}", type: "${newType}"`);
    return { updated: true, merged: false, deleted: false };
  }
}

async function migrateTo5CategoryStructure() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    let inventoryUpdated = 0;
    let inventoryMerged = 0;
    let inventoryDeleted = 0;
    let memberUniformUpdated = 0;
    let itemsMigrated = 0;

    // ==========================================
    // MIGRATE UniformInventory Collection
    // ==========================================
    console.log('📦 Migrating UniformInventory collection...\n');

    // 1. Move accessories from "Uniform No 3" to "Accessories No 3"
    const uniformNo3Items = await UniformInventory.find({ 
      category: { $regex: /^uniform no 3$/i }
    });
    
    console.log(`Found ${uniformNo3Items.length} items in "Uniform No 3" category`);
    
    for (const item of uniformNo3Items) {
      const accessoryCheck = isAccessoryType(item.type, item.category);
      
      if (accessoryCheck.isAccessory && accessoryCheck.category === 'Accessories No 3') {
        // Also normalize type (e.g., Gold Badge → Shoulder Badge)
        const normalizedType = normalizeTypeName(item.category, item.type);
        
        const result = await migrateInventoryItem(
          item,
          'Accessories No 3',
          normalizedType !== item.type ? normalizedType : item.type
        );
        
        if (result.updated) {
          inventoryUpdated++;
          itemsMigrated++;
        } else if (result.merged) {
          inventoryMerged++;
          inventoryDeleted++;
          itemsMigrated++;
        }
      }
    }

    // 2. Move accessories from "Uniform No 4" to "Accessories No 4"
    const uniformNo4Items = await UniformInventory.find({ 
      category: { $regex: /^uniform no 4$/i }
    });
    
    console.log(`\nFound ${uniformNo4Items.length} items in "Uniform No 4" category`);
    
    for (const item of uniformNo4Items) {
      const accessoryCheck = isAccessoryType(item.type, item.category);
      
      if (accessoryCheck.isAccessory && accessoryCheck.category === 'Accessories No 4') {
        const normalizedType = normalizeTypeName(item.category, item.type);
        
        const result = await migrateInventoryItem(
          item,
          'Accessories No 4',
          normalizedType !== item.type ? normalizedType : item.type
        );
        
        if (result.updated) {
          inventoryUpdated++;
          itemsMigrated++;
        } else if (result.merged) {
          inventoryMerged++;
          inventoryDeleted++;
          itemsMigrated++;
        }
      }
    }

    // 3. Rename "T-Shirt" to "Shirt"
    const tShirtItems = await UniformInventory.find({ 
      category: { $regex: /^t-shirt$/i }
    });
    
    console.log(`\nFound ${tShirtItems.length} items in "T-Shirt" category`);
    
    for (const item of tShirtItems) {
      const normalizedType = normalizeTypeName(item.category, item.type);
      
      const result = await migrateInventoryItem(
        item,
        'Shirt',
        normalizedType !== item.type ? normalizedType : item.type
      );
      
      if (result.updated) {
        inventoryUpdated++;
      } else if (result.merged) {
        inventoryMerged++;
        inventoryDeleted++;
      }
    }

    // 4. Migrate "Gold Badge" to "Shoulder Badge" (check for duplicates first)
    const goldBadgeItems = await UniformInventory.find({ 
      type: { $regex: /gold badge/i }
    });
    
    if (goldBadgeItems.length > 0) {
      console.log(`\nFound ${goldBadgeItems.length} items with type "Gold Badge"`);
      
      for (const item of goldBadgeItems) {
        const result = await migrateInventoryItem(
          item,
          item.category, // Keep same category (might already be Accessories No 3)
          'Shoulder Badge'
        );
        
        if (result.updated) {
          inventoryUpdated++;
        } else if (result.merged) {
          inventoryMerged++;
          inventoryDeleted++;
        }
      }
    }

    // ==========================================
    // MIGRATE MemberUniform Collection
    // ==========================================
    console.log('\n📦 Migrating MemberUniform collection...\n');

    const memberUniforms = await MemberUniform.find({});
    console.log(`Found ${memberUniforms.length} member uniform collections`);

    for (const uniform of memberUniforms) {
      let hasChanges = false;
      
      const updatedItems = uniform.items.map((item: any) => {
        const originalCategory = item.category;
        const originalType = item.type;
        
        // Normalize category
        let newCategory = originalCategory;
        if (originalCategory === 'T-Shirt' || originalCategory?.toLowerCase() === 't-shirt') {
          newCategory = 'Shirt';
          hasChanges = true;
        }
        
        // Check if item is an accessory
        const accessoryCheck = isAccessoryType(originalType, originalCategory);
        if (accessoryCheck.isAccessory && accessoryCheck.category) {
          newCategory = accessoryCheck.category;
          hasChanges = true;
        }
        
        // Normalize type
        const newType = normalizeTypeName(originalCategory, originalType);
        if (newType !== originalType) {
          hasChanges = true;
        }
        
        // Migrate Gold Badge to Shoulder Badge
        if (newType === 'Shoulder Badge' && originalType?.toLowerCase().includes('gold badge')) {
          hasChanges = true;
        }
        
        return {
          ...item.toObject ? item.toObject() : item,
          category: newCategory,
          type: newType
        };
      });
      
      if (hasChanges) {
        uniform.items = updatedItems;
        await uniform.save();
        memberUniformUpdated++;
        console.log(`  ✅ Updated uniform for SISPA ID: ${uniform.sispaId} (${updatedItems.length} items)`);
      }
    }

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`📊 Statistics:`);
    console.log(`   - UniformInventory items updated: ${inventoryUpdated}`);
    console.log(`   - UniformInventory items merged: ${inventoryMerged}`);
    console.log(`   - UniformInventory items deleted (after merge): ${inventoryDeleted}`);
    console.log(`   - MemberUniform collections updated: ${memberUniformUpdated}`);
    console.log(`   - Total items migrated: ${itemsMigrated}`);
    console.log('\n✅ Migration completed successfully!\n');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error: any) {
    console.error('❌ Migration error:', error);
    console.error('Error stack:', error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run migration
migrateTo5CategoryStructure();