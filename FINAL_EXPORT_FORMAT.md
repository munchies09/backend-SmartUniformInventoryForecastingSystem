# FINAL EXPORT FORMAT - Recommended Stock System

## ✅ STEP 1: Final Colab Output

**File:** `recommended_stock.json`

This is your ML output contract from Google Colab. **DO NOT CHANGE THIS FORMAT.**

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

### Field Mapping:
- ✔ **category** → grouping in inventory
- ✔ **type** → inventory item match
- ✔ **size** → chart x-axis
- ✔ **recommendedStock** → chart y-axis
- ✔ **forecastedDemand** → optional, stored but not required
- ✔ **analysisDate** → when forecast was generated

---

## 🟢 STEP 2: BACKEND — STORE, NOT CALCULATE

**Backend never trains or predicts. It ONLY stores data from Colab.**

### Database Table: `recommended_stock`

**Minimum columns:**

| column | type | description |
|--------|------|-------------|
| id | ObjectId | Primary key |
| category | String | "Uniform No 3", "Uniform No 4", "T-Shirt" |
| type | String | Item type (e.g., "BAJU NO 3 LELAKI") |
| size | String (nullable) | Size or null for accessories |
| forecasted_demand | Number | From Colab |
| recommended_stock | Number | **Chart Y-axis** |
| analysis_date | Date | When forecast was generated |
| source | String | "google_colab" |
| createdAt | Date | When imported |
| updatedAt | Date | Last update |

**Backend responsibilities:**
- ✅ Store recommendations from Colab
- ✅ Match to inventory items (category + type + size)
- ✅ Delete old records (or version when overwrite=true)
- ❌ Does NOT train models
- ❌ Does NOT predict
- ❌ Does NOT calculate recommended stock

---

## 📌 STEP 3: API ENDPOINTS (SIMPLE)

### 1. Import from Colab

**POST** `/api/recommended-stock/import`

**Request Body:**
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
    }
  ],
  "overwrite": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully imported 42 recommendations",
  "imported": 42,
  "updatedInventoryItems": 42,
  "totalItems": 42,
  "generatedAt": "2026-01-05T10:30:00",
  "source": "google_colab"
}
```

**What it does:**
1. ✅ Deletes old records (if `overwrite: true`)
2. ✅ Saves new recommendations
3. ✅ Matches to inventory items
4. ✅ Updates inventory items with recommended stock

---

### 2. Fetch for Dashboard

**GET** `/api/recommended-stock`

**Query Parameters:**
- `category` (optional) - Filter by category
- `type` (optional) - Filter by type
- `size` (optional) - Filter by size
- `latest` (default: `true`) - Get only latest recommendations

**Response:**
```json
{
  "success": true,
  "recommendations": [
    {
      "id": "...",
      "category": "Uniform No 3",
      "type": "BAJU NO 3 LELAKI",
      "size": "M",
      "forecastedDemand": 38,
      "recommendedStock": 44,
      "analysisDate": "2026-01-05T10:30:00",
      "source": "google_colab"
    },
    {
      "id": "...",
      "category": "Uniform No 3",
      "type": "BAJU NO 3 LELAKI",
      "size": "L",
      "forecastedDemand": 35,
      "recommendedStock": 40,
      "analysisDate": "2026-01-05T10:30:00",
      "source": "google_colab"
    }
  ],
  "count": 42,
  "message": "Frontend: Sort sizes (XXS → 5XL), numeric sort for boots, group by type"
}
```

**What it does:**
1. ✅ Returns sorted data (category, type, size)
2. ✅ Returns only latest recommendations (if `latest=true`)
3. ⚠️ **Frontend handles sorting and grouping**

---

### 3. Get Graph Data

**GET** `/api/recommended-stock/graph?category=Uniform%20No%203&type=BAJU%20NO%203%20LELAKI`

**Response:**
```json
{
  "success": true,
  "category": "Uniform No 3",
  "type": "BAJU NO 3 LELAKI",
  "data": [
    {
      "size": "XS",
      "recommendedStock": 20,
      "forecastedDemand": 18
    },
    {
      "size": "S",
      "recommendedStock": 30,
      "forecastedDemand": 28
    },
    {
      "size": "M",
      "recommendedStock": 44,
      "forecastedDemand": 38
    },
    {
      "size": "L",
      "recommendedStock": 40,
      "forecastedDemand": 35
    },
    {
      "size": "XL",
      "recommendedStock": 25,
      "forecastedDemand": 23
    }
  ],
  "count": 5,
  "message": "Frontend: Sort sizes (XXS → 5XL), numeric sort for boots. X-axis: size, Y-axis: recommendedStock"
}
```

**What it does:**
1. ✅ Returns latest recommendations for category + type
2. ✅ Groups by size automatically
3. ⚠️ **Frontend handles size sorting**

---

## 🟢 STEP 4: FRONTEND — GRAPH LOGIC (IMPORTANT)

**Frontend must handle:**

### 1. Sort Sizes (XXS → 5XL)

```javascript
function sortSizes(sizes) {
  const sizeOrder = {
    'XXS': 1, 'XS': 2, 'S': 3, 'M': 4, 'L': 5,
    'XL': 6, '2XL': 7, '3XL': 8, '4XL': 9, '5XL': 10
  };
  
  return sizes.sort((a, b) => {
    const aOrder = sizeOrder[a.toUpperCase()] || 99;
    const bOrder = sizeOrder[b.toUpperCase()] || 99;
    return aOrder - bOrder;
  });
}
```

### 2. Numeric Sort for Boots

```javascript
function sortNumericSizes(sizes) {
  return sizes.sort((a, b) => {
    const aNum = parseInt(a) || 0;
    const bNum = parseInt(b) || 0;
    return aNum - bNum;
  });
}
```

### 3. Group by Type

```javascript
function groupByType(recommendations) {
  const grouped = {};
  
  recommendations.forEach(rec => {
    const key = `${rec.category} - ${rec.type}`;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(rec);
  });
  
  return grouped;
}
```

### Complete Frontend Example

```javascript
// Get recommendations
const response = await fetch('/api/recommended-stock?category=Uniform%20No%203');
const { recommendations } = await response.json();

// Group by type
const grouped = groupByType(recommendations);

// For each type, create graph
Object.keys(grouped).forEach(typeKey => {
  const items = grouped[typeKey];
  
  // Extract sizes and stocks
  const sizes = items.map(i => i.size || 'N/A');
  const stocks = items.map(i => i.recommendedStock);
  
  // Sort sizes
  const sortedSizes = isNumericType(typeKey) 
    ? sortNumericSizes(sizes)
    : sortSizes(sizes);
  
  // Plot graph
  plotGraph(sortedSizes, stocks); // X-axis: size, Y-axis: recommendedStock
});
```

---

## 🟢 STEP 5: WHEN TO FORECAST AGAIN?

| Situation | Action |
|-----------|--------|
| New semester | Retrain in Colab → Export → Import to backend |
| New intake | Retrain in Colab → Export → Import to backend |
| Large stock change | Retrain in Colab → Export → Import to backend |
| No new data | Keep existing forecast in DB |

**Workflow:**
1. ✅ Run analysis in Google Colab
2. ✅ Export `recommended_stock.json` (FINAL FORMAT)
3. ✅ Import to backend via API
4. ✅ Frontend displays from DB (not Colab)

**Backend never trains or predicts. It only stores.**

---

## 📋 Complete Example Workflow

### 1. Colab Export (Python)

```python
import json
from datetime import datetime

# Your ML analysis results
recommendations = [
    {
        "category": "Uniform No 3",
        "type": "BAJU NO 3 LELAKI",
        "size": "M",
        "forecastedDemand": 38,
        "recommendedStock": 44,
        "analysisDate": datetime.now().isoformat()
    },
    # ... more items
]

# Export in FINAL FORMAT
export_data = {
    "generatedAt": datetime.now().isoformat(),
    "source": "google_colab",
    "totalItems": len(recommendations),
    "recommendations": recommendations
}

with open('recommended_stock.json', 'w') as f:
    json.dump(export_data, f, indent=2, default=str)

from google.colab import files
files.download('recommended_stock.json')
```

### 2. Backend Import (cURL)

```bash
curl -X POST http://localhost:5000/api/recommended-stock/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d @recommended_stock.json
```

### 3. Frontend Display (JavaScript)

```javascript
// Get graph data
const response = await fetch(
  '/api/recommended-stock/graph?category=Uniform%20No%203&type=BAJU%20NO%203%20LELAKI'
);
const { data } = await response.json();

// Sort sizes (XXS → 5XL)
const sortedData = data.sort((a, b) => {
  const sizeOrder = {
    'XXS': 1, 'XS': 2, 'S': 3, 'M': 4, 'L': 5,
    'XL': 6, '2XL': 7, '3XL': 8, '4XL': 9, '5XL': 10
  };
  const aOrder = sizeOrder[a.size?.toUpperCase()] || 99;
  const bOrder = sizeOrder[b.size?.toUpperCase()] || 99;
  return aOrder - bOrder;
});

// Plot graph
const sizes = sortedData.map(d => d.size); // X-axis
const stocks = sortedData.map(d => d.recommendedStock); // Y-axis
plotChart(sizes, stocks);
```

---

## ✅ Key Points

1. **Backend stores, never calculates** ✅
2. **Colab exports FINAL FORMAT** ✅
3. **Frontend handles sorting/grouping** ✅
4. **Simple API: import and fetch** ✅
5. **Realistic inventory planning** ✅

---

## 🐛 Troubleshooting

### Empty Graph After Import

1. Check matching: Look at `matchingResults` in import response
2. Check format: Ensure FINAL FORMAT matches exactly
3. Check inventory: Verify category/type/size exist in inventory

### Size Not Sorting Correctly

- Frontend must handle sorting (XXS → 5XL)
- Use numeric sort for boots
- Backend returns raw data, frontend sorts

---

**This is realistic inventory planning - backend stores, frontend displays!** 🚀
