# Frontend Forecast Run Command - Quick Reference

## 🚀 Run Forecast Endpoint

**Endpoint:** `POST /api/forecast/run`

**Purpose:** Generate forecast recommendations automatically using pre-trained ML model and historical data.

**Authentication:** Admin only (Bearer token required)

**Request Body:** None (empty body)

---

## 📋 Quick Examples

### 1. Using Fetch API

```javascript
const runForecast = async () => {
  const token = localStorage.getItem('token');
  
  try {
    const response = await fetch('http://localhost:5000/api/forecast/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ Success! Generated ${data.generated} recommendations`);
      return data;
    } else {
      console.error('❌ Error:', data.message);
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Forecast error:', error);
    throw error;
  }
};

// Usage
await runForecast();
```

### 2. Using Axios

```javascript
import axios from 'axios';

const runForecast = async () => {
  const token = localStorage.getItem('token');
  
  try {
    const response = await axios.post(
      'http://localhost:5000/api/forecast/run',
      {}, // Empty body
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (response.data.success) {
      console.log(`✅ Generated ${response.data.generated} recommendations`);
      return response.data;
    }
  } catch (error) {
    if (error.response) {
      console.error('API Error:', error.response.data.message);
    } else {
      console.error('Network Error:', error.message);
    }
    throw error;
  }
};

// Usage
await runForecast();
```

### 3. Using the Forecast Service (TypeScript)

```typescript
import { forecastService } from './services/forecastService';

// Run forecast
const result = await forecastService.runForecast();

if (result.success) {
  console.log(`✅ ${result.message}`);
  console.log(`Generated ${result.generated} recommendations`);
  
  // Refresh recommendations list
  const recommendations = await forecastService.getAllRecommendedStock();
} else {
  console.error('❌ Error:', result.error);
}
```

### 4. React Component Example

```jsx
import React, { useState } from 'react';
import { forecastService } from './services/forecastService';

const ForecastButton = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleRunForecast = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const result = await forecastService.runForecast();
      
      if (result.success) {
        setMessage(`✅ ${result.message} (${result.generated} recommendations)`);
        
        // Optionally refresh the recommendations list
        // await refreshRecommendations();
      } else {
        setError(result.error || 'Failed to generate forecast');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button 
        onClick={handleRunForecast} 
        disabled={loading}
        className="forecast-button"
      >
        {loading ? 'Generating Forecast...' : 'Forecast Uniform Demand'}
      </button>
      
      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">❌ {error}</div>}
    </div>
  );
};

export default ForecastButton;
```

### 5. React Hook Example

```jsx
import { useState } from 'react';
import { forecastService } from './services/forecastService';

const useForecastRun = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const runForecast = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await forecastService.runForecast();
      setResult(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { runForecast, loading, result, error };
};

// Usage in component
const ForecastPage = () => {
  const { runForecast, loading, result, error } = useForecastRun();

  return (
    <div>
      <button onClick={runForecast} disabled={loading}>
        {loading ? 'Running Forecast...' : 'Generate Forecast'}
      </button>
      
      {result && (
        <div className="success">
          ✅ {result.message} ({result.generated} recommendations)
        </div>
      )}
      
      {error && <div className="error">❌ {error}</div>}
    </div>
  );
};
```

---

## 📤 Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Forecast generated successfully. 50 recommendations created.",
  "generated": 50
}
```

### Error Response (500)

```json
{
  "success": false,
  "message": "Failed to generate forecast: Model not found or historical data unavailable",
  "error": "Model file not found: models/uniform_forecast.pkl"
}
```

### Unauthorized Response (401)

```json
{
  "success": false,
  "message": "Unauthorized. Admin access required."
}
```

---

## 🔄 Complete Workflow Example

```javascript
// Complete workflow: Run forecast → Refresh recommendations → Display graph
const handleForecastWorkflow = async () => {
  try {
    // Step 1: Run forecast
    const forecastResult = await forecastService.runForecast();
    
    if (!forecastResult.success) {
      alert(`Error: ${forecastResult.message}`);
      return;
    }

    console.log(`✅ Generated ${forecastResult.generated} recommendations`);

    // Step 2: Wait a moment for database to update
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 3: Refresh recommendations
    const recommendations = await forecastService.getAllRecommendedStock({
      latest: true
    });

    console.log(`📊 Retrieved ${recommendations.count} recommendations`);

    // Step 4: Display in UI or update graph
    updateRecommendationsList(recommendations.recommendations);
    updateForecastGraph(recommendations.recommendations);

    // Step 5: Show success notification
    showNotification({
      type: 'success',
      message: `Forecast completed! ${forecastResult.generated} recommendations generated.`
    });

  } catch (error) {
    console.error('Forecast workflow error:', error);
    showNotification({
      type: 'error',
      message: `Failed to generate forecast: ${error.message}`
    });
  }
};
```

---

## 🎯 Integration with "Forecast Uniform Demand" Button

```jsx
// In your Forecasting Dashboard component
import { forecastService } from '../services/forecastService';

const ForecastingDashboard = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleForecastButtonClick = async () => {
    setIsGenerating(true);
    
    try {
      // Run forecast
      const result = await forecastService.runForecast();
      
      if (result.success) {
        // Show success message
        toast.success(
          `Forecast generated successfully! ${result.generated} recommendations created.`
        );
        
        // Refresh the recommendations list
        await refreshRecommendations();
        
        // Auto-display graph if available
        if (selectedCategory && selectedType) {
          await loadGraphData(selectedCategory, selectedType);
        }
      } else {
        toast.error(result.message || 'Failed to generate forecast');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred while generating forecast');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="forecasting-dashboard">
      <button
        onClick={handleForecastButtonClick}
        disabled={isGenerating}
        className="btn btn-primary forecast-button"
      >
        {isGenerating ? (
          <>
            <Spinner /> Generating Forecast...
          </>
        ) : (
          'Forecast Uniform Demand'
        )}
      </button>
      
      {/* Rest of your dashboard */}
    </div>
  );
};
```

---

## ⚠️ Error Handling

```javascript
const runForecastWithErrorHandling = async () => {
  try {
    const result = await forecastService.runForecast();
    
    if (result.success) {
      return result;
    } else {
      // Handle specific error cases
      if (result.error?.includes('Model file not found')) {
        alert('Model not found. Please upload a model first.');
      } else if (result.error?.includes('No historical data')) {
        alert('No historical data available. Please ensure uniform submissions exist.');
      } else if (result.error?.includes('Python')) {
        alert('Python execution error. Please check backend logs.');
      } else {
        alert(`Error: ${result.message}`);
      }
      throw new Error(result.message);
    }
  } catch (error) {
    // Network errors, etc.
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      alert('Admin access required. Please login as admin.');
    } else if (error.message.includes('Network')) {
      alert('Network error. Please check your connection.');
    } else {
      alert(`Unexpected error: ${error.message}`);
    }
    throw error;
  }
};
```

---

## 📝 TypeScript Types

```typescript
interface RunForecastResponse {
  success: boolean;
  message: string;
  generated: number;
  error?: string;
}

// Usage
const result: RunForecastResponse = await forecastService.runForecast();
```

---

## ✅ Checklist

- [ ] User is logged in as admin
- [ ] JWT token is stored and valid
- [ ] Backend server is running
- [ ] Model file exists (`models/uniform_forecast.pkl`)
- [ ] Historical data exists in database
- [ ] Handle loading state
- [ ] Handle success/error messages
- [ ] Refresh recommendations after successful forecast
- [ ] Update UI/graph after forecast completes

---

## 🧪 Testing

```javascript
// Test in browser console
const testForecast = async () => {
  const token = localStorage.getItem('token');
  
  const response = await fetch('http://localhost:5000/api/forecast/run', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  console.log('Result:', data);
};

testForecast();
```

---

## 📚 Related Documentation

- See `FORECAST_RUN_ENDPOINT_IMPLEMENTATION.md` for backend details
- See `FRONTEND_FORECASTING_INTEGRATION.md` for other forecast endpoints
- See `src/services/forecastService.ts` for complete service implementation
