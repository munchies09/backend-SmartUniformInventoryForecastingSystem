import express from 'express';
import { 
  getUniforms, 
  addUniform, 
  updateUniform, 
  deleteUniform,
  getOwnUniform,
  addOwnUniform,
  updateOwnUniform,
  addUniformItem,
  deleteUniformItem
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
// Get own uniform collection (all items)
router.get('/my-uniform', authenticate, getOwnUniform);

// Add uniform items (supports multiple items at once)
router.post('/my-uniform', authenticate, addOwnUniform);

// Update uniform collection (replace all items)
router.put('/my-uniform', authenticate, updateOwnUniform);

// Add a single uniform item
router.post('/my-uniform/item', authenticate, addUniformItem);

// Delete a specific uniform item
router.delete('/my-uniform/item', authenticate, deleteUniformItem);

export default router;
