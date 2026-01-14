# ============================================
# COPY THIS CODE INTO YOUR GOOGLE COLAB NOTEBOOK
# ============================================
# Simple code to merge 3 Excel sheets into one dataset

import pandas as pd

# Step 1: Read your Excel file (adjust filename)
excel_file = 'your_file.xlsx'  # Replace with your Excel filename

# Step 2: Specify your sheet names (adjust if different)
sheet_names = ['Batch1', 'Batch2', 'Batch3']  # Change to your actual sheet names

# Step 3: Read and combine all sheets
all_data = []

for sheet in sheet_names:
    print(f"Loading {sheet}...")
    df = pd.read_excel(excel_file, sheet_name=sheet)
    df['source_batch'] = sheet  # Add column to track which batch
    all_data.append(df)
    print(f"  ✓ {sheet}: {len(df)} rows, {len(df.columns)} columns")

# Step 4: Merge all sheets
merged_df = pd.concat(all_data, ignore_index=True)

print(f"\n✅ Successfully merged all sheets!")
print(f"Total rows: {len(merged_df)}")
print(f"Total columns: {len(merged_df.columns)}")
print(f"\nColumn names: {merged_df.columns.tolist()}")

# Step 5: Display first few rows
print("\nFirst 5 rows:")
print(merged_df.head())

# Step 6: Check for missing values
print("\nMissing values per column:")
print(merged_df.isnull().sum())

# Step 7: Save merged data (optional)
merged_df.to_csv('merged_all_batches.csv', index=False)
print("\n✅ Saved to: merged_all_batches.csv")

# Now use 'merged_df' for your ML model training!

