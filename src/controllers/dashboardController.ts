import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import MemberModel from '../models/memberModel';
import AnnouncementModel from '../models/announcementModel';
import { Uniform } from '../models/uniformModel';

// Get user dashboard data
export const getUserDashboard = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Get user profile
    const member = await MemberModel.findOne({ memberId: req.user.memberId })
      .select('-password -resetPasswordToken -resetPasswordExpires');

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    // Get latest announcements (limit to 5 for dashboard)
    const announcements = await AnnouncementModel.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title content createdAt');

    // Check if user has uniform
    const userUniform = await Uniform.findOne({ memberId: req.user.memberId });

    // Dashboard data
    const dashboardData = {
      success: true,
      user: {
        name: member.name,
        memberId: member.memberId,
        email: member.email,
        batch: member.batch,
        role: member.role,
        sispaId: member.sispaId,
        matricNumber: member.matricNumber,
        phoneNumber: member.phoneNumber,
        profilePicture: member.profilePicture
      },
      announcements: announcements || [],
      hasUniform: !!userUniform,
      uniform: userUniform || null
    };

    res.json(dashboardData);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching dashboard data', error });
  }
};

