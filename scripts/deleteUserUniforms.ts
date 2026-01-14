import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { MemberUniform } from '../src/models/uniformModel';

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI as string;

async function deleteUserUniforms() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected successfully\n');

    // Users to delete uniform data for
    const usersToDelete = ['B1184646', 'A1182121'];

    for (const sispaId of usersToDelete) {
      console.log(`\n🔍 Checking uniform for user: ${sispaId}`);
      
      const uniform = await MemberUniform.findOne({ sispaId });
      
      if (uniform) {
        console.log(`   Found uniform with ${uniform.items.length} items`);
        console.log(`   Items: ${uniform.items.map((i: any) => `${i.type} (${i.size || 'no size'})`).join(', ')}`);
        
        // Delete the uniform
        await MemberUniform.deleteOne({ sispaId });
        console.log(`   ✅ Deleted uniform for ${sispaId}`);
      } else {
        console.log(`   ⚠️  No uniform found for ${sispaId} (may have been already deleted)`);
      }
    }

    console.log('\n✅ Deletion process completed!');
    
    // Verify deletion
    console.log('\n🔍 Verifying deletion...');
    for (const sispaId of usersToDelete) {
      const uniform = await MemberUniform.findOne({ sispaId });
      if (uniform) {
        console.log(`   ❌ WARNING: Uniform still exists for ${sispaId}`);
      } else {
        console.log(`   ✅ Confirmed: No uniform found for ${sispaId}`);
      }
    }

    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
deleteUserUniforms();

