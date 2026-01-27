import express from 'express';
import { 
  getUniforms, 
  addUniform, 
  updateUniform, 
  deleteUniform,
  deleteUniformByAttributes,
  deleteUniformByType,
  getOwnUniform,
  addOwnUniform,
  updateOwnUniform,
  addUniformItem,
  deleteUniformItem,
  deductInventory,
  getSizeCharts,
  getShirtPrices,
  updateShirtPrice,
  getInventoryMedia
} from '../controllers/uniformController';
import { authenticate, authorizeAdmin } from '../middleware/auth';

const router = express.Router();

// ===============================
// INVENTORY DEDUCTION (Member or Admin)
// ===============================
// Deduct inventory when users save uniforms
router.post('/deduct', authenticate, deductInventory);

// ===============================
// ADMIN ROUTES (Admin only - Inventory Management)
// ===============================
// Get all uniforms (inventory) - Now accessible to all authenticated users (for user uniform UI)
router.get('/', authenticate, getUniforms);

router.get('/inventory-media/:category/:type', authenticate, getInventoryMedia);

// Add uniform to inventory
router.post('/', authenticate, authorizeAdmin, addUniform);



// CRITICAL: Specific DELETE routes MUST come BEFORE generic /:id route
// Otherwise /:id will match "by-attributes" and "type" as IDs

// Delete uniform from inventory (by category, type, size - alternative method)
// MUST be before /:id to avoid route conflict
router.delete('/by-attributes', authenticate, authorizeAdmin, deleteUniformByAttributes);

// Delete all inventory items for a specific type
// MUST be before /:id to avoid route conflict
router.delete('/type/:category/:type', authenticate, authorizeAdmin, deleteUniformByType);


// ===============================
// SIZE CHART MANAGEMENT
// ===============================
// Get all size charts (accessible by both members and admins)
router.get('/size-charts', authenticate, getSizeCharts);

// ===============================
// SHIRT PRICE MANAGEMENT
// ===============================
// Get shirt prices (accessible by both members and admins)
router.get('/shirt-prices', authenticate, getShirtPrices);

// Update shirt price (Admin only)
router.put('/shirt-prices', authenticate, authorizeAdmin, updateShirtPrice);

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

// Update uniform in inventory
router.put('/:id', authenticate, authorizeAdmin, updateUniform);

// Delete uniform from inventory (by ID) - MUST be LAST (generic route)
router.delete('/:id', authenticate, authorizeAdmin, deleteUniform);

export default router;
