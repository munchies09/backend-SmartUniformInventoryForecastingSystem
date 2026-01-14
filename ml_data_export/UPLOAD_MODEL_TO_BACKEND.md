# Upload Your Trained Linear Regression Model to Backend

## Quick Start

After training your model in Google Colab, upload it to your backend using these steps:

## Step 1: Export Model from Colab

Use the code in `EXPORT_MODEL_FROM_COLAB.md` to extract and download your model parameters as JSON.

## Step 2: Prepare the JSON Payload

Your model JSON should look like this:

```json
{
  "modelName": "uniform_demand_forecast",
  "modelType": "linear_regression",
  "version": "1.0.0",
  "features": ["month", "dayOfWeek", "category_encoded", "type_encoded", "size_encoded", "batch_encoded"],
  "coefficients": [0.5, -0.2, 1.3, 0.8, -0.1, 0.3],
  "intercept": 2.5,
  "accuracy": {
    "mae": 1.2,
    "rmse": 1.8,
    "r2": 0.85
  }
}
```

## Step 3: Upload via API

### Using cURL

```bash
curl -X POST http://localhost:5000/api/forecast/model \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d @model_parameters.json
```

### Using Postman

1. Method: `POST`
2. URL: `http://localhost:5000/api/forecast/model`
3. Headers:
   - `Content-Type: application/json`
   - `Authorization: Bearer YOUR_ADMIN_TOKEN`
4. Body (raw JSON): Paste your model JSON

### Using JavaScript/TypeScript

```typescript
const modelData = {
  modelName: 'uniform_demand_forecast',
  modelType: 'linear_regression',
  version: '1.0.0',
  features: ['month', 'dayOfWeek', 'category_encoded', ...],
  coefficients: [0.5, -0.2, 1.3, ...],
  intercept: 2.5,
  accuracy: {
    mae: 1.2,
    rmse: 1.8,
    r2: 0.85
  }
};

const response = await fetch('http://localhost:5000/api/forecast/model', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  },
  body: JSON.stringify(modelData)
});

const result = await response.json();
console.log(result);
```

### Using Python (requests)

```python
import requests
import json

# Load your model JSON
with open('model_parameters.json', 'r') as f:
    model_data = json.load(f)

# Upload to backend
response = requests.post(
    'http://localhost:5000/api/forecast/model',
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {admin_token}'
    },
    json=model_data
)

print(response.json())
```

## Step 4: Verify Model Upload

Check if the model was uploaded successfully:

```bash
curl -X GET http://localhost:5000/api/forecast/model \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Or in your browser/Postman:
- Method: `GET`
- URL: `http://localhost:5000/api/forecast/model`
- Headers: `Authorization: Bearer YOUR_ADMIN_TOKEN`

## Step 5: Test Forecasting

### Get forecast for specific item

```bash
curl -X GET "http://localhost:5000/api/forecast?category=Uniform%20No%203&type=Cloth%20No%203&size=M" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get forecasts for all items

```bash
curl -X GET "http://localhost:5000/api/forecast/all" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Important Notes

### Feature Names Must Match

Ensure your feature names in the JSON match what the backend expects. Common feature names:

- `month`, `dayOfWeek`, `weekOfYear`
- `category_encoded`, `type_encoded`, `size_encoded`, `batch_encoded`
- `movingAverage7d`, `movingAverage30d`
- `demand_lag1`, `demand_lag7`
- `isAccessory`, `isWeekend`

If your Colab model uses different feature names, update the feature mapping in `src/utils/forecastUtils.ts`.

### Feature Order Matters

The `features` array and `coefficients` array must be in the same order.

### Coefficient Count

The number of features must equal the number of coefficients.

## Troubleshooting

### Error: "Features array length must match coefficients array length"

- Check that `features.length === coefficients.length`
- Ensure both are arrays, not objects

### Error: "Forecasting model not found"

- Model hasn't been uploaded yet
- Model name doesn't match `uniform_demand_forecast`
- Upload the model first using POST `/api/forecast/model`

### Forecast returns 0 or unexpected values

- Check that feature encoding matches between Colab and backend
- Verify feature names are correct
- Check if data was scaled in Colab (scaler parameters should be included)

### Feature encoding doesn't match

Update the encoding functions in `src/utils/forecastUtils.ts`:
- `encodeCategory()`
- `encodeType()`
- `encodeSize()`
- `encodeBatch()`

## Example: Complete Workflow

1. **Train model in Colab**
   ```python
   from sklearn.linear_model import LinearRegression
   model = LinearRegression()
   model.fit(X_train, y_train)
   ```

2. **Export parameters**
   ```python
   model_params = {
       'modelName': 'uniform_demand_forecast',
       'modelType': 'linear_regression',
       'version': '1.0.0',
       'features': X_train.columns.tolist(),
       'coefficients': model.coef_.tolist(),
       'intercept': float(model.intercept_),
       'accuracy': {'mae': mae, 'rmse': rmse, 'r2': r2}
   }
   ```

3. **Download JSON from Colab**
   ```python
   import json
   with open('model.json', 'w') as f:
       json.dump(model_params, f)
   from google.colab import files
   files.download('model.json')
   ```

4. **Upload to backend**
   ```bash
   curl -X POST http://localhost:5000/api/forecast/model \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d @model.json
   ```

5. **Test forecast**
   ```bash
   curl -X GET "http://localhost:5000/api/forecast?category=Uniform%20No%203&type=Cloth%20No%203&size=M" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

## Next Steps

After uploading your model:
1. Test forecasts with different items
2. Compare predictions with actual demand
3. Retrain and re-upload if accuracy improves
4. Update the model version number when re-uploading

