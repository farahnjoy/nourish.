import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import FoodScanner from "@/components/food-scanner"

export default async function ScannerPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  return (
    <div className="min-h-screen bg-background">
      <FoodScanner user={user} />
    </div>
  )
}
