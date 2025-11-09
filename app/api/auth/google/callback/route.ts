import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { google } from "googleapis"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state") // This is the user_id
  const error = searchParams.get("error")

  console.log("[v0] Google callback received", { hasCode: !!code, hasState: !!state, error })

  if (error) {
    console.error("[v0] OAuth error from Google:", error)
    return NextResponse.redirect(new URL("/calendar?error=access_denied", request.url))
  }

  if (!code || !state) {
    console.error("[v0] Missing code or state in callback")
    return NextResponse.redirect(new URL("/calendar?error=missing_params", request.url))
  }

  try {
    const supabase = await createClient()

    // Verify the user making the request matches the state
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user || user.id !== state) {
      console.error("[v0] User mismatch or not authenticated", { userError, userId: user?.id, state })
      return NextResponse.redirect(new URL("/auth/login", request.url))
    }

    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    )

    // Exchange code for tokens
    console.log("[v0] Exchanging code for tokens")
    const { tokens } = await oauth2Client.getToken(code)

    console.log("[v0] Received tokens", {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date,
    })

    if (!tokens.access_token) {
      console.error("[v0] No access token received")
      return NextResponse.redirect(new URL("/calendar?error=no_token", request.url))
    }

    // Store tokens in database
    const { error: dbError } = await supabase.from("user_oauth_tokens").upsert(
      {
        user_id: user.id,
        provider: "google",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,provider",
      },
    )

    if (dbError) {
      console.error("[v0] Database error storing tokens:", dbError)
      return NextResponse.redirect(new URL("/calendar?error=db_error", request.url))
    }

    console.log("[v0] Tokens stored successfully")

    // Redirect back to calendar with success
    return NextResponse.redirect(new URL("/calendar?connected=true", request.url))
  } catch (error: any) {
    console.error("[v0] Google callback error:", error)
    return NextResponse.redirect(new URL("/calendar?error=callback_failed", request.url))
  }
}
