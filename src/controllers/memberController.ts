import { Request, Response } from 'express';
import MemberModel from '../models/memberModel';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import { normalizeBatch, normalizeBatchForResponse } from '../utils/batchNormalizer';

// Get all members (Admin only) - Returns all members excluding admin, arranged by batch
export const getMembers = async (req: Request, res: Response) => {
  try {
    // Find all members except admin (sispaId: "admin")
    const members = await MemberModel.find({ sispaId: { $ne: 'admin' } })
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .sort({ batch: 1, name: 1 }); // Sort by batch first, then by name
    
    // Format members to match frontend spec
    const formattedMembers = members.map(member => {
      const memberDoc = member as any; // Type assertion for mongoose document
      return {
        id: String(memberDoc._id),
        sispaId: member.sispaId,
        name: member.name,
        email: member.email,
        role: member.role,
        batch: normalizeBatchForResponse(member.batch) || "", // Normalize batch format
        gender: member.gender || null, // ✅ CRITICAL: Include gender field (required by frontend)
        matricNumber: member.matricNumber || null,
        phoneNumber: member.phoneNumber || null,
        profilePicture: member.profilePicture || null,
        createdAt: memberDoc.createdAt,
        updatedAt: memberDoc.updatedAt
      };
    });

    res.json({
      success: true,
      members: formattedMembers,
      total: formattedMembers.length
    });
  } catch (error: any) {
    console.error('Error fetching members:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching members', 
      error: error.message 
    });
  }
};

// ===============================
// PUBLIC SIGN UP / REGISTRATION
// ===============================
export const signUp = async (req: Request, res: Response) => {
  try {
    const { sispaId, name, email, batch, password, matricNumber, profilePicture } = req.body;

    // Validate required fields - batch is now optional
    if (!sispaId || !name || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields: sispaId, name, email, and password are required' 
      });
    }

    // Normalize inputs: SISPA ID to uppercase, email to lowercase
    const normalizedSispaId = sispaId.trim().toUpperCase();
    const normalizedEmail = email.trim().toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
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

    // Check if SISPA ID already exists (case-insensitive check)
    // First try exact match with normalized value (most common case)
    let existingSispaId = await MemberModel.findOne({ sispaId: normalizedSispaId });
    
    // If not found, try case-insensitive regex search (for backward compatibility with existing data)
    if (!existingSispaId) {
      existingSispaId = await MemberModel.findOne({ 
        sispaId: { $regex: new RegExp(`^${normalizedSispaId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
    }
    
    if (existingSispaId) {
      console.log('Duplicate SISPA ID detected:', {
        requested: normalizedSispaId,
        existing: existingSispaId.sispaId
      });
      return res.status(400).json({ 
        success: false,
        message: `SISPA ID "${normalizedSispaId}" already exists. Please use a different SISPA ID or try logging in.` 
      });
    }

    // Check if email already exists (case-insensitive check)
    // First try exact match with normalized value (most common case)
    let existingEmail = await MemberModel.findOne({ email: normalizedEmail });
    
    // If not found, try case-insensitive regex search (for backward compatibility with existing data)
    if (!existingEmail) {
      existingEmail = await MemberModel.findOne({ 
        email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
    }
    
    if (existingEmail) {
      console.log('Duplicate email detected:', {
        requested: normalizedEmail,
        existing: existingEmail.email
      });
      return res.status(400).json({ 
        success: false,
        message: 'Email already exists. Please use a different email or try logging in.' 
      });
    }


    // Hash password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Normalize batch if provided (optional field)
    const normalizedBatch = batch ? normalizeBatch(batch) : null;

    // Create new member with hashed password (role defaults to 'member')
    const newMember = new MemberModel({
      sispaId: normalizedSispaId, // Primary identifier - normalized to uppercase
      name: name.trim(),
      email: normalizedEmail, // Normalized to lowercase
      batch: normalizedBatch, // Normalized batch or null
      password: hashedPassword,
      role: 'member', // Always set to 'member' for public sign-ups
      matricNumber: matricNumber ? matricNumber.trim() : null,
      phoneNumber: null, // Not used in sign up
      profilePicture: profilePicture ? profilePicture.trim() : null,
    });
    
    console.log('Creating new member:', {
      sispaId: normalizedSispaId,
      email: normalizedEmail,
      batch: normalizedBatch
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
    // Handle unique constraint errors (MongoDB duplicate key error)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      const duplicateValue = error.keyValue ? error.keyValue[field] : 'unknown';
      
      // Log the error for debugging
      console.error('Duplicate key error during signup:', {
        field,
        duplicateValue,
        keyPattern: error.keyPattern,
        keyValue: error.keyValue
      });
      
      // Special handling for memberId index (should not happen after migration)
      if (field === 'memberId') {
        console.error('⚠️  WARNING: memberId index still exists in database!');
        console.error('⚠️  Please run: npm run drop-memberid-index');
        return res.status(500).json({ 
          success: false,
          message: 'Database configuration error. Please contact administrator. The memberId index needs to be removed from the database.' 
        });
      }
      
      // Determine the correct error message based on the field
      let fieldName = field;
      if (field === 'email') {
        fieldName = 'Email';
      } else if (field === 'sispaId') {
        fieldName = 'SISPA ID';
      }
      
      return res.status(400).json({ 
        success: false,
        message: `${fieldName} "${duplicateValue}" already exists. Please use a different ${fieldName === 'SISPA ID' ? 'SISPA ID' : fieldName === 'Email' ? 'email' : 'value'} or try logging in.` 
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
    const { sispaId, name, email, batch, password, role, matricNumber, phoneNumber, profilePicture } = req.body;

    // Validate required fields - batch is now optional
    if (!sispaId || !name || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields: sispaId, name, email, and password are required' 
      });
    }

    // Normalize inputs: SISPA ID to uppercase, email to lowercase
    const normalizedSispaId = sispaId.trim().toUpperCase();
    const normalizedEmail = email.trim().toLowerCase();

    // Check if SISPA ID already exists (case-insensitive check)
    const existingSispaId = await MemberModel.findOne({ 
      sispaId: { $regex: new RegExp(`^${normalizedSispaId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    if (existingSispaId) {
      return res.status(400).json({ 
        success: false,
        message: `SISPA ID "${normalizedSispaId}" already exists. Please use a different SISPA ID.` 
      });
    }

    // Check if email already exists (case-insensitive check)
    const existingEmail = await MemberModel.findOne({ 
      email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    if (existingEmail) {
      return res.status(400).json({ 
        success: false,
        message: 'Email already exists. Please use a different email.' 
      });
    }

    // Hash password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Normalize batch if provided
    const normalizedBatch = batch ? normalizeBatch(batch) : null;

    // Create new member with hashed password
    const newMember = new MemberModel({
      sispaId: normalizedSispaId, // Primary identifier - normalized to uppercase
      name: name.trim(),
      email: normalizedEmail, // Normalized to lowercase
      batch: normalizedBatch, // Normalized batch or null
      password: hashedPassword,
      role: role || 'member',
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
        message: `${field === 'email' ? 'Email' : field === 'sispaId' ? 'SISPA ID' : field} already exists. Please use a different value.` 
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
    // Normalize sispaId to uppercase for query
    const normalizedId = id.trim().toUpperCase();
    const { 
      name, 
      email, 
      batch, 
      password,
      role,
      matricNumber, 
      phoneNumber, 
      profilePicture 
    } = req.body;

    // Check if member exists by sispaId (try exact match first, then case-insensitive)
    let existingMember = await MemberModel.findOne({ sispaId: normalizedId });
    if (!existingMember) {
      existingMember = await MemberModel.findOne({ 
        sispaId: { $regex: new RegExp(`^${normalizedId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
    }
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
      updateData.email = email.trim().toLowerCase(); // Normalize email to lowercase
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

    // Validate email uniqueness if email is being updated (case-insensitive check)
    if (updateData.email) {
      const emailExists = await MemberModel.findOne({ 
        email: { $regex: new RegExp(`^${updateData.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        sispaId: { $ne: normalizedId }
      });
      
      if (emailExists) {
        return res.status(400).json({ 
          success: false,
          message: 'Email already exists. Please use a different email.' 
        });
      }
    }


    // Use normalized ID for update query
    const updatedMember = await MemberModel.findOneAndUpdate(
      { sispaId: normalizedId },
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
    // Normalize sispaId to uppercase for query
    const normalizedId = id.trim().toUpperCase();
    // Try exact match first, then case-insensitive
    let deletedMember = await MemberModel.findOneAndDelete({ sispaId: normalizedId });
    if (!deletedMember) {
      deletedMember = await MemberModel.findOneAndDelete({ 
        sispaId: { $regex: new RegExp(`^${normalizedId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
    }
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
    // Normalize email to lowercase
    const normalizedEmail = email.trim().toLowerCase();
    // Try exact match first, then case-insensitive search
    let member = await MemberModel.findOne({ email: normalizedEmail });
    if (!member) {
      member = await MemberModel.findOne({ 
        email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
    }
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
// LOGIN CONTROLLER (Uses sispaId only)
// ===============================
export const loginMember = async (req: Request, res: Response) => {
  try {
    const { sispaId, password } = req.body;

    // Validate password is provided
    if (!password) {
      return res.status(401).json({ success: false, message: "Invalid ID or Password" });
    }

    // Validate sispaId is provided
    if (!sispaId) {
      return res.status(401).json({ success: false, message: "Invalid ID or Password" });
    }

    // Find member by sispaId - normalize to uppercase
    const normalizedSispaId = sispaId.trim().toUpperCase();
    // Try exact match first (most common case)
    let member = await MemberModel.findOne({ sispaId: normalizedSispaId });
    
    // If not found, try case-insensitive search (for backward compatibility with existing data)
    if (!member) {
      member = await MemberModel.findOne({ 
        sispaId: { $regex: new RegExp(`^${normalizedSispaId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
    }

    if (!member) {
      console.log('Login attempt failed - User not found:', { sispaId: normalizedSispaId });
      return res.status(401).json({ success: false, message: "Invalid ID or Password" });
    }

    // Check if member has a password (should always be hashed)
    if (!member.password) {
      console.error('Member found but has no password:', member.sispaId);
      return res.status(401).json({ success: false, message: "Invalid ID or Password" });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password.trim(), member.password);
    
    if (!isMatch) {
      console.log('Login attempt failed - Password mismatch for:', member.sispaId);
      return res.status(401).json({ success: false, message: "Invalid ID or Password" });
    }

    // Generate JWT token - sispaId only
    const token = jwt.sign(
      {
        sispaId: member.sispaId, // Primary identifier
        role: member.role,
      },
      JWT_SECRET,
      { expiresIn: '7d' } // Token expires in 7 days
    );

    console.log('Login successful for:', member.sispaId);
    console.log('Login response data:', {
      sispaId: member.sispaId,
      name: member.name,
      email: member.email,
      batch: member.batch,
      matricNumber: member.matricNumber,
      phoneNumber: member.phoneNumber,
      profilePicture: member.profilePicture
    });

    // Success - Return ALL profile data matching frontend spec
    // Admin should have empty batch string as per frontend spec
    const userBatch = member.role === 'admin' ? "" : (normalizeBatchForResponse(member.batch) || "");
    const memberDoc = member as any; // Type assertion for mongoose document
    
    res.json({
      success: true,
      user: {
        id: String(memberDoc._id),
        sispaId: member.sispaId,
        name: member.name,
        email: member.email,
        role: member.role,
        batch: userBatch, // Normalized batch format
        gender: member.gender || null, // Include gender field
        matricNumber: member.matricNumber || null,
        phoneNumber: member.phoneNumber || null,
        profilePicture: member.profilePicture || null
      },
      token
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
    const member = await MemberModel.findOne({ sispaId: req.user.sispaId }).select('-password -resetPasswordToken -resetPasswordExpires');
    
    if (!member) {
      console.error('Member not found with sispaId:', req.user.sispaId);
      return res.status(404).json({ success: false, message: "User information not found. Please try logging in again." });
    }

    console.log('Profile retrieved for', req.user.sispaId, ':', {
      name: member.name,
      email: member.email,
      batch: member.batch,
      gender: member.gender,
      matricNumber: member.matricNumber,
      phoneNumber: member.phoneNumber,
      profilePicture: member.profilePicture
    });

    // Explicitly return member with all fields including gender
    const memberDoc = member as any;
    res.json({
      success: true,
      member: {
        id: String(memberDoc._id),
        sispaId: member.sispaId,
        name: member.name,
        email: member.email,
        batch: member.batch,
        role: member.role,
        gender: member.gender || null, // Explicitly include gender
        matricNumber: member.matricNumber || null,
        phoneNumber: member.phoneNumber || null,
        profilePicture: member.profilePicture || null,
        createdAt: memberDoc.createdAt,
        updatedAt: memberDoc.updatedAt
      }
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
    if (!req.user.sispaId) {
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
      gender,
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
        updateData.email = trimmedEmail.toLowerCase(); // Normalize email to lowercase
      }
    }
    // Batch can be updated (optional field, normalize if provided)
    if (batch !== undefined) {
      if (batch === null || batch === '') {
        updateData.batch = null; // Allow clearing batch
      } else {
        const normalizedBatch = normalizeBatch(batch);
        if (normalizedBatch) {
          updateData.batch = normalizedBatch;
        } else {
          // If normalization fails (no number found), return null
          updateData.batch = null;
        }
      }
    }
    // Gender field - validate and update if provided
    if (gender !== undefined) {
      if (gender === null || gender === '') {
        updateData.gender = null;
      } else if (gender === 'Male' || gender === 'Female') {
        updateData.gender = gender;
      } else {
        return res.status(400).json({ 
          success: false, 
          message: 'Gender must be "Male" or "Female"'
        });
      }
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

    // Validate email uniqueness if email is being updated (case-insensitive check)
    if (updateData.email) {
      // Build query to exclude current user
      const excludeQuery: any = { 
        email: { $regex: new RegExp(`^${updateData.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        sispaId: { $ne: req.user.sispaId }
      };
      
      const existingEmail = await MemberModel.findOne(excludeQuery);
      
      if (existingEmail) {
        return res.status(400).json({ 
          success: false, 
          message: "Email already exists. Please use a different email." 
        });
      }
    }

    console.log('Updating profile for sispaId:', req.user.sispaId);
    console.log('Raw request body:', JSON.stringify(req.body, null, 2));
    console.log('Update data being saved:', JSON.stringify(updateData, null, 2));
    
    // Find member by sispaId (primary identifier)
    const query = { sispaId: req.user.sispaId };
    
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

    // Format response with normalized batch
    const responseMember = verifiedMember || updatedMember;
    const memberDoc = responseMember as any;

    res.json({
      success: true,
      message: "Profile updated successfully",
      member: {
        id: String(memberDoc._id),
        sispaId: responseMember.sispaId,
        name: responseMember.name,
        email: responseMember.email,
        batch: normalizeBatchForResponse(responseMember.batch) || "",
        role: responseMember.role,
        gender: responseMember.gender || null,
        matricNumber: responseMember.matricNumber || null,
        phoneNumber: responseMember.phoneNumber || null,
        profilePicture: responseMember.profilePicture || null,
        createdAt: memberDoc.createdAt,
        updatedAt: memberDoc.updatedAt
      }
    });
  } catch (error: any) {
    console.error('Profile update error:', error);
    
    // Handle unique constraint errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      const fieldName = field === 'email' ? 'Email' : field === 'sispaId' ? 'SISPA ID' : field;
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

