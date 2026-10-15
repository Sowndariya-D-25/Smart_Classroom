import mongoose from 'mongoose'

// Tracks connection state so the /health route can report DB status
// without importing mongoose directly in the controller.
let isConnected = false

export const connectDB = async () => {
  const uri = process.env.MONGO_URI

  if (!uri) {
    console.error('MONGO_URI is not set. Add it to server/.env (see .env.example).')
    return
  }

  try {
    mongoose.connection.on('connected', () => {
      isConnected = true
      console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`)
    })

    mongoose.connection.on('disconnected', () => {
      isConnected = false
      console.warn('MongoDB disconnected')
    })

    mongoose.connection.on('error', (err) => {
      isConnected = false
      console.error('MongoDB connection error:', err.message)
    })

    // Fail fast if MongoDB isn't reachable instead of hanging for the
    // driver's default 30s — the server should still come up so the
    // frontend can show a clear "database not connected" state.
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
  } catch (err) {
    isConnected = false
    console.error('Failed to connect to MongoDB:', err.message)
    console.error('The server will keep running so the frontend can still be demoed, but any DB-backed route will fail until MONGO_URI is reachable.')
  }
}

export const getDbStatus = () =>
  mongoose.connection.readyState === 1 || isConnected ? 'connected' : 'disconnected'

export default connectDB
