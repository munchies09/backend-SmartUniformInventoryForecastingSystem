# All Items Restore Verification Fix - Prevent Wrong Item Restore

## 🐛 Problem

When a user changed item size (e.g., Boot from UK 8 to UK 7), the restore logic was incorrectly restoring inventory for **other items in the same category**, not just the item being changed.

**Example:**
- User changes Boot from UK 8 to UK 7
- ✅ Boot UK 7: Correctly deducted
- ✅ Boot UK 8: Correctly restored
- ❌ **Other items in Uniform No 4 category**: Also incorrectly restored ❌

**Root Cause:** The restore logic was not verifying that the found inventory item matched the **exact category, type, and size** before restoring.

---

## ✅ Solution

Added **comprehensive triple verification** for **ALL item types** to ensure we only restore to the exact item:

### 1. **Verification Before Adding to Restore List** (Line ~3807)

**Checks:**
- ✅ Category match (case-insensitive)
- ✅ Type match (with normalization)
- ✅ Size match (type-specific):
  - **Empty/null sizes**: Match if both are empty
  - **"N/A" sizes**: Match if both are "N/A"
  - **Beret**: Exact match only
  - **Boot/Shoe**: UK prefix normalization
  - **Other items**: Normalized comparison (Uniform No 3 Male/Female, Uniform No 4, Shirt, etc.)

### 2. **Verification Before Actually Restoring** (Line ~4210)

**Checks:**
- ✅ Double-check category match
- ✅ Double-check type match
- ✅ Double-check size match (with comprehensive handling for all item types)

### 3. **Verification After Restoring** (Line ~4298)

**Checks:**
- ✅ Verify item details still match after restore

---

## 🔍 How It Works for ALL Item Types

### Boot (Uniform No 4)
- **Size handling:** UK prefix normalization
- **Example:** "UK 8" → "8", "UK 7" → "7"
- **Verification:** UK 8 size matches UK 8 inventory item only ✅

### Uniform No 3 Male/Female
- **Size handling:** Normalize spaces and case
- **Example:** "XL" → "xl", "L" → "l"
- **Verification:** XL size matches XL inventory item only ✅

### Uniform No 4
- **Size handling:** Normalize spaces and case
- **Example:** "XL" → "xl", "L" → "l"
- **Verification:** XL size matches XL inventory item only ✅

### Beret
- **Size handling:** EXACT match only (spaces preserved)
- **Example:** "6 3/4" stays "6 3/4" (not "63/4")
- **Verification:** "6 3/4" matches "6 3/4" inventory item only ✅

### PVC Shoes
- **Size handling:** UK prefix normalization
- **Example:** "UK 7" → "7"
- **Verification:** UK 7 size matches UK 7 inventory item only ✅

### Accessories No 3 (Apulet, Integrity Badge, etc.)
- **Size handling:** Empty/null/"N/A" → 'NO_SIZE'
- **Example:** "", null, "N/A" all map to 'NO_SIZE'
- **Verification:** Empty/"N/A" matches empty/"N/A" inventory item only ✅

### Accessories No 4 (APM Tag, Belt No 4, etc.)
- **Size handling:** Empty/null/"N/A" → 'NO_SIZE'
- **Example:** "", null, "N/A" all map to 'NO_SIZE'
- **Verification:** Empty/"N/A" matches empty/"N/A" inventory item only ✅

### Shirt (Digital Shirt, Company Shirt, etc.)
- **Size handling:** Normalize spaces and case, or "N/A" → 'NO_SIZE'
- **Example:** "XL" → "xl", "N/A" → 'NO_SIZE'
- **Verification:** XL size matches XL inventory item only, "N/A" matches "N/A" only ✅

---

## 🔍 Size Match Verification Logic

### For Items with No Size:
```typescript
if (!inventorySize && !oldItemSize) {
  // Both are empty/null - match ✅
} else if (!inventorySize || !oldItemSize) {
  // One is empty, one is not - no match ❌
  continue; // Skip restore
}
```

### For Items with "N/A" Size:
```typescript
const inventorySizeIsNA = inventorySize === 'N/A' || inventorySize.toLowerCase() === 'n/a';
const oldItemSizeIsNA = oldItemSize === 'N/A' || oldItemSize.toLowerCase() === 'n/a';

if (inventorySizeIsNA && oldItemSizeIsNA) {
  // Both are "N/A" - match ✅
} else if (inventorySizeIsNA || oldItemSizeIsNA) {
  // One is "N/A", one is not - no match ❌
  continue; // Skip restore
}
```

### For Beret:
```typescript
if (isBeret) {
  // EXACT match only (spaces must match)
  if (inventorySize !== oldItemSize) {
    continue; // Skip restore
  }
}
```

### For Boot/Shoe:
```typescript
if (isShoeOrBoot) {
  const inventorySizeNoUK = inventorySize.replace(/^UK\s*/i, '').trim();
  const oldItemSizeNoUK = oldItemSize.replace(/^UK\s*/i, '').trim();
  if (inventorySizeNoUK !== oldItemSizeNoUK && inventorySize !== oldItemSize) {
    continue; // Skip restore
  }
}
```

### For Other Items:
```typescript
// Normalize and compare
const normalizedInventorySize = normalizeSize(inventorySize);
const normalizedOldItemSize = normalizeSize(oldItemSize);
if (normalizedInventorySize !== normalizedOldItemSize && inventorySize !== oldItemSize) {
  continue; // Skip restore
}
```

---

## 📊 Test Scenarios

### Scenario 1: Change Boot from UK 8 to UK 7

**Setup:**
- User uniform: Boot UK 8, Uniform No 4 XL
- Inventory:
  - Boot UK 8: 10
  - Boot UK 7: 10
  - Uniform No 4 XL: 10

**Action:**
- User changes Boot from UK 8 to UK 7

**Expected:**
- ✅ Boot UK 7: 10 → 9 (deducted)
- ✅ Boot UK 8: 10 → 11 (restored)
- ✅ Uniform No 4 XL: 10 (unchanged) ✅

---

### Scenario 2: Change Uniform No 3 Female from XL to L

**Setup:**
- User uniform: Uniform No 3 Female XL, Uniform No 3 Male L
- Inventory:
  - Uniform No 3 Female XL: 10
  - Uniform No 3 Female L: 10
  - Uniform No 3 Male L: 10

**Action:**
- User changes Uniform No 3 Female from XL to L

**Expected:**
- ✅ Uniform No 3 Female L: 10 → 9 (deducted)
- ✅ Uniform No 3 Female XL: 10 → 11 (restored)
- ✅ Uniform No 3 Male L: 10 (unchanged) ✅

---

### Scenario 3: Change Beret from "6 3/4" to "6 5/8"

**Setup:**
- User uniform: Beret 6 3/4, Uniform No 3 Male XL
- Inventory:
  - Beret 6 3/4: 10
  - Beret 6 5/8: 10
  - Uniform No 3 Male XL: 10

**Action:**
- User changes Beret from "6 3/4" to "6 5/8"

**Expected:**
- ✅ Beret 6 5/8: 10 → 9 (deducted)
- ✅ Beret 6 3/4: 10 → 11 (restored)
- ✅ Uniform No 3 Male XL: 10 (unchanged) ✅

---

### Scenario 4: Change Apulet (Accessories No 3)

**Setup:**
- User uniform: Apulet, Integrity Badge
- Inventory:
  - Apulet: 22
  - Integrity Badge: 15

**Action:**
- User updates Apulet

**Expected:**
- ✅ Apulet: 22 → 21 (deducted)
- ✅ Integrity Badge: 15 (unchanged) ✅

---

## ✅ Verification Checklist

After implementing this fix:

- [ ] Category match verified for all item types
- [ ] Type match verified for all item types
- [ ] Size match verified with type-specific handling:
  - [ ] Empty/null sizes handled correctly
  - [ ] "N/A" sizes handled correctly
  - [ ] Beret sizes match exactly
  - [ ] Boot/Shoe sizes normalize UK prefix
  - [ ] Other items normalize correctly
- [ ] Changing one item size doesn't affect other items in same category
- [ ] Changing Boot size doesn't affect Uniform No 4 items
- [ ] Changing Uniform No 3 Female size doesn't affect Uniform No 3 Male items
- [ ] Changing Beret size doesn't affect other Beret sizes
- [ ] Changing Accessories No 3 items doesn't affect other Accessories No 3 items
- [ ] Logs show verification checks passing/failing

---

## 🎯 Summary

**Main Fix:** Added comprehensive verification for **ALL item types** to ensure restore operations only affect the exact item being restored (category + type + size match).

**Result:**
- ✅ Only the correct item is restored
- ✅ Other items in the same category are unaffected
- ✅ Size changes work correctly for ALL item types
- ✅ Wrong item deductions are prevented for ALL categories

**Changing item size now only affects that specific item, not other items in the same category!**

---

**Last Updated:** 2024
**Version:** 1.0
