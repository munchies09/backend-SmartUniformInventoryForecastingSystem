# ML Forecasting Implementation Guide

## ✅ What's Been Implemented

Your backend now has a complete ML forecasting system with Linear Regression support!

### 📁 Files Created

1. **Model Storage**
   - `src/models/forecastModel.ts` - MongoDB model for storing ML model parameters

2. **Forecasting Logic**
   - `src/utils/forecastUtils.ts` - Feature engineering and prediction functions
   - `src/controllers/forecastController.ts` - API endpoints for forecasting

3. **API Routes**
   - `src/routes/forecastRoutes.ts` - Route definitions
   - Added to `src/server.ts` at `/api/forecast`

### 🚀 API Endpoints

#### For Members/Admins (View Forecasts)

1. **GET `/api/forecast`** - Get forecast for specific item
   - Query params: `category`, `type`, `size`, `forecastDate`, `period`
   - Example: `/api/forecast?category=Uniform%20No%203&type=Cloth%20No%203&size=M`

2. **GET `/api/forecast/all`** - Get forecasts for all inventory items
   - Optional filters: `category`, `type`, `size`, `forecastDate`

3. **GET `/api/forecast/model`** - Get current model information
   - Returns model metadata, accuracy metrics, feature list

#### For Admins Only (Manage Model)

4. **POST `/api/forecast/model`** - Upload/update ML model
   - Body: Model parameters (features, coefficients, intercept, accuracy)

## 📋 Quick Start

### Step 1: Export Model from Google Colab

1. Open your Colab notebook: https://colab.research.google.com/drive/1JOhXHu4FnkrvpkMecnpaRnaCTQP9hO4H
2. After training your Linear Regression model, add this code:

```python
# Extract model parameters
model_params = {
    'modelName': 'uniform_demand_forecast',
    'modelType': 'linear_regression',
    'version': '1.0.0',
    'features': feature_names.tolist(),  # Your feature column names
    'coefficients': model.coef_.tolist(),  # Model coefficients
    'intercept': float(model.intercept_),  # Model intercept
    'accuracy': {
        'mae': float(mae_score),
        'rmse': float(rmse_score),
        'r2': float(r2_score)
    }
}

# Save and download
import json
with open('model.json', 'w') as f:
    json.dump(model_params, f, indent=2)

from google.colab import files
files.download('model.json')
```

📖 **See detailed guide**: `ml_data_export/EXPORT_MODEL_FROM_COLAB.md`

### Step 2: Upload Model to Backend

```bash
curl -X POST http://localhost:5000/api/forecast/model \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d @model.json
```

Or use Postman/Insomnia with:
- Method: `POST`
- URL: `http://localhost:5000/api/forecast/model`
- Headers: `Authorization: Bearer YOUR_ADMIN_TOKEN`
- Body: Paste your model JSON

📖 **See detailed guide**: `ml_data_export/UPLOAD_MODEL_TO_BACKEND.md`

### Step 3: Test Forecasting

```bash
# Get forecast for specific item
curl -X GET "http://localhost:5000/api/forecast?category=Uniform%20No%203&type=Cloth%20No%203&size=M" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get forecasts for all items
curl -X GET "http://localhost:5000/api/forecast/all" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get model info
curl -X GET "http://localhost:5000/api/forecast/model" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔧 How It Works

### 1. Model Storage

The trained model parameters (coefficients, intercept, features) are stored in MongoDB as a `MLModel` document. This allows you to:
- Store multiple model versions
- Update models without code changes
- Track model accuracy metrics

### 2. Feature Engineering

When making a prediction, the backend:
1. Extracts time features (month, dayOfWeek, weekOfYear, etc.)
2. Encodes categorical features (category, type, size, batch)
3. Calculates historical aggregates (moving averages, lag features)
4. Formats features to match your Colab model

### 3. Prediction

Linear Regression prediction formula:
```
prediction = intercept + (coef1 × feature1) + (coef2 × feature2) + ...
```

The backend:
1. Loads the model from database
2. Engineers features from request parameters and historical data
3. Applies the Linear Regression formula
4. Returns the predicted demand (rounded to nearest integer, non-negative)

## 📊 Feature Encoding

The backend currently uses these encoding schemes. **Make sure your Colab model uses the same encoding!**

### Categories
- `Uniform No 3` → 0
- `Uniform No 4` → 1
- `T-Shirt` → 2

### Types
- Encoded by index in predefined list (see `encodeType()` in `forecastUtils.ts`)

### Sizes
- XS→0, S→1, M→2, L→3, XL→4, 2XL→5, 3XL→6
- Shoe sizes: 4→10, 5→11, etc.
- Beret sizes: 6 1/2→30, 6 5/8→31, etc.
- Accessories (no size): -1

### Batch
- Extracts year from batch string (e.g., "Batch 2024" → 2024)

## ⚠️ Important Notes

### Feature Names Must Match

Your Colab model's feature names must match what the backend expects. Common names:
- `month`, `dayOfWeek`, `weekOfYear`
- `category_encoded`, `type_encoded`, `size_encoded`, `batch_encoded`
- `movingAverage7d`, `movingAverage30d`
- `demand_lag1`, `demand_lag7`
- `isAccessory`, `isWeekend`

If your Colab model uses different names, you have two options:

1. **Rename features in Colab** to match backend expectations
2. **Update backend code** in `src/utils/forecastUtils.ts` to match your Colab feature names

### Feature Order

The order of features in your `features` array must match the order of `coefficients`. This is critical for correct predictions.

### Scaling

If you scaled features in Colab (StandardScaler, MinMaxScaler), you need to:
1. Include scaler parameters in your model JSON
2. Update `predictLinearRegression()` in `forecastUtils.ts` to apply scaling before prediction

Currently, the backend assumes no scaling. If you used scaling, let me know and I can add scaling support.

## 🔄 Updating Your Model

When you retrain your model with better results:

1. Export new parameters from Colab
2. Update the `version` field (e.g., "1.0.0" → "1.1.0")
3. Upload using the same endpoint (POST `/api/forecast/model`)
4. The backend will update the existing model or create a new one

The backend always uses the **latest model** (sorted by `trainingDate`).

## 🧪 Testing Checklist

- [ ] Model uploaded successfully
- [ ] Model info endpoint returns correct data
- [ ] Single item forecast works
- [ ] All items forecast works
- [ ] Predictions are reasonable (non-negative, realistic values)
- [ ] Feature encoding matches Colab model
- [ ] Error handling works (missing model, invalid parameters)

## 📚 Additional Resources

- `ml_data_export/EXPORT_MODEL_FROM_COLAB.md` - Detailed Colab export guide
- `ml_data_export/UPLOAD_MODEL_TO_BACKEND.md` - Detailed upload guide
- `ML_DATA_PREPARATION_GUIDE.md` - Data preparation for ML
- `FORECASTING_GUIDE.md` - General forecasting concepts

## 🆘 Troubleshooting

### "Forecasting model not found"
- Upload a model first using POST `/api/forecast/model`
- Ensure model name is `uniform_demand_forecast`

### Predictions are 0 or unrealistic
- Check feature encoding matches between Colab and backend
- Verify feature names are correct
- Check if scaling was used (needs additional implementation)

### Feature mismatch errors
- Compare feature names in Colab model with backend expectations
- Update encoding functions if needed
- Ensure feature order matches coefficients order

## 💡 Future Enhancements

Possible improvements you could add:

1. **Multiple Models**: Support for Random Forest, XGBoost, etc.
2. **Model Comparison**: A/B test different models
3. **Auto-retraining**: Schedule model retraining with new data
4. **Feature Scaling**: Support for StandardScaler/MinMaxScaler
5. **Confidence Intervals**: Return prediction uncertainty
6. **Visualization**: Generate forecast charts

---

**Ready to use!** Export your model from Colab and upload it to start forecasting! 🚀

