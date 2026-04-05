import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env in development; Vercel injects env vars directly in production
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000'),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_SECRET: z.string().min(10, 'JWT_SECRET must be at least 10 characters'),
  JWT_REFRESH_SECRET: z.string().min(10, 'JWT_REFRESH_SECRET must be at least 10 characters'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SUPER_ADMIN_EMAIL: z.string().email().default('admin@collabsystem.com'),
  SUPER_ADMIN_PASSWORD: z.string().min(6).default('SuperAdmin@123'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
