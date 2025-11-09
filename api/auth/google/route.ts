import { type NextRequest, NextResponse } from "next/server"
import { google } from 'googleapis'
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    // Generate auth URL with calendar scope
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/userinfo.email'
      ],
      state: user.id, // Pass user ID in state
      prompt: 'consent' // Force consent screen to get refresh token
    })

    return NextResponse.redirect(authUrl)

  } catch (error) {
    console.error("Google OAuth error:", error)
    return NextResponse.redirect(new URL('/calendar?error=auth_failed', request.url))
  }
}
