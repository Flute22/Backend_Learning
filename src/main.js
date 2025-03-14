import dotenv from "dotenv";
import connectDB from "./database/db.js";

dotenv.config({path: "./env"});

connectDB()
