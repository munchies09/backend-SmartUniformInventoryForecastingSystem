# ML Data Export & Preparation

## Quick Start

### Option 1: Export from MongoDB (Recommended)

If you have data in your MongoDB database:

```bash
npm run export-ml-data
```

This creates:
- `demand_data.csv` - Raw demand records with features
- `time_series_data.csv` - Time series format (daily aggregates)
- `data_summary.json` - Summary statistics

### Option 2: Use Excel Data (Current Approach)

If you have Excel files with separate sheets for each batch:

1. **For now (Single Batch)**: Upload one sheet to Colab
2. **Later (Multiple Batches)**: Use the merge script in Colab

## Excel Sheet Merging (When Ready)

### In Google Colab:

```python
import pandas as pd

# Upload Excel file
from google.colab import files
uploaded = files.upload()
excel_filename = list(uploaded.keys())[0]

# Read and merge all sheets
excel_file = pd.ExcelFile(excel_filename)
all_sheets = []

for sheet_name in excel_file.sheet_names:  # Or specify: ['Batch1', 'Batch2', 'Batch3']
    df = pd.read_excel(excel_filename, sheet_name=sheet_name)
    df['batch_sheet'] = sheet_name  # Track source
    all_sheets.append(df)

# Combine
merged_data = pd.concat(all_sheets, ignore_index=True)
print(f"Merged {len(all_sheets)} sheets: {len(merged_data)} rows")

# Save
merged_data.to_csv('merged_batches.csv', index=False)
```

## Current Recommendation

✅ **Using one batch is fine for now!**

- Develop your model with one batch
- Validate your approach
- Add more batches later for better accuracy

This shows good methodology in your FYP report.

