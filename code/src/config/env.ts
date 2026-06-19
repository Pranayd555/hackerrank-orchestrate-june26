import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file from project root (2 levels up from code/src/config)
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const EnvSchema = z.object({
  VISION_PROVIDER: z.enum(['qwen', 'gemma', 'gemini']).default('qwen'),
  OLLAMA_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('qwen3-vl:latest'),
  GEMINI_API_KEY: z.string().optional(),
  WORKSPACE_ROOT: z.string().default(path.resolve(__dirname, '../../../')),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Environment configuration validation failed:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof EnvSchema>;
