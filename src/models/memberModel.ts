import mongoose, { Schema, Document } from "mongoose";

export interface IMember extends Document {
  memberId: string;
  name: string;
  email: string; 
  batch: string;
  password: string;
  role: 'admin' | 'member';
  sispaId?: string; // SISPA ID for member login (editable)
  matricNumber?: string; // NO. MATRIC
  phoneNumber?: string; // NO. PHONE
  profilePicture?: string; // URL or path to profile picture

  resetPasswordToken?: string | null;
  resetPasswordExpires?: Date | null;
}

const MemberSchema = new Schema<IMember>({
  memberId: { type: String, required: true, unique: true },
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
  sispaId: { type: String, unique: true, sparse: true }, // Sparse index allows multiple nulls, editable
  matricNumber: { type: String, default: null },
  phoneNumber: { type: String, default: null },
  profilePicture: { type: String, default: null }, // URL or path to uploaded image

  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
});

export default mongoose.model<IMember>("Member", MemberSchema);
