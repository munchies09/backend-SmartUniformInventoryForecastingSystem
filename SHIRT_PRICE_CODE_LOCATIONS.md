# Shirt Price Code Locations

## 📍 All Locations Where Shirt Price Code Exists

---

## 1. **Model Definition** ✅

### File: `src/models/uniformModel.ts`

**Line 28:** Interface definition
```typescript
export interface IUniformInventory extends Document {
  // ... other fields ...
  price?: number | null; // Price in RM (optional, mainly for shirt items)
}
```

**Line 94-98:** Schema definition
```typescript
price: {
  type: Number,
  default: null, // Optional - Price in RM (mainly for shirt items)
  required: false,
  min: 0
}
```

---

## 2. **User Uniform Price Fetching** ✅

### File: `src/controllers/uniformController.ts`

**Function:** `formatUniformItemsWithStatus`
**Lines:** 546-645

**What it does:**
- Fetches prices from `UniformInventory` for shirt items
- Includes price in user uniform response
- Used by: `getOwnUniform`, `getMemberUniform`, `getMemberUniformBySispaId`

**Key Code:**
```typescript
// Lines 567-592: Fetch prices from UniformInventory
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

// Lines 632-645: Include price in response
if (normalizedCategory?.toLowerCase() === 'shirt' || normalizedCategory?.toLowerCase() === 't-shirt') {
  const price = shirtPricesMap.get(shirtType);
  itemData.price = price !== undefined ? price : null;
}
```

---

## 3. **Admin Inventory API (GET /api/inventory)** ✅

### File: `src/controllers/uniformController.ts`

**Function:** `getUniforms`
**Lines:** 1271-1410

**What it does:**
- Returns all inventory items with `price` field included
- Ensures `price` field exists on ALL items (null for non-shirt items)

**Key Code:**
```typescript
// Line 1286: Include price in database query
.select('name category type size quantity status recommendedStock lastRecommendationDate price createdAt updatedAt')

// Lines 1304-1324: Ensure price field exists in response
const inventoryWithIds = inventory.map((item: any) => {
  const itemObj: any = { ...item, id: String(item._id), _id: String(item._id) };
  
  // CRITICAL: ALWAYS ensure price field exists
  if (!('price' in itemObj) || itemObj.price === undefined) {
    itemObj.price = null;
  }
  
  return itemObj;
});

// Lines 1372-1384: Final verification before sending
const verifiedInventory = inventoryWithIds.map((item: any) => {
  if (!('price' in item)) {
    item.price = null;
  }
  if (item.price === undefined) {
    item.price = null;
  }
  return item;
});
```

---

## 4. **Create Inventory Item (POST /api/inventory)** ✅

### File: `src/controllers/uniformController.ts`

**Function:** `addUniform`
**Lines:** 1345-1950 (price handling at lines 1507-1523, 1808-1823, 1873-1890)

**What it does:**
- Accepts `price` field in request body
- Validates price (must be positive number or null)
- Inherits price from existing items of same type if not provided
- Updates all sizes of same shirt type when price is set

**Key Code:**
```typescript
// Line 1347: Accept price in request
const { id, name, category, type, size, quantity, image, sizeChart, price } = req.body;

// Lines 1507-1523: Validate price
if (price !== undefined && price !== null) {
  if (typeof price !== 'number' || price < 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'Price must be a positive number or null to unset' 
    });
  }
}

// Lines 1808-1823: Get price from existing items if not provided
let finalPrice = price !== undefined ? (price === null || price === '' ? null : price) : null;
if (!finalPrice) {
  const existingTypeItemForPrice = await UniformInventory.findOne({...});
  if (existingTypeItemForPrice && existingTypeItemForPrice.price !== undefined && existingTypeItemForPrice.price !== null) {
    finalPrice = existingTypeItemForPrice.price;
  }
}

// Line 1835: Include price when creating item
const newInventory = new UniformInventory({
  // ... other fields ...
  price: finalPrice
});

// Lines 1873-1890: Update all sizes when price is set
if (price !== undefined) {
  const priceValue = price === null || price === '' ? null : price;
  const finalPriceValue = finalPrice === null || finalPrice === undefined ? null : finalPrice;
  if (priceValue !== finalPriceValue) {
    if (itemCategory === 'shirt' || itemCategory === 't-shirt') {
      await UniformInventory.updateMany({...}, { $set: { price: priceValue } });
    }
  }
}
```

---

## 5. **Update Inventory Item (PUT /api/inventory/:id)** ✅

### File: `src/controllers/uniformController.ts`

**Function:** `updateUniform`
**Lines:** 1860-2222 (price handling at lines 1913-1920, 2018-2035, 2170-2185)

**What it does:**
- Accepts `price` field in request body
- Validates price
- Updates all sizes of same shirt type when price is updated

**Key Code:**
```typescript
// Line 1863: Accept price in request
const { quantity, category, type, size, image, sizeChart, price } = req.body;

// Lines 1913-1920: Validate and update price
if (price !== undefined) {
  if (price !== null && (typeof price !== 'number' || price < 0)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Price must be a positive number or null to unset' 
    });
  }
  updateData.price = price === null || price === '' ? null : price;
}

// Line 1963: Include price in select query
.select('name category type size quantity status recommendedStock lastRecommendationDate image sizeChart price createdAt updatedAt')

// Lines 2018-2035: Update all sizes when price is updated
if (price !== undefined && updated) {
  const itemCategory = updated.category?.toLowerCase() || '';
  if (itemCategory === 'shirt' || itemCategory === 't-shirt') {
    const priceValue = price === null || price === '' ? null : price;
    await UniformInventory.updateMany({...}, { $set: { price: priceValue } });
  }
}

// Lines 2170-2185: Update price in update-by-attributes path
if (price !== undefined) {
  const itemCategory = item.category?.toLowerCase() || '';
  if (itemCategory === 'shirt' || itemCategory === 't-shirt') {
    item.price = priceValue;
    await UniformInventory.updateMany({...}, { $set: { price: priceValue } });
  }
}
```

---

## 6. **Update Existing Item (in addUniform)** ✅

### File: `src/controllers/uniformController.ts`

**Function:** `addUniform` (update existing item path)
**Lines:** 1708-1720

**What it does:**
- Updates price when updating existing inventory item
- Gets price from existing items of same type if not provided

**Key Code:**
```typescript
// Lines 1708-1720: Update price for existing item
if (price !== undefined) {
  updateData.price = price === null || price === '' ? null : price;
} else if (existingItem.price === undefined || existingItem.price === null) {
  const existingTypeItemForPrice = await UniformInventory.findOne({...});
  if (existingTypeItemForPrice && existingTypeItemForPrice.price !== undefined && existingTypeItemForPrice.price !== null) {
    updateData.price = existingTypeItemForPrice.price;
  }
}
```

---

## 📊 Summary Table

| Location | File | Function/Line | Purpose |
|----------|------|--------------|---------|
| **Model** | `src/models/uniformModel.ts` | Line 28, 94-98 | Define `price` field in schema |
| **User Uniform** | `src/controllers/uniformController.ts` | `formatUniformItemsWithStatus` (546-645) | Fetch prices for user uniform |
| **Get Inventory** | `src/controllers/uniformController.ts` | `getUniforms` (1271-1410) | Include price in inventory API |
| **Create Item** | `src/controllers/uniformController.ts` | `addUniform` (1345-1950) | Accept and save price when creating |
| **Update Item** | `src/controllers/uniformController.ts` | `updateUniform` (1860-2222) | Accept and save price when updating |

---

## 🔍 Quick Search Commands

To find all price-related code:

```bash
# Search for "price" in controller
grep -n "price" src/controllers/uniformController.ts

# Search for "price" in model
grep -n "price" src/models/uniformModel.ts

# Search for shirt price handling
grep -n "shirt.*price\|price.*shirt" src/controllers/uniformController.ts -i
```

---

## ✅ Key Functions Summary

1. **`formatUniformItemsWithStatus`** - Fetches prices from UniformInventory for user uniform
2. **`getUniforms`** - Returns inventory with price field included
3. **`addUniform`** - Creates inventory item with price
4. **`updateUniform`** - Updates inventory item price

---

**Last Updated:** 2024
**Version:** 1.0
