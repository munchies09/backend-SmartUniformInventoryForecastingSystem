# Google Colab Notebook Template for Uniform Demand Forecasting

## Quick Start: Merging Excel Sheets

If you have Excel data with multiple sheets (Batch1, Batch2, Batch3), use this code:

### Step 1: Upload Excel File to Colab

```python
from google.colab import files
import pandas as pd
import numpy as np

# Upload your Excel file
uploaded = files.upload()
excel_filename = list(uploaded.keys())[0]
print(f"Uploaded: {excel_filename}")
```

### Step 2: Merge Multiple Sheets

```python
# Option A: Merge all sheets automatically
excel_file = pd.ExcelFile(excel_filename)
all_sheets = []
for sheet_name in excel_file.sheet_names:
    print(f"Reading sheet: {sheet_name}")
    df = pd.read_excel(excel_filename, sheet_name=sheet_name)
    df['source_sheet'] = sheet_name  # Keep track of which sheet
    all_sheets.append(df)

# Combine all sheets
merged_data = pd.concat(all_sheets, ignore_index=True)
print(f"\n✅ Merged {len(excel_file.sheet_names)} sheets")
print(f"Total rows: {len(merged_data)}")
print(f"Columns: {merged_data.columns.tolist()}")
```

### Step 3: Clean and Prepare Data

```python
# Inspect data
print(merged_data.head())
print(merged_data.info())
print(merged_data.describe())

# Check for missing values
print("\nMissing values:")
print(merged_data.isnull().sum())

# Standardize column names (if needed)
merged_data.columns = merged_data.columns.str.strip().str.lower()
```

### Step 4: Data Preprocessing

```python
# Convert date columns to datetime
if 'date' in merged_data.columns:
    merged_data['date'] = pd.to_datetime(merged_data['date'], errors='coerce')

# Extract time features
if 'date' in merged_data.columns:
    merged_data['year'] = merged_data['date'].dt.year
    merged_data['month'] = merged_data['date'].dt.month
    merged_data['day'] = merged_data['date'].dt.day
    merged_data['dayOfWeek'] = merged_data['date'].dt.dayofweek
    merged_data['weekOfYear'] = merged_data['date'].dt.isocalendar().week

# Handle categorical variables
# One-hot encode or label encode as needed
```

### Step 5: Save Cleaned Data

```python
# Save for future use
merged_data.to_csv('cleaned_merged_data.csv', index=False)
print("✅ Saved cleaned data to: cleaned_merged_data.csv")
```

## Using Only One Batch (Current Approach)

If you're currently using just one sheet, that's perfectly fine! You can:

1. **Develop your model** with one batch first
2. **Validate the approach** 
3. **Add more batches later** for better accuracy

### Working with Single Batch

```python
# Read single sheet
df = pd.read_excel(excel_filename, sheet_name='Batch1')  # or your sheet name

# Continue with preprocessing and model training
```

## Recommendation for Your FYP

### Phase 1: Development (Current - One Batch)
- ✅ Use one batch to develop and test your model
- ✅ Establish the pipeline
- ✅ Validate the approach works

### Phase 2: Expansion (Later - All Batches)
- ✅ Merge all batches when ready
- ✅ Retrain model with more data
- ✅ Compare single-batch vs multi-batch performance
- ✅ Document the improvement

This approach shows good methodology in your FYP report:
- You started with a subset of data
- Validated your approach
- Expanded to full dataset
- Measured improvement

## Advanced: Smart Merging (Handle Different Column Names)

If your sheets have slightly different column structures:

```python
def smart_merge_sheets(excel_file_path, sheet_names):
    """Merge sheets even if column names differ slightly"""
    excel_file = pd.ExcelFile(excel_file_path)
    all_dataframes = []
    
    for sheet_name in sheet_names:
        df = pd.read_excel(excel_file_path, sheet_name=sheet_name)
        
        # Normalize column names (lowercase, strip spaces)
        df.columns = df.columns.str.strip().str.lower()
        
        # Add batch identifier
        df['batch_sheet'] = sheet_name
        
        all_dataframes.append(df)
    
    # Find common columns
    common_cols = set(all_dataframes[0].columns)
    for df in all_dataframes[1:]:
        common_cols = common_cols.intersection(set(df.columns))
    
    print(f"Common columns across sheets: {list(common_cols)}")
    
    # Keep only common columns
    for i, df in enumerate(all_dataframes):
        all_dataframes[i] = df[[col for col in df.columns if col in common_cols]]
    
    # Merge
    merged = pd.concat(all_dataframes, ignore_index=True)
    return merged

# Usage
merged = smart_merge_sheets(excel_filename, ['Batch1', 'Batch2', 'Batch3'])
```

## Notes

- **Using one batch is fine** for development and testing
- **Merging batches later** will improve model accuracy
- **Document your process** - show single batch first, then multi-batch
- **Compare results** - single batch vs multi-batch performance

