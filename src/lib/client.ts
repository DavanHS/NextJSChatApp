import type { AppType } from '../app/api/[[...slugs]]/route'
import { hc } from 'hono/client'

const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

// export const client = hc<AppType>('termi-chat-app.vercel.app/')
export const client = hc<AppType>(baseUrl)
