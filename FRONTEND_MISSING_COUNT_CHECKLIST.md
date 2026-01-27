# Frontend MissingCount Increment Checklist

## 🔍 Problem
`missingCount` is not incrementing when changing status from "Available" → "Missing" → "Available" → "Missing" again.

## ✅ What Frontend MUST Check

### 1. **Always Send `status` Field When Updating Items**

When calling `PUT /api/members/uniform` or updating an item, the frontend MUST include the `status` field:

```javascript
// ✅ CORRECT - Include status field
const updatePayload = {
  items: [{
    category: "Accessories No 3",
    type: "Cel Bar",
    size: "",
    quantity: 1,
    status: "Missing",  // ✅ MUST include status
    // ... other fields
  }]
};

// ❌ WRONG - Missing status field
const updatePayload = {
  items: [{
    category: "Accessories No 3",
    type: "Cel Bar",
    size: "",
    quantity: 1,
    // status is missing - backend can't detect the change!
  }]
};
```

### 2. **DO NOT Send `missingCount` - Let Backend Calculate It**

The backend automatically increments `missingCount` based on status changes. The frontend should **NOT** send `missingCount` unless it wants to override the backend calculation.

```javascript
// ✅ CORRECT - Don't send missingCount, let backend calculate
const updatePayload = {
  items: [{
    category: "Accessories No 3",
    type: "Cel Bar",
    size: "",
    quantity: 1,
    status: "Missing",
    // missingCount is NOT included - backend will calculate it
  }]
};

// ❌ WRONG - Sending missingCount will override backend calculation
const updatePayload = {
  items: [{
    category: "Accessories No 3",
    type: "Cel Bar",
    size: "",
    quantity: 1,
    status: "Missing",
    missingCount: 1,  // ❌ This will prevent backend from incrementing!
  }]
};
```

**Exception:** Only send `missingCount` if you want to manually set/reset it (not recommended for normal status changes).

### 3. **Check Current Item Status Before Updating**

The frontend should read the current item's `status` from the database/state before sending the update:

```javascript
// ✅ CORRECT - Check current status before updating
const currentItem = uniform.items.find(item => 
  item.type === "Cel Bar" && item.category === "Accessories No 3"
);

if (currentItem) {
  const currentStatus = currentItem.status || 'Available';
  console.log(`Current status: ${currentStatus}`);
  
  // Then send update with new status
  const updatePayload = {
    items: [{
      ...currentItem,
      status: "Missing",  // New status
      // Don't include missingCount - backend will increment from currentItem.missingCount
    }]
  };
}
```

### 4. **Send Complete Item Data in Update Request**

When updating an item's status, include ALL item fields (category, type, size, quantity, etc.):

```javascript
// ✅ CORRECT - Send complete item data
const updatePayload = {
  items: [{
    category: item.category,      // Include
    type: item.type,              // Include
    size: item.size,              // Include (can be "" for accessories)
    quantity: item.quantity,      // Include
    status: "Missing",            // ✅ Include - THIS IS CRITICAL
    notes: item.notes,            // Include (optional)
    // missingCount: NOT INCLUDED - backend calculates
  }]
};
```

### 5. **Verify Response Contains Updated missingCount**

After updating, check the response to verify `missingCount` was updated correctly:

```javascript
const response = await fetch('/api/members/uniform', {
  method: 'PUT',
  body: JSON.stringify(updatePayload)
});

const data = await response.json();

// Check if missingCount was updated
const updatedItem = data.uniform.items.find(item => 
  item.type === "Cel Bar"
);

if (updatedItem.status === "Missing") {
  console.log(`MissingCount should be: ${updatedItem.missingCount || 1}`);
  // Expected: If changed from "Available" → "Missing", missingCount should be 1
  // Expected: If changed from "Available" → "Missing" again (was Missing before), missingCount should increment
}
```

## 🐛 Common Frontend Issues

### Issue 1: Frontend Not Sending `status` Field
**Symptom:** Backend doesn't know the status changed, so it can't increment `missingCount`.

**Fix:** Always include `status: "Missing"` in the update payload.

### Issue 2: Frontend Sending `missingCount: 1` Every Time
**Symptom:** Backend receives `missingCount: 1` and uses that value instead of incrementing.

**Fix:** Remove `missingCount` from the update payload. Let the backend calculate it.

### Issue 3: Frontend Not Reading Current Item Data
**Symptom:** Frontend sends incomplete item data, missing fields like `category` or `type`.

**Fix:** Always read the complete item from the uniform state/database before updating.

### Issue 4: Frontend Resetting `missingCount` When Status is "Available"
**Symptom:** When status changes to "Available", frontend sets `missingCount: undefined` or `missingCount: 0`, losing the count.

**Fix:** Don't send `missingCount` when status is "Available". Backend will preserve it automatically.

## 📋 Frontend Debug Checklist

Before reporting the issue, verify:

- [ ] Frontend is sending `status` field in update request
- [ ] Frontend is **NOT** sending `missingCount` in update request (unless intentionally overriding)
- [ ] Frontend is reading current item data before updating
- [ ] Frontend is including all required fields (category, type, size, quantity)
- [ ] Frontend is checking the response to verify `missingCount` was updated
- [ ] Frontend is not resetting `missingCount` when status changes to "Available"
- [ ] Frontend console shows the correct status being sent in the request
- [ ] Backend logs show the status change is being detected

## 🔍 Frontend Debug Logging

Add this logging to verify what's being sent:

```javascript
const updatePayload = {
  items: [{
    category: "Accessories No 3",
    type: "Cel Bar",
    size: "",
    quantity: 1,
    status: "Missing",  // Make sure this is included
    // missingCount: NOT INCLUDED
  }]
};

console.log('📤 Sending update request:', JSON.stringify(updatePayload, null, 2));
console.log('   Status being sent:', updatePayload.items[0].status);
console.log('   missingCount being sent:', updatePayload.items[0].missingCount); // Should be undefined

const response = await fetch('/api/members/uniform', {
  method: 'PUT',
  body: JSON.stringify(updatePayload)
});

const data = await response.json();
console.log('📥 Update response:', data);
console.log('   Item status after update:', data.uniform.items.find(i => i.type === "Cel Bar")?.status);
console.log('   missingCount after update:', data.uniform.items.find(i => i.type === "Cel Bar")?.missingCount);
```

## 🎯 Expected Backend Behavior

### Scenario 1: Available → Missing (First Time)
- **Input:** `status: "Missing"` (no `missingCount`)
- **Backend:** Detects change from "Available" to "Missing", sets `missingCount = 1`
- **Result:** Item shows "Missing (1)"

### Scenario 2: Missing (1) → Available
- **Input:** `status: "Available"` (no `missingCount`)
- **Backend:** Preserves `missingCount = 1` (stores it even though status is "Available")
- **Result:** Item shows "Available" but `missingCount` is still 1 in database

### Scenario 3: Available → Missing (Second Time, previously was Missing)
- **Input:** `status: "Missing"` (no `missingCount`)
- **Backend:** Detects change from "Available" to "Missing", reads preserved `missingCount = 1`, increments to `missingCount = 2`
- **Result:** Item shows "Missing (2)"

## 📞 If Still Not Working

If after checking all the above, `missingCount` still doesn't increment:

1. **Check Backend Logs:** Look for these console messages:
   - `📈 Incremented missingCount for Cel Bar: X → Y (status changed from "Available" to Missing)`
   - `📋 Preserving missingCount for Cel Bar: X (status: Available, was: Missing)`

2. **Verify Database:** Check if `missingCount` is actually preserved in the database when status is "Available":
   ```javascript
   // The item in database should have:
   { status: "Available", missingCount: 1 }  // ← This should exist
   ```

3. **Check Request Payload:** Verify the exact request being sent (use browser Network tab)

4. **Check Response:** Verify the response contains the updated `missingCount`

---

**Most Common Issue:** Frontend is either:
- Not sending `status` field, OR
- Sending `missingCount` which overrides backend calculation

Fix these first!
