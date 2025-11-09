import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: NextRequest) {
	try {
		const { message, userId } = await request.json()

		if (!message || !userId) {
			return NextResponse.json({ error: "Message and userId are required" }, { status: 400 })
		}

		// Ensure these environment variables are correctly set in Vercel
		const supabase = createClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL!, 
			process.env.SUPABASE_SERVICE_ROLE_KEY!
		)

		// Get nutrient intake from last 7 days
		const sevenDaysAgo = new Date()
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

		const { data: intakeData, error: intakeError } = await supabase
			.from("nutrient_intake")
			.select("nutrient_id, amount, unit")
			.eq("user_id", userId)
			.gte("meal_time", sevenDaysAgo.toISOString())
        
		if (intakeError) {
			console.error("Supabase Intake Error:", intakeError);
		}

		// Get nutrient names
		const { data: nutrients } = await supabase
			.from("nutrients")
			.select("id, name, daily_value, unit")

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

		// FIX: Use absolute URL for Python function
		const baseUrl = process.env.VERCEL_URL 
			? `https://${process.env.VERCEL_URL}` 
			: 'http://localhost:3000';
		
		const pythonEndpoint = `${baseUrl}/api/analyze-symptoms`;

		console.log(`[ROUTE] Environment: ${process.env.VERCEL_ENV || 'local'}`);
		console.log(`[ROUTE] Calling Python backend at: ${pythonEndpoint}`);
		console.log(`[ROUTE] Sending symptoms: ${message.substring(0, 50)}...`);

		const response = await fetch(pythonEndpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				symptoms: message,
				user_intake: {
					nutrients: nutrientMap,
				},
			}),
		})

		// Enhanced error checking
		console.log(`[ROUTE] Python response status: ${response.status}`);
		
		if (!response.ok) {
			const errorBody = await response.text();
			console.error("[ROUTE] Python error response:", errorBody);
			throw new Error(`Backend analysis failed: ${response.status} - ${errorBody.substring(0, 200)}`);
		}

		const data = await response.json()
		console.log("[ROUTE] Successfully received analysis from Python backend");

		// Validate the response structure
		if (!data.analysis) {
			console.error("[ROUTE] Missing analysis in response:", data);
			throw new Error("Invalid response structure from Python backend");
		}

		return NextResponse.json({
			response: data.analysis,
			nutrients: data.recommended_nutrients || [],
			dietRecommendations: data.diet_recommendations || [],
		})
	} catch (error) {
		console.error("Chat API error:", error)
		
		// Return error details in development
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error("Full error:", errorMessage);

		// Return a more informative fallback
		return NextResponse.json({
			response: `I'm having trouble analyzing your symptoms right now (Error: ${errorMessage}). Based on common concerns, I recommend considering Vitamin D, B12, and Iron levels, as deficiencies in these are common and can cause fatigue. Please consult with a healthcare professional for personalized advice.`,
			nutrients: ["Vitamin D", "Vitamin B12", "Iron", "Magnesium"],
			dietRecommendations: [
				"Include leafy greens like spinach and kale",
				"Add fatty fish like salmon for Omega-3s",
				"Incorporate citrus fruits for Vitamin C",
				"Consider fortified cereals or supplements",
			],
		})
	}
}
