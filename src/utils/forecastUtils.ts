import { MLModel, IMLModel } from '../models/forecastModel';
import { MemberUniform } from '../models/uniformModel';
import Member from '../models/memberModel';

// Feature encoding functions
export function encodeCategory(category: string): number {
  const categoryMap: { [key: string]: number } = {
    'Uniform No 3': 0,
    'Uniform No 4': 1,
    'T-Shirt': 2,
    'T Shirt': 2, // Alternative format
    'TShirt': 2 // Alternative format
  };
  return categoryMap[category] ?? -1;
}

export function encodeType(type: string): number {
  // Common uniform types - extend as needed
  // NOTE: Updated to use gender-specific types for Uniform No 3
  // NOTE: Uniform No 4 merged - "Cloth No 4" and "Pants No 4" → "Uniform No 4"
  const typeList = [
    'Uniform No 3 Male',    // Replaces "Cloth No 3"
    'Uniform No 3 Female',  // Replaces "Pants No 3"
    'Uniform No 4',         // Replaces "Cloth No 4" and "Pants No 4" (they come as a pair)
    'Cloth No 3',           // Backward compatibility
    'Pants No 3',           // Backward compatibility
    'Cloth No 4',           // Backward compatibility
    'Pants No 4',           // Backward compatibility
    'Pant No 4',            // Backward compatibility (alternative spelling)
    'Trousers No 3',
    'Trousers No 4',
    'Hat',
    'Beret',
    'Shoes',
    'Belt',
    'Socks',
    'Shirt',
    'Jacket'
  ];
  const index = typeList.findIndex(t => t.toLowerCase() === type.toLowerCase());
  return index >= 0 ? index : typeList.length; // Return index or use a default encoding
}

export function encodeSize(size: string | null): number {
  if (!size) return -1; // Accessories have no size
  
  // Standard sizes
  const sizeMap: { [key: string]: number } = {
    'XS': 0, 'S': 1, 'M': 2, 'L': 3, 'XL': 4, '2XL': 5, '3XL': 6,
    '4XL': 7, '5XL': 8
  };
  
  // Shoe sizes (add offset)
  if (size.match(/^\d+$/)) {
    const numSize = parseInt(size);
    if (numSize >= 4 && numSize <= 15) {
      return 10 + (numSize - 4); // 4→10, 5→11, ..., 15→21
    }
  }
  
  // Beret sizes (fractional)
  if (size.includes('/')) {
    const beretMap: { [key: string]: number } = {
      '6 1/2': 30, '6 3/8': 31, '6 5/8': 32, '6 7/8': 33,
      '7': 34, '7 1/8': 35, '7 1/4': 36, '7 3/8': 37
    };
    return beretMap[size] ?? -1;
  }
  
  // Try standard size mapping
  return sizeMap[size.toUpperCase()] ?? -1;
}

export function encodeBatch(batch: string): number {
  // Extract year from batch string (e.g., "Batch 2024" → 2024)
  const match = batch.match(/(\d{4})/);
  return match ? parseInt(match[1]) : new Date().getFullYear();
}

// Time feature extraction
export function extractTimeFeatures(date: Date = new Date()) {
  return {
    month: date.getMonth() + 1, // 1-12
    dayOfWeek: date.getDay(), // 0-6 (Sunday=0)
    dayOfMonth: date.getDate(), // 1-31
    weekOfYear: getWeekOfYear(date),
    quarter: Math.floor((date.getMonth() + 3) / 3), // 1-4
    year: date.getFullYear(),
    isWeekend: date.getDay() === 0 || date.getDay() === 6 ? 1 : 0,
    dayOfYear: getDayOfYear(date)
  };
}

function getWeekOfYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// Get historical demand data for feature engineering
export async function getHistoricalDemand(
  category: string,
  type: string,
  size: string | null,
  days: number = 30
): Promise<{
  movingAverage7d: number;
  movingAverage30d: number;
  demand_lag1: number;
  demand_lag7: number;
  demand_lag30: number;
  totalDemand: number;
  demandHistory: Array<{ date: Date; count: number }>;
}> {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  // Get all uniform submissions in the time range
  const uniforms = await MemberUniform.find({
    createdAt: { $gte: startDate, $lte: endDate }
  }).sort({ createdAt: 1 });

  // Extract demand for this specific item
  const demandHistory: Array<{ date: Date; count: number }> = [];
  const dailyDemand: { [key: string]: number } = {};

  uniforms.forEach(uniform => {
    uniform.items.forEach(item => {
      if (
        item.category === category &&
        item.type === type &&
        (size === null ? item.size === null || item.size === '' : item.size === size)
      ) {
        const dateKey = uniform.createdAt.toISOString().split('T')[0];
        dailyDemand[dateKey] = (dailyDemand[dateKey] || 0) + item.quantity;
      }
    });
  });

  // Convert to array sorted by date
  Object.entries(dailyDemand)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([dateStr, count]) => {
      demandHistory.push({ date: new Date(dateStr), count });
    });

  // Calculate aggregates
  const totalDemand = demandHistory.reduce((sum, d) => sum + d.count, 0);
  const last7Days = demandHistory.slice(-7);
  const movingAverage7d = last7Days.length > 0
    ? last7Days.reduce((sum, d) => sum + d.count, 0) / last7Days.length
    : 0;

  const movingAverage30d = demandHistory.length > 0
    ? totalDemand / demandHistory.length
    : 0;

  // Lag features (demand N days ago)
  const demand_lag1 = demandHistory.length >= 1 ? demandHistory[demandHistory.length - 1].count : 0;
  const demand_lag7 = demandHistory.length >= 7 ? demandHistory[demandHistory.length - 7].count : 0;
  const demand_lag30 = demandHistory.length >= 30 ? demandHistory[demandHistory.length - 30].count : 0;

  return {
    movingAverage7d,
    movingAverage30d,
    demand_lag1,
    demand_lag7,
    demand_lag30,
    totalDemand,
    demandHistory
  };
}

// Feature engineering: build feature vector from item info
export async function buildFeatureVector(
  category: string,
  type: string,
  size: string | null,
  forecastDate: Date = new Date(),
  batch?: string
): Promise<{ features: { [key: string]: number }, featureNames: string[] }> {
  // Get historical demand
  const history = await getHistoricalDemand(category, type, size, 60);
  
  // Get time features
  const timeFeatures = extractTimeFeatures(forecastDate);
  
  // Encode categorical features
  const category_encoded = encodeCategory(category);
  const type_encoded = encodeType(type);
  const size_encoded = encodeSize(size);
  const batch_encoded = batch ? encodeBatch(batch) : new Date().getFullYear();
  
  // Build feature vector as a dictionary
  const features: { [key: string]: number } = {
    // Time features
    month: timeFeatures.month,
    dayOfWeek: timeFeatures.dayOfWeek,
    dayOfMonth: timeFeatures.dayOfMonth,
    weekOfYear: timeFeatures.weekOfYear,
    quarter: timeFeatures.quarter,
    year: timeFeatures.year,
    dayOfYear: timeFeatures.dayOfYear,
    isWeekend: timeFeatures.isWeekend,
    
    // Categorical encodings
    category_encoded,
    type_encoded,
    size_encoded,
    batch_encoded,
    
    // Historical aggregates
    movingAverage7d: history.movingAverage7d,
    movingAverage30d: history.movingAverage30d,
    demand_lag1: history.demand_lag1,
    demand_lag7: history.demand_lag7,
    demand_lag30: history.demand_lag30,
    totalDemand: history.totalDemand,
    
    // Derived features
    isAccessory: size === null || size === '' ? 1 : 0
  };
  
  // Return both the feature dictionary and a list of feature names
  // The feature names list will be used to match with model features
  const featureNames = Object.keys(features);
  
  return { features, featureNames };
}

// Apply scaling if model uses scaled features
function applyScaling(
  featureValue: number,
  featureName: string,
  featureIndex: number,
  modelFeatures: string[],
  scalerParams?: IMLModel['scalerParameters']
): number {
  if (!scalerParams || !scalerParams.scalerType) {
    return featureValue; // No scaling
  }
  
  // Find the index of this feature in the model's feature list
  const modelFeatureIndex = modelFeatures.indexOf(featureName);
  if (modelFeatureIndex < 0 || !scalerParams.mean) {
    return featureValue; // Feature not in scaler or not found in model features
  }
  
  // Use the model feature index to access scaler parameters
  const idx = modelFeatureIndex;
  
  if (scalerParams.scalerType === 'standard' && scalerParams.mean && scalerParams.std) {
    // StandardScaler: (x - mean) / std
    if (idx < scalerParams.mean.length && idx < scalerParams.std.length) {
      const mean = scalerParams.mean[idx];
      const std = scalerParams.std[idx];
      return std !== 0 ? (featureValue - mean) / std : 0;
    }
  } else if (scalerParams.scalerType === 'minmax' && scalerParams.min && scalerParams.max) {
    // MinMaxScaler: (x - min) / (max - min)
    if (idx < scalerParams.min.length && idx < scalerParams.max.length) {
      const min = scalerParams.min[idx];
      const max = scalerParams.max[idx];
      return max !== min ? (featureValue - min) / (max - min) : 0;
    }
  }
  
  return featureValue;
}

// Predict using Linear Regression model
export function predictLinearRegression(
  features: { [key: string]: number },
  featureNames: string[],
  model: IMLModel
): number {
  if (!model.coefficients || model.coefficients.length === 0) {
    throw new Error('Model coefficients not found');
  }
  
  if (!model.features || model.features.length === 0) {
    throw new Error('Model features not defined');
  }
  
  if (model.features.length !== model.coefficients.length) {
    throw new Error('Features array length must match coefficients array length');
  }
  
  // Build feature vector in the order expected by the model
  const modelFeatureVector: number[] = [];
  
  for (let i = 0; i < model.features.length; i++) {
    const featureName = model.features[i];
    let featureValue = features[featureName] ?? 0;
    
    // Apply scaling if needed (pass feature index for array access)
    featureValue = applyScaling(
      featureValue, 
      featureName, 
      i, 
      model.features, 
      model.scalerParameters
    );
    
    modelFeatureVector.push(featureValue);
  }
  
  // Linear Regression prediction: intercept + sum(coefficient * feature)
  let prediction = model.intercept || 0;
  
  for (let i = 0; i < model.coefficients.length; i++) {
    prediction += model.coefficients[i] * modelFeatureVector[i];
  }
  
  // Ensure non-negative prediction
  return Math.max(0, Math.round(prediction));
}

// Get the latest model from database
export async function getLatestModel(modelName: string = 'uniform_demand_forecast'): Promise<IMLModel | null> {
  return await MLModel.findOne({ modelName })
    .sort({ trainingDate: -1 })
    .exec();
}

// Predict demand using the stored model
export async function predictDemand(
  category: string,
  type: string,
  size: string | null,
  forecastDate: Date = new Date(),
  batch?: string
): Promise<{
  predictedDemand: number;
  confidence?: number;
  modelInfo: {
    modelType: string;
    version: string;
    accuracy?: IMLModel['accuracy'];
  };
}> {
  // Get latest model
  const model = await getLatestModel();
  
  if (!model) {
    throw new Error('Forecasting model not found. Please upload a model first.');
  }
  
  // Build features
  const { features, featureNames } = await buildFeatureVector(category, type, size, forecastDate, batch);
  
  // Make prediction based on model type
  let predictedDemand: number;
  
  if (model.modelType === 'linear_regression') {
    predictedDemand = predictLinearRegression(features, featureNames, model);
  } else {
    // For other model types, you would implement different prediction logic
    // For now, throw an error indicating unsupported model type
    throw new Error(`Model type "${model.modelType}" is not yet supported. Currently only "linear_regression" is supported.`);
  }
  
  // Calculate confidence based on model accuracy (simplified)
  const confidence = model.accuracy.r2 
    ? Math.min(100, Math.max(0, Math.round(model.accuracy.r2 * 100)))
    : undefined;
  
  return {
    predictedDemand,
    confidence,
    modelInfo: {
      modelType: model.modelType,
      version: model.version,
      accuracy: model.accuracy
    }
  };
}
