import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/database"

export async function POST(request: Request) {
  try {
    // Log that we've started the request
    console.log("Register test route called")
    
    // Parse request body
    let body;
    try {
      body = await request.json();
      console.log("Request body parsed:", { ...body, password: "[REDACTED]" })
    } catch (parseError) {
      console.error("Body parsing error:", parseError)
      return NextResponse.json(
        { message: "Invalid request body - JSON parsing failed" },
        { status: 400 }
      );
    }

    const { name, email, password } = body;

    // Validate required fields
    if (!name || !email || !password) {
      console.error("Missing required fields")
      return NextResponse.json(
        { message: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    // Log that we're checking for existing user
    console.log(`Checking if user exists with email: ${email}`)
    
    // Check if user already exists
    try {
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email },
            { gmailEmail: email }
          ]
        }
      });

      if (existingUser) {
        console.log(`User already exists with email: ${email}`)
        return NextResponse.json(
          { message: "User already exists with this email" },
          { status: 409 }
        );
      }
      
      console.log("No existing user found with this email")
    } catch (findError: any) {
      console.error("Error checking existing user:", findError);
      return NextResponse.json(
        { message: "Database error checking user: " + findError.message },
        { status: 500 }
      );
    }

    console.log("Hashing password...")
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log("Creating user...")
    // Create user - try with explicit fields to avoid null/undefined issues
    try {
      // Using explicit fields to avoid any issues with null or undefined
      const userData = {
        name: name,
        email: email,
        hashedPassword: hashedPassword,
        // Explicit setting of optional fields as undefined
        gmailEmail: undefined,
        gmailPassword: undefined
      };
      
      console.log("User data prepared:", {
        ...userData, 
        hashedPassword: "[REDACTED]", 
        gmailPassword: "[REDACTED]"
      });
      
      const user = await prisma.user.create({ 
        data: userData
      });

      console.log("User created successfully:", user.id)
      
      // Return success response
      return NextResponse.json(
        { 
          message: "Registration successful! You can now log in.",
          userId: user.id
        },
        { status: 201 }
      );
    } catch (createError: any) {
      console.error("User creation error:", createError);
      
      // Check for specific database errors
      const errorMessage = createError.message || "";
      
      if (errorMessage.includes("unique constraint") || errorMessage.includes("Unique constraint")) {
        return NextResponse.json(
          { message: "An account with this email already exists" },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { 
          message: "Failed to create user", 
          error: createError.message 
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { message: "Server error processing registration", error: error.message },
      { status: 500 }
    );
  }
} 