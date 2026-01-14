import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { MLModel } from '../models/forecastModel';
import { UniformInventory, MemberUniform } from '../models/uniformModel';
import { RecommendedStock } from '../models/recommendedStockModel';
import { predictDemand, getLatestModel, buildFeatureVector } from '../utils/forecastUtils';
import { mlForecastService } from '../services/mlForecastService';

// Get forecast for a specific item
export const getForecast = async (req: AuthRequest, res: Response) => {
  try {
    const { category, type, size, forecastDate, period, batch } = req.query;

    if (!category || !type) {
      return res.status(400).json({
        success: false,
        message: 'Category and type are required'
      });
    }

    // Parse forecast date (default to today)
    const date = forecastDate 
      ? new Date(forecastDate as string)
      : new Date();

    // Validate date
    if (isNaN(date.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid forecastDate format. Use ISO 8601 format (e.g., 2024-01-15)'
      });
    }

    // Parse size (can be null for accessories)
    const itemSize = size === 'null' || size === '' ? null : (size as string);

    try {
      const prediction = await predictDemand(
        category as string,
        type as string,
        itemSize,
        date,
        batch as string | undefined
      );

      res.json({
        success: true,
        forecast: {
          category: category as string,
          type: type as string,
          size: itemSize,
          forecastDate: date.toISOString(),
          predictedDemand: prediction.predictedDemand,
          confidence: prediction.confidence,
          modelInfo: prediction.modelInfo
        }
      });
    } catch (error: any) {
      if (error.message.includes('model not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error getting forecast:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating forecast',
      error: error.message
    });
  }
};

// Get forecasts for all inventory items
export const getAllForecasts = async (req: AuthRequest, res: Response) => {
  try {
    const { category, type, size, forecastDate } = req.query;

    // Parse forecast date (default to today)
    const date = forecastDate 
      ? new Date(forecastDate as string)
      : new Date();

    // Validate date
    if (isNaN(date.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid forecastDate format. Use ISO 8601 format (e.g., 2024-01-15)'
      });
    }

    // Build filter for inventory items
    const filter: any = {};
    if (category) filter.category = category;
    if (type) filter.type = type;
    if (size !== undefined) {
      if (size === 'null' || size === '') {
        filter.size = null;
      } else {
        filter.size = size;
      }
    }

    // Get all inventory items matching filter
    const inventoryItems = await UniformInventory.find(filter);

    if (inventoryItems.length === 0) {
      return res.json({
        success: true,
        forecasts: [],
        message: 'No inventory items found matching the filters'
      });
    }

    // Get latest model info first
    const model = await getLatestModel();
    if (!model) {
      return res.status(404).json({
        success: false,
        message: 'Forecasting model not found. Please upload a model first.'
      });
    }

    // Get latest recommended stock for all items
    const recommendations = await RecommendedStock.aggregate([
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

    // Create map for quick lookup
    const recommendationMap = new Map();
    recommendations.forEach((rec: any) => {
      const key = `${rec.category}|${rec.type}|${rec.size || 'null'}`;
      recommendationMap.set(key, rec);
    });

    // Generate forecasts for each item
    const forecasts = await Promise.all(
      inventoryItems.map(async (item) => {
        try {
          // Get recommended stock from Colab
          const key = `${item.category}|${item.type}|${item.size || 'null'}`;
          const recommendation = recommendationMap.get(key);
          
          // Try to get ML prediction if model exists
          let prediction = null;
          try {
            prediction = await predictDemand(
              item.category,
              item.type,
              item.size,
              date
            );
          } catch (error: any) {
            // Model not available, that's okay - use recommended stock
          }

          const recommendedStock = recommendation?.recommendedStock || item.recommendedStock;
          const currentQuantity = item.quantity;
          const predictedDemand = prediction?.predictedDemand || recommendation?.forecastedDemand || null;
          
          // Calculate reorder recommendation
          let reorderRecommendation = 'Stock sufficient';
          let reorderQuantity = 0;
          
          if (recommendedStock !== null && recommendedStock !== undefined) {
            reorderQuantity = Math.max(0, recommendedStock - currentQuantity);
            if (reorderQuantity > 0) {
              reorderRecommendation = `Consider reordering ${reorderQuantity} units (Recommended stock: ${recommendedStock})`;
            }
          } else if (predictedDemand !== null) {
            reorderQuantity = Math.max(0, predictedDemand - currentQuantity);
            if (reorderQuantity > 0) {
              reorderRecommendation = `Consider reordering ${reorderQuantity} units`;
            }
          }

          return {
            category: item.category,
            type: item.type,
            size: item.size,
            currentQuantity,
            status: item.status,
            forecastDate: date.toISOString(),
            recommendedStock, // From Colab
            predictedDemand, // From ML model (if available)
            confidence: prediction?.confidence,
            reorderQuantity,
            reorderRecommendation,
            hasRecommendation: !!recommendation,
            recommendationDate: recommendation?.analysisDate || item.lastRecommendationDate,
            source: recommendation?.source || 'system'
          };
        } catch (error: any) {
          console.error(`Error forecasting for ${item.category}/${item.type}/${item.size}:`, error);
          return {
            category: item.category,
            type: item.type,
            size: item.size,
            currentQuantity: item.quantity,
            status: item.status,
            error: error.message
          };
        }
      })
    );

    res.json({
      success: true,
      forecasts,
      modelInfo: {
        modelType: model.modelType,
        version: model.version,
        accuracy: model.accuracy
      },
      forecastDate: date.toISOString(),
      count: forecasts.length
    });
  } catch (error: any) {
    console.error('Error getting all forecasts:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating forecasts',
      error: error.message
    });
  }
};

// Get model information
export const getModelInfo = async (req: AuthRequest, res: Response) => {
  try {
    const model = await getLatestModel();

    if (!model) {
      return res.status(404).json({
        success: false,
        message: 'No forecasting model found. Please upload a model first.'
      });
    }

    // Return model info without sensitive details
    res.json({
      success: true,
      model: {
        modelName: model.modelName,
        modelType: model.modelType,
        version: model.version,
        features: model.features,
        accuracy: model.accuracy,
        trainingDate: model.trainingDate,
        description: model.description,
        featureCount: model.features.length,
        hasCoefficients: !!model.coefficients && model.coefficients.length > 0,
        hasScaler: !!model.scalerParameters?.scalerType
      }
    });
  } catch (error: any) {
    console.error('Error getting model info:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching model information',
      error: error.message
    });
  }
};

// Upload/update ML model (Admin only)
export const uploadModel = async (req: AuthRequest, res: Response) => {
  try {
    const {
      modelName,
      modelType,
      version,
      features,
      coefficients,
      intercept,
      modelParameters,
      scalerParameters,
      accuracy,
      description
    } = req.body;

    // Validation
    if (!modelName || !modelType || !version || !features) {
      return res.status(400).json({
        success: false,
        message: 'modelName, modelType, version, and features are required'
      });
    }

    // For linear regression, validate coefficients and intercept
    if (modelType === 'linear_regression') {
      if (!coefficients || !Array.isArray(coefficients)) {
        return res.status(400).json({
          success: false,
          message: 'coefficients array is required for linear regression models'
        });
      }

      if (intercept === undefined || intercept === null) {
        return res.status(400).json({
          success: false,
          message: 'intercept is required for linear regression models'
        });
      }

      if (features.length !== coefficients.length) {
        return res.status(400).json({
          success: false,
          message: 'Features array length must match coefficients array length'
        });
      }
    }

    // Create or update model
    const model = new MLModel({
      modelName: modelName || 'uniform_demand_forecast',
      modelType: modelType || 'linear_regression',
      version: version || '1.0.0',
      features,
      coefficients,
      intercept,
      modelParameters,
      scalerParameters,
      accuracy: accuracy || {},
      trainingDate: new Date(),
      description
    });

    await model.save();

    res.status(201).json({
      success: true,
      message: 'Model uploaded successfully',
      model: {
        id: model._id,
        modelName: model.modelName,
        modelType: model.modelType,
        version: model.version,
        featureCount: model.features.length,
        trainingDate: model.trainingDate
      }
    });
  } catch (error: any) {
    console.error('Error uploading model:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Model with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error uploading model',
      error: error.message
    });
  }
};

// Get feature vector for testing (for debugging/development)
export const getFeatureVector = async (req: AuthRequest, res: Response) => {
  try {
    const { category, type, size, forecastDate, batch } = req.query;

    if (!category || !type) {
      return res.status(400).json({
        success: false,
        message: 'Category and type are required'
      });
    }

    // Parse forecast date (default to today)
    const date = forecastDate 
      ? new Date(forecastDate as string)
      : new Date();

    // Validate date
    if (isNaN(date.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid forecastDate format. Use ISO 8601 format (e.g., 2024-01-15)'
      });
    }

    // Parse size (can be null for accessories)
    const itemSize = size === 'null' || size === '' ? null : (size as string);

    const { features, featureNames } = await buildFeatureVector(
      category as string,
      type as string,
      itemSize,
      date,
      batch as string | undefined
    );

    res.json({
      success: true,
      featureVector: features,
      featureNames,
      item: {
        category,
        type,
        size: itemSize,
        forecastDate: date.toISOString(),
        batch
      }
    });
  } catch (error: any) {
    console.error('Error getting feature vector:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating feature vector',
      error: error.message
    });
  }
};

// Run forecast using pre-trained ML model (Admin only)
export const runForecast = async (req: AuthRequest, res: Response) => {
  try {
    // 1. Get historical data from database
    // Query MemberUniform collection to get historical uniform usage
    const uniforms = await MemberUniform.find({})
      .select('items createdAt')
      .sort({ createdAt: 1 });

    console.log(`📊 Found ${uniforms.length} MemberUniform documents in database`);

    if (!uniforms || uniforms.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No historical data available for forecasting'
      });
    }

    // Count total items for logging
    const totalItems = uniforms.reduce((sum, uniform) => sum + (uniform.items?.length || 0), 0);
    console.log(`📦 Total uniform items found: ${totalItems}`);

    // 2. Aggregate historical data by uniform_type (category), type, and size
    const historicalDataMap = new Map<string, {
      uniform_type: string;
      type: string;
      category: string;
      size: string | null;
      total_issued: number;
      quantities: number[];
      last_issue_date: Date | null;
    }>();

    // Define allowed types for forecasting (only items with sizes)
    const allowedTypes = [
      'BAJU_NO_3_LELAKI',
      'BAJU_NO_3_PEREMPUAN',
      'BAJU_NO_4',
      'BOOT',
      'BERET',
      'PVC Shoes'  // Will be included when historical data is available
    ];

    uniforms.forEach(uniform => {
      uniform.items.forEach(item => {
        // Use category as uniform_type, or fallback to item.category
        const category = item.category || 'Others';
        const type = item.type || 'Unknown';
        const size = item.size || null;
        
        // Filter: Only include allowed types AND items with sizes
        if (!allowedTypes.includes(type) || !size) {
          return; // Skip this item
        }
        
        // Create unique key
        const key = `${category}|${type}|${size}`;
        
        if (!historicalDataMap.has(key)) {
          historicalDataMap.set(key, {
            uniform_type: category,
            type: type,
            category: category,
            size: size,
            total_issued: 0,
            quantities: [],
            last_issue_date: null
          });
        }
        
        const record = historicalDataMap.get(key)!;
        record.total_issued += item.quantity || 1;
        record.quantities.push(item.quantity || 1);
        
        // Track latest issue date
        const issueDate = uniform.createdAt || uniform.updatedAt;
        if (issueDate && (!record.last_issue_date || issueDate > record.last_issue_date)) {
          record.last_issue_date = issueDate;
        }
      });
    });

    // 3. Convert map to array, calculate averages, and sanitize data for ML service
    const historicalData = Array.from(historicalDataMap.values()).map(record => ({
      uniform_type: record.uniform_type,
      type: record.type,
      category: record.category,
      size: record.size,
      total_issued: record.total_issued,
      avg_quantity: record.quantities.length > 0
        ? record.quantities.reduce((sum, q) => sum + q, 0) / record.quantities.length
        : 0,
      // Normalize missing dates to undefined (TypeScript-safe) instead of null
      last_issue_date: record.last_issue_date
        ? record.last_issue_date.toISOString()
        : undefined
    }));

    if (!historicalData.length) {
      return res.status(400).json({
        success: false,
        message: 'No historical data available for forecasting'
      });
    }

    // Log summary of aggregated data for demo/presentation
    console.log(`📊 Aggregated ${historicalData.length} unique uniform combinations (filtered to items with sizes):`);
    historicalData.forEach((record, idx) => {
      console.log(`  ${idx + 1}. ${record.type} / Size: ${record.size} - Total issued: ${record.total_issued}, Avg: ${record.avg_quantity.toFixed(2)}`);
    });
    
    // Filter out PVC Shoes if no historical data (as per user requirement)
    const filteredHistoricalData = historicalData.filter(record => 
      record.type !== 'PVC Shoes'
    );
    
    if (filteredHistoricalData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No historical data available for forecastable items (BAJU_NO_3_LELAKI, BAJU_NO_3_PEREMPUAN, BAJU_NO_4, BOOT)'
      });
    }
    
    console.log(`📊 After filtering: ${filteredHistoricalData.length} items to forecast`);

    // 4. Call Python ML service to run predictions (using filtered data)
    console.log(`📊 Calling ML service with ${filteredHistoricalData.length} historical records...`);
    const forecastResult = await mlForecastService.runForecast(filteredHistoricalData);

    if (!forecastResult.success || !forecastResult.recommendations) {
      console.error('❌ ML Forecast Service Error:', {
        success: forecastResult.success,
        error: forecastResult.error,
        message: forecastResult.message
      });
      return res.status(500).json({
        success: false,
        message: forecastResult.message || 'Failed to generate forecast',
        error: forecastResult.error || 'Model not found or historical data unavailable'
      });
    }

    // 5. Clear old recommendations (delete all existing recommendations)
    await RecommendedStock.deleteMany({});

    // 6. Save new recommendations to database
    const recommendations = forecastResult.recommendations;
    const now = new Date();
    let insertedCount = 0;

    for (const rec of recommendations) {
      try {
        // Get current stock from inventory if available
        const inventoryItem = await UniformInventory.findOne({
          category: rec.category,
          type: rec.type,
          size: rec.size || null
        });

        const currentStock = inventoryItem?.quantity || 0;

        // Extract gender from type (for Uniform No 3)
        let gender: 'male' | 'female' | null = null;
        if (rec.type === 'BAJU_NO_3_LELAKI') {
          gender = 'male';
        } else if (rec.type === 'BAJU_NO_3_PEREMPUAN') {
          gender = 'female';
        }

        // Create recommended stock record
        // Note: category is stored as 'Others' for all items (from historical data)
        // Frontend should display 'type' as the main identifier, not category
        const recommendedStock = new RecommendedStock({
          category: 'Others', // All items from CSV have category='Others'
          type: rec.type,
          size: rec.size || null,
          gender: gender, // male for BAJU_NO_3_LELAKI, female for BAJU_NO_3_PEREMPUAN, null for others
          recommendedStock: rec.recommended_stock,
          currentStock: currentStock,
          forecastedDemand: rec.forecasted_demand,
          analysisDate: now,
          source: 'ml_model'
        });

        await recommendedStock.save();
        insertedCount++;
      } catch (error: any) {
        console.error(`Error saving recommendation for ${rec.category}/${rec.type}/${rec.size}:`, error);
        // Continue with other recommendations even if one fails
      }
    }

    // 7. Return success response with summary for demo
    res.json({
      success: true,
      message: `Forecast generated successfully. ${insertedCount} recommendations created.`,
      generated: insertedCount,
      summary: {
        totalUniformDocuments: uniforms.length,
        totalItemsProcessed: totalItems,
        uniqueCombinations: historicalData.length,
        recommendationsCreated: insertedCount
      }
    });

  } catch (error: any) {
    console.error('Forecast generation error:', error);
    res.status(500).json({
      success: false,
      message: `Failed to generate forecast: ${error.message}`,
      error: error.message
    });
  }
};
