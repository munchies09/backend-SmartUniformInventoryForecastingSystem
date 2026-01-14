# Frontend Update: Uniform No 4 Type Merge

## Overview

The backend has been updated to merge "Cloth No 4" and "Pants No 4" into a single type **"Uniform No 4"** since they come as a pair.

## Changes Required

### 1. Update Type Labels in Frontend

**Location:** Wherever you define uniform types (likely in a constants file or component)

**Before:**
```typescript
const uniformNo4Types = [
  'Cloth No 4',
  'Pants No 4',
  'Boot',
  // ... other types
];
```

**After:**
```typescript
const uniformNo4Types = [
  'Uniform No 4',  // Merged: replaces both "Cloth No 4" and "Pants No 4"
  'Boot',
  // ... other types
];
```

### 2. Update Display Labels

Since "Uniform No 4" represents both cloth and pants together, you can show it as:

**Option 1: Simple label**
```typescript
'Uniform No 4'  // Display as-is
```

**Option 2: Descriptive label**
```typescript
const typeDisplayLabels: Record<string, string> = {
  'Uniform No 4': 'Uniform No 4 (Cloth & Pants)',
  // ... other mappings
};
```

### 3. Update API Requests

All API requests that send uniform data must use the new type name:

**Before:**
```json
{
  "category": "Uniform No 4",
  "type": "Cloth No 4",  // or "Pants No 4"
  "size": "M",
  "quantity": 1
}
```

**After:**
```json
{
  "category": "Uniform No 4",
  "type": "Uniform No 4",  // Single type for both cloth and pants
  "size": "M",
  "quantity": 1
}
```

### 4. Update Inventory Management

If you have inventory management screens, update the type dropdowns/selectors:

**Before:**
- Dropdown shows: "Cloth No 4", "Pants No 4"

**After:**
- Dropdown shows: "Uniform No 4" (single option)

### 5. Update Member Uniform Forms

Update any forms where members select their uniform items:

**Example Component Update:**
```typescript
// Before
const typeOptions = [
  { value: 'Cloth No 4', label: 'Cloth No 4' },
  { value: 'Pants No 4', label: 'Pants No 4' },
  // ...
];

// After
const typeOptions = [
  { value: 'Uniform No 4', label: 'Uniform No 4' },
  // ...
];
```

### 6. Handle Existing Data (If Needed)

If you have existing data in your frontend state/localStorage that uses old type names, you may need to migrate it:

```typescript
// Migration function (run once on app load)
function migrateUniformNo4Types(data: any) {
  if (data.type === 'Cloth No 4' || data.type === 'Pants No 4' || data.type === 'Pant No 4') {
    data.type = 'Uniform No 4';
  }
  return data;
}
```

## Backend Compatibility

✅ **Backward Compatibility:** The backend will accept both old and new type names for a transition period:
- ✅ "Cloth No 4" → Accepted (mapped to "Uniform No 4")
- ✅ "Pants No 4" → Accepted (mapped to "Uniform No 4")
- ✅ "Pant No 4" → Accepted (mapped to "Uniform No 4")
- ✅ "Uniform No 4" → Accepted (new format)

**However, it's recommended to update the frontend to use the new name immediately for consistency.**

## API Endpoints Affected

All endpoints that accept or return uniform types:

1. **POST /api/inventory** - Create inventory item
2. **PUT /api/inventory/:id** - Update inventory item
3. **GET /api/inventory** - Get all inventory (returns new type name)
4. **POST /api/members/uniform** - Add member uniform items
5. **PUT /api/members/uniform** - Update member uniform items
6. **GET /api/members/uniform** - Get member uniform (returns new type name)

## Important Notes

### Why Merge?

- **Cloth No 4** and **Pants No 4** come as a **pair** (one set)
- It's more logical to track them as a single inventory item
- Simplifies inventory management
- Matches real-world usage (members receive both together)

### Inventory Implications

- If you had separate inventory entries for "Cloth No 4" and "Pants No 4" with the same size, they will both be converted to "Uniform No 4"
- You may need to manually merge quantities if you had separate entries
- The migration script will identify potential duplicates for review

## Testing Checklist

- [ ] Update type constants/definitions
- [ ] Update dropdown/select components
- [ ] Update form components
- [ ] Test creating inventory items with new type name
- [ ] Test updating inventory items
- [ ] Test member uniform selection/update
- [ ] Verify API responses use new type name
- [ ] Test backward compatibility (old names still work)
- [ ] Update any hardcoded type checks in code
- [ ] Check for duplicate inventory entries after migration

## Example Frontend Code

### Type Definitions
```typescript
// constants/uniformTypes.ts
export const UNIFORM_NO_4_TYPES = [
  'Uniform No 4',  // Merged: replaces "Cloth No 4" and "Pants No 4"
  'Boot',
  'APM Tag',
  'Belt No 4'
] as const;

export type UniformNo4Type = typeof UNIFORM_NO_4_TYPES[number];
```

### Component Usage
```typescript
// components/UniformSelector.tsx
import { UNIFORM_NO_4_TYPES } from '@/constants/uniformTypes';

function UniformSelector() {
  return (
    <select>
      {UNIFORM_NO_4_TYPES.map(type => (
        <option key={type} value={type}>
          {type === 'Uniform No 4' ? 'Uniform No 4 (Cloth & Pants)' : type}
        </option>
      ))}
    </select>
  );
}
```

### API Request
```typescript
// services/uniformService.ts
async function addInventoryItem(item: {
  category: string;
  type: string;
  size: string | null;
  quantity: number;
}) {
  const response = await fetch('/api/inventory', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      category: item.category,
      type: item.type, // Use "Uniform No 4" (replaces "Cloth No 4" and "Pants No 4")
      size: item.size,
      quantity: item.quantity
    })
  });
  return response.json();
}
```

## Summary

**Key Changes:**
1. ✅ Replace "Cloth No 4" with "Uniform No 4"
2. ✅ Replace "Pants No 4" with "Uniform No 4"
3. ✅ Update all type definitions/constants
4. ✅ Update all UI components that display/select types
5. ✅ Update API request payloads
6. ✅ Test all uniform-related functionality
7. ✅ Check for duplicate inventory entries after migration

**Backend Status:**
- ✅ New type name is validated
- ✅ Old type names are accepted (backward compatible)
- ✅ All endpoints support both old and new names

**Frontend Action Required:**
- Update to use new type name: "Uniform No 4"
- Remove separate "Cloth No 4" and "Pants No 4" options
- Display as single "Uniform No 4" option
