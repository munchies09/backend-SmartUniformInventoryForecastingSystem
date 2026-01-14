import express from 'express';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import {
  importRecommendedStock,
  getAllRecommendedStock,
  getRecommendedStock,
  getInventoryWithRecommendations,
  getGraphData,
  deleteOldRecommendations
} from '../controllers/recommendedStockController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Import recommended stock from Google Colab (Admin only)
// POST /api/recommended-stock/import
router.post('/import', authorizeAdmin, importRecommendedStock);

// Get all recommended stock
// GET /api/recommended-stock?category=Uniform%20No%203&latest=true
router.get('/', getAllRecommendedStock);

// Get recommended stock for specific item
// GET /api/recommended-stock/item?category=Uniform%20No%203&type=Cloth%20No%203&size=M
router.get('/item', getRecommendedStock);

// Get inventory items with recommendations comparison
// GET /api/recommended-stock/inventory?category=Uniform%20No%203
router.get('/inventory', getInventoryWithRecommendations);

// Get graph data (sorted by size for plotting)
// GET /api/recommended-stock/graph?category=Uniform%20No%203&type=BAJU%20NO%203%20LELAKI
router.get('/graph', getGraphData);

// Delete old recommendations (Admin only, for cleanup)
// DELETE /api/recommended-stock/cleanup?days=90
router.delete('/cleanup', authorizeAdmin, deleteOldRecommendations);

export default router;
