import { ApolloServer, HeaderMap } from "@apollo/server";
import { typeDefs } from "../../../lib/graphql/schema";
import { resolvers } from "../../../lib/graphql/resolvers";
import { NextRequest, NextResponse } from "next/server";

const server = new ApolloServer({ typeDefs, resolvers });

let started = false;
async function ensureStarted() {
  if (!started) {
    await server.start();
    started = true;
  }
}

export async function POST(req: NextRequest) {
  await ensureStarted();

  const headers = new HeaderMap();
  req.headers.forEach((value, key) => headers.set(key, value));

  const body = await req.text();

  const httpResponse = await server.executeHTTPGraphQLRequest({
    httpGraphQLRequest: {
      method: req.method,
      headers,
      search: new URL(req.url).search,
      body: JSON.parse(body || "{}"),
    },
    context: async () => ({}),
  });

  const responseHeaders: Record<string, string> = {};
  httpResponse.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  if (httpResponse.body.kind === "complete") {
    return new NextResponse(httpResponse.body.string, {
      status: httpResponse.status ?? 200,
      headers: responseHeaders,
    });
  }

  return new NextResponse("Streaming not supported", { status: 501 });
}

export async function GET() {
  return NextResponse.json({ message: "Job Tracker GraphQL API — use POST" });
}
