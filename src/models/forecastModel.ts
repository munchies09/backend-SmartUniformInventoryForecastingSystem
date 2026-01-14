import mongoose, { Schema, Document } from 'mongoose';

// ML Model for forecasting uniform demand
export interface IMLModel extends Document {
  modelName: string;
  modelType: string; // e.g., 'linear_regression', 'random_forest', 'xgboost', 'lstm'
  version: string;
  features: string[]; // Feature names in order
  coefficients?: number[]; // For linear models
  intercept?: number; // For linear models
  modelParameters?: any; // For other model types (trees, neural nets, etc.)
  scalerParameters?: { // If features were scaled in Colab
    mean?: number[];
    std?: number[];
    min?: number[];
    max?: number[];
    scalerType?: 'standard' | 'minmax';
  };
  accuracy: {
    mae?: number; // Mean Absolute Error
    rmse?: number; // Root Mean Squared Error
    r2?: number; // R-squared
    mape?: number; // Mean Absolute Percentage Error
    [key: string]: number | undefined; // Allow other metrics
  };
  trainingDate: Date;
  description?: string;
}

const mlModelSchema = new Schema<IMLModel>({
  modelName: {
    type: String,
    required: true,
    default: 'uniform_demand_forecast',
    index: true
  },
  modelType: {
    type: String,
    required: true,
    enum: ['linear_regression', 'random_forest', 'xgboost', 'lstm', 'prophet', 'arima', 'other'],
    default: 'linear_regression'
  },
  version: {
    type: String,
    required: true,
    default: '1.0.0'
  },
  features: {
    type: [String],
    required: true
  },
  coefficients: {
    type: [Number],
    default: undefined
  },
  intercept: {
    type: Number,
    default: undefined
  },
  modelParameters: {
    type: Schema.Types.Mixed,
    default: undefined
  },
  scalerParameters: {
    mean: [Number],
    std: [Number],
    min: [Number],
    max: [Number],
    scalerType: {
      type: String,
      enum: ['standard', 'minmax'],
      default: undefined
    }
  },
  accuracy: {
    mae: Number,
    rmse: Number,
    r2: Number,
    mape: Number
  },
  trainingDate: {
    type: Date,
    default: Date.now
  },
  description: {
    type: String,
    default: undefined
  }
}, { timestamps: true });

// Index for quick lookup of latest model
mlModelSchema.index({ modelName: 1, trainingDate: -1 });

export const MLModel = mongoose.model<IMLModel>('MLModel', mlModelSchema);
