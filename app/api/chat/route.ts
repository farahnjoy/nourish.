import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { GoogleGenerativeAI } from "@google/generative-ai"

export async function POST(request: NextRequest) {
  try {
    const { symptoms, user_id } = await request.json()

    if (!symptoms || !user_id) {
      return NextResponse.json({ error: "Symptoms and user_id are required" }, { status: 400 })
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: intakeData } = await supabase
      .from("nutrient_intake")
      .select("nutrient_id, amount, unit, meal_time")
      .eq("user_id", user_id)
      .gte("meal_time", sevenDaysAgo.toISOString())
      .order("meal_time", { ascending: false })

    const { data: nutrients } = await supabase.from("nutrients").select("id, name, daily_value, unit")

    let daysOfData = 0
    const nutrientMap: Record<string, { amount: number; unit: string; target: string }> = {}

    if (intakeData && intakeData.length > 0 && nutrients) {
      const uniqueDates = new Set(intakeData.map((i: any) => new Date(i.meal_time).toDateString()))
      daysOfData = uniqueDates.size

      intakeData.forEach((intake: any) => {
        const nutrientItem = nutrients.find((n: any) => n.id === intake.nutrient_id)
        if (nutrientItem) {
          if (!nutrientMap[nutrientItem.name]) {
            nutrientMap[nutrientItem.name] = {
              amount: 0,
              unit: intake.unit,
              target: `${nutrientItem.daily_value}${nutrientItem.unit}/day`,
            }
          }
          nutrientMap[nutrientItem.name].amount += intake.amount
        }
      })

      // Calculate daily average based on actual days
      Object.keys(nutrientMap).forEach((key) => {
        nutrientMap[key].amount = Math.round((nutrientMap[key].amount / daysOfData) * 10) / 10
      })
    }

    const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genai.getGenerativeModel({ model: "gemini-2.0-flash-exp" })

    let contextSection = ""
    if (daysOfData === 0) {
      contextSection = `This is a NEW USER with NO TRACKED DATA yet. They haven't logged any meals.
Provide GENERAL nutritional advice based solely on their symptoms. Encourage them to use the food scanner to track their intake.`
    } else if (daysOfData < 3) {
      contextSection = `This user has LIMITED DATA (only ${daysOfData} day${daysOfData > 1 ? "s" : ""} of tracking).

CURRENT NUTRIENT INTAKE (${daysOfData}-day average):
${JSON.stringify(nutrientMap, null, 2)}

Note: This is early data. Provide tentative insights but acknowledge more tracking would help.`
    } else {
      contextSection = `This user has ${daysOfData} days of tracking data.

CURRENT NUTRIENT INTAKE (${daysOfData}-day average):
${JSON.stringify(nutrientMap, null, 2)}

Analyze their symptoms in relation to their actual tracked intake. Be specific about deficiencies you observe.`
    }

    const analysisPrompt = `You are a compassionate nutrition expert AI assistant. A user is describing symptoms.

USER SYMPTOMS: ${symptoms}

${contextSection}

Provide a helpful response that:
1. Acknowledges their symptoms with empathy
2. ${daysOfData === 0 ? "Suggests potential nutrient deficiencies that commonly cause these symptoms" : "Identifies specific deficiencies based on their tracked intake"}
3. Recommends specific dietary changes and foods
4. ${daysOfData === 0 ? "Encourages them to start tracking their meals for personalized insights" : "References their actual intake data"}

Return your response in this JSON format:
{
  "analysis": "Your detailed, empathetic analysis (2-3 paragraphs)",
  "recommended_nutrients": ["Nutrient 1", "Nutrient 2", ...],
  "diet_recommendations": ["Specific food 1", "Specific food 2", ...]
}

Be warm, specific, and actionable.`

    const result = await model.generateContent(analysisPrompt)
    const responseText = result.response.text()

    let analysis
    try {
      // Remove markdown code blocks if present
      let cleanText = responseText.trim()
      if (cleanText.startsWith("```json")) {
        cleanText = cleanText.replace(/```json\n?/g, "").replace(/```\n?/g, "")
      } else if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/```\n?/g, "")
      }

      // Find JSON object
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error("No JSON found")

      analysis = JSON.parse(jsonMatch[0])

      // Validate required fields
      if (!analysis.analysis || typeof analysis.analysis !== "string") {
        throw new Error("Invalid analysis field")
      }
    } catch (e) {
      console.error("[v0] JSON parsing error:", e)
      // Fallback: try to use raw text as analysis
      analysis = {
        analysis: responseText.replace(/```json|```/g, "").trim(),
        recommended_nutrients: ["Vitamin D", "Vitamin B12", "Iron", "Magnesium"],
        diet_recommendations: [
          "Include leafy greens daily",
          "Add fatty fish like salmon twice weekly",
          "Incorporate citrus fruits for Vitamin C",
          "Consider nuts and seeds for minerals",
        ],
      }
    }

    return NextResponse.json({
      analysis: analysis.analysis,
      recommended_nutrients: analysis.recommended_nutrients || [],
      diet_recommendations: analysis.diet_recommendations || [],
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
