import { type NextRequest, NextResponse } from "next/server"
import { google } from 'googleapis'
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state') // This is the user ID
    const error = searchParams.get('error')

    if (error || !code || !state) {
      return NextResponse.redirect(new URL('/calendar?error=auth_failed', request.url))
    }

    const supabase = createClient()

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code)
    
    if (!tokens.access_token) {
      throw new Error('No access token received')
    }

    // Store tokens in database
    const { error: dbError } = await supabase
      .from('user_oauth_tokens')
      .upsert({
        user_id: state,
        provider: 'google',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : null,
        scope: tokens.scope,
        updated_at: new Date().toISOString()
      })

    if (dbError) {
      console.error('Error storing tokens:', dbError)
      return NextResponse.redirect(new URL('/calendar?error=storage_failed', request.url))
    }

    // Redirect back to calendar page
    return NextResponse.redirect(new URL('/calendar?connected=true', request.url))

  } catch (error) {
    console.error("Google OAuth callback error:", error)
    return NextResponse.redirect(new URL('/calendar?error=callback_failed', request.url))
  }
}
