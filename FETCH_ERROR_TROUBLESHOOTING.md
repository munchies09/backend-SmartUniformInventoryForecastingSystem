# Fetch Error Troubleshooting Guide

## Error: "Failed to fetch"

This error typically occurs when:
1. Backend server is not running
2. CORS issues
3. Authentication token missing/invalid
4. Network connectivity issues
5. Backend endpoint throwing an error

---

## ✅ Fixes Applied

### 1. **Enhanced Error Handling in GET /api/inventory**
- Added database connection check
- Added detailed logging
- Better error messages
- Added count to response

### 2. **Improved Logging**
The endpoint now logs:
- When inventory fetch starts
- Database connection status
- Number of items found
- Number of items returned

---

## 🔍 Debugging Steps

### Step 1: Check Backend Server
```bash
# Make sure backend is running
# Check console for:
✅ MongoDB connected successfully
🚀 Server running on http://localhost:5000
```

### Step 2: Check Backend Logs
When frontend calls `GET /api/inventory`, you should see:
```
[timestamp] GET /api/inventory
📦 Fetching inventory items...
✅ Found X inventory items
✅ Returning X formatted items
```

### Step 3: Test Endpoint Directly
```bash
# Test with curl (replace YOUR_TOKEN)
curl -X GET http://localhost:5000/api/inventory \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### Step 4: Check Frontend Request
In browser DevTools → Network tab:
- Check if request is being sent
- Check request URL (should be `http://localhost:5000/api/inventory`)
- Check request headers (should include `Authorization: Bearer <token>`)
- Check response status code
- Check response body

---

## 🐛 Common Issues

### Issue 1: Backend Not Running
**Symptom:** "Failed to fetch" immediately
**Fix:** Start backend server
```bash
npm run dev
```

### Issue 2: Invalid/Missing Token
**Symptom:** 401 Unauthorized
**Fix:** Check if token is being sent correctly
```javascript
const token = localStorage.getItem('token');
headers: {
  'Authorization': `Bearer ${token}`
}
```

### Issue 3: CORS Error
**Symptom:** CORS policy error in console
**Fix:** Already configured in `server.ts`:
```typescript
app.use(cors());
```

### Issue 4: Database Connection
**Symptom:** 503 Service Unavailable
**Fix:** Check MongoDB connection in backend logs

### Issue 5: Wrong Endpoint URL
**Symptom:** 404 Not Found
**Fix:** Ensure frontend is calling:
```
GET http://localhost:5000/api/inventory
```

---

## 📋 Expected Response Format

**Success Response:**
```json
{
  "success": true,
  "inventory": [
    {
      "id": "...",
      "name": "...",
      "category": "Uniform No 3",
      "type": "Boot",
      "size": "4",
      "quantity": 10,
      "status": "In Stock",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "count": 1
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error message here",
  "error": "Detailed error (in development)"
}
```

---

## 🔧 Frontend Code Example

```javascript
const fetchInventory = async () => {
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch('http://localhost:5000/api/inventory', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch inventory');
    }
    
    const data = await response.json();
    return data.inventory;
  } catch (error) {
    console.error('Error fetching inventory:', error);
    throw error;
  }
};
```

---

## ✅ Checklist

- [ ] Backend server is running
- [ ] MongoDB is connected
- [ ] Frontend is using correct URL (`http://localhost:5000/api/inventory`)
- [ ] Token is included in Authorization header
- [ ] Token is valid (not expired)
- [ ] User has admin role (required for this endpoint)
- [ ] CORS is enabled (already done)
- [ ] Network tab shows the request being sent
- [ ] Backend logs show the request being received

---

## 🚨 If Still Not Working

1. **Check browser console** for detailed error
2. **Check backend console** for request logs
3. **Check Network tab** in DevTools:
   - Request URL
   - Request method
   - Request headers
   - Response status
   - Response body
4. **Test with Postman/curl** to isolate frontend vs backend issue
