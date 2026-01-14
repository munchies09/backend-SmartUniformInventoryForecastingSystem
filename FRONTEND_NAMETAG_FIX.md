# Frontend Fix: Nametag Category Handling

## Problem
When updating "Nametag" in the user UI under "Accessories No 4", it appears in "Accessories No 3" in the admin UI instead. The "Nametag" column in "Accessories No 4" admin UI still shows "N/A".

## Root Cause
"Nametag" can exist in **BOTH** "Accessories No 3" and "Accessories No 4" categories. The backend now correctly handles this, but the frontend must ensure it sends the correct category.

## Backend Behavior (Fixed)
✅ The backend now **preserves** the category when "Nametag" is sent with:
- `category: "Accessories No 3"` → Saved as "Accessories No 3"
- `category: "Accessories No 4"` → Saved as "Accessories No 4"

## Frontend Requirements

### ⚠️ CRITICAL: "Nametag No 3" and "Nametag No 4" are DIFFERENT Items

**"Nametag No 3" and "Nametag No 4" are completely separate items.** They must be sent with different type names:

### 1. When Sending Nametag to Backend

**CRITICAL:** Use the **specific type name** that matches the category:

```typescript
// ✅ CORRECT: When user is in "Accessories No 4" section
{
  category: "Accessories No 4",  // MUST be "Accessories No 4"
  type: "Nametag No 4",  // OR "Name Tag No 4" - MUST include "No 4"
  size: "",  // Empty string for accessories
  quantity: 1,
  notes: "KAMAL ALI"  // Or use the name field if you have one
}

// ✅ CORRECT: When user is in "Accessories No 3" section
{
  category: "Accessories No 3",  // MUST be "Accessories No 3"
  type: "Nametag No 3",  // OR "Name Tag No 3" - MUST include "No 3"
  size: "",  // Empty string for accessories
  quantity: 1,
  notes: "KAMAL ALI"
}

// ❌ WRONG: Don't use generic "Nametag" - use specific type
{
  category: "Accessories No 4",
  type: "Nametag",  // ❌ Too generic - backend will try to infer, but may get it wrong
  ...
}
```

### 2. When Updating Existing Nametag

**CRITICAL:** When updating a Nametag, you must:
1. **Preserve the existing category** from the database
2. **OR** explicitly set the category based on which section the user is editing

```typescript
// When updating Nametag in "Accessories No 4" section
const updateNametag = async (nametagData: any, section: 'Accessories No 3' | 'Accessories No 4') => {
  const payload = {
    items: [{
      category: section,  // Use the section category explicitly
      type: "Nametag",
      size: "",
      quantity: 1,
      notes: nametagData.name || nametagData.notes || ""
    }]
  };
  
  await fetch('/api/members/uniform', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
};
```

### 3. When Fetching/Displaying Nametag

**CRITICAL:** Filter Nametag items by category when displaying:

```typescript
// When displaying "Accessories No 4" section
const accessoriesNo4Items = uniform.items.filter(item => 
  item.category === "Accessories No 4"
);

// Find Nametag in Accessories No 4
const nametagNo4 = accessoriesNo4Items.find(item => 
  item.type.toLowerCase().includes('nametag') || 
  item.type.toLowerCase().includes('name tag')
);

// When displaying "Accessories No 3" section
const accessoriesNo3Items = uniform.items.filter(item => 
  item.category === "Accessories No 3"
);

// Find Nametag in Accessories No 3
const nametagNo3 = accessoriesNo3Items.find(item => 
  item.type.toLowerCase().includes('nametag') || 
  item.type.toLowerCase().includes('name tag')
);
```

### 4. Key Points

1. **"Nametag No 3" and "Nametag No 4" are DIFFERENT items** - A user can have:
   - One "Nametag No 3" in "Accessories No 3"
   - One "Nametag No 4" in "Accessories No 4"
   - They are **completely separate items** in the database with different type names

2. **Type name must match category** - The backend uses `(category, type, size)` as the unique identifier, so:
   - `("Accessories No 3", "Name Tag No 3", "")` is a different item from
   - `("Accessories No 4", "Name Tag No 4", "")`
   - **Always use the specific type name: "Nametag No 3" or "Nametag No 4"**

3. **Backend normalizes type names** - The backend accepts:
   - "Nametag No 3" → Normalized to "Name Tag No 3"
   - "Nametag No 4" → Normalized to "Name Tag No 4"
   - "Name Tag No 3" → Kept as "Name Tag No 3"
   - "Name Tag No 4" → Kept as "Name Tag No 4"

3. **Always send the correct category AND type** - When saving/updating, use BOTH:
   - If user is editing in "Accessories No 4" tab → send:
     - `category: "Accessories No 4"`
     - `type: "Nametag No 4"` (or "Name Tag No 4")
   - If user is editing in "Accessories No 3" tab → send:
     - `category: "Accessories No 3"`
     - `type: "Nametag No 3"` (or "Name Tag No 3")

### 5. Example Implementation

```typescript
// In your component for "Accessories No 4" section
const handleSaveNametag = async (name: string) => {
  const payload = {
    items: [{
      category: "Accessories No 4",  // ✅ Explicitly set to Accessories No 4
      type: "Nametag No 4",  // ✅ MUST use "Nametag No 4" (or "Name Tag No 4")
      size: "",  // Empty string for accessories
      quantity: 1,
      notes: name  // Store the name in notes field
    }]
  };
  
  try {
    const response = await fetch('/api/members/uniform', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error('Failed to save Nametag');
    }
    
    // Refresh the uniform data
    await fetchUniform();
  } catch (error) {
    console.error('Error saving Nametag:', error);
  }
};

// When displaying, filter by category AND type
const getNametagForSection = (section: 'Accessories No 3' | 'Accessories No 4') => {
  const expectedType = section === 'Accessories No 4' ? 'name tag no 4' : 'name tag no 3';
  return uniform.items.find(item => 
    item.category === section &&
    (item.type.toLowerCase().includes(expectedType) ||
     (section === 'Accessories No 4' && (item.type.toLowerCase().includes('nametag no 4') || item.type.toLowerCase().includes('name tag no 4'))) ||
     (section === 'Accessories No 3' && (item.type.toLowerCase().includes('nametag no 3') || item.type.toLowerCase().includes('name tag no 3'))))
  );
};
```

## Testing Checklist

- [ ] Save "Nametag No 4" in "Accessories No 4" section → Should appear in "Accessories No 4" admin view
- [ ] Save "Nametag No 3" in "Accessories No 3" section → Should appear in "Accessories No 3" admin view
- [ ] Update "Nametag No 4" in "Accessories No 4" → Should update the correct item (not the No 3 one)
- [ ] Both Nametags can exist simultaneously (one "Nametag No 3" in No 3, one "Nametag No 4" in No 4)
- [ ] Admin UI shows "Nametag No 3" in "Accessories No 3" column
- [ ] Admin UI shows "Nametag No 4" in "Accessories No 4" column
- [ ] Type names are correctly normalized: "Nametag No 3" → "Name Tag No 3", "Nametag No 4" → "Name Tag No 4"

## Backend Logs

The backend now logs:
- `📥 Incoming items BEFORE normalization` - Shows what frontend sent
- `📤 Normalized items AFTER normalization` - Shows what will be saved
- `✅ Preserving "Accessories No 4" category for Nametag` - Confirms category preservation

Check the backend console to verify the frontend is sending the correct category.
