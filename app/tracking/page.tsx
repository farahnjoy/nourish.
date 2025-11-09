import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import NutrientDashboard from "@/components/nutrient-dashboard"

export default async function TrackingPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  // Fetch user's nutrient data
  const { data: nutrientIntake } = await supabase
    .from("nutrient_intake")
    .select("*")
    .eq("user_id", user.id)
    .order("meal_time", { ascending: false })

  const { data: meals } = await supabase
    .from("meals")
    .select("*")
    .eq("user_id", user.id)
    .order("meal_date", { ascending: false })
    .limit(10)

  const { data: nutrients } = await supabase.from("nutrients").select("*").order("name")

  return (
    <div className="min-h-screen bg-background">
      <NutrientDashboard
        user={user}
        nutrientIntake={nutrientIntake || []}
        meals={meals || []}
        nutrients={nutrients || []}
      />
    </div>
  )
}
