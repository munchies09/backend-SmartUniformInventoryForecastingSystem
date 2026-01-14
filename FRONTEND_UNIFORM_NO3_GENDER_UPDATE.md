# Frontend Update: Uniform No 3 Gender-Specific Types

## Overview

The backend has been updated to use gender-specific types for Uniform No 3:
- **"Cloth No 3"** → **"Uniform No 3 Male"**
- **"Pants No 3"** → **"Uniform No 3 Female"**

## Changes Required

### 1. Update Type Labels in Frontend

**Location:** Wherever you define uniform types (likely in a constants file or component)

**Before:**
```typescript
const uniformNo3Types = [
  'Cloth No 3',
  'Pants No 3',
  'PVC Shoes',
  'Beret',
  // ... other types
];
```

**After:**
```typescript
const uniformNo3Types = [
  'Uniform No 3 Male',      // Changed from "Cloth No 3"
  'Uniform No 3 Female',  // Changed from "Pants No 3"
  'PVC Shoes',
  'Beret',
  // ... other types
];
```

### 2. Update Display Labels (Optional)

If you want to show shorter labels in the UI while using full names in the backend:

**Example:**
```typescript
const typeDisplayLabels: Record<string, string> = {
  'Uniform No 3 Male': 'Cloth No 3 (Male)',
  'Uniform No 3 Female': 'Pants No 3 (Female)',
  // ... other mappings
};

// Usage in component
const displayLabel = typeDisplayLabels[type] || type;
```

### 3. Update API Requests

All API requests that send uniform data must use the new type names:

**Before:**
```json
{
  "category": "Uniform No 3",
  "type": "Cloth No 3",
  "size": "M",
  "quantity": 1
}
```

**After:**
```json
{
  "category": "Uniform No 3",
  "type": "Uniform No 3 Male",
  "size": "M",
  "quantity": 1
}
```

### 4. Update Inventory Management

If you have inventory management screens, update the type dropdowns/selectors:

**Before:**
- Dropdown shows: "Cloth No 3", "Pants No 3"

**After:**
- Dropdown shows: "Uniform No 3 Male", "Uniform No 3 Female"

### 5. Update Member Uniform Forms

Update any forms where members select their uniform items:

**Example Component Update:**
```typescript
// Before
const typeOptions = [
  { value: 'Cloth No 3', label: 'Cloth No 3' },
  { value: 'Pants No 3', label: 'Pants No 3' },
  // ...
];

// After
const typeOptions = [
  { value: 'Uniform No 3 Male', label: 'Uniform No 3 Male' },
  { value: 'Uniform No 3 Female', label: 'Uniform No 3 Female' },
  // ...
];
```

### 6. Handle Existing Data (If Needed)

If you have existing data in your frontend state/localStorage that uses old type names, you may need to migrate it:

```typescript
// Migration function (run once on app load)
function migrateUniformTypes(data: any) {
  if (data.type === 'Cloth No 3') {
    data.type = 'Uniform No 3 Male';
  } else if (data.type === 'Pants No 3') {
    data.type = 'Uniform No 3 Female';
  }
  return data;
}
```

## Backend Compatibility

✅ **Backward Compatibility:** The backend will accept both old and new type names for a transition period:
- ✅ "Cloth No 3" → Accepted (mapped to "Uniform No 3 Male")
- ✅ "Pants No 3" → Accepted (mapped to "Uniform No 3 Female")
- ✅ "Uniform No 3 Male" → Accepted (new format)
- ✅ "Uniform No 3 Female" → Accepted (new format)

**However, it's recommended to update the frontend to use the new names immediately for consistency.**

## API Endpoints Affected

All endpoints that accept or return uniform types:

1. **POST /api/inventory** - Create inventory item
2. **PUT /api/inventory/:id** - Update inventory item
3. **GET /api/inventory** - Get all inventory (returns new type names)
4. **POST /api/members/uniform** - Add member uniform items
5. **PUT /api/members/uniform** - Update member uniform items
6. **GET /api/members/uniform** - Get member uniform (returns new type names)

## Testing Checklist

- [ ] Update type constants/definitions
- [ ] Update dropdown/select components
- [ ] Update form components
- [ ] Test creating inventory items with new type names
- [ ] Test updating inventory items
- [ ] Test member uniform selection/update
- [ ] Verify API responses use new type names
- [ ] Test backward compatibility (old names still work)
- [ ] Update any hardcoded type checks in code

## Example Frontend Code

### Type Definitions
```typescript
// constants/uniformTypes.ts
export const UNIFORM_NO_3_TYPES = [
  'Uniform No 3 Male',
  'Uniform No 3 Female',
  'PVC Shoes',
  'Beret',
  'Apulet',
  'Integrity Badge',
  'Gold Badge',
  'Cel Bar',
  'Beret Logo Pin',
  'Belt No 3'
] as const;

export type UniformNo3Type = typeof UNIFORM_NO_3_TYPES[number];
```

### Component Usage
```typescript
// components/UniformSelector.tsx
import { UNIFORM_NO_3_TYPES } from '@/constants/uniformTypes';

function UniformSelector() {
  return (
    <select>
      {UNIFORM_NO_3_TYPES.map(type => (
        <option key={type} value={type}>
          {type}
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
      type: item.type, // Use "Uniform No 3 Male" or "Uniform No 3 Female"
      size: item.size,
      quantity: item.quantity
    })
  });
  return response.json();
}
```

## Summary

**Key Changes:**
1. ✅ Replace "Cloth No 3" with "Uniform No 3 Male"
2. ✅ Replace "Pants No 3" with "Uniform No 3 Female"
3. ✅ Update all type definitions/constants
4. ✅ Update all UI components that display/select types
5. ✅ Update API request payloads
6. ✅ Test all uniform-related functionality

**Backend Status:**
- ✅ New type names are validated
- ✅ Old type names are accepted (backward compatible)
- ✅ All endpoints support both old and new names

**Frontend Action Required:**
- Update to use new type names: "Uniform No 3 Male" and "Uniform No 3 Female"
