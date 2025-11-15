import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public";

if (!process.env.DATABASE_URL) {
  console.warn(
    "DATABASE_URL is not set; Prisma will use a placeholder connection string. Set DATABASE_URL to connect to a real database."
  );
}


export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: databaseUrl,
  },
});
