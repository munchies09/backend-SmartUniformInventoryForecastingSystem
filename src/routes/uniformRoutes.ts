import express from 'express';
import { 
  getUniforms, 
  addUniform, 
  updateUniform, 
  deleteUniform,
  getOwnUniform,
  addOwnUniform,
  updateOwnUniform
} from '../controllers/uniformController';
import { authenticate, authorizeAdmin } from '../middleware/auth';

const router = express.Router();

// ===============================
// ADMIN ROUTES (Admin only - Inventory Management)
// ===============================
// Get all uniforms (inventory)
router.get('/', authenticate, authorizeAdmin, getUniforms);

// Add uniform to inventory
router.post('/', authenticate, authorizeAdmin, addUniform);

// Update uniform in inventory
router.put('/:id', authenticate, authorizeAdmin, updateUniform);

// Delete uniform from inventory
router.delete('/:id', authenticate, authorizeAdmin, deleteUniform);

// ===============================
// MEMBER ROUTES (Authenticated members - Own uniform)
// ===============================
// Get own uniform
router.get('/my-uniform', authenticate, getOwnUniform);

// Add own uniform (first time login)
router.post('/my-uniform', authenticate, addOwnUniform);

// Update own uniform
router.put('/my-uniform', authenticate, updateOwnUniform);

export default router;
