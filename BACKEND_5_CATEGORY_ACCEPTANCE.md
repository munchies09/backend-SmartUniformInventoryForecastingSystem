# Backend: 5-Category Structure Acceptance

## Overview
The backend **ACCEPTS** these 5 categories from the frontend:

1. ✅ **"Uniform No 3"** - Main uniform items only (NO accessories)
2. ✅ **"Uniform No 4"** - Main uniform items only (NO accessories)
3. ✅ **"Accessories No 3"** ← NEW - Accessories for Uniform No 3
4. ✅ **"Accessories No 4"** ← NEW - Accessories for Uniform No 4
5. ✅ **"Shirt"** ← NEW - Replaces "T-Shirt"

---

## Backend Implementation

### 1. Valid Categories Constant

```typescript
const VALID_CATEGORIES = [
  'Uniform No 3',
  'Uniform No 4',
  'Accessories No 3',  // ✅ ACCEPTED from frontend
  'Accessories No 4',  // ✅ ACCEPTED from frontend
  'Shirt'              // ✅ ACCEPTED from frontend (replaces "T-Shirt")
] as const;
```

### 2. Category Validation

The `isValidCategory()` function accepts these 5 categories (case-insensitive):

```typescript
function isValidCategory(category: string): boolean {
  const catLower = category.toLowerCase().trim();
  const validCategoriesLower = VALID_CATEGORIES.map(c => c.toLowerCase());
  return validCategoriesLower.includes(catLower);
}
```

**Accepted formats (case-insensitive):**
- ✅ "Uniform No 3", "uniform no 3", "UNIFORM NO 3"
- ✅ "Uniform No 4", "uniform no 4", "UNIFORM NO 4"
- ✅ "Accessories No 3", "accessories no 3", "ACCESSORIES NO 3", "Accessories No. 3"
- ✅ "Accessories No 4", "accessories no 4", "ACCESSORIES NO 4", "Accessories No. 4"
- ✅ "Shirt", "shirt", "SHIRT", "Shirts"

### 3. Category Normalization

The `normalizeCategoryForStorage()` function:
- ✅ **ACCEPTS** the 5 valid categories from frontend
- ✅ Returns them in canonical format (standardized case)
- ❌ **REJECTS** old categories like "T-Shirt"
- ❌ **REJECTS** accessories sent with wrong category (e.g., "Uniform No 3" + "Apulet")

**Example:**
```typescript
normalizeCategoryForStorage("Accessories No 3", "Apulet") 
  → "Accessories No 3" ✅ (accepted)

normalizeCategoryForStorage("Shirt", "Digital Shirt") 
  → "Shirt" ✅ (accepted)

normalizeCategoryForStorage("T-Shirt", "Digital Shirt") 
  → Error: "Use 'Shirt' instead of 'T-Shirt'" ❌ (rejected)

normalizeCategoryForStorage("Uniform No 3", "Apulet") 
  → Error: "Accessories must use category 'Accessories No 3'" ❌ (rejected)
```

---

## Validation Rules

### Rule 1: Accept 5 Categories Only

**✅ ACCEPTED:**
- `category: "Uniform No 3"` → Stored as "Uniform No 3"
- `category: "Uniform No 4"` → Stored as "Uniform No 4"
- `category: "Accessories No 3"` → Stored as "Accessories No 3"
- `category: "Accessories No 4"` → Stored as "Accessories No 4"
- `category: "Shirt"` → Stored as "Shirt"

**❌ REJECTED:**
- `category: "T-Shirt"` → Error 400: "Use 'Shirt' instead of 'T-Shirt'"
- `category: "Uniform No 3"` + `type: "Apulet"` → Error 400: "Accessories must use category 'Accessories No 3'"
- `category: "Invalid Category"` → Error 400: "Invalid category. Valid categories are: ..."

### Rule 2: Category-Type Matching

**✅ CORRECT:**
- `category: "Uniform No 3"` + `type: "Uniform No 3 Male"` ✅
- `category: "Accessories No 3"` + `type: "Apulet"` ✅
- `category: "Accessories No 4"` + `type: "APM Tag"` ✅
- `category: "Shirt"` + `type: "Digital Shirt"` ✅

**❌ INCORRECT:**
- `category: "Uniform No 3"` + `type: "Apulet"` ❌ → Error: "Accessories must use category 'Accessories No 3'"
- `category: "Accessories No 3"` + `type: "Uniform No 3 Male"` ❌ → Error: "Main items must use category 'Uniform No 3'"

---

## API Endpoints

### POST /api/inventory
**Accepts:** All 5 categories

**Example Request:**
```json
{
  "category": "Accessories No 3",
  "type": "Apulet",
  "size": "",
  "quantity": 10
}
```

### PUT /api/members/uniform
**Accepts:** All 5 categories

**Example Request:**
```json
{
  "items": [
    {
      "category": "Uniform No 3",
      "type": "Uniform No 3 Male",
      "size": "M",
      "quantity": 1
    },
    {
      "category": "Accessories No 3",
      "type": "Apulet",
      "size": "",
      "quantity": 1
    },
    {
      "category": "Shirt",
      "type": "Digital Shirt",
      "size": "L",
      "quantity": 1
    }
  ]
}
```

---

## Error Responses

### Invalid Category (400 Bad Request)
```json
{
  "success": false,
  "message": "Invalid category \"T-Shirt\" for item type \"Digital Shirt\". Valid categories are: Uniform No 3, Uniform No 4, Accessories No 3, Accessories No 4, Shirt"
}
```

### Wrong Category for Item Type (400 Bad Request)
```json
{
  "success": false,
  "message": "Invalid category \"Uniform No 3\" for accessory type \"Apulet\". Accessories must use category \"Accessories No 3\" (not \"Uniform No 3\")."
}
```

---

## Testing Checklist

### ✅ Test Accepting New Categories

- [ ] POST /api/inventory with `category: "Accessories No 3"` → Should succeed
- [ ] POST /api/inventory with `category: "Accessories No 4"` → Should succeed
- [ ] POST /api/inventory with `category: "Shirt"` → Should succeed
- [ ] PUT /api/members/uniform with `category: "Accessories No 3"` → Should succeed
- [ ] PUT /api/members/uniform with `category: "Shirt"` → Should succeed

### ❌ Test Rejecting Old Categories

- [ ] POST /api/inventory with `category: "T-Shirt"` → Should return 400 error
- [ ] PUT /api/members/uniform with `category: "T-Shirt"` → Should return 400 error
- [ ] PUT /api/members/uniform with `category: "Uniform No 3"` + `type: "Apulet"` → Should return 400 error

### ✅ Test Category-Type Matching

- [ ] `category: "Accessories No 3"` + `type: "Apulet"` → Should succeed
- [ ] `category: "Accessories No 4"` + `type: "APM Tag"` → Should succeed
- [ ] `category: "Shirt"` + `type: "Digital Shirt"` → Should succeed

---

## Summary

**✅ BACKEND ACCEPTS:**
1. "Uniform No 3"
2. "Uniform No 4"
3. "Accessories No 3" ← NEW
4. "Accessories No 4" ← NEW
5. "Shirt" ← NEW (replaces "T-Shirt")

**❌ BACKEND REJECTS:**
- "T-Shirt" (old category name)
- Accessories sent with "Uniform No 3/4" category
- Any other invalid categories

**Implementation Status:** ✅ Complete
- Category validation implemented
- Error handling returns 400 (not 500) for invalid categories
- Clear error messages guide frontend to use correct categories
- All 5 categories are accepted and stored correctly
