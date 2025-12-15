import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import MemberModel from '../models/memberModel';
import AnnouncementModel from '../models/announcementModel';
import { MemberUniform } from '../models/uniformModel';

// Get user dashboard data
export const getUserDashboard = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Get user profile
    console.log('Getting dashboard for sispaId:', req.user.sispaId);
    
    // Find member by sispaId (primary identifier)
    let member = await MemberModel.findOne({ sispaId: req.user.sispaId })
      .select('-password -resetPasswordToken -resetPasswordExpires');

    // Fallback to memberId for backward compatibility
    if (!member && req.user.memberId) {
      console.log('Member not found by sispaId, trying memberId:', req.user.memberId);
      member = await MemberModel.findOne({ memberId: req.user.memberId })
        .select('-password -resetPasswordToken -resetPasswordExpires');
    }

    if (!member) {
      console.error('Member not found with sispaId:', req.user.sispaId);
      return res.status(404).json({ success: false, message: 'User information not found. Please try logging in again.' });
    }

    // Get latest announcements (limit to 5 for dashboard)
    const announcements = await AnnouncementModel.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title content createdAt');

    // Check if user has uniform (using sispaId)
    const userUniform = await MemberUniform.findOne({ sispaId: req.user.sispaId });

    // Dashboard data
    const dashboardData = {
      success: true,
      user: {
        name: member.name,
        sispaId: member.sispaId,
        email: member.email,
        batch: member.batch,
        role: member.role,
        memberId: member.memberId,
        matricNumber: member.matricNumber,
        phoneNumber: member.phoneNumber,
        profilePicture: member.profilePicture
      },
      announcements: announcements || [],
      hasUniform: !!userUniform,
      uniform: userUniform ? {
        sispaId: userUniform.sispaId,
        items: userUniform.items,
        itemCount: userUniform.items.length
      } : null
    };

    res.json(dashboardData);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching dashboard data', error });
  }
};

