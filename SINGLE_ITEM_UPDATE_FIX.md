# Single Item Update Fix - Preserve Other Items

## 🐛 Problem

When the frontend has **separate "Save" buttons for each uniform item**, clicking "Save" on one item (e.g., PVC Shoes) was causing:
- Other items (e.g., Uniform No 3 Female XL, Beret 6 3/4) to have their inventory **incorrectly restored** (added back)
- This happened because the backend thought those items were "removed" when they weren't in the request

**Root Cause:** The backend was comparing ALL old items vs ONLY the new items sent, so items not in the request were treated as "removed" and inventory was restored.

---

## ✅ Solution

### 1. **Detect Single-Item Updates**

Added logic to detect when the frontend sends only **1 item** (single-item update):

```typescript
const isSingleItemUpdate = normalizedItems.length === 1;
const isFullUpdate = normalizedItems.length >= normalizedOldItems.length * 0.8;

console.log(`🔍 UPDATE MODE DETECTION:`, {
  isSingleItemUpdate,
  isFullUpdate,
  message: isSingleItemUpdate 
    ? 'SINGLE ITEM UPDATE - Will merge with existing items (preserve others)' 
    : 'FULL UPDATE - Will replace all items'
});
```

---

### 2. **Skip Inventory Restore for Preserved Items**

When it's a **single-item update**, the backend now:
- ✅ **Skips restoring inventory** for items not in the request (they're being preserved, not removed)
- ✅ **Only restores inventory** if the item being updated has quantity decreased
- ✅ **Only deducts inventory** for the item being updated

```typescript
if (isSingleItemUpdate) {
  // Single-item update: Only restore if the item being updated has quantity decreased
  // Don't restore items that aren't in the request - they're being preserved
  if (newItem && newQuantity < oldQuantity) {
    // Item is in the request and quantity decreased - restore the difference
    console.log(`📦 Single-item update: Item quantity decreased - will restore`);
  } else {
    // Item not in request or quantity same/increased - skip restore (item is being preserved)
    console.log(`⏭️  Single-item update: Skipping restore - item being preserved`);
    continue; // Skip restore - item is being preserved
  }
}
```

---

## 🔍 How It Works Now

### Scenario: User Saves PVC Shoes (Single Item)

**Before Fix:**
1. Frontend sends: `[{ category: "Uniform No 3", type: "PVC Shoes", size: "UK 7", status: "Available" }]`
2. Backend compares:
   - Old items: [Uniform No 3 Female XL, Beret 6 3/4, PVC Shoes UK 7]
   - New items: [PVC Shoes UK 7]
3. Backend thinks: "Uniform No 3 Female XL and Beret 6 3/4 are missing → restore inventory" ❌
4. Result: PVC Shoes deducted, but Uniform No 3 Female XL and Beret 6 3/4 inventory incorrectly restored

**After Fix:**
1. Frontend sends: `[{ category: "Uniform No 3", type: "PVC Shoes", size: "UK 7", status: "Available" }]`
2. Backend detects: `isSingleItemUpdate = true` ✅
3. Backend compares:
   - Old items: [Uniform No 3 Female XL, Beret 6 3/4, PVC Shoes UK 7]
   - New items: [PVC Shoes UK 7]
4. Backend logic:
   - Uniform No 3 Female XL: Not in request → Skip restore (preserving item) ✅
   - Beret 6 3/4: Not in request → Skip restore (preserving item) ✅
   - PVC Shoes UK 7: In request → Deduct inventory ✅
5. Result: Only PVC Shoes inventory is affected ✅

---

## 📊 Update Modes

### Mode 1: Single-Item Update (Merge Mode)
- **Trigger:** Frontend sends **1 item**
- **Behavior:** 
  - Merge the item with existing items
  - Preserve all other items
  - Only restore inventory if the updated item's quantity decreased
  - Only deduct inventory for the updated item

### Mode 2: Full Update (Replace Mode)
- **Trigger:** Frontend sends **≥80% of existing items**
- **Behavior:**
  - Replace all items
  - Restore inventory for items not in the new list
  - Deduct inventory for new/updated items

### Mode 3: Partial Update (Merge Mode)
- **Trigger:** Frontend sends **<80% of existing items** but **>1 item**
- **Behavior:**
  - Merge new items with existing items
  - Preserve items not in the request
  - Only restore inventory for items that are actually removed/decreased

---

## 🧪 Testing

### Test Case 1: Save PVC Shoes (Should NOT affect other items)

**Setup:**
- Existing uniform: [Uniform No 3 Female XL, Beret 6 3/4, PVC Shoes UK 7]
- Inventory: Uniform No 3 Female XL = 10, Beret 6 3/4 = 10, PVC Shoes UK 7 = 10

**Action:**
- User clicks "Save" on PVC Shoes (status: "Available")

**Expected:**
- ✅ PVC Shoes UK 7 inventory: 10 → 9 (deducted)
- ✅ Uniform No 3 Female XL inventory: 10 (unchanged)
- ✅ Beret 6 3/4 inventory: 10 (unchanged)
- ✅ Uniform No 3 Female XL item: Still in database
- ✅ Beret 6 3/4 item: Still in database

---

### Test Case 2: Save Uniform No 3 Female XL (Should NOT affect other items)

**Setup:**
- Existing uniform: [Uniform No 3 Female XL, Beret 6 3/4, PVC Shoes UK 7]
- Inventory: Uniform No 3 Female XL = 10, Beret 6 3/4 = 10, PVC Shoes UK 7 = 10

**Action:**
- User clicks "Save" on Uniform No 3 Female XL (status: "Available")

**Expected:**
- ✅ Uniform No 3 Female XL inventory: 10 → 9 (deducted)
- ✅ Beret 6 3/4 inventory: 10 (unchanged)
- ✅ PVC Shoes UK 7 inventory: 10 (unchanged)
- ✅ Beret 6 3/4 item: Still in database
- ✅ PVC Shoes UK 7 item: Still in database

---

### Test Case 3: Save Beret 6 3/4 (Should NOT affect other items)

**Setup:**
- Existing uniform: [Uniform No 3 Female XL, Beret 6 3/4, PVC Shoes UK 7]
- Inventory: Uniform No 3 Female XL = 10, Beret 6 3/4 = 10, PVC Shoes UK 7 = 10

**Action:**
- User clicks "Save" on Beret 6 3/4 (status: "Available")

**Expected:**
- ✅ Beret 6 3/4 inventory: 10 → 9 (deducted)
- ✅ Uniform No 3 Female XL inventory: 10 (unchanged)
- ✅ PVC Shoes UK 7 inventory: 10 (unchanged)
- ✅ Uniform No 3 Female XL item: Still in database
- ✅ PVC Shoes UK 7 item: Still in database

---

## 📊 Logging Output

After this fix, you should see logs like:

```
🔍 UPDATE MODE DETECTION: {
  isSingleItemUpdate: true,
  isFullUpdate: false,
  oldItemsCount: 3,
  newItemsCount: 1,
  message: 'SINGLE ITEM UPDATE - Will merge with existing items (preserve others)'
}

🔍 Comparing for restore: Uniform No 3 Female (XL)
  key: uniform no 3::uniform no 3 female::XL
  oldQuantity: 1
  newQuantity: 0
  newItemExists: false
  isSingleItemUpdate: true
  willRestore: false
⏭️  Single-item update: Skipping restore for Uniform No 3 Female (XL) - item not in request or quantity not decreased (preserving existing item)

🔍 Comparing for restore: Beret (6 3/4)
  key: uniform no 3::beret::6 3/4
  oldQuantity: 1
  newQuantity: 0
  newItemExists: false
  isSingleItemUpdate: true
  willRestore: false
⏭️  Single-item update: Skipping restore for Beret (6 3/4) - item not in request or quantity not decreased (preserving existing item)

🔍 Comparing item: PVC Shoes (UK 7)
  key: uniform no 3::pvc shoes::7
  oldItemExists: true
  oldQuantity: 1
  newQuantity: 1
📉 DEDUCTING INVENTORY: {
  category: "Uniform No 3",
  type: "PVC Shoes",
  size: "UK 7",
  status: "Available",
  oldQuantity: 10,
  deductionAmount: 1,
  newQuantity: 9,
  calculation: "10 - 1 = 9"
}
✅ VERIFIED DEDUCTION: PVC Shoes (UK 7) - Was: 10, Now: 9, Expected: 9
```

---

## ✅ Verification Checklist

After implementing this fix:

- [ ] Single-item updates are detected correctly
- [ ] Inventory restore is skipped for preserved items
- [ ] Only the updated item's inventory is affected
- [ ] Other items remain in the database
- [ ] Logging shows "SINGLE ITEM UPDATE" mode
- [ ] Logging shows "Skipping restore" for preserved items
- [ ] Saving PVC Shoes doesn't affect Uniform No 3 Female XL
- [ ] Saving Uniform No 3 Female XL doesn't affect Beret
- [ ] Saving Beret doesn't affect PVC Shoes

---

## 🎯 Summary

**Main Fix:** Added detection for single-item updates and skip inventory restore for items not in the request when it's a merge operation.

**Result:**
- ✅ Each "Save" button works independently
- ✅ Saving one item doesn't affect other items
- ✅ Inventory is only affected for the item being saved
- ✅ Other items are preserved in the database

**The system now correctly handles separate "Save" buttons for each item!**

---

**Last Updated:** 2024
**Version:** 1.0
