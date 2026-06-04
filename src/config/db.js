import mongoose from 'mongoose';
import { env, mongoTargetLabel, validateEnv } from './env.js';

export const connectDB = async () => {
  validateEnv();
  mongoose.set('strictQuery', true);
  console.log(`Connecting to ${mongoTargetLabel()}…`);
  const connection = await mongoose.connect(env.MONGODB_URI);
  console.log(`MongoDB connected: ${connection.connection.host} (${connection.connection.name})`);
  return connection;
};

export const dbStatus = () => mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
