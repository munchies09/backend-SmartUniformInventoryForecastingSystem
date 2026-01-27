# Shirt Price Stored in Inventory - Complete Fix

## 🎯 Overview

**Option 2 Selected:** Admin can set price at shirt inventory (in `UniformInventory` model), and the price will be fetched by user uniform.

**Key Changes:**
1. ✅ Added `price` field to `UniformInventory` model
2. ✅ Updated `GET /api/inventory` to include price field (fetched directly from UniformInventory)
3. ✅ Updated `formatUniformItemsWithStatus` to fetch prices from UniformInventory
4. ✅ Updated `addUniform` and `updateUniform` to accept and save price field
5. ✅ When price is updated, all sizes of the same shirt type are updated (like image/sizeChart)

---

## ✅ Fixes Applied

### 1. **Added Price Field to UniformInventory Model**

**Location:** `src/models/uniformModel.ts` (line ~17, ~93)

**Changes:**
```typescript
export interface IUniformInventory extends Document {
  // ... existing fields ...
  price?: number | null; // Price in RM (optional, mainly for shirt items)
}

const uniformInventorySchema = new Schema<IUniformInventory>({
  // ... existing fields ...
  price: {
    type: Number,
    default: null, // Optional - Price in RM (mainly for shirt items)
    required: false,
    min: 0
  }
});
```

**Result:** `UniformInventory` model now supports `price` field ✅

---

### 2. **Updated GET /api/inventory Endpoint**

**Location:** `src/controllers/uniformController.ts` (line ~1245)

**Changes:**
- ✅ Include `price` in `.select()` query
- ✅ Price is automatically included in response (no need to fetch from ShirtPrice)
- ✅ For shirt items: price comes from `UniformInventory.price`
- ✅ For non-shirt items: price is `null`

**Result:** Inventory API response includes `price` field for all items ✅

---

### 3. **Updated formatUniformItemsWithStatus Function**

**Location:** `src/controllers/uniformController.ts` (line ~546)

**Changes:**
- ✅ Fetches prices from `UniformInventory` (not from ShirtPrice collection)
- ✅ For each shirt type, finds one inventory item and gets its price
- ✅ Price is included in user uniform response

**Result:** User uniform response includes prices for shirt items ✅

---

### 4. **Updated addUniform Endpoint**

**Location:** `src/controllers/uniformController.ts` (line ~1345)

**Changes:**
- ✅ Accepts `price` field in request body
- ✅ Validates price (must be positive number or null)
- ✅ If price not provided, gets price from existing items of same type
- ✅ When price is set for a shirt type, updates all sizes of that type
- ✅ Includes `price` in response

**Result:** Admin can set price when creating inventory items ✅

---

### 5. **Updated updateUniform Endpoint**

**Location:** `src/controllers/uniformController.ts` (line ~1860)

**Changes:**
- ✅ Accepts `price` field in request body
- ✅ Validates price (must be positive number or null)
- ✅ When price is updated for a shirt item, updates all sizes of that type (like image/sizeChart)
- ✅ Includes `price` in `.select()` query
- ✅ Includes `price` in response

**Result:** Admin can update price, and it syncs to all sizes of the same shirt type ✅

---

## 🔍 How It Works Now

### Scenario 1: Admin Sets Price in Inventory

**Process:**

1. **Admin sets price via `PUT /api/inventory/:id`:**
   ```json
   {
     "price": 20.00
   }
   ```

2. **Backend updates:**
   - Updates the specific inventory item
   - If it's a shirt item, updates all sizes of that type (same as image/sizeChart)
   - Price is saved in `UniformInventory.price`

3. **Response includes price:**
   ```json
   {
     "id": "...",
     "category": "Shirt",
     "type": "Inner APM Shirt",
     "size": "M",
     "quantity": 50,
     "price": 20.00  // ✅ Price included
   }
   ```

---

### Scenario 2: User Views Their Uniform

**Process:**

1. **User calls `GET /api/members/uniform`**
2. **Backend fetches:**
   - User uniform from `MemberUniform`
   - For shirt items, fetches prices from `UniformInventory`
3. **Response includes price:**
   ```json
   {
     "success": true,
     "uniform": {
       "items": [
         {
           "category": "Shirt",
           "type": "Inner APM Shirt",
           "size": "M",
           "quantity": 1,
           "status": "Available",
           "price": 20.00  // ✅ Price from UniformInventory
         }
       ]
     }
   }
   ```

---

## 📊 API Response Formats

### GET /api/inventory

**Response:**
```json
{
  "success": true,
  "inventory": [
    {
      "id": "...",
      "category": "Shirt",
      "type": "Inner APM Shirt",
      "size": "M",
      "quantity": 50,
      "price": 20.00  // ✅ Price included (from UniformInventory)
    },
    {
      "id": "...",
      "category": "Uniform No 3",
      "type": "Uniform No 3 Male",
      "size": "L",
      "quantity": 10,
      "price": null  // ✅ Price is null for non-shirt items
    }
  ]
}
```

### GET /api/members/uniform

**Response:**
```json
{
  "success": true,
  "uniform": {
    "items": [
      {
        "category": "Shirt",
        "type": "Inner APM Shirt",
        "size": "M",
        "quantity": 1,
        "status": "Available",
        "price": 20.00  // ✅ Price included (fetched from UniformInventory)
      }
    ]
  }
}
```

---

## 🔧 Admin Endpoints

### PUT /api/inventory/:id

**Request:**
```json
{
  "price": 20.00
}
```

**Response:**
```json
{
  "success": true,
  "message": "Inventory item updated successfully",
  "item": {
    "id": "...",
    "category": "Shirt",
    "type": "Inner APM Shirt",
    "size": "M",
    "quantity": 50,
    "price": 20.00  // ✅ Updated price included
  }
}
```

**Behavior:**
- ✅ Updates the specific inventory item
- ✅ If shirt item: Updates all sizes of that type (same as image/sizeChart)
- ✅ Price is stored in `UniformInventory.price`

---

### POST /api/inventory

**Request:**
```json
{
  "category": "Shirt",
  "type": "Inner APM Shirt",
  "size": "M",
  "quantity": 50,
  "price": 20.00
}
```

**Response:**
```json
{
  "success": true,
  "message": "Inventory item created successfully",
  "item": {
    "id": "...",
    "category": "Shirt",
    "type": "Inner APM Shirt",
    "size": "M",
    "quantity": 50,
    "price": 20.00  // ✅ Price included
  }
}
```

**Behavior:**
- ✅ Creates new inventory item with price
- ✅ If price not provided, gets price from existing items of same type
- ✅ Price is stored in `UniformInventory.price`

---

## 🧪 Testing Scenarios

### Test Case 1: Admin Sets Price for Inner APM Shirt

**Setup:**
- Inventory: Inner APM Shirt (M) - no price set

**Action:**
- Admin calls `PUT /api/inventory/:id` with `{ price: 20.00 }`

**Expected:**
- ✅ Inner APM Shirt (M): `price = 20.00`
- ✅ All other sizes of Inner APM Shirt: `price = 20.00` (updated automatically)
- ✅ GET /api/inventory: Includes `price: 20.00` for all Inner APM Shirt items
- ✅ GET /api/members/uniform: Includes `price: 20.00` for user's Inner APM Shirt

---

### Test Case 2: User Views Uniform with Shirt

**Setup:**
- Inventory: Inner APM Shirt (M) - `price = 20.00`
- User uniform: Inner APM Shirt (M)

**Action:**
- User calls `GET /api/members/uniform`

**Expected:**
- ✅ Response includes `price: 20.00` for Inner APM Shirt
- ✅ Frontend can display "RM 20.00"

---

### Test Case 3: Admin Creates New Shirt Size with Price

**Setup:**
- Inventory: Inner APM Shirt (M) - `price = 20.00`
- Creating: Inner APM Shirt (L)

**Action:**
- Admin calls `POST /api/inventory` with Inner APM Shirt (L) (price not provided)

**Expected:**
- ✅ New item created with `price = 20.00` (inherited from existing items)
- ✅ All sizes of Inner APM Shirt share the same price

---

## ✅ Verification Checklist

After implementing all fixes:

- [ ] `UniformInventory` model has `price` field ✅
- [ ] `GET /api/inventory` includes `price` in response ✅
- [ ] `formatUniformItemsWithStatus` fetches prices from UniformInventory ✅
- [ ] `addUniform` accepts and saves `price` field ✅
- [ ] `updateUniform` accepts and saves `price` field ✅
- [ ] Price updates sync to all sizes of the same shirt type ✅
- [ ] GET /api/members/uniform includes `price` for shirt items ✅
- [ ] Non-shirt items have `price: null` ✅

---

## 🎯 Summary

**All Fixes Applied:**
1. ✅ Added `price` field to `UniformInventory` model
2. ✅ Inventory API includes `price` field (from UniformInventory)
3. ✅ User uniform fetches prices from UniformInventory
4. ✅ Admin can set/update prices via inventory endpoints
5. ✅ Price updates sync to all sizes of the same shirt type

**Result:**
- ✅ Admin can set price at shirt inventory (UniformInventory)
- ✅ Price is stored directly in UniformInventory
- ✅ User uniform fetches price from UniformInventory
- ✅ All sizes of the same shirt type share the same price (like image/sizeChart)
- ✅ Frontend can display prices from inventory API or user uniform API

**Shirt prices now work exactly as requested!**

---

**Last Updated:** 2024
**Version:** 1.0
