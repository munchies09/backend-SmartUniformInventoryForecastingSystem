# Frontend Fix: Import Recommended Stock

## ❌ Current Error

```
Upload Error
modelName, modelType, version, and features are required
No forecasting model found. Please upload a model first.
```

## 🔍 Problem

The frontend is trying to upload recommended stock JSON to the **wrong endpoint**:
- ❌ Currently using: `POST /api/forecast/model` (ML model upload)
- ✅ Should use: `POST /api/recommended-stock/import` (Recommended stock import)

## ✅ Solution

### Option 1: Use the Updated forecastService (Recommended)

The `forecastService.ts` file has been updated with a new method `importRecommendedStock()`:

```typescript
import { forecastService } from './services/forecastService';

// Import recommended stock from Colab JSON file
const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const jsonData = JSON.parse(e.target?.result as string);
      
      // Use the correct method for recommended stock
      const result = await forecastService.importRecommendedStock({
        generatedAt: jsonData.generatedAt,
        source: jsonData.source || 'google_colab',
        totalItems: jsonData.totalItems,
        recommendations: jsonData.recommendations,
        overwrite: true
      });

      if (result.success) {
        alert(`✅ Successfully imported ${result.imported} recommendations!`);
      } else {
        alert(`❌ Error: ${result.message}`);
      }
    } catch (error: any) {
      alert(`❌ Failed to import: ${error.message}`);
    }
  };

  reader.readAsText(file);
};
```

### Option 2: Direct Fetch (Alternative)

If you're not using the service, use direct fetch:

```typescript
const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const jsonData = JSON.parse(e.target?.result as string);
      
      const token = localStorage.getItem('token');
      
      // ✅ Use the CORRECT endpoint
      const response = await fetch(
        'http://localhost:5000/api/recommended-stock/import',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            generatedAt: jsonData.generatedAt,
            source: jsonData.source || 'google_colab',
            totalItems: jsonData.totalItems,
            recommendations: jsonData.recommendations,
            overwrite: true
          })
        }
      );

      const result = await response.json();

      if (result.success) {
        alert(`✅ Successfully imported ${result.imported} recommendations!`);
      } else {
        alert(`❌ Error: ${result.message}`);
        if (result.errors) {
          console.error('Validation errors:', result.errors);
        }
        if (result.warnings) {
          console.warn('Warnings:', result.warnings);
        }
      }
    } catch (error: any) {
      alert(`❌ Failed to import: ${error.message}`);
    }
  };

  reader.readAsText(file);
};
```

## 📋 Expected JSON Format (FINAL EXPORT FORMAT)

Make sure your JSON file matches this format exactly:

```json
{
  "generatedAt": "2026-01-05T10:30:00",
  "source": "google_colab",
  "totalItems": 42,
  "recommendations": [
    {
      "category": "Uniform No 3",
      "type": "BAJU NO 3 LELAKI",
      "size": "M",
      "forecastedDemand": 38,
      "recommendedStock": 44,
      "analysisDate": "2026-01-05T10:30:00"
    },
    {
      "category": "Uniform No 3",
      "type": "BAJU NO 3 LELAKI",
      "size": "L",
      "forecastedDemand": 35,
      "recommendedStock": 40,
      "analysisDate": "2026-01-05T10:30:00"
    }
  ]
}
```

## ✅ Complete React Component Example

```tsx
import React, { useState } from 'react';
import { forecastService } from './services/forecastService';

const ImportRecommendedStock: React.FC = () => {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage('');
    setErrors([]);
    setWarnings([]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);

        // Validate format
        if (!jsonData.recommendations || !Array.isArray(jsonData.recommendations)) {
          throw new Error('Invalid format: Expected FINAL EXPORT FORMAT with recommendations array');
        }

        // Import using the correct endpoint
        const result = await forecastService.importRecommendedStock({
          generatedAt: jsonData.generatedAt,
          source: jsonData.source || 'google_colab',
          totalItems: jsonData.totalItems,
          recommendations: jsonData.recommendations,
          overwrite: true
        });

        if (result.success) {
          setMessage(`✅ Successfully imported ${result.imported} recommendations!`);
          if (result.warnings && result.warnings.length > 0) {
            setWarnings(result.warnings);
          }
        } else {
          setMessage(`❌ Error: ${result.message}`);
          if (result.errors) {
            setErrors(result.errors);
          }
        }
      } catch (error: any) {
        setMessage(`❌ Failed to import: ${error.message}`);
        console.error('Import error:', error);
      } finally {
        setUploading(false);
      }
    };

    reader.onloadend = () => {
      setUploading(false);
    };

    reader.readAsText(file);
  };

  return (
    <div>
      <h2>Import Recommended Stock from Colab</h2>
      
      <input
        type="file"
        accept=".json"
        onChange={handleFileUpload}
        disabled={uploading}
      />

      {uploading && <p>Uploading...</p>}
      
      {message && (
        <div style={{ 
          padding: '10px', 
          marginTop: '10px',
          backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
          color: message.includes('✅') ? '#155724' : '#721c24',
          borderRadius: '4px'
        }}>
          {message}
        </div>
      )}

      {warnings.length > 0 && (
        <div style={{ 
          padding: '10px', 
          marginTop: '10px',
          backgroundColor: '#fff3cd',
          color: '#856404',
          borderRadius: '4px'
        }}>
          <strong>Warnings:</strong>
          <ul>
            {warnings.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {errors.length > 0 && (
        <div style={{ 
          padding: '10px', 
          marginTop: '10px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '4px'
        }}>
          <strong>Errors:</strong>
          <ul>
            {errors.map((error, idx) => (
              <li key={idx}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        <strong>Expected Format:</strong>
        <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
{`{
  "generatedAt": "2026-01-05T10:30:00",
  "source": "google_colab",
  "totalItems": 42,
  "recommendations": [...]
}`}
        </pre>
      </div>
    </div>
  );
};

export default ImportRecommendedStock;
```

## 🔑 Key Points

1. ✅ **Use the correct endpoint**: `/api/recommended-stock/import` (NOT `/api/forecast/model`)
2. ✅ **Use the updated service method**: `forecastService.importRecommendedStock()`
3. ✅ **Match FINAL EXPORT FORMAT**: Must have `recommendations` array
4. ✅ **Admin token required**: Make sure you're using an admin token

## 🐛 Debugging

If you still get errors:

1. **Check the endpoint** in your code:
   ```javascript
   // ❌ Wrong
   '/api/forecast/model'
   
   // ✅ Correct
   '/api/recommended-stock/import'
   ```

2. **Check the JSON format**:
   ```javascript
   // Must have recommendations array
   if (!jsonData.recommendations) {
     console.error('Missing recommendations array!');
   }
   ```

3. **Check authentication**:
   ```javascript
   const token = localStorage.getItem('token');
   console.log('Token:', token ? 'Found' : 'Missing');
   ```

4. **Check response**:
   ```javascript
   const result = await response.json();
   console.log('Response:', result);
   ```

---

**Fix: Update your frontend code to use `/api/recommended-stock/import` instead of `/api/forecast/model`** ✅
