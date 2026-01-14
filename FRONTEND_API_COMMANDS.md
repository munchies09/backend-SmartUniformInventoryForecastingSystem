# Frontend API Commands - Quick Reference

Quick reference guide for testing and using the Forecasting API from the frontend.

## Prerequisites

1. Backend server running on `http://localhost:5000`
2. JWT token (stored in localStorage or sessionStorage)
3. Model uploaded (for generating forecasts)

---

## JavaScript/TypeScript Examples

### 1. Get Forecast for Specific Item

```javascript
// Using fetch
const token = localStorage.getItem('token');

const response = await fetch(
  'http://localhost:5000/api/forecast?category=Uniform%20No%203&type=Cloth%20No%203&size=M',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const data = await response.json();
console.log(data);
```

```typescript
// Using the service
import { forecastService } from './services/forecastService';

const result = await forecastService.getForecast({
  category: 'Uniform No 3',
  type: 'Cloth No 3',
  size: 'M'
});

if (result.success && result.forecast) {
  console.log('Predicted Demand:', result.forecast.predictedDemand);
  console.log('Confidence:', result.forecast.confidence);
}
```

### 2. Get All Forecasts

```javascript
// Using fetch
const response = await fetch(
  'http://localhost:5000/api/forecast/all?category=Uniform%20No%203',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const data = await response.json();
console.log('Forecasts:', data.forecasts);
```

```typescript
// Using the service
const result = await forecastService.getAllForecasts({
  category: 'Uniform No 3'
});

if (result.success && result.forecasts) {
  result.forecasts.forEach(forecast => {
    console.log(`${forecast.type} ${forecast.size}: ${forecast.predictedDemand}`);
  });
}
```

### 3. Get Model Information

```javascript
const response = await fetch(
  'http://localhost:5000/api/forecast/model',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const data = await response.json();
console.log('Model Info:', data.model);
```

```typescript
const result = await forecastService.getModelInfo();
if (result.success && result.model) {
  console.log('Model Version:', result.model.version);
  console.log('Accuracy:', result.model.accuracy);
}
```

### 4. Upload Model (Admin Only)

```javascript
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
console.log(data);
```

```typescript
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

const result = await forecastService.uploadModel(modelData);
if (result.success) {
  console.log('Model uploaded successfully!');
}
```

---

## React Hooks Examples

### Custom Hook for Forecast

```typescript
// hooks/useForecast.ts
import { useState, useEffect } from 'react';
import { forecastService, ForecastResponse } from '../services/forecastService';

export const useForecast = (
  category: string,
  type: string,
  size: string | null = null
) => {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!category || !type) return;

    const fetchForecast = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await forecastService.getForecast({
          category,
          type,
          size
        });

        if (result.success) {
          setForecast(result);
        } else {
          setError(result.message || 'Failed to fetch forecast');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchForecast();
  }, [category, type, size]);

  return { forecast, loading, error };
};
```

**Usage in Component:**
```tsx
import { useForecast } from '../hooks/useForecast';

const ForecastComponent = () => {
  const { forecast, loading, error } = useForecast(
    'Uniform No 3',
    'Cloth No 3',
    'M'
  );

  if (loading) return <div>Loading forecast...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!forecast?.forecast) return null;

  return (
    <div>
      <h3>Forecast</h3>
      <p>Predicted Demand: {forecast.forecast.predictedDemand}</p>
      <p>Confidence: {forecast.forecast.confidence}%</p>
    </div>
  );
};
```

### Custom Hook for All Forecasts

```typescript
// hooks/useAllForecasts.ts
import { useState, useEffect } from 'react';
import { forecastService, AllForecastsResponse, ForecastFilters } from '../services/forecastService';

export const useAllForecasts = (filters: ForecastFilters = {}) => {
  const [forecasts, setForecasts] = useState<AllForecastsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchForecasts = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await forecastService.getAllForecasts(filters);

        if (result.success) {
          setForecasts(result);
        } else {
          setError(result.message || 'Failed to fetch forecasts');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchForecasts();
  }, [JSON.stringify(filters)]);

  return { forecasts, loading, error };
};
```

---

## Axios Examples

If you're using Axios:

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Get forecast
const getForecast = async (category: string, type: string, size?: string) => {
  const response = await api.get('/forecast', {
    params: { category, type, size }
  });
  return response.data;
};

// Get all forecasts
const getAllForecasts = async (filters: any) => {
  const response = await api.get('/forecast/all', { params: filters });
  return response.data;
};

// Upload model
const uploadModel = async (modelData: any) => {
  const response = await api.post('/forecast/model', modelData);
  return response.data;
};
```

---

## Error Handling Example

```typescript
try {
  const result = await forecastService.getForecast({
    category: 'Uniform No 3',
    type: 'Cloth No 3',
    size: 'M'
  });

  if (result.success) {
    // Handle success
    console.log('Forecast:', result.forecast);
  } else {
    // Handle API error
    console.error('API Error:', result.message);
  }
} catch (error: any) {
  // Handle network or other errors
  if (error.message.includes('401')) {
    console.error('Unauthorized - please login again');
    // Redirect to login
  } else if (error.message.includes('404')) {
    console.error('Model not found - please upload a model first');
  } else {
    console.error('Error:', error.message);
  }
}
```

---

## React Component Example (Complete)

```tsx
import React, { useState } from 'react';
import { forecastService } from '../services/forecastService';

const ForecastDashboard = () => {
  const [category, setCategory] = useState('Uniform No 3');
  const [type, setType] = useState('Cloth No 3');
  const [size, setSize] = useState('M');
  const [forecast, setForecast] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetForecast = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await forecastService.getForecast({
        category,
        type,
        size: size || null
      });

      if (result.success) {
        setForecast(result.forecast);
      } else {
        setError(result.message || 'Failed to fetch forecast');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Uniform Demand Forecast</h2>
      
      <div>
        <label>Category:</label>
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </div>

      <div>
        <label>Type:</label>
        <input
          type="text"
          value={type}
          onChange={(e) => setType(e.target.value)}
        />
      </div>

      <div>
        <label>Size:</label>
        <input
          type="text"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          placeholder="M, L, XL or leave empty for accessories"
        />
      </div>

      <button onClick={handleGetForecast} disabled={loading}>
        {loading ? 'Loading...' : 'Get Forecast'}
      </button>

      {error && <div style={{ color: 'red' }}>Error: {error}</div>}

      {forecast && (
        <div>
          <h3>Forecast Result</h3>
          <p><strong>Predicted Demand:</strong> {forecast.predictedDemand}</p>
          <p><strong>Confidence:</strong> {forecast.confidence}%</p>
          <p><strong>Model Version:</strong> {forecast.modelInfo.version}</p>
          <p><strong>Model Type:</strong> {forecast.modelInfo.modelType}</p>
        </div>
      )}
    </div>
  );
};

export default ForecastDashboard;
```

---

## Quick Test Commands (JavaScript Console)

Paste these into your browser console (after logging in and getting a token):

```javascript
// Set your token
localStorage.setItem('token', 'YOUR_JWT_TOKEN_HERE');

// Test 1: Get forecast
fetch('http://localhost:5000/api/forecast?category=Uniform%20No%203&type=Cloth%20No%203&size=M', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
})
  .then(r => r.json())
  .then(console.log);

// Test 2: Get all forecasts
fetch('http://localhost:5000/api/forecast/all?category=Uniform%20No%203', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
})
  .then(r => r.json())
  .then(console.log);

// Test 3: Get model info
fetch('http://localhost:5000/api/forecast/model', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
})
  .then(r => r.json())
  .then(console.log);
```

---

## Environment Variables

Create a `.env` file in your frontend project:

```env
REACT_APP_API_URL=http://localhost:5000
```

Or for production:
```env
REACT_APP_API_URL=https://your-api-domain.com
```

---

## Notes

- Replace `http://localhost:5000` with your actual API URL
- Store JWT token securely (localStorage/sessionStorage/httpOnly cookies)
- Handle errors gracefully
- Show loading states to users
- Model must be uploaded before generating forecasts
- Admin role required for model upload endpoint

For more details, see `FRONTEND_FORECASTING_INTEGRATION.md`
