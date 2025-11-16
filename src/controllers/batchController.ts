import { Request, Response } from 'express';
import { Batch } from '../models/batchModel';

export const getBatches = async (req: Request, res: Response) => {
  const batches = await Batch.find();
  res.json(batches);
};

export const addBatch = async (req: Request, res: Response) => {
  const newBatch = new Batch(req.body);
  await newBatch.save();
  res.status(201).json({ message: 'Batch added successfully', batch: newBatch });
};

export const updateBatch = async (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = await Batch.findByIdAndUpdate(id, req.body, { new: true });
  if (!updated) return res.status(404).json({ message: 'Batch not found' });
  res.json({ message: 'Batch updated successfully', batch: updated });
};

export const deleteBatch = async (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = await Batch.findByIdAndDelete(id);
  if (!deleted) return res.status(404).json({ message: 'Batch not found' });
  res.json({ message: 'Batch deleted successfully' });
};
