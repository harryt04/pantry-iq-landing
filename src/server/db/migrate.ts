import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DATABASE_URL is required for migrations.');

const client = postgres(connectionString, { max: 1 });
await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
await client.end();
