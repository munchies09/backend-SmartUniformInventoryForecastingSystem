/**
 * ML Forecast Service
 *
 * Service to interact with Python ML model for forecasting
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface HistoricalDataRecord {
  uniform_type: string;
  type?: string;
  category?: string;
  size?: string | null;
  total_issued?: number;
  avg_quantity?: number;
  last_issue_date?: string | Date;
}

interface ForecastRecommendation {
  category: string;
  type: string;
  size: string | null;
  forecasted_demand: number;
  recommended_stock: number;
}

interface ForecastResult {
  success: boolean;
  recommendations?: ForecastRecommendation[];
  count?: number;
  error?: string;
  message?: string;
}

export class MLForecastService {
  private pythonScriptPath: string;
  private modelPath: string;

  constructor() {
    // Path to Python script (relative to project root)
    this.pythonScriptPath = path.join(__dirname, '../../scripts/run_forecast.py');
    // Path to model file
    this.modelPath = path.join(__dirname, '../../models/uniform_forecast.pkl');
  }

  /**
   * Check if model file exists
   */
  checkModelExists(): boolean {
    return fs.existsSync(this.modelPath);
  }

  /**
   * Run forecast predictions using Python ML model
   * 
   * @param historicalData Array of historical data records
   * @returns Forecast recommendations
   */
  async runForecast(historicalData: HistoricalDataRecord[]): Promise<ForecastResult> {
    // Check if model exists
    if (!this.checkModelExists()) {
      return {
        success: false,
        error: `Model file not found: ${this.modelPath}`,
        message: 'Pre-trained model not found. Please upload a model first.'
      };
    }

    // Check if Python script exists
    if (!fs.existsSync(this.pythonScriptPath)) {
      return {
        success: false,
        error: `Python script not found: ${this.pythonScriptPath}`,
        message: 'Forecast script not found.'
      };
    }

    // Prepare data for Python script
    const inputData = JSON.stringify(historicalData);

    // Use python3 or python depending on system
    const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';

    // Return a promise that wraps the spawned Python process
    return new Promise<ForecastResult>((resolve, reject) => {
      try {
        console.log(`🐍 Spawning Python: ${pythonCommand} ${this.pythonScriptPath}`);
        console.log(`📦 Input data size: ${inputData.length} bytes`);
        console.log(`📁 Model path: ${this.modelPath}`);
        
        const python = spawn(pythonCommand, [this.pythonScriptPath], {
          env: {
            ...process.env,
            PYTHONUNBUFFERED: '1', // Ensure Python output is not buffered
            MODEL_PATH: this.modelPath // Pass model path as environment variable
          },
          cwd: path.join(__dirname, '../..') // Set working directory to project root
        });

        let stdout = '';
        let stderr = '';

        python.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        python.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        python.on('error', (error) => {
          console.error('ML Forecast Service spawn error:', error);
          if ((error as any).code === 'ENOENT') {
            return resolve({
              success: false,
              error: 'Python not found',
              message: 'Python 3 is required but not found in PATH. Please install Python 3.'
            });
          }

          return resolve({
            success: false,
            error: error.message || 'Unknown error',
            message: 'Failed to run forecast prediction'
          });
        });

        python.on('close', (code) => {
          if (stderr && !stderr.includes('Warning:')) {
            console.warn('Python script stderr:', stderr);
          }

          if (code !== 0) {
            console.error(`❌ Python script exited with code ${code}`);
            console.error('Python stderr:', stderr);
            console.error('Python stdout (partial):', stdout.substring(0, 500));
            return resolve({
              success: false,
              error: `Python exited with code ${code}: ${stderr || 'No error message'}`,
              message: 'Failed to run forecast prediction'
            });
          }

          if (!stdout || stdout.trim().length === 0) {
            console.error('❌ Python script returned empty output');
            return resolve({
              success: false,
              error: 'Python script returned empty output',
              message: 'Failed to get forecast results from Python script'
            });
          }

          try {
            const result: ForecastResult = JSON.parse(stdout);

            if (!result.success) {
              console.error('❌ Python script returned error:', result.error);
              return resolve({
                success: false,
                error: result.error || 'Unknown error',
                message: result.message || 'Failed to generate forecast'
              });
            }

            console.log(`✅ ML Forecast Service: Generated ${result.recommendations?.length || 0} recommendations`);
            return resolve(result);
          } catch (error: any) {
            console.error('❌ ML Forecast Service JSON parse error:', error);
            console.error('Raw stdout:', stdout.substring(0, 1000));
            return resolve({
              success: false,
              error: `Invalid response from Python script: ${error.message}`,
              message: 'Failed to parse forecast results'
            });
          }
        });

        // Send data to Python via stdin
        python.stdin.write(inputData);
        python.stdin.end();
      } catch (error: any) {
        console.error('ML Forecast Service Error:', error);
        return resolve({
          success: false,
          error: error.message || 'Unknown error',
          message: 'Failed to run forecast prediction'
        });
      }
    });
  }
}

// Export singleton instance
export const mlForecastService = new MLForecastService();
