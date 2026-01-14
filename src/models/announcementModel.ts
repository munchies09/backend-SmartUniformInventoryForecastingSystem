import mongoose, { Schema, Document } from 'mongoose';

export interface IAnnouncement extends Document {
  title: string;
  date: string; // Date of the event (format: "11/11/2025" or any format)
  time: string; // Time of the event (format: "Jam 2000" or any format)
  location: string; // Location of the event
  message?: string | null; // Optional message or details
  createdAt: Date;
  updatedAt: Date;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    location: { type: String, required: true },
    message: { type: String, default: null }, // Optional field
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Add indexes for sorting and finding latest announcement
announcementSchema.index({ createdAt: -1 });
announcementSchema.index({ updatedAt: -1 });

export default mongoose.model<IAnnouncement>('Announcement', announcementSchema);

