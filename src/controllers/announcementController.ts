import { Request, Response } from 'express';
import AnnouncementModel from '../models/announcementModel';
import { AuthRequest } from '../middleware/auth';

// Get all announcements (Admin only)
export const getAnnouncements = async (req: Request, res: Response) => {
  try {
    const announcements = await AnnouncementModel.find()
      .sort({ createdAt: -1 }); // Most recent first
    
    // Format announcements to match spec
    const formattedAnnouncements = announcements.map(announcement => {
      const annDoc = announcement as any;
      return {
        id: String(annDoc._id),
        title: announcement.title,
        date: announcement.date,
        time: announcement.time,
        location: announcement.location,
        message: announcement.message || null,
        createdAt: annDoc.createdAt,
        updatedAt: annDoc.updatedAt
      };
    });

    res.json({
      success: true,
      announcements: formattedAnnouncements
    });
  } catch (error: any) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching announcements', 
      error: error.message 
    });
  }
};

// Get latest announcement (Member/Admin)
export const getLatestAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Get the most recent announcement (based on createdAt)
    const announcement = await AnnouncementModel.findOne()
      .sort({ createdAt: -1 });
    
    if (!announcement) {
      return res.json({
        success: true,
        announcement: null
      });
    }

    const annDoc = announcement as any;
    res.json({
      success: true,
      announcement: {
        id: String(annDoc._id),
        title: announcement.title,
        date: announcement.date,
        time: announcement.time,
        location: announcement.location,
        message: announcement.message || null,
        createdAt: annDoc.createdAt,
        updatedAt: annDoc.updatedAt
      }
    });
  } catch (error: any) {
    console.error('Error fetching latest announcement:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching latest announcement', 
      error: error.message 
    });
  }
};

// Create announcement (Admin only)
export const createAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { title, date, time, location, message } = req.body;

    // Validate required fields
    if (!title || !date || !time || !location) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error: All required fields (title, date, time, location) are required' 
      });
    }

    // Validate required fields are not empty strings
    if (title.trim() === '' || date.trim() === '' || time.trim() === '' || location.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error: Required fields must not be empty' 
      });
    }

    // Message is optional, normalize to null if empty
    const normalizedMessage = message && message.trim() !== '' ? message.trim() : null;

    const announcement = new AnnouncementModel({
      title: title.trim(),
      date: date.trim(),
      time: time.trim(),
      location: location.trim(),
      message: normalizedMessage
    });

    await announcement.save();

    const annDoc = announcement as any;
    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      announcement: {
        id: String(annDoc._id),
        title: announcement.title,
        date: announcement.date,
        time: announcement.time,
        location: announcement.location,
        message: announcement.message || null,
        createdAt: annDoc.createdAt,
        updatedAt: annDoc.updatedAt
      }
    });
  } catch (error: any) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating announcement', 
      error: error.message 
    });
  }
};

// Update announcement (Admin only)
export const updateAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { id } = req.params;
    const { title, date, time, location, message } = req.body;

    // Validate required fields
    if (!title || !date || !time || !location) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error: All required fields (title, date, time, location) are required' 
      });
    }

    // Validate required fields are not empty strings
    if (title.trim() === '' || date.trim() === '' || time.trim() === '' || location.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error: Required fields must not be empty' 
      });
    }

    // Message is optional, normalize to null if empty
    const normalizedMessage = message && message.trim() !== '' ? message.trim() : null;

    const announcement = await AnnouncementModel.findByIdAndUpdate(
      id,
      { 
        title: title.trim(),
        date: date.trim(),
        time: time.trim(),
        location: location.trim(),
        message: normalizedMessage
      },
      { new: true, runValidators: true }
    );

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const annDoc = announcement as any;
    res.json({
      success: true,
      message: 'Announcement updated successfully',
      announcement: {
        id: String(annDoc._id),
        title: announcement.title,
        date: announcement.date,
        time: announcement.time,
        location: announcement.location,
        message: announcement.message || null,
        createdAt: annDoc.createdAt,
        updatedAt: annDoc.updatedAt
      }
    });
  } catch (error: any) {
    console.error('Error updating announcement:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating announcement', 
      error: error.message 
    });
  }
};

// Delete announcement (Admin only)
export const deleteAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { id } = req.params;
    const announcement = await AnnouncementModel.findByIdAndDelete(id);

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    res.json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting announcement', 
      error: error.message 
    });
  }
};

