import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { RecommendedStock, IRecommendedStock } from '../models/recommendedStockModel';
import { UniformInventory } from '../models/uniformModel';

// Helper functions for flexible matching (from uniformController)
function normalizeSize(size: string | null | undefined): string | null {
  if (!size || size === '' || size === 'N/A' || size.toLowerCase() === 'n/a') {
    return null;
  }
  return size.trim().replace(/\s+/g, '').toUpperCase();
}

function normalizeTypeForMatching(type: string): string {
  return type
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Import recommended stock from Google Colab (Admin only)
// Accepts FINAL EXPORT FORMAT:
// {
//   "generatedAt": "2026-01-05T10:30:00",
//   "source": "google_colab",
//   "totalItems": 42,
//   "recommendations": [...]
// }
export const importRecommendedStock = async (req: AuthRequest, res: Response) => {
  try {
    const { recommendations, generatedAt, source, totalItems, overwrite = true } = req.body;

    // Validate FINAL EXPORT FORMAT
    if (!recommendations || !Array.isArray(recommendations)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid format. Expected FINAL EXPORT FORMAT with recommendations array.',
        expectedFormat: {
          generatedAt: '2026-01-05T10:30:00',
          source: 'google_colab',
          totalItems: 42,
          recommendations: [
            {
              category: 'Uniform No 3',
              type: 'BAJU NO 3 LELAKI',
              size: 'M',
              forecastedDemand: 38,
              recommendedStock: 44,
              analysisDate: '2026-01-05T10:30:00'
            }
          ]
        }
      });
    }

    if (recommendations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'recommendations array cannot be empty'
      });
    }

    // Validate and match each recommendation
    const errors: string[] = [];
    const warnings: string[] = [];
    const validRecommendations: any[] = [];
    const matchingResults: any[] = [];

    for (let index = 0; index < recommendations.length; index++) {
      const rec = recommendations[index];
      
      // Validation
      if (!rec.category || !rec.type || rec.recommendedStock === undefined) {
        errors.push(`Recommendation ${index + 1}: category, type, and recommendedStock are required`);
        continue;
      }

      if (rec.recommendedStock < 0) {
        errors.push(`Recommendation ${index + 1}: recommendedStock must be non-negative`);
        continue;
      }

      // Normalize size (handle "XL" vs "X L" mismatch)
      let normalizedSize = rec.size || null;
      if (normalizedSize !== null) {
        normalizedSize = normalizeSize(normalizedSize);
      }

      // Try to find matching inventory item
      const normalizedType = normalizeTypeForMatching(rec.type);
      
      // Get all inventory items with matching category (case-insensitive)
      const categoryRegex = new RegExp(`^${String(rec.category).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      const categoryItems = await UniformInventory.find({ category: categoryRegex });
      
      // Find matching type (flexible matching)
      let matchedItem = null;
      let matchType = 'none';

      // First filter by type (flexible matching)
      const typeMatchedItems = categoryItems.filter(item => {
        const itemNormalizedType = normalizeTypeForMatching(item.type);
        
        // Check type match with multiple strategies
        return (
          itemNormalizedType === normalizedType ||
          itemNormalizedType.includes(normalizedType) ||
          normalizedType.includes(itemNormalizedType) ||
          item.type.toLowerCase() === rec.type.toLowerCase() ||
          item.type.toLowerCase().includes(rec.type.toLowerCase()) ||
          rec.type.toLowerCase().includes(item.type.toLowerCase())
        );
      });

      if (typeMatchedItems.length === 0) {
        // No type match found
      } else {
        // Now check size match
        for (const item of typeMatchedItems) {
          const itemNormalizedSize = normalizeSize(item.size);
          
          // Check size match
          if (normalizedSize === null) {
            // Looking for accessory (no size)
            if (itemNormalizedSize === null) {
              matchedItem = item;
              matchType = 'exact';
              break;
            }
          } else {
            // Looking for item with size
            // Strategy 1: Exact normalized match
            if (itemNormalizedSize === normalizedSize) {
              matchedItem = item;
              matchType = 'exact';
              break;
            }
            
            // Strategy 2: Remove spaces (handle "XL" vs "X L")
            if (item.size && rec.size) {
              const itemNoSpaces = item.size.replace(/\s+/g, '').toUpperCase();
              const recNoSpaces = rec.size.replace(/\s+/g, '').toUpperCase();
              if (itemNoSpaces === recNoSpaces) {
                matchedItem = item;
                matchType = 'normalized';
                warnings.push(`Recommendation ${index + 1}: Size normalized "${rec.size}" → "${item.size}"`);
                break;
              }
            }
            
            // Strategy 3: Case-insensitive trimmed match
            if (item.size && rec.size) {
              if (item.size.trim().toUpperCase() === rec.size.trim().toUpperCase()) {
                matchedItem = item;
                matchType = 'case-insensitive';
                break;
              }
            }
          }
        }
      }

      // Record matching result
      const matchResult = {
        index: index + 1,
        input: {
          category: rec.category,
          type: rec.type,
          size: rec.size
        },
        matched: !!matchedItem,
        matchType,
        inventoryItem: matchedItem ? {
          category: matchedItem.category,
          type: matchedItem.type,
          size: matchedItem.size,
          currentQuantity: matchedItem.quantity
        } : null,
        availableTypes: [...new Set(categoryItems.map(i => i.type))],
        availableSizes: matchedItem ? undefined : [
          ...new Set(categoryItems.filter(i => {
            const itemType = normalizeTypeForMatching(i.type);
            return itemType === normalizedType || itemType.includes(normalizedType) || normalizedType.includes(itemType);
          }).map(i => i.size).filter(s => s !== null))
        ]
      };

      matchingResults.push(matchResult);

      if (!matchedItem) {
        const availableTypesStr = matchResult.availableTypes.join(', ');
        const availableSizesStr = matchResult.availableSizes?.join(', ') || 'N/A';
        warnings.push(
          `Recommendation ${index + 1}: No exact match found for "${rec.category}" / "${rec.type}" / "${rec.size}". ` +
          `Available types: ${availableTypesStr}. ` +
          `Available sizes for similar types: ${availableSizesStr}. ` +
          `⚠️ Possible mismatch - check spelling/casing.`
        );
        // Still allow import but warn
      }

      // Prepare recommendation data (BACKEND STORES, NOT CALCULATES)
      // Use analysisDate from Colab if provided, otherwise use generatedAt, otherwise now
      const analysisDate = rec.analysisDate 
        ? new Date(rec.analysisDate) 
        : generatedAt 
        ? new Date(generatedAt) 
        : new Date();

      const recommendationData = {
        category: matchedItem?.category || rec.category,
        type: matchedItem?.type || rec.type,
        size: matchedItem?.size !== undefined ? matchedItem.size : (rec.size || null),
        recommendedStock: Number(rec.recommendedStock),
        currentStock: matchedItem?.quantity || 0, // Use actual inventory if matched
        forecastedDemand: rec.forecastedDemand !== undefined ? Number(rec.forecastedDemand) : undefined,
        reorderQuantity: undefined, // Backend doesn't calculate
        analysisDate: analysisDate,
        notes: undefined,
        source: source || 'google_colab'
      };

      validRecommendations.push({
        data: recommendationData,
        matchedItem: matchedItem ? {
          id: matchedItem._id,
          category: matchedItem.category,
          type: matchedItem.type,
          size: matchedItem.size
        } : null
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors,
        warnings,
        matchingResults
      });
    }

    // CRITICAL FIX: Delete old records BEFORE inserting new ones when overwrite=true
    let deletedCount = 0;
    if (overwrite) {
      try {
        // Delete ALL old google_colab recommendations to ensure clean state
        const deleteResult = await RecommendedStock.deleteMany({
          source: 'google_colab'
        });
        deletedCount = deleteResult.deletedCount;
        console.log(`🗑️  Deleted ${deletedCount} old recommendations before import`);
      } catch (deleteError: any) {
        console.error('Error deleting old recommendations:', deleteError);
        // Continue anyway - we'll still import new data
      }
    }

    // Save recommendations
    const savedRecommendations: IRecommendedStock[] = [];
    const updatedInventoryItems: any[] = [];
    const failedItems: any[] = [];

    for (const { data: rec, matchedItem } of validRecommendations) {
      try {
        // Save recommendation (old records already deleted if overwrite=true)
        // Always create new record since we deleted old ones
        const recommendation = new RecommendedStock(rec);
        await recommendation.save();

        savedRecommendations.push(recommendation);

        // Update inventory item with recommended stock
        let inventoryItem;
        if (matchedItem) {
          inventoryItem = await UniformInventory.findById(matchedItem.id);
        } else {
          inventoryItem = await UniformInventory.findOne({
            category: rec.category,
            type: rec.type,
            size: rec.size
          });
        }

        if (inventoryItem) {
          inventoryItem.recommendedStock = rec.recommendedStock;
          inventoryItem.lastRecommendationDate = rec.analysisDate;
          await inventoryItem.save();
          updatedInventoryItems.push({
            id: inventoryItem._id,
            category: inventoryItem.category,
            type: inventoryItem.type,
            size: inventoryItem.size,
            recommendedStock: inventoryItem.recommendedStock
          });
        } else {
          failedItems.push({
            category: rec.category,
            type: rec.type,
            size: rec.size,
            reason: 'No matching inventory item found'
          });
        }
      } catch (error: any) {
        console.error(`Error saving recommendation for ${rec.category}/${rec.type}/${rec.size}:`, error);
        failedItems.push({
          category: rec.category,
          type: rec.type,
          size: rec.size,
          reason: error.message
        });
        // Continue with other recommendations
      }
    }

    res.status(201).json({
      success: true,
      message: `Successfully imported ${savedRecommendations.length} recommendations${deletedCount > 0 ? ` (deleted ${deletedCount} old records)` : ''}`,
      imported: savedRecommendations.length,
      deletedOldRecords: deletedCount,
      updatedInventoryItems: updatedInventoryItems.length,
      totalItems: totalItems || savedRecommendations.length,
      generatedAt: generatedAt || new Date().toISOString(),
      source: source || 'google_colab',
      warnings: warnings.length > 0 ? warnings : undefined,
      failedItems: failedItems.length > 0 ? failedItems : undefined,
      matchingResults: matchingResults.length > 0 ? matchingResults : undefined
    });
  } catch (error: any) {
    console.error('Error importing recommended stock:', error);
    res.status(500).json({
      success: false,
      message: 'Error importing recommended stock',
      error: error.message
    });
  }
};

// Get all recommended stock (for dashboard)
// Returns sorted data ready for frontend graph
// GET /api/recommended-stock?category=Uniform%20No%203&type=BAJU%20NO%203%20LELAKI
export const getAllRecommendedStock = async (req: AuthRequest, res: Response) => {
  try {
    const { category, type, size, latest = 'true' } = req.query;

    const filter: any = {};
    if (category) filter.category = category;
    if (type) filter.type = type;
    if (size !== undefined) {
      filter.size = size === 'null' || size === '' ? null : size;
    }

    let recommendations;

    if (latest === 'true') {
      // Get only the latest recommendation for each item (BACKEND STORES, NOT CALCULATES)
      const pipeline: any[] = [
        { $match: filter },
        { $sort: { analysisDate: -1 } },
        {
          $group: {
            _id: {
              category: '$category',
              type: '$type',
              size: '$size'
            },
            recommendation: { $first: '$$ROOT' }
          }
        },
        { $replaceRoot: { newRoot: '$recommendation' } },
        { $sort: { category: 1, type: 1, size: 1 } }
      ];

      recommendations = await RecommendedStock.aggregate(pipeline);
    } else {
      recommendations = await RecommendedStock.find(filter)
        .sort({ analysisDate: -1, category: 1, type: 1, size: 1 })
        .exec();
    }

    // Backend returns raw data - frontend handles sorting/grouping
    // Size sorting: XXS → 5XL, numeric for boots
    // Grouping by type done in frontend
    // Note: category and analysisDate fields are not shown in frontend
    // (category='Others' for all items, analysisDate is for internal tracking only)
    res.json({
      success: true,
      recommendations: recommendations.map(r => ({
        id: r._id,
        category: r.category, // Hidden in frontend - all are 'Others'
        type: r.type, // Display this as the main identifier
        size: r.size,
        gender: r.gender, // 'male' for BAJU_NO_3_LELAKI, 'female' for BAJU_NO_3_PEREMPUAN, null for others
        forecastedDemand: r.forecastedDemand,
        recommendedStock: r.recommendedStock,
        source: r.source
        // analysisDate removed - not needed for frontend display
      })),
      count: recommendations.length,
      message: 'Frontend: Hide category column (all are Others), display type instead. Sort sizes (XXS → 5XL), numeric sort for boots, group by type'
    });
  } catch (error: any) {
    console.error('Error getting recommended stock:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recommended stock',
      error: error.message
    });
  }
};

// Get recommended stock for specific item
export const getRecommendedStock = async (req: AuthRequest, res: Response) => {
  try {
    const { category, type, size } = req.query;

    if (!category || !type) {
      return res.status(400).json({
        success: false,
        message: 'category and type are required'
      });
    }

    const itemSize = size === 'null' || size === '' ? null : (size as string);

    // Get latest recommendation for this item
    const recommendation = await RecommendedStock.findOne({
      category,
      type,
      size: itemSize
    })
      .sort({ analysisDate: -1 })
      .exec();

    if (!recommendation) {
      return res.status(404).json({
        success: false,
        message: 'No recommendation found for this item'
      });
    }

    // Get current inventory
    const inventory = await UniformInventory.findOne({
      category,
      type,
      size: itemSize
    });

    res.json({
      success: true,
      recommendation: {
        category: recommendation.category,
        type: recommendation.type,
        size: recommendation.size,
        gender: recommendation.gender || null, // Include gender field
        recommendedStock: recommendation.recommendedStock,
        currentStock: inventory?.quantity || 0,
        forecastedDemand: recommendation.forecastedDemand,
        reorderQuantity: recommendation.reorderQuantity || Math.max(0, recommendation.recommendedStock - (inventory?.quantity || 0)),
        analysisDate: recommendation.analysisDate,
        notes: recommendation.notes,
        source: recommendation.source
      },
      inventory: inventory ? {
        currentQuantity: inventory.quantity,
        status: inventory.status,
        recommendedStock: inventory.recommendedStock,
        lastRecommendationDate: inventory.lastRecommendationDate
      } : null
    });
  } catch (error: any) {
    console.error('Error getting recommended stock:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recommended stock',
      error: error.message
    });
  }
};

// Get inventory items with recommended stock comparison
export const getInventoryWithRecommendations = async (req: AuthRequest, res: Response) => {
  try {
    const { category, type, size } = req.query;

    const filter: any = {};
    if (category) filter.category = category;
    if (type) filter.type = type;
    if (size !== undefined) {
      filter.size = size === 'null' || size === '' ? null : size;
    }

    // Get all inventory items
    const inventoryItems = await UniformInventory.find(filter)
      .sort({ category: 1, type: 1, size: 1 })
      .exec();

    // Get latest recommendations for all items
    const recommendations = await RecommendedStock.aggregate([
      { $match: {} },
      { $sort: { analysisDate: -1 } },
      {
        $group: {
          _id: {
            category: '$category',
            type: '$type',
            size: '$size'
          },
          recommendation: { $first: '$$ROOT' }
        }
      },
      { $replaceRoot: { newRoot: '$recommendation' } }
    ]);

    // Create a map of recommendations for quick lookup
    const recommendationMap = new Map();
    recommendations.forEach((rec: any) => {
      const key = `${rec.category}|${rec.type}|${rec.size || 'null'}`;
      recommendationMap.set(key, rec);
    });

    // Combine inventory with recommendations
    const result = inventoryItems.map(item => {
      const key = `${item.category}|${item.type}|${item.size || 'null'}`;
      const recommendation = recommendationMap.get(key);

      const currentStock = item.quantity;
      const recommendedStock = recommendation?.recommendedStock || item.recommendedStock || null;
      const reorderQuantity = recommendedStock 
        ? Math.max(0, recommendedStock - currentStock)
        : null;

      let status = item.status;
      if (recommendedStock !== null) {
        if (currentStock < recommendedStock * 0.3) {
          status = 'Out of Stock';
        } else if (currentStock < recommendedStock * 0.7) {
          status = 'Low Stock';
        } else {
          status = 'In Stock';
        }
      }

      return {
        id: item._id,
        name: item.name,
        category: item.category,
        type: item.type,
        size: item.size,
        currentStock,
        status,
        recommendedStock,
        reorderQuantity,
        hasRecommendation: !!recommendation,
        recommendationDate: recommendation?.analysisDate || item.lastRecommendationDate,
        forecastedDemand: recommendation?.forecastedDemand,
        notes: recommendation?.notes
      };
    });

    res.json({
      success: true,
      items: result,
      count: result.length,
      withRecommendations: result.filter(item => item.hasRecommendation).length
    });
  } catch (error: any) {
    console.error('Error getting inventory with recommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching inventory with recommendations',
      error: error.message
    });
  }
};

// Get graph data - returns sorted by size for visualization
// Frontend handles: Sort sizes (XXS → 5XL), numeric sort for boots, group by type
export const getGraphData = async (req: AuthRequest, res: Response) => {
  try {
    const { category, type } = req.query;

    if (!category || !type) {
      return res.status(400).json({
        success: false,
        message: 'category and type are required for graph data'
      });
    }

    // Get latest recommendations for this category and type
    const pipeline: any[] = [
      { 
        $match: { 
          category, 
          type 
        } 
      },
      { $sort: { analysisDate: -1 } },
      {
        $group: {
          _id: '$size',
          recommendation: { $first: '$$ROOT' }
        }
      },
      { $replaceRoot: { newRoot: '$recommendation' } }
    ];

    const recommendations = await RecommendedStock.aggregate(pipeline);

    if (recommendations.length === 0) {
      return res.json({
        success: true,
        category,
        type,
        data: [],
        message: 'No recommendations found. Import recommendations from Colab first.'
      });
    }

    // Convert to format for frontend
    // Frontend handles sorting: XXS → 5XL, numeric for boots
    const data = recommendations.map(rec => ({
      size: rec.size || null, // null for accessories
      recommendedStock: rec.recommendedStock, // Y-axis
      forecastedDemand: rec.forecastedDemand,
      analysisDate: rec.analysisDate
    }));

    res.json({
      success: true,
      category,
      type,
      data, // Frontend sorts: XXS → 5XL, numeric for boots
      count: data.length,
      message: 'Frontend: Sort sizes (XXS → 5XL), numeric sort for boots. X-axis: size, Y-axis: recommendedStock'
    });
  } catch (error: any) {
    console.error('Error getting graph data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching graph data',
      error: error.message
    });
  }
};

// Delete old recommendations (Admin only, for cleanup)
export const deleteOldRecommendations = async (req: AuthRequest, res: Response) => {
  try {
    const { days = 90 } = req.query; // Default: delete recommendations older than 90 days

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - Number(days));

    const result = await RecommendedStock.deleteMany({
      analysisDate: { $lt: cutoffDate }
    });

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} old recommendations`,
      deletedCount: result.deletedCount
    });
  } catch (error: any) {
    console.error('Error deleting old recommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting old recommendations',
      error: error.message
    });
  }
};
