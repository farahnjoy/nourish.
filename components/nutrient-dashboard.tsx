"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, TrendingUp, Award, AlertCircle, Menu } from "lucide-react"
import type { User } from "@supabase/supabase-js"
import Link from "next/link"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"

interface NutrientIntake {
  id: string
  nutrient_id: string | null
  amount: number
  unit: string
  source: string
  meal_time: string
  notes: string | null
}

interface Meal {
  id: string
  meal_name: string
  meal_type: string
  image_url: string | null
  nutrients_detected: any
  meal_date: string
}

interface Nutrient {
  id: string
  name: string
  description: string | null
  daily_recommended_value: string | null
}

interface Props {
  user: User
  nutrientIntake: NutrientIntake[]
  meals: Meal[]
  nutrients: Nutrient[]
}

const CHART_COLORS = ["#9DA57E", "#F69074", "#B6BFB8", "#C1B3A0", "#4E5424", "#E8E4E2"]

export default function NutrientDashboard({ user, nutrientIntake, meals, nutrients }: Props) {
  const [timeRange, setTimeRange] = useState<"today" | "week" | "month">("today")

  const nutrientSummary = useMemo(() => {
    const now = new Date()
    const filtered = meals.filter((meal) => {
      const mealDate = new Date(meal.meal_date)
      if (timeRange === "today") {
        return mealDate.toDateString() === now.toDateString()
      } else if (timeRange === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return mealDate >= weekAgo
      } else {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        return mealDate >= monthAgo
      }
    })

    console.log("[v0] Filtered meals for", timeRange, ":", filtered.length)

    const summary: Record<string, { amount: number; unit: string }> = {}

    filtered.forEach((meal) => {
      if (meal.nutrients_detected && Array.isArray(meal.nutrients_detected)) {
        meal.nutrients_detected.forEach((nutrient: any) => {
          const name = nutrient.name
          const amount = Number.parseFloat(nutrient.amount) || 0
          const unit = nutrient.unit || "g"

          if (!summary[name]) {
            summary[name] = { amount: 0, unit }
          }
          summary[name].amount += amount
        })
      }
    })

    console.log("[v0] Nutrient summary:", summary)
    return summary
  }, [meals, timeRange])

  // Key nutrients to track
  const keyNutrients = [
    { name: "Protein", target: 50, unit: "g", color: "#9DA57E" },
    { name: "Carbohydrates", target: 300, unit: "g", color: "#F69074" },
    { name: "Fiber", target: 30, unit: "g", color: "#B6BFB8" },
    { name: "Vitamin C", target: 90, unit: "mg", color: "#C1B3A0" },
    { name: "Iron", target: 18, unit: "mg", color: "#4E5424" },
    { name: "Calcium", target: 1000, unit: "mg", color: "#9DA57E" },
  ]

  // Calculate progress for key nutrients
  const nutrientProgress = keyNutrients.map((nutrient) => {
    const intake = Object.entries(nutrientSummary).find(([key]) =>
      key.toLowerCase().includes(nutrient.name.toLowerCase()),
    )
    const amount = intake ? intake[1].amount : 0
    const percentage = Math.min((amount / nutrient.target) * 100, 100)

    return {
      name: nutrient.name,
      current: Math.round(amount),
      target: nutrient.target,
      percentage: Math.round(percentage),
      color: nutrient.color,
      unit: nutrient.unit,
    }
  })

  // Meal distribution data
  const mealTypeData = useMemo(() => {
    const distribution = meals.reduce(
      (acc, meal) => {
        const type = meal.meal_type || "other"
        acc[type] = (acc[type] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    return Object.entries(distribution).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }))
  }, [meals])

  // Stats cards
  const stats = [
    {
      title: "Meals Logged",
      value: meals.length.toString(),
      icon: Calendar,
      color: "text-primary",
    },
    {
      title: "Avg Nutrients/Day",
      value: Math.round(nutrientIntake.length / Math.max(1, Math.ceil(nutrientIntake.length / 3))).toString(),
      icon: TrendingUp,
      color: "text-accent",
    },
    {
      title: "Goals Met",
      value: nutrientProgress.filter((n) => n.percentage >= 80).length.toString(),
      icon: Award,
      color: "text-primary",
    },
  ]

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
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
                  <Link href="/tracking" className="text-foreground hover:text-primary transition-colors font-medium">
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
            <Link href="/scanner" className="text-muted-foreground hover:text-primary transition-colors">
              Food Scanner
            </Link>
            <Link href="/tracking" className="text-foreground hover:text-primary transition-colors font-medium">
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
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
          {/* Time Range Selector */}
          <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as any)} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.map((stat, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                      <p className="text-3xl font-bold">{stat.value}</p>
                    </div>
                    <div
                      className={`w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center ${stat.color}`}
                    >
                      <stat.icon className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Nutrient Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Key Nutrient Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {nutrientProgress.map((nutrient) => (
                <div key={nutrient.name} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{nutrient.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {nutrient.current}
                      {nutrient.unit} / {nutrient.target}
                      {nutrient.unit}
                    </span>
                  </div>
                  <div className="relative">
                    <Progress
                      value={nutrient.percentage}
                      className="h-3"
                      style={{
                        // @ts-ignore
                        "--progress-background": nutrient.color,
                      }}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-primary-foreground">
                      {nutrient.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Nutrient Intake Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={nutrientProgress}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8E4E2" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #E8E4E2",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="percentage" radius={[8, 8, 0, 0]}>
                      {nutrientProgress.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Meal Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={mealTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {mealTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Recent Meals */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Meals</CardTitle>
            </CardHeader>
            <CardContent>
              {meals.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No meals logged yet</p>
                  <Button asChild className="rounded-full">
                    <Link href="/scanner">Scan Your First Meal</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {meals.map((meal) => (
                    <div
                      key={meal.id}
                      className="group relative overflow-hidden rounded-xl bg-muted hover:shadow-lg transition-all cursor-pointer"
                    >
                      {meal.image_url && (
                        <div className="aspect-square overflow-hidden bg-muted">
                          <img
                            src={meal.image_url || "/placeholder.svg?height=200&width=200"}
                            alt={meal.meal_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                      )}
                      <div className="p-4">
                        <h3 className="font-semibold mb-1">{meal.meal_name}</h3>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="capitalize">{meal.meal_type}</span>
                          <span>{new Date(meal.meal_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recommendations */}
          {nutrientProgress.some((n) => n.percentage < 80) && (
            <Card className="border-accent/50 bg-accent/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-accent">
                  <AlertCircle className="w-5 h-5" />
                  Nutrition Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {nutrientProgress
                    .filter((n) => n.percentage < 80)
                    .slice(0, 3)
                    .map((nutrient) => (
                      <li key={nutrient.name} className="flex items-start gap-2">
                        <span className="text-accent mt-0.5">•</span>
                        <span>
                          Your <strong>{nutrient.name}</strong> intake is at {nutrient.percentage}%. Consider adding
                          foods rich in {nutrient.name.toLowerCase()} to reach your daily goal.
                        </span>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
