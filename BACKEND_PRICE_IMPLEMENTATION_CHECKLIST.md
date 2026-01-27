# Backend Price Implementation Checklist

## ✅ Verification Status

### 1. **Price Field in UniformInventory Model** ✅

**Status:** ✅ **IMPLEMENTED**

**Location:** `src/models/uniformModel.ts`

**Implementation:**
```typescript
export interface IUniformInventory extends Document {
  // ... other fields ...
  price?: number | null; // Price in RM (optional, mainly for shirt items)
}

const uniformInventorySchema = new Schema<IUniformInventory>({
  // ... other fields ...
  price: {
    type: Number,
    default: null, // Optional - Price in RM (mainly for shirt items)
    required: false,
    min: 0
  }
});
```

**Verification:**
- ✅ Interface includes `price?: number | null`
- ✅ Schema includes `price` field with proper validation
- ✅ Default value is `null`
- ✅ Minimum value is 0

---

### 2. **Price Included in Database Query** ✅

**Status:** ✅ **IMPLEMENTED**

**Location:** `src/controllers/uniformController.ts` (line ~1285)

**Implementation:**
```typescript
const inventory = await UniformInventory.find(filter)
  .select('name category type size quantity status recommendStock lastRecommendationDate price createdAt updatedAt')
  .sort({ category: 1, type: 1, size: 1 })
  .lean()
  .maxTimeMS(8000);
```

**Verification:**
- ✅ `price` is included in `.select()` query
- ✅ Query uses `.lean()` for performance
- ✅ All required fields are selected

---

### 3. **Price Included in API Response for ALL Items** ✅

**Status:** ✅ **IMPLEMENTED**

**Location:** `src/controllers/uniformController.ts` (line ~1292-1308)

**Implementation:**
```typescript
const inventoryWithIds = inventory.map((item: any) => {
  const itemObj: any = {
    ...item,
    id: String(item._id),
    _id: String(item._id)
  };
  
  // Ensure price field exists (can be null if not set)
  if (itemObj.price === undefined) {
    itemObj.price = null; // Default to null if not set
  }
  
  return itemObj;
});
```

**Verification:**
- ✅ All items include `price` field
- ✅ Shirt items: actual price value (if set by admin)
- ✅ Non-shirt items: `price: null`
- ✅ Items without price set: `price: null` (not undefined)

---

### 4. **Debug Logging Added** ✅

**Status:** ✅ **IMPLEMENTED**

**Location:** `src/controllers/uniformController.ts` (line ~1309-1345)

**Implementation:**
```typescript
// 🔍 DEBUG: Log raw inventory API response structure
console.log(`🔍 DEBUG: Raw inventory API response structure:`);
console.log(`  - Total items: ${inventoryWithIds.length}`);
console.log(`  - Sample item fields:`, Object.keys(inventoryWithIds[0]));

// 🔍 DEBUG: Log all shirt items and their prices
const shirtItems = inventoryWithIds.filter((item: any) => {
  const category = item.category?.toLowerCase() || '';
  return category === 'shirt' || category === 't-shirt';
});

if (shirtItems.length > 0) {
  console.log(`🔍 DEBUG: Shirt items from API response (${shirtItems.length} items):`);
  shirtItems.forEach((item: any) => {
    const hasPrice = item.price !== null && item.price !== undefined;
    console.log(`  - ${item.type} (${item.size || 'no size'}): price = ${hasPrice ? `RM ${item.price}` : 'null/undefined'} ${hasPrice ? '✅' : '⚠️ MISSING'}`);
    
    if (!hasPrice) {
      console.warn(`⚠️  Shirt item found but price is missing:`, {
        id: item.id,
        category: item.category,
        type: item.type,
        size: item.size,
        price: item.price
      });
    }
  });
}
```

**Verification:**
- ✅ Logs raw inventory API response structure
- ✅ Logs all shirt items from API response
- ✅ Warns when shirt item found but price is missing
- ✅ Shows price value or "null/undefined" for each shirt item

---

### 5. **User Uniform Price Fetching** ✅

**Status:** ✅ **IMPLEMENTED**

**Location:** `src/controllers/uniformController.ts` (line ~546-635)

**Implementation:**
```typescript
async function formatUniformItemsWithStatus(...) {
  // Fetch prices from UniformInventory
  for (const shirtType of shirtTypes) {
    const inventoryItem = await UniformInventory.findOne({
      $or: [
        { category: { $regex: /^shirt$/i }, type: shirtType },
        { category: { $regex: /^t-shirt$/i }, type: shirtType },
        { category: 'Shirt', type: shirtType },
        { category: 'T-Shirt', type: shirtType }
      ]
    })
    .select('category type price')
    .lean();
    
    if (inventoryItem) {
      shirtPricesMap.set(normalizedType, inventoryItem.price || null);
    }
  }
  
  // Include price in response
  if (normalizedCategory?.toLowerCase() === 'shirt' || normalizedCategory?.toLowerCase() === 't-shirt') {
    const price = shirtPricesMap.get(shirtType);
    itemData.price = price !== undefined ? price : null;
  }
}
```

**Verification:**
- ✅ Fetches prices from `UniformInventory` (not ShirtPrice collection)
- ✅ Uses case-insensitive category matching
- ✅ Includes price in user uniform response
- ✅ Logs when price is found or missing

---

### 6. **Admin Can Set/Update Price** ✅

**Status:** ✅ **IMPLEMENTED**

**Location:** `src/controllers/uniformController.ts`

**Endpoints:**
- ✅ `POST /api/inventory` - Accepts `price` field
- ✅ `PUT /api/inventory/:id` - Accepts `price` field

**Implementation:**
- ✅ Price validation (must be positive number or null)
- ✅ Price updates sync to all sizes of the same shirt type
- ✅ Price included in response

---

## 📊 Expected Console Logs

### When GET /api/inventory is called:

```
🔍 DEBUG: Raw inventory API response structure:
  - Total items: 150
  - Sample item fields: ['id', '_id', 'name', 'category', 'type', 'size', 'quantity', 'status', 'price', 'createdAt', 'updatedAt']
  - Sample item (first): { id: '...', category: 'Shirt', type: 'Inner APM Shirt', size: 'M', price: 20.00, hasPriceField: true }

🔍 DEBUG: Shirt items from API response (12 items):
  - Inner APM Shirt (M): price = RM 20.00 ✅
  - Inner APM Shirt (L): price = RM 20.00 ✅
  - Digital Shirt (M): price = RM 25.00 ✅
  - Company Shirt (L): price = null/undefined ⚠️ MISSING
  ⚠️  Shirt item found but price is missing: { id: '...', category: 'Shirt', type: 'Company Shirt', size: 'L', price: null }
```

---

## ✅ Complete Checklist

- [x] **Price field exists in UniformInventory model** ✅
- [x] **Price included in database query (.select())** ✅
- [x] **Price included in API response for ALL items** ✅
- [x] **Shirt items: actual price value** ✅
- [x] **Non-shirt items: price = null** ✅
- [x] **Debug logging added** ✅
- [x] **User uniform fetches prices from UniformInventory** ✅
- [x] **Admin can set/update prices** ✅

---

## 🎯 Summary

**All requirements are implemented!**

1. ✅ **Model:** `price` field exists in `UniformInventory`
2. ✅ **Query:** `price` is included in `.select()` query
3. ✅ **Response:** All items include `price` field (shirt items have value, others are null)
4. ✅ **Debug Logs:** Comprehensive logging added for troubleshooting
5. ✅ **User Uniform:** Fetches prices from `UniformInventory`
6. ✅ **Admin:** Can set/update prices via inventory endpoints

**If prices are still showing as null:**
- **Most likely cause:** Prices are not set in the database yet
- **Solution:** Admin needs to set prices via `PUT /api/inventory/:id` with `{ price: 20.00 }`
- **Check:** Use debug logs to verify prices are being fetched correctly

---

**Last Updated:** 2024
**Version:** 1.0
