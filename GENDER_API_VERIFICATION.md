# Gender Field API Verification

## ✅ All APIs That Return Gender

### 1. **GET /api/members/profile** - Get Own Profile
**Status:** ✅ Fixed
**Returns:** `gender` field in `member` object

**Response:**
```json
{
  "success": true,
  "member": {
    "sispaId": "B1234567",
    "name": "John Doe",
    "gender": "Male",  // ✅ Included
    ...
  }
}
```

---

### 2. **POST /api/members/login** - Login
**Status:** ✅ Fixed
**Returns:** `gender` field in `user` object

**Response:**
```json
{
  "success": true,
  "user": {
    "sispaId": "B1234567",
    "gender": "Male",  // ✅ Included
    ...
  },
  "token": "..."
}
```

---

### 3. **GET /api/members** - Get All Members (Admin)
**Status:** ✅ **JUST FIXED** - This was missing!
**Returns:** `gender` field in each member object

**Response:**
```json
{
  "success": true,
  "members": [
    {
      "id": "...",
      "sispaId": "B1234567",
      "name": "John Doe",
      "gender": "Male",  // ✅ NOW INCLUDED (was missing before)
      ...
    }
  ],
  "total": 1
}
```

**CRITICAL:** This endpoint is used by admin to view all members. The frontend expects `gender` field for each member.

---

### 4. **PUT /api/members/profile** - Update Profile
**Status:** ✅ Already working
**Accepts:** `gender` field in request body
**Returns:** Updated `user` object with `gender`

---

### 5. **GET /api/recommended-stock** - Get All Recommendations
**Status:** ✅ Already working
**Returns:** `gender` field in each recommendation

**Response:**
```json
{
  "success": true,
  "recommendations": [
    {
      "type": "BAJU_NO_3_LELAKI",
      "gender": "male",  // ✅ Included
      ...
    }
  ]
}
```

---

### 6. **GET /api/recommended-stock/:category/:type/:size** - Get Single Recommendation
**Status:** ✅ Fixed
**Returns:** `gender` field in `recommendation` object

---

## 🔍 Testing Checklist

### Test 1: Admin View All Members
```bash
GET /api/members
Authorization: Bearer <admin-token>
```
**Expected:** Each member object should have `gender` field (even if `null`)

### Test 2: Get Own Profile
```bash
GET /api/members/profile
Authorization: Bearer <member-token>
```
**Expected:** `member` object should have `gender` field

### Test 3: Login
```bash
POST /api/members/login
Body: { "sispaId": "...", "password": "..." }
```
**Expected:** `user` object should have `gender` field

### Test 4: Update Profile with Gender
```bash
PUT /api/members/profile
Authorization: Bearer <member-token>
Body: { "gender": "Male" }
```
**Expected:** Response should include updated `gender` field

---

## 🐛 Common Issues

### Issue 1: Gender shows as `undefined` in frontend
**Cause:** API not returning gender field
**Fix:** ✅ All APIs now explicitly include gender field

### Issue 2: Gender shows as `null` but user has set it
**Cause:** Database document doesn't have gender field
**Fix:** Run migration script: `npm run migrate-database`

### Issue 3: Gender field missing in admin member list
**Cause:** `GET /api/members` was not including gender
**Fix:** ✅ Fixed - now includes gender in response

---

## 📊 Gender Field Values

### Member Profile Gender
- `"Male"` - Male member
- `"Female"` - Female member  
- `null` - Not set (optional field)

### Recommended Stock Gender
- `"male"` - For BAJU_NO_3_LELAKI items
- `"female"` - For BAJU_NO_3_PEREMPUAN items
- `null` - For other items (BOOT, BERET, etc.)

**Note:** Member profile uses `"Male"`/`"Female"` (capitalized), while recommended stock uses `"male"`/`"female"` (lowercase). This is intentional.

---

## ✅ Summary

All APIs now return gender field:
- ✅ Login endpoint
- ✅ Profile GET endpoint
- ✅ Profile PUT endpoint (accepts gender)
- ✅ **Admin GET /api/members endpoint** (was missing, now fixed)
- ✅ Recommended stock endpoints

If gender still doesn't show in frontend:
1. Check browser console for API response
2. Verify the field name matches (`gender` not `Gender` or `GENDER`)
3. Run migration script if existing documents don't have gender: `npm run migrate-database`
