"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

const rotatingWords = ["body", "mind", "skin", "soul", "energy", "wellness"]

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

      <div className="w-full max-w-2xl text-center space-y-8">
        {/* Logo and animated tagline */}
        <div className="space-y-6">
          <h1 className="font-semibold text-6xl md:text-7xl text-foreground tracking-tight">nourish.</h1>
          <div className="h-20 flex items-center justify-center">
            <p className="text-2xl md:text-3xl text-muted-foreground font-light">
              nourish{" "}
              <span
                className={`inline-block min-w-[140px] text-left transition-opacity duration-300 ${
                  isVisible ? "opacity-100" : "opacity-0"
                }`}
              >
                {rotatingWords[wordIndex]}
              </span>
            </p>
          </div>
          <p className="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed">
            Track your nutrition, understand your body, and optimize your wellness with AI-powered insights.
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 text-sm">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 mx-auto flex items-center justify-center text-primary font-semibold">
              AI
            </div>
            <p className="text-muted-foreground">AI-powered symptom analysis</p>
          </div>
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 mx-auto flex items-center justify-center text-primary font-semibold">
              📸
            </div>
            <p className="text-muted-foreground">Smart food scanning</p>
          </div>
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 mx-auto flex items-center justify-center text-primary font-semibold">
              📊
            </div>
            <p className="text-muted-foreground">Nutrient tracking dashboard</p>
          </div>
        </div>
      </div>
    </div>
  )
}
