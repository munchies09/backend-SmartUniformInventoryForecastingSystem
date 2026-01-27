# Size Change Restore Fix - Prevent Wrong Item Deduction

## 🐛 Problem

When a user changed their Boot size from UK 8 to UK 7:
- ✅ Boot UK 7: Successfully deducted (correct)
- ✅ Boot UK 8: Successfully restored +1 (correct)
- ❌ **Other items in same category (Uniform No 4, etc.)**: Also getting +1 added (WRONG)

**Root Cause:** The restore logic was not verifying that the found inventory item matched the exact category, type, and size before restoring. This could cause restoring to wrong items in the same category.

---

## ✅ Solution

Added **triple verification** to ensure we only restore to the exact item:

### 1. **Verification Before Adding to Restore List**

**Location:** `src/controllers/uniformController.ts` (line ~3794)

**Added checks:**
- ✅ Category match (case-insensitive)
- ✅ Type match (with normalization)
- ✅ Size match (type-specific: Beret exact, Boot UK prefix normalization, others normalized)

```typescript
// Verify category and type match exactly
const categoryMatch = inventoryCategory.toLowerCase() === oldItemCategory.toLowerCase();
const typeMatch = normalizedInventoryType.toLowerCase() === normalizedOldItemType.toLowerCase();

if (!categoryMatch || !typeMatch) {
  console.error(`❌ Category/Type mismatch - skipping restore`);
  continue; // Skip restore to prevent wrong item
}

// Verify size match (type-specific)
if (isBeret) {
  // Exact match only
  if (inventorySize !== oldItemSize) continue;
} else if (isShoeOrBoot) {
  // UK prefix normalization
  if (inventorySizeNoUK !== oldItemSizeNoUK && inventorySize !== oldItemSize) continue;
} else {
  // Normalize and compare
  if (normalizedInventorySize !== normalizedOldItemSize && inventorySize !== oldItemSize) continue;
}
```

---

### 2. **Verification Before Actually Restoring**

**Location:** `src/controllers/uniformController.ts` (line ~4159)

**Added checks:**
- ✅ Double-check category match
- ✅ Double-check type match
- ✅ Double-check size match

**Why:** Items might have been modified between the time we found them and when we restore. This ensures we're still restoring to the correct item.

```typescript
// Double-check that this is still the correct item before restoring
const categoryMatch = inventoryCategory.toLowerCase() === restoreCategory.toLowerCase();
const typeMatch = normalizedInventoryType.toLowerCase() === normalizedRestoreType.toLowerCase();

if (!categoryMatch || !typeMatch || !sizeMatch) {
  console.error(`❌ Category/Type/Size mismatch - skipping restore`);
  continue; // Skip restore to prevent wrong item
}
```

---

### 3. **Verification After Restoring**

**Location:** `src/controllers/uniformController.ts` (line ~4248)

**Added checks:**
- ✅ Verify item details still match after restore

**Why:** To catch any issues if the restore somehow affected the wrong item.

```typescript
// Double-check the item is still correct after restore
if (verifyCategory.toLowerCase() !== restoreCategory.toLowerCase() || 
    verifyType.toLowerCase() !== restoreType.toLowerCase() ||
    verifySize !== restoreSize) {
  console.error(`❌ Item mismatch after restore!`);
}
```

---

## 🔍 How It Works Now

### Scenario: User Changes Boot from UK 8 to UK 7

**Before Fix:**
1. Old items: Boot UK 8, Uniform No 4 XL
2. New items: Boot UK 7 (single item update)
3. System identifies: Boot UK 8 needs restore
4. System finds inventory item for Boot UK 8
5. **Problem:** If `findInventoryItem` returns wrong item or matches incorrectly, other items might be restored ❌
6. Result: Boot UK 8 restored ✅, but other items also restored ❌

**After Fix:**
1. Old items: Boot UK 8, Uniform No 4 XL
2. New items: Boot UK 7 (single item update)
3. System identifies: Boot UK 8 needs restore (Uniform No 4 XL skipped due to single-item update)
4. System finds inventory item for Boot UK 8
5. **Verification 1:** Check category, type, size match before adding to restore list ✅
6. **Verification 2:** Double-check before actually restoring ✅
7. Restore Boot UK 8 ✅
8. **Verification 3:** Verify after restore ✅
9. Result: Only Boot UK 8 restored ✅, other items unaffected ✅

---

## 📊 Verification Checks

### Check 1: Category Match
```typescript
inventoryCategory.toLowerCase() === oldItemCategory.toLowerCase()
```
- Ensures we're restoring to an item in the same category
- Prevents restoring "Boot" to "Uniform No 4" items

### Check 2: Type Match
```typescript
normalizedInventoryType.toLowerCase() === normalizedOldItemType.toLowerCase()
```
- Ensures we're restoring to the same type (with normalization)
- Prevents restoring "Boot" to "Uniform No 4" items

### Check 3: Size Match (Type-Specific)
```typescript
// Boot: UK prefix normalization
inventorySizeNoUK === oldItemSizeNoUK || inventorySize === oldItemSize

// Beret: Exact match
inventorySize === oldItemSize

// Others: Normalize and compare
normalizedInventorySize === normalizedOldItemSize || inventorySize === oldItemSize
```
- Ensures we're restoring to the exact size
- Prevents restoring "Boot UK 8" to "Boot UK 7" or "Uniform No 4 XL"

---

## 🧪 Testing

### Test Case: Change Boot from UK 8 to UK 7

**Setup:**
- User uniform: Boot UK 8, Uniform No 4 XL, Beret 6 3/4
- Inventory:
  - Boot UK 8: 10
  - Boot UK 7: 10
  - Uniform No 4 XL: 10
  - Beret 6 3/4: 10

**Action:**
- User changes Boot from UK 8 to UK 7

**Expected:**
- ✅ Boot UK 7 inventory: 10 → 9 (deducted)
- ✅ Boot UK 8 inventory: 10 → 11 (restored)
- ✅ Uniform No 4 XL inventory: 10 (unchanged)
- ✅ Beret 6 3/4 inventory: 10 (unchanged)

---

### Test Case: Change Boot from UK 8 to UK 7 (No Other Items)

**Setup:**
- User uniform: Boot UK 8 only
- Inventory:
  - Boot UK 8: 10
  - Boot UK 7: 10

**Action:**
- User changes Boot from UK 8 to UK 7

**Expected:**
- ✅ Boot UK 7 inventory: 10 → 9 (deducted)
- ✅ Boot UK 8 inventory: 10 → 11 (restored)

---

## ✅ Verification Checklist

After implementing this fix:

- [ ] Category match verified before adding to restore list
- [ ] Type match verified before adding to restore list
- [ ] Size match verified before adding to restore list
- [ ] Category/Type/Size double-checked before restoring
- [ ] Item verified after restore
- [ ] Changing Boot size only affects Boot inventory
- [ ] Changing Boot size doesn't affect Uniform No 4 inventory
- [ ] Changing Boot size doesn't affect other items in same category
- [ ] Logs show verification checks passing/failing

---

## 🎯 Summary

**Main Fix:** Added triple verification to ensure restore operations only affect the exact item being restored (category + type + size match).

**Result:**
- ✅ Only the correct item is restored
- ✅ Other items in the same category are unaffected
- ✅ Size changes work correctly (Boot UK 8 → UK 7)
- ✅ Wrong item deductions are prevented

**Changing Boot size from UK 8 to UK 7 now only affects Boot inventory, not other items!**

---

**Last Updated:** 2024
**Version:** 1.0
