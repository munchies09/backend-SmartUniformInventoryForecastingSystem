import express from 'express';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import {
  getForecast,
  getAllForecasts,
  getModelInfo,
  uploadModel,
  getFeatureVector,
  runForecast
} from '../controllers/forecastController';

const router = express.Router();

// All forecast routes require authentication
router.use(authenticate);

// Get forecast for specific item
// GET /api/forecast?category=Uniform%20No%203&type=Cloth%20No%203&size=M&forecastDate=2024-01-15
router.get('/', getForecast);

// Get forecasts for all inventory items
// GET /api/forecast/all?category=Uniform%20No%203&forecastDate=2024-01-15
router.get('/all', getAllForecasts);

// Get model information
// GET /api/forecast/model
router.get('/model', getModelInfo);

// Upload/update ML model (Admin only)
// POST /api/forecast/model
router.post('/model', authorizeAdmin, uploadModel);

// Run forecast using pre-trained ML model (Admin only)
// POST /api/forecast/run
router.post('/run', authorizeAdmin, runForecast);

// Get feature vector for testing (optional, for debugging)
// GET /api/forecast/features?category=Uniform%20No%203&type=Cloth%20No%203&size=M
router.get('/features', getFeatureVector);

export default router;
