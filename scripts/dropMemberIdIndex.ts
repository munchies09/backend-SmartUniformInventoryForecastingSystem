import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI as string;

async function dropMemberIdIndex() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected successfully');

    // Get the members collection
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    const membersCollection = db.collection('members');

    // List all indexes
    console.log('\n📋 Current indexes on members collection:');
    const indexes = await membersCollection.indexes();
    indexes.forEach((index: any) => {
      console.log('  -', JSON.stringify(index));
    });

    // Check if memberId index exists
    const memberIdIndex = indexes.find((index: any) => 
      index.key && index.key.memberId !== undefined
    );

    if (memberIdIndex && memberIdIndex.name) {
      console.log('\n🗑️  Dropping memberId index...');
      await membersCollection.dropIndex(memberIdIndex.name);
      console.log('✅ Successfully dropped memberId index');
    } else {
      console.log('\n✅ No memberId index found - already removed');
    }

    // List indexes again to confirm
    console.log('\n📋 Updated indexes on members collection:');
    const updatedIndexes = await membersCollection.indexes();
    updatedIndexes.forEach((index: any) => {
      console.log('  -', JSON.stringify(index));
    });

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error during migration:', error);
    if (error.code === 27) {
      console.log('ℹ️  Index not found - it may have already been dropped');
    }
    process.exit(1);
  }
}

// Run the migration
dropMemberIdIndex();

