import mongoose, { Schema, Document } from "mongoose";

export interface IMember extends Document {
  sispaId: string; // Primary identifier - SISPA ID for member login
  name: string;
  email: string; 
  batch: string;
  password: string;
  role: 'admin' | 'member';
  memberId?: string; // Optional - kept for backward compatibility, can be removed later
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
  batch: { type: String, required: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['admin', 'member'], 
    default: 'member',
    required: true 
  },
  memberId: { type: String, unique: true, sparse: true }, // Optional - for backward compatibility
  matricNumber: { type: String, default: null },
  phoneNumber: { type: String, default: null },
  profilePicture: { type: String, default: null }, // URL or path to uploaded image

  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
});

export default mongoose.model<IMember>("Member", MemberSchema);
