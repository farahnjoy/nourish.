import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { GoogleGenerativeAI } from "@google/generative-ai"

export async function POST(request: NextRequest) {
  try {
    const { message, userId } = await request.json()

    if (!message || !userId) {
      return NextResponse.json({ error: "Message and userId are required" }, { status: 400 })
    }

    console.log("[v0] Analyzing symptoms for user:", userId)

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // Get nutrient intake from last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: intakeData, error: intakeError } = await supabase
      .from("nutrient_intake")
      .select("nutrient_id, amount, unit")
      .eq("user_id", userId)
      .gte("meal_time", sevenDaysAgo.toISOString())

    const { data: nutrients } = await supabase.from("nutrients").select("id, name, daily_value, unit")

    // Aggregate intake by nutrient
    const nutrientMap: Record<string, { amount: number; unit: string; target: string }> = {}

    if (intakeData && nutrients) {
      intakeData.forEach((intake) => {
        const nutrient = nutrients.find((n) => n.id === intake.nutrient_id)
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

    console.log("[v0] User's current intake:", nutrientMap)

    // Use Gemini to analyze symptoms
    const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genai.getGenerativeModel({ model: "gemini-2.0-flash-exp" })

    const analysisPrompt = `You are a nutrition expert AI assistant. A user is describing symptoms they're experiencing. 

USER SYMPTOMS: ${message}

USER'S CURRENT NUTRIENT INTAKE (last 7 days average):
${JSON.stringify(nutrientMap, null, 2)}

Analyze their symptoms in the context of their current nutritional intake. Identify:
1. Possible nutrient deficiencies that could cause these symptoms
2. Specific dietary changes they should make
3. Foods rich in the nutrients they're lacking

Return your response in this JSON format:
{
  "analysis": "Your detailed analysis of their symptoms and current nutrition (2-3 paragraphs)",
  "recommended_nutrients": ["Nutrient 1", "Nutrient 2", ...],
  "diet_recommendations": ["Specific food recommendation 1", "Specific food recommendation 2", ...]
}

Be empathetic, specific, and actionable. Reference their actual intake data.`

    const result = await model.generateContent(analysisPrompt)
    const responseText = result.response.text()

    console.log("[v0] Gemini response:", responseText)

    // Parse JSON from response
    let analysis
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error("No JSON found")
      analysis = JSON.parse(jsonMatch[0])
    } catch (e) {
      console.error("[v0] Failed to parse response:", e)
      // Fallback: use raw text as analysis
      analysis = {
        analysis: responseText,
        recommended_nutrients: ["Vitamin D", "Vitamin B12", "Iron", "Magnesium"],
        diet_recommendations: [
          "Include leafy greens",
          "Add fatty fish like salmon",
          "Incorporate citrus fruits",
          "Consider fortified cereals",
        ],
      }
    }

    return NextResponse.json({
      response: analysis.analysis,
      nutrients: analysis.recommended_nutrients || [],
      dietRecommendations: analysis.diet_recommendations || [],
    })
  } catch (error) {
    console.error("[v0] Chat API error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
