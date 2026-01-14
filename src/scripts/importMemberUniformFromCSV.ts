import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { MemberUniform } from '../models/uniformModel';

// Load environment variables (same as main app)
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Use same MongoDB URI as main app, or fallback
const MONGO_URI = process.env.MONGODB_URI || 
                  process.env.MONGO_URI || 
                  'mongodb://127.0.0.1:27017/smartuniforminventoryforecastingsystem';

const CSV_FILE_PATH = path.join(
  __dirname,
  '../../ml_data_export/member_uniform_history.csv'
);

interface CSVRow {
  issue_date: string;
  category: string;
  type: string;
  size?: string;
  quantity: string;
}

async function run() {
  console.log('🔌 Connecting to MongoDB...');
  console.log(`📍 MongoDB URI: ${MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`); // Hide credentials
  await mongoose.connect(MONGO_URI);

  // Ask if user wants to clear existing imported data (optional)
  const clearExisting = process.argv.includes('--clear');
  if (clearExisting) {
    console.log('🗑️  Clearing existing imported data...');
    const deleteResult = await MemberUniform.deleteMany({ sispaId: /^IMPORT_/ });
    console.log(`   Deleted ${deleteResult.deletedCount} existing imported records`);
  }

  console.log('📄 Reading CSV...');
  const rows: CSVRow[] = [];

  fs.createReadStream(CSV_FILE_PATH)
    .pipe(csv())
    .on('data', (row: CSVRow) => {
      rows.push(row);
    })
    .on('end', async () => {
      console.log(`📦 ${rows.length} rows found in CSV`);
      console.log('📥 Starting import...\n');

      let imported = 0;
      let skipped = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        // Validate required fields
        if (!row.issue_date || !row.type || !row.quantity) {
          console.warn(`⚠️ Row ${i + 1}: Skipping invalid row (missing fields)`);
          skipped++;
          continue;
        }

        const issueDate = new Date(row.issue_date);
        if (isNaN(issueDate.getTime())) {
          console.warn(`⚠️ Row ${i + 1}: Invalid date: ${row.issue_date}`);
          skipped++;
          continue;
        }

        // For demo/import: use a unique dummy sispaId for each row (using index to ensure uniqueness)
        const dummySispaId = `IMPORT_${i}_${Date.now()}`;
        
        try {
          const doc = new MemberUniform({
            sispaId: dummySispaId,
            createdAt: issueDate,
            items: [
              {
                category: row.category || 'Others',
                type: row.type,
                size: row.size ? row.size : null,
                quantity: Number(row.quantity)
              }
            ]
          });
          await doc.save({ validateBeforeSave: false });
          imported++;
          
          // Show progress every 10 rows
          if ((i + 1) % 10 === 0) {
            console.log(`   📥 Imported ${i + 1}/${rows.length} rows...`);
          }
        } catch (error: any) {
          console.warn(`⚠️ Row ${i + 1}: Failed to save - ${error.message}`);
          skipped++;
        }
      }

      console.log('\n✅ Import completed successfully!');
      console.log(`   ✅ Imported: ${imported} records`);
      console.log(`   ⚠️  Skipped: ${skipped} records`);
      console.log(`   📊 Total: ${rows.length} rows processed`);
      await mongoose.disconnect();
      process.exit(0);
    });
}

run().catch((err) => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});
