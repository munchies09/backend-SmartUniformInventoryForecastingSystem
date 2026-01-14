# Missing Count Implementation

## Overview
The backend now automatically tracks and increments `missingCount` when an item's status changes to "Missing". This count represents how many times the item has been marked as "Missing".

## Backend Behavior

### 1. Automatic Increment
When an item's status changes from any status (e.g., "Available", "Not Available") to "Missing":
- `missingCount` is automatically incremented by 1
- If the item didn't have a `missingCount` before, it starts at 1
- The count is preserved even if status changes back to "Available" or "Not Available" (for history)

### 2. New Items
When a new item is created with status "Missing":
- `missingCount` is automatically set to 1
- Frontend doesn't need to send `missingCount` - backend handles it

### 3. API Response
The backend **always includes** `missingCount` in the API response when:
- Status is "Missing"
- Even if `missingCount` is not in the database, it defaults to 1

**Example Response:**
```json
{
  "category": "Accessories No 3",
  "type": "Apulet",
  "status": "Missing",
  "missingCount": 2,  // ← Always included when status is "Missing"
  "size": "",
  "quantity": 1
}
```

## Frontend Requirements

### 1. Display Logic
The frontend should display `missingCount` when status is "Missing":

```typescript
// Example display logic
{item.status === 'Missing' && (
  <div>
    <span>Missing</span>
    {item.missingCount && item.missingCount > 0 && (
      <span>({item.missingCount} times)</span>
    )}
  </div>
)}
```

### 2. Sending Updates
When updating status to "Missing", the frontend can:
- **Option 1:** Just send the status (backend will auto-increment)
  ```json
  {
    "category": "Accessories No 3",
    "type": "Apulet",
    "status": "Missing"
    // missingCount not needed - backend handles it
  }
  ```

- **Option 2:** Send both status and missingCount (if frontend wants to set a specific value)
  ```json
  {
    "category": "Accessories No 3",
    "type": "Apulet",
    "status": "Missing",
    "missingCount": 3  // Frontend can override, but backend will increment if status changes
  }
  ```

### 3. Field Names
The backend sends `missingCount` (camelCase). The frontend should check for:
- `item.missingCount` (preferred)
- `item.missing_count` (snake_case - for backward compatibility)

## How It Works

### Scenario 1: First Time Marking as Missing
1. Item has status "Available" (no `missingCount`)
2. User changes status to "Missing"
3. Backend sets `missingCount = 1`
4. Response includes: `"status": "Missing", "missingCount": 1`

### Scenario 2: Item Already Missing
1. Item has status "Missing" with `missingCount = 1`
2. User changes status to "Available"
3. Backend keeps `missingCount = 1` (for history)
4. Response includes: `"status": "Available"` (no missingCount)

### Scenario 3: Marking as Missing Again
1. Item has status "Available" with `missingCount = 1` (from previous time)
2. User changes status to "Missing" again
3. Backend increments: `missingCount = 1 + 1 = 2`
4. Response includes: `"status": "Missing", "missingCount": 2`

### Scenario 4: New Item Created as Missing
1. User creates new item with status "Missing"
2. Backend sets `missingCount = 1` automatically
3. Response includes: `"status": "Missing", "missingCount": 1`

## Backend Logs

The backend logs missingCount operations:
- `📈 Incremented missingCount for Apulet: 0 → 1 (status changed to Missing)`
- `📊 Updated missingCount for Apulet to 3 (frontend provided value)`
- `📋 Status changed from Missing to Available for Apulet - keeping missingCount: 2`

## Testing

1. **Test Increment:**
   - Set status to "Missing" → `missingCount` should be 1
   - Change to "Available" → `missingCount` should still be 1 (preserved)
   - Change back to "Missing" → `missingCount` should be 2

2. **Test New Item:**
   - Create new item with status "Missing" → `missingCount` should be 1

3. **Test API Response:**
   - GET `/api/members/:sispaId/uniform` → Items with status "Missing" should include `missingCount`

4. **Test Frontend Display:**
   - Check browser console for `[DEBUG] Missing item` logs
   - Verify `missingCount` is present in the logged item object

## Summary

✅ Backend automatically tracks and increments `missingCount`
✅ Backend always includes `missingCount` in response when status is "Missing"
✅ Frontend just needs to display the `missingCount` value
✅ No frontend changes needed for tracking - backend handles it automatically
