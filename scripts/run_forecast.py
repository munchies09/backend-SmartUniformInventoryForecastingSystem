#!/usr/bin/env python3
"""
Forecast Run Script - Loads pre-trained ML model and generates predictions

This script is called from Node.js backend to run forecast predictions.
It loads a .pkl model file and generates recommendations based on historical data.
"""

import sys
import json
import os
import joblib
import pandas as pd
import numpy as np
from pathlib import Path

# Model file path - use environment variable if provided, otherwise relative to script
MODEL_PATH = os.environ.get('MODEL_PATH') or os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
    'models', 
    'uniform_forecast.pkl'
)

def load_model():
    """Load pre-trained ML model from .pkl file"""
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")
    
    model = joblib.load(MODEL_PATH)
    return model

def encode_category(category):
    """Encode category to numeric"""
    category_map = {
        'Uniform No 3': 0,
        'Uniform No 4': 1,
        'T-Shirt': 2,
        'T Shirt': 2,
        'TShirt': 2,
        'Others': -1
    }
    return category_map.get(category, -1)

def encode_type(type_str):
    """Encode type to numeric - prioritizing forecastable items"""
    # Primary types for forecasting (with sizes)
    type_list = [
        'BAJU_NO_3_LELAKI',      # 0
        'BAJU_NO_3_PEREMPUAN',   # 1
        'BAJU_NO_4',             # 2
        'BOOT',                  # 3
        'PVC Shoes',             # 4 (for future use)
        # Other types (for compatibility)
        'Cloth No 3', 'Cloth No 4', 'Trousers No 3', 'Trousers No 4',
        'Hat', 'Beret', 'Shoes', 'Belt', 'Socks', 'Shirt', 'Jacket', 'BERET'
    ]
    try:
        return type_list.index(type_str)
    except:
        return len(type_list)  # Default encoding

def encode_size(size):
    """Encode size to numeric"""
    if pd.isna(size) or size is None or size == '':
        return -1
    
    size_map = {
        'XS': 0, 'S': 1, 'M': 2, 'L': 3, 'XL': 4, '2XL': 5, '3XL': 6,
        'XXL': 7, 'XXXL': 8, '4XL': 9, '5XL': 10
    }
    
    # Try direct mapping first
    if size in size_map:
        return size_map[size]
    
    # Try numeric sizes (for shoes, berets, etc.)
    try:
        size_num = float(size)
        # Shoe sizes: 4-13 -> 10-19
        if 4 <= size_num <= 13:
            return int(size_num) + 6
        # Beret sizes: 6.5-8.0 -> 20-35
        if 6.5 <= size_num <= 8.0:
            return int(size_num * 4) + 5
        return int(size_num)
    except:
        return -1

def normalize_cloth_size(size):
    """Normalize cloth sizes to standard format (matching Colab)"""
    if pd.isna(size) or size is None:
        return None
    
    size_str = str(size).strip().upper()
    
    # Handle variations
    size_map = {
        'XXS': 'XXS', 'XS': 'XS', 'S': 'S', 'M': 'M', 'L': 'L',
        'XL': 'XL', 'XXL': 'XXL', 'XXXL': 'XXXL',
        '2XL': 'XXL', '3XL': 'XXXL', '4XL': '4XL', '5XL': '5XL'
    }
    
    return size_map.get(size_str, size_str)

def prepare_features(historical_data):
    """
    Convert historical data to feature vector matching Colab model exactly
    
    Colab model uses:
    - Features: uniform_type_gendered, size (one-hot encoded)
    - Target: demand (aggregated)
    
    Input historical_data is already aggregated by type + size (like size_type_demand in Colab)
    """
    df = pd.DataFrame(historical_data)
    
    # Map 'type' to 'uniform_type_gendered' (Colab naming)
    if 'type' in df.columns:
        df['uniform_type_gendered'] = df['type']
    elif 'uniform_type' in df.columns:
        df['uniform_type_gendered'] = df['uniform_type']
    else:
        raise ValueError("historical_data must contain 'type' or 'uniform_type' column")
    
    # Ensure size exists
    if 'size' not in df.columns:
        raise ValueError("historical_data must contain 'size' column")
    
    # Normalize sizes based on uniform type (matching Colab logic)
    df['size_normalized'] = df['size'].copy()
    
    for idx, row in df.iterrows():
        uniform_type = str(row['uniform_type_gendered']).upper()
        original_size = row['size']
        
        # For BAJU types: normalize cloth sizes
        if 'BAJU' in uniform_type:
            df.at[idx, 'size_normalized'] = normalize_cloth_size(original_size)
        # For BOOT/BERET: keep as numeric (convert to float)
        elif any(x in uniform_type for x in ['BOOT', 'BERET']):
            try:
                df.at[idx, 'size_normalized'] = float(original_size)
            except:
                df.at[idx, 'size_normalized'] = None
        # For others: keep as string
        else:
            df.at[idx, 'size_normalized'] = str(original_size)
    
    # Drop rows with null sizes (matching Colab: df_predict = df_predict[df_predict['size'].notna()])
    df = df[df['size_normalized'].notna()].copy()
    
    if len(df) == 0:
        raise ValueError("No valid data after filtering null sizes")
    
    # Convert size_normalized back to string for one-hot encoding
    # (pd.get_dummies works with strings/categories)
    df['size'] = df['size_normalized'].astype(str)
    
    return df

def predict_demand(model, input_df):
    """
    Run predictions using pre-trained model
    
    Colab model expects one-hot encoded features:
    - uniform_type_gendered_BAJU_NO_3_LELAKI, uniform_type_gendered_BAJU_NO_3_PEREMPUAN, etc.
    - size_L, size_M, size_S, etc. (for cloth) or size_3.0, size_3.5, etc. (for BOOT)
    """
    """
    Run predictions using pre-trained model
    
    Args:
        model: Loaded ML model
        input_df: DataFrame with features
    
    Returns:
        DataFrame with predictions added
    """
    # Prepare features for one-hot encoding (matching Colab approach)
    # Colab does: X = size_type_demand[['uniform_type_gendered', 'size']]
    # Then: X_encoded = pd.get_dummies(X, columns=['uniform_type_gendered', 'size'])
    
    # Create feature DataFrame with uniform_type_gendered and size (matching Colab exactly)
    # Colab: X = size_type_demand[['uniform_type_gendered', 'size']]
    X_for_encoding = input_df[['uniform_type_gendered', 'size']].copy()
    
    # One-hot encode (matching Colab: pd.get_dummies)
    X_encoded = pd.get_dummies(X_for_encoding, columns=['uniform_type_gendered', 'size'])
    
    print(f"One-hot encoded features: {list(X_encoded.columns)[:15]}...", file=sys.stderr)
    print(f"Total features: {len(X_encoded.columns)}", file=sys.stderr)
    
    # Try to get feature names from model (if available)
    expected_features = None
    try:
        if hasattr(model, 'feature_names_in_'):
            expected_features = model.feature_names_in_
            print(f"Model expects {len(expected_features)} features: {list(expected_features)[:10]}...", file=sys.stderr)
        elif hasattr(model, 'get_feature_names_out'):
            expected_features = model.get_feature_names_out()
            print(f"Model expects {len(expected_features)} features: {list(expected_features)[:10]}...", file=sys.stderr)
    except:
        pass
    
    # Match features to model expectations
    if expected_features is not None:
        # Model has feature names - align our one-hot encoded features
        available_features = [f for f in expected_features if f in X_encoded.columns]
        missing_features = [f for f in expected_features if f not in X_encoded.columns]
        
        if missing_features:
            print(f"Warning: Missing {len(missing_features)} features. Adding zeros.", file=sys.stderr)
            print(f"Missing: {missing_features[:5]}...", file=sys.stderr)
        
        # Create feature matrix matching model's expected order
        X = np.zeros((len(X_encoded), len(expected_features)))
        for i, feat in enumerate(expected_features):
            if feat in X_encoded.columns:
                X[:, i] = X_encoded[feat].values
            # Missing features remain as 0 (default for one-hot encoding)
        
        print(f"Feature matrix shape: {X.shape}, Model expects: ({len(X_encoded)}, {len(expected_features)})", file=sys.stderr)
    else:
        # Model doesn't store feature names - use our one-hot encoded features as-is
        X = X_encoded.values
        print(f"Using one-hot encoded features directly. Shape: {X.shape}", file=sys.stderr)
    
    # Handle NaN values
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
    
    try:
        predictions = model.predict(X)
        print(f"Predictions generated: min={predictions.min():.2f}, max={predictions.max():.2f}, mean={predictions.mean():.2f}", file=sys.stderr)
    except Exception as e:
        print(f"Error: Model prediction failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        predictions = np.array([2] * len(input_df))  # Fallback to minimum stock
    
    # Ensure predictions are non-negative integers
    predictions = np.maximum(predictions, 0).astype(int)
    
    # Calculate recommended stock (15% buffer)
    input_df["predicted_demand"] = predictions
    input_df["recommended_stock"] = (predictions * 1.15).round().astype(int)
    
    # Ensure minimum stock level (at least 2 units)
    input_df["recommended_stock"] = input_df["recommended_stock"].apply(
        lambda x: max(int(x), 2)
    )
    
    return input_df

def main():
    """Main function - reads JSON from stdin, returns predictions as JSON"""
    try:
        # Read historical data from stdin
        input_data = json.load(sys.stdin)
        
        if not isinstance(input_data, list):
            raise ValueError("Input must be a JSON array of historical data records")
        
        if len(input_data) == 0:
            # Return empty results
            print(json.dumps({"success": True, "recommendations": []}))
            return
        
        # Load model
        model = load_model()
        print(f"Model loaded: {type(model).__name__}", file=sys.stderr)
        
        # Prepare features
        features_df = prepare_features(input_data)
        print(f"Prepared features: {list(features_df.columns)}", file=sys.stderr)
        print(f"Number of records: {len(features_df)}", file=sys.stderr)
        
        # Run predictions
        results_df = predict_demand(model, features_df)
        
        # Convert to list of dicts for JSON output
        recommendations = []
        for _, row in results_df.iterrows():
            rec = {
                "category": str(row.get('category', row.get('uniform_type', 'Others'))),
                "type": str(row.get('type', row.get('uniform_type', 'Unknown'))),
                "size": str(row['size']) if pd.notna(row.get('size')) else None,
                "forecasted_demand": int(row['predicted_demand']),
                "recommended_stock": int(row['recommended_stock'])
            }
            recommendations.append(rec)
        
        # Output results as JSON
        output = {
            "success": True,
            "recommendations": recommendations,
            "count": len(recommendations)
        }
        
        print(json.dumps(output))
        
    except FileNotFoundError as e:
        error_output = {
            "success": False,
            "error": str(e),
            "message": "Model file not found. Please ensure the model is uploaded to models/uniform_forecast.pkl"
        }
        print(json.dumps(error_output))
        sys.exit(1)
        
    except Exception as e:
        error_output = {
            "success": False,
            "error": str(e),
            "message": f"Prediction error: {str(e)}"
        }
        print(json.dumps(error_output))
        sys.exit(1)

if __name__ == "__main__":
    main()
