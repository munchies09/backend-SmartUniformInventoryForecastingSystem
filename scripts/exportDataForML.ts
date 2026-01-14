import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import MemberModel from '../src/models/memberModel';
import { MemberUniform } from '../src/models/uniformModel';
import { UniformInventory } from '../src/models/uniformModel';

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI as string;

/**
 * Export data for Machine Learning in Google Colab
 * This script exports uniform demand data with all relevant features for ML forecasting
 */

interface DemandRecord {
  date: string;
  year: number;
  month: number;
  day: number;
  dayOfWeek: number;
  weekOfYear: number;
  category: string;
  type: string;
  size: string | null;
  batch: string;
  quantity: number;
  // Features for ML
  memberBatchYear?: number;
  isAccessory: boolean;
  // Aggregate features (for time series)
  daysSinceStart?: number;
}

interface TimeSeriesData {
  date: string;
  category: string;
  type: string;
  size: string | null;
  demand: number;
  // Features
  batchYear?: number;
  month: number;
  dayOfWeek: number;
  weekOfYear: number;
  cumulativeDemand?: number;
  movingAverage7d?: number;
  movingAverage30d?: number;
}

async function exportMLData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected successfully');

    // Get all members with batch info
    const members = await MemberModel.find({ role: 'member' })
      .select('sispaId batch createdAt');
    
    const memberBatchMap = new Map<string, string>();
    const memberCreatedMap = new Map<string, Date>();
    
    members.forEach(member => {
      memberBatchMap.set(member.sispaId, member.batch);
      const memberDoc = member as any;
      memberCreatedMap.set(member.sispaId, memberDoc.createdAt);
    });

    // Get all uniform submissions
    const uniforms = await MemberUniform.find()
      .select('sispaId items createdAt updatedAt');
    
    console.log(`Found ${uniforms.length} uniform submissions`);

    // Transform to demand records
    const demandRecords: DemandRecord[] = [];
    let recordCount = 0;

    // Find earliest date for daysSinceStart calculation
    let earliestDate: Date | null = null;

    uniforms.forEach(uniform => {
      const uniformDoc = uniform as any;
      const submissionDate = uniformDoc.createdAt || uniformDoc.updatedAt;
      
      if (!earliestDate || submissionDate < earliestDate) {
        earliestDate = submissionDate;
      }

      const batch = memberBatchMap.get(uniform.sispaId) || 'Unknown';
      const date = new Date(submissionDate);
      
      // Extract time features
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // 1-12
      const day = date.getDate();
      const dayOfWeek = date.getDay(); // 0-6 (Sunday = 0)
      
      // Calculate week of year
      const startOfYear = new Date(year, 0, 1);
      const pastDaysOfYear = (date.getTime() - startOfYear.getTime()) / 86400000;
      const weekOfYear = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);

      // Extract batch year if possible (e.g., "2024" from batch string)
      let memberBatchYear: number | undefined;
      const batchMatch = batch.match(/\d{4}/);
      if (batchMatch) {
        memberBatchYear = parseInt(batchMatch[0]);
      }

      // Process each item in the submission
      uniform.items.forEach((item: any) => {
        const isAccessory = !item.size || item.size === 'N/A' || item.size === '';
        
        demandRecords.push({
          date: date.toISOString().split('T')[0], // YYYY-MM-DD format
          year,
          month,
          day,
          dayOfWeek,
          weekOfYear,
          category: item.category,
          type: item.type,
          size: item.size || null,
          batch,
          quantity: item.quantity || 1,
          memberBatchYear,
          isAccessory: isAccessory
        });
        
        recordCount++;
      });
    });

    console.log(`Created ${recordCount} demand records`);

    // Sort by date
    demandRecords.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate days since start for each record
    if (earliestDate) {
      const startDate = new Date(earliestDate);
      demandRecords.forEach(record => {
        const recordDate = new Date(record.date);
        record.daysSinceStart = Math.floor((recordDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      });
    }

    // Aggregate to time series format (daily demand per item)
    const timeSeriesMap = new Map<string, TimeSeriesData[]>();
    
    // Group by category, type, size
    const grouped = new Map<string, DemandRecord[]>();
    demandRecords.forEach(record => {
      const key = `${record.category}|${record.type}|${record.size || 'null'}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(record);
    });

    // Create time series for each item
    grouped.forEach((records, key) => {
      const [category, type, size] = key.split('|');
      const normalizedSize = size === 'null' ? null : size;
      
      // Group by date
      const dailyDemand = new Map<string, number>();
      records.forEach(record => {
        if (!dailyDemand.has(record.date)) {
          dailyDemand.set(record.date, 0);
        }
        dailyDemand.set(record.date, dailyDemand.get(record.date)! + record.quantity);
      });

      // Create time series entries
      const timeSeries: TimeSeriesData[] = [];
      dailyDemand.forEach((demand, date) => {
        const dateObj = new Date(date);
        const record = records.find(r => r.date === date);
        
        timeSeries.push({
          date,
          category,
          type,
          size: normalizedSize,
          demand,
          batchYear: record?.memberBatchYear,
          month: dateObj.getMonth() + 1,
          dayOfWeek: dateObj.getDay(),
          weekOfYear: record?.weekOfYear || 0
        });
      });

      // Sort by date
      timeSeries.sort((a, b) => a.date.localeCompare(b.date));

      // Calculate cumulative demand and moving averages
      let cumulative = 0;
      const demandValues: number[] = [];
      
      timeSeries.forEach((entry, index) => {
        cumulative += entry.demand;
        entry.cumulativeDemand = cumulative;
        demandValues.push(entry.demand);

        // 7-day moving average
        if (index >= 6) {
          const last7 = demandValues.slice(-7);
          entry.movingAverage7d = last7.reduce((sum, val) => sum + val, 0) / 7;
        }

        // 30-day moving average
        if (index >= 29) {
          const last30 = demandValues.slice(-30);
          entry.movingAverage30d = last30.reduce((sum, val) => sum + val, 0) / 30;
        }
      });

      timeSeriesMap.set(key, timeSeries);
    });

    // Convert time series map to array
    const allTimeSeries: TimeSeriesData[] = [];
    timeSeriesMap.forEach(series => {
      allTimeSeries.push(...series);
    });

    // Create output directory
    const outputDir = path.join(process.cwd(), 'ml_data_export');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Export 1: Raw demand records (for detailed analysis)
    const rawDataPath = path.join(outputDir, 'raw_demand_data.json');
    fs.writeFileSync(rawDataPath, JSON.stringify(demandRecords, null, 2));
    console.log(`✅ Exported raw demand data to: ${rawDataPath}`);
    console.log(`   Records: ${demandRecords.length}`);

    // Export 2: Time series data (for forecasting)
    const timeSeriesPath = path.join(outputDir, 'time_series_data.json');
    fs.writeFileSync(timeSeriesPath, JSON.stringify(allTimeSeries, null, 2));
    console.log(`✅ Exported time series data to: ${timeSeriesPath}`);
    console.log(`   Time series records: ${allTimeSeries.length}`);

    // Export 3: CSV format for easy import in Colab
    const csvPath = path.join(outputDir, 'demand_data.csv');
    const csvHeaders = 'date,year,month,day,dayOfWeek,weekOfYear,category,type,size,batch,quantity,memberBatchYear,isAccessory,daysSinceStart\n';
    const csvRows = demandRecords.map(record => 
      `${record.date},${record.year},${record.month},${record.day},${record.dayOfWeek},${record.weekOfYear},"${record.category}","${record.type}","${record.size || 'null'}","${record.batch}",${record.quantity},${record.memberBatchYear || ''},${record.isAccessory},${record.daysSinceStart || ''}`
    ).join('\n');
    fs.writeFileSync(csvPath, csvHeaders + csvRows);
    console.log(`✅ Exported CSV data to: ${csvPath}`);

    // Export 4: Time series CSV
    const tsCsvPath = path.join(outputDir, 'time_series_data.csv');
    const tsCsvHeaders = 'date,category,type,size,demand,batchYear,month,dayOfWeek,weekOfYear,cumulativeDemand,movingAverage7d,movingAverage30d\n';
    const tsCsvRows = allTimeSeries.map(entry => 
      `${entry.date},"${entry.category}","${entry.type}","${entry.size || 'null'}",${entry.demand},${entry.batchYear || ''},${entry.month},${entry.dayOfWeek},${entry.weekOfYear},${entry.cumulativeDemand || ''},${entry.movingAverage7d || ''},${entry.movingAverage30d || ''}`
    ).join('\n');
    fs.writeFileSync(tsCsvPath, tsCsvHeaders + tsCsvRows);
    console.log(`✅ Exported time series CSV to: ${tsCsvPath}`);

    // Export 5: Summary statistics
    const summary = {
      totalRecords: demandRecords.length,
      totalTimeSeriesRecords: allTimeSeries.length,
      dateRange: {
        earliest: demandRecords[0]?.date,
        latest: demandRecords[demandRecords.length - 1]?.date,
        totalDays: demandRecords.length > 0 ? 
          (new Date(demandRecords[demandRecords.length - 1].date).getTime() - 
           new Date(demandRecords[0].date).getTime()) / (1000 * 60 * 60 * 24) : 0
      },
      uniqueItems: timeSeriesMap.size,
      categories: [...new Set(demandRecords.map(r => r.category))],
      batches: [...new Set(demandRecords.map(r => r.batch))],
      totalQuantity: demandRecords.reduce((sum, r) => sum + r.quantity, 0)
    };

    const summaryPath = path.join(outputDir, 'data_summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`✅ Exported summary to: ${summaryPath}`);
    console.log('\n📊 Data Summary:');
    console.log(`   Total records: ${summary.totalRecords}`);
    console.log(`   Time series records: ${summary.totalTimeSeriesRecords}`);
    console.log(`   Date range: ${summary.dateRange.earliest} to ${summary.dateRange.latest}`);
    console.log(`   Unique items: ${summary.uniqueItems}`);
    console.log(`   Categories: ${summary.categories.join(', ')}`);
    console.log(`   Total quantity: ${summary.totalQuantity}`);

    console.log('\n✅ Data export completed!');
    console.log(`📁 All files saved to: ${outputDir}`);
    console.log('\n📝 Next steps:');
    console.log('   1. Upload CSV files to Google Colab');
    console.log('   2. Load data using pandas: df = pd.read_csv("demand_data.csv")');
    console.log('   3. Preprocess and engineer features');
    console.log('   4. Train ML models (Time Series, Regression, etc.)');
    console.log('   5. Export model and use in backend');

    await mongoose.disconnect();
    console.log('\n✅ Database disconnected');
  } catch (error: any) {
    console.error('❌ Error exporting data:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the export
exportMLData();

