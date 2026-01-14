# Frontend Forecasting API Integration Guide

This guide shows how to integrate the forecasting API into your frontend application.

## Base URL

```
http://localhost:5000/api/forecast
```

All endpoints require authentication. Include the JWT token in the Authorization header.

## Authentication

```javascript
const token = localStorage.getItem('token'); // or wherever you store the token
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};
```

## API Endpoints

### 1. Get Forecast for Specific Item

Get forecasted demand for a specific uniform item.

**Endpoint:** `GET /api/forecast`

**Query Parameters:**
- `category` (required) - e.g., "Uniform No 3"
- `type` (required) - e.g., "Cloth No 3"
- `size` (optional) - e.g., "M", "L", "XL" or `null` for accessories
- `forecastDate` (optional) - ISO date string, defaults to today
- `period` (optional) - Forecast period (for future use)
- `batch` (optional) - Batch string, e.g., "Batch 2024"

**Example Request:**
```javascript
// Using fetch
const getForecast = async (category, type, size = null, forecastDate = null) => {
  const params = new URLSearchParams({
    category,
    type,
    ...(size && { size }),
    ...(forecastDate && { forecastDate })
  });

  try {
    const response = await fetch(
      `http://localhost:5000/api/forecast?${params}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching forecast:', error);
    throw error;
  }
};

// Usage
const forecast = await getForecast('Uniform No 3', 'Cloth No 3', 'M');
console.log(forecast);
// {
//   success: true,
//   forecast: {
//     category: "Uniform No 3",
//     type: "Cloth No 3",
//     size: "M",
//     forecastDate: "2024-01-15T00:00:00.000Z",
//     predictedDemand: 25,
//     confidence: 85,
//     modelInfo: {
//       modelType: "linear_regression",
//       version: "1.0.0",
//       accuracy: { mae: 1.2, rmse: 1.8, r2: 0.85 }
//     }
//   }
// }
```

**Using Axios:**
```javascript
import axios from 'axios';

const getForecast = async (category, type, size = null, forecastDate = null) => {
  try {
    const response = await axios.get('http://localhost:5000/api/forecast', {
      params: {
        category,
        type,
        size,
        forecastDate
      },
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching forecast:', error);
    throw error;
  }
};
```

**React Hook Example:**
```javascript
import { useState, useEffect } from 'react';

const useForecast = (category, type, size, forecastDate = null) => {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!category || !type) return;

    const fetchForecast = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          category,
          type,
          ...(size && { size }),
          ...(forecastDate && { forecastDate })
        });

        const response = await fetch(
          `http://localhost:5000/api/forecast?${params}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }
          }
        );

        const data = await response.json();

        if (data.success) {
          setForecast(data.forecast);
        } else {
          setError(data.message);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchForecast();
  }, [category, type, size, forecastDate]);

  return { forecast, loading, error };
};

// Usage in component
const ForecastComponent = () => {
  const { forecast, loading, error } = useForecast('Uniform No 3', 'Cloth No 3', 'M');

  if (loading) return <div>Loading forecast...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!forecast) return null;

  return (
    <div>
      <h3>Forecast</h3>
      <p>Predicted Demand: {forecast.predictedDemand}</p>
      <p>Confidence: {forecast.confidence}%</p>
    </div>
  );
};
```

---

### 2. Get Forecasts for All Inventory Items

Get forecasts for all inventory items (optionally filtered).

**Endpoint:** `GET /api/forecast/all`

**Query Parameters:**
- `category` (optional) - Filter by category
- `type` (optional) - Filter by type
- `size` (optional) - Filter by size
- `forecastDate` (optional) - ISO date string, defaults to today

**Example Request:**
```javascript
const getAllForecasts = async (filters = {}) => {
  const params = new URLSearchParams(
    Object.entries(filters).reduce((acc, [key, value]) => {
      if (value !== null && value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {})
  );

  try {
    const response = await fetch(
      `http://localhost:5000/api/forecast/all?${params}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching forecasts:', error);
    throw error;
  }
};

// Usage
const forecasts = await getAllForecasts({ category: 'Uniform No 3' });
console.log(forecasts);
// {
//   success: true,
//   forecasts: [
//     {
//       category: "Uniform No 3",
//       type: "Cloth No 3",
//       size: "M",
//       currentQuantity: 10,
//       status: "In Stock",
//       forecastDate: "2024-01-15T00:00:00.000Z",
//       predictedDemand: 25,
//       confidence: 85,
//       reorderRecommendation: "Consider reordering 15 units"
//     },
//     ...
//   ],
//   modelInfo: { ... },
//   forecastDate: "2024-01-15T00:00:00.000Z",
//   count: 50
// }
```

**React Component Example:**
```javascript
import { useState, useEffect } from 'react';

const ForecastsTable = ({ filters = {} }) => {
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchForecasts = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams(
          Object.entries(filters).reduce((acc, [key, value]) => {
            if (value) acc[key] = value;
            return acc;
          }, {})
        );

        const response = await fetch(
          `http://localhost:5000/api/forecast/all?${params}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }
          }
        );

        const data = await response.json();
        if (data.success) {
          setForecasts(data.forecasts);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchForecasts();
  }, [filters]);

  if (loading) return <div>Loading...</div>;

  return (
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th>Type</th>
          <th>Size</th>
          <th>Current Stock</th>
          <th>Predicted Demand</th>
          <th>Recommendation</th>
        </tr>
      </thead>
      <tbody>
        {forecasts.map((f, idx) => (
          <tr key={idx}>
            <td>{f.category}</td>
            <td>{f.type}</td>
            <td>{f.size || 'N/A'}</td>
            <td>{f.currentQuantity}</td>
            <td>{f.predictedDemand}</td>
            <td>{f.reorderRecommendation}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

---

### 3. Get Model Information

Get information about the current forecasting model.

**Endpoint:** `GET /api/forecast/model`

**Example Request:**
```javascript
const getModelInfo = async () => {
  try {
    const response = await fetch(
      'http://localhost:5000/api/forecast/model',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching model info:', error);
    throw error;
  }
};

// Usage
const modelInfo = await getModelInfo();
console.log(modelInfo);
// {
//   success: true,
//   model: {
//     modelName: "uniform_demand_forecast",
//     modelType: "linear_regression",
//     version: "1.0.0",
//     features: ["month", "dayOfWeek", "category_encoded", ...],
//     accuracy: { mae: 1.2, rmse: 1.8, r2: 0.85 },
//     trainingDate: "2024-01-10T00:00:00.000Z",
//     featureCount: 20,
//     hasCoefficients: true,
//     hasScaler: false
//   }
// }
```

---

### 4. Upload/Update ML Model (Admin Only)

Upload or update the forecasting model from Colab.

**Endpoint:** `POST /api/forecast/model`

**Request Body:**
```json
{
  "modelName": "uniform_demand_forecast",
  "modelType": "linear_regression",
  "version": "1.0.0",
  "features": ["month", "dayOfWeek", "category_encoded", "type_encoded", "size_encoded"],
  "coefficients": [0.5, -0.2, 1.3, 0.8, -0.1],
  "intercept": 2.5,
  "accuracy": {
    "mae": 1.2,
    "rmse": 1.8,
    "r2": 0.85
  },
  "description": "Model trained on 6 months of data"
}
```

**Example Request:**
```javascript
const uploadModel = async (modelData) => {
  try {
    const response = await fetch(
      'http://localhost:5000/api/forecast/model',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(modelData)
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error uploading model:', error);
    throw error;
  }
};

// Usage
const modelData = {
  modelName: 'uniform_demand_forecast',
  modelType: 'linear_regression',
  version: '1.0.0',
  features: ['month', 'dayOfWeek', 'category_encoded', 'type_encoded', 'size_encoded'],
  coefficients: [0.5, -0.2, 1.3, 0.8, -0.1],
  intercept: 2.5,
  accuracy: {
    mae: 1.2,
    rmse: 1.8,
    r2: 0.85
  }
};

const result = await uploadModel(modelData);
```

**File Upload Example (Admin Panel):**
```javascript
// In a React component
const handleModelUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const modelData = JSON.parse(e.target.result);
      
      const response = await fetch(
        'http://localhost:5000/api/forecast/model',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(modelData)
        }
      );

      const data = await response.json();
      
      if (data.success) {
        alert('Model uploaded successfully!');
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to upload model');
    }
  };

  reader.readAsText(file);
};

// JSX
<input type="file" accept=".json" onChange={handleModelUpload} />
```

---

### 5. Get Feature Vector (Debugging)

Get the feature vector for a specific item (useful for debugging).

**Endpoint:** `GET /api/forecast/features`

**Query Parameters:** Same as forecast endpoint

**Example:**
```javascript
const getFeatureVector = async (category, type, size = null) => {
  const params = new URLSearchParams({
    category,
    type,
    ...(size && { size })
  });

  try {
    const response = await fetch(
      `http://localhost:5000/api/forecast/features?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
```

---

## Complete React Service File

Here's a complete service file you can use in your React frontend:

```javascript
// services/forecastService.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export const forecastService = {
  // Get forecast for specific item
  getForecast: async (category, type, size = null, forecastDate = null) => {
    const params = new URLSearchParams({
      category,
      type,
      ...(size && { size }),
      ...(forecastDate && { forecastDate })
    });

    const response = await fetch(
      `${API_BASE_URL}/api/forecast?${params}`,
      {
        method: 'GET',
        headers: getAuthHeaders()
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch forecast');
    }

    return response.json();
  },

  // Get all forecasts
  getAllForecasts: async (filters = {}) => {
    const params = new URLSearchParams(
      Object.entries(filters).reduce((acc, [key, value]) => {
        if (value !== null && value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {})
    );

    const response = await fetch(
      `${API_BASE_URL}/api/forecast/all?${params}`,
      {
        method: 'GET',
        headers: getAuthHeaders()
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch forecasts');
    }

    return response.json();
  },

  // Get model info
  getModelInfo: async () => {
    const response = await fetch(
      `${API_BASE_URL}/api/forecast/model`,
      {
        method: 'GET',
        headers: getAuthHeaders()
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch model info');
    }

    return response.json();
  },

  // Upload model (Admin only)
  uploadModel: async (modelData) => {
    const response = await fetch(
      `${API_BASE_URL}/api/forecast/model`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(modelData)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to upload model');
    }

    return response.json();
  },

  // Get feature vector (debugging)
  getFeatureVector: async (category, type, size = null, forecastDate = null) => {
    const params = new URLSearchParams({
      category,
      type,
      ...(size && { size }),
      ...(forecastDate && { forecastDate })
    });

    const response = await fetch(
      `${API_BASE_URL}/api/forecast/features?${params}`,
      {
        method: 'GET',
        headers: getAuthHeaders()
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch feature vector');
    }

    return response.json();
  }
};

// Usage
import { forecastService } from './services/forecastService';

// In your component
const forecast = await forecastService.getForecast('Uniform No 3', 'Cloth No 3', 'M');
const allForecasts = await forecastService.getAllForecasts({ category: 'Uniform No 3' });
const modelInfo = await forecastService.getModelInfo();
```

---

## Error Handling

All endpoints return errors in this format:

```javascript
{
  success: false,
  message: "Error message here",
  error: "Detailed error (in development mode)"
}
```

**Error Handling Example:**
```javascript
try {
  const forecast = await getForecast('Uniform No 3', 'Cloth No 3', 'M');
  // Handle success
} catch (error) {
  if (error.response) {
    // API returned an error
    const { status, data } = error.response;
    if (status === 404) {
      console.error('Model not found:', data.message);
    } else if (status === 401) {
      console.error('Unauthorized - check your token');
    } else {
      console.error('API Error:', data.message);
    }
  } else {
    // Network or other error
    console.error('Error:', error.message);
  }
}
```

---

## TypeScript Types (Optional)

If using TypeScript, you can define these types:

```typescript
// types/forecast.ts
export interface Forecast {
  category: string;
  type: string;
  size: string | null;
  forecastDate: string;
  predictedDemand: number;
  confidence?: number;
  modelInfo: ModelInfo;
}

export interface ModelInfo {
  modelType: string;
  version: string;
  accuracy?: {
    mae?: number;
    rmse?: number;
    r2?: number;
    [key: string]: number | undefined;
  };
}

export interface ForecastResponse {
  success: boolean;
  forecast?: Forecast;
  forecasts?: Forecast[];
  modelInfo?: ModelInfo;
  forecastDate?: string;
  count?: number;
  message?: string;
  error?: string;
}

export interface ModelUploadData {
  modelName: string;
  modelType: string;
  version: string;
  features: string[];
  coefficients?: number[];
  intercept?: number;
  accuracy?: {
    mae?: number;
    rmse?: number;
    r2?: number;
    [key: string]: number | undefined;
  };
  description?: string;
}
```

---

## Quick Start Checklist

1. ✅ Ensure backend is running on `http://localhost:5000`
2. ✅ Store JWT token in localStorage/sessionStorage
3. ✅ Import forecastService or create API functions
4. ✅ Upload model from Colab (Admin only, one-time setup)
5. ✅ Start making forecast requests

---

## Notes

- All endpoints require authentication
- Admin endpoints (model upload) require admin role
- Model must be uploaded before forecasts can be generated
- Feature names in your Colab model must match backend expectations
- See `ML_IMPLEMENTATION_GUIDE.md` for model format details
