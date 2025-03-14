import dotenv from "dotenv";
import connectDB from "./database/db.js";
import { app } from "./app.js";

dotenv.config({path: "./env"});

connectDB()
    .then(() => {
        app.on("error", (error) => {
            console.log("Error: ", error);
            throw error            
        })
        app.listen(process.env.PORT || 4000, () => {
            console.log("\nServer is running on port: ", process.env.PORT);
        })
    }).catch((err) => {
        console.error("MongoDb connection failed !!! ", err);
    })
