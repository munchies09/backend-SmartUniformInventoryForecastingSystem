import { Request, Response } from 'express';
import { UniformInventory, MemberUniform, IUniformItem } from '../models/uniformModel';
import { AuthRequest } from '../middleware/auth';

// ===============================
// ADMIN ROUTES - INVENTORY MANAGEMENT
// ===============================

export const getUniforms = async (req: Request, res: Response) => {
  try {
    const uniforms = await UniformInventory.find();
    res.json({ success: true, uniforms });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error fetching uniforms', error: error.message });
  }
};

export const addUniform = async (req: Request, res: Response) => {
  try {
    const { category, type, size, quantity, status } = req.body;
    
    if (!category || !type || !size || quantity === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: category, type, size, and quantity are required' 
      });
    }

    const newUniform = new UniformInventory({
      id: req.body.id || `${category}-${type}-${size}-${Date.now()}`,
      category,
      type,
      size,
      quantity: quantity || 0,
      status: status || 'out-of-stock'
    });
    
    await newUniform.save();
    res.status(201).json({ 
      success: true, 
      message: 'Uniform added to inventory successfully', 
      uniform: newUniform 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: 'Error adding uniform', 
      error: error.message 
    });
  }
};

export const updateUniform = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await UniformInventory.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Uniform not found' });
    }
    res.json({ success: true, message: 'Uniform updated successfully', uniform: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error updating uniform', error: error.message });
  }
};

export const deleteUniform = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await UniformInventory.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Uniform not found' });
    }
    res.json({ success: true, message: 'Uniform deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error deleting uniform', error: error.message });
  }
};

// ===============================
// MEMBER-SPECIFIC UNIFORM ENDPOINTS (Multiple Items Support)
// ===============================

// Get member's own uniform collection (all items)
export const getOwnUniform = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user.sispaId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const uniform = await MemberUniform.findOne({ sispaId: req.user.sispaId });
    
    if (!uniform) {
      return res.status(404).json({ 
        success: false, 
        message: 'Uniform not found. Please add your uniform items first.',
        items: []
      });
    }

    res.json({
      success: true,
      uniform: {
        sispaId: uniform.sispaId,
        items: uniform.items,
        itemCount: uniform.items.length,
        updatedAt: uniform.updatedAt,
        createdAt: uniform.createdAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching uniform', 
      error: error.message 
    });
  }
};

// ===============================
// NEW UNIFORM ENDPOINTS FOR /api/members/uniform
// ===============================

// GET /api/members/uniform - Get all uniform items for authenticated member
export const getMemberUniform = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user.sispaId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    const uniform = await MemberUniform.findOne({ sispaId: req.user.sispaId });
    
    if (!uniform) {
      return res.status(404).json({ 
        success: false, 
        message: 'Uniform not found. Please add your uniform items first.',
        items: []
      });
    }

    console.log(`Retrieved uniform collection for ${req.user.sispaId}: ${uniform.items.length} items found`);
    console.log('Items breakdown:', {
      uniformNo3: uniform.items.filter((i: any) => i.category === 'Uniform No 3').length,
      uniformNo4: uniform.items.filter((i: any) => i.category === 'Uniform No 4').length,
      tShirt: uniform.items.filter((i: any) => i.category === 'T-Shirt').length
    });

    res.json({
      success: true,
      uniform: {
        sispaId: uniform.sispaId,
        items: uniform.items,
        itemCount: uniform.items.length,
        updatedAt: uniform.updatedAt,
        createdAt: uniform.createdAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching uniform', 
      error: error.message 
    });
  }
};

// POST /api/members/uniform - Create/add uniform items (adds to existing if exists)
export const createMemberUniform = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user.sispaId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    const { items } = req.body;

    // Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide an array of uniform items. Each item must have: category, type, size, and quantity.' 
      });
    }

    // Validate each item
    for (const item of items) {
      if (!item.category || !item.type || !item.size || item.quantity === undefined) {
        return res.status(400).json({ 
          success: false, 
          message: 'Each uniform item must have: category, type, size, and quantity.' 
        });
      }
      if (typeof item.quantity !== 'number' || item.quantity < 1) {
        return res.status(400).json({ 
          success: false, 
          message: 'Quantity must be a number and at least 1.' 
        });
      }
    }

    // Check if member already has a uniform collection
    let uniform = await MemberUniform.findOne({ sispaId: req.user.sispaId });
    
    if (uniform) {
      // Smart merge: Add new items but avoid exact duplicates
      // Check for duplicates based on category, type, and size
      const existingItems = uniform.items;
      const newItemsToAdd: any[] = [];
      
      for (const newItem of items) {
        // Check if this exact item already exists
        const isDuplicate = existingItems.some((existing: any) => 
          existing.category === newItem.category &&
          existing.type === newItem.type &&
          existing.size === newItem.size
        );
        
        if (!isDuplicate) {
          newItemsToAdd.push(newItem);
        }
      }
      
      // Add only non-duplicate items
      if (newItemsToAdd.length > 0) {
        uniform.items.push(...newItemsToAdd);
        await uniform.save();
        
        console.log(`Added ${newItemsToAdd.length} new items to existing uniform collection for ${req.user.sispaId}`);
      } else {
        console.log(`All items already exist in uniform collection for ${req.user.sispaId}`);
      }
      
      return res.status(200).json({
        success: true,
        message: newItemsToAdd.length > 0 
          ? `Uniform items added successfully. ${newItemsToAdd.length} new items added.`
          : 'All items already exist in your uniform collection.',
        uniform: {
          sispaId: uniform.sispaId,
          items: uniform.items,
          itemCount: uniform.items.length
        }
      });
    } else {
      // Create new uniform collection
      uniform = new MemberUniform({
        sispaId: req.user.sispaId,
        items: items
      });
      await uniform.save();

      console.log(`Created new uniform collection with ${items.length} items for ${req.user.sispaId}`);

      return res.status(201).json({
        success: true,
        message: 'Uniform collection created successfully',
        uniform: {
          sispaId: uniform.sispaId,
          items: uniform.items,
          itemCount: uniform.items.length
        }
      });
    }
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: 'Error creating/adding uniform', 
      error: error.message 
    });
  }
};

// PUT /api/members/uniform - Replace all uniform items
export const updateMemberUniform = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user.sispaId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    const { items } = req.body;

    // Validate items array
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide an array of uniform items. Each item must have: category, type, size, and quantity.' 
      });
    }

    // Validate each item if array is not empty
    if (items.length > 0) {
      for (const item of items) {
        if (!item.category || !item.type || !item.size || item.quantity === undefined) {
          return res.status(400).json({ 
            success: false, 
            message: 'Each uniform item must have: category, type, size, and quantity.' 
          });
        }
        if (typeof item.quantity !== 'number' || item.quantity < 1) {
          return res.status(400).json({ 
            success: false, 
            message: 'Quantity must be a number and at least 1.' 
          });
        }
      }
    }

    // Find or create uniform collection
    let uniform = await MemberUniform.findOne({ sispaId: req.user.sispaId });

    if (!uniform) {
      // Create new collection if doesn't exist
      uniform = new MemberUniform({
        sispaId: req.user.sispaId,
        items: items
      });
      await uniform.save();
      
      console.log(`Created new uniform collection with ${items.length} items for ${req.user.sispaId} via PUT`);
      
      return res.status(201).json({
        success: true,
        message: 'Uniform collection created successfully',
        uniform: {
          sispaId: uniform.sispaId,
          items: uniform.items,
          itemCount: uniform.items.length
        }
      });
    }

    // Replace all items (PUT behavior: replace all)
    const previousItemCount = uniform.items.length;
    const previousCategories = [...new Set(uniform.items.map((i: any) => i.category))];
    const newCategories = [...new Set(items.map((i: any) => i.category))];
    
    // Log what's being replaced
    console.log(`PUT request for ${req.user.sispaId}:`);
    console.log(`  Previous: ${previousItemCount} items (categories: ${previousCategories.join(', ')})`);
    console.log(`  New: ${items.length} items (categories: ${newCategories.join(', ')})`);
    
    uniform.items = items;
    await uniform.save();

    console.log(`Replaced uniform collection for ${req.user.sispaId}: ${previousItemCount} items replaced with ${items.length} items`);

    res.json({
      success: true,
      message: 'Uniform updated successfully',
      uniform: {
        sispaId: uniform.sispaId,
        items: uniform.items,
        itemCount: uniform.items.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: 'Error updating uniform', 
      error: error.message 
    });
  }
};

// Add member's own uniform items (supports multiple items at once)
export const addOwnUniform = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user.sispaId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { items } = req.body;

    // Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide an array of uniform items. Each item must have: category, type, size, and quantity.' 
      });
    }

    // Validate each item
    for (const item of items) {
      if (!item.category || !item.type || !item.size || item.quantity === undefined) {
        return res.status(400).json({ 
          success: false, 
          message: 'Each uniform item must have: category, type, size, and quantity.' 
        });
      }
      if (item.quantity < 1) {
        return res.status(400).json({ 
          success: false, 
          message: 'Quantity must be at least 1.' 
        });
      }
    }

    // Check if member already has a uniform collection
    let uniform = await MemberUniform.findOne({ sispaId: req.user.sispaId });
    
    if (uniform) {
      // Add new items to existing collection
      uniform.items.push(...items);
      await uniform.save();
      
      return res.status(200).json({
        success: true,
        message: 'Uniform items added successfully',
        uniform: {
          sispaId: uniform.sispaId,
          items: uniform.items,
          itemCount: uniform.items.length
        }
      });
    } else {
      // Create new uniform collection
      const newUniform = new MemberUniform({
        sispaId: req.user.sispaId,
        items: items
      });
      await newUniform.save();

      return res.status(201).json({
        success: true,
        message: 'Uniform collection created successfully',
        uniform: {
          sispaId: newUniform.sispaId,
          items: newUniform.items,
          itemCount: newUniform.items.length
        }
      });
    }
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: 'Error adding uniform', 
      error: error.message 
    });
  }
};

// Update member's own uniform (replace all items or update specific items)
export const updateOwnUniform = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user.sispaId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { items, replaceAll } = req.body;

    // If items provided, validate them
    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (!item.category || !item.type || !item.size || item.quantity === undefined) {
          return res.status(400).json({ 
            success: false, 
            message: 'Each uniform item must have: category, type, size, and quantity.' 
          });
        }
        if (item.quantity < 1) {
          return res.status(400).json({ 
            success: false, 
            message: 'Quantity must be at least 1.' 
          });
        }
      }
    }

    let uniform = await MemberUniform.findOne({ sispaId: req.user.sispaId });

    if (!uniform) {
      // Create new if doesn't exist
      if (items && Array.isArray(items)) {
        uniform = new MemberUniform({
          sispaId: req.user.sispaId,
          items: items
        });
        await uniform.save();
        
        return res.json({
          success: true,
          message: 'Uniform collection created successfully',
          uniform: {
            sispaId: uniform.sispaId,
            items: uniform.items,
            itemCount: uniform.items.length
          }
        });
      } else {
        return res.status(404).json({ 
          success: false, 
          message: 'Uniform not found. Use POST to create a new uniform collection.' 
        });
      }
    }

    // Update items
    if (replaceAll && items && Array.isArray(items)) {
      // Replace all items
      uniform.items = items;
    } else if (items && Array.isArray(items)) {
      // Replace all items (default behavior)
      uniform.items = items;
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide items array to update.' 
      });
    }

    await uniform.save();

    res.json({
      success: true,
      message: 'Uniform updated successfully',
      uniform: {
        sispaId: uniform.sispaId,
        items: uniform.items,
        itemCount: uniform.items.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: 'Error updating uniform', 
      error: error.message 
    });
  }
};

// Add a single uniform item to member's collection
export const addUniformItem = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user.sispaId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { category, type, size, quantity, color, notes } = req.body;

    if (!category || !type || !size || quantity === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: category, type, size, and quantity are required' 
      });
    }

    if (quantity < 1) {
      return res.status(400).json({ 
        success: false, 
        message: 'Quantity must be at least 1' 
      });
    }

    let uniform = await MemberUniform.findOne({ sispaId: req.user.sispaId });

    if (!uniform) {
      // Create new collection with this item
      uniform = new MemberUniform({
        sispaId: req.user.sispaId,
        items: [{ category, type, size, quantity, color: color || null, notes: notes || null }]
      });
    } else {
      // Add item to existing collection
      uniform.items.push({ category, type, size, quantity, color: color || null, notes: notes || null });
    }

    await uniform.save();

    res.json({
      success: true,
      message: 'Uniform item added successfully',
      uniform: {
        sispaId: uniform.sispaId,
        items: uniform.items,
        itemCount: uniform.items.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: 'Error adding uniform item', 
      error: error.message 
    });
  }
};

// Delete a specific uniform item from member's collection
export const deleteUniformItem = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user.sispaId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { itemIndex } = req.body; // Index of item to delete

    if (itemIndex === undefined || typeof itemIndex !== 'number') {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide itemIndex (number) to delete' 
      });
    }

    const uniform = await MemberUniform.findOne({ sispaId: req.user.sispaId });

    if (!uniform) {
      return res.status(404).json({ 
        success: false, 
        message: 'Uniform collection not found' 
      });
    }

    if (itemIndex < 0 || itemIndex >= uniform.items.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid item index' 
      });
    }

    // Remove item at index
    uniform.items.splice(itemIndex, 1);
    await uniform.save();

    res.json({
      success: true,
      message: 'Uniform item deleted successfully',
      uniform: {
        sispaId: uniform.sispaId,
        items: uniform.items,
        itemCount: uniform.items.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting uniform item', 
      error: error.message 
    });
  }
};
