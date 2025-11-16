import { Request, Response } from 'express';
import MemberModel from '../models/memberModel';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';

// Get all members
export const getMembers = async (req: Request, res: Response) => {
  try {
    const members = await MemberModel.find();
    res.json(members);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching members', error });
  }
};

// Add new member
export const addMember = async (req: Request, res: Response) => {
  try {
    const newMember = new MemberModel(req.body);
    await newMember.save();
    res.status(201).json({ message: 'Member added successfully', member: newMember });
  } catch (error) {
    res.status(500).json({ message: 'Error adding member', error });
  }
};

// Update member
export const updateMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updatedMember = await MemberModel.findOneAndUpdate(
      { memberId: id },
      req.body,
      { new: true }
    );
    if (!updatedMember) return res.status(404).json({ message: 'Member not found' });
    res.json({ message: 'Member updated successfully', member: updatedMember });
  } catch (error) {
    res.status(500).json({ message: 'Error updating member', error });
  }
};

// Delete member
export const deleteMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deletedMember = await MemberModel.findOneAndDelete({ memberId: id });
    if (!deletedMember) return res.status(404).json({ message: 'Member not found' });
    res.json({ message: 'Member deleted successfully', member: deletedMember });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting member', error });
  }
};

// ===============================
// FORGOT PASSWORD
// ===============================
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const member = await MemberModel.findOne({ email });
    if (!member) return res.status(404).json({ message: "Email not found" });

    const token = crypto.randomBytes(32).toString("hex");

    member.resetPasswordToken = token;
    member.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await member.save();

    const resetLink = `http://localhost:3000/reset-password/${token}`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      to: email,
      subject: "Reset Your Password",
      html: `
        <p>You requested a password reset.</p>
        <p>Click the link below to set a new password (valid for 1 hour):</p>
        <a href="${resetLink}">${resetLink}</a>
      `,
    });

    res.json({ success: true, message: "Password reset email sent successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error sending reset email", error });
  }
};

// ===============================
// RESET PASSWORD (with hashing)
// ===============================
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { password } = req.body; // matches frontend

    const member = await MemberModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!member) {
      return res.status(400).json({ success: false, message: "Invalid or expired token" });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    member.password = hashedPassword;
    member.resetPasswordToken = null;
    member.resetPasswordExpires = null;
    await member.save();

    res.json({ success: true, message: "Password reset successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error resetting password", error });
  }
};


// ===============================
// LOGIN CONTROLLER (Supports both memberId and sispaId)
// ===============================
export const loginMember = async (req: Request, res: Response) => {
  try {
    const { memberId, sispaId, password } = req.body;

    // Find member by memberId or sispaId
    let member;
    if (sispaId) {
      // Login with SISPA ID (for members)
      member = await MemberModel.findOne({ sispaId });
    } else if (memberId) {
      // Login with memberId (for admin or members)
      member = await MemberModel.findOne({ memberId });
    } else {
      return res.status(400).json({ success: false, message: "Please provide memberId or sispaId" });
    }

    if (!member) {
      return res.status(400).json({ success: false, message: "Invalid ID or Password" });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, member.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid ID or Password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        memberId: member.memberId,
        role: member.role,
        sispaId: member.sispaId,
      },
      JWT_SECRET,
      { expiresIn: '7d' } // Token expires in 7 days
    );

    // Success
    res.json({
      success: true,
      message: "Login successful",
      token,
      member: {
        memberId: member.memberId,
        name: member.name,
        email: member.email,
        role: member.role,
        sispaId: member.sispaId,
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: "Login error", error });
  }
};

// ===============================
// GET OWN PROFILE (Member only)
// ===============================
export const getOwnProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const member = await MemberModel.findOne({ memberId: req.user.memberId }).select('-password -resetPasswordToken -resetPasswordExpires');
    
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    res.json({
      success: true,
      member
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching profile", error });
  }
};

// ===============================
// UPDATE OWN PROFILE (Member only)
// ===============================
export const updateOwnProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    // Members can update their own profile including SISPA ID
    const { 
      name, 
      email, 
      batch, 
      sispaId, 
      matricNumber, 
      phoneNumber, 
      profilePicture 
    } = req.body;
    
    const updateData: any = {};
    
    // Allow updating all profile fields (handle empty strings as null for optional fields)
    if (name !== undefined && name !== null && name.trim() !== '') {
      updateData.name = name.trim();
    }
    if (email !== undefined && email !== null && email.trim() !== '') {
      updateData.email = email.trim();
    }
    if (batch !== undefined && batch !== null && batch.trim() !== '') {
      updateData.batch = batch.trim();
    }
    // SISPA ID can be updated, allow empty string to clear it
    if (sispaId !== undefined) {
      updateData.sispaId = sispaId === '' || sispaId === null ? null : sispaId.trim();
    }
    // Optional fields - allow empty strings to clear them
    if (matricNumber !== undefined) {
      updateData.matricNumber = matricNumber === '' || matricNumber === null ? null : matricNumber.trim();
    }
    if (phoneNumber !== undefined) {
      updateData.phoneNumber = phoneNumber === '' || phoneNumber === null ? null : phoneNumber.trim();
    }
    if (profilePicture !== undefined) {
      updateData.profilePicture = profilePicture === '' || profilePicture === null ? null : profilePicture.trim();
    }

    // Check if no fields to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "No fields provided to update" 
      });
    }

    // Validate email uniqueness if email is being updated
    if (updateData.email) {
      const existingEmail = await MemberModel.findOne({ 
        email: updateData.email,
        memberId: { $ne: req.user.memberId }
      });
      
      if (existingEmail) {
        return res.status(400).json({ 
          success: false, 
          message: "Email already exists. Please use a different email." 
        });
      }
    }

    // Check if SISPA ID is being updated and if it conflicts with another user
    if (updateData.sispaId !== undefined && updateData.sispaId !== null && updateData.sispaId !== '') {
      const existingMember = await MemberModel.findOne({ 
        sispaId: updateData.sispaId,
        memberId: { $ne: req.user.memberId } // Exclude current user
      });
      
      if (existingMember) {
        return res.status(400).json({ 
          success: false, 
          message: "SISPA ID already exists. Please use a different SISPA ID." 
        });
      }
    }

    const updatedMember = await MemberModel.findOneAndUpdate(
      { memberId: req.user.memberId },
      updateData,
      { new: true, runValidators: true }
    ).select('-password -resetPasswordToken -resetPasswordExpires');

    if (!updatedMember) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      member: updatedMember
    });
  } catch (error: any) {
    // Handle unique constraint errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        success: false, 
        message: `${field === 'email' ? 'Email' : 'SISPA ID'} already exists. Please use a different value.` 
      });
    }
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message).join(', ');
      return res.status(400).json({ 
        success: false, 
        message: `Validation error: ${messages}` 
      });
    }
    console.error('Profile update error:', error);
    res.status(500).json({ success: false, message: "Error updating profile", error: error.message });
  }
};

