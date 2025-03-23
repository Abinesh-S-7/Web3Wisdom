/**
 * Database Reset Utility Script
 * 
 * This script helps reset and reinitialize the database during development.
 * Run with: node prisma/database-reset.js
 */

const { PrismaClient } = require('@prisma/client');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const prisma = new PrismaClient();

async function resetDatabase() {
  try {
    console.log('🔄 Starting database reset process...');
    
    // Test database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('✅ Database connection successful');
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      console.log('Please make sure your PostgreSQL server is running and DATABASE_URL is correct in .env');
      return;
    }
    
    console.log('⏳ Dropping all tables and recreating schema...');
    
    try {
      // Reset database schema
      await execAsync('npx prisma migrate reset --force');
      console.log('✅ Database schema reset complete');
    } catch (error) {
      console.error('❌ Error resetting schema:', error.message);
      console.log('Attempting alternative reset approach...');
      
      try {
        // Alternative approach if migrations fail
        await execAsync('npx prisma db push --force-reset');
        console.log('✅ Database reset with db push complete');
      } catch (pushError) {
        console.error('❌ Error with db push:', pushError.message);
        return;
      }
    }
    
    // Create a test user
    console.log('⏳ Creating test user...');
    try {
      const testUser = await prisma.user.create({
        data: {
          name: 'Test User',
          email: 'test@example.com',
          hashedPassword: '$2a$12$K8oUOGrXQi61GbcY2jkWWeDnGrITlKX8wqwXfsw.XpcLjXGzokpTq' // "password123"
        }
      });
      console.log('✅ Test user created:', testUser.id);
    } catch (error) {
      console.error('❌ Error creating test user:', error.message);
    }
    
    console.log('🎉 Database reset complete!');
    console.log('Test user credentials:');
    console.log('Email: test@example.com');
    console.log('Password: password123');
  } catch (error) {
    console.error('❌ Unexpected error during database reset:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase(); 