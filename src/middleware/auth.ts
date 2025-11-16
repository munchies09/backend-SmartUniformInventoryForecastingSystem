import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request to include user info
export interface AuthRequest extends Request {
  user?: {
    memberId: string;
    role: 'admin' | 'member';
    sispaId?: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Authentication middleware - verifies JWT token
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      memberId: string;
      role: 'admin' | 'member';
      sispaId?: string;
    };

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Authorization middleware - checks if user is admin
export const authorizeAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'User not authenticated' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
  }

  next();
};

// Authorization middleware - checks if user is member
export const authorizeMember = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'User not authenticated' });
  }

  if (req.user.role !== 'member') {
    return res.status(403).json({ success: false, message: 'Access denied. Member only.' });
  }

  next();
};

export { JWT_SECRET };

