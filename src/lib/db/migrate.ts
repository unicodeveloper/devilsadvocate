import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./index";

migrate(db, { migrationsFolder: "./src/lib/db/migrations" });
console.log("migrations applied");
