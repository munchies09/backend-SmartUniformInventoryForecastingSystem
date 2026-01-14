# Error 500 Debugging Guide

## Issue: "Error saving uniform to database" - 500 Error

### Recent Fixes Applied:

1. ✅ **Removed enum restriction from schema** - Category field now accepts all 5 categories
2. ✅ **Fixed size field handling** - Schema now accepts null/empty string for accessories
3. ✅ **Improved error handling** - Mongoose validation errors now return 400 instead of 500
4. ✅ **Added validation before save** - Validates all fields before saving to database
5. ✅ **Fixed Beret validation** - "Beret" is correctly identified as main item, not accessory

### Potential Issues to Check:

#### 1. Database Schema Constraints
**Check:** Run this in MongoDB to see if there are any unique indexes that might be causing issues:
```javascript
db.uniforminventories.getIndexes()
db.memberuniforms.getIndexes()
```

**Possible Issue:** Unique index on `(category, type, size)` might be conflicting if:
- Multiple items with same category/type/null size exist
- Database has old data with old categories

**Fix:** The migration script should handle this, but you might need to drop and recreate indexes:
```javascript
// Drop old index if exists
db.uniforminventories.dropIndex("category_1_type_1_size_1")
// Recreate with new structure (categories will be normalized)
db.uniforminventories.createIndex({ category: 1, type: 1, size: 1 }, { unique: true })
```

#### 2. Size Field Format
**Frontend is sending:** `size: null` for accessories
**Backend expects:** `size: ""` (empty string) or `size: null`

**Status:** ✅ Backend now converts null to empty string before saving

#### 3. Category Validation
**Frontend is sending:** One of 5 categories
**Backend expects:** One of 5 categories (with backward compatibility)

**Status:** ✅ Schema enum removed, controller validates categories

#### 4. Required Fields
**Check:** All items must have:
- `category`: String (one of 5 categories)
- `type`: String (non-empty)
- `quantity`: Number (>= 1)
- `size`: String or null/empty (empty string for accessories)

**Status:** ✅ Validation added before save

### How to Debug:

1. **Check backend console logs** - Look for:
   - "ERROR CAUGHT IN updateMemberUniform"
   - "Error message:", "Error name:", "Error errors:"
   - "Validated items that were being saved:"

2. **Check the actual error message** - The error response should now include:
   - `error`: Error message
   - `errorType`: Error name (e.g., "ValidationError")
   - `errorCode`: Error code (e.g., 11000 for duplicate key)
   - `validationErrors`: If it's a validation error

3. **Common Error Patterns:**
   - **ValidationError**: Field validation failed (should return 400 now)
   - **E11000**: Duplicate key error (should return 400 now)
   - **CastError**: Type mismatch (should return 400 now)
   - **Other**: Database connection or other issue (500)

### Test Steps:

1. Try saving uniform with minimal items:
```json
{
  "items": [
    {
      "category": "Uniform No 3",
      "type": "Beret",
      "size": "7 1/4",
      "quantity": 1
    }
  ]
}
```

2. Try saving with accessory:
```json
{
  "items": [
    {
      "category": "Accessories No 3",
      "type": "Apulet",
      "size": null,
      "quantity": 1
    }
  ]
}
```

3. Check backend logs for detailed error messages

### Next Steps:

1. **Check backend console** for the actual error message
2. **Share the error details** from the console logs
3. **Check if database has old constraints** that need to be dropped
4. **Verify data format** being sent from frontend

The backend should now provide much more detailed error messages to help identify the exact issue.
