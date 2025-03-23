import { NextResponse } from "next/server"
import { prisma, testConnection, checkSchema } from "@/lib/database"

export async function GET() {
  try {
    // Test database connection
    const connection = await testConnection()
    
    // If connection fails, return early with error
    if (!connection.success) {
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        connection,
        schema: { success: false, message: "Schema not checked due to connection failure" },
        healthy: false
      })
    }
    
    // Check if schema exists
    const schema = await checkSchema()
    
    // If schema is healthy, get some table counts
    let tables = null
    if (schema.success) {
      try {
        const [userCount, sessionCount, verificationTokenCount] = await Promise.all([
          prisma.user.count(),
          prisma.session.count(),
          prisma.verificationToken.count()
        ])
        
        tables = {
          userCount,
          sessionCount,
          verificationTokenCount
        }
      } catch (error: any) {
        console.error("Error counting tables:", error)
      }
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      connection,
      schema,
      tables,
      healthy: connection.success && schema.success,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        databaseUrl: process.env.DATABASE_URL ? 
          process.env.DATABASE_URL.replace(/:[^:]*@/, ':***@') : // Mask password in the URL
          'Not configured'
      }
    })
  } catch (error: any) {
    console.error("Database status check failed:", error)
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      connection: { success: false, message: "Status check failed", error: error.message },
      healthy: false
    }, { status: 500 })
  }
} 