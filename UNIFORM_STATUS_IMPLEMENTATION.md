# Uniform Item Status Feature - Backend Implementation ✅

## Summary

The backend has been updated to support status tracking for uniform items. Status fields (`status`, `missingCount`, `receivedDate`) are now included in uniform item responses for the admin member page.

---

## ✅ Changes Implemented

### 1. Database Schema Updates

**File:** `src/models/uniformModel.ts`

#### ✅ `IUniformItem` Interface

**Added Fields:**
- `status?: 'Available' | 'Not Available' | 'Missing'` - Optional status field
- `missingCount?: number` - Optional: count of times this item has been missing for this user
- `receivedDate?: Date | string` - Optional: date when item was received/issued (ISO date string)

**Updated Interface:**
```typescript
export interface IUniformItem {
  category: string;
  type: string;
  size: string;
  quantity: number;
  color?: string;
  notes?: string;
  status?: 'Available' | 'Not Available' | 'Missing'; // NEW
  missingCount?: number; // NEW
  receivedDate?: Date | string; // NEW
}
```

#### ✅ `memberUniformSchema` Items Array

**Added Fields to Items Schema:**
```typescript
items: [{
  // ... existing fields ...
  status: { 
    type: String, 
    enum: ['Available', 'Not Available', 'Missing'],
    default: undefined,
    required: false
  },
  missingCount: { 
    type: Number, 
    default: undefined,
    required: false,
    min: 0
  },
  receivedDate: { 
    type: Date, 
    default: undefined,
    required: false
  }
}]
```

---

### 2. Helper Function Created

**File:** `src/controllers/uniformController.ts`

#### ✅ `formatUniformItemsWithStatus()` Function

**Purpose:** Formats uniform items to include status fields in API responses

**Logic:**
1. If item has `status` in database → Use it
2. If `status` is "Missing" → Include `missingCount` if available
3. If `status` is "Available" → Include `receivedDate` if available, otherwise use uniform `createdAt`
4. If no `status` in database → Default to "Available" with `receivedDate` = uniform `createdAt`

**Code:**
```typescript
function formatUniformItemsWithStatus(
  items: any[],
  uniformCreatedAt: Date,
  uniformUpdatedAt: Date
): any[] {
  return items.map((item: any) => {
    const itemData: any = {
      category: item.category,
      type: item.type,
      size: item.size,
      quantity: item.quantity,
      notes: item.notes || null
    };

    // Add status fields if they exist in the item, otherwise calculate default
    if (item.status !== undefined && item.status !== null) {
      itemData.status = item.status;
      
      if (item.status === 'Missing' && item.missingCount !== undefined && item.missingCount !== null) {
        itemData.missingCount = item.missingCount;
      }
      
      if (item.status === 'Available') {
        if (item.receivedDate) {
          itemData.receivedDate = item.receivedDate instanceof Date 
            ? item.receivedDate.toISOString() 
            : item.receivedDate;
        } else {
          itemData.receivedDate = uniformCreatedAt.toISOString();
        }
      }
    } else {
      // Default: items in uniform are "Available"
      itemData.status = 'Available';
      itemData.receivedDate = uniformCreatedAt.toISOString();
    }

    return itemData;
  });
}
```

---

### 3. API Endpoint Updates

#### ✅ GET /api/members/:sispaId/uniform (Admin Endpoint)

**File:** `src/controllers/uniformController.ts` - `getMemberUniformBySispaId()`

**Changes:**
- ✅ Returns `status` field for each item
- ✅ Returns `missingCount` when status is "Missing"
- ✅ Returns `receivedDate` when status is "Available"
- ✅ Defaults to "Available" with `receivedDate` if status not set

**Response Format:**
```json
{
  "success": true,
  "uniform": {
    "sispaId": "B1184040",
    "items": [
      {
        "category": "Uniform No 3",
        "type": "Digital Shirt",
        "size": "XL",
        "quantity": 1,
        "notes": null,
        "status": "Available",
        "receivedDate": "2024-01-15T10:30:00.000Z"
      },
      {
        "category": "Uniform No 3",
        "type": "Uniform No 3 Male",
        "size": "M",
        "quantity": 1,
        "notes": null,
        "status": "Missing",
        "missingCount": 3
      },
      {
        "category": "Uniform No 3",
        "type": "Beret",
        "size": "N/A",
        "quantity": 1,
        "notes": null,
        "status": "Not Available"
      }
    ],
    "itemCount": 3,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

#### ✅ GET /api/members/uniform (Member Endpoint)

**File:** `src/controllers/uniformController.ts` - `getMemberUniform()`

**Changes:**
- ✅ Also includes status fields (for consistency)
- ✅ Uses same formatting logic

---

#### ✅ GET /api/inventory/my-uniform (Member Endpoint)

**File:** `src/controllers/uniformController.ts` - `getOwnUniform()`

**Changes:**
- ✅ Also includes status fields (for consistency)
- ✅ Uses same formatting logic

---

## 📋 Status Field Behavior

### Default Behavior

**Items in Uniform Collection:**
- **Status:** "Available" (default)
- **receivedDate:** Uniform `createdAt` date (when uniform was first created/issued)
- **missingCount:** Not included (only for "Missing" status)

**Reasoning:**
- Items in `MemberUniform` collection have been issued/received by the member
- Therefore, they are "Available" by default
- `receivedDate` represents when the uniform was created/issued

---

### Custom Status (When Set in Database)

**If item has `status` field in database:**
- Use the stored status value
- Include `missingCount` if status is "Missing"
- Include `receivedDate` if status is "Available"

**Example Database Document:**
```javascript
{
  sispaId: "B1184040",
  items: [
    {
      category: "Uniform No 3",
      type: "Uniform No 3 Male",
      size: "M",
      quantity: 1,
      status: "Missing",  // Custom status
      missingCount: 3     // Custom missing count
    }
  ]
}
```

---

## 📝 Example API Responses

### Example 1: Items with Default Status (Available)

**Request:**
```http
GET /api/members/B1184040/uniform
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "uniform": {
    "sispaId": "B1184040",
    "items": [
      {
        "category": "Uniform No 3",
        "type": "Digital Shirt",
        "size": "XL",
        "quantity": 1,
        "notes": null,
        "status": "Available",
        "receivedDate": "2024-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

---

### Example 2: Items with Custom Status (Missing)

**Request:**
```http
GET /api/members/B1184040/uniform
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "uniform": {
    "sispaId": "B1184040",
    "items": [
      {
        "category": "Uniform No 3",
        "type": "Uniform No 3 Male",
        "size": "M",
        "quantity": 1,
        "notes": null,
        "status": "Missing",
        "missingCount": 3
      }
    ]
  }
}
```

---

### Example 3: Items with Custom Status (Not Available)

**Request:**
```http
GET /api/members/B1184040/uniform
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "uniform": {
    "sispaId": "B1184040",
    "items": [
      {
        "category": "Uniform No 3",
        "type": "Beret",
        "size": "N/A",
        "quantity": 1,
        "notes": null,
        "status": "Not Available"
      }
    ]
  }
}
```

---

## 🔄 Status Field Logic

### Status Values

1. **"Available"**
   - Item has been issued/received by the member
   - Includes `receivedDate` (ISO date string)
   - Default status for items in uniform collection

2. **"Not Available"**
   - Item is not currently available (not yet issued or out of stock)
   - No additional fields required

3. **"Missing"**
   - Item is expected but missing/lost
   - Includes `missingCount` (number of times this item has been missing for this user)
   - Requires separate tracking system to set this status

---

## 🗄️ Database Considerations

### Current Implementation

**Status Storage:**
- Status fields are stored in the `items` array of `MemberUniform` documents
- Fields are optional (can be `undefined` or `null`)
- If not set, defaults to "Available" with `receivedDate` = uniform `createdAt`

### Future Enhancements (Optional)

**If you want to track missing items separately:**

1. **Create Missing Items Collection:**
   ```typescript
   interface MissingItem {
     sispaId: string;
     category: string;
     type: string;
     size: string | null;
     reportedDate: Date;
     resolvedDate?: Date;
   }
   ```

2. **Update Status Logic:**
   - Query missing items collection to determine status
   - Count missing reports to calculate `missingCount`
   - Set status to "Missing" if item is in missing items collection

**Current Status:** Simple implementation - status defaults to "Available" for items in uniform

---

## 📊 API Endpoints Updated

| Endpoint | Method | Changes | Status |
|----------|--------|---------|--------|
| `/api/members/:sispaId/uniform` | GET | Returns status fields | ✅ **IMPLEMENTED** |
| `/api/members/uniform` | GET | Returns status fields | ✅ **IMPLEMENTED** |
| `/api/inventory/my-uniform` | GET | Returns status fields | ✅ **IMPLEMENTED** |

---

## 🧪 Testing Checklist

- [x] Database schema updated with status fields
- [x] GET /api/members/:sispaId/uniform returns status fields
- [x] GET /api/members/uniform returns status fields
- [x] GET /api/inventory/my-uniform returns status fields
- [x] Default status is "Available" with receivedDate
- [x] Status fields are optional (backward compatible)
- [x] missingCount only included when status is "Missing"
- [x] receivedDate only included when status is "Available"
- [x] Date format is ISO string (e.g., "2024-01-15T10:30:00.000Z")

---

## 🔮 Future Enhancements (Optional)

### 1. Missing Items Tracking

**Create endpoint to report missing items:**
```typescript
POST /api/members/:sispaId/uniform/missing
{
  "category": "Uniform No 3",
  "type": "Uniform No 3 Male",
  "size": "M"
}
```

**This would:**
- Update item status to "Missing"
- Increment `missingCount`
- Store missing report in database

### 2. Status Update Endpoint

**Create endpoint to update item status:**
```typescript
PUT /api/members/:sispaId/uniform/status
{
  "category": "Uniform No 3",
  "type": "Uniform No 3 Male",
  "size": "M",
  "status": "Available",
  "receivedDate": "2024-01-20T10:30:00.000Z"
}
```

### 3. Missing Items Collection

**Separate collection for tracking missing items:**
- Better tracking of missing item history
- Can calculate `missingCount` from history
- Can track resolution dates

---

## 📝 Response Format Summary

### Required Fields (Existing)
- `category`: string
- `type`: string
- `size`: string | null
- `quantity`: number
- `notes`: string | null

### Optional Fields (New)
- `status`: "Available" | "Not Available" | "Missing" | undefined
- `missingCount`: number | undefined (only if status is "Missing")
- `receivedDate`: string (ISO date) | undefined (only if status is "Available")

---

## ✅ Implementation Status

**All Required Features: ✅ COMPLETE**

1. ✅ Database schema updated with status fields
2. ✅ GET /api/members/:sispaId/uniform returns status fields
3. ✅ GET /api/members/uniform returns status fields
4. ✅ GET /api/inventory/my-uniform returns status fields
5. ✅ Default status logic implemented ("Available" with receivedDate)
6. ✅ Status fields are optional (backward compatible)
7. ✅ missingCount only included for "Missing" status
8. ✅ receivedDate only included for "Available" status
9. ✅ Date format is ISO string

**Optional Features:**
- ⚪ Missing items tracking endpoint (can be added later)
- ⚪ Status update endpoint (can be added later)
- ⚪ Separate missing items collection (can be added later)

---

## 🎯 Frontend Integration

The frontend can now:

1. **Fetch uniform with status:**
   ```typescript
   const response = await fetch(`/api/members/${sispaId}/uniform`, {
     headers: { 'Authorization': `Bearer ${token}` }
   });
   const data = await response.json();
   // data.uniform.items[0].status
   // data.uniform.items[0].missingCount (if status is "Missing")
   // data.uniform.items[0].receivedDate (if status is "Available")
   ```

2. **Display status badges:**
   - Green badge for "Available" with date
   - Yellow/orange badge for "Not Available"
   - Red badge for "Missing" with count

3. **Handle missing fields:**
   - If `status` is undefined, display without badge
   - If `missingCount` is undefined, don't show count
   - If `receivedDate` is undefined, don't show date

---

## 📝 Notes

- **Default Status:** Items in uniform collection default to "Available" with `receivedDate` = uniform `createdAt`
- **Optional Fields:** All status fields are optional - frontend handles missing fields gracefully
- **Backward Compatible:** Existing uniform items work without status fields
- **Date Format:** All dates are returned as ISO strings (e.g., "2024-01-15T10:30:00.000Z")
- **Status Values:** Only three values allowed: "Available", "Not Available", "Missing"

---

## 🚀 Next Steps

1. ✅ Backend implementation complete
2. ⏭️ Frontend can now use status fields from API
3. ⏭️ Admin can manually set status in database if needed
4. ⏭️ (Optional) Implement missing items tracking if needed

---

**Status: ✅ READY FOR FRONTEND INTEGRATION**
