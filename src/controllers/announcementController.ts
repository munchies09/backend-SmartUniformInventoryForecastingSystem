import { Request, Response } from 'express';
import AnnouncementModel from '../models/announcementModel';
import { AuthRequest } from '../middleware/auth';

// Get all announcements (for members to view)
export const getAnnouncements = async (req: Request, res: Response) => {
  try {
    const announcements = await AnnouncementModel.find()
      .sort({ createdAt: -1 }) // Most recent first
      .limit(10); // Get latest 10 announcements
    
    res.json({
      success: true,
      announcements
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching announcements', error });
  }
};

// Get single announcement
export const getAnnouncement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const announcement = await AnnouncementModel.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    
    res.json({
      success: true,
      announcement
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching announcement', error });
  }
};

// Create announcement (Admin only)
export const createAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { title, content } = req.body;

    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title and content are required' 
      });
    }

    const announcement = new AnnouncementModel({
      title,
      content, // Admin writes full announcement text (includes date, time, location, etc.)
      createdBy: req.user.sispaId
    });

    await announcement.save();

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      announcement
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating announcement', error });
  }
};

// Update announcement (Admin only)
export const updateAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { id } = req.params;
    const { title, content } = req.body;

    const announcement = await AnnouncementModel.findByIdAndUpdate(
      id,
      { title, content },
      { new: true, runValidators: true }
    );

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    res.json({
      success: true,
      message: 'Announcement updated successfully',
      announcement
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating announcement', error });
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
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting announcement', error });
  }
};

