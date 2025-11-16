import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import uniformRoutes from './routes/uniformRoutes';
import memberRoutes from './routes/memberRoutes';
import batchRoutes from './routes/batchRoutes';
import announcementRoutes from './routes/announcementRoutes';


// Load environment variables
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGODB_URI as string;

app.use(cors());
app.use(express.json());

// Middleware to normalize URLs (remove double slashes)
app.use((req, res, next) => {
  req.url = req.url.replace(/\/+/g, '/');
  next();
});

//Routes
app.use('/api/uniforms', uniformRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/announcements', announcementRoutes);

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => console.error('❌ MongoDB connection failed:', err));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});