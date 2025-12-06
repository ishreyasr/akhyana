import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    // Allow all requests to pass through
    return NextResponse.next()
}

export const config = {
    // Only run middleware on specific paths to avoid edge runtime issues
    matcher: [
        '/connected-vehicle/:path*',
        '/api/:path*',
    ],
}
