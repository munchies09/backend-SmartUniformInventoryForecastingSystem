# Machine Learning Data Preparation Guide for Final Year Project

## ✅ Your Data IS Suitable for ML!

Your current data structure is **excellent** for machine learning forecasting. Here's why:

### Available Features for ML

1. **Temporal Features** ✅
   - `createdAt`, `updatedAt` timestamps
   - Can extract: year, month, day, dayOfWeek, weekOfYear, season

2. **Categorical Features** ✅
   - `category` (Uniform No 3, Uniform No 4, T-Shirt)
   - `type` (Cloth No 3, Pants No 3, PVC Shoes, etc.)
   - `size` (XS, S, M, L, XL, etc. or null for accessories)
   - `batch` (member's batch - very important for forecasting!)

3. **Target Variable** ✅
   - `quantity` (demand - what we want to predict)

4. **Contextual Features** ✅
   - Member batch information
   - Item characteristics (isAccessory flag)
   - Historical patterns

## 📊 Data Structure for ML

### What You Have:
```typescript
MemberUniform {
  sispaId: string,
  items: [
    {
      category: "Uniform No 3",
      type: "Cloth No 3",
      size: "M",
      quantity: 1
    }
  ],
  createdAt: Date,
  updatedAt: Date
}

Member {
  sispaId: string,
  batch: "2024",  // ← Important feature!
  createdAt: Date
}
```

### What ML Models Need:
```python
# Time Series Format
{
  'date': '2024-01-15',
  'category': 'Uniform No 3',
  'type': 'Cloth No 3',
  'size': 'M',
  'demand': 5,  # How many requested on this day
  'batch': '2024',
  'month': 1,
  'dayOfWeek': 1,
  'weekOfYear': 3,
  # ... more features
}
```

## 🚀 Quick Start: Export Data for Google Colab

### Step 1: Export Your Data

Run the export script:
```bash
npm run export-ml-data
```

This creates:
- `ml_data_export/raw_demand_data.json` - All demand records with features
- `ml_data_export/time_series_data.json` - Aggregated daily demand per item
- `ml_data_export/demand_data.csv` - CSV format (easy for Colab)
- `ml_data_export/time_series_data.csv` - Time series CSV
- `ml_data_export/data_summary.json` - Summary statistics

### Step 2: Upload to Google Colab

1. Open Google Colab
2. Upload the CSV files to Colab
3. Load data:
```python
import pandas as pd
import numpy as np
from datetime import datetime

# Load data
df = pd.read_csv('demand_data.csv')
print(f"Data shape: {df.shape}")
print(df.head())
print(df.describe())
```

## 📈 Recommended ML Approaches for Your Project

### 1. **Time Series Forecasting** (Recommended for FYP)

**Models to Try:**
- **ARIMA** - For univariate time series
- **Prophet (Facebook)** - Handles seasonality well
- **LSTM** - Deep learning for complex patterns
- **XGBoost/LightGBM** - Gradient boosting with time features

**Features to Use:**
```python
# Time features
- date, year, month, day, dayOfWeek, weekOfYear
- daysSinceStart
- lag features (demand_1day_ago, demand_7days_ago, etc.)

# Categorical features (one-hot encoded)
- category, type, size, batch

# Aggregate features
- movingAverage7d, movingAverage30d
- cumulativeDemand
- demandTrend (increasing/decreasing)

# Batch-specific features
- batchYear (extracted from batch string)
- isNewBatch (if batch just started)
```

### 2. **Regression Models** (Alternative)

Predict demand as a function of features:
```python
# Features
X = [category, type, size, batch, month, dayOfWeek, ...]

# Target
y = demand (quantity)
```

**Models:**
- Linear Regression
- Random Forest
- XGBoost
- Neural Networks

### 3. **Hybrid Approach** (Best for FYP)

Combine multiple models:
1. Use time series models for temporal patterns
2. Use regression models for feature-based predictions
3. Ensemble the results

## 🔬 Data Preprocessing in Colab

### Example Colab Notebook Structure

```python
# 1. Load and Explore Data
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

df = pd.read_csv('time_series_data.csv')
df['date'] = pd.to_datetime(df['date'])
df = df.sort_values('date')

# 2. Feature Engineering
df['isWeekend'] = df['dayOfWeek'].isin([5, 6]).astype(int)
df['isAccessory'] = df['size'].isna().astype(int)

# Create lag features
df['demand_lag1'] = df.groupby(['category', 'type', 'size'])['demand'].shift(1)
df['demand_lag7'] = df.groupby(['category', 'type', 'size'])['demand'].shift(7)
df['demand_lag30'] = df.groupby(['category', 'type', 'size'])['demand'].shift(30)

# Rolling statistics
df['demand_rolling_mean_7'] = df.groupby(['category', 'type', 'size'])['demand'].transform(
    lambda x: x.rolling(7, min_periods=1).mean()
)

# 3. Handle Missing Values
df = df.fillna(0)

# 4. Encode Categorical Variables
from sklearn.preprocessing import LabelEncoder, OneHotEncoder

le_category = LabelEncoder()
df['category_encoded'] = le_category.fit_transform(df['category'])

# 5. Split Train/Test
# Use last 20% for testing
split_idx = int(len(df) * 0.8)
train = df[:split_idx]
test = df[split_idx:]

# 6. Train Models
from sklearn.ensemble import RandomForestRegressor
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

features = ['category_encoded', 'month', 'dayOfWeek', 'demand_lag1', 'demand_lag7', 
            'demand_rolling_mean_7', 'movingAverage7d']

X_train = train[features]
y_train = train['demand']
X_test = test[features]
y_test = test['demand']

# Train model
model = XGBRegressor(n_estimators=100, max_depth=5)
model.fit(X_train, y_train)

# Predict
y_pred = model.predict(X_test)

# Evaluate
mae = mean_absolute_error(y_test, y_pred)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
print(f"MAE: {mae:.2f}, RMSE: {rmse:.2f}")
```

## 📋 ML Project Structure for FYP

### Phase 1: Data Collection & Preparation
- ✅ Export data from MongoDB
- ✅ Clean and preprocess in Colab
- ✅ Feature engineering
- ✅ Exploratory Data Analysis (EDA)

### Phase 2: Model Development
- Implement baseline models (Moving Average, etc.)
- Train ML models (ARIMA, Prophet, XGBoost, LSTM)
- Hyperparameter tuning
- Cross-validation

### Phase 3: Model Evaluation
- Compare models (MAE, RMSE, MAPE)
- Visualize predictions vs actual
- Analyze feature importance

### Phase 4: Integration
- Export trained model (pickle, joblib, or ONNX)
- Create forecasting API endpoint in backend
- Load model and make predictions

## 🎯 Specific ML Tasks for Your Project

### Task 1: Demand Forecasting
**Goal**: Predict how many units of each item will be needed in the next week/month

**Features:**
- Historical demand patterns
- Batch intake dates (when new batches start)
- Seasonal patterns (month, week)
- Item characteristics

### Task 2: Size Distribution Prediction
**Goal**: Predict size distribution for new batch intake

**Features:**
- Historical size distributions by batch
- Batch characteristics
- Member demographics (if available)

### Task 3: Inventory Optimization
**Goal**: Recommend optimal inventory levels

**Features:**
- Forecasted demand
- Current inventory
- Lead times
- Cost factors

## 📊 Minimum Data Requirements

For a good FYP project, you need:

**Minimum:**
- 3-6 months of historical data
- At least 100+ uniform submissions
- Multiple batches
- Various item types

**Ideal:**
- 1+ year of data
- 500+ submissions
- Clear seasonal patterns
- Multiple batch intakes

## 🔍 Data Quality Checks

Before training, check:

1. **Completeness**: Are there missing dates?
2. **Consistency**: Are categories/types standardized?
3. **Outliers**: Any unusual spikes in demand?
4. **Temporal gaps**: Missing periods in time series?
5. **Batch information**: Can you extract batch year from batch string?

## 💡 Enhancement Ideas for FYP

1. **Multiple Models Comparison**: Compare 3-5 different ML models
2. **Ensemble Methods**: Combine predictions from multiple models
3. **Real-time Learning**: Update model as new data comes in
4. **Uncertainty Quantification**: Provide confidence intervals
5. **Feature Importance Analysis**: Which features matter most?

## 📝 Next Steps

1. **Export your data**: `npm run export-ml-data`
2. **Load in Colab**: Upload CSV files
3. **Exploratory Analysis**: Visualize patterns
4. **Feature Engineering**: Create ML features
5. **Train Models**: Start with simple, then complex
6. **Evaluate**: Compare model performance
7. **Integrate**: Add forecasting endpoint to backend

## 🎓 FYP Presentation Points

1. **Problem Statement**: Uniform inventory management needs forecasting
2. **Data Collection**: Real-world data from your system
3. **Preprocessing**: How you cleaned/prepared data
4. **Model Comparison**: Multiple ML approaches
5. **Results**: Accuracy metrics, visualizations
6. **Integration**: How it works in the system
7. **Future Work**: Improvements and extensions

---

**Your data is perfect for ML! The combination of temporal data, categorical features, and batch information creates a rich dataset for forecasting models.**

