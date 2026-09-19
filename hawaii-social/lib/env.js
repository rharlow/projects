// Loads .env and lets it win over anything already set in the shell.
// Imported first by server.js so the values exist before other modules evaluate.
import dotenv from "dotenv";
dotenv.config({ override: true });
