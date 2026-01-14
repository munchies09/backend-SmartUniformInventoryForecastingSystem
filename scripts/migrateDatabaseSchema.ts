/**
 * Database Migration Script
 * 
 * This script updates existing database documents to include new fields:
 * 1. Adds 'gender' field to existing RecommendedStock documents (if missing)
 * 2. Ensures all Member documents have proper gender field (optional, defaults to null)
 * 3. Creates ShirtPrice collection entries if they don't exist
 * 
 * Run this script after updating the models to ensure database compatibility.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { RecommendedStock } from '../src/models/recommendedStockModel';
import MemberModel from '../src/models/memberModel';
import { ShirtPrice } from '../src/models/shirtPriceModel';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGODB_URI || 
                  process.env.MONGO_URI || 
                  'mongodb://127.0.0.1:27017/smartuniforminventoryforecastingsystem';

async function migrateDatabase() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected successfully\n');

    let totalUpdated = 0;

    // ============================================
    // 1. Migrate RecommendedStock: Add gender field
    // ============================================
    console.log('📊 Step 1: Updating RecommendedStock documents...');
    const recommendationsWithoutGender = await RecommendedStock.find({
      $or: [
        { gender: { $exists: false } },
        { gender: null }
      ]
    });

    console.log(`   Found ${recommendationsWithoutGender.length} recommendations to update`);

    let updatedRecommendations = 0;
    for (const rec of recommendationsWithoutGender) {
      // Extract gender from type
      let gender: 'male' | 'female' | null = null;
      if (rec.type === 'BAJU_NO_3_LELAKI') {
        gender = 'male';
      } else if (rec.type === 'BAJU_NO_3_PEREMPUAN') {
        gender = 'female';
      }

      await RecommendedStock.findByIdAndUpdate(rec._id, { gender });
      updatedRecommendations++;
    }

    console.log(`   ✅ Updated ${updatedRecommendations} RecommendedStock documents with gender field`);
    totalUpdated += updatedRecommendations;

    // ============================================
    // 2. Migrate Member: Ensure gender field exists (optional, so no action needed)
    // ============================================
    console.log('\n👤 Step 2: Checking Member documents...');
    const membersCount = await MemberModel.countDocuments();
    console.log(`   Found ${membersCount} members`);
    console.log('   ✅ Gender field is optional - existing documents are compatible');
    // No update needed - gender is optional with default null

    // ============================================
    // 3. Initialize ShirtPrice collection
    // ============================================
    console.log('\n💰 Step 3: Initializing ShirtPrice collection...');
    const shirtTypes = ['Digital Shirt', 'Company Shirt', 'Inner APM Shirt'];
    let createdPrices = 0;

    for (const type of shirtTypes) {
      const existing = await ShirtPrice.findOne({ type });
      if (!existing) {
        await ShirtPrice.create({ type, price: null });
        createdPrices++;
        console.log(`   ✅ Created default entry for ${type}`);
      } else {
        console.log(`   ✓ ${type} already exists`);
      }
    }

    console.log(`   ✅ Created ${createdPrices} new ShirtPrice entries`);
    totalUpdated += createdPrices;

    // ============================================
    // Summary
    // ============================================
    console.log('\n' + '='.repeat(50));
    console.log('✅ Migration completed successfully!');
    console.log(`   Total documents updated: ${totalUpdated}`);
    console.log('='.repeat(50));

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Migration error:', error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Run migration
migrateDatabase();
