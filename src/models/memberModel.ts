import mongoose, { Schema, Document } from "mongoose";

export interface IMember extends Document {
  sispaId: string; // Primary identifier - SISPA ID for member login
  name: string;
  email: string; 
  batch?: string | null; // Optional - can be set later in profile (format: "Kompeni {number}")
  password: string;
  role: 'admin' | 'member';
  gender?: 'Male' | 'Female'; // Gender field for profile
  matricNumber?: string; // NO. MATRIC
  phoneNumber?: string; // NO. PHONE
  profilePicture?: string; // URL or path to profile picture

  resetPasswordToken?: string | null;
  resetPasswordExpires?: Date | null;
}

const MemberSchema = new Schema<IMember>({
  sispaId: { type: String, required: true, unique: true }, // Primary identifier
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  batch: { type: String, required: false, default: null }, // Optional - can be set later in profile
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['admin', 'member'], 
    default: 'member',
    required: true 
  },
  gender: {
    type: String,
    enum: ['Male', 'Female'],
    default: null,
    required: false
  },
  matricNumber: { type: String, default: null },
  phoneNumber: { type: String, default: null },
  profilePicture: { type: String, default: null }, // URL or path to uploaded image

  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
}, { timestamps: true }); // Add timestamps for createdAt and updatedAt

export default mongoose.model<IMember>("Member", MemberSchema);
