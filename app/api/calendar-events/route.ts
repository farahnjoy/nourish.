import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { google } from 'googleapis'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get the user's Google OAuth tokens from Supabase
    const { data: tokenData, error: tokenError } = await supabase
      .from('user_oauth_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .single()

    if (tokenError || !tokenData) {
      // User hasn't connected Google Calendar yet
      return NextResponse.json({ 
        error: "Google Calendar not connected",
        needsAuth: true 
      }, { status: 403 })
    }

    // Check if token is expired
    const now = Math.floor(Date.now() / 1000)
    let accessToken = tokenData.access_token

    if (tokenData.expires_at && tokenData.expires_at < now) {
      // Refresh the token
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      )

      oauth2Client.setCredentials({
        refresh_token: tokenData.refresh_token
      })

      const { credentials } = await oauth2Client.refreshAccessToken()
      accessToken = credentials.access_token!

      // Update the token in database
      await supabase
        .from('user_oauth_tokens')
        .update({
          access_token: accessToken,
          expires_at: credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : null
        })
        .eq('user_id', user.id)
        .eq('provider', 'google')
    }

    // Initialize Google Calendar API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    oauth2Client.setCredentials({
      access_token: accessToken
    })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    // Get events from the next 30 days
    const timeMin = new Date()
    const timeMax = new Date()
    timeMax.setDate(timeMax.getDate() + 30)

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50
    })

    const events = response.data.items?.map(event => {
      // Analyze event for stress level based on keywords
      const title = event.summary || 'Untitled Event'
      const description = event.description || ''
      const combined = `${title} ${description}`.toLowerCase()

      let stressLevel: 'low' | 'medium' | 'high' = 'medium'
      let type = 'other'

      // Determine stress level based on keywords
      if (
        combined.includes('exam') || 
        combined.includes('test') || 
        combined.includes('interview') ||
        combined.includes('presentation') ||
        combined.includes('deadline')
      ) {
        stressLevel = 'high'
      } else if (
        combined.includes('workout') || 
        combined.includes('gym') || 
        combined.includes('yoga') ||
        combined.includes('meditation') ||
        combined.includes('break')
      ) {
        stressLevel = 'low'
      }

      // Determine event type
      if (combined.includes('exam') || combined.includes('test')) {
        type = 'exam'
      } else if (combined.includes('presentation')) {
        type = 'presentation'
      } else if (combined.includes('meeting')) {
        type = 'meeting'
      } else if (combined.includes('workout') || combined.includes('gym')) {
        type = 'workout'
      } else if (combined.includes('class') || combined.includes('lecture')) {
        type = 'class'
      }

      return {
        id: event.id,
        title: title,
        date: event.start?.dateTime || event.start?.date || new Date().toISOString(),
        type: type,
        stressLevel: stressLevel,
        description: event.description,
        location: event.location
      }
    }) || []

    return NextResponse.json({ events })

  } catch (error: any) {
    console.error("Calendar events error:", error)
    
    // Handle specific Google API errors
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      return NextResponse.json({ 
        error: "Google Calendar authentication expired. Please reconnect.",
        needsAuth: true 
      }, { status: 401 })
    }

    return NextResponse.json({ 
      error: "Failed to fetch calendar events",
      events: [] 
    }, { status: 500 })
  }
}
