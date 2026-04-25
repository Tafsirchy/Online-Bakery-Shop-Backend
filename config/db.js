const mongoose = require('mongoose');
const dns = require('dns');

// Set DNS servers to Google's to bypass local resolution issues with SRV records
dns.setServers(['8.8.8.8', '8.8.4.4']);

let cachedConnection = null;

let connectingPromise = null;

const connectDB = async () => {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  if (connectingPromise) {
    return connectingPromise;
  }

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing');
  }

  connectingPromise = mongoose
    .connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      family: 4, // Force IPv4 to resolve ECONNREFUSED issues on some networks
    })
    .then((conn) => {
      cachedConnection = conn;
      connectingPromise = null;
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    })
    .catch((error) => {
      connectingPromise = null;
      if (error.message.includes('ECONNREFUSED')) {
        console.error('❌ MongoDB Connection Error: Could not reach the database server.');
        console.error('💡 TIP: Check if your current IP is whitelisted in MongoDB Atlas or if a VPN/Firewall is blocking the connection.');
      } else {
        console.error('❌ MongoDB Connection Error:', error.message);
      }
      throw error;
    });

  return connectingPromise;
};

module.exports = connectDB;
