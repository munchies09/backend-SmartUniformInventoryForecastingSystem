import express from 'express';
import { getReports } from '../controllers/reportsController';
import { authenticate, authorizeAdmin } from '../middleware/auth';

const router = express.Router();

// ===============================
// ADMIN ROUTES (Admin only)
// ===============================
// Get reports data
router.get('/', authenticate, authorizeAdmin, getReports);

export default router;

