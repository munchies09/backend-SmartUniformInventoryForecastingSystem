# ML Models Directory

This directory stores pre-trained machine learning models used for forecasting.

## Model File

### `uniform_forecast.pkl`

This is the pre-trained ML model file that should be placed in this directory.

**How to add the model:**

1. Train your model in Google Colab or another ML environment
2. Save the trained model using `joblib`:
   ```python
   import joblib
   joblib.dump(model, 'uniform_forecast.pkl')
   ```
3. Download the `.pkl` file from Colab
4. Upload it to this `models/` directory in the backend

**Model Requirements:**

- Must be saved using `joblib` (scikit-learn compatible)
- Must accept feature vectors and return predictions
- Expected input features:
  - `total_issued`: Total number of items issued historically
  - `avg_quantity`: Average quantity per issue
  - `days_since_last_issue`: Days since last issue date
- Output: Predicted demand (integer, non-negative)

**Note:** The model file is not tracked in git (should be in `.gitignore`). Admins/developers should upload it manually after training.

## Usage

The model is automatically loaded and used when calling:
```
POST /api/forecast/run
```

The backend will:
1. Query historical data from the database
2. Load the model from `models/uniform_forecast.pkl`
3. Run predictions
4. Save recommendations to the database

## Error Handling

If the model file is not found, the API will return:
```json
{
  "success": false,
  "message": "Pre-trained model not found. Please upload a model first.",
  "error": "Model file not found: models/uniform_forecast.pkl"
}
```
