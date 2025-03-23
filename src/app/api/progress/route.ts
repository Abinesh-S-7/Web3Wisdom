import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { headers } from "next/headers"
import { cookies } from "next/headers"
import { authOptions } from "../auth/[...nextauth]/route"
import { prisma } from "@/lib/database"

interface CourseProgress {
  courseId: string
  course: {
    title: string
  }
  progress: number
  lastWatched: Date
}

export async function GET() {
  try {
    const headersList = headers()
    const cookiesList = cookies()
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    try {
      const progress = await prisma.courseProgress.findMany({
        where: {
          userId: session.user.id
        },
        include: {
          course: {
            select: {
              title: true
            }
          }
        }
      })

      return NextResponse.json(progress)
    } catch (dbError: any) {
      console.error("Database error fetching progress:", dbError)
      return NextResponse.json(
        { error: "Database error fetching progress", details: dbError.message },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("Error in progress API:", error)
    return NextResponse.json(
      { error: "Server error processing request" },
      { status: 500 }
    )
  }
} 