import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import app from './app.js'
import { connectDB, getDbStatus } from './config/db.js'

const PORT = process.env.PORT || 5000

let server

const startServer = async () => {
  try {
    await connectDB()
  } catch (err) {
    console.error('Database connection failed on startup:', err.message)
    if (process.env.NODE_ENV === 'production') {
      process.exit(1)
    }
  }

  server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`)
    console.log(`Database status: ${getDbStatus()}`)
  })

  let isShuttingDown = false

  const gracefulShutdown = async (signal) => {
    if (isShuttingDown) return
    isShuttingDown = true
    console.log(`\nReceived ${signal}. Shutting down gracefully...`)

    if (server) {
      server.close(async () => {
        console.log('HTTP server closed.')
        try {
          if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close(false)
            console.log('MongoDB connection closed.')
          }
          process.exit(0)
        } catch (dbErr) {
          console.error('Error closing MongoDB connection:', dbErr.message)
          process.exit(1)
        }
      })
    } else {
      process.exit(0)
    }

    setTimeout(() => {
      console.error('Graceful shutdown timed out. Forcing exit.')
      process.exit(1)
    }, 10000).unref()
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
}

startServer()

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err?.message || err)
})
