import mongoose, { Schema, Document } from 'mongoose';

export interface IAnnouncement extends Document {
  title: string;
  content: string; // Full announcement text as written by admin (includes date, time, location, etc.)
  createdBy: string; // sispaId of admin who created it
  createdAt: Date;
  updatedAt: Date;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: true },
    content: { type: String, required: true }, // Admin writes full announcement text here
    createdBy: { type: String, required: true, ref: 'Member' }, // sispaId of admin
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

export default mongoose.model<IAnnouncement>('Announcement', announcementSchema);

