"""
Google Colab Script: Merge Multiple Excel Sheets into One Dataset
Use this script in your Colab notebook to combine 3 batch sheets from Excel
"""

import pandas as pd
import numpy as np

def merge_excel_sheets(excel_file_path, sheet_names=None, output_file='merged_data.csv'):
    """
    Merge multiple Excel sheets into a single DataFrame
    
    Args:
        excel_file_path: Path to Excel file
        sheet_names: List of sheet names to merge (e.g., ['Batch1', 'Batch2', 'Batch3'])
                    If None, merges all sheets
        output_file: Output CSV filename
    
    Returns:
        Merged DataFrame
    """
    # Read Excel file
    excel_file = pd.ExcelFile(excel_file_path)
    
    # Get sheet names if not provided
    if sheet_names is None:
        sheet_names = excel_file.sheet_names
        print(f"Found {len(sheet_names)} sheets: {sheet_names}")
    
    # Read and combine all sheets
    all_dataframes = []
    
    for sheet_name in sheet_names:
        print(f"\nReading sheet: {sheet_name}")
        df = pd.read_excel(excel_file_path, sheet_name=sheet_name)
        
        # Add sheet name as batch identifier if not present
        if 'batch' not in df.columns.str.lower():
            df['source_batch'] = sheet_name
            print(f"  Added 'source_batch' column with value: {sheet_name}")
        
        print(f"  Rows: {len(df)}, Columns: {df.columns.tolist()}")
        all_dataframes.append(df)
    
    # Combine all dataframes
    print(f"\nMerging {len(all_dataframes)} sheets...")
    merged_df = pd.concat(all_dataframes, ignore_index=True, sort=False)
    
    print(f"\n✅ Merged dataset:")
    print(f"   Total rows: {len(merged_df)}")
    print(f"   Total columns: {len(merged_df.columns)}")
    print(f"\nColumns: {merged_df.columns.tolist()}")
    
    # Display first few rows
    print(f"\nFirst 5 rows:")
    print(merged_df.head())
    
    # Display data types and missing values
    print(f"\nData Info:")
    print(merged_df.info())
    
    print(f"\nMissing values:")
    print(merged_df.isnull().sum())
    
    # Save to CSV
    if output_file:
        merged_df.to_csv(output_file, index=False)
        print(f"\n✅ Saved merged data to: {output_file}")
    
    return merged_df

# ========================================
# USAGE IN COLAB:
# ========================================
"""
# Method 1: Upload Excel file to Colab, then run:

# Upload the Excel file
from google.colab import files
uploaded = files.upload()

# Get the filename
excel_filename = list(uploaded.keys())[0]

# Merge all sheets (or specify sheet names)
merged_data = merge_excel_sheets(
    excel_filename,
    sheet_names=['Batch1', 'Batch2', 'Batch3'],  # Or None to merge all
    output_file='merged_batches.csv'
)

# Now you can use merged_data for training
"""

