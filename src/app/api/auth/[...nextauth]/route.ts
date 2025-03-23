import NextAuth, { AuthOptions } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma, testConnection } from "@/lib/database"

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        isGmail: { label: "Is Gmail", type: "boolean" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Please enter your email and password")
        }

        // Test database connection first
        try {
          const dbConnection = await testConnection();
          if (!dbConnection.success) {
            console.error("NextAuth: Database connection failed:", dbConnection.error);
            throw new Error("Database connection error. Please try again later.");
          }
        } catch (connError) {
          console.error("NextAuth: Error testing database connection:", connError);
          throw new Error("Unable to connect to the database. Please try again later.");
        }

        const isGmailLogin = credentials.isGmail === "true"
        const email = credentials.email.toLowerCase()

        try {
          console.log(`NextAuth: Looking for user with email: ${email} (isGmail: ${isGmailLogin})`);
          
          // Find user by email - simplified query compared to registration
          const user = await prisma.user.findFirst({
            where: {
              email: email
            }
          });

          if (!user) {
            console.log(`NextAuth: No user found with email: ${email}`);
            throw new Error("Invalid email or password");
          }
          
          console.log(`NextAuth: User found with id: ${user.id}`);

          // Check if user has a password
          if (!user.hashedPassword) {
            console.log(`NextAuth: No password found for user: ${user.id}`);
            throw new Error("Invalid login method")
          }

          // Compare password with hashed password in database
          const isPasswordValid = await bcrypt.compare(credentials.password, user.hashedPassword);
          
          if (!isPasswordValid) {
            console.log(`NextAuth: Invalid password for user: ${user.id}`);
            throw new Error("Invalid email or password")
          }

          console.log(`NextAuth: Authentication successful for user: ${user.id}`);
          return {
            id: user.id,
            name: user.name,
            email: user.email
          }
        } catch (error) {
          console.error("NextAuth authentication error:", error)
          throw error || new Error("Authentication failed")
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/",
    error: "/"
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        token.name = user.name
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        
        // Ensure the user data is always up-to-date
        try {
          const userData = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              name: true,
              email: true
            }
          })
          
          if (userData) {
            session.user.name = userData.name
            session.user.email = userData.email
          }
        } catch (error) {
          console.error("Error refreshing session user data:", error)
        }
      }
      return session
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV !== "production"
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST } 