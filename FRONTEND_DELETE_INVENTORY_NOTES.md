# Frontend Notes: Delete Inventory Items

## 🎯 Overview

The backend has **TWO** DELETE endpoints for inventory items. The frontend must use the **correct endpoint** based on what data is available.

---

## ✅ Backend DELETE Endpoints

### 1. Delete by ID
**Endpoint:** `DELETE /api/inventory/:id`

**When to use:** When you have the item's MongoDB `_id` (from the inventory list)

**Request:**
```javascript
DELETE /api/inventory/507f1f77bcf86cd799439011
// No request body needed
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Inventory item deleted successfully"
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "message": "Inventory item not found"
}
```

---

### 2. Delete by Attributes (Category, Type, Size)
**Endpoint:** `DELETE /api/inventory/by-attributes`

**When to use:** When you have `category`, `type`, and `size` but NOT the `_id`

**Request:**
```javascript
DELETE /api/inventory/by-attributes
Content-Type: application/json

{
  "category": "Uniform No 4",
  "type": "Boot",
  "size": "UK 2"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Inventory item deleted successfully"
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "message": "Inventory item not found"
}
```

---

## 🔧 Frontend Implementation

### Option 1: Delete by ID (RECOMMENDED)

**Use this when:** You have the item's `id` or `_id` from the inventory list

```javascript
const deleteInventoryItem = async (itemId) => {
  try {
    const response = await fetch(`http://localhost:5000/api/inventory/${itemId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('✅ Item deleted successfully');
      // Refresh inventory list
      await fetchInventory();
    } else {
      console.error('❌ Delete failed:', data.message);
      alert(`Failed to delete: ${data.message}`);
    }
  } catch (error) {
    console.error('❌ Error deleting item:', error);
    alert('Error deleting item. Please try again.');
  }
};
```

**Usage:**
```javascript
// In your table row component
<button onClick={() => deleteInventoryItem(item.id)}>
  DELETE
</button>
```

---

### Option 2: Delete by Attributes

**Use this when:** You only have `category`, `type`, and `size` (no ID available)

```javascript
const deleteInventoryItemByAttributes = async (category, type, size) => {
  try {
    const response = await fetch('http://localhost:5000/api/inventory/by-attributes', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        category: category,  // e.g., "Uniform No 4"
        type: type,          // e.g., "Boot"
        size: size           // e.g., "UK 2" or "2"
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('✅ Item deleted successfully');
      // Refresh inventory list
      await fetchInventory();
    } else {
      console.error('❌ Delete failed:', data.message);
      alert(`Failed to delete: ${data.message}`);
    }
  } catch (error) {
    console.error('❌ Error deleting item:', error);
    alert('Error deleting item. Please try again.');
  }
};
```

**Usage:**
```javascript
// In your table row component
<button onClick={() => deleteInventoryItemByAttributes(
  item.category, 
  item.type, 
  item.size
)}>
  DELETE
</button>
```

---

## ⚠️ CRITICAL: Size Format for Boots/Shoes

**IMPORTANT:** The backend normalizes boot/shoe sizes automatically.

**Frontend can send:**
- `"UK 2"` ✅
- `"UK2"` ✅
- `"2"` ✅

**Backend will normalize:**
- All of the above → `"2"` (removes "UK" prefix)

**Example:**
```javascript
// All of these work:
deleteInventoryItemByAttributes("Uniform No 4", "Boot", "UK 2");
deleteInventoryItemByAttributes("Uniform No 4", "Boot", "UK2");
deleteInventoryItemByAttributes("Uniform No 4", "Boot", "2");
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Invalid ID format: by-attributes"

**Problem:** Frontend is calling `DELETE /api/inventory/by-attributes` but the route is matching `/:id` instead.

**Solution:** 
1. Make sure you're using `DELETE /api/inventory/by-attributes` with a **request body** (not as a URL parameter)
2. Check that the route is defined correctly (should be fixed in backend)

**WRONG:**
```javascript
// ❌ WRONG - This treats "by-attributes" as an ID
fetch('/api/inventory/by-attributes', { method: 'DELETE' });
```

**CORRECT:**
```javascript
// ✅ CORRECT - This uses the by-attributes endpoint with body
fetch('/api/inventory/by-attributes', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ category, type, size })
});
```

---

### Issue 2: Items Reappear After Deletion

**Problem:** Items are deleted but reappear after page refresh.

**Possible Causes:**
1. **Backend not actually deleting** - Check backend logs for deletion confirmation
2. **Frontend not refreshing inventory** - Make sure to call `fetchInventory()` after deletion
3. **Caching issue** - Clear browser cache or add cache-busting to requests

**Solution:**
```javascript
const deleteInventoryItem = async (itemId) => {
  try {
    const response = await fetch(`/api/inventory/${itemId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache' // Prevent caching
      }
    });

    if (response.ok) {
      // CRITICAL: Refresh inventory immediately after deletion
      await fetchInventory();
      
      // Optional: Show success message
      showNotification('Item deleted successfully', 'success');
    }
  } catch (error) {
    console.error('Delete error:', error);
  }
};
```

---

### Issue 3: 404 Not Found After Deletion

**Problem:** Getting 404 when trying to delete an item that should exist.

**Possible Causes:**
1. Item was already deleted
2. Size format mismatch (e.g., "UK 2" vs "2")
3. Category/type name mismatch (case-sensitive or extra spaces)

**Solution:**
```javascript
// Add better error handling
const deleteInventoryItemByAttributes = async (category, type, size) => {
  try {
    const response = await fetch('/api/inventory/by-attributes', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        category: category.trim(),  // Remove extra spaces
        type: type.trim(),
        size: size.trim()
      })
    });

    const data = await response.json();

    if (response.status === 404) {
      // Item doesn't exist - might already be deleted
      console.log('Item not found - may already be deleted');
      // Still refresh to update UI
      await fetchInventory();
    } else if (response.ok) {
      await fetchInventory();
      showNotification('Item deleted successfully', 'success');
    } else {
      showNotification(`Delete failed: ${data.message}`, 'error');
    }
  } catch (error) {
    console.error('Delete error:', error);
    showNotification('Error deleting item', 'error');
  }
};
```

---

## 📋 Implementation Checklist

### For Delete by ID:
- [ ] Use `DELETE /api/inventory/:id` endpoint
- [ ] Pass the item's `id` or `_id` in the URL
- [ ] Include `Authorization` header with Bearer token
- [ ] Handle 200 (success) and 404 (not found) responses
- [ ] Refresh inventory list after successful deletion
- [ ] Show success/error notifications to user

### For Delete by Attributes:
- [ ] Use `DELETE /api/inventory/by-attributes` endpoint
- [ ] Send `{ category, type, size }` in request body
- [ ] Include `Content-Type: application/json` header
- [ ] Include `Authorization` header with Bearer token
- [ ] Trim whitespace from category, type, and size
- [ ] Handle 200 (success) and 404 (not found) responses
- [ ] Refresh inventory list after successful deletion
- [ ] Show success/error notifications to user

---

## 🧪 Testing

### Test Case 1: Delete by ID
```javascript
// 1. Get inventory list
const items = await fetchInventory();

// 2. Find a Boot item
const bootItem = items.find(item => 
  item.category === 'Uniform No 4' && 
  item.type === 'Boot' && 
  item.size === '2'
);

// 3. Delete by ID
if (bootItem) {
  await deleteInventoryItem(bootItem.id);
  
  // 4. Verify deletion
  const updatedItems = await fetchInventory();
  const deletedItem = updatedItems.find(item => item.id === bootItem.id);
  console.assert(deletedItem === undefined, 'Item should be deleted');
}
```

### Test Case 2: Delete by Attributes
```javascript
// 1. Delete Boot UK 2
await deleteInventoryItemByAttributes(
  'Uniform No 4',
  'Boot',
  'UK 2'
);

// 2. Verify deletion
const items = await fetchInventory();
const bootUK2 = items.find(item => 
  item.category === 'Uniform No 4' && 
  item.type === 'Boot' && 
  item.size === '2'
);
console.assert(bootUK2 === undefined, 'Boot UK 2 should be deleted');
```

---

## 🔍 Debugging Tips

### 1. Check Network Tab
- Open browser DevTools → Network tab
- Look for DELETE requests
- Check:
  - **Request URL:** Should be `/api/inventory/:id` or `/api/inventory/by-attributes`
  - **Request Method:** Should be `DELETE`
  - **Request Headers:** Should include `Authorization: Bearer <token>`
  - **Request Body:** (for by-attributes) Should include `{ category, type, size }`
  - **Response Status:** Should be `200` (success) or `404` (not found)

### 2. Check Console Logs
- Backend logs should show:
  ```
  🗑️ ===== DELETE BY ATTRIBUTES ENDPOINT CALLED =====
  🗑️ Delete request received: { category: 'Uniform No 4', type: 'Boot', size: 'UK 2' }
  ✅ Successfully PERMANENTLY DELETED inventory item from database
  ```

### 3. Verify Deletion in Database
- After deletion, the item should **NOT** appear in:
  - GET /api/inventory response
  - Database query results
  - Frontend inventory list after refresh

---

## 📝 Example: React Component

```jsx
import React, { useState } from 'react';

const InventoryTable = ({ items, onRefresh }) => {
  const [loading, setLoading] = useState(false);

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete ${item.type} size ${item.size}?`)) {
      return;
    }

    setLoading(true);
    try {
      // Option 1: Delete by ID (recommended)
      const response = await fetch(
        `http://localhost:5000/api/inventory/${item.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        alert('Item deleted successfully');
        onRefresh(); // Refresh inventory list
      } else {
        alert(`Delete failed: ${data.message}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Error deleting item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <table>
      <thead>
        <tr>
          <th>SIZE</th>
          <th>QUANTITY</th>
          <th>ACTIONS</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>{item.size || 'N/A'}</td>
            <td>{item.quantity}</td>
            <td>
              <button
                onClick={() => handleDelete(item)}
                disabled={loading}
              >
                DELETE
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default InventoryTable;
```

---

## 🎯 Summary

1. **Use DELETE by ID** when you have the item's `id` (recommended)
2. **Use DELETE by Attributes** when you only have `category`, `type`, and `size`
3. **Always refresh inventory** after deletion
4. **Handle errors gracefully** (404 = item not found, 500 = server error)
5. **Show user feedback** (success/error notifications)

---

## ❓ Questions?

If you encounter issues:
1. Check browser Network tab for request/response details
2. Check backend terminal logs for error messages
3. Verify the item exists in the database before deletion
4. Ensure authentication token is valid and included in headers
