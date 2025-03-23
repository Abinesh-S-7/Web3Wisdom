import { NextResponse } from "next/server"
import { prisma, testConnection } from "@/lib/database"

export async function GET() {
  try {
    // Test connection
    const connectionResult = await testConnection()
    
    if (!connectionResult.success) {
      return NextResponse.json(connectionResult, { status: 500 })
    }
    
    // Check if we can access the User table
    try {
      const userCount = await prisma.user.count()
      return NextResponse.json({
        success: true,
        message: 'Database connection and schema verified successfully',
        userCount,
        connectionTest: connectionResult
      })
    } catch (schemaError: any) {
      console.error('Schema test failed:', schemaError)
      return NextResponse.json({
        success: false,
        message: 'Database connected but schema test failed',
        error: schemaError.message,
        connectionTest: connectionResult
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('Database test failed:', error)
    return NextResponse.json({
      success: false,
      message: 'Database test failed',
      error: error.message
    }, { status: 500 })
  }
} 