"use client"

import { useEffect, useState, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Calendar as CalendarIcon, AlertCircle } from "lucide-react"
import { useSearchParams } from "next/navigation"

// --- Interfaces for Type Safety ---
interface CalendarEvent {
  id: string
  title: string
  date: string
  type: string
  stressLevel: "low" | "medium" | "high"
  description?: string
  location?: string
}

// --- Calendar Content Component (Client Logic) ---
function CalendarContent() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check if user just connected or if there was an error after OAuth
    if (searchParams.get('connected') === 'true') {
      setIsConnected(true)
      fetchEvents()
    } else if (searchParams.get('error')) {
      setError('Failed to connect Google Calendar. Please try again.')
      setIsConnected(false)
      setIsLoading(false)
    } else {
      // On initial load or navigation, try to fetch events
      fetchEvents()
    }
  }, [searchParams])

  const fetchEvents = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/calendar/events')
      const data = await response.json()

      // Handle server-side responses indicating authentication is needed/expired
      if ((response.status === 403 || response.status === 401) && data.needsAuth) {
        setIsConnected(false)
        setError(response.status === 401 ? 'Your Google Calendar connection expired. Please reconnect.' : null)
        setIsLoading(false)
        return
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch events')
      }

      setEvents(data.events)
      setIsConnected(true)
    } catch (err: any) {
      console.error('Calendar fetch error:', err)
      // Only set general error if we were supposed to be connected
      if (isConnected) {
          setError(err.message || 'An unknown error occurred while fetching events.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnectGoogle = () => {
    // Redirects user to your Next.js API route that starts the OAuth flow
    window.location.href = '/api/auth/google'
  }

  const getStressColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-red-500/10 text-red-500 border-red-500/20'
      case 'medium': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      case 'low': return 'bg-green-500/10 text-green-500 border-green-500/20'
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading calendar...</p>
        </div>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <CalendarIcon className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h2 className="text-2xl font-semibold mb-2">Connect Your Calendar</h2>
          <p className="text-muted-foreground mb-6">
            Connect your Google Calendar to track stress levels and get personalized nutrition recommendations based on your schedule.
          </p>
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-500 text-left">{error}</p>
            </div>
          )}
          <Button onClick={handleConnectGoogle} size="lg" className="w-full">
            <CalendarIcon className="w-5 h-5 mr-2" />
            Connect Google Calendar
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Your Calendar</h1>
          <Button onClick={fetchEvents} variant="outline" size="sm">
            Refresh
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {events.length === 0 ? (
          <Card className="p-8 text-center">
            <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No upcoming events found in your calendar.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <Card key={event.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">{event.title}</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {new Date(event.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    {event.location && (
                      <p className="text-sm text-muted-foreground mb-2">📍 {event.location}</p>
                    )}
                    {event.description && (
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full border ${getStressColor(event.stressLevel)}`}>
                      {event.stressLevel} stress
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {event.type}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Page Wrapper (Handles Suspense for Client Components) ---
export default function CalendarPage() {
  return (
    // Suspense is necessary because useSearchParams can only be called 
    // from a client component and relies on the browser's URL.
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <CalendarContent />
    </Suspense>
  )
}
