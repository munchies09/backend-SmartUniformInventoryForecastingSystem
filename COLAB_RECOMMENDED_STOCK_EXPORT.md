# Export Recommended Stock from Google Colab

This guide shows you how to export recommended stock data from your Google Colab notebook and import it into the backend system.

## Step 1: Generate Recommended Stock in Colab

At the end of your Colab notebook, after your forecasting/analysis, create a DataFrame with recommended stock levels:

```python
# Example: After your forecasting analysis
# Assuming you have a dataframe with your results

import pandas as pd
from datetime import datetime

# Example: Create recommended stock DataFrame
# Your actual code will depend on how you generate recommendations in Colab

recommended_stock_data = []

# Loop through your items and generate recommendations
for item in your_items:  # Replace with your actual loop
    recommendation = {
        'category': item['category'],  # e.g., 'Uniform No 3'
        'type': item['type'],          # e.g., 'Cloth No 3'
        'size': item['size'],          # e.g., 'M' or None for accessories
        'recommendedStock': item['recommended_quantity'],  # Your calculated recommendation
        'currentStock': item['current_quantity'],  # Current stock in system
        'forecastedDemand': item.get('forecasted_demand'),  # Optional: if you calculated it
        'reorderQuantity': item.get('reorder_quantity'),   # Optional: how many to reorder
        'notes': item.get('notes', ''),  # Optional: any notes
        'analysisDate': datetime.now().isoformat()
    }
    recommended_stock_data.append(recommendation)

# Create DataFrame
recommendations_df = pd.DataFrame(recommended_stock_data)

# Display preview
print("Recommended Stock Data:")
print(recommendations_df.head())
print(f"\nTotal items: {len(recommendations_df)}")
```

## Step 2: Export to JSON Format

Export the recommendations to JSON format that the backend can import:

```python
# Convert DataFrame to JSON
import json

# Prepare data for export
export_data = {
    'recommendations': recommendations_df.to_dict('records'),
    'generatedAt': datetime.now().isoformat(),
    'source': 'google_colab',
    'totalItems': len(recommendations_df)
}

# Save to file
with open('recommended_stock.json', 'w') as f:
    json.dump(export_data, f, indent=2, default=str)

print("✅ Exported to recommended_stock.json")
print(f"📦 Total recommendations: {export_data['totalItems']}")

# Download from Colab
from google.colab import files
files.download('recommended_stock.json')
```

## Step 3: Expected JSON Format

The JSON file should have this structure:

```json
{
  "recommendations": [
    {
      "category": "Uniform No 3",
      "type": "Cloth No 3",
      "size": "M",
      "recommendedStock": 50,
      "currentStock": 20,
      "forecastedDemand": 45,
      "reorderQuantity": 30,
      "notes": "High demand expected next month",
      "analysisDate": "2024-01-15T10:30:00"
    },
    {
      "category": "Uniform No 3",
      "type": "Cloth No 3",
      "size": "L",
      "recommendedStock": 40,
      "currentStock": 15,
      "forecastedDemand": 38,
      "reorderQuantity": 25,
      "analysisDate": "2024-01-15T10:30:00"
    },
    {
      "category": "Uniform No 4",
      "type": "Hat",
      "size": null,
      "recommendedStock": 30,
      "currentStock": 10,
      "forecastedDemand": 28,
      "reorderQuantity": 20,
      "analysisDate": "2024-01-15T10:30:00"
    }
  ],
  "generatedAt": "2024-01-15T10:30:00",
  "source": "google_colab",
  "totalItems": 3
}
```

### Field Descriptions:

- **category** (required): `"Uniform No 3"`, `"Uniform No 4"`, or `"T-Shirt"`
- **type** (required): Item type name, e.g., `"Cloth No 3"`, `"Hat"`, etc.
- **size** (optional): Size string or `null` for accessories
- **recommendedStock** (required): The recommended stock level (number ≥ 0)
- **currentStock** (optional): Current stock at time of analysis (defaults to 0)
- **forecastedDemand** (optional): Forecasted demand if calculated
- **reorderQuantity** (optional): How many units to reorder
- **notes** (optional): Any additional notes
- **analysisDate** (optional): When the analysis was done (defaults to current date)

## Step 4: Complete Colab Export Example

Here's a complete example you can use in your Colab notebook:

```python
# ============================================
# EXPORT RECOMMENDED STOCK FOR BACKEND
# ============================================

import pandas as pd
import json
from datetime import datetime
from google.colab import files

# Assuming you have your analysis results in a variable called 'results'
# Adapt this to your actual data structure

def export_recommended_stock(results_df, output_filename='recommended_stock.json'):
    """
    Export recommended stock data from Colab analysis to JSON format
    for importing into the backend system.
    
    Args:
        results_df: DataFrame with columns:
            - category, type, size, recommended_stock, current_stock (optional)
            - forecasted_demand (optional), reorder_quantity (optional), notes (optional)
        output_filename: Name of the output JSON file
    """
    
    # Prepare recommendations list
    recommendations = []
    
    for _, row in results_df.iterrows():
        recommendation = {
            'category': str(row.get('category', '')),
            'type': str(row.get('type', '')),
            'size': row.get('size') if pd.notna(row.get('size')) else None,
            'recommendedStock': int(row.get('recommended_stock', 0)),
            'currentStock': int(row.get('current_stock', 0)) if pd.notna(row.get('current_stock')) else 0,
            'analysisDate': datetime.now().isoformat()
        }
        
        # Add optional fields
        if pd.notna(row.get('forecasted_demand')):
            recommendation['forecastedDemand'] = int(row.get('forecasted_demand'))
        
        if pd.notna(row.get('reorder_quantity')):
            recommendation['reorderQuantity'] = int(row.get('reorder_quantity'))
        
        if pd.notna(row.get('notes')):
            recommendation['notes'] = str(row.get('notes'))
        
        recommendations.append(recommendation)
    
    # Create export data
    export_data = {
        'recommendations': recommendations,
        'generatedAt': datetime.now().isoformat(),
        'source': 'google_colab',
        'totalItems': len(recommendations)
    }
    
    # Save to file
    with open(output_filename, 'w') as f:
        json.dump(export_data, f, indent=2, default=str)
    
    print(f"✅ Exported {len(recommendations)} recommendations to {output_filename}")
    print(f"📦 File ready for download")
    
    # Download file
    files.download(output_filename)
    
    return export_data

# Example usage:
# If you have a DataFrame with your recommendations:
# export_data = export_recommended_stock(your_results_df)

# Or create manually:
# sample_data = pd.DataFrame([
#     {
#         'category': 'Uniform No 3',
#         'type': 'Cloth No 3',
#         'size': 'M',
#         'recommended_stock': 50,
#         'current_stock': 20,
#         'forecasted_demand': 45,
#         'reorder_quantity': 30
#     },
#     # ... more items
# ])
# export_data = export_recommended_stock(sample_data)
```

## Step 5: Import to Backend

Once you have the JSON file, import it to the backend using the API:

### Option 1: Using cURL

```bash
curl -X POST http://localhost:5000/api/recommended-stock/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d @recommended_stock.json
```

### Option 2: Using Python (requests)

```python
import requests
import json

# Load the JSON file
with open('recommended_stock.json', 'r') as f:
    data = json.load(f)

# Import to backend
response = requests.post(
    'http://localhost:5000/api/recommended-stock/import',
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer YOUR_ADMIN_TOKEN'
    },
    json=data
)

print(response.json())
```

### Option 3: Using Frontend (Admin Panel)

See `FRONTEND_FORECASTING_INTEGRATION.md` for frontend integration examples.

## Step 6: Verify Import

After importing, check the recommendations:

```bash
# Get all recommendations
curl -X GET "http://localhost:5000/api/recommended-stock" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get inventory with recommendations
curl -X GET "http://localhost:5000/api/recommended-stock/inventory" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Quick Template for Your Colab Notebook

Add this cell at the end of your Colab notebook:

```python
# ============================================
# EXPORT RECOMMENDED STOCK
# Copy this to the end of your Colab notebook
# ============================================

# 1. Prepare your recommendations DataFrame
# (Replace this with your actual data processing)

recommendations_list = []

# Example: If you have recommendations in a list/dict format
for item in your_recommendations:  # Replace with your actual data source
    recommendations_list.append({
        'category': item['category'],
        'type': item['type'],
        'size': item.get('size'),  # None if no size
        'recommended_stock': item['recommended_stock'],
        'current_stock': item.get('current_stock', 0),
        'forecasted_demand': item.get('forecasted_demand'),
        'reorder_quantity': item.get('reorder_quantity'),
        'notes': item.get('notes', '')
    })

recommendations_df = pd.DataFrame(recommendations_list)

# 2. Export to JSON
import json
from datetime import datetime
from google.colab import files

export_data = {
    'recommendations': [
        {
            'category': str(row['category']),
            'type': str(row['type']),
            'size': row['size'] if pd.notna(row['size']) else None,
            'recommendedStock': int(row['recommended_stock']),
            'currentStock': int(row.get('current_stock', 0)) if pd.notna(row.get('current_stock')) else 0,
            'forecastedDemand': int(row['forecasted_demand']) if pd.notna(row.get('forecasted_demand')) else None,
            'reorderQuantity': int(row['reorder_quantity']) if pd.notna(row.get('reorder_quantity')) else None,
            'notes': str(row.get('notes', '')) if pd.notna(row.get('notes')) else None,
            'analysisDate': datetime.now().isoformat()
        }
        for _, row in recommendations_df.iterrows()
    ],
    'generatedAt': datetime.now().isoformat(),
    'source': 'google_colab',
    'totalItems': len(recommendations_df)
}

# Save and download
with open('recommended_stock.json', 'w') as f:
    json.dump(export_data, f, indent=2, default=str)

print(f"✅ Exported {export_data['totalItems']} recommendations")
files.download('recommended_stock.json')
print("📥 File downloaded! Import it to your backend system.")
```

## Notes

- **Size field**: Use `null` (not string "null") for accessories without size
- **Category values**: Must be exactly `"Uniform No 3"`, `"Uniform No 4"`, or `"T-Shirt"`
- **recommendedStock**: Must be a non-negative integer
- **Multiple imports**: Use `overwrite: true` in the import request to replace existing recommendations

## Troubleshooting

### Error: "category is required"
- Make sure all items have a `category` field

### Error: "type is required"
- Make sure all items have a `type` field

### Error: "recommendedStock must be non-negative"
- Check that all `recommendedStock` values are >= 0

### Recommendations not showing in inventory
- Make sure the category/type/size match exactly with inventory items
- Check that the import was successful (check response)

For more details, see the API documentation in `FRONTEND_FORECASTING_INTEGRATION.md`
