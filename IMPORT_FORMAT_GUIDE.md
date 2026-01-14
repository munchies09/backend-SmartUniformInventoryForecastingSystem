# Recommended Stock Import Format Guide

## ✅ Supported Import Formats

The backend accepts **three different formats** for importing recommended stock:

### Format 1: Single Object (Recommended)

```json
{
  "category": "Uniform No 3",
  "type": "BAJU NO 3 LELAKI",
  "size": "M",
  "recommendedStock": 42,
  "forecastedDemand": 37
}
```

**POST to:** `POST /api/recommended-stock/import`

### Format 2: Object with Recommendations Array

```json
{
  "recommendations": [
    {
      "category": "Uniform No 3",
      "type": "BAJU NO 3 LELAKI",
      "size": "M",
      "recommendedStock": 42,
      "forecastedDemand": 37
    },
    {
      "category": "Uniform No 3",
      "type": "BAJU NO 3 LELAKI",
      "size": "L",
      "recommendedStock": 38,
      "forecastedDemand": 35
    }
  ],
  "overwrite": true
}
```

### Format 3: Direct Array

```json
[
  {
    "category": "Uniform No 3",
    "type": "BAJU NO 3 LELAKI",
    "size": "M",
    "recommendedStock": 42,
    "forecastedDemand": 37
  },
  {
    "category": "Uniform No 3",
    "type": "BAJU NO 3 LELAKI",
    "size": "L",
    "recommendedStock": 38,
    "forecastedDemand": 35
  }
]
```

---

## 📋 Required Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `category` | string | ✅ Yes | Must be exactly: `"Uniform No 3"`, `"Uniform No 4"`, or `"T-Shirt"` |
| `type` | string | ✅ Yes | Item type (e.g., `"BAJU NO 3 LELAKI"`, `"Cloth No 3"`) |
| `size` | string \| null | Optional | Size string (e.g., `"M"`, `"L"`, `"XL"`) or `null` for accessories |
| `recommendedStock` | number | ✅ Yes | Recommended stock level (must be ≥ 0) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `forecastedDemand` | number | Forecasted demand from Colab |
| `currentStock` | number | Current stock at time of analysis (defaults to 0) |
| `reorderQuantity` | number | How many units to reorder |
| `notes` | string | Any additional notes |
| `analysisDate` | string | ISO date string (defaults to current date) |

---

## 🔍 Matching Rules (IMPORTANT!)

The backend **automatically matches** your Colab data to inventory items using flexible matching:

### ✅ Category Matching
- Must match exactly (case-insensitive)
- `"Uniform No 3"` ✅
- `"uniform no 3"` ✅ (auto-normalized)

### ✅ Type Matching (Flexible)
The system handles variations:
- `"BAJU NO 3 LELAKI"` matches `"Baju No 3 Lelaki"` ✅
- `"BAJU NO 3 LELAKI"` matches `"BAJU NO. 3 LELAKI"` ✅
- Partial matches work too (if one contains the other)

### ✅ Size Matching (Flexible)
Handles common mismatches:
- `"XL"` matches `"X L"` ✅ (spaces removed)
- `"XL"` matches `"xl"` ✅ (case-insensitive)
- `"M"` matches `"M "` ✅ (whitespace trimmed)
- `null` matches `null` ✅ (for accessories)

### ⚠️ Common Mismatch Issues

If your graph is **empty** after import, check:

1. **Size mismatch:**
   - ❌ `"XL"` vs `"X L"` → ✅ **Fixed automatically**
   - ❌ `"XL"` vs `"X-L"` → Check your data

2. **Type name mismatch:**
   - ❌ `"BAJU NO 3 LELAKI"` vs `"BAJU NO 3"` → ✅ **Partial match works**
   - ❌ `"Baju No 3"` vs `"BAJU NO 3"` → ✅ **Case-insensitive**

3. **Category mismatch:**
   - ❌ `"Uniform No. 3"` vs `"Uniform No 3"` → Check exact format

---

## 📊 Response Format

### Success Response

```json
{
  "success": true,
  "message": "Successfully imported 25 recommendations",
  "imported": 25,
  "updatedInventoryItems": 25,
  "warnings": [
    "Recommendation 5: Size normalized \"XL\" → \"X L\""
  ],
  "matchingResults": [
    {
      "index": 1,
      "input": {
        "category": "Uniform No 3",
        "type": "BAJU NO 3 LELAKI",
        "size": "M"
      },
      "matched": true,
      "matchType": "exact",
      "inventoryItem": {
        "category": "Uniform No 3",
        "type": "BAJU NO 3 LELAKI",
        "size": "M",
        "currentQuantity": 20
      }
    }
  ],
  "recommendations": [...]
}
```

### Error Response

```json
{
  "success": false,
  "message": "Validation errors",
  "errors": [
    "Recommendation 1: category, type, and recommendedStock are required"
  ],
  "warnings": [...],
  "matchingResults": [...]
}
```

---

## 📈 Get Graph Data (KEY FIX!)

**Don't wait for live ML predictions!** Use this endpoint:

**GET:** `/api/recommended-stock/graph?category=Uniform%20No%203&type=BAJU%20NO%203%20LELAKI`

**Response:**
```json
{
  "success": true,
  "category": "Uniform No 3",
  "type": "BAJU NO 3 LELAKI",
  "data": [
    {
      "size": null,
      "recommendedStock": 30,
      "currentStock": 10,
      "forecastedDemand": 28
    },
    {
      "size": "XS",
      "recommendedStock": 15,
      "currentStock": 5,
      "forecastedDemand": 14
    },
    {
      "size": "S",
      "recommendedStock": 20,
      "currentStock": 8,
      "forecastedDemand": 18
    },
    {
      "size": "M",
      "recommendedStock": 42,
      "currentStock": 20,
      "forecastedDemand": 37
    },
    {
      "size": "L",
      "recommendedStock": 38,
      "currentStock": 15,
      "forecastedDemand": 35
    },
    {
      "size": "XL",
      "recommendedStock": 25,
      "currentStock": 12,
      "forecastedDemand": 23
    }
  ],
  "count": 6,
  "message": "Ready to plot: X-axis (size) vs Y-axis (recommendedStock)"
}
```

**Plot:**
- **X-axis**: `size` (already sorted: null, XS, S, M, L, XL, ...)
- **Y-axis**: `recommendedStock`

**Your graph is now NOT EMPTY!** ✅

---

## 🔧 Example: cURL Import

```bash
# Single object
curl -X POST http://localhost:5000/api/recommended-stock/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "category": "Uniform No 3",
    "type": "BAJU NO 3 LELAKI",
    "size": "M",
    "recommendedStock": 42,
    "forecastedDemand": 37
  }'

# Multiple items (array)
curl -X POST http://localhost:5000/api/recommended-stock/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '[
    {
      "category": "Uniform No 3",
      "type": "BAJU NO 3 LELAKI",
      "size": "M",
      "recommendedStock": 42,
      "forecastedDemand": 37
    },
    {
      "category": "Uniform No 3",
      "type": "BAJU NO 3 LELAKI",
      "size": "L",
      "recommendedStock": 38,
      "forecastedDemand": 35
    }
  ]'
```

---

## 📱 Frontend Example

```javascript
// Import single recommendation
const importSingle = async () => {
  const response = await fetch(
    'http://localhost:5000/api/recommended-stock/import',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        category: 'Uniform No 3',
        type: 'BAJU NO 3 LELAKI',
        size: 'M',
        recommendedStock: 42,
        forecastedDemand: 37
      })
    }
  );
  
  const result = await response.json();
  console.log(result);
};

// Get graph data for visualization
const getGraphData = async (category, type) => {
  const response = await fetch(
    `http://localhost:5000/api/recommended-stock/graph?category=${encodeURIComponent(category)}&type=${encodeURIComponent(type)}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  const result = await response.json();
  if (result.success) {
    // Plot graph: X-axis = size, Y-axis = recommendedStock
    const sizes = result.data.map(d => d.size || 'N/A');
    const stocks = result.data.map(d => d.recommendedStock);
    
    // Use your charting library (Chart.js, D3, etc.)
    plotGraph(sizes, stocks);
  }
};
```

---

## ✅ Checklist Before Import

- [ ] Category matches exactly: `"Uniform No 3"`, `"Uniform No 4"`, or `"T-Shirt"`
- [ ] Type name is correct (flexible matching handles variations)
- [ ] Size format matches (spaces handled automatically)
- [ ] `recommendedStock` is a number ≥ 0
- [ ] All required fields are present

---

## 🐛 Troubleshooting

### Empty Graph After Import

1. **Check matching results:**
   ```bash
   # Look at the `matchingResults` in the import response
   # Check if items were matched correctly
   ```

2. **Check available inventory:**
   ```bash
   GET /api/inventory
   # Verify category/type/size exist in inventory
   ```

3. **Check warnings:**
   ```bash
   # Import response includes warnings about mismatches
   ```

### "No matching inventory item found"

- Verify the item exists in inventory first
- Check category/type/size spelling
- Use flexible matching (system handles variations)

---

## 📝 Notes

- **Backend stores recommendations in DB** ✅
- **Frontend reads from DB** ✅ (NOT from Colab)
- **Flexible matching** handles common mismatches ✅
- **Graph data is sorted by size** automatically ✅
- **No live ML required** for graph display ✅

For more details, see:
- `COLAB_RECOMMENDED_STOCK_EXPORT.md` - How to export from Colab
- `FRONTEND_RECOMMENDED_STOCK_API.md` - Frontend integration
