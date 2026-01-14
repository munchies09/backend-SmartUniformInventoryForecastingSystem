import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import MemberModel from '../src/models/memberModel';

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI as string;

// Default admin credentials
const ADMIN_CREDENTIALS = {
  sispaId: 'admin',
  name: 'Logistics Coordinator',
  email: 'korsispa@upm.edu.my',
  password: 'admin123', // Default password - CHANGE THIS IN PRODUCTION!
  role: 'admin' as const,
  batch: 'Admin' // Admin batch - can be any value since admin doesn't belong to a student batch
};

async function createAdmin() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected successfully');

    // Check if admin already exists
    const existingAdmin = await MemberModel.findOne({ sispaId: 'admin' });
    
    if (existingAdmin) {
      console.log('⚠️  Admin account already exists!');
      console.log('Admin details:');
      console.log(`  SISPA ID: ${existingAdmin.sispaId}`);
      console.log(`  Email: ${existingAdmin.email}`);
      console.log(`  Role: ${existingAdmin.role}`);
      console.log('\nTo reset the password, update it via the API or database.');
      await mongoose.disconnect();
      return;
    }

    // Hash password
    console.log('Hashing password...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_CREDENTIALS.password, salt);

    // Create admin account
    console.log('Creating admin account...');
    const admin = new MemberModel({
      sispaId: ADMIN_CREDENTIALS.sispaId,
      name: ADMIN_CREDENTIALS.name,
      email: ADMIN_CREDENTIALS.email,
      password: hashedPassword,
      role: ADMIN_CREDENTIALS.role,
      batch: ADMIN_CREDENTIALS.batch
      // memberId not set - sispaId is the primary identifier
    });

    await admin.save();

    console.log('\n✅ Admin account created successfully!');
    console.log('\n📋 Admin Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  SISPA ID: ${ADMIN_CREDENTIALS.sispaId}`);
    console.log(`  Password: ${ADMIN_CREDENTIALS.password}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  WARNING: Change the default password in production!');
    console.log('\n📝 Use these credentials to login:');
    console.log('   POST /api/members/login');
    console.log('   Body: { "sispaId": "admin", "password": "admin123" }');

    await mongoose.disconnect();
    console.log('\n✅ Database disconnected');
  } catch (error: any) {
    console.error('❌ Error creating admin account:', error.message);
    
    if (error.code === 11000) {
      console.log('\n⚠️  Admin account with this SISPA ID or email already exists!');
    }
    
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
createAdmin();

