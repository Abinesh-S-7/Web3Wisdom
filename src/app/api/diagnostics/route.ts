import { NextResponse } from "next/server"
import { prisma } from "@/lib/database"
import { validateDbConnection, verifyDatabaseSchema, getDatabaseTroubleshootingSteps } from "@/lib/db-utils"

export async function GET() {
  // Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { message: "Diagnostics not available in production" },
      { status: 403 }
    )
  }

  try {
    // Basic environment info
    const envInfo = {
      nodeEnv: process.env.NODE_ENV,
      nextAuthUrl: process.env.NEXTAUTH_URL,
      databaseUrl: process.env.DATABASE_URL 
        ? `${process.env.DATABASE_URL.split('://')[0]}://${process.env.DATABASE_URL.split('@')[1]}` // Hide credentials
        : 'Not configured'
    }

    // Check database connection
    const connectionResult = await validateDbConnection()
    
    // Additional checks only if connection was successful
    let schemaResult = { success: false, message: 'Schema check skipped due to connection failure' }
    let usersResult = { success: false, count: 0, message: 'User count check skipped' }
    
    if (connectionResult.success) {
      // Verify schema
      schemaResult = await verifyDatabaseSchema()
      
      // Check if users exist
      try {
        const userCount = await prisma.user.count()
        usersResult = {
          success: true,
          count: userCount,
          message: userCount > 0 
            ? `Found ${userCount} users in database` 
            : 'No users found in database'
        }
      } catch (error: any) {
        usersResult = {
          success: false,
          count: 0,
          message: `Error counting users: ${error.message}`
        }
      }
    }

    // Generate troubleshooting steps if there are issues
    const hasIssues = !connectionResult.success || !schemaResult.success
    const troubleshootingSteps = hasIssues ? getDatabaseTroubleshootingSteps() : []

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: envInfo,
      database: {
        connection: connectionResult,
        schema: schemaResult,
        users: usersResult
      },
      status: hasIssues ? 'issues_detected' : 'healthy',
      troubleshootingSteps: hasIssues ? troubleshootingSteps : []
    })
  } catch (error: any) {
    console.error('Diagnostics error:', error)
    return NextResponse.json({
      message: "Error running diagnostics",
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 