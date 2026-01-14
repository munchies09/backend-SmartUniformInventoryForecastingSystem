import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import MemberModel from '../models/memberModel';
import { UniformInventory, MemberUniform } from '../models/uniformModel';

// Get reports data (Admin only)
export const getReports = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Get date range filters from query params (optional)
    const { startDate, endDate } = req.query;
    const dateFilter: any = {};
    
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate as string);
      }
      if (endDate) {
        dateFilter.createdAt.$lte = new Date(endDate as string);
      }
    }

    // 1. Total Members (excluding admin)
    const totalMembers = await MemberModel.countDocuments({ 
      sispaId: { $ne: 'admin' },
      ...dateFilter
    });

    // 2. Total Uniforms (inventory items)
    const totalUniforms = await UniformInventory.countDocuments();

    // 3. Inventory Status Counts (status values: 'In Stock', 'Low Stock', 'Out of Stock')
    const inStockCount = await UniformInventory.countDocuments({ status: 'In Stock' });
    const lowStockCount = await UniformInventory.countDocuments({ status: 'Low Stock' });
    const outOfStockCount = await UniformInventory.countDocuments({ status: 'Out of Stock' });

    // 4. Members by Batch
    const membersByBatch = await MemberModel.aggregate([
      { $match: { sispaId: { $ne: 'admin' } } },
      {
        $group: {
          _id: '$batch',
          count: { $sum: 1 },
          members: {
            $push: {
              sispaId: '$sispaId',
              name: '$name',
              email: '$email'
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Format members by batch
    const membersByBatchFormatted = membersByBatch.map((batch: any) => ({
      batch: batch._id || 'Unassigned',
      count: batch.count,
      members: batch.members
    }));

    // 5. Uniforms by Type (from inventory)
    const uniformsByType = await UniformInventory.aggregate([
      {
        $group: {
          _id: { category: '$category', type: '$type' },
          totalQuantity: { $sum: '$quantity' },
          items: {
            $push: {
              id: '$_id',
              size: '$size',
              quantity: '$quantity',
              status: '$status'
            }
          }
        }
      },
      {
        $group: {
          _id: '$_id.category',
          types: {
            $push: {
              type: '$_id.type',
              totalQuantity: '$totalQuantity',
              items: '$items'
            }
          },
          categoryTotal: { $sum: '$totalQuantity' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Format uniforms by type
    const uniformsByTypeFormatted = uniformsByType.map((category: any) => ({
      category: category._id,
      categoryTotal: category.categoryTotal,
      types: category.types
    }));

    // 6. Inventory Status Report
    const inventoryStatus = await UniformInventory.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          items: {
            $push: {
              id: '$_id',
              category: '$category',
              type: '$type',
              size: '$size',
              quantity: '$quantity'
            }
          }
        }
      }
    ]);

    // Format inventory status (status values: 'In Stock', 'Low Stock', 'Out of Stock')
    const inventoryStatusFormatted = {
      inStock: {
        count: inventoryStatus.find((s: any) => s._id === 'In Stock')?.count || 0,
        totalQuantity: inventoryStatus.find((s: any) => s._id === 'In Stock')?.totalQuantity || 0,
        items: inventoryStatus.find((s: any) => s._id === 'In Stock')?.items || []
      },
      lowStock: {
        count: inventoryStatus.find((s: any) => s._id === 'Low Stock')?.count || 0,
        totalQuantity: inventoryStatus.find((s: any) => s._id === 'Low Stock')?.totalQuantity || 0,
        items: inventoryStatus.find((s: any) => s._id === 'Low Stock')?.items || []
      },
      outOfStock: {
        count: inventoryStatus.find((s: any) => s._id === 'Out of Stock')?.count || 0,
        totalQuantity: inventoryStatus.find((s: any) => s._id === 'Out of Stock')?.totalQuantity || 0,
        items: inventoryStatus.find((s: any) => s._id === 'Out of Stock')?.items || []
      }
    };

    // 7. Total Member Uniforms (personal uniforms)
    const totalMemberUniforms = await MemberUniform.countDocuments();

    res.json({
      success: true,
      reports: {
        summary: {
          totalMembers,
          totalUniforms,
          totalMemberUniforms,
          inStock: inStockCount,
          lowStock: lowStockCount,
          outOfStock: outOfStockCount
        },
        membersByBatch: membersByBatchFormatted,
        uniformsByType: uniformsByTypeFormatted,
        inventoryStatus: inventoryStatusFormatted,
        dateRange: {
          startDate: startDate || null,
          endDate: endDate || null
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching reports', 
      error: error.message 
    });
  }
};

