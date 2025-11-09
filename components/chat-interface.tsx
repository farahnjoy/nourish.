"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Send, Sparkles, Menu } from "lucide-react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

interface Message {
  role: "user" | "assistant"
  content: string
  nutrients?: string[]
  dietRecommendations?: string[]
}

export default function ChatInterface({ user }: { user: User }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! How are you feeling today? Tell me about any symptoms or concerns you have, and I'll help identify potential nutrient deficiencies.",
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: userMessage }])
    setIsLoading(true)

    try {
      // Get user's nutrient data from last 7 days
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { data: intakeData, error: intakeError } = await supabase
        .from("nutrient_intake")
        .select("nutrient_id, amount, unit")
        .eq("user_id", user.id)
        .gte("meal_time", sevenDaysAgo.toISOString())

      if (intakeError) {
        console.error("Supabase intake error:", intakeError)
      }

      const { data: nutrients } = await supabase
        .from("nutrients")
        .select("id, name, daily_value, unit")

      // Aggregate intake by nutrient
      const nutrientMap: Record<string, { amount: number; unit: string; target: string }> = {}

      if (intakeData && nutrients) {
        intakeData.forEach((intake: any) => {
          const nutrient = nutrients.find((n: any) => n.id === intake.nutrient_id)
          if (nutrient) {
            if (!nutrientMap[nutrient.name]) {
              nutrientMap[nutrient.name] = {
                amount: 0,
                unit: intake.unit,
                target: `${nutrient.daily_value}${nutrient.unit}/day`,
              }
            }
            nutrientMap[nutrient.name].amount += intake.amount
          }
        })

        // Calculate daily average
        Object.keys(nutrientMap).forEach((key) => {
          nutrientMap[key].amount = Math.round((nutrientMap[key].amount / 7) * 10) / 10
        })
      }

      console.log("[Chat] Calling Python endpoint directly...")
      console.log("[Chat] Symptoms:", userMessage.substring(0, 50))

      // 🌟 FIX: Call Python analyze-symptoms endpoint directly
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptoms: userMessage,
          user_intake: {
            nutrients: nutrientMap,
          },
        }),
      })

      console.log("[Chat] Response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[Chat] Python error response:", errorText)
        throw new Error(`Failed to get response: ${response.status}`)
      }

      const data = await response.json()
      console.log("[Chat] Received data:", data)

      // Validate response structure
      if (!data.analysis) {
        console.error("[Chat] Missing analysis in response:", data)
        throw new Error("Invalid response structure")
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.analysis,
          nutrients: data.recommended_nutrients || [],
          dietRecommendations: data.diet_recommendations || [],
        },
      ])

      // Save to database
      await supabase.from("symptom_logs").insert({
        user_id: user.id,
        symptoms: userMessage,
        ai_response: data,
        recommended_nutrients: data.recommended_nutrients || [],
      })
    } catch (error) {
      console.error("[Chat] Full error:", error)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I'm sorry, I encountered an error analyzing your symptoms. Please try again in a moment.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
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
                  <Link href="/dashboard" className="text-foreground hover:text-primary transition-colors">
                    Chat
                  </Link>
                  <Link href="/scanner" className="text-muted-foreground hover:text-primary transition-colors">
                    Food Scanner
                  </Link>
                  <Link href="/tracking" className="text-muted-foreground hover:text-primary transition-colors">
                    Dashboard
                  </Link>
                  <Link href="/calendar" className="text-muted-foreground hover:text-primary transition-colors">
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
            <Link href="/dashboard" className="text-foreground hover:text-primary transition-colors font-medium">
              Chat
            </Link>
            <Link href="/scanner" className="text-muted-foreground hover:text-primary transition-colors">
              Food Scanner
            </Link>
            <Link href="/tracking" className="text-muted-foreground hover:text-primary transition-colors">
              Dashboard
            </Link>
            <Link href="/calendar" className="text-muted-foreground hover:text-primary transition-colors">
              Calendar
            </Link>
            <Button onClick={handleLogout} variant="outline" size="sm" className="rounded-full bg-transparent">
              Log Out
            </Button>
          </nav>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <Card
                className={`max-w-[85%] p-4 ${
                  message.role === "user" ? "bg-primary text-primary-foreground" : "bg-card"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">AI Nutritionist</span>
                  </div>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                {message.nutrients && message.nutrients.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Recommended Nutrients:</p>
                    <div className="flex flex-wrap gap-2">
                      {message.nutrients.map((nutrient, i) => (
                        <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                          {nutrient}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {message.dietRecommendations && message.dietRecommendations.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Diet Suggestions:</p>
                    <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
                      {message.dietRecommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <Card className="max-w-[85%] p-4 bg-card">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                    <div
                      className="w-2 h-2 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <div
                      className="w-2 h-2 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">Analyzing...</span>
                </div>
              </Card>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder="Describe how you're feeling..."
              className="min-h-[60px] resize-none rounded-2xl"
              disabled={isLoading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || !input.trim()}
              size="icon"
              className="rounded-full h-[60px] w-[60px] shrink-0 bg-primary hover:bg-primary/90"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}
