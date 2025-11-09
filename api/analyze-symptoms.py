from http.server import BaseHTTPRequestHandler
import json
import asyncio
import os
from google import genai
from google.genai.errors import APIError
from google.genai.types import Part

# --- Access the API Key from Environment Variables ---
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
# --------------------------------------------------

def _sync_generate_content(client, model, contents):
    """Executes the blocking API call synchronously."""
    if not client:
        raise Exception("Gemini client not initialized.")
        
    return client.models.generate_content(
        model=model,
        contents=contents
    )

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            # 🌟 VALIDATION: Ensure this is a symptom analysis request
            if 'symptoms' not in request_data:
                raise Exception("Missing 'symptoms' field - this endpoint is for symptom analysis only")
            
            if 'image' in request_data or 'food_name' in request_data:
                raise Exception("This endpoint is for symptom analysis, not food scanning")
            
            symptoms = request_data.get('symptoms', '')
            user_intake = request_data.get('user_intake', {})
            
            # Log what we received
            print(f"[SYMPTOM ANALYSIS] Processing symptoms: {symptoms[:100]}")
            print(f"[SYMPTOM ANALYSIS] User intake data present: {bool(user_intake)}")
            
            # --- Blocking call to the async function ---
            result = asyncio.run(analyze_symptoms(symptoms, user_intake))
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            error_msg = str(e)
            
            # Diagnostic printing for server logs
            print(f"[SYMPTOM ANALYSIS] Server error: {error_msg}")
            
            # Updated error check for the Gemini API Key
            if 'GEMINI_API_KEY' in error_msg or 'authentication' in error_msg:
                error_msg = "Gemini API Key error. Please check Vercel environment variables."
            
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            error_response = {
                'error': error_msg, 
                'analysis': 'Error analyzing symptoms. Please try again.'
            }
            self.wfile.write(json.dumps(error_response).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

# -----------------------------------------------------------------
## 🧠 Symptom Analysis Logic
# -----------------------------------------------------------------

async def analyze_symptoms(symptoms: str, user_intake: dict = None) -> dict:
    # --- Explicitly ensure the API Key is available ---
    if not GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY is not set in the environment.")
    
    print(f"[SYMPTOM ANALYSIS] Starting analysis for: '{symptoms[:50]}...'")
    
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)

        intake_context = ""
        if user_intake and user_intake.get('nutrients'):
            intake_context = "\n\nUser's Current Nutritional Intake (last 7 days):\n"
            for nutrient, data in user_intake.get('nutrients', {}).items():
                intake_context += f"- {nutrient}: {data.get('amount', 0)}{data.get('unit', '')} (Target: {data.get('target', 'N/A')})\n"

        prompt = f"""You are a compassionate AI nutritional assistant. A user describes their symptoms: "{symptoms}"

{intake_context}

Your task:
1. Analyze the symptoms in relation to their current nutritional intake (if provided)
2. Identify potential vitamin or nutrient deficiencies that could cause these symptoms
3. Compare their intake to recommended daily values
4. Provide specific, actionable dietary advice
5. Be empathetic and supportive

Important: 
- If intake data shows they're low in certain nutrients, mention this connection
- Suggest specific foods rich in the nutrients they're lacking
- Always remind them to consult healthcare professionals for serious concerns
- Keep your response conversational but informative

Provide a warm, helpful response (2-3 paragraphs) followed by specific recommendations."""

        # 🌟 CRITICAL: Pass prompt as string directly
        # The SDK will handle text content automatically
        contents = prompt
        
        print("[SYMPTOM ANALYSIS] Calling Gemini API with text-only content...")
        
        # Use asyncio.to_thread to run the blocking Gemini call
        response = await asyncio.to_thread(
            _sync_generate_content,
            client,
            "gemini-2.0-flash-exp",  # Updated to newer model
            contents
        )

        analysis_text = response.text
        
        print(f"[SYMPTOM ANALYSIS] Successfully received response: {len(analysis_text)} characters")
        
        return {
            "analysis": analysis_text,
            "recommended_nutrients": extract_nutrients(analysis_text),
            "diet_recommendations": extract_diet_recommendations(analysis_text)
        }

    except APIError as e:
        error_msg = str(e)
        print(f"[SYMPTOM ANALYSIS] Gemini API Error: {error_msg}")
        
        # Check if this is the image error
        if "image" in error_msg.lower() or "INVALID_ARGUMENT" in error_msg:
            raise Exception("Received image-related error - wrong endpoint may have been called")
        
        raise Exception(f"Analysis failed due to Gemini API error: {error_msg}")
    except Exception as e:
        print(f"[SYMPTOM ANALYSIS] Analysis error: {str(e)}") 
        raise Exception(f"Analysis failed: {str(e)}")

# -----------------------------------------------------------------
## 🛠️ Helper Functions 
# -----------------------------------------------------------------

def extract_nutrients(text: str) -> list:
    common_nutrients = [
        "Vitamin D", "Vitamin B12", "Vitamin C", "Vitamin A", "Vitamin E",
        "Iron", "Magnesium", "Calcium", "Zinc", "Potassium",
        "Omega-3", "Folate", "Vitamin B6"
    ]
    
    found = []
    text_lower = text.lower()
    for nutrient in common_nutrients:
        if nutrient.lower() in text_lower:
            found.append(nutrient)
    
    return found[:5]

def extract_diet_recommendations(text: str) -> list:
    sentences = text.split('.')
    recommendations = []
    
    food_keywords = ['eat', 'food', 'diet', 'consume', 'include', 'rich in', 'source']
    
    for sentence in sentences:
        if any(keyword in sentence.lower() for keyword in food_keywords):
            clean = sentence.strip()
            if clean and len(clean) > 20:
                recommendations.append(clean)
    
    return recommendations[:4]
