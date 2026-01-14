# Frontend Recommended Stock API Guide

Simple API to import and display recommended stock from Google Colab analysis.

## Base URL

```
http://localhost:5000/api/recommended-stock
```

All endpoints require authentication. Include the JWT token in the Authorization header.

## Quick Start

Admins can import recommended stock from Google Colab, and all users can view recommendations in the inventory.

---

## API Endpoints

### 1. Import Recommended Stock from Colab (Admin Only)

**Endpoint:** `POST /api/recommended-stock/import`

**Request Body:**
```json
{
  "recommendations": [
    {
      "category": "Uniform No 3",
      "type": "Cloth No 3",
      "size": "M",
      "recommendedStock": 50,
      "currentStock": 20,
      "forecastedDemand": 45,
      "reorderQuantity": 30,
      "notes": "High demand expected next month"
    }
  ],
  "overwrite": false
}
```

**Example Request:**
```javascript
// Import recommended stock from Colab JSON file
const importRecommendedStock = async (recommendationsData) => {
  try {
    const response = await fetch(
      'http://localhost:5000/api/recommended-stock/import',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          recommendations: recommendationsData.recommendations,
          overwrite: true  // Replace existing recommendations
        })
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error importing recommendations:', error);
    throw error;
  }
};

// Usage: Import from JSON file uploaded by user
const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const jsonData = JSON.parse(e.target.result);
      const result = await importRecommendedStock(jsonData);
      
      if (result.success) {
        alert(`✅ Successfully imported ${result.imported} recommendations!`);
      } else {
        alert(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      alert('Failed to import recommendations');
    }
  };
  reader.readAsText(file);
};
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully imported 25 recommendations",
  "imported": 25,
  "updatedInventoryItems": 25,
  "recommendations": [...]
}
```

---

### 2. Get All Recommended Stock

**Endpoint:** `GET /api/recommended-stock`

**Query Parameters:**
- `category` (optional) - Filter by category
- `type` (optional) - Filter by type
- `size` (optional) - Filter by size
- `latest` (optional) - Get only latest recommendations (default: `true`)

**Example Request:**
```javascript
const getAllRecommendedStock = async (filters = {}) => {
  const params = new URLSearchParams(filters);

  try {
    const response = await fetch(
      `http://localhost:5000/api/recommended-stock?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    throw error;
  }
};

// Usage
const recommendations = await getAllRecommendedStock({ category: 'Uniform No 3' });
console.log(recommendations.recommendations);
```

**Response:**
```json
{
  "success": true,
  "recommendations": [
    {
      "category": "Uniform No 3",
      "type": "Cloth No 3",
      "size": "M",
      "recommendedStock": 50,
      "currentStock": 20,
      "forecastedDemand": 45,
      "reorderQuantity": 30,
      "analysisDate": "2024-01-15T10:30:00.000Z",
      "source": "google_colab"
    }
  ],
  "count": 25
}
```

---

### 3. Get Recommended Stock for Specific Item

**Endpoint:** `GET /api/recommended-stock/item`

**Query Parameters:**
- `category` (required)
- `type` (required)
- `size` (optional) - Use `null` for accessories

**Example Request:**
```javascript
const getRecommendedStock = async (category, type, size = null) => {
  const params = new URLSearchParams({
    category,
    type,
    ...(size && { size })
  });

  try {
    const response = await fetch(
      `http://localhost:5000/api/recommended-stock/item?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching recommendation:', error);
    throw error;
  }
};

// Usage
const recommendation = await getRecommendedStock('Uniform No 3', 'Cloth No 3', 'M');
console.log(recommendation.recommendation);
```

**Response:**
```json
{
  "success": true,
  "recommendation": {
    "category": "Uniform No 3",
    "type": "Cloth No 3",
    "size": "M",
    "recommendedStock": 50,
    "currentStock": 20,
    "forecastedDemand": 45,
    "reorderQuantity": 30,
    "analysisDate": "2024-01-15T10:30:00.000Z",
    "source": "google_colab"
  },
  "inventory": {
    "currentQuantity": 20,
    "status": "Low Stock",
    "recommendedStock": 50,
    "lastRecommendationDate": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 4. Get Inventory with Recommendations (Most Useful!)

**Endpoint:** `GET /api/recommended-stock/inventory`

Get all inventory items with their recommended stock levels and reorder suggestions.

**Query Parameters:**
- `category` (optional)
- `type` (optional)
- `size` (optional)

**Example Request:**
```javascript
const getInventoryWithRecommendations = async (filters = {}) => {
  const params = new URLSearchParams(
    Object.entries(filters).reduce((acc, [key, value]) => {
      if (value) acc[key] = value;
      return acc;
    }, {})
  );

  try {
    const response = await fetch(
      `http://localhost:5000/api/recommended-stock/inventory?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching inventory with recommendations:', error);
    throw error;
  }
};

// Usage
const inventory = await getInventoryWithRecommendations();
console.log(inventory.items);
```

**Response:**
```json
{
  "success": true,
  "items": [
    {
      "id": "...",
      "name": "Cloth No 3 - M",
      "category": "Uniform No 3",
      "type": "Cloth No 3",
      "size": "M",
      "currentStock": 20,
      "status": "Low Stock",
      "recommendedStock": 50,
      "reorderQuantity": 30,
      "hasRecommendation": true,
      "recommendationDate": "2024-01-15T10:30:00.000Z",
      "forecastedDemand": 45,
      "notes": "High demand expected next month"
    }
  ],
  "count": 50,
  "withRecommendations": 25
}
```

---

## React Component Examples

### Inventory Table with Recommendations

```tsx
import React, { useState, useEffect } from 'react';

const InventoryWithRecommendations = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchInventory = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          'http://localhost:5000/api/recommended-stock/inventory',
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
        const data = await response.json();
        if (data.success) {
          setInventory(data.items);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInventory();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Inventory with Recommended Stock</h2>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Current Stock</th>
            <th>Recommended Stock</th>
            <th>Reorder Qty</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {inventory.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.currentStock}</td>
              <td>
                {item.recommendedStock !== null ? (
                  <strong>{item.recommendedStock}</strong>
                ) : (
                  <span style={{ color: 'gray' }}>No recommendation</span>
                )}
              </td>
              <td>
                {item.reorderQuantity > 0 ? (
                  <span style={{ color: 'red' }}>{item.reorderQuantity}</span>
                ) : (
                  <span style={{ color: 'green' }}>OK</span>
                )}
              </td>
              <td>
                <span
                  style={{
                    color:
                      item.status === 'Out of Stock'
                        ? 'red'
                        : item.status === 'Low Stock'
                        ? 'orange'
                        : 'green'
                  }}
                >
                  {item.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default InventoryWithRecommendations;
```

### Import Recommendations Component (Admin)

```tsx
import React, { useState } from 'react';

const ImportRecommendations = () => {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setMessage('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        
        const response = await fetch(
          'http://localhost:5000/api/recommended-stock/import',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              recommendations: jsonData.recommendations || jsonData,
              overwrite: true
            })
          }
        );

        const data = await response.json();

        if (data.success) {
          setMessage(`✅ Successfully imported ${data.imported} recommendations!`);
        } else {
          setMessage(`❌ Error: ${data.message}`);
        }
      } catch (error) {
        setMessage(`❌ Failed to import: ${error.message}`);
      } finally {
        setUploading(false);
      }
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
      {message && <p>{message}</p>}
    </div>
  );
};

export default ImportRecommendations;
```

---

## TypeScript Service

```typescript
// services/recommendedStockService.ts
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

export const recommendedStockService = {
  // Import recommendations (Admin)
  import: async (recommendations: any[], overwrite = false) => {
    const response = await fetch(`${API_BASE_URL}/api/recommended-stock/import`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ recommendations, overwrite })
    });
    return response.json();
  },

  // Get all recommendations
  getAll: async (filters: any = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(
      `${API_BASE_URL}/api/recommended-stock?${params}`,
      { headers: getAuthHeaders() }
    );
    return response.json();
  },

  // Get recommendation for specific item
  getItem: async (category: string, type: string, size?: string | null) => {
    const params = new URLSearchParams({
      category,
      type,
      ...(size && { size })
    });
    const response = await fetch(
      `${API_BASE_URL}/api/recommended-stock/item?${params}`,
      { headers: getAuthHeaders() }
    );
    return response.json();
  },

  // Get inventory with recommendations
  getInventory: async (filters: any = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(
      `${API_BASE_URL}/api/recommended-stock/inventory?${params}`,
      { headers: getAuthHeaders() }
    );
    return response.json();
  }
};
```

---

## Workflow

1. **Run analysis in Google Colab** → Generate recommended stock
2. **Export from Colab** → Download `recommended_stock.json`
3. **Import to backend** → Admin uploads JSON file via frontend
4. **View recommendations** → All users can see recommended stock in inventory

---

## Notes

- **Admin only**: Import endpoint requires admin role
- **Automatic updates**: Inventory items are automatically updated with recommended stock
- **Display everywhere**: Recommended stock appears in inventory views, forecasts, and reports
- **Latest recommendations**: By default, only latest recommendations are shown (use `latest=false` to see all)

For Colab export instructions, see `COLAB_RECOMMENDED_STOCK_EXPORT.md`
