import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchemaBase = z.object({
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/real-time-chat'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  REDIS_URL: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
});

const envSchema = envSchemaBase.superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production') {
    if (!data.CLERK_SECRET_KEY) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['CLERK_SECRET_KEY'], message: 'Required in production' });
    if (!data.CLERK_PUBLISHABLE_KEY) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['CLERK_PUBLISHABLE_KEY'], message: 'Required in production' });
    if (!data.CLOUDINARY_CLOUD_NAME) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['CLOUDINARY_CLOUD_NAME'], message: 'Required in production' });
    if (!data.CLOUDINARY_API_KEY) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['CLOUDINARY_API_KEY'], message: 'Required in production' });
    if (!data.CLOUDINARY_API_SECRET) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['CLOUDINARY_API_SECRET'], message: 'Required in production' });
    if (!data.REDIS_URL) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['REDIS_URL'], message: 'Required in production' });
  }
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
