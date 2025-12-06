const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // UPDATED: Now uses the environment variable 'MONGO_URI'
    // If that variable isn't found (like on your laptop without .env), it falls back to localhost
    const conn = await mongoose.connect(
      process.env.MONGO_URI || "mongodb://localhost:27017/perdrive"
    );

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
