"use client"

import { useEffect, useState, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CalendarIcon, AlertCircle, Sparkles, Menu } from "lucide-react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"

// --- Interfaces for Type Safety ---
interface FoodSuggestion {
  name: string
  reason: string
}

interface CalendarEvent {
  id: string
  title: string
  date: string
  type: string
  stressLevel: "low" | "medium" | "high"
  description?: string
  location?: string
  foodSuggestions?: FoodSuggestion[]
}

// --- Calendar Content Component (Client Logic) ---
function CalendarContent() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    console.log("[v0] Calendar component mounted, searchParams:", Object.fromEntries(searchParams.entries()))

    // Check if user just connected or if there was an error after OAuth
    if (searchParams.get("connected") === "true") {
      console.log("[v0] User just connected, fetching events")
      setIsConnected(true)
      fetchEvents()
    } else if (searchParams.get("error")) {
      const errorType = searchParams.get("error")
      console.error("[v0] OAuth error detected:", errorType)

      let errorMessage = "Failed to connect Google Calendar. Please try again."
      if (errorType === "access_denied") {
        errorMessage = "You denied access to your Google Calendar. Please try again and grant permission."
      } else if (errorType === "callback_failed") {
        errorMessage = "Failed to complete Google Calendar connection. Please try again."
      }

      setError(errorMessage)
      setIsConnected(false)
      setIsLoading(false)
    } else {
      // On initial load or navigation, try to fetch events
      console.log("[v0] Initial load, attempting to fetch events")
      fetchEvents()
    }
  }, [searchParams])

  const fetchEvents = async () => {
    console.log("[v0] fetchEvents called")
    setIsLoading(true)
    setError(null)

    try {
      console.log("[v0] Fetching from /api/calendar/events")
      const response = await fetch("/api/calendar/events")
      const data = await response.json()

      console.log("[v0] Response received:", {
        status: response.status,
        needsAuth: data.needsAuth,
        eventsCount: data.events?.length,
      })

      // Handle server-side responses indicating authentication is needed/expired
      if ((response.status === 403 || response.status === 401) && data.needsAuth) {
        console.log("[v0] Authentication needed")
        setIsConnected(false)
        setError(response.status === 401 ? "Your Google Calendar connection expired. Please reconnect." : null)
        setIsLoading(false)
        return
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch events")
      }

      console.log("[v0] Events fetched successfully:", data.events.length)
      setEvents(data.events)
      setIsConnected(true)
    } catch (err: any) {
      console.error("[v0] Calendar fetch error:", err)
      // Only set general error if we were supposed to be connected
      if (isConnected) {
        setError(err.message || "An unknown error occurred while fetching events.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnectGoogle = () => {
    console.log("[v0] Connecting to Google Calendar")
    // Redirects user to your Next.js API route that starts the OAuth flow
    window.location.href = "/api/auth/google"
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  const getStressColor = (level: string) => {
    switch (level) {
      case "high":
        return "bg-[#F69074]/10 text-[#F69074] border-[#F69074]/20"
      case "medium":
        return "bg-[#C1B3A0]/10 text-[#C1B3A0] border-[#C1B3A0]/20"
      case "low":
        return "bg-[#9DA57E]/10 text-[#9DA57E] border-[#9DA57E]/20"
      default:
        return "bg-[#B6BFB8]/10 text-[#B6BFB8] border-[#B6BFB8]/20"
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#9DA57E] mx-auto mb-4" />
          <p className="text-muted-foreground">Loading calendar...</p>
        </div>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64">
                  <nav className="flex flex-col gap-4 mt-8">
                    <Link href="/dashboard" className="text-muted-foreground hover:text-primary transition-colors">
                      Chat
                    </Link>
                    <Link href="/scanner" className="text-muted-foreground hover:text-primary transition-colors">
                      Food Scanner
                    </Link>
                    <Link href="/tracking" className="text-muted-foreground hover:text-primary transition-colors">
                      Dashboard
                    </Link>
                    <Link href="/calendar" className="text-foreground hover:text-primary transition-colors font-medium">
                      Calendar
                    </Link>
                    <Button onClick={handleLogout} variant="outline" className="mt-4 bg-transparent">
                      Log Out
                    </Button>
                  </nav>
                </SheetContent>
              </Sheet>
              <h1 className="font-semibold text-2xl text-foreground">nourish.</h1>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/dashboard" className="text-muted-foreground hover:text-primary transition-colors">
                Chat
              </Link>
              <Link href="/scanner" className="text-muted-foreground hover:text-primary transition-colors">
                Food Scanner
              </Link>
              <Link href="/tracking" className="text-muted-foreground hover:text-primary transition-colors">
                Dashboard
              </Link>
              <Link href="/calendar" className="text-foreground hover:text-primary transition-colors font-medium">
                Calendar
              </Link>
              <Button onClick={handleLogout} variant="outline" size="sm" className="rounded-full bg-transparent">
                Log Out
              </Button>
            </nav>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-4 bg-background">
          <Card className="max-w-md w-full p-8 text-center border-[#E8E4E2]">
            <CalendarIcon className="w-16 h-16 mx-auto mb-4 text-[#9DA57E]" />
            <h2 className="text-2xl font-semibold mb-2 text-balance">Connect Your Calendar</h2>
            <p className="text-muted-foreground mb-6 text-pretty">
              Connect your Google Calendar to track stress levels and get personalized nutrition recommendations based
              on your schedule.
            </p>
            {error && (
              <div className="mb-4 p-3 bg-[#F69074]/10 border border-[#F69074]/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-[#F69074] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#F69074] text-left text-pretty">{error}</p>
              </div>
            )}
            <Button
              onClick={handleConnectGoogle}
              size="lg"
              className="w-full bg-[#9DA57E] hover:bg-[#4E5424] text-white"
            >
              <CalendarIcon className="w-5 h-5 mr-2" />
              Connect Google Calendar
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <nav className="flex flex-col gap-4 mt-8">
                  <Link href="/dashboard" className="text-muted-foreground hover:text-primary transition-colors">
                    Chat
                  </Link>
                  <Link href="/scanner" className="text-muted-foreground hover:text-primary transition-colors">
                    Food Scanner
                  </Link>
                  <Link href="/tracking" className="text-muted-foreground hover:text-primary transition-colors">
                    Dashboard
                  </Link>
                  <Link href="/calendar" className="text-foreground hover:text-primary transition-colors font-medium">
                    Calendar
                  </Link>
                  <Button onClick={handleLogout} variant="outline" className="mt-4 bg-transparent">
                    Log Out
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
            <h1 className="font-semibold text-2xl text-foreground">nourish.</h1>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/dashboard" className="text-muted-foreground hover:text-primary transition-colors">
              Chat
            </Link>
            <Link href="/scanner" className="text-muted-foreground hover:text-primary transition-colors">
              Food Scanner
            </Link>
            <Link href="/tracking" className="text-muted-foreground hover:text-primary transition-colors">
              Dashboard
            </Link>
            <Link href="/calendar" className="text-foreground hover:text-primary transition-colors font-medium">
              Calendar
            </Link>
            <Button onClick={handleLogout} variant="outline" size="sm" className="rounded-full bg-transparent">
              Log Out
            </Button>
          </nav>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-balance">Your Calendar</h2>
            <Button onClick={fetchEvents} variant="outline" size="sm" className="border-[#E8E4E2] bg-transparent">
              Refresh
            </Button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-[#F69074]/10 border border-[#F69074]/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-[#F69074] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#F69074]">{error}</p>
            </div>
          )}

          {events.length === 0 ? (
            <Card className="p-8 text-center border-[#E8E4E2]">
              <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No upcoming events found in your calendar.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <Card key={event.id} className="p-4 border-[#E8E4E2]">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1 text-balance">{event.title}</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        {new Date(event.date).toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {event.location && <p className="text-sm text-muted-foreground mb-2">📍 {event.location}</p>}
                      {event.description && (
                        <p className="text-sm text-muted-foreground text-pretty">{event.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full border ${getStressColor(event.stressLevel)}`}>
                        {event.stressLevel} stress
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-[#9DA57E]/10 text-[#9DA57E] border border-[#9DA57E]/20">
                        {event.type}
                      </span>
                    </div>
                  </div>

                  {event.foodSuggestions && event.foodSuggestions.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[#E8E4E2]">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-[#9DA57E]" />
                        <h4 className="font-medium text-sm text-[#4E5424]">Recommended Foods</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {event.foodSuggestions.map((food, idx) => (
                          <div key={idx} className="p-3 rounded-lg bg-[#E8E4E2]/30 border border-[#E8E4E2]">
                            <p className="font-medium text-sm text-[#4E5424] mb-1">{food.name}</p>
                            <p className="text-xs text-muted-foreground text-pretty">{food.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Page Wrapper (Handles Suspense for Client Components) ---
export default function CalendarView() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#9DA57E] mx-auto mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <CalendarContent />
    </Suspense>
  )
}
