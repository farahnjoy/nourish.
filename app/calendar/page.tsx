import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import CalendarView from "@/components/calendar-view"

export default async function CalendarPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  // Fetch user's meals for calendar view
  const { data: meals } = await supabase
    .from("meals")
    .select("*")
    .eq("user_id", user.id)
    .order("meal_date", { ascending: false })

  return (
    <div className="min-h-screen bg-background">
      <CalendarView user={user} meals={meals || []} />
    </div>
  )
}
