import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/route"
import { prisma } from "@/lib/database"

// API to get game progress stats
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const gameStats = await prisma.gameCompletion.findMany({
      where: {
        userId: session.user.id
      },
      select: {
        gameType: true,
        completions: true
      }
    });

    return NextResponse.json(gameStats);
  } catch (error: any) {
    console.error("Error fetching game stats:", error);
    return NextResponse.json(
      { error: "Error fetching game statistics" },
      { status: 500 }
    );
  }
}

// API to add a game completion
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { gameType } = body;

    if (!gameType || !['sudoku', 'puzzle', 'memory', 'quiz'].includes(gameType)) {
      return NextResponse.json(
        { error: "Invalid game type" },
        { status: 400 }
      );
    }

    // Find existing record or create new one
    const existingRecord = await prisma.gameCompletion.findFirst({
      where: {
        userId: session.user.id,
        gameType
      }
    });

    if (existingRecord) {
      // Update existing record
      const updated = await prisma.gameCompletion.update({
        where: {
          id: existingRecord.id
        },
        data: {
          completions: existingRecord.completions + 1,
          lastCompleted: new Date()
        }
      });
      return NextResponse.json(updated);
    } else {
      // Create new record
      const newRecord = await prisma.gameCompletion.create({
        data: {
          userId: session.user.id,
          gameType,
          completions: 1,
          lastCompleted: new Date()
        }
      });
      return NextResponse.json(newRecord);
    }
  } catch (error: any) {
    console.error("Error recording game completion:", error);
    return NextResponse.json(
      { error: "Error recording game completion" },
      { status: 500 }
    );
  }
} 