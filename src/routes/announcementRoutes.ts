import express from 'express';
import {
  getAnnouncements,
  getLatestAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
} from '../controllers/announcementController';
import { authenticate, authorizeAdmin } from '../middleware/auth';

const router = express.Router();

// ===============================
// MEMBER/ADMIN ROUTES (View announcements)
// ===============================
// Get latest announcement (Member or Admin can access)
router.get('/latest', authenticate, getLatestAnnouncement);

// Get all announcements (Member or Admin can access - both can view)
router.get('/', authenticate, getAnnouncements);

// ===============================
// ADMIN ROUTES (Manage announcements)
// ===============================

// Create announcement (Admin only)
router.post('/', authenticate, authorizeAdmin, createAnnouncement);

// Update announcement (Admin only)
router.put('/:id', authenticate, authorizeAdmin, updateAnnouncement);

// Delete announcement (Admin only)
router.delete('/:id', authenticate, authorizeAdmin, deleteAnnouncement);

export default router;

