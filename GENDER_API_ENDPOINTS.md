# Gender Field API Endpoints

## 📋 APIs That Return Gender

### 1. **GET /api/members/profile** - Get Own Profile
**Returns:** Member profile including gender

**Response:**
```json
{
  "success": true,
  "member": {
    "id": "...",
    "sispaId": "B1234567",
    "name": "John Doe",
    "email": "john@example.com",
    "batch": "2024",
    "role": "member",
    "gender": "Male",  // ✅ Gender field included
    "matricNumber": "...",
    "phoneNumber": "...",
    "profilePicture": "..."
  }
}
```

---

### 2. **POST /api/members/login** - Login
**Returns:** User data including gender

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "...",
    "sispaId": "B1234567",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "member",
    "batch": "2024",
    "gender": "Male",  // ✅ Gender field included
    "matricNumber": "...",
    "phoneNumber": "...",
    "profilePicture": "..."
  },
  "token": "jwt_token_here"
}
```

---

### 3. **GET /api/recommended-stock** - Get All Recommended Stock
**Returns:** Array of recommendations with gender

**Response:**
```json
{
  "success": true,
  "recommendations": [
    {
      "id": "...",
      "type": "BAJU_NO_3_LELAKI",
      "size": "M",
      "gender": "male",  // ✅ Gender field included
      "forecastedDemand": 10,
      "recommendedStock": 12
    },
    {
      "id": "...",
      "type": "BAJU_NO_3_PEREMPUAN",
      "size": "L",
      "gender": "female",  // ✅ Gender field included
      "forecastedDemand": 8,
      "recommendedStock": 10
    },
    {
      "id": "...",
      "type": "BOOT",
      "size": "8",
      "gender": null,  // ✅ null for items without gender
      "forecastedDemand": 5,
      "recommendedStock": 6
    }
  ]
}
```

---

### 4. **GET /api/recommended-stock/:category/:type/:size** - Get Single Recommendation
**Returns:** Single recommendation with gender

**Response:**
```json
{
  "success": true,
  "recommendation": {
    "category": "Others",
    "type": "BAJU_NO_3_LELAKI",
    "size": "M",
    "gender": "male",  // ✅ Gender field included
    "recommendedStock": 12,
    "forecastedDemand": 10
  }
}
```

---

## 🔄 Update Gender

### **PUT /api/members/profile** - Update Profile (including gender)

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "batch": "2024",
  "gender": "Male"  // ✅ Update gender field
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "id": "...",
    "sispaId": "B1234567",
    "name": "John Doe",
    "gender": "Male"  // ✅ Updated gender
  }
}
```

---

## 📊 Gender Values

### Member Profile Gender
- `"Male"` - Male member
- `"Female"` - Female member
- `null` - Not set (optional field)

### Recommended Stock Gender
- `"male"` - For BAJU_NO_3_LELAKI items
- `"female"` - For BAJU_NO_3_PEREMPUAN items
- `null` - For other items (BOOT, BERET, BAJU_NO_4, etc.)

---

## ✅ Summary

All APIs now return gender field:
- ✅ Login endpoint includes gender
- ✅ Profile GET endpoint includes gender
- ✅ Profile PUT endpoint accepts gender
- ✅ Recommended stock endpoints include gender

If gender is `null` or `undefined`, it means:
- For members: Gender not set yet (optional field)
- For recommendations: Item doesn't have gender distinction (e.g., BOOT, BERET)
