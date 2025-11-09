"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight, Brain, Camera, BarChart3, Calendar } from "lucide-react"

const rotatingWords = ["your body", "your mind", "your soul", "nourish"]

export default function HomePage() {
  const [wordIndex, setWordIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false)
      setTimeout(() => {
        setWordIndex((prev) => (prev + 1) % rotatingWords.length)
        setIsVisible(true)
      }, 300)
    }, 2500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Subtle background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="w-full max-w-4xl text-center space-y-8">
        {/* Logo and animated tagline */}
        <div className="space-y-6">
          <div className="h-20 flex items-center justify-center">
            <h1 className="text-5xl md:text-6xl text-foreground tracking-tight font-semibold">
              {wordIndex === 3 ? (
                <span
                  className={`transition-opacity duration-300 text-foreground ${
                    isVisible ? "opacity-100" : "opacity-0"
                  }`}
                >
                  nourish.
                </span>
              ) : (
                <>
                  nourish{" "}
                  <span
                    className={`inline-block min-w-[200px] text-left transition-opacity duration-300 text-primary ${
                      isVisible ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    {rotatingWords[wordIndex]}.
                  </span>
                </>
              )}
            </h1>
          </div>
          <p className="text-muted-foreground text-xl md:text-2xl max-w-md mx-auto font-medium">
            Wellness powered by what you eat
          </p>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
          <Button
            asChild
            size="lg"
            className="rounded-full px-8 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Link href="/auth/sign-up">
              Get Started <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="rounded-full px-8 border-border hover:bg-secondary bg-transparent"
          >
            <Link href="/auth/login">Log In</Link>
          </Button>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-12 max-w-5xl mx-auto">
          <div className="space-y-3 p-6 rounded-2xl bg-background/50 backdrop-blur-sm border border-border hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <p className="text-muted-foreground font-medium">AI-powered symptom analysis</p>
          </div>
          <div className="space-y-3 p-6 rounded-2xl bg-background/50 backdrop-blur-sm border border-border hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
              <Camera className="w-6 h-6 text-primary" />
            </div>
            <p className="text-muted-foreground font-medium">Smart food scanning</p>
          </div>
          <div className="space-y-3 p-6 rounded-2xl bg-background/50 backdrop-blur-sm border border-border hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <p className="text-muted-foreground font-medium">Nutrient tracking dashboard</p>
          </div>
          <div className="space-y-3 p-6 rounded-2xl bg-background/50 backdrop-blur-sm border border-border hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <p className="text-muted-foreground font-medium">Calendar-based meal suggestions</p>
          </div>
        </div>
      </div>
    </div>
  )
}
