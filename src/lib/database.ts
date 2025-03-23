import { PrismaClient } from '@prisma/client'

declare global {
  var prismaGlobal: PrismaClient | undefined
}

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
export const prisma = globalThis.prismaGlobal || new PrismaClient({
  log: ['query', 'error', 'warn'],
})

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma

// Test database connection
export async function testConnection() {
  try {
    // Test simple query
    const result = await prisma.$queryRaw`SELECT 1 as result`
    console.log('Database connection test successful', result)
    return { success: true, message: 'Database connection successful' }
  } catch (error: any) {
    console.error('Database connection test failed:', error)
    return { 
      success: false, 
      message: 'Database connection failed', 
      error: error.message
    }
  }
}

// Utility function to check if schema exists
export async function checkSchema() {
  try {
    // Try to count users to see if the table exists
    await prisma.user.count()
    return { success: true, message: "Database schema exists" }
  } catch (error: any) {
    console.error("Schema check failed:", error)
    return { 
      success: false, 
      message: "Database schema check failed", 
      error: error.message 
    }
  }
} 