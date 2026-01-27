# Shirt Price Fetch Diagnostic Guide

## 🐛 Problem

**Backend is fetching 0 shirt prices** from `ShirtPrice` collection.

**Log Output:**
```
💰 Fetched 0 shirt prices for inventory API:
```

---

## 🔍 Diagnostic Steps

### Step 1: Check if ShirtPrice Collection is Empty

**The most likely cause:** The `ShirtPrice` collection has no documents.

**Check in MongoDB:**
```javascript
// Connect to MongoDB
use your_database_name

// Check if ShirtPrice collection exists and has documents
db.shirtprices.countDocuments({})
// or
db.shirtprices.find({})
```

**Expected Result:**
- If returns `0` → Collection is empty (prices need to be set)
- If returns documents → Collection has data (check type matching)

---

### Step 2: Check Backend Logs

**After restarting backend, look for these logs:**

```
🔍 ShirtPrice collection has X documents
📋 ShirtPrice query result: [...]
💰 Fetched X shirt prices for inventory API: ...
```

**If you see:**
- `ShirtPrice collection has 0 documents` → **Collection is empty**
- `ShirtPrice query result: []` → **No documents found**
- `⚠️ ShirtPrice collection is EMPTY` → **Prices need to be set**

---

### Step 3: Set Shirt Prices (If Collection is Empty)

**Use the admin endpoint to set prices:**

```bash
# Set Inner APM Shirt price
curl -X PUT http://localhost:5000/api/inventory/shirt-prices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "type": "Inner APM Shirt",
    "price": 20.00
  }'

# Set Digital Shirt price
curl -X PUT http://localhost:5000/api/inventory/shirt-prices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "type": "Digital Shirt",
    "price": 25.00
  }'

# Set Company Shirt price
curl -X PUT http://localhost:5000/api/inventory/shirt-prices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "type": "Company Shirt",
    "price": 40.00
  }'
```

**Or use the admin UI:**
- Go to Admin → Inventory → Shirt Prices
- Set prices for each shirt type

---

### Step 4: Verify Prices Are Set

**After setting prices, check:**

```javascript
// In MongoDB
db.shirtprices.find({})

// Should return:
// { _id: ..., type: "Inner APM Shirt", price: 20.00, updatedAt: ... }
// { _id: ..., type: "Digital Shirt", price: 25.00, updatedAt: ... }
// { _id: ..., type: "Company Shirt", price: 40.00, updatedAt: ... }
```

**Or check via API:**
```bash
GET http://localhost:5000/api/inventory/shirt-prices
Authorization: Bearer ADMIN_TOKEN
```

**Expected Response:**
```json
{
  "success": true,
  "prices": {
    "digitalShirt": 25.00,
    "companyShirt": 40.00,
    "innerApmShirt": 20.00
  }
}
```

---

### Step 5: Check Type Matching

**If prices exist but still not fetched, check type matching:**

**Backend logs will show:**
```
⚠️ Price not found for shirt: Inner APM Shirt (searched as "inner apm shirt") - Available types in map: digital shirt, company shirt
```

**Common Issues:**
1. **Type mismatch:** Inventory has `"Inner APM Shirt"` but ShirtPrice has `"inner apm shirt"` (case difference)
2. **Extra spaces:** Inventory has `"Inner APM Shirt "` (trailing space)
3. **Different naming:** Inventory has `"Inner APM"` but ShirtPrice has `"Inner APM Shirt"`

**Fix:** Ensure types match exactly (case-insensitive matching is handled, but check for extra spaces or different names)

---

## 🔧 Quick Fix: Create Default Prices

**If ShirtPrice collection is empty, create default entries:**

**Option 1: Use API Endpoint (Recommended)**
```bash
# Create prices via API
PUT /api/inventory/shirt-prices
{
  "type": "Inner APM Shirt",
  "price": 20.00
}
```

**Option 2: Direct MongoDB Insert**
```javascript
// In MongoDB shell
db.shirtprices.insertMany([
  { type: "Inner APM Shirt", price: 20.00 },
  { type: "Digital Shirt", price: 25.00 },
  { type: "Company Shirt", price: 40.00 }
])
```

**Option 3: Use getShirtPrices Endpoint (Auto-creates defaults)**
```bash
# This endpoint auto-creates default entries if they don't exist
GET /api/inventory/shirt-prices
```

---

## 📊 Expected Behavior After Fix

### Backend Logs (After Prices Are Set):
```
🔍 ShirtPrice collection has 3 documents
📋 ShirtPrice query result: [
  { type: 'Inner APM Shirt', price: 20 },
  { type: 'Digital Shirt', price: 25 },
  { type: 'Company Shirt', price: 40 }
]
💰 Fetched 3 shirt prices for inventory API: inner apm shirt=RM 20, digital shirt=RM 25, company shirt=RM 40
💰 Added price for shirt item: Inner APM Shirt (M) = RM 20
```

### API Response:
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
      "price": 20.00  // ✅ Price included
    }
  ]
}
```

---

## ✅ Verification Checklist

- [ ] Check `ShirtPrice` collection has documents
- [ ] Verify prices are set via `PUT /api/inventory/shirt-prices`
- [ ] Check backend logs show "Fetched X shirt prices" (X > 0)
- [ ] Verify API response includes `price` field for shirt items
- [ ] Check type matching (case-insensitive, no extra spaces)
- [ ] Test with all three shirt types (Digital, Company, Inner APM)

---

## 🎯 Summary

**Most Common Issue:** `ShirtPrice` collection is empty.

**Solution:**
1. Set prices via `PUT /api/inventory/shirt-prices` endpoint
2. Or use admin UI to set prices
3. Verify prices exist in database
4. Restart backend and check logs

**After prices are set, the inventory API will include prices for all shirt items!**

---

**Last Updated:** 2024
**Version:** 1.0
