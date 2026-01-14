# Database Migration: Uniform No 3 Type Names

## Overview

This migration updates existing database records to use gender-specific type names for Uniform No 3:
- **"Cloth No 3"** → **"Uniform No 3 Male"**
- **"Pants No 3"** → **"Uniform No 3 Female"**

## ⚠️ IMPORTANT: Backup First!

**Always backup your database before running migrations!**

```bash
# Example MongoDB backup command
mongodump --uri="your-mongodb-uri" --out=./backup-$(date +%Y%m%d-%H%M%S)
```

## What This Migration Does

### 1. UniformInventory Collection
- Finds all inventory items with category "Uniform No 3" and type "Cloth No 3" or "Pants No 3"
- Updates the `type` field to the new gender-specific names

### 2. MemberUniform Collection
- Finds all member uniform documents that have items with old type names
- Updates the `type` field in the `items` array for each matching item

## How to Run

### Option 1: Using npm script (Recommended)
```bash
npm run migrate-uniform-no3-types
```

### Option 2: Direct execution
```bash
ts-node scripts/migrateUniformNo3Types.ts
```

## Expected Output

```
🚀 Starting Uniform No 3 Type Name Migration...

🔌 Connecting to MongoDB...
✅ MongoDB connected successfully

📦 Step 1: Updating UniformInventory documents...
   Found X inventory items to update
   ✅ Updated: Cloth No 3 → Uniform No 3 Male (ID: ...)
   ✅ Updated: Pants No 3 → Uniform No 3 Female (ID: ...)
   ✅ Updated X UniformInventory documents

👕 Step 2: Updating MemberUniform documents...
   Found X member uniform documents to check
   ✅ Updated item: Cloth No 3 → Uniform No 3 Male (Member: ...)
   ✅ Updated item: Pants No 3 → Uniform No 3 Female (Member: ...)
   ✅ Updated X MemberUniform documents
   ✅ Updated X individual items

🔍 Step 3: Verifying migration...
   ✅ Verification passed: No old type names found

📊 Migration Summary:
   Inventory - Uniform No 3 Male: X items
   Inventory - Uniform No 3 Female: X items
   Member Uniforms - Uniform No 3 Male: X documents
   Member Uniforms - Uniform No 3 Female: X documents

==================================================
✅ Migration completed successfully!
   Total documents updated: X
   Total items updated: X
==================================================

🔌 Disconnected from MongoDB
```

## Verification

After running the migration, verify the changes:

### Check Inventory Items
```javascript
// In MongoDB shell or Compass
db.uniforminventories.find({ 
  category: "Uniform No 3",
  type: { $in: ["Uniform No 3 Male", "Uniform No 3 Female"] }
}).count()
```

### Check Member Uniforms
```javascript
// In MongoDB shell or Compass
db.memberuniforms.find({
  "items.type": { $in: ["Uniform No 3 Male", "Uniform No 3 Female"] }
}).count()
```

### Verify No Old Types Remain
```javascript
// Should return 0
db.uniforminventories.countDocuments({
  category: "Uniform No 3",
  type: { $in: ["Cloth No 3", "Pants No 3"] }
})

// Should return 0
db.memberuniforms.countDocuments({
  "items.type": { $in: ["Cloth No 3", "Pants No 3"] }
})
```

## Rollback (If Needed)

If you need to rollback the migration, you can run this script:

```javascript
// Rollback script (run in MongoDB shell)
// WARNING: Only use if you need to revert the changes

// Rollback UniformInventory
db.uniforminventories.updateMany(
  { category: "Uniform No 3", type: "Uniform No 3 Male" },
  { $set: { type: "Cloth No 3" } }
);

db.uniforminventories.updateMany(
  { category: "Uniform No 3", type: "Uniform No 3 Female" },
  { $set: { type: "Pants No 3" } }
);

// Rollback MemberUniform (more complex - requires array update)
db.memberuniforms.find({
  "items.type": { $in: ["Uniform No 3 Male", "Uniform No 3 Female"] }
}).forEach(function(doc) {
  doc.items.forEach(function(item, index) {
    if (item.type === "Uniform No 3 Male") {
      doc.items[index].type = "Cloth No 3";
    } else if (item.type === "Uniform No 3 Female") {
      doc.items[index].type = "Pants No 3";
    }
  });
  db.memberuniforms.save(doc);
});
```

## Safety Features

✅ **Idempotent**: Safe to run multiple times (won't duplicate updates)
✅ **Verification**: Checks for remaining old type names after migration
✅ **Detailed Logging**: Shows exactly what was updated
✅ **Error Handling**: Gracefully handles errors and disconnects from database

## Troubleshooting

### Issue: Migration finds items but doesn't update them

**Possible causes:**
- Case sensitivity issues (e.g., "cloth no 3" vs "Cloth No 3")
- Extra whitespace in type names

**Solution:** Check the actual type values in your database:
```javascript
db.uniforminventories.distinct("type", { category: "Uniform No 3" })
```

### Issue: Some items remain with old type names

**Possible causes:**
- Items were created during migration
- Case sensitivity mismatch

**Solution:** Run the migration again (it's idempotent)

### Issue: Migration fails with connection error

**Solution:** 
1. Check your `.env` file has correct `MONGODB_URI`
2. Ensure MongoDB is running
3. Check network connectivity

## Related Files

- **Migration Script**: `scripts/migrateUniformNo3Types.ts`
- **Backend Changes**: `src/controllers/uniformController.ts`
- **Frontend Guide**: `FRONTEND_UNIFORM_NO3_GENDER_UPDATE.md`

## Next Steps

After running the migration:

1. ✅ Verify all records were updated correctly
2. ✅ Update frontend to use new type names (see `FRONTEND_UNIFORM_NO3_GENDER_UPDATE.md`)
3. ✅ Test inventory management with new type names
4. ✅ Test member uniform selection with new type names

## Support

If you encounter any issues:
1. Check the error message in the console
2. Verify your database connection
3. Ensure you have proper permissions
4. Check that the models are correctly imported
