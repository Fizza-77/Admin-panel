// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin") || "";

  // Allowed origins (update as needed)
  const allowedOrigins = [
    "https://skyenadmin.com",
    "https://www.skyenadmin.com",
    "http://localhost:5173", // dev
  ];

  const res = NextResponse.next();

  if (allowedOrigins.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
    res.headers.set(
      "Access-Control-Allow-Headers",
      req.headers.get("access-control-request-headers") || "*"
    );
  }

  // Respond to preflight requests
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: res.headers });
  }

  return res;
}

// Apply only to API routes
export const config = {
  matcher: "/api/:path*",
};