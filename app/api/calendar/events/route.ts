import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { google } from "googleapis"

const FOOD_SUGGESTIONS = {
  high: [
    { name: "Blueberries", reason: "Rich in antioxidants, supports brain health and reduces stress" },
    { name: "Dark Chocolate", reason: "Contains flavonoids that improve focus and mood" },
    { name: "Walnuts", reason: "High in omega-3s for cognitive function" },
    { name: "Green Tea", reason: "L-theanine promotes calm alertness" },
    { name: "Salmon", reason: "Omega-3 fatty acids reduce anxiety and improve brain function" },
    { name: "Avocado", reason: "Healthy fats support brain health and concentration" },
  ],
  medium: [
    { name: "Bananas", reason: "Natural energy boost with potassium" },
    { name: "Oatmeal", reason: "Sustained energy release, prevents blood sugar crashes" },
    { name: "Greek Yogurt", reason: "Protein and probiotics support gut-brain connection" },
    { name: "Almonds", reason: "Vitamin E protects brain cells" },
  ],
  low: [
    { name: "Berries", reason: "Antioxidants support overall wellness" },
    { name: "Leafy Greens", reason: "Nutrients support general health" },
    { name: "Whole Grains", reason: "Steady energy throughout the day" },
  ],
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    console.log("[v0] Calendar events API called")

    // Get the authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.log("[v0] User not authenticated:", userError)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] User authenticated:", user.id)

    // Get the user's Google OAuth tokens from Supabase
    const { data: tokenData, error: tokenError } = await supabase
      .from("user_oauth_tokens")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .single()

    console.log("[v0] Token data:", {
      hasTokenData: !!tokenData,
      tokenError: tokenError?.message,
      hasAccessToken: !!tokenData?.access_token,
    })

    if (tokenError || !tokenData) {
      console.log("[v0] No Google Calendar connection found")
      // User hasn't connected Google Calendar yet
      return NextResponse.json(
        {
          error: "Google Calendar not connected",
          needsAuth: true,
        },
        { status: 403 },
      )
    }

    // Check if token is expired
    const now = Math.floor(Date.now() / 1000)
    let accessToken = tokenData.access_token

    console.log("[v0] Token expiry check:", {
      expiresAt: tokenData.expires_at,
      now,
      isExpired: tokenData.expires_at ? tokenData.expires_at < now : false,
    })

    if (tokenData.expires_at && tokenData.expires_at < now) {
      console.log("[v0] Token expired, refreshing...")

      if (!tokenData.refresh_token) {
        console.error("[v0] No refresh token available")
        return NextResponse.json(
          {
            error: "Google Calendar authentication expired. Please reconnect.",
            needsAuth: true,
          },
          { status: 401 },
        )
      }

      // Refresh the token
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI,
      )

      oauth2Client.setCredentials({
        refresh_token: tokenData.refresh_token,
      })

      try {
        const { credentials } = await oauth2Client.refreshAccessToken()
        accessToken = credentials.access_token!

        console.log("[v0] Token refreshed successfully")

        // Update the token in database
        await supabase
          .from("user_oauth_tokens")
          .update({
            access_token: accessToken,
            expires_at: credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id)
          .eq("provider", "google")
      } catch (refreshError: any) {
        console.error("[v0] Token refresh failed:", refreshError)
        return NextResponse.json(
          {
            error: "Google Calendar authentication expired. Please reconnect.",
            needsAuth: true,
          },
          { status: 401 },
        )
      }
    }

    // Initialize Google Calendar API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    )

    oauth2Client.setCredentials({
      access_token: accessToken,
    })

    const calendar = google.calendar({ version: "v3", auth: oauth2Client })

    console.log("[v0] Fetching calendar events...")

    // Get events from the next 30 days
    const timeMin = new Date()
    const timeMax = new Date()
    timeMax.setDate(timeMax.getDate() + 30)

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 50,
    })

    console.log("[v0] Calendar events fetched:", response.data.items?.length || 0)

    const events =
      response.data.items?.map((event) => {
        // Analyze event for stress level based on keywords
        const title = event.summary || "Untitled Event"
        const description = event.description || ""
        const combined = `${title} ${description}`.toLowerCase()

        let stressLevel: "low" | "medium" | "high" = "medium"
        let type = "other"

        // Determine stress level based on keywords
        if (
          combined.includes("exam") ||
          combined.includes("test") ||
          combined.includes("interview") ||
          combined.includes("presentation") ||
          combined.includes("deadline") ||
          (combined.includes("meeting") && combined.includes("important"))
        ) {
          stressLevel = "high"
        } else if (
          combined.includes("workout") ||
          combined.includes("gym") ||
          combined.includes("yoga") ||
          combined.includes("meditation") ||
          combined.includes("break") ||
          combined.includes("relax")
        ) {
          stressLevel = "low"
        }

        // Determine event type
        if (combined.includes("exam") || combined.includes("test")) {
          type = "exam"
        } else if (combined.includes("presentation")) {
          type = "presentation"
        } else if (combined.includes("meeting")) {
          type = "meeting"
        } else if (combined.includes("workout") || combined.includes("gym")) {
          type = "workout"
        } else if (combined.includes("class") || combined.includes("lecture")) {
          type = "class"
        }

        // Get food suggestions based on stress level
        const suggestions = FOOD_SUGGESTIONS[stressLevel]

        return {
          id: event.id,
          title: title,
          date: event.start?.dateTime || event.start?.date || new Date().toISOString(),
          type: type,
          stressLevel: stressLevel,
          description: event.description,
          location: event.location,
          foodSuggestions: suggestions, // Added food suggestions
        }
      }) || []

    return NextResponse.json({ events })
  } catch (error: any) {
    console.error("[v0] Calendar events error:", error)

    // Handle specific Google API errors
    if (error.code === 401 || error.message?.includes("invalid_grant")) {
      return NextResponse.json(
        {
          error: "Google Calendar authentication expired. Please reconnect.",
          needsAuth: true,
        },
        { status: 401 },
      )
    }

    return NextResponse.json(
      {
        error: "Failed to fetch calendar events",
        details: error.message,
        events: [],
      },
      { status: 500 },
    )
  }
}
