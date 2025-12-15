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

// ===============================
// PUBLIC SIGN UP / REGISTRATION
// ===============================
export const signUp = async (req: Request, res: Response) => {
  try {
    const { sispaId, name, email, batch, password, memberId, matricNumber, profilePicture } = req.body;

    // Validate required fields - sispaId is now required
    if (!sispaId || !name || !email || !batch || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields: sispaId, name, email, batch, and password are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid email format' 
      });
    }

    // Validate password strength (minimum 6 characters)
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: 'Password must be at least 6 characters long' 
      });
    }

    // Check if SISPA ID already exists
    const existingSispaId = await MemberModel.findOne({ sispaId });
    if (existingSispaId) {
      return res.status(400).json({ 
        success: false,
        message: 'SISPA ID already exists. Please use a different SISPA ID or try logging in.' 
      });
    }

    // Check if email already exists
    const existingEmail = await MemberModel.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ 
        success: false,
        message: 'Email already exists. Please use a different email or try logging in.' 
      });
    }

    // Check if memberId already exists (if provided - optional)
    if (memberId) {
      const existingMemberId = await MemberModel.findOne({ memberId });
      if (existingMemberId) {
        return res.status(400).json({ 
          success: false,
          message: 'Member ID already exists. Please use a different Member ID.' 
        });
      }
    }

    // Hash password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new member with hashed password (role defaults to 'member')
    const newMember = new MemberModel({
      sispaId: sispaId.trim(), // Primary identifier - required
      name: name.trim(),
      email: email.trim(),
      batch: batch.trim(),
      password: hashedPassword,
      role: 'member', // Always set to 'member' for public sign-ups
      memberId: memberId ? memberId.trim() : null, // Optional - for backward compatibility
      matricNumber: matricNumber ? matricNumber.trim() : null,
      phoneNumber: null, // Not used in sign up
      profilePicture: profilePicture ? profilePicture.trim() : null,
    });

    await newMember.save();

    // Return member without password
    const memberResponse = newMember.toObject();
    const { password: _, resetPasswordToken: __, resetPasswordExpires: ___, ...memberWithoutSensitive } = memberResponse;

    res.status(201).json({ 
      success: true,
      message: 'Account created successfully. You can now log in.', 
      member: memberWithoutSensitive 
    });
  } catch (error: any) {
    // Handle unique constraint errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        success: false,
        message: `${field === 'email' ? 'Email' : field === 'sispaId' ? 'SISPA ID' : field === 'memberId' ? 'Member ID' : field} already exists. Please use a different value.` 
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
    console.error('Sign up error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error creating account', 
      error: error.message 
    });
  }
};

// ===============================
// ADMIN: Add new member
// ===============================
export const addMember = async (req: Request, res: Response) => {
  try {
    const { sispaId, name, email, batch, password, role, memberId, matricNumber, phoneNumber, profilePicture } = req.body;

    // Validate required fields - sispaId is now required
    if (!sispaId || !name || !email || !batch || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields: sispaId, name, email, batch, and password are required' 
      });
    }

    // Check if SISPA ID already exists
    const existingSispaId = await MemberModel.findOne({ sispaId });
    if (existingSispaId) {
      return res.status(400).json({ 
        success: false,
        message: 'SISPA ID already exists. Please use a different SISPA ID.' 
      });
    }

    // Check if email already exists
    const existingEmail = await MemberModel.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ 
        success: false,
        message: 'Email already exists. Please use a different email.' 
      });
    }

    // Check if memberId already exists (if provided - optional)
    if (memberId) {
      const existingMemberId = await MemberModel.findOne({ memberId });
      if (existingMemberId) {
        return res.status(400).json({ 
          success: false,
          message: 'Member ID already exists. Please use a different Member ID.' 
        });
      }
    }

    // Hash password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new member with hashed password
    const newMember = new MemberModel({
      sispaId: sispaId.trim(), // Primary identifier - required
      name: name.trim(),
      email: email.trim(),
      batch: batch.trim(),
      password: hashedPassword,
      role: role || 'member',
      memberId: memberId ? memberId.trim() : null, // Optional - for backward compatibility
      matricNumber: matricNumber ? matricNumber.trim() : null,
      phoneNumber: phoneNumber ? phoneNumber.trim() : null,
      profilePicture: profilePicture ? profilePicture.trim() : null,
    });

    await newMember.save();

    // Return member without password
    const memberResponse = newMember.toObject();
    const { password: _, resetPasswordToken: __, resetPasswordExpires: ___, ...memberWithoutSensitive } = memberResponse;

    res.status(201).json({ 
      success: true,
      message: 'Member added successfully', 
      member: memberWithoutSensitive 
    });
  } catch (error: any) {
    // Handle unique constraint errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        success: false,
        message: `${field === 'email' ? 'Email' : field === 'sispaId' ? 'SISPA ID' : field === 'memberId' ? 'Member ID' : field} already exists. Please use a different value.` 
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
    console.error('Add member error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error adding member', 
      error: error.message 
    });
  }
};

// Update member
export const updateMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // id is now sispaId
    const { 
      name, 
      email, 
      batch, 
      password,
      role,
      memberId, 
      matricNumber, 
      phoneNumber, 
      profilePicture 
    } = req.body;

    // Check if member exists by sispaId
    const existingMember = await MemberModel.findOne({ sispaId: id });
    if (!existingMember) {
      return res.status(404).json({ 
        success: false,
        message: 'Member not found' 
      });
    }

    const updateData: any = {};

    // Update fields if provided
    if (name !== undefined && name !== null && name.trim() !== '') {
      updateData.name = name.trim();
    }
    if (email !== undefined && email !== null && email.trim() !== '') {
      updateData.email = email.trim();
    }
    if (batch !== undefined && batch !== null && batch.trim() !== '') {
      updateData.batch = batch.trim();
    }
    if (role !== undefined && role !== null) {
      updateData.role = role;
    }
    if (password !== undefined && password !== null && password.trim() !== '') {
      // Hash password if being updated
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password.trim(), salt);
    }
    // Note: sispaId cannot be updated as it's the primary identifier
    if (matricNumber !== undefined) {
      updateData.matricNumber = matricNumber === '' || matricNumber === null ? null : matricNumber.trim();
    }
    if (phoneNumber !== undefined) {
      updateData.phoneNumber = phoneNumber === '' || phoneNumber === null ? null : phoneNumber.trim();
    }
    // profilePicture removed - images only for uniform/shirt cards, not profile

    // Check if no fields to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No fields provided to update' 
      });
    }

    // Validate email uniqueness if email is being updated
    if (updateData.email) {
      const emailExists = await MemberModel.findOne({ 
        email: updateData.email,
        sispaId: { $ne: id }
      });
      
      if (emailExists) {
        return res.status(400).json({ 
          success: false,
          message: 'Email already exists. Please use a different email.' 
        });
      }
    }

    // Check if memberId is being updated and if it conflicts with another user
    if (updateData.memberId !== undefined && updateData.memberId !== null && updateData.memberId !== '') {
      const memberIdExists = await MemberModel.findOne({ 
        memberId: updateData.memberId,
        sispaId: { $ne: id }
      });
      
      if (memberIdExists) {
        return res.status(400).json({ 
          success: false,
          message: 'Member ID already exists. Please use a different Member ID.' 
        });
      }
    }

    const updatedMember = await MemberModel.findOneAndUpdate(
      { sispaId: id },
      updateData,
      { new: true, runValidators: true }
    ).select('-password -resetPasswordToken -resetPasswordExpires');

    if (!updatedMember) {
      return res.status(404).json({ 
        success: false,
        message: 'Member not found' 
      });
    }

    res.json({ 
      success: true,
      message: 'Member updated successfully', 
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
    console.error('Update member error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating member', 
      error: error.message 
    });
  }
};

// Delete member
export const deleteMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // id is now sispaId
    const deletedMember = await MemberModel.findOneAndDelete({ sispaId: id });
    if (!deletedMember) return res.status(404).json({ success: false, message: 'Member not found' });
    res.json({ success: true, message: 'Member deleted successfully', member: deletedMember });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting member', error });
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
      subject: "Reset Your Password make more stronger",
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
// LOGIN CONTROLLER (Uses sispaId as primary, supports memberId for backward compatibility)
// ===============================
export const loginMember = async (req: Request, res: Response) => {
  try {
    const { sispaId, memberId, password } = req.body;

    // Validate password is provided
    if (!password) {
      return res.status(400).json({ success: false, message: "Password is required" });
    }

    // Validate at least one identifier is provided
    if (!sispaId && !memberId) {
      return res.status(400).json({ success: false, message: "Please provide sispaId or memberId" });
    }

    // Find member by sispaId (primary) or memberId (backward compatibility)
    // Trim whitespace from input
    let member;
    if (sispaId) {
      // Login with SISPA ID (primary method) - trim and search
      const trimmedSispaId = sispaId.trim();
      member = await MemberModel.findOne({ sispaId: trimmedSispaId });
      
      // If not found, try without trimming (in case database has extra spaces)
      if (!member) {
        member = await MemberModel.findOne({ sispaId: sispaId });
      }
    } else if (memberId) {
      // Login with memberId (for backward compatibility) - trim and search
      const trimmedMemberId = memberId.trim();
      member = await MemberModel.findOne({ memberId: trimmedMemberId });
      
      // If not found, try without trimming
      if (!member) {
        member = await MemberModel.findOne({ memberId: memberId });
      }
    }

    if (!member) {
      console.log('Login attempt failed - User not found:', { sispaId, memberId });
      return res.status(400).json({ success: false, message: "Invalid ID or Password" });
    }

    // Check if member has a password (should always be hashed)
    if (!member.password) {
      console.error('Member found but has no password:', member.sispaId || member.memberId);
      return res.status(400).json({ success: false, message: "Account error. Please contact administrator." });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password.trim(), member.password);
    
    if (!isMatch) {
      console.log('Login attempt failed - Password mismatch for:', member.sispaId || member.memberId);
      return res.status(400).json({ success: false, message: "Invalid ID or Password" });
    }

    // Check if member has sispaId (required for new system)
    if (!member.sispaId) {
      console.warn('Member logged in without sispaId:', member.memberId);
      return res.status(400).json({ 
        success: false, 
        message: "Account needs to be updated. Please contact administrator." 
      });
    }

    // Generate JWT token - sispaId is now primary
    const token = jwt.sign(
      {
        sispaId: member.sispaId, // Primary identifier
        role: member.role,
        memberId: member.memberId, // Optional - for backward compatibility
      },
      JWT_SECRET,
      { expiresIn: '7d' } // Token expires in 7 days
    );

    console.log('Login successful for:', member.sispaId || member.memberId);
    console.log('Login response data:', {
      sispaId: member.sispaId,
      name: member.name,
      email: member.email,
      batch: member.batch,
      matricNumber: member.matricNumber,
      phoneNumber: member.phoneNumber,
      profilePicture: member.profilePicture
    });

    // Success - Return ALL profile data
    res.json({
      success: true,
      message: "Login successful",
      token,
      member: {
        sispaId: member.sispaId,
        name: member.name,
        email: member.email,
        batch: member.batch,
        role: member.role,
        memberId: member.memberId,
        matricNumber: member.matricNumber || null,
        phoneNumber: member.phoneNumber || null,
        profilePicture: member.profilePicture || null
      }
    });

  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: "Login error", error: error.message });
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

    console.log('Getting profile for sispaId:', req.user.sispaId);
    
    // Find member by sispaId (primary identifier)
    let member = await MemberModel.findOne({ sispaId: req.user.sispaId }).select('-password -resetPasswordToken -resetPasswordExpires');
    
    // Fallback to memberId for backward compatibility
    if (!member && req.user.memberId) {
      console.log('Member not found by sispaId, trying memberId:', req.user.memberId);
      member = await MemberModel.findOne({ memberId: req.user.memberId }).select('-password -resetPasswordToken -resetPasswordExpires');
    }
    
    if (!member) {
      console.error('Member not found with sispaId:', req.user.sispaId);
      return res.status(404).json({ success: false, message: "User information not found. Please try logging in again." });
    }

    console.log('Profile retrieved for', req.user.sispaId, ':', {
      name: member.name,
      email: member.email,
      batch: member.batch,
      matricNumber: member.matricNumber,
      phoneNumber: member.phoneNumber,
      profilePicture: member.profilePicture
    });

    res.json({
      success: true,
      member
    });
  } catch (error: any) {
    console.error('Error fetching profile:', error);
    // Ensure error is serializable
    res.status(500).json({ 
      success: false, 
      message: "Error fetching profile", 
      error: error?.message || String(error) 
    });
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

    // Check if user has sispaId (required for lookup)
    if (!req.user.sispaId && !req.user.memberId) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid user token. Please log in again." 
      });
    }

    // Members can update their own profile (sispaId cannot be changed as it's the primary identifier)
    const { 
      name, 
      email, 
      batch, 
      memberId, 
      matricNumber, 
      phoneNumber,
      profilePicture
    } = req.body;
    
    const updateData: any = {};
    
    // Helper function to safely trim strings
    const safeTrim = (value: any): string | null => {
      if (value === undefined || value === null) return null;
      if (typeof value !== 'string') return String(value).trim();
      return value.trim();
    };
    
    // Allow updating all profile fields (handle empty strings as null for optional fields)
    if (name !== undefined && name !== null) {
      const trimmedName = safeTrim(name);
      if (trimmedName && trimmedName !== '') {
        updateData.name = trimmedName;
      }
    }
    if (email !== undefined && email !== null) {
      const trimmedEmail = safeTrim(email);
      if (trimmedEmail && trimmedEmail !== '') {
        updateData.email = trimmedEmail;
      }
    }
    // Batch can be updated (required field, so must not be empty)
    if (batch !== undefined && batch !== null) {
      const trimmedBatch = safeTrim(batch);
      if (!trimmedBatch || trimmedBatch === '') {
        return res.status(400).json({ 
          success: false, 
          message: "Batch is required and cannot be empty" 
        });
      }
      updateData.batch = trimmedBatch;
    }
    // memberId can be updated (optional field)
    if (memberId !== undefined) {
      updateData.memberId = memberId === '' || memberId === null ? null : safeTrim(memberId);
    }
    // Optional fields - update if provided (even if empty string, set to null)
    if (matricNumber !== undefined) {
      if (matricNumber === '' || matricNumber === null) {
        updateData.matricNumber = null;
      } else {
        updateData.matricNumber = safeTrim(matricNumber);
      }
      console.log('matricNumber update:', { received: matricNumber, willSave: updateData.matricNumber });
    }
    if (phoneNumber !== undefined) {
      if (phoneNumber === '' || phoneNumber === null) {
        updateData.phoneNumber = null;
      } else {
        updateData.phoneNumber = safeTrim(phoneNumber);
      }
      console.log('phoneNumber update:', { received: phoneNumber, willSave: updateData.phoneNumber });
    }
    if (profilePicture !== undefined) {
      if (profilePicture === '' || profilePicture === null) {
        updateData.profilePicture = null;
      } else {
        updateData.profilePicture = safeTrim(profilePicture);
      }
      console.log('profilePicture update:', { received: profilePicture, willSave: updateData.profilePicture });
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
      // Build query to exclude current user
      const excludeQuery: any = { email: updateData.email };
      if (req.user.sispaId) {
        excludeQuery.sispaId = { $ne: req.user.sispaId };
      } else if (req.user.memberId) {
        excludeQuery.memberId = { $ne: req.user.memberId };
      }
      
      const existingEmail = await MemberModel.findOne(excludeQuery);
      
      if (existingEmail) {
        return res.status(400).json({ 
          success: false, 
          message: "Email already exists. Please use a different email." 
        });
      }
    }

    // Check if memberId is being updated and if it conflicts with another user
    if (updateData.memberId !== undefined && updateData.memberId !== null && updateData.memberId !== '') {
      // Build query to exclude current user
      const excludeQuery: any = { memberId: updateData.memberId };
      if (req.user.sispaId) {
        excludeQuery.sispaId = { $ne: req.user.sispaId };
      } else if (req.user.memberId) {
        excludeQuery.memberId = { $ne: req.user.memberId };
      }
      
      const existingMember = await MemberModel.findOne(excludeQuery);
      
      if (existingMember) {
        return res.status(400).json({ 
          success: false, 
          message: "Member ID already exists. Please use a different Member ID." 
        });
      }
    }

    console.log('Updating profile for sispaId:', req.user.sispaId, 'memberId:', req.user.memberId);
    console.log('Raw request body:', JSON.stringify(req.body, null, 2));
    console.log('Update data being saved:', JSON.stringify(updateData, null, 2));
    
    // Find member by sispaId (primary identifier) or memberId (fallback)
    let query: any = {};
    if (req.user.sispaId) {
      query = { sispaId: req.user.sispaId };
    } else if (req.user.memberId) {
      query = { memberId: req.user.memberId };
    } else {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid user token. Please log in again." 
      });
    }
    
    // Get current member data before update for logging
    const currentMember = await MemberModel.findOne(query);
    if (currentMember) {
      console.log('Current profile data BEFORE update:', {
        name: currentMember.name,
        email: currentMember.email,
        batch: currentMember.batch,
        matricNumber: currentMember.matricNumber,
        phoneNumber: currentMember.phoneNumber,
        profilePicture: currentMember.profilePicture
      });
    }
    
    // Use direct updateData (Mongoose will handle it correctly)
    const updatedMember = await MemberModel.findOneAndUpdate(
      query,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -resetPasswordToken -resetPasswordExpires');

    if (!updatedMember) {
      console.error('Member not found with query:', query);
      return res.status(404).json({ 
        success: false, 
        message: "User information not found. Please try logging in again." 
      });
    }

    // Verify the data was actually saved by querying again
    const verifiedMember = await MemberModel.findOne(query).select('-password -resetPasswordToken -resetPasswordExpires');
    
    console.log('Profile updated successfully. Saved data:', {
      name: verifiedMember?.name,
      email: verifiedMember?.email,
      batch: verifiedMember?.batch,
      matricNumber: verifiedMember?.matricNumber,
      phoneNumber: verifiedMember?.phoneNumber,
      profilePicture: verifiedMember?.profilePicture
    });

    res.json({
      success: true,
      message: "Profile updated successfully",
      member: verifiedMember || updatedMember
    });
  } catch (error: any) {
    console.error('Profile update error:', error);
    
    // Handle unique constraint errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      const fieldName = field === 'email' ? 'Email' : field === 'sispaId' ? 'SISPA ID' : field === 'memberId' ? 'Member ID' : field;
      return res.status(400).json({ 
        success: false, 
        message: `${fieldName} already exists. Please use a different value.` 
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors || {}).map((err: any) => err.message).join(', ');
      return res.status(400).json({ 
        success: false, 
        message: `Validation error: ${messages}` 
      });
    }
    
    // Handle Mongoose cast errors
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid data format: ${error.message}` 
      });
    }
    
    // Generic error response
    res.status(500).json({ 
      success: false, 
      message: "Error updating profile", 
      error: error?.message || String(error) 
    });
  }
};

