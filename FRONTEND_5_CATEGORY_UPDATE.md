# Frontend Update: 5-Category Structure for Uniform Items

## Overview
The backend now **STRICTLY ENFORCES** a **5-category structure** for organizing uniform items. The frontend **MUST** send the correct categories - NO backward compatibility is provided. Invalid categories will return 400 errors.

---

## Category Structure Changes

### Previous Structure (3 categories):
- Uniform No 3 (included accessories)
- Uniform No 4 (included accessories)
- T-Shirt

### New Structure (5 categories):
1. **Uniform No 3** - Main uniform items only (NO accessories)
2. **Uniform No 4** - Main uniform items only (NO accessories)
3. **Accessories No 3** - Accessories for Uniform No 3 (NEW)
4. **Accessories No 4** - Accessories for Uniform No 4 (NEW)
5. **Shirt** - All shirt types (renamed from T-Shirt)

---

## Required Frontend Changes

### 1. Update Category Selection/Display

**For Uniform No 3 Items:**
- Main items only: `"Uniform No 3"`
  - Uniform No 3 Male
  - Uniform No 3 Female
  - PVC Shoes
  - Beret

- Accessories: `"Accessories No 3"` (NEW category)
  - Apulet
  - Integrity Badge
  - Shoulder Badge (NOT "Gold Badge")
  - Cel Bar
  - Beret Logo Pin
  - Belt No 3
  - Nametag (when from Uniform No 3 context)

**For Uniform No 4 Items:**
- Main items only: `"Uniform No 4"`
  - Uniform No 4 (merged cloth + pants)
  - Boot

- Accessories: `"Accessories No 4"` (NEW category)
  - APM Tag
  - Belt No 4
  - Nametag (when from Uniform No 4 context)

**For Shirts:**
- Category: `"Shirt"` (renamed from "T-Shirt")
  - Digital Shirt
  - Company Shirt
  - Inner APM Shirt

---

### 2. Update Uniform Item Data Structure

**When sending items to backend (PUT /api/members/uniform):**

```typescript
// ❌ OLD (deprecated but still works due to backward compatibility)
{
  category: "Uniform No 3",
  type: "Apulet",
  size: "N/A",
  quantity: 1
}

// ✅ NEW (correct format)
{
  category: "Accessories No 3",  // Use Accessories No 3 for accessories
  type: "Apulet",
  size: "",  // Empty string for accessories (not "N/A" or null)
  quantity: 1
}
```

---

### 3. Item Type to Category Mapping

**Create a mapping function in frontend:**

```typescript
// Helper function to determine category based on item type
function getCategoryForItemType(type: string, context?: 'Uniform No 3' | 'Uniform No 4'): string {
  const typeLower = type.toLowerCase();
  
  // Accessories for Uniform No 3
  const accessoriesNo3 = [
    'apulet', 'integrity badge', 'shoulder badge', 'gold badge',
    'cel bar', 'beret logo pin', 'belt no 3', 'nametag', 'name tag'
  ];
  
  // Accessories for Uniform No 4
  const accessoriesNo4 = [
    'apm tag', 'belt no 4', 'nametag', 'name tag'
  ];
  
  // Check if it's an accessory
  if (accessoriesNo3.some(acc => typeLower.includes(acc))) {
    // If context is provided and it's Uniform No 4, check if it's a No 4 accessory
    if (context === 'Uniform No 4' && accessoriesNo4.some(acc => typeLower.includes(acc))) {
      return 'Accessories No 4';
    }
    return 'Accessories No 3';
  }
  
  if (accessoriesNo4.some(acc => typeLower.includes(acc))) {
    return 'Accessories No 4';
  }
  
  // Main uniform items
  if (typeLower.includes('uniform no 3') || typeLower.includes('cloth no 3') || 
      typeLower.includes('pants no 3') || typeLower.includes('pvc shoes') || 
      typeLower.includes('beret')) {
    return 'Uniform No 3';
  }
  
  if (typeLower.includes('uniform no 4') || typeLower.includes('cloth no 4') || 
      typeLower.includes('pants no 4') || typeLower.includes('boot')) {
    return 'Uniform No 4';
  }
  
  // Shirts
  if (typeLower.includes('shirt')) {
    return 'Shirt';  // Use "Shirt" instead of "T-Shirt"
  }
  
  // Default fallback
  return 'Uniform No 3';
}
```

---

### 4. Update Form/Dropdown Options

**Uniform No 3 Section:**
```typescript
const uniformNo3MainItems = [
  { type: 'Uniform No 3 Male', category: 'Uniform No 3', hasSize: true },
  { type: 'Uniform No 3 Female', category: 'Uniform No 3', hasSize: true },
  { type: 'PVC Shoes', category: 'Uniform No 3', hasSize: true },
  { type: 'Beret', category: 'Uniform No 3', hasSize: true }
];

const accessoriesNo3Items = [
  { type: 'Apulet', category: 'Accessories No 3', hasSize: false },
  { type: 'Integrity Badge', category: 'Accessories No 3', hasSize: false },
  { type: 'Shoulder Badge', category: 'Accessories No 3', hasSize: false },
  { type: 'Cel Bar', category: 'Accessories No 3', hasSize: false },
  { type: 'Beret Logo Pin', category: 'Accessories No 3', hasSize: false },
  { type: 'Belt No 3', category: 'Accessories No 3', hasSize: false },
  { type: 'Nametag', category: 'Accessories No 3', hasSize: false } // Uses "N/A" in notes field
];
```

**Uniform No 4 Section:**
```typescript
const uniformNo4MainItems = [
  { type: 'Uniform No 4', category: 'Uniform No 4', hasSize: true },
  { type: 'Boot', category: 'Uniform No 4', hasSize: true }
];

const accessoriesNo4Items = [
  { type: 'APM Tag', category: 'Accessories No 4', hasSize: false },
  { type: 'Belt No 4', category: 'Accessories No 4', hasSize: false },
  { type: 'Nametag', category: 'Accessories No 4', hasSize: false } // Uses "N/A" in notes field
];
```

**Shirt Section:**
```typescript
const shirtItems = [
  { type: 'Digital Shirt', category: 'Shirt', hasSize: true },  // Use "Shirt" not "T-Shirt"
  { type: 'Company Shirt', category: 'Shirt', hasSize: true },
  { type: 'Inner APM Shirt', category: 'Shirt', hasSize: true }
];
```

---

### 5. Update Size Handling

**For Accessories:**
- Size should be empty string `""`, NOT `null` or `"N/A"`
- Backend expects `size: ""` (empty string) for accessories
- Only Nametag uses `size: ""` with `notes` containing the name text

**For Main Items:**
- Size should be actual size value (e.g., "M", "L", "8", "7 1/4")
- For shoes/boots, send size WITHOUT "UK" prefix (e.g., "8" not "UK 8")

**Example:**
```typescript
// ✅ CORRECT
{
  category: "Accessories No 3",
  type: "Apulet",
  size: "",  // Empty string
  quantity: 1,
  notes: null
}

// ❌ INCORRECT
{
  category: "Uniform No 3",  // Wrong category for accessory
  type: "Apulet",
  size: "N/A",  // Should be empty string, not "N/A"
  quantity: 1
}
```

---

### 6. Update API Request Format

**PUT /api/members/uniform - Request Body:**

```typescript
{
  items: [
    // Uniform No 3 - Main Items
    {
      category: "Uniform No 3",
      type: "Uniform No 3 Male",
      size: "M",
      quantity: 1,
      notes: null
    },
    {
      category: "Uniform No 3",
      type: "PVC Shoes",
      size: "8",  // No "UK" prefix
      quantity: 1,
      notes: null
    },
    
    // Uniform No 3 - Accessories (NEW category)
    {
      category: "Accessories No 3",  // NEW: Use Accessories No 3
      type: "Apulet",
      size: "",  // Empty string for accessories
      quantity: 1,
      notes: null
    },
    {
      category: "Accessories No 3",
      type: "Integrity Badge",
      size: "",  // Empty string
      quantity: 1,
      notes: null
    },
    {
      category: "Accessories No 3",
      type: "Nametag",
      size: "",  // Empty string (name goes in notes)
      quantity: 1,
      notes: "John Doe"  // Name text here
    },
    
    // Uniform No 4 - Main Items
    {
      category: "Uniform No 4",
      type: "Uniform No 4",
      size: "M",
      quantity: 1,
      notes: null
    },
    
    // Uniform No 4 - Accessories (NEW category)
    {
      category: "Accessories No 4",  // NEW: Use Accessories No 4
      type: "APM Tag",
      size: "",  // Empty string
      quantity: 1,
      notes: null
    },
    
    // Shirts (renamed category)
    {
      category: "Shirt",  // NEW: Use "Shirt" instead of "T-Shirt"
      type: "Digital Shirt",
      size: "L",
      quantity: 1,
      notes: null
    }
  ]
}
```

---

### 7. STRICT VALIDATION - NO BACKWARD COMPATIBILITY

**⚠️ CRITICAL: The backend STRICTLY enforces the 5 categories. Old category names are REJECTED:**

- ❌ `category: "Uniform No 3"` + `type: "Apulet"` → **400 ERROR**: "Invalid category for accessory. Must use 'Accessories No 3'"
- ✅ `category: "Accessories No 3"` + `type: "Apulet"` → **WORKS**
- ❌ `category: "T-Shirt"` → **400 ERROR**: "Use 'Shirt' instead of 'T-Shirt'"
- ✅ `category: "Shirt"` → **WORKS**

**The frontend MUST send the correct 5 categories:**
- "Uniform No 3" (for main items only)
- "Uniform No 4" (for main items only)
- "Accessories No 3" (for Uniform No 3 accessories)
- "Accessories No 4" (for Uniform No 4 accessories)
- "Shirt" (for all shirt types)

---

### 8. Response Format (What Backend Returns)

**GET /api/members/uniform - Response:**

```typescript
{
  success: true,
  uniform: {
    sispaId: "B1184040",
    items: [
      {
        category: "Accessories No 3",  // Backend returns normalized category
        type: "Apulet",
        size: "",
        quantity: 1,
        notes: null,
        status: "Available",
        receivedDate: "2024-01-15T10:30:00.000Z"
      },
      {
        category: "Uniform No 3",
        type: "Uniform No 3 Male",
        size: "M",
        quantity: 1,
        notes: null,
        status: "Available",
        receivedDate: "2024-01-15T10:30:00.000Z"
      },
      {
        category: "Shirt",  // Backend returns "Shirt" not "T-Shirt"
        type: "Digital Shirt",
        size: "L",
        quantity: 1,
        notes: null,
        status: "Available",
        receivedDate: "2024-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

---

### 9. Migration Strategy for Frontend

**Option 1: Update Immediately (Recommended)**
- Update all category references to use new 5-category structure
- Send accessories with "Accessories No 3" or "Accessories No 4"
- Send shirts with "Shirt" category
- Backend will work immediately

**Option 2: Gradual Update (If Needed)**
- Keep old category names for now
- Backend will normalize them
- Update frontend gradually over time
- **Note:** Backend logs will show normalization happening

---

### 10. Critical Changes Checklist

- [ ] Update category options in form/dropdown to include "Accessories No 3" and "Accessories No 4"
- [ ] Update category logic: When user selects "Apulet" type, automatically set category to "Accessories No 3"
- [ ] Update size handling: Use empty string `""` for accessories, not `null` or `"N/A"`
- [ ] Update "T-Shirt" category references to "Shirt"
- [ ] Update display labels to show 5 categories instead of 3
- [ ] Update item grouping/sorting to handle 5 categories
- [ ] Test saving items with new category structure
- [ ] Verify accessories are saved with "Accessories No 3" category

---

### 11. Example Frontend Code Update

**Before (Old Structure):**
```typescript
const handleSaveUniform = async (items: UniformItem[]) => {
  const itemsToSend = items.map(item => ({
    category: item.category, // Might be "Uniform No 3" for accessories
    type: item.type,
    size: item.size || "N/A",  // Uses "N/A" for accessories
    quantity: item.quantity
  }));
  
  await fetch('/api/members/uniform', {
    method: 'PUT',
    body: JSON.stringify({ items: itemsToSend })
  });
};
```

**After (New Structure):**
```typescript
const handleSaveUniform = async (items: UniformItem[]) => {
  const itemsToSend = items.map(item => {
    // Determine correct category based on type
    const correctCategory = getCategoryForItemType(item.type, item.category);
    
    // Normalize size: empty string for accessories
    let size = item.size || "";
    if (!item.hasSize || item.size === null || item.size === "N/A") {
      size = "";  // Empty string for accessories
    }
    
    return {
      category: correctCategory, // Use correct category (Accessories No 3/4 for accessories)
      type: item.type,
      size: size,  // Empty string for accessories, actual size for main items
      quantity: item.quantity,
      notes: item.notes || null
    };
  });
  
  await fetch('/api/members/uniform', {
    method: 'PUT',
    body: JSON.stringify({ items: itemsToSend })
  });
};

// Helper function
function getCategoryForItemType(type: string, currentCategory?: string): string {
  const typeLower = type.toLowerCase();
  
  // Accessories No 3
  if (['apulet', 'integrity badge', 'shoulder badge', 'cel bar', 'beret logo pin', 'belt no 3'].some(acc => typeLower.includes(acc))) {
    return 'Accessories No 3';
  }
  
  // Accessories No 4
  if (['apm tag', 'belt no 4'].some(acc => typeLower.includes(acc))) {
    return 'Accessories No 4';
  }
  
  // Nametag - depends on context
  if (typeLower.includes('nametag') || typeLower.includes('name tag')) {
    if (currentCategory?.toLowerCase().includes('no 4') || currentCategory?.toLowerCase().includes('uniform no 4')) {
      return 'Accessories No 4';
    }
    return 'Accessories No 3'; // Default to No 3
  }
  
  // Main items
  if (typeLower.includes('uniform no 3') || typeLower.includes('cloth no 3') || 
      typeLower.includes('pants no 3') || typeLower.includes('pvc shoes') || 
      typeLower.includes('beret')) {
    return 'Uniform No 3';
  }
  
  if (typeLower.includes('uniform no 4') || typeLower.includes('cloth no 4') || 
      typeLower.includes('pants no 4') || typeLower.includes('boot')) {
    return 'Uniform No 4';
  }
  
  // Shirts
  if (typeLower.includes('shirt')) {
    return 'Shirt';  // Not "T-Shirt"
  }
  
  return currentCategory || 'Uniform No 3'; // Fallback
}
```

---

### 12. Testing Checklist

**Test Cases:**
- [ ] Save Uniform No 3 main item (e.g., "Uniform No 3 Male") → Category should be "Uniform No 3"
- [ ] Save accessory with old category "Uniform No 3" → Backend should normalize to "Accessories No 3" (works but not recommended)
- [ ] Save accessory with new category "Accessories No 3" → Should work correctly
- [ ] Save accessory with size empty string `""` → Should work correctly
- [ ] Save accessory with size `null` → Backend should normalize to empty string (works but not recommended)
- [ ] Save accessory with size `"N/A"` → Backend should normalize to empty string (works but not recommended)
- [ ] Save shirt with category "Shirt" → Should work correctly
- [ ] Save shirt with category "T-Shirt" → Backend should normalize to "Shirt" (works but not recommended)
- [ ] Verify all items save successfully without 500 errors
- [ ] Verify items appear correctly in admin member uniform view

---

### 13. Important Notes

1. **Backend Normalization:** The backend will automatically normalize old category names, so the frontend update is not strictly required, but it's recommended for consistency.

2. **Size Format:** Accessories should use empty string `""` for size. The backend will normalize `null` or `"N/A"` to empty string, but it's better to send the correct format from the start.

3. **Category Detection:** Frontend should determine the correct category based on the item TYPE, not just accept whatever the user selects. This ensures accessories are always sent with the correct category.

4. **Backward Compatibility:** The backend accepts both old and new category names, so you can update the frontend gradually if needed.

---

### 14. Quick Fix (Minimum Changes)

**If you want to make minimal changes to frontend right now:**

1. **Before sending to API, normalize categories:**
```typescript
const normalizedItems = items.map(item => {
  // Check if item type is an accessory
  const isAccessory = ['apulet', 'integrity badge', 'shoulder badge', 'cel bar', 
                       'beret logo pin', 'belt no 3', 'apm tag', 'belt no 4']
                     .some(acc => item.type.toLowerCase().includes(acc.toLowerCase()));
  
  let category = item.category;
  
  // Normalize accessories
  if (isAccessory) {
    if (item.category === 'Uniform No 3' || item.category?.toLowerCase().includes('no 3')) {
      // Check if it's a No 4 accessory
      if (['apm tag', 'belt no 4'].some(acc => item.type.toLowerCase().includes(acc))) {
        category = 'Accessories No 4';
      } else {
        category = 'Accessories No 3';
      }
    } else if (item.category === 'Uniform No 4' || item.category?.toLowerCase().includes('no 4')) {
      category = 'Accessories No 4';
    }
  }
  
  // Normalize shirt category
  if (item.category === 'T-Shirt') {
    category = 'Shirt';
  }
  
  // Normalize size for accessories
  let size = item.size;
  if (isAccessory && (!size || size === 'N/A' || size === null)) {
    size = '';
  }
  
  return {
    ...item,
    category: category,
    size: size
  };
});
```

2. **Use normalized items when calling API:**
```typescript
await fetch('/api/members/uniform', {
  method: 'PUT',
  body: JSON.stringify({ items: normalizedItems })
});
```

---

## Summary

**Frontend Should Send:**
- ✅ `category: "Accessories No 3"` for Uniform No 3 accessories
- ✅ `category: "Accessories No 4"` for Uniform No 4 accessories
- ✅ `category: "Shirt"` for all shirt types (not "T-Shirt")
- ✅ `size: ""` (empty string) for accessories (not `null` or `"N/A"`)

**Backend Will Accept:**
- ✅ New category names (preferred)
- ✅ Old category names (normalized automatically)
- ✅ Both old and new category formats

**Priority:**
- 🔴 **HIGH:** Ensure accessories use empty string `""` for size (not null or "N/A")
- 🟡 **MEDIUM:** Update to use new category names ("Accessories No 3/4", "Shirt")
- 🟢 **LOW:** Backend normalization handles old category names, so immediate frontend update is optional

---

**End of Frontend Update Instructions**
