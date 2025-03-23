"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

interface CourseProgress {
  id: string
  title: string
  progress: number
  lastWatched: string
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const response = await fetch("/api/progress")
        if (!response.ok) throw new Error("Failed to fetch progress")
        const data = await response.json()
        setCourseProgress(data)
      } catch (error) {
        console.error("Error fetching progress:", error)
      } finally {
        setLoading(false)
      }
    }

    if (session) {
      fetchProgress()
    }
  }, [session])

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {session.user?.name}
            </span>
            <Button variant="outline" onClick={() => router.push("/")}>
              Back to Home
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-8">
          {/* Course Progress Section */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Your Course Progress</h2>
            <div className="grid gap-4">
              {courseProgress.length > 0 ? (
                courseProgress.map((course) => (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-lg border bg-card"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-medium">{course.title}</h3>
                      <span className="text-sm text-muted-foreground">
                        {course.progress}%
                      </span>
                    </div>
                    <Progress value={course.progress} className="h-2" />
                    <p className="text-sm text-muted-foreground mt-2">
                      Last watched: {new Date(course.lastWatched).toLocaleDateString()}
                    </p>
                  </motion.div>
                ))
              ) : (
                <p className="text-muted-foreground">No courses in progress</p>
              )}
            </div>
          </section>

          {/* Recent Activity Section */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
            <div className="grid gap-4">
              {courseProgress.length > 0 ? (
                courseProgress
                  .sort((a, b) => new Date(b.lastWatched).getTime() - new Date(a.lastWatched).getTime())
                  .slice(0, 3)
                  .map((course) => (
                    <motion.div
                      key={course.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-lg border bg-card"
                    >
                      <p className="font-medium">{course.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Watched on {new Date(course.lastWatched).toLocaleDateString()}
                      </p>
                    </motion.div>
                  ))
              ) : (
                <p className="text-muted-foreground">No recent activity</p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
} 