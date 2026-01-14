# Export Linear Regression Model from Google Colab

## Step 1: Extract Model Parameters from Your Trained Model

After training your Linear Regression model in Colab, extract the parameters:

```python
# After training your Linear Regression model
from sklearn.linear_model import LinearRegression
import json

# Assuming you have trained a model called 'model'
# and your feature names in 'feature_names'

# Extract model parameters
model_params = {
    'modelName': 'uniform_demand_forecast',
    'modelType': 'linear_regression',
    'version': '1.0.0',
    'features': feature_names.tolist(),  # List of feature names
    'coefficients': model.coef_.tolist(),  # Model coefficients
    'intercept': float(model.intercept_),  # Model intercept
    'accuracy': {
        'mae': float(mae_score),  # Your MAE score
        'rmse': float(rmse_score),  # Your RMSE score
        'r2': float(r2_score)  # Your R2 score
    }
}

# Save to JSON
with open('model_parameters.json', 'w') as f:
    json.dump(model_params, f, indent=2)

print("Model parameters saved to model_parameters.json")
print(f"Features: {len(model_params['features'])}")
print(f"Coefficients: {len(model_params['coefficients'])}")
```

## Step 2: Complete Export Code for Your Colab

Here's a complete example that handles your specific case:

```python
# ============================================
# EXPORT LINEAR REGRESSION MODEL PARAMETERS
# ============================================
import json
import numpy as np
from sklearn.linear_model import LinearRegression

# Assuming you have:
# - X_train, X_test (feature arrays)
# - y_train, y_test (target values)
# - feature_names (list of feature names)

# Train model (if not already trained)
# model = LinearRegression()
# model.fit(X_train, y_train)

# Evaluate model (if not already done)
# y_pred = model.predict(X_test)
# from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
# mae = mean_absolute_error(y_test, y_pred)
# rmse = np.sqrt(mean_squared_error(y_test, y_pred))
# r2 = r2_score(y_test, y_pred)

# Prepare model parameters for export
model_params = {
    'modelName': 'uniform_demand_forecast',
    'modelType': 'linear_regression',
    'version': '1.0.0',
    'features': feature_names.tolist() if hasattr(feature_names, 'tolist') else list(feature_names),
    'coefficients': model.coef_.tolist() if hasattr(model.coef_, 'tolist') else list(model.coef_),
    'intercept': float(model.intercept_),
    'accuracy': {
        'mae': float(mae),
        'rmse': float(rmse),
        'r2': float(r2)
    }
}

# Save to JSON file
with open('linear_regression_model.json', 'w') as f:
    json.dump(model_params, f, indent=2)

# Download the file
from google.colab import files
files.download('linear_regression_model.json')

print("✅ Model exported successfully!")
print(f"Model: {model_params['modelName']}")
print(f"Features: {len(model_params['features'])}")
print(f"Accuracy - MAE: {mae:.2f}, RMSE: {rmse:.2f}, R2: {r2:.3f}")
print("\nNext step: Upload this JSON to your backend using the API endpoint")
```

## Step 3: Handle Feature Scaling (If Used)

If you scaled your features during training, include scaler parameters:

```python
from sklearn.preprocessing import StandardScaler

# If you used StandardScaler
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)

# Include scaler parameters in export
model_params = {
    # ... other params ...
    'scaler': {
        'mean': scaler.mean_.tolist(),
        'std': scaler.scale_.tolist()
    }
}
```

## Step 4: Verify Feature Names Match

**IMPORTANT**: Make sure your feature names match what the backend expects!

Common feature names that should match:
- `category_encoded`, `type_encoded`, `size_encoded`
- `month`, `dayOfWeek`, `weekOfYear`
- `movingAverage7d`, `movingAverage30d`
- `demand_lag1`, `demand_lag7`
- `isAccessory`, `isWeekend`

## Step 5: Upload Model to Backend

Once you have the JSON file, upload it using the API:

```bash
POST /api/forecast/model
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "modelName": "uniform_demand_forecast",
  "modelType": "linear_regression",
  "version": "1.0.0",
  "features": ["month", "dayOfWeek", "category_encoded", ...],
  "coefficients": [0.5, -0.2, 1.3, ...],
  "intercept": 2.5,
  "accuracy": {
    "mae": 1.2,
    "rmse": 1.8,
    "r2": 0.85
  }
}
```

## Example: Full Colab Workflow

```python
# 1. Load and prepare data
import pandas as pd
df = pd.read_csv('your_data.csv')

# 2. Feature engineering
X = df[['month', 'dayOfWeek', 'category_encoded', 'type_encoded', ...]]
y = df['demand']
feature_names = X.columns

# 3. Split data
from sklearn.model_selection import train_test_split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

# 4. Train model
from sklearn.linear_model import LinearRegression
model = LinearRegression()
model.fit(X_train, y_train)

# 5. Evaluate
y_pred = model.predict(X_test)
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
mae = mean_absolute_error(y_test, y_pred)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
r2 = r2_score(y_test, y_pred)

print(f"MAE: {mae:.2f}, RMSE: {rmse:.2f}, R2: {r2:.3f}")

# 6. Export
model_params = {
    'modelName': 'uniform_demand_forecast',
    'modelType': 'linear_regression',
    'version': '1.0.0',
    'features': feature_names.tolist(),
    'coefficients': model.coef_.tolist(),
    'intercept': float(model.intercept_),
    'accuracy': {
        'mae': float(mae),
        'rmse': float(rmse),
        'r2': float(r2)
    }
}

import json
with open('model.json', 'w') as f:
    json.dump(model_params, f, indent=2)

from google.colab import files
files.download('model.json')
```

## Troubleshooting

### Feature Names Don't Match

Update the feature encoding functions in `src/utils/forecastUtils.ts` to match your Colab encoding.

### Different Feature Order

Ensure the `features` array in the JSON matches the order of `coefficients`.

### Scaling Used

If you used feature scaling, include scaler parameters and update the prediction function to scale features before prediction.

