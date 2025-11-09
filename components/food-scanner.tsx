"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Camera, Upload, X, Sparkles, Menu } from "lucide-react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

interface NutrientInfo {
  name: string
  amount: string
  unit: string
  dailyValue?: string
}

interface ScanResult {
  foodName: string
  portion: string
  calories: string
  nutrients: NutrientInfo[]
}

export default function FoodScanner({ user }: { user: User }) {
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [stream])

  const startCamera = async () => {
    try {
      console.log("[v0] Requesting camera access...")
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      console.log("[v0] Camera access granted, stream:", mediaStream)

      setStream(mediaStream)
      setIsCameraOpen(true)

      setTimeout(() => {
        if (videoRef.current) {
          console.log("[v0] Setting video srcObject")
          videoRef.current.srcObject = mediaStream
          videoRef.current.onloadedmetadata = () => {
            console.log("[v0] Video metadata loaded")
            videoRef.current
              ?.play()
              .then(() => {
                console.log("[v0] Video playing")
              })
              .catch((err) => {
                console.error("[v0] Video play error:", err)
              })
          }
        }
      }, 100)
    } catch (error) {
      console.error("[v0] Camera access error:", error)
      alert(
        `Unable to access camera: ${error instanceof Error ? error.message : "Unknown error"}. Please check permissions.`,
      )
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    setIsCameraOpen(false)
  }

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current

      console.log(
        "[v0] Video readyState:",
        video.readyState,
        "videoWidth:",
        video.videoWidth,
        "videoHeight:",
        video.videoHeight,
      )

      if (video.readyState >= 2 && video.videoWidth > 0) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.drawImage(video, 0, 0)
          const imageData = canvas.toDataURL("image/jpeg", 0.8)
          console.log("[v0] Image captured, data length:", imageData.length)
          setCapturedImage(imageData)
          stopCamera()
          analyzeFoodImage(imageData)
        }
      } else {
        console.error("[v0] Video not ready:", video.readyState)
        alert("Camera is still loading. Please wait a moment and try again.")
      }
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const imageData = event.target?.result as string
        setCapturedImage(imageData)
        analyzeFoodImage(imageData)
      }
      reader.readAsDataURL(file)
    }
  }

  const analyzeFoodImage = async (imageData: string) => {
    setIsAnalyzing(true)
    setScanResult(null)

    try {
      const response = await fetch("/api/scan-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData, userId: user.id }),
      })

      if (!response.ok) throw new Error("Analysis failed")

      const data = await response.json()
      setScanResult(data.result)

      // Save to database
      await supabase.from("meals").insert({
        user_id: user.id,
        meal_name: data.result.foodName,
        meal_type: getCurrentMealType(),
        image_url: imageData,
        nutrients_detected: data.result.nutrients,
      })

      // Save individual nutrients
      if (data.result.nutrients && data.result.nutrients.length > 0) {
        const nutrientRecords = data.result.nutrients.map((n: NutrientInfo) => ({
          user_id: user.id,
          nutrient_id: null,
          amount: Number.parseFloat(n.amount) || 0,
          unit: n.unit,
          source: "food_scan",
          meal_time: new Date().toISOString(),
          notes: `${data.result.foodName} - ${data.result.portion}`,
        }))
        await supabase.from("nutrient_intake").insert(nutrientRecords)
      }
    } catch (error) {
      console.error("[v0] Food analysis error:", error)
      alert("Failed to analyze food. Please try again.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getCurrentMealType = () => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 11) return "breakfast"
    if (hour >= 11 && hour < 16) return "lunch"
    if (hour >= 16 && hour < 21) return "dinner"
    return "snack"
  }

  const resetScanner = () => {
    setCapturedImage(null)
    setScanResult(null)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20">
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
                  <Link href="/scanner" className="text-foreground hover:text-primary transition-colors font-medium">
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
            <Link href="/dashboard" className="text-muted-foreground hover:text-primary transition-colors">
              Chat
            </Link>
            <Link href="/scanner" className="text-foreground hover:text-primary transition-colors font-medium">
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

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        {!isCameraOpen && !capturedImage && !scanResult && (
          <Card className="max-w-md w-full p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
              <Camera className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold mb-2">Scan Your Food</h2>
              <p className="text-muted-foreground text-sm">
                Take a photo or upload an image to get detailed nutritional information
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button onClick={startCamera} size="lg" className="w-full rounded-full bg-primary hover:bg-primary/90">
                <Camera className="w-5 h-5 mr-2" />
                Open Camera
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                size="lg"
                className="w-full rounded-full"
              >
                <Upload className="w-5 h-5 mr-2" />
                Upload Photo
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </div>
          </Card>
        )}

        {/* Camera View */}
        {isCameraOpen && (
          <div className="fixed inset-0 z-50 bg-black">
            {/* Dimmed overlay with camera frame cutout */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-full max-w-2xl aspect-[4/3]">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover rounded-3xl bg-gray-900"
                  style={{ transform: "scaleX(1)" }}
                />
                {/* Corner brackets for camera frame */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-4 left-4 w-12 h-12 border-t-4 border-l-4 border-primary rounded-tl-2xl" />
                  <div className="absolute top-4 right-4 w-12 h-12 border-t-4 border-r-4 border-primary rounded-tr-2xl" />
                  <div className="absolute bottom-4 left-4 w-12 h-12 border-b-4 border-l-4 border-primary rounded-bl-2xl" />
                  <div className="absolute bottom-4 right-4 w-12 h-12 border-b-4 border-r-4 border-primary rounded-br-2xl" />
                </div>
              </div>
            </div>
            {/* Dimmed areas */}
            <div
              className="absolute inset-0 bg-black/60 pointer-events-none"
              style={{
                clipPath:
                  "polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, calc(50% - min(40%, 400px)) calc(50% - min(30%, 300px)), calc(50% - min(40%, 400px)) calc(50% + min(30%, 300px)), calc(50% + min(40%, 400px)) calc(50% + min(30%, 300px)), calc(50% + min(40%, 400px)) calc(50% - min(30%, 300px)), calc(50% - min(40%, 400px)) calc(50% - min(30%, 300px)))",
              }}
            />
            {/* Controls */}
            <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-4 px-4">
              <Button
                onClick={stopCamera}
                variant="outline"
                size="icon"
                className="rounded-full w-14 h-14 bg-black/50 border-white/20 hover:bg-black/70"
              >
                <X className="w-6 h-6 text-white" />
              </Button>
              <Button onClick={capturePhoto} size="icon" className="rounded-full w-20 h-20 bg-white hover:bg-white/90">
                <div className="w-16 h-16 rounded-full border-4 border-black" />
              </Button>
              <div className="w-14 h-14" /> {/* Spacer for centering */}
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {/* Analysis Loading */}
        {isAnalyzing && capturedImage && (
          <Card className="max-w-md w-full p-8 text-center space-y-6">
            <div className="w-full aspect-square rounded-2xl overflow-hidden bg-muted">
              <img
                src={capturedImage || "/placeholder.svg"}
                alt="Captured food"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                <p className="text-lg font-medium">Analyzing your food...</p>
              </div>
              <div className="flex justify-center gap-1">
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.1s" }} />
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.2s" }} />
              </div>
            </div>
          </Card>
        )}

        {/* Scan Results */}
        {scanResult && capturedImage && !isAnalyzing && (
          <div className="max-w-2xl w-full space-y-4">
            <Card className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-1/3 aspect-square rounded-xl overflow-hidden bg-muted shrink-0">
                  <img
                    src={capturedImage || "/placeholder.svg"}
                    alt="Scanned food"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h2 className="text-2xl font-semibold mb-1">{scanResult.foodName}</h2>
                    <p className="text-muted-foreground">{scanResult.portion}</p>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-accent/10 rounded-lg">
                    <span className="text-accent font-semibold text-xl">{scanResult.calories}</span>
                    <span className="text-sm text-muted-foreground">calories</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Nutritional Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {scanResult.nutrients.map((nutrient, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                    <span className="text-sm font-medium">{nutrient.name}</span>
                    <div className="text-right">
                      <span className="text-sm font-semibold">
                        {nutrient.amount}
                        {nutrient.unit}
                      </span>
                      {nutrient.dailyValue && <p className="text-xs text-muted-foreground">{nutrient.dailyValue} DV</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="flex gap-3">
              <Button onClick={resetScanner} variant="outline" className="flex-1 rounded-full bg-transparent">
                Scan Another
              </Button>
              <Button
                onClick={() => router.push("/tracking")}
                className="flex-1 rounded-full bg-primary hover:bg-primary/90"
              >
                View Dashboard
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
