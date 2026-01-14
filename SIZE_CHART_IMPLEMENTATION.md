# Size Chart Feature - Backend Implementation Complete ✅

## Summary

The backend has been updated to support size chart images for inventory items. Size charts are associated with item types (category + type combination) and are shared across all sizes of the same type.

---

## ✅ Changes Implemented

### 1. Database Schema Updates

**File:** `src/models/uniformModel.ts`

- ✅ Added `sizeChart?: string | null` to `IUniformInventory` interface
- ✅ Added `sizeChart` field to `uniformInventorySchema` (optional, nullable)

**Schema:**
```typescript
sizeChart: {
  type: String,
  default: null, // Optional - URL or path to size chart image
  required: false
}
```

---

### 2. API Endpoint Updates

#### ✅ GET /api/inventory

**File:** `src/controllers/uniformController.ts` - `getUniforms()`

**Changes:**
- Returns `sizeChart` field in response for each inventory item
- Builds a map of size charts by category-type for efficient lookup
- All items of the same type share the same `sizeChart` value

**Response Format:**
```json
{
  "success": true,
  "inventory": [
    {
      "id": "...",
      "category": "Uniform No 3",
      "type": "Uniform No 3 Male",
      "size": "M",
      "quantity": 10,
      "sizeChart": "/size-charts/uniform-no-3-male.png",
      ...
    }
  ]
}
```

---

#### ✅ POST /api/inventory

**File:** `src/controllers/uniformController.ts` - `addUniform()`

**Changes:**
- Accepts `sizeChart` in request body (optional)
- If `sizeChart` is provided, stores it with the new item
- If `sizeChart` is not provided, inherits from existing items of the same type
- If `sizeChart` is provided and different from existing, updates all items of that type for consistency
- Returns `sizeChart` in response

**Request Body:**
```json
{
  "category": "Uniform No 3",
  "type": "Uniform No 3 Male",
  "size": "XL",
  "quantity": 20,
  "sizeChart": "/size-charts/uniform-no-3-male.png"  // Optional
}
```

**Behavior:**
- When creating a new size for an existing type, inherits `sizeChart` from other items of that type
- When providing a new `sizeChart`, updates all items of that type to maintain consistency

---

#### ✅ PUT /api/inventory/:id

**File:** `src/controllers/uniformController.ts` - `updateUniform()`

**Changes:**
- Accepts `sizeChart` in request body (optional)
- Updates the specific item's `sizeChart`
- When `sizeChart` is updated, automatically updates all items of the same type (category + type) for consistency
- Returns `sizeChart` in response

**Request Body:**
```json
{
  "quantity": 15,
  "sizeChart": "/size-charts/uniform-no-3-male-updated.png"  // Optional
}
```

**Behavior:**
- Updating `sizeChart` for one item updates all items of that type
- This ensures consistency across all sizes of the same type

---

#### ✅ GET /api/inventory/size-charts (NEW ENDPOINT)

**File:** `src/controllers/uniformController.ts` - `getSizeCharts()`

**Purpose:** Returns all available size charts grouped by category and type

**Response Format:**
```json
{
  "success": true,
  "sizeCharts": {
    "Uniform No 3-Uniform No 3 Male": "/size-charts/uniform-no-3-male.png",
    "Uniform No 3-Uniform No 3 Female": "/size-charts/uniform-no-3-female.png",
    "Uniform No 3-PVC Shoes": "/size-charts/pvc-shoes.png",
    "Uniform No 4-Boot": "/size-charts/boot.png"
  },
  "sizeChartsArray": [
    {
      "category": "Uniform No 3",
      "type": "Uniform No 3 Male",
      "sizeChart": "/size-charts/uniform-no-3-male.png"
    },
    ...
  ]
}
```

**Access:** Requires authentication (both members and admins can access)

---

### 3. Route Updates

**File:** `src/routes/uniformRoutes.ts`

- ✅ Added `getSizeCharts` import
- ✅ Added route: `GET /api/inventory/size-charts` (authenticated)

---

## 📋 API Endpoints Summary

| Endpoint | Method | Changes | Status |
|----------|--------|---------|--------|
| `/api/inventory` | GET | Returns `sizeChart` field | ✅ **IMPLEMENTED** |
| `/api/inventory` | POST | Accepts `sizeChart` in body | ✅ **IMPLEMENTED** |
| `/api/inventory/:id` | PUT | Accepts `sizeChart` in body | ✅ **IMPLEMENTED** |
| `/api/inventory/size-charts` | GET | New endpoint for size charts | ✅ **IMPLEMENTED** |

---

## 🔄 Size Chart Consistency Logic

### How It Works

1. **When Creating New Item:**
   - If `sizeChart` is provided → Store it and update all items of that type
   - If `sizeChart` is not provided → Inherit from existing items of that type (if any)

2. **When Updating Item:**
   - If `sizeChart` is updated → Update all items of that type to maintain consistency

3. **Result:**
   - All sizes of the same type (e.g., "Uniform No 3 Male" - XS, S, M, L, XL) share the same `sizeChart` URL

### Example

```
Before:
- Uniform No 3 Male (M) → sizeChart: null
- Uniform No 3 Male (L) → sizeChart: null

After creating Uniform No 3 Male (XL) with sizeChart: "/charts/uniform-no-3-male.png":
- Uniform No 3 Male (M) → sizeChart: "/charts/uniform-no-3-male.png" ✅
- Uniform No 3 Male (L) → sizeChart: "/charts/uniform-no-3-male.png" ✅
- Uniform No 3 Male (XL) → sizeChart: "/charts/uniform-no-3-male.png" ✅
```

---

## 📝 Example API Usage

### 1. Get All Inventory (with Size Charts)

```http
GET /api/inventory
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "inventory": [
    {
      "id": "507f1f77bcf86cd799439011",
      "category": "Uniform No 3",
      "type": "Uniform No 3 Male",
      "size": "M",
      "quantity": 10,
      "sizeChart": "/size-charts/uniform-no-3-male.png",
      "status": "In Stock"
    }
  ]
}
```

### 2. Create Item with Size Chart

```http
POST /api/inventory
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "category": "Uniform No 3",
  "type": "Uniform No 3 Male",
  "size": "XL",
  "quantity": 20,
  "sizeChart": "/size-charts/uniform-no-3-male.png"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Inventory item created successfully",
  "item": {
    "id": "507f1f77bcf86cd799439014",
    "category": "Uniform No 3",
    "type": "Uniform No 3 Male",
    "size": "XL",
    "quantity": 20,
    "sizeChart": "/size-charts/uniform-no-3-male.png"
  }
}
```

### 3. Update Size Chart

```http
PUT /api/inventory/507f1f77bcf86cd799439011
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "quantity": 15,
  "sizeChart": "/size-charts/uniform-no-3-male-v2.png"
}
```

**Result:** All "Uniform No 3 Male" items (all sizes) will have their `sizeChart` updated to the new URL.

### 4. Get All Size Charts

```http
GET /api/inventory/size-charts
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "sizeCharts": {
    "Uniform No 3-Uniform No 3 Male": "/size-charts/uniform-no-3-male.png",
    "Uniform No 3-Uniform No 3 Female": "/size-charts/uniform-no-3-female.png",
    "Uniform No 4-Boot": "/size-charts/boot.png"
  },
  "sizeChartsArray": [
    {
      "category": "Uniform No 3",
      "type": "Uniform No 3 Male",
      "sizeChart": "/size-charts/uniform-no-3-male.png"
    }
  ]
}
```

---

## 🧪 Testing Checklist

- [x] Database schema updated with `sizeChart` field
- [x] GET /api/inventory returns `sizeChart` field
- [x] POST /api/inventory accepts `sizeChart` in request
- [x] PUT /api/inventory/:id accepts `sizeChart` in request
- [x] GET /api/inventory/size-charts endpoint created
- [x] Size chart consistency maintained across same type
- [x] Size chart inheritance from existing items works
- [x] All endpoints return `sizeChart` in response

---

## 🔮 Future Enhancements (Optional)

### File Upload Endpoint (Not Implemented)

If you want to add file upload functionality later, you can create:

**POST /api/inventory/upload-size-chart**

This would:
1. Accept multipart/form-data with file upload
2. Accept `category` and `type` as form fields
3. Save uploaded image to `/public/size-charts/` directory
4. Update all items of that type with the new size chart URL
5. Return the URL/path to the uploaded image

**Implementation would require:**
- `multer` or similar file upload middleware
- File storage configuration
- Static file serving setup

**Current Status:** Not implemented (size charts can be set via API with URLs/paths)

---

## 📊 Database Migration

**No migration script needed** - The `sizeChart` field is optional and defaults to `null`. Existing documents will work without issues.

However, if you want to ensure all documents have the field explicitly set:

```javascript
// Optional: Run in MongoDB shell
db.uniforminventories.updateMany(
  { sizeChart: { $exists: false } },
  { $set: { sizeChart: null } }
);
```

---

## ✅ Implementation Status

**All Required Features: ✅ COMPLETE**

1. ✅ Database schema updated
2. ✅ GET /api/inventory returns sizeChart
3. ✅ POST /api/inventory accepts sizeChart
4. ✅ PUT /api/inventory/:id accepts sizeChart
5. ✅ GET /api/inventory/size-charts endpoint created
6. ✅ Size chart consistency logic implemented
7. ✅ All responses include sizeChart field

**Optional Features:**
- ⚪ File upload endpoint (not implemented - can be added later if needed)

---

## 🎯 Frontend Integration

The frontend can now:

1. **Fetch size charts from inventory:**
   ```typescript
   const response = await fetch('/api/inventory', {
     headers: { 'Authorization': `Bearer ${token}` }
   });
   const data = await response.json();
   // Extract sizeChart from inventory items
   ```

2. **Fetch all size charts at once:**
   ```typescript
   const response = await fetch('/api/inventory/size-charts', {
     headers: { 'Authorization': `Bearer ${token}` }
   });
   const data = await response.json();
   // Use data.sizeCharts or data.sizeChartsArray
   ```

3. **Set size chart when creating/updating items:**
   ```typescript
   await fetch('/api/inventory', {
     method: 'POST',
     body: JSON.stringify({
       category: 'Uniform No 3',
       type: 'Uniform No 3 Male',
       size: 'M',
       quantity: 10,
       sizeChart: '/size-charts/uniform-no-3-male.png'
     })
   });
   ```

---

## 📝 Notes

- **Size Chart Format:** Can be a relative path (e.g., `/size-charts/uniform-no-3-male.png`) or full URL
- **Consistency:** All sizes of the same type share the same `sizeChart` URL
- **Optional Field:** `sizeChart` is optional - items without size charts return `null`
- **Access Control:** Size chart endpoints require authentication (same as inventory endpoints)

---

## 🚀 Next Steps

1. ✅ Backend implementation complete
2. ⏭️ Frontend can now use the size chart data
3. ⏭️ Admin can set size charts via API or admin panel
4. ⏭️ (Optional) Implement file upload endpoint if needed

---

**Status: ✅ READY FOR FRONTEND INTEGRATION**
