import { Request, Response } from 'express';
import { Uniform } from '../models/uniformModel';
import { AuthRequest } from '../middleware/auth';

export const getUniforms = async (req: Request, res: Response) => {
  const uniforms = await Uniform.find();
  res.json(uniforms);
};

export const addUniform = async (req: Request, res: Response) => {
  const newUniform = new Uniform(req.body);
  await newUniform.save();
  res.status(201).json({ message: 'Uniform added successfully', uniform: newUniform });
};

export const updateUniform = async (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = await Uniform.findByIdAndUpdate(id, req.body, { new: true });
  if (!updated) return res.status(404).json({ message: 'Uniform not found' });
  res.json({ message: 'Uniform updated successfully', uniform: updated });
};

export const deleteUniform = async (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = await Uniform.findByIdAndDelete(id);
  if (!deleted) return res.status(404).json({ message: 'Uniform not found' });
  res.json({ message: 'Uniform deleted successfully' });
};

// ===============================
// MEMBER-SPECIFIC UNIFORM ENDPOINTS
// ===============================

// Get member's own uniform
export const getOwnUniform = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const uniform = await Uniform.findOne({ memberId: req.user.memberId });
    
    if (!uniform) {
      return res.status(404).json({ success: false, message: 'Uniform not found. Please add your uniform first.' });
    }

    res.json({
      success: true,
      uniform
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching uniform', error });
  }
};

// Add member's own uniform (first time login)
export const addOwnUniform = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Check if member already has a uniform
    const existingUniform = await Uniform.findOne({ memberId: req.user.memberId });
    if (existingUniform) {
      return res.status(400).json({ success: false, message: 'Uniform already exists. Use update endpoint to modify.' });
    }

    // Create new uniform linked to member
    const newUniform = new Uniform({
      ...req.body,
      memberId: req.user.memberId
    });
    await newUniform.save();

    res.status(201).json({
      success: true,
      message: 'Uniform added successfully',
      uniform: newUniform
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding uniform', error });
  }
};

// Update member's own uniform
export const updateOwnUniform = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Find and update only the member's own uniform
    const updatedUniform = await Uniform.findOneAndUpdate(
      { memberId: req.user.memberId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedUniform) {
      return res.status(404).json({ success: false, message: 'Uniform not found' });
    }

    res.json({
      success: true,
      message: 'Uniform updated successfully',
      uniform: updatedUniform
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating uniform', error });
  }
};
