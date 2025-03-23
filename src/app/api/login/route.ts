import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma, testConnection } from "@/lib/database"

export async function POST(request: Request) {
  try {
    console.log("Login API called");
    
    // Test database connection first
    try {
      const dbConnection = await testConnection();
      if (!dbConnection.success) {
        console.error("Login API: Database connection failed:", dbConnection.error);
        return NextResponse.json({
          message: "Database connection error. Please try again later.",
          dbError: dbConnection.error
        }, { status: 503 });
      }
    } catch (connError: any) {
      console.error("Login API: Error testing database connection:", connError);
      return NextResponse.json({
        message: "Unable to connect to the database. Please try again later.",
        error: connError.message
      }, { status: 503 });
    }
    
    // Parse request body
    let body;
    try {
      body = await request.json();
      console.log("Login request received for email:", body.email);
    } catch (parseError) {
      console.error("Login API: JSON parsing error:", parseError);
      return NextResponse.json(
        { message: "Invalid request body - JSON parsing failed" },
        { status: 400 }
      );
    }

    const { email, password } = body;

    // Validate required fields
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { message: "Email is required" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { message: "Password is required" },
        { status: 400 }
      );
    }

    // Find user by email - simplified to match registration
    try {
      const formattedEmail = email.toLowerCase();
      
      console.log(`Looking for user with email: ${formattedEmail}`);
      
      const user = await prisma.user.findFirst({
        where: {
          email: formattedEmail
        }
      });

      // Instead of revealing if a user exists, provide a generic message
      if (!user) {
        console.log(`No user found with email: ${formattedEmail}`);
        return NextResponse.json(
          { message: "Invalid email or password" },
          { status: 401 }
        );
      }
      
      console.log(`User found with id: ${user.id}`);

      // Check if user has a password
      if (!user.hashedPassword) {
        console.log(`No password found for user: ${user.id}`);
        return NextResponse.json(
          { message: "Invalid login method" },
          { status: 401 }
        );
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);
      
      if (!isPasswordValid) {
        console.log(`Invalid password for user: ${user.id}`);
        return NextResponse.json(
          { message: "Invalid email or password" },
          { status: 401 }
        );
      }
      
      console.log(`Login successful for user: ${user.id}`);

      // Return safe user data for session
      const safeUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      };

      return NextResponse.json({
        message: "Login successful",
        user: safeUser
      });
    } catch (dbError: any) {
      console.error("Database error during login:", dbError);
      
      // Determine if it's a connection issue
      const errorMessage = dbError.message || "";
      if (errorMessage.includes("connect") || errorMessage.includes("connection")) {
        return NextResponse.json(
          { message: "Database connection error. Please try again later." },
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        { message: "Error verifying credentials. Please try again." },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { message: "Server error processing login request" },
      { status: 500 }
    );
  }
} 