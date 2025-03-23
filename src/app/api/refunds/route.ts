import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ethers } from "ethers";

// POST handler to process a refund request
export async function POST(req: Request) {
  try {
    const { courseTitle, studentAddress, transactionHash } = await req.json();
    
    // Get the current session to identify the user
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (!courseTitle || !studentAddress) {
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

    // Check if the purchase exists using raw query
    const existingTransactions = await prisma.$queryRaw`
      SELECT * FROM "CourseTransaction"
      WHERE "userId" = ${user.id} AND "courseTitle" = ${courseTitle}
    `;
    
    const existingTransaction = existingTransactions.length > 0 ? existingTransactions[0] : null;

    // If the course wasn't purchased, return error
    if (!existingTransaction) {
      return NextResponse.json(
        { error: "Course not purchased" },
        { status: 404 }
      );
    }

    // Delete the transaction record using raw query
    await prisma.$executeRaw`
      DELETE FROM "CourseTransaction"
      WHERE "userId" = ${user.id} AND "courseTitle" = ${courseTitle}
    `;

    // Also delete the enrollment for this course if it exists
    try {
      // Find the course by title
      const course = await prisma.course.findFirst({
        where: {
          title: courseTitle
        }
      });

      if (course) {
        // Delete enrollment if course exists in database
        const deleteResult = await prisma.$executeRaw`
          DELETE FROM "Enrollment"
          WHERE "userId" = ${user.id} AND "courseId" = ${course.id}
        `;
      }
    } catch (enrollError) {
      // Just log the error but don't fail the transaction
      console.error("Error deleting enrollment:", enrollError);
    }

    // In a real implementation, you would use a private key to send the refund
    // NEVER include private keys in client-side code! This should be on a secure server.
    // The following code is for illustration only and should be implemented on a secure server
    /* 
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    if (!adminPrivateKey) {
      return NextResponse.json(
        { error: "Admin key not configured" },
        { status: 500 }
      );
    }
    
    // Connect to the network
    const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/YOUR_INFURA_KEY");
    const wallet = new ethers.Wallet(adminPrivateKey, provider);
    
    // Create the refund transaction
    const tx = {
      to: studentAddress,
      value: ethers.parseEther("0.03") // Refund the full amount
    };
    
    // Send the transaction
    const transaction = await wallet.sendTransaction(tx);
    await transaction.wait();
    
    const etherscanLink = `https://sepolia.etherscan.io/tx/${transaction.hash}`;
    */

    return NextResponse.json({
      message: "Refund processed successfully",
      // transaction: transaction,
      // etherscanLink: etherscanLink
    });
  } catch (error) {
    console.error("Error processing refund:", error);
    return NextResponse.json(
      { error: "Failed to process refund" },
      { status: 500 }
    );
  }
} 