# ERD Schema Information for Smart Uniform Backend

## Collection Overview

### 1. **Member** (User/Cadet)
**Collection Name:** `members`  
**Primary Key:** `sispaId` (unique string)  
**Model File:** `src/models/memberModel.ts`

**Fields:**
- `sispaId` (String, required, unique) - Primary identifier for login
- `name` (String, required)
- `email` (String, required, unique)
- `password` (String, required)
- `role` (Enum: 'admin' | 'member', default: 'member')
- `batch` (String, optional, nullable) - Format: "Kompeni {number}"
- `gender` (Enum: 'Male' | 'Female', optional)
- `matricNumber` (String, optional)
- `phoneNumber` (String, optional)
- `profilePicture` (String, optional) - URL or path
- `resetPasswordToken` (String, optional, nullable)
- `resetPasswordExpires` (Date, optional, nullable)
- `createdAt` (Date, auto)
- `updatedAt` (Date, auto)

**Relationships:**
- One-to-One with `MemberUniform` (via `sispaId`)

---

### 2. **MemberUniform** (Cadet Uniform Collection)
**Collection Name:** `memberuniforms`  
**Primary Key:** `_id` (MongoDB ObjectId)  
**Model File:** `src/models/uniformModel.ts`

**Fields:**
- `sispaId` (String, required, unique) - Foreign key to Member
- `items` (Array of IUniformItem subdocuments, required)
  - `category` (String, required) - e.g., "Uniform No 3", "Uniform No 4", "Accessories No 3", "Shirt"
  - `type` (String, required) - e.g., "Uniform No 3 Male", "Apulet", "Polo Shirt"
  - `size` (String, optional) - Empty string for accessories, actual size for main items
  - `quantity` (Number, required, default: 1, min: 1)
  - `color` (String, optional, nullable)
  - `notes` (String, optional, nullable)
  - `status` (Enum: 'Available' | 'Not Available' | 'Missing', optional)
  - `missingCount` (Number, optional, default: 0, min: 0) - Count of times item has been missing
  - `receivedDate` (Date, optional) - Date when item was received/issued
- `createdAt` (Date, auto)
- `updatedAt` (Date, auto)

**Relationships:**
- Many-to-One with `Member` (via `sispaId`)
- Logical link to `UniformInventory` (via `category` + `type` + `size` matching)

**Indexes:**
- Unique index on `sispaId` (one uniform collection per member)

---

### 3. **UniformInventory** (Admin Inventory/Stock)
**Collection Name:** `uniforminventories`  
**Primary Key:** `_id` (MongoDB ObjectId)  
**Model File:** `src/models/uniformModel.ts`

**Fields:**
- `name` (String, required)
- `category` (String, required, indexed) - "Uniform No 3", "Uniform No 4", "Accessories No 3", "Accessories No 4", "Shirt"
- `type` (String, required, indexed) - e.g., "Uniform No 3 Male", "Apulet", "Polo Shirt"
- `size` (String | null, optional, indexed) - Null for accessories, actual size for main items
- `quantity` (Number, required, default: 0, min: 0)
- `status` (Enum: 'In Stock' | 'Low Stock' | 'Out of Stock', default: 'Out of Stock', indexed)
- `recommendedStock` (Number, optional, min: 0) - From ML forecast
- `lastRecommendationDate` (Date, optional) - When recommendation was updated
- `image` (String, optional, nullable) - Base64 or URL (same for all sizes of same type)
- `sizeChart` (String, optional, nullable) - URL or path (same for all sizes of same type)
- `price` (Number, optional, nullable, min: 0) - Price in RM (mainly for shirts)
- `createdAt` (Date, auto)
- `updatedAt` (Date, auto)

**Relationships:**
- Logical link to `MemberUniform.items` (via `category` + `type` + `size` matching)
- One-to-Many with `RecommendedStock` (via `category` + `type` + `size`)

**Indexes:**
- Compound unique index on `(category, type, size)` - prevents duplicates
- Indexes on: `category`, `type`, `size`, `status`, `createdAt`, `updatedAt`
- Compound indexes: `(category, type)`, `(category, status)`, `(type, size)`

---

### 4. **Announcement**
**Collection Name:** `announcements`  
**Primary Key:** `_id` (MongoDB ObjectId)  
**Model File:** `src/models/announcementModel.ts`

**Fields:**
- `title` (String, required)
- `date` (String, required) - Format: "11/11/2025" or any format
- `time` (String, required) - Format: "Jam 2000" or any format
- `location` (String, required)
- `message` (String, optional, nullable) - Optional details
- `createdAt` (Date, auto, indexed descending)
- `updatedAt` (Date, auto, indexed descending)

**Relationships:**
- No direct foreign key relationships (standalone entity)

**Indexes:**
- Index on `createdAt` (descending) - for latest announcements
- Index on `updatedAt` (descending)

---

### 5. **MLModel** (Forecast Model)
**Collection Name:** `mlmodels`  
**Primary Key:** `_id` (MongoDB ObjectId)  
**Model File:** `src/models/forecastModel.ts`

**Fields:**
- `modelName` (String, required, default: 'uniform_demand_forecast', indexed)
- `modelType` (Enum: 'linear_regression' | 'random_forest' | 'xgboost' | 'lstm' | 'prophet' | 'arima' | 'other', default: 'linear_regression')
- `version` (String, required, default: '1.0.0')
- `features` (Array of Strings, required) - Feature names in order
- `coefficients` (Array of Numbers, optional) - For linear models
- `intercept` (Number, optional) - For linear models
- `modelParameters` (Mixed, optional) - For other model types (trees, neural nets, etc.)
- `scalerParameters` (Object, optional)
  - `mean` (Array of Numbers, optional)
  - `std` (Array of Numbers, optional)
  - `min` (Array of Numbers, optional)
  - `max` (Array of Numbers, optional)
  - `scalerType` (Enum: 'standard' | 'minmax', optional)
- `accuracy` (Object, required)
  - `mae` (Number, optional) - Mean Absolute Error
  - `rmse` (Number, optional) - Root Mean Squared Error
  - `r2` (Number, optional) - R-squared
  - `mape` (Number, optional) - Mean Absolute Percentage Error
- `trainingDate` (Date, required, default: Date.now)
- `description` (String, optional)
- `createdAt` (Date, auto)
- `updatedAt` (Date, auto)

**Relationships:**
- Used by `RecommendedStock` (logical relationship via ML analysis)

**Indexes:**
- Compound index on `(modelName, trainingDate)` descending - for latest model lookup

---

### 6. **RecommendedStock** (Forecast Results)
**Collection Name:** `recommendedstocks`  
**Primary Key:** `_id` (MongoDB ObjectId)  
**Model File:** `src/models/recommendedStockModel.ts`

**Fields:**
- `category` (Enum: 'Uniform No 3' | 'Uniform No 4' | 'T-Shirt' | 'Others', required, indexed)
- `type` (String, required, indexed)
- `size` (String, optional, nullable, indexed) - Null for accessories
- `gender` (Enum: 'male' | 'female', optional, nullable, indexed) - For Uniform No 3, null for others
- `recommendedStock` (Number, required, min: 0) - Recommended stock level from Colab
- `currentStock` (Number, required, min: 0) - Current stock at time of recommendation
- `forecastedDemand` (Number, optional, min: 0) - Forecasted demand (if available)
- `reorderQuantity` (Number, optional, min: 0) - How many units to reorder
- `analysisDate` (Date, required, default: Date.now, indexed) - When recommendation was generated
- `notes` (String, optional) - Any notes from Colab analysis
- `source` (Enum: 'google_colab' | 'manual' | 'system' | 'ml_model', required, default: 'google_colab')
- `createdAt` (Date, auto)
- `updatedAt` (Date, auto)

**Relationships:**
- Many-to-One with `UniformInventory` (via `category` + `type` + `size` matching)
- Logical relationship with `MLModel` (via ML analysis source)

**Indexes:**
- Compound index on `(category, type, size, analysisDate)` descending - for latest recommendations
- Unique compound index on `(category, type, size, analysisDate)` with partial filter on `source: 'google_colab'` - prevents duplicate recommendations

---

### 7. **ShirtPrice**
**Collection Name:** `shirtprices`  
**Primary Key:** `_id` (MongoDB ObjectId)  
**Model File:** `src/models/shirtPriceModel.ts`

**Fields:**
- `type` (Enum: 'Digital Shirt' | 'Company Shirt' | 'Inner APM Shirt', required, unique, indexed)
- `price` (Number, optional, nullable, min: 0) - Price in RM, or null if not set
- `updatedAt` (Date, auto)

**Relationships:**
- No direct foreign key relationships (standalone pricing reference)

**Indexes:**
- Unique index on `type` - one price per shirt type
- Index on `type` for quick lookup

---

### 8. **Batch**
**Collection Name:** `batches`  
**Primary Key:** `_id` (MongoDB ObjectId)  
**Model File:** `src/models/batchModel.ts`

**Fields:**
- `id` (String, optional)
- `batchNumber` (Number, optional)
- `year` (Number, optional)
- `totalMembers` (Number, optional)
- `status` (Enum: 'active' | 'completed', optional)
- `createdDate` (String, optional)

**Relationships:**
- Logical relationship with `Member` (via `batch` field in Member)

**Indexes:**
- None explicitly defined

---

## Entity Relationships Summary

### Direct Relationships (Foreign Keys)
1. **Member** ←→ **MemberUniform**
   - One-to-One relationship
   - Link: `MemberUniform.sispaId` → `Member.sispaId`
   - Constraint: One uniform collection per member (unique `sispaId`)

### Logical Relationships (No Foreign Keys)
2. **MemberUniform** ←→ **UniformInventory**
   - Many-to-Many logical relationship
   - Link: Matching `(category, type, size)` between `MemberUniform.items[]` and `UniformInventory`
   - Used for: Inventory deduction when members receive items

3. **UniformInventory** ←→ **RecommendedStock**
   - One-to-Many logical relationship
   - Link: Matching `(category, type, size)` between `UniformInventory` and `RecommendedStock`
   - Used for: Stock recommendations and forecasting

4. **MLModel** ←→ **RecommendedStock**
   - One-to-Many logical relationship
   - Link: `RecommendedStock.source` = 'ml_model' references ML analysis
   - Used for: ML-based stock recommendations

5. **Member** ←→ **Batch**
   - Many-to-One logical relationship
   - Link: `Member.batch` field matches `Batch` data
   - Used for: Grouping members by batch/company

### Standalone Entities
- **Announcement** - No relationships (public announcements)
- **ShirtPrice** - No relationships (reference pricing data)

---

## Key Business Rules

1. **One Uniform Collection Per Member**: Each member (`sispaId`) can have only one `MemberUniform` document (enforced by unique index).

2. **Unique Inventory Items**: Each `(category, type, size)` combination in `UniformInventory` must be unique (enforced by compound unique index).

3. **Inventory Deduction**: When a member receives an item, the corresponding `UniformInventory` quantity is decremented, and the item is added to `MemberUniform.items[]`.

4. **Missing Count Tracking**: Items in `MemberUniform.items[]` track `missingCount` which increments each time status changes to "Missing".

5. **Stock Recommendations**: `RecommendedStock` provides ML-based recommendations that can update `UniformInventory.recommendedStock` and `UniformInventory.lastRecommendationDate`.

6. **Accessories Handling**: Accessories (e.g., "Apulet") have `size = null` or empty string, while main items (e.g., "Uniform No 3 Male") have actual size values.

---

## ERD Diagram Notes

### Cardinality:
- **Member** (1) ←→ (1) **MemberUniform**
- **UniformInventory** (1) ←→ (N) **RecommendedStock**
- **MemberUniform.items[]** (N) ←→ (1) **UniformInventory** (logical, via category+type+size)

### Optional Fields:
- Most fields marked as "optional" can be `null` or `undefined`
- `missingCount` defaults to `0` if not set
- `status` defaults based on `quantity` calculation for inventory items

### Indexes for Performance:
- All foreign keys are indexed
- Compound indexes support common query patterns (category+type, category+status, etc.)
- Timestamp indexes support sorting by creation/update dates
