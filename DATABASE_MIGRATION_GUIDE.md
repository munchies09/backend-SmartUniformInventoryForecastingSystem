# Database Migration Guide

## ✅ Backward Compatibility Status

All new fields are **backward compatible** - your existing database documents will work without issues!

### Why It's Safe:

1. **All new fields are optional** with default values:
   - `gender` in Member model: `default: null, required: false`
   - `gender` in RecommendedStock model: `default: null, required: false`
   - ShirtPrice is a new collection (no existing data to migrate)

2. **Mongoose handles missing fields gracefully**:
   - When fetching: Missing fields return `undefined` or use default values
   - When updating: New fields are added automatically if provided
   - When saving: Default values are applied if field is missing

3. **No breaking changes**:
   - Existing queries will work
   - Existing documents remain valid
   - New fields are added only when needed

---

## 🔄 Migration Script (Optional but Recommended)

While your database will work without migration, running the migration script ensures:
- ✅ All existing RecommendedStock documents have `gender` field populated
- ✅ ShirtPrice collection is initialized with default entries
- ✅ Data consistency across all documents

### Run Migration:

```bash
npm run migrate-database
```

Or directly:
```bash
ts-node scripts/migrateDatabaseSchema.ts
```

### What the Migration Does:

1. **RecommendedStock Collection**:
   - Finds all documents without `gender` field
   - Automatically sets `gender` based on `type`:
     - `BAJU_NO_3_LELAKI` → `gender: 'male'`
     - `BAJU_NO_3_PEREMPUAN` → `gender: 'female'`
     - Others → `gender: null`

2. **Member Collection**:
   - No changes needed (gender is optional)
   - Existing documents remain valid

3. **ShirtPrice Collection**:
   - Creates default entries for all three shirt types
   - Sets initial price to `null` (can be updated later)

---

## 📋 Field Status by Collection

### Member Collection
- ✅ **gender**: Optional field, defaults to `null`
- ✅ **Existing documents**: Fully compatible (no migration needed)
- ✅ **New documents**: Will have `gender: null` by default

### RecommendedStock Collection
- ✅ **gender**: Optional field, defaults to `null`
- ⚠️ **Existing documents**: Will work, but migration recommended to populate gender
- ✅ **New documents**: Gender automatically set based on type

### ShirtPrice Collection
- ✅ **New collection**: No existing data
- ✅ **No migration needed**: Collection created on first use

---

## 🧪 Testing Compatibility

### Test 1: Fetch Existing Data
```typescript
// This will work even if documents don't have gender field
const member = await MemberModel.findOne({ sispaId: 'B1234567' });
console.log(member.gender); // undefined or null - both are safe
```

### Test 2: Update Existing Document
```typescript
// This will work - gender field will be added if missing
await MemberModel.updateOne(
  { sispaId: 'B1234567' },
  { gender: 'Male' }
);
```

### Test 3: Create New Document
```typescript
// Gender will default to null if not provided
const newMember = new MemberModel({
  sispaId: 'B1234567',
  name: 'John Doe',
  // gender not provided - will be null
});
```

---

## ⚠️ Important Notes

1. **No Data Loss**: Migration script only ADDS fields, never removes or modifies existing data
2. **Safe to Run Multiple Times**: Script is idempotent - can run multiple times safely
3. **Backup Recommended**: Always backup your database before running migrations (best practice)
4. **Optional**: Migration is optional - your app will work without it, but data will be more consistent with it

---

## 🚀 Quick Start

### Option 1: Run Migration (Recommended)
```bash
npm run migrate-database
```

### Option 2: Skip Migration
Your app will work fine without migration. New documents will have proper fields, existing ones will work as-is.

---

## ✅ Verification

After migration, verify with:

```javascript
// Check RecommendedStock has gender field
const recs = await RecommendedStock.find({});
console.log('Recommendations with gender:', recs.filter(r => r.gender !== null).length);

// Check ShirtPrice collection exists
const prices = await ShirtPrice.find({});
console.log('Shirt prices initialized:', prices.length); // Should be 3
```

---

## Summary

✅ **Your database is safe** - all new fields are optional with defaults  
✅ **No breaking changes** - existing code will continue to work  
✅ **Migration available** - run `npm run migrate-database` for data consistency  
✅ **Backward compatible** - old documents work, new documents have new fields
