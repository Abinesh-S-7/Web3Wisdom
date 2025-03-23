import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma, testConnection } from "@/lib/database"

// Email validation regex
const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export async function POST(request: Request) {
  try {
    console.log("Starting registration process");
    
    // Check database connection first
    const dbConnection = await testConnection();
    if (!dbConnection.success) {
      console.error("Database connection failed during registration:", dbConnection.error);
      return NextResponse.json({
        message: "Database connection error. Please try again later.",
        dbError: dbConnection.error
      }, { status: 503 });
    }
    
    // Parse the request body
    const body = await request.json();
    console.log("Registration request received", { name: body.name, email: body.email });
    
    // Validate required fields
    if (!body.name) {
      return NextResponse.json({ message: "Name is required" }, { status: 400 });
    }
    
    if (!body.email) {
      return NextResponse.json({ message: "Email is required" }, { status: 400 });
    }
    
    if (!isValidEmail(body.email)) {
      return NextResponse.json({ message: "Invalid email format" }, { status: 400 });
    }
    
    if (!body.password) {
      return NextResponse.json({ message: "Password is required" }, { status: 400 });
    }
    
    if (body.password.length < 6) {
      return NextResponse.json({ message: "Password must be at least 6 characters" }, { status: 400 });
    }
    
    // Check if email already exists
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: body.email },
          { email: body.email.toLowerCase() },
        ]
      }
    });
    
    if (user) {
      console.log("Registration failed: Email already exists");
      return NextResponse.json({ message: "Email already in use" }, { status: 400 });
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(body.password, 12);
    
    // Create the user
    const newUser = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase(),
        hashedPassword
      }
    });
    
    console.log("User created successfully", { userId: newUser.id });
    
    // Return the user without the password
    return NextResponse.json({
      message: "User created successfully",
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email
      }
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    
    // Handle specific database errors
    if (error.code === 'P2002') {
      return NextResponse.json({ 
        message: "Email already exists. Please use a different email." 
      }, { status: 400 });
    }
    
    if (error.code?.startsWith('P')) {
      return NextResponse.json({ 
        message: "Database error. Please try again later.",
        dbError: error.message
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      message: "An unexpected error occurred during registration. Please try again." 
    }, { status: 500 });
  }
} 