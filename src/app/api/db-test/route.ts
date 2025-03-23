import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

// Create a dedicated Prisma client for testing
const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
})

export async function GET() {
  try {
    // Test simple query
    try {
      const result = await prisma.$queryRaw`SELECT 1 as result`
      console.log('Database connection test successful', result)
      
      // Test user table access
      try {
        const userCount = await prisma.user.count()
        return NextResponse.json({
          success: true,
          message: "Database connection and schema are working correctly",
          connection: { status: "ok" },
          userCount
        })
      } catch (userError: any) {
        console.error("Error accessing User table:", userError)
        return NextResponse.json({
          success: false,
          message: "Database connected but User table access failed",
          error: userError.message,
          connection: { status: "ok" }
        }, { status: 500 })
      }
    } catch (connectionError: any) {
      console.error("Database connection error:", connectionError)
      // Try to determine if it's a connection issue or credential issue
      const errorMsg = connectionError.message || ""
      
      let errorType = "unknown"
      let suggestion = "Check the database connection and credentials"
      
      if (errorMsg.includes("connect")) {
        errorType = "connection"
        suggestion = "Make sure PostgreSQL is running and accessible"
      } else if (errorMsg.includes("authentication") || errorMsg.includes("password")) {
        errorType = "authentication"
        suggestion = "Check the database username and password in .env"
      } else if (errorMsg.includes("database") && errorMsg.includes("exist")) {
        errorType = "missing_database"
        suggestion = "Create the database specified in DATABASE_URL"
      }
      
      return NextResponse.json({
        success: false,
        message: "Database connection failed",
        error: errorMsg,
        errorType,
        suggestion,
        connection: { status: "failed" }
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error("Unexpected error:", error)
    return NextResponse.json({
      success: false,
      message: "An unexpected error occurred",
      error: error.message
    }, { status: 500 })
  } finally {
    // Always disconnect to avoid resource leaks
    await prisma.$disconnect()
  }
} 