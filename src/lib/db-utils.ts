import { prisma } from './database'

/**
 * Validates a database connection by performing a simple query
 * @returns Object with success status and message
 */
export async function validateDbConnection() {
  try {
    const result = await prisma.$queryRaw`SELECT 1 as result`
    return { success: true, message: 'Database connection successful' }
  } catch (error: any) {
    console.error('Database connection validation failed:', error)
    return { 
      success: false, 
      message: 'Database connection failed', 
      error: error.message || 'Unknown error'
    }
  }
}

/**
 * Verifies that required database tables exist
 * @returns Object with information about missing tables if any
 */
export async function verifyDatabaseSchema() {
  try {
    // Get list of tables that should exist based on our schema
    const requiredTables = ['User', 'Account', 'Session', 'VerificationToken', 'Course', 'Enrollment', 'CourseProgress']
    
    // For PostgreSQL, query the information_schema to check table existence
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name = ANY($1)
    `
    
    const foundTables = await prisma.$queryRawUnsafe(query, requiredTables)
    const foundTableNames = (foundTables as any[]).map(t => t.table_name)
    
    const missingTables = requiredTables.filter(table => !foundTableNames.includes(table))
    
    return {
      success: missingTables.length === 0,
      missingTables,
      allTables: foundTableNames,
      message: missingTables.length === 0 
        ? 'All required database tables exist' 
        : `Missing tables: ${missingTables.join(', ')}`
    }
  } catch (error: any) {
    console.error('Schema verification failed:', error)
    return {
      success: false,
      message: 'Error verifying database schema',
      error: error.message || 'Unknown error'
    }
  }
}

/**
 * Returns user-friendly instructions for resolving common database issues
 */
export function getDatabaseTroubleshootingSteps() {
  return [
    "1. Verify PostgreSQL is running: Check that your PostgreSQL server is active and accessible.",
    "2. Check database credentials: Ensure your DATABASE_URL in .env is correct.",
    "3. Run schema sync: Execute 'npx prisma db push' to create missing tables.",
    "4. Reset database (development only): Run 'node prisma/database-reset.js' to reset and reinitialize the database.",
    "5. Check PostgreSQL logs: Look for error messages that might indicate connection or permission issues."
  ]
} 