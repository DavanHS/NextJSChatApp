import { treaty } from '@elysiajs/eden'
import type { app } from '../app/api/[[...slugs]]/route'

// .api to enter /api prefix
export const client = treaty<typeof app>('localhost:3000').api
