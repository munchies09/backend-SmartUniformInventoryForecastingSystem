import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import uniformRoutes from './routes/uniformRoutes';
import memberRoutes from './routes/memberRoutes';
import batchRoutes from './routes/batchRoutes';
import announcementRoutes from './routes/announcementRoutes';
import reportsRoutes from './routes/reportsRoutes';
import forecastRoutes from './routes/forecastRoutes';
import recommendedStockRoutes from './routes/recommendedStockRoutes';



// Load environment variables
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGODB_URI as string;

app.use(cors());
// Increase body size limit to 15MB to handle Base64 images (10MB Base64 = ~7.5MB original)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Middleware to normalize URLs (remove double slashes)
app.use((req, res, next) => {
  req.url = req.url.replace(/\/+/g, '/');
  next();
});

// Request logging middleware (for debugging)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request body:', JSON.stringify(req.body, null, 2).substring(0, 500)); // Limit log size
  }
  next();
});

//Routes
app.use('/api/uniforms', uniformRoutes);
app.use('/api/inventory', uniformRoutes); // Alias for frontend compatibility
app.use('/api/members', memberRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/forecast', forecastRoutes);
app.use('/api/recommended-stock', recommendedStockRoutes);


// Global error handler middleware (must be after all routes)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', err);
  
  // Don't send response if headers already sent
  if (res.headersSent) {
    return next(err);
  }
  
  // Send error response
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: err.stack })
  });
});

// 404 handler (must be after all routes and error handler)
app.use((req: express.Request, res: express.Response) => {
  // Don't send response if headers already sent
  if (res.headersSent) {
    return;
  }
  
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => console.error('❌ MongoDB connection failed:', err));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});