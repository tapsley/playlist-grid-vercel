import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "../../../../lib/prisma";
import bcrypt from "bcrypt";

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;
        // hide password
        return { id: user.id, email: user.email };
      },
    }),
  ],
  session: { strategy: "jwt" as const },
  callbacks: {
    async signIn({ user, account }: any) {
      // Only run for Google provider
      if (account?.provider === 'google') {
        const existing = await prisma.user.findUnique({ where: { email: user.email } });
        if (!existing) {
          await prisma.user.create({
            data: {
              email: user.email,
              password: '', // Google users have no password
            },
          });
        }
      }
      return true;
    },
    async jwt({ token, user }: any) {
      if (user) {
        // Always fetch user from DB to get id
        const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
        if (dbUser) token.id = dbUser.id;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
};

export const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
