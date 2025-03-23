import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET handler to retrieve a user's purchases
export async function GET() {
  try {
    // Get the current session to identify the user
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Find the user by email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: session.user.email },
          { gmailEmail: session.user.email }
        ]
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get all transactions for the user using raw query
    // This is a workaround until Prisma types are generated
    const transactions = await prisma.$queryRaw`
      SELECT * FROM "CourseTransaction"
      WHERE "userId" = ${user.id}
      ORDER BY "purchaseDate" DESC
    `;

    return NextResponse.json({
      purchases: transactions
    });
  } catch (error) {
    console.error("Error retrieving purchases:", error);
    return NextResponse.json(
      { error: "Failed to retrieve purchases" },
      { status: 500 }
    );
  }
}

// POST handler to create a new purchase record
export async function POST(req: Request) {
  try {
    const { courseTitle, walletAddress, transactionHash } = await req.json();
    
    // Get the current session to identify the user
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (!courseTitle || !walletAddress || !transactionHash) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Find the user by email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: session.user.email },
          { gmailEmail: session.user.email }
        ]
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if the purchase already exists using raw query
    const existingTransactions = await prisma.$queryRaw`
      SELECT * FROM "CourseTransaction"
      WHERE "userId" = ${user.id} AND "courseTitle" = ${courseTitle}
    `;
    
    const existingTransaction = existingTransactions.length > 0 ? existingTransactions[0] : null;

    // If the course is already purchased, just return success
    if (existingTransaction) {
      return NextResponse.json({
        message: "Course already purchased",
        transaction: existingTransaction
      });
    }

    // Create a new transaction record using raw query
    const transaction = await prisma.$executeRaw`
      INSERT INTO "CourseTransaction" (
        "id", "userId", "courseTitle", "walletAddress", "transactionHash", 
        "purchaseDate", "price"
      )
      VALUES (
        gen_random_uuid(), ${user.id}, ${courseTitle}, ${walletAddress}, 
        ${transactionHash}, CURRENT_TIMESTAMP, 0.03
      )
      RETURNING *
    `;

    // Also create an enrollment for this course if it exists
    try {
      // Find the course by title
      const course = await prisma.course.findFirst({
        where: {
          title: courseTitle
        }
      });

      if (course) {
        // Create enrollment if course exists in database
        await prisma.enrollment.create({
          data: {
            userId: user.id,
            courseId: course.id
          }
        });
      }
    } catch (enrollError) {
      // Just log the error but don't fail the transaction
      console.error("Error creating enrollment:", enrollError);
    }

    return NextResponse.json({
      message: "Purchase recorded successfully",
      transaction
    });
  } catch (error) {
    console.error("Error recording purchase:", error);
    return NextResponse.json(
      { error: "Failed to record purchase" },
      { status: 500 }
    );
  }
} 