import express from 'express';
import { getBatches, addBatch, updateBatch, deleteBatch } from '../controllers/batchController';
import { authenticate, authorizeAdmin } from '../middleware/auth';

const router = express.Router();

// ===============================
// ADMIN ROUTES (Admin only)
// ===============================
router.get('/', authenticate, authorizeAdmin, getBatches);
router.post('/', authenticate, authorizeAdmin, addBatch);
router.put('/:id', authenticate, authorizeAdmin, updateBatch);
router.delete('/:id', authenticate, authorizeAdmin, deleteBatch);

export default router;
