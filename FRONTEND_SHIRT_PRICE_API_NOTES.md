# Frontend API Notes: Shirt Price Implementation

## 🎯 Overview

**Price is now stored directly in `UniformInventory`** (not in a separate ShirtPrice collection).

**Key Points:**
- ✅ Admin can set price at shirt inventory (`UniformInventory` model)
- ✅ Price is stored per shirt type (same price for all sizes of the same type)
- ✅ User uniform fetches price from `UniformInventory`
- ✅ All API responses include `price` field (null for non-shirt items)

---

## 📋 API Endpoints with Price Field

### 1. GET /api/inventory (Admin - Inventory List)

**Description:** Get all inventory items with prices included.

**Response Format:**
```json
{
  "success": true,
  "inventory": [
    {
      "id": "507f1f77bcf86cd799439011",
      "_id": "507f1f77bcf86cd799439011",
      "name": "Inner APM Shirt",
      "category": "Shirt",
      "type": "Inner APM Shirt",
      "size": "M",
      "quantity": 50,
      "status": "In Stock",
      "price": 20.00,  // ✅ Price included for shirt items
      "image": null,
      "sizeChart": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "507f1f77bcf86cd799439012",
      "_id": "507f1f77bcf86cd799439012",
      "name": "Uniform No 3 Male",
      "category": "Uniform No 3",
      "type": "Uniform No 3 Male",
      "size": "L",
      "quantity": 10,
      "status": "In Stock",
      "price": null,  // ✅ Price is null for non-shirt items
      "image": null,
      "sizeChart": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 2
}
```

**Important Notes:**
- ✅ All items include `price` field (number or null)
- ✅ Shirt items (`category === "Shirt"` or `"T-Shirt"`) will have a price if set by admin
- ✅ Non-shirt items will have `price: null`
- ✅ Price is the same for all sizes of the same shirt type

---

### 2. GET /api/members/uniform (User - Their Uniform)

**Description:** Get user's uniform items with prices included.

**Response Format:**
```json
{
  "success": true,
  "uniform": {
    "items": [
      {
        "category": "Shirt",
        "type": "Inner APM Shirt",
        "size": "M",
        "quantity": 1,
        "status": "Available",
        "price": 20.00,  // ✅ Price included (fetched from UniformInventory)
        "color": null,
        "notes": null,
        "missingCount": 0,
        "receivedDate": "2024-01-01T00:00:00.000Z"
      },
      {
        "category": "Uniform No 3",
        "type": "Uniform No 3 Male",
        "size": "L",
        "quantity": 1,
        "status": "Available",
        "price": null,  // ✅ Price is null for non-shirt items
        "color": null,
        "notes": null,
        "missingCount": 0,
        "receivedDate": "2024-01-01T00:00:00.000Z"
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Important Notes:**
- ✅ All items include `price` field (number or null)
- ✅ Shirt items include price from `UniformInventory`
- ✅ Non-shirt items have `price: null`
- ✅ Frontend can display price: `price !== null ? `RM ${price}` : 'Not set'`

---

### 3. POST /api/inventory (Admin - Create Inventory Item)

**Description:** Create new inventory item with optional price.

**Request Format:**
```json
{
  "category": "Shirt",
  "type": "Inner APM Shirt",
  "size": "M",
  "quantity": 50,
  "price": 20.00  // ✅ Optional: Price in RM (mainly for shirt items)
}
```

**Response Format:**
```json
{
  "success": true,
  "message": "Inventory item created successfully",
  "item": {
    "id": "507f1f77bcf86cd799439011",
    "_id": "507f1f77bcf86cd799439011",
    "name": "Inner APM Shirt",
    "category": "Shirt",
    "type": "Inner APM Shirt",
    "size": "M",
    "quantity": 50,
    "status": "In Stock",
    "price": 20.00,  // ✅ Price included in response
    "image": null,
    "sizeChart": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Important Notes:**
- ✅ `price` is optional (can be omitted or set to null)
- ✅ If price not provided and item is a shirt, backend inherits price from existing items of same type
- ✅ If price is set for a shirt item, backend updates all sizes of that type automatically

---

### 4. PUT /api/inventory/:id (Admin - Update Inventory Item)

**Description:** Update inventory item fields including price.

**Request Format:**
```json
{
  "price": 25.00  // ✅ Optional: Update price (can be null to unset)
}
```

**Or update multiple fields:**
```json
{
  "quantity": 60,
  "price": 25.00,
  "image": "...",
  "sizeChart": "..."
}
```

**Response Format:**
```json
{
  "success": true,
  "message": "Inventory item updated successfully",
  "item": {
    "id": "507f1f77bcf86cd799439011",
    "_id": "507f1f77bcf86cd799439011",
    "name": "Inner APM Shirt",
    "category": "Shirt",
    "type": "Inner APM Shirt",
    "size": "M",
    "quantity": 50,
    "status": "In Stock",
    "price": 25.00,  // ✅ Updated price included
    "image": null,
    "sizeChart": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Important Notes:**
- ✅ `price` is optional in request (can update other fields without changing price)
- ✅ If `price` is updated for a shirt item, backend automatically updates all sizes of that type
- ✅ Set `price: null` to unset the price
- ✅ Price validation: must be a positive number (>= 0) or null

---

## 💰 Price Field Behavior

### Price Storage

- **Location:** Stored in `UniformInventory.price` (directly in inventory model)
- **Type:** `number | null`
- **Default:** `null` (if not set by admin)

### Price Scope

- **Per Type:** Price is stored per shirt type (not per size)
- **Shared Across Sizes:** All sizes of the same shirt type share the same price
  - Example: If "Inner APM Shirt (M)" has `price: 20.00`, then "Inner APM Shirt (L)" will also have `price: 20.00`

### Price Update Behavior

**When admin updates price for one size:**
- ✅ The specific item is updated
- ✅ **All other sizes of the same shirt type are automatically updated** (same as image/sizeChart behavior)

**Example:**
- Admin updates "Inner APM Shirt (M)" with `price: 25.00`
- Backend automatically updates:
  - "Inner APM Shirt (S)" → `price: 25.00`
  - "Inner APM Shirt (L)" → `price: 25.00`
  - "Inner APM Shirt (XL)" → `price: 25.00`
  - All other sizes of "Inner APM Shirt" → `price: 25.00`

---

## 🎨 Frontend Implementation Guide

### Displaying Price in Inventory UI (Admin)

**Example React/TypeScript:**
```typescript
interface InventoryItem {
  id: string;
  category: string;
  type: string;
  size: string | null;
  quantity: number;
  price: number | null;  // ✅ Price field
  // ... other fields
}

const InventoryItem: React.FC<{ item: InventoryItem }> = ({ item }) => {
  const isShirt = item.category.toLowerCase() === 'shirt' || 
                  item.category.toLowerCase() === 't-shirt';
  
  return (
    <div>
      <h3>{item.type} ({item.size || 'no size'})</h3>
      <p>Quantity: {item.quantity}</p>
      
      {/* Display price only for shirt items */}
      {isShirt && (
        <p>
          Price: {item.price !== null && item.price !== undefined 
            ? `RM ${item.price.toFixed(2)}` 
            : 'Not set'}
        </p>
      )}
    </div>
  );
};
```

---

### Displaying Price in User Uniform UI

**Example React/TypeScript:**
```typescript
interface UniformItem {
  category: string;
  type: string;
  size: string;
  quantity: number;
  status: 'Available' | 'Not Available' | 'Missing';
  price: number | null;  // ✅ Price field
  // ... other fields
}

const UniformItem: React.FC<{ item: UniformItem }> = ({ item }) => {
  const isShirt = item.category.toLowerCase() === 'shirt' || 
                  item.category.toLowerCase() === 't-shirt';
  
  return (
    <div>
      <h3>{item.type} ({item.size})</h3>
      <p>Status: {item.status}</p>
      
      {/* Display price only for shirt items */}
      {isShirt && item.price !== null && item.price !== undefined && (
        <p className="price">RM {item.price.toFixed(2)}</p>
      )}
    </div>
  );
};
```

---

### Setting Price in Admin Inventory Form

**Example React/TypeScript:**
```typescript
interface InventoryFormData {
  category: string;
  type: string;
  size: string | null;
  quantity: number;
  price?: number | null;  // ✅ Optional price field
}

const InventoryForm: React.FC = () => {
  const [formData, setFormData] = useState<InventoryFormData>({
    category: '',
    type: '',
    size: null,
    quantity: 0,
    price: null
  });

  const isShirt = formData.category.toLowerCase() === 'shirt' || 
                  formData.category.toLowerCase() === 't-shirt';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Only include price if it's a shirt item
    const payload: any = {
      category: formData.category,
      type: formData.type,
      size: formData.size,
      quantity: formData.quantity
    };
    
    // Include price only for shirt items (or omit if not set)
    if (isShirt && formData.price !== null && formData.price !== undefined) {
      payload.price = formData.price;
    }
    
    await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ... other fields ... */}
      
      {/* Show price input only for shirt items */}
      {isShirt && (
        <div>
          <label>Price (RM):</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.price || ''}
            onChange={(e) => setFormData({
              ...formData,
              price: e.target.value ? parseFloat(e.target.value) : null
            })}
            placeholder="Enter price (e.g., 20.00)"
          />
        </div>
      )}
      
      <button type="submit">Save</button>
    </form>
  );
};
```

---

### Updating Price in Admin Inventory

**Example React/TypeScript:**
```typescript
const updatePrice = async (itemId: string, newPrice: number | null) => {
  const payload: any = {};
  
  // Only include price if it's a shirt item
  const isShirt = item.category.toLowerCase() === 'shirt' || 
                  item.category.toLowerCase() === 't-shirt';
  
  if (isShirt) {
    payload.price = newPrice;
  }
  
  await fetch(`/api/inventory/${itemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  // Note: Backend automatically updates all sizes of the same shirt type
  // Frontend may need to refresh inventory list to see updated prices
};
```

---

## ✅ Frontend Checklist

### Inventory UI (Admin)

- [ ] Display `price` field for shirt items in inventory list
- [ ] Show "Not set" or empty if `price === null`
- [ ] Format price as `RM XX.XX` (2 decimal places)
- [ ] Include price input field in create/edit form (only for shirt items)
- [ ] Validate price input (must be positive number or empty/null)
- [ ] Handle price update (backend automatically syncs to all sizes)

### User Uniform UI

- [ ] Display `price` field for shirt items in uniform list
- [ ] Only show price if `price !== null && price !== undefined`
- [ ] Format price as `RM XX.XX` (2 decimal places)
- [ ] Hide price for non-shirt items (or show "Not applicable")

### API Integration

- [ ] Include `price` field in API response types/interfaces
- [ ] Handle `price` as `number | null` type
- [ ] Send `price` field in POST/PUT requests (only for shirt items)
- [ ] Handle price validation errors (400 Bad Request if invalid)
- [ ] Refresh inventory list after price update (to see synced prices)

---

## 🧪 Testing Scenarios

### Test Case 1: Display Price in Inventory

**Setup:**
- Inventory item: "Inner APM Shirt (M)" with `price: 20.00`

**Expected:**
- ✅ Inventory UI displays "RM 20.00" for Inner APM Shirt (M)
- ✅ Inventory UI displays "RM 20.00" for Inner APM Shirt (L) (same price)
- ✅ Non-shirt items show no price or "Not applicable"

---

### Test Case 2: Set Price When Creating Shirt

**Setup:**
- Creating new shirt item: "Digital Shirt (M)"

**Action:**
- Fill form with `price: 25.00`
- Submit POST /api/inventory

**Expected:**
- ✅ New item created with `price: 25.00`
- ✅ All existing sizes of "Digital Shirt" are updated to `price: 25.00`
- ✅ Inventory list shows updated prices for all sizes

---

### Test Case 3: Update Price for One Size

**Setup:**
- Inventory: "Inner APM Shirt (M)" with `price: 20.00`
- Inventory: "Inner APM Shirt (L)" with `price: 20.00`

**Action:**
- Update "Inner APM Shirt (M)" with `price: 25.00` via PUT /api/inventory/:id

**Expected:**
- ✅ "Inner APM Shirt (M)" updated to `price: 25.00`
- ✅ "Inner APM Shirt (L)" automatically updated to `price: 25.00`
- ✅ Inventory list shows "RM 25.00" for all sizes

---

### Test Case 4: Display Price in User Uniform

**Setup:**
- Inventory: "Inner APM Shirt (M)" with `price: 20.00`
- User uniform: "Inner APM Shirt (M)"

**Action:**
- User calls GET /api/members/uniform

**Expected:**
- ✅ Response includes `price: 20.00` for Inner APM Shirt
- ✅ User UI displays "RM 20.00"
- ✅ Non-shirt items have `price: null` (not displayed)

---

## 📝 API Summary

### Request/Response Types

**Inventory Item:**
```typescript
interface InventoryItem {
  id: string;
  category: string;
  type: string;
  size: string | null;
  quantity: number;
  price: number | null;  // ✅ Price field
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  image?: string | null;
  sizeChart?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

**Uniform Item:**
```typescript
interface UniformItem {
  category: string;
  type: string;
  size: string;
  quantity: number;
  status: 'Available' | 'Not Available' | 'Missing';
  price: number | null;  // ✅ Price field
  color?: string | null;
  notes?: string | null;
  missingCount?: number;
  receivedDate?: string;
}
```

---

## 🎯 Key Points for Frontend

1. **Price Field Type:** Always treat `price` as `number | null`
2. **Price Display:** Only display price for shirt items (`category === "Shirt"` or `"T-Shirt"`)
3. **Price Formatting:** Format as `RM XX.XX` (2 decimal places)
4. **Price Updates:** When admin updates price for one size, all sizes of that type are automatically updated (backend handles this)
5. **Price Validation:** Frontend should validate price is positive number (>= 0) or empty/null
6. **API Compatibility:** All endpoints include `price` field (even if null for non-shirt items)

---

**Last Updated:** 2024
**Version:** 1.0

**Backend Ready:** ✅ All price functionality implemented and tested
