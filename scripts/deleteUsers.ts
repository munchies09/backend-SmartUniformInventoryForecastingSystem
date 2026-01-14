import mongoose from 'mongoose';
import dotenv from 'dotenv';
import MemberModel from '../src/models/memberModel';
import { MemberUniform } from '../src/models/uniformModel';

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI as string;

async function deleteUsers() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected successfully\n');

    // Users to delete
    const usersToDelete = ['B1184646', 'A1182121'];

    for (const sispaId of usersToDelete) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔍 Processing user: ${sispaId}`);
      console.log('='.repeat(60));
      
      // Check and delete member data
      const member = await MemberModel.findOne({ sispaId });
      if (member) {
        console.log(`\n📋 Member Information:`);
        console.log(`   Name: ${member.name}`);
        console.log(`   Email: ${member.email}`);
        console.log(`   Batch: ${member.batch}`);
        console.log(`   Role: ${member.role}`);
        
        // Delete member
        await MemberModel.deleteOne({ sispaId });
        console.log(`   ✅ Deleted member record for ${sispaId}`);
      } else {
        console.log(`\n⚠️  No member record found for ${sispaId} (may have been already deleted)`);
      }
      
      // Check and delete uniform data
      const uniform = await MemberUniform.findOne({ sispaId });
      if (uniform) {
        console.log(`\n👕 Uniform Information:`);
        console.log(`   Items: ${uniform.items.length}`);
        console.log(`   Items: ${uniform.items.map((i: any) => `${i.type} (${i.size || 'no size'})`).join(', ')}`);
        
        // Delete uniform
        await MemberUniform.deleteOne({ sispaId });
        console.log(`   ✅ Deleted uniform record for ${sispaId}`);
      } else {
        console.log(`\n⚠️  No uniform record found for ${sispaId} (may have been already deleted)`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Deletion process completed!');
    console.log('='.repeat(60));
    
    // Verify deletion
    console.log('\n🔍 Verifying deletion...\n');
    for (const sispaId of usersToDelete) {
      const member = await MemberModel.findOne({ sispaId });
      const uniform = await MemberUniform.findOne({ sispaId });
      
      if (member) {
        console.log(`   ❌ WARNING: Member still exists for ${sispaId}`);
      } else {
        console.log(`   ✅ Confirmed: No member found for ${sispaId}`);
      }
      
      if (uniform) {
        console.log(`   ❌ WARNING: Uniform still exists for ${sispaId}`);
      } else {
        console.log(`   ✅ Confirmed: No uniform found for ${sispaId}`);
      }
      console.log('');
    }

    await mongoose.disconnect();
    console.log('✅ Database connection closed');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
deleteUsers();

