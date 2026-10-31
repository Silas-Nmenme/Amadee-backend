
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("MONGO_URI is missing from your environment variables.");
    }

    if (mongoose.connection.readyState === 1) {
      console.log("MongoDB is already connected.");
      return mongoose.connection;
    }

    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: process.env.NODE_ENV === "production" ? 5 : 10,
      socketTimeoutMS: 45000,
    });

    console.log(`MongoDB connected`);

    return conn.connection;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

export default connectDB;
