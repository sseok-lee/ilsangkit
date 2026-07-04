import { z } from 'zod';

export const AdminLoginSchema = z.object({ password: z.string().min(1).max(200) });
