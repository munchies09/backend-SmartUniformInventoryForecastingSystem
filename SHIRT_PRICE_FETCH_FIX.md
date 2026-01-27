# Shirt Price Fetch Fix - User Uniform

## 🐛 Problem

**User uniform shirt items (PIC 2) were NOT fetching prices from shirt inventory (PIC 1).**

**Expected:**
- ✅ When user views their uniform, shirt items should include the price from `ShirtPrice` collection
- ✅ Prices should be displayed in the user uniform interface

**Actual:**
- ❌ Shirt prices were showing as "Not set" even though prices were set in inventory
- ❌ `formatUniformItemsWithStatus` function was not fetching prices for shirt items

---

## ✅ Fix Applied

### Updated `formatUniformItemsWithStatus` Function

**Location:** `src/controllers/uniformController.ts` (line ~546)

**Changes:**
1. ✅ Made function `async` to support database queries
2. ✅ Added logic to fetch shirt prices from `ShirtPrice` collection
3. ✅ Included price in the returned item data for shirt items

**Implementation:**

```typescript
async function formatUniformItemsWithStatus(
  items: any[],
  uniformCreatedAt: Date,
  uniformUpdatedAt: Date
): Promise<any[]> {
  // CRITICAL: Fetch shirt prices for all shirt items in one query
  // Get unique shirt types from items
  const shirtTypes = [...new Set(
    items
      .filter(item => item.category?.toLowerCase() === 'shirt' || item.category?.toLowerCase() === 't-shirt')
      .map(item => item.type)
      .filter(Boolean)
  )];
  
  // Fetch all shirt prices in one query
  let shirtPricesMap: Map<string, number | null> = new Map();
  if (shirtTypes.length > 0) {
    try {
      const priceDocs = await ShirtPrice.find({ 
        type: { $in: shirtTypes } 
      }).lean();
      
      priceDocs.forEach((doc: any) => {
        shirtPricesMap.set(doc.type, doc.price);
      });
      
      console.log(`💰 Fetched shirt prices for ${priceDocs.length} types:`, 
        Array.from(shirtPricesMap.entries()).map(([type, price]) => `${type}=${price || 'null'}`).join(', '));
    } catch (priceError: any) {
      console.warn(`⚠️  Error fetching shirt prices:`, priceError.message);
      // Continue without prices if fetch fails
    }
  }
  
  // ... rest of function ...
  
  // CRITICAL: Fetch and include price for shirt items
  if (normalizedCategory?.toLowerCase() === 'shirt' || normalizedCategory?.toLowerCase() === 't-shirt') {
    const shirtType = normalizedType || item.type;
    const price = shirtPricesMap.get(shirtType);
    if (price !== undefined) {
      itemData.price = price; // Include price (can be null if not set)
      console.log(`💰 Added price for shirt: ${shirtType} = ${price !== null ? `RM ${price}` : 'null'}`);
    } else {
      // Price not found in database - default to null
      itemData.price = null;
      console.log(`⚠️  Price not found for shirt: ${shirtType} - defaulting to null`);
    }
  }
}
```

---

### Updated All Function Calls

**All endpoints that use `formatUniformItemsWithStatus` now use `await`:**

1. ✅ `getOwnUniform` - Line ~2408
2. ✅ `getMemberUniformBySispaId` - Line ~2519
3. ✅ `getMemberUniform` - Line ~2697
4. ✅ `createMemberUniform` - Line ~3375
5. ✅ `updateMemberUniform` - Line ~4815

---

## 🔍 How It Works Now

### Scenario: User Views Their Uniform with Shirt Items

**Process:**

1. **Fetch User Uniform:**
   - Database query: `MemberUniform.findOne({ sispaId: req.user.sispaId })`
   - Returns: Uniform items including shirts

2. **Format Items with Prices:**
   - `formatUniformItemsWithStatus` is called with uniform items
   - Function identifies shirt items (category === "Shirt")
   - Extracts unique shirt types: ["Digital Shirt", "Company Shirt", "Inner APM Shirt"]
   - **Fetches prices from `ShirtPrice` collection in one query**

3. **Include Price in Response:**
   - For each shirt item, looks up price in `shirtPricesMap`
   - Adds `price` field to item data:
     - `price: 20.00` if price is set
     - `price: null` if price is not set

4. **Return Formatted Items:**
   - All items are returned with their data
   - Shirt items include `price` field
   - Frontend can display prices from `item.price`

---

## 📊 Response Format

### Before Fix:
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
        "status": "Available"
        // ❌ No price field
      }
    ]
  }
}
```

### After Fix:
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
        "price": 20.00  // ✅ Price included from ShirtPrice collection
      }
    ]
  }
}
```

---

## 🧪 Testing Scenarios

### Test Case 1: User Has Shirt with Price Set

**Setup:**
- User uniform: Inner APM Shirt (M)
- ShirtPrice collection: `{ type: "Inner APM Shirt", price: 20.00 }`

**Action:**
- User calls `GET /api/members/uniform`

**Expected:**
- ✅ Response includes `price: 20.00` for Inner APM Shirt
- ✅ Frontend displays "RM 20.00"

---

### Test Case 2: User Has Shirt with No Price Set

**Setup:**
- User uniform: Digital Shirt (L)
- ShirtPrice collection: `{ type: "Digital Shirt", price: null }`

**Action:**
- User calls `GET /api/members/uniform`

**Expected:**
- ✅ Response includes `price: null` for Digital Shirt
- ✅ Frontend displays "Not set"

---

### Test Case 3: User Has Multiple Shirts

**Setup:**
- User uniform:
  - Company Shirt (M) - price: 40.00
  - Inner APM Shirt (S) - price: 20.00
  - Digital Shirt (L) - price: null
- ShirtPrice collection has all three types

**Action:**
- User calls `GET /api/members/uniform`

**Expected:**
- ✅ Company Shirt: `price: 40.00`
- ✅ Inner APM Shirt: `price: 20.00`
- ✅ Digital Shirt: `price: null`
- ✅ All prices fetched in **one query** (efficient)

---

## ✅ Verification Checklist

After implementing all fixes:

- [ ] `formatUniformItemsWithStatus` is `async` function ✅
- [ ] Function fetches shirt prices from `ShirtPrice` collection ✅
- [ ] Price is included in response for shirt items ✅
- [ ] All function calls use `await` ✅
- [ ] Prices are fetched efficiently (one query) ✅
- [ ] Null prices are handled correctly ✅
- [ ] Logging shows fetched prices ✅

---

## 🎯 Summary

**All Fixes Applied:**
1. ✅ Made `formatUniformItemsWithStatus` async
2. ✅ Added shirt price fetching logic
3. ✅ Included price in response for shirt items
4. ✅ Updated all function calls to use `await`
5. ✅ Efficient query (fetches all shirt prices in one query)

**Result:**
- ✅ Shirt prices are now fetched from `ShirtPrice` collection
- ✅ Prices are included in user uniform response
- ✅ Frontend can display prices from `item.price` field
- ✅ Works for all shirt types: Digital Shirt, Company Shirt, Inner APM Shirt

**User uniform shirt prices now work correctly!**

---

**Last Updated:** 2024
**Version:** 1.0
