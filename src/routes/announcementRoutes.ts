import express from 'express';
import {
  getAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
} from '../controllers/announcementController';
import { authenticate, authorizeAdmin } from '../middleware/auth';

const router = express.Router();

// ===============================
// MEMBER ROUTES (View announcements)
// ===============================
// Get all announcements (for dashboard)
router.get('/', authenticate, getAnnouncements);

// Get single announcement
router.get('/:id', authenticate, getAnnouncement);

// ===============================
// ADMIN ROUTES (Manage announcements)
// ===============================
// Create announcement
router.post('/', authenticate, authorizeAdmin, createAnnouncement);

// Update announcement
router.put('/:id', authenticate, authorizeAdmin, updateAnnouncement);

// Delete announcement
router.delete('/:id', authenticate, authorizeAdmin, deleteAnnouncement);

export default router;

