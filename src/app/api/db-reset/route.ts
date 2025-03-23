import { NextResponse } from "next/server"
import { prisma } from "@/lib/database"
import { exec as execCallback } from "child_process"

// Simple promise wrapper for exec
function exec(command: string): Promise<{stdout: string, stderr: string}> {
  return new Promise((resolve, reject) => {
    execCallback(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

export async function POST(request: Request) {
  // Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { message: "This endpoint is only available in development mode" },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { confirm, command } = body
    
    if (confirm !== 'CONFIRM_RESET_DB') {
      return NextResponse.json(
        { message: "You must confirm the reset with CONFIRM_RESET_DB" },
        { status: 400 }
      )
    }
    
    if (!command || !['migrate', 'push', 'reset'].includes(command)) {
      return NextResponse.json(
        { message: "Invalid command. Must be one of: migrate, push, reset" },
        { status: 400 }
      )
    }
    
    // Disconnect Prisma to release the database connection
    await prisma.$disconnect()
    
    let result = null
    
    switch (command) {
      case 'migrate':
        // Run migrations
        try {
          result = await exec('npx prisma migrate dev --name=fix_schema')
        } catch (error: any) {
          return NextResponse.json({
            message: "Migration failed",
            error: error.message
          }, { status: 500 })
        }
        break
        
      case 'push':
        // Push schema changes
        try {
          result = await exec('npx prisma db push')
        } catch (error: any) {
          return NextResponse.json({
            message: "Schema push failed",
            error: error.message
          }, { status: 500 })
        }
        break
        
      case 'reset':
        // Reset database (delete all data)
        try {
          result = await exec('npx prisma migrate reset --force')
        } catch (error: any) {
          // Try alternative approach
          try {
            result = await exec('npx prisma db push --force-reset')
          } catch (resetError: any) {
            return NextResponse.json({
              message: "Database reset failed",
              error: resetError.message
            }, { status: 500 })
          }
        }
        
        // Create a test user after reset
        try {
          // Reconnect to the database
          await prisma.$connect()
          
          // Create test user
          const testUser = await prisma.user.create({
            data: {
              name: 'Test User',
              email: 'test@example.com',
              hashedPassword: '$2a$12$K8oUOGrXQi61GbcY2jkWWeDnGrITlKX8wqwXfsw.XpcLjXGzokpTq' // "password123"
            }
          })
          
          result = { 
            ...result, 
            testUser: { 
              id: testUser.id, 
              email: testUser.email 
            } 
          }
        } catch (userCreateError: any) {
          return NextResponse.json({
            message: "Database reset succeeded but test user creation failed",
            error: userCreateError.message,
            result
          }, { status: 500 })
        }
        break
    }
    
    return NextResponse.json({
      message: `Database ${command} completed successfully`,
      command,
      result
    })
  } catch (error: any) {
    return NextResponse.json({
      message: "Error processing database reset",
      error: error.message
    }, { status: 500 })
  }
} 