/**
 * Forecast Service - Frontend API client
 * 
 * This file can be copied to your frontend project and used as-is
 * or adapted to your specific framework (React, Vue, Angular, etc.)
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

interface ForecastParams {
  category: string;
  type: string;
  size?: string | null;
  forecastDate?: string | null;
  batch?: string;
}

interface ForecastFilters {
  category?: string;
  type?: string;
  size?: string | null;
  forecastDate?: string | null;
}

interface Forecast {
  category: string;
  type: string;
  size: string | null;
  forecastDate: string;
  predictedDemand: number;
  confidence?: number;
  modelInfo: {
    modelType: string;
    version: string;
    accuracy?: {
      mae?: number;
      rmse?: number;
      r2?: number;
      [key: string]: number | undefined;
    };
  };
}

interface AllForecastItem extends Forecast {
  currentQuantity: number;
  status: string;
  reorderRecommendation: string;
}

interface ForecastResponse {
  success: boolean;
  forecast?: Forecast;
  message?: string;
  error?: string;
}

interface AllForecastsResponse {
  success: boolean;
  forecasts?: AllForecastItem[];
  modelInfo?: Forecast['modelInfo'];
  forecastDate?: string;
  count?: number;
  message?: string;
  error?: string;
}

interface ModelInfo {
  success: boolean;
  model?: {
    modelName: string;
    modelType: string;
    version: string;
    features: string[];
    accuracy?: {
      mae?: number;
      rmse?: number;
      r2?: number;
      [key: string]: number | undefined;
    };
    trainingDate: string;
    description?: string;
    featureCount: number;
    hasCoefficients: boolean;
    hasScaler: boolean;
  };
  message?: string;
  error?: string;
}

interface ModelUploadData {
  modelName: string;
  modelType: string;
  version: string;
  features: string[];
  coefficients?: number[];
  intercept?: number;
  modelParameters?: any;
  scalerParameters?: {
    mean?: number[];
    std?: number[];
    min?: number[];
    max?: number[];
    scalerType?: 'standard' | 'minmax';
  };
  accuracy?: {
    mae?: number;
    rmse?: number;
    r2?: number;
    [key: string]: number | undefined;
  };
  description?: string;
}

interface ModelUploadResponse {
  success: boolean;
  message?: string;
  model?: {
    id: string;
    modelName: string;
    modelType: string;
    version: string;
    featureCount: number;
    trainingDate: string;
  };
  error?: string;
}

class ForecastService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Get forecast for a specific item
   */
  async getForecast(params: ForecastParams): Promise<ForecastResponse> {
    const queryParams = new URLSearchParams({
      category: params.category,
      type: params.type,
      ...(params.size && { size: params.size }),
      ...(params.forecastDate && { forecastDate: params.forecastDate }),
      ...(params.batch && { batch: params.batch })
    });

    const response = await fetch(
      `${API_BASE_URL}/api/forecast?${queryParams}`,
      {
        method: 'GET',
        headers: this.getAuthHeaders()
      }
    );

    return this.handleResponse<ForecastResponse>(response);
  }

  /**
   * Get forecasts for all inventory items
   */
  async getAllForecasts(filters: ForecastFilters = {}): Promise<AllForecastsResponse> {
    const queryParams = new URLSearchParams();
    
    if (filters.category) queryParams.append('category', filters.category);
    if (filters.type) queryParams.append('type', filters.type);
    if (filters.size !== undefined) {
      queryParams.append('size', filters.size === null ? 'null' : filters.size);
    }
    if (filters.forecastDate) queryParams.append('forecastDate', filters.forecastDate);

    const response = await fetch(
      `${API_BASE_URL}/api/forecast/all?${queryParams}`,
      {
        method: 'GET',
        headers: this.getAuthHeaders()
      }
    );

    return this.handleResponse<AllForecastsResponse>(response);
  }

  /**
   * Get current model information
   */
  async getModelInfo(): Promise<ModelInfo> {
    const response = await fetch(
      `${API_BASE_URL}/api/forecast/model`,
      {
        method: 'GET',
        headers: this.getAuthHeaders()
      }
    );

    return this.handleResponse<ModelInfo>(response);
  }

  /**
   * Upload/update ML model (Admin only)
   */
  async uploadModel(modelData: ModelUploadData): Promise<ModelUploadResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/forecast/model`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(modelData)
      }
    );

    return this.handleResponse<ModelUploadResponse>(response);
  }

  /**
   * Get feature vector for debugging
   */
  async getFeatureVector(params: ForecastParams): Promise<any> {
    const queryParams = new URLSearchParams({
      category: params.category,
      type: params.type,
      ...(params.size && { size: params.size }),
      ...(params.forecastDate && { forecastDate: params.forecastDate }),
      ...(params.batch && { batch: params.batch })
    });

    const response = await fetch(
      `${API_BASE_URL}/api/forecast/features?${queryParams}`,
      {
        method: 'GET',
        headers: this.getAuthHeaders()
      }
    );

    return this.handleResponse<any>(response);
  }

  /**
   * Import recommended stock from Google Colab (Admin only)
   * Accepts FINAL EXPORT FORMAT:
   * {
   *   "generatedAt": "2026-01-05T10:30:00",
   *   "source": "google_colab",
   *   "totalItems": 42,
   *   "recommendations": [...]
   * }
   */
  async importRecommendedStock(exportData: {
    generatedAt?: string;
    source?: string;
    totalItems?: number;
    recommendations: Array<{
      category: string;
      type: string;
      size?: string | null;
      forecastedDemand?: number;
      recommendedStock: number;
      analysisDate?: string;
    }>;
    overwrite?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    imported: number;
    updatedInventoryItems: number;
    totalItems?: number;
    generatedAt?: string;
    source?: string;
    warnings?: string[];
    failedItems?: any[];
    matchingResults?: any[];
    error?: string;
  }> {
    const response = await fetch(
      `${API_BASE_URL}/api/recommended-stock/import`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          generatedAt: exportData.generatedAt,
          source: exportData.source || 'google_colab',
          totalItems: exportData.totalItems,
          recommendations: exportData.recommendations,
          overwrite: exportData.overwrite !== undefined ? exportData.overwrite : true
        })
      }
    );

    return this.handleResponse<any>(response);
  }

  /**
   * Get all recommended stock
   */
  async getAllRecommendedStock(filters: {
    category?: string;
    type?: string;
    size?: string | null;
    latest?: boolean;
  } = {}): Promise<{
    success: boolean;
    recommendations: any[];
    count: number;
    message?: string;
  }> {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.type) params.append('type', filters.type);
    if (filters.size !== undefined) {
      params.append('size', filters.size === null ? 'null' : filters.size);
    }
    if (filters.latest !== undefined) {
      params.append('latest', filters.latest.toString());
    }

    const response = await fetch(
      `${API_BASE_URL}/api/recommended-stock?${params}`,
      {
        method: 'GET',
        headers: this.getAuthHeaders()
      }
    );

    return this.handleResponse<any>(response);
  }

  /**
   * Run forecast using pre-trained ML model (Admin only)
   * Generates forecast recommendations automatically from historical data
   */
  async runForecast(): Promise<RunForecastResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/forecast/run`,
      {
        method: 'POST',
        headers: this.getAuthHeaders()
      }
    );

    return this.handleResponse<RunForecastResponse>(response);
  }

  /**
   * Get graph data for recommended stock
   */
  async getRecommendedStockGraph(category: string, type: string): Promise<{
    success: boolean;
    category: string;
    type: string;
    data: Array<{
      size: string | null;
      recommendedStock: number;
      forecastedDemand?: number;
      analysisDate?: string;
    }>;
    count: number;
    message?: string;
  }> {
    const params = new URLSearchParams({
      category,
      type
    });

    const response = await fetch(
      `${API_BASE_URL}/api/recommended-stock/graph?${params}`,
      {
        method: 'GET',
        headers: this.getAuthHeaders()
      }
    );

    return this.handleResponse<any>(response);
  }
}

// Export singleton instance
export const forecastService = new ForecastService();

// Run Forecast Response type
export interface RunForecastResponse {
  success: boolean;
  message: string;
  generated: number;
  error?: string;
}

// Export types
export type {
  Forecast,
  AllForecastItem,
  ForecastResponse,
  AllForecastsResponse,
  ModelInfo,
  ModelUploadData,
  ModelUploadResponse,
  ForecastParams,
  ForecastFilters
};
