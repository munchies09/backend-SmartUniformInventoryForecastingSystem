/**
 * Script to check member uniform data in database
 * Usage: npm run check-uniform <sispaId>
 * Example: npm run check-uniform A1181212
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { MemberUniform } from '../src/models/uniformModel';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-uniform';

async function checkMemberUniform(sispaId?: string) {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    if (sispaId) {
      // Check specific member
      console.log(`📋 Checking uniform for SISPA ID: ${sispaId}\n`);
      const uniform = await MemberUniform.findOne({ sispaId });
      
      if (!uniform) {
        console.log(`❌ No uniform found for ${sispaId}`);
      } else {
        console.log(`✅ Found uniform for ${sispaId}`);
        console.log(`   Uniform ID: ${uniform._id}`);
        console.log(`   Created: ${uniform.createdAt}`);
        console.log(`   Updated: ${uniform.updatedAt}`);
        console.log(`   Total items: ${uniform.items.length}\n`);
        
        console.log('📦 Items in uniform:');
        uniform.items.forEach((item: any, index: number) => {
          console.log(`   ${index + 1}. ${item.category} / ${item.type} / Size: "${item.size || 'N/A'}" / Quantity: ${item.quantity}`);
        });
      }
    } else {
      // Check all members
      console.log('📋 Checking all member uniforms...\n');
      const uniforms = await MemberUniform.find().sort({ updatedAt: -1 });
      
      console.log(`✅ Found ${uniforms.length} uniform collections\n`);
      
      uniforms.forEach((uniform, index) => {
        console.log(`${index + 1}. SISPA ID: ${uniform.sispaId}`);
        console.log(`   ID: ${uniform._id}`);
        console.log(`   Items: ${uniform.items.length}`);
        console.log(`   Updated: ${uniform.updatedAt}`);
        console.log(`   Items: ${uniform.items.map((i: any) => `${i.type}(${i.size || 'N/A'})`).join(', ')}\n`);
      });
    }

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Get SISPA ID from command line arguments
const sispaId = process.argv[2];

checkMemberUniform(sispaId);