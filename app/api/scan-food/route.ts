import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

export async function POST(request: NextRequest) {
  try {
    const { image, userId } = await request.json()

    if (!image || !userId) {
      return NextResponse.json({ error: "Image and userId are required" }, { status: 400 })
    }

    console.log("[v0] Starting food scan for user:", userId)

    // Initialize Gemini
    const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genai.getGenerativeModel({ model: "gemini-2.0-flash-exp" })

    // Extract base64 data
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "")

    // Step 1: Extract individual foods with Gemini
    console.log("[v0] Extracting foods from image with Gemini...")
    const extractionPrompt = `You are a nutrition expert analyzing a food image. List ONLY the individual food items you can identify on the plate/bowl.

CRITICAL RULES:
- List SPECIFIC food items (e.g., "chicken breast", "brown rice", "broccoli")
- Estimate the portion size for EACH item (e.g., "4 oz", "1 cup", "100g")
- Do NOT give generic descriptions like "meal" or "plate"
- If you can't identify specific items, make your best educated guess
- Return ONLY valid JSON, no markdown, no extra text

Format:
{
  "foods": [
    {"name": "specific food item", "portion": "estimated amount with unit"}
  ]
}`

    const extractionResult = await model.generateContent([
      extractionPrompt,
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data,
        },
      },
    ])

    const extractionText = extractionResult.response.text()
    console.log("[v0] Gemini extraction response:", extractionText)

    // Parse JSON from response
    let extractedFoods
    try {
      const jsonMatch = extractionText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error("No JSON found in response")
      extractedFoods = JSON.parse(jsonMatch[0])
    } catch (e) {
      console.error("[v0] Failed to parse Gemini response:", e)
      throw new Error("Could not extract food items from image")
    }

    if (!extractedFoods.foods || extractedFoods.foods.length === 0) {
      throw new Error("No foods identified in image")
    }

    console.log("[v0] Extracted foods:", extractedFoods.foods)

    // Step 2: Get nutrition data from USDA API for each food
    const fdcApiKey = process.env.FDC_API_KEY!
    const nutritionResults = []

    for (const food of extractedFoods.foods) {
      console.log(`[v0] Looking up "${food.name}" in USDA database...`)

      try {
        // Search USDA database
        const searchUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${fdcApiKey}&query=${encodeURIComponent(food.name)}&pageSize=1`
        const searchResponse = await fetch(searchUrl)

        if (!searchResponse.ok) {
          throw new Error(`USDA API error: ${searchResponse.status}`)
        }

        const searchData = await searchResponse.json()

        if (searchData.foods && searchData.foods.length > 0) {
          const fdcFood = searchData.foods[0]
          console.log(`[v0] Found in USDA: ${fdcFood.description}`)

          // Extract key nutrients
          const nutrients = fdcFood.foodNutrients || []
          const getnutrient = (name: string) => {
            const n = nutrients.find((nu: any) => nu.nutrientName?.toLowerCase().includes(name.toLowerCase()))
            return n ? { amount: n.value || 0, unit: n.unitName || "g" } : { amount: 0, unit: "g" }
          }

          nutritionResults.push({
            name: food.name,
            portion: food.portion,
            fdcId: fdcFood.fdcId,
            calories: getnutrient("energy").amount,
            protein: getnutrient("protein"),
            carbs: getnutrient("carbohydrate"),
            fat: getnutrient("fat"),
            fiber: getnutrient("fiber"),
            vitaminC: getnutrient("vitamin c"),
            vitaminA: getnutrient("vitamin a"),
            iron: getnutrient("iron"),
            calcium: getnutrient("calcium"),
          })
        } else {
          // USDA didn't find it - use AI to estimate
          console.log(`[v0] "${food.name}" not found in USDA, estimating with AI...`)

          const estimatePrompt = `Estimate the nutrition for: ${food.name} (${food.portion})

Return ONLY valid JSON with these exact fields:
{
  "calories": number,
  "protein": {"amount": number, "unit": "g"},
  "carbs": {"amount": number, "unit": "g"},
  "fat": {"amount": number, "unit": "g"},
  "fiber": {"amount": number, "unit": "g"}
}`

          const estimateResult = await model.generateContent(estimatePrompt)
          const estimateText = estimateResult.response.text()
          const jsonMatch = estimateText.match(/\{[\s\S]*\}/)

          if (jsonMatch) {
            const estimated = JSON.parse(jsonMatch[0])
            nutritionResults.push({
              name: food.name,
              portion: food.portion,
              fdcId: null,
              calories: estimated.calories || 0,
              protein: estimated.protein || { amount: 0, unit: "g" },
              carbs: estimated.carbs || { amount: 0, unit: "g" },
              fat: estimated.fat || { amount: 0, unit: "g" },
              fiber: estimated.fiber || { amount: 0, unit: "g" },
              vitaminC: { amount: 0, unit: "mg" },
              vitaminA: { amount: 0, unit: "mcg" },
              iron: { amount: 0, unit: "mg" },
              calcium: { amount: 0, unit: "mg" },
            })
          }
        }
      } catch (error) {
        console.error(`[v0] Error processing ${food.name}:`, error)
      }
    }

    // Step 3: Aggregate nutrition data
    const totalNutrition = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      vitaminC: 0,
      vitaminA: 0,
      iron: 0,
      calcium: 0,
    }

    nutritionResults.forEach((item) => {
      totalNutrition.calories += item.calories || 0
      totalNutrition.protein += item.protein?.amount || 0
      totalNutrition.carbs += item.carbs?.amount || 0
      totalNutrition.fat += item.fat?.amount || 0
      totalNutrition.fiber += item.fiber?.amount || 0
      totalNutrition.vitaminC += item.vitaminC?.amount || 0
      totalNutrition.vitaminA += item.vitaminA?.amount || 0
      totalNutrition.iron += item.iron?.amount || 0
      totalNutrition.calcium += item.calcium?.amount || 0
    })

    console.log("[v0] Total nutrition:", totalNutrition)

    // Format response
    const foodName = nutritionResults.map((f) => f.name).join(", ")
    const result = {
      foodName,
      portion: "Combined portions",
      calories: Math.round(totalNutrition.calories).toString(),
      nutrients: [
        {
          name: "Protein",
          amount: totalNutrition.protein.toFixed(1),
          unit: "g",
          dailyValue: `${Math.round((totalNutrition.protein / 50) * 100)}%`,
        },
        {
          name: "Carbohydrates",
          amount: totalNutrition.carbs.toFixed(1),
          unit: "g",
          dailyValue: `${Math.round((totalNutrition.carbs / 300) * 100)}%`,
        },
        {
          name: "Fat",
          amount: totalNutrition.fat.toFixed(1),
          unit: "g",
          dailyValue: `${Math.round((totalNutrition.fat / 78) * 100)}%`,
        },
        {
          name: "Fiber",
          amount: totalNutrition.fiber.toFixed(1),
          unit: "g",
          dailyValue: `${Math.round((totalNutrition.fiber / 28) * 100)}%`,
        },
        {
          name: "Vitamin C",
          amount: totalNutrition.vitaminC.toFixed(1),
          unit: "mg",
          dailyValue: `${Math.round((totalNutrition.vitaminC / 90) * 100)}%`,
        },
        {
          name: "Vitamin A",
          amount: totalNutrition.vitaminA.toFixed(1),
          unit: "mcg",
          dailyValue: `${Math.round((totalNutrition.vitaminA / 900) * 100)}%`,
        },
        {
          name: "Iron",
          amount: totalNutrition.iron.toFixed(1),
          unit: "mg",
          dailyValue: `${Math.round((totalNutrition.iron / 18) * 100)}%`,
        },
        {
          name: "Calcium",
          amount: totalNutrition.calcium.toFixed(1),
          unit: "mg",
          dailyValue: `${Math.round((totalNutrition.calcium / 1000) * 100)}%`,
        },
      ],
      individualFoods: nutritionResults,
    }

    return NextResponse.json({ result })
  } catch (error) {
    console.error("[v0] Food scan error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    )
  }
}
