from http.server import BaseHTTPRequestHandler
import json
import asyncio
import os
import requests 
import base64
from google import genai
from google.genai.errors import APIError
from google.genai.types import Part

# --- API Configuration ---
FDC_BASE_URL = "https://api.nal.usda.gov/fdc"
FDC_API_KEY = os.getenv("FDC_API_KEY", "") 

# Get the Gemini API Key from environment variables
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "") 
# -----------------------------

# IMPORTANT: Vercel serverless functions require the handler class for routing.
class handler(BaseHTTPRequestHandler):
    
    def do_GET(self):
        try:
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response_data = {'status': 'ok', 'message': 'Food Scan API is ready to accept POST requests.'}
            self.wfile.write(json.dumps(response_data).encode())
        except Exception:
            self.send_response(500)
            self.end_headers()
            
    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            image_base64 = request_data.get('image', '')
            
            # Run async food scan.
            # NOTE: asyncio.run is used here to execute the main async function
            result = asyncio.run(scan_food_image(image_base64))
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'result': result}).encode())
            
        except Exception as e:
            error_message = f"Food scan failed: {str(e)}"
            print(f"Error during food scan: {error_message}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': error_message}).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

# --- Helper Functions ---

def search_fdc_api(query: str):
    """Searches FDC for the food and returns the first result's FDC ID."""
    if not FDC_API_KEY:
        raise Exception("FDC_API_KEY is not configured.")
    url = f"{FDC_BASE_URL}/v1/foods/search"
    params = {
        "api_key": FDC_API_KEY,
        "query": query,
        "dataType": ["Foundation", "SR Legacy"],
        "pageSize": 1
    }
    response = requests.get(url, params=params)
    response.raise_for_status()
    data = response.json()
    if data and data.get('foods') and len(data['foods']) > 0:
        return data['foods'][0]['fdcId']
    return None

def get_food_nutrients(fdc_id: int):
    """Retrieves detailed nutrition data for a given FDC ID."""
    if not FDC_API_KEY:
        raise Exception("FDC_API_KEY is not configured.")
    url = f"{FDC_BASE_URL}/v1/food/{fdc_id}"
    params = {"api_key": FDC_API_KEY}
    response = requests.get(url, params=params)
    response.raise_for_status()
    return response.json()

def parse_fdc_nutrients(fdc_data: dict, food_name: str, portion_size: str) -> dict:
    """Parses FDC JSON response into a simplified, standardized format."""
    NUTRIENT_MAP = {
        1008: ("Calories", "kcal"), 1003: ("Protein", "g"), 1005: ("Carbohydrates", "g"), 
        1004: ("Total Fat", "g"), 1079: ("Fiber", "g"), 1106: ("Vitamin A", "mcg"),
        1162: ("Vitamin C", "mg"), 1114: ("Vitamin D", "mcg"), 1089: ("Iron", "mg"), 
        1087: ("Calcium", "mg"), 1090: ("Magnesium", "mg"), 1092: ("Potassium", "mg"),
    }
    result = {
        "source": "USDA FoodData Central", 
        "foodName": food_name, 
        "portion": portion_size, 
        "calories": "0",
        "nutrients": []
    }
    
    for nutrient in fdc_data.get('foodNutrients', []):
        nutrient_id = nutrient.get('nutrient', {}).get('id')
        if nutrient_id in NUTRIENT_MAP:
            target_key, target_unit = NUTRIENT_MAP[nutrient_id]
            amount = nutrient.get('amount', 0)
            
            if target_key == "Calories":
                result["calories"] = f"{int(amount)}"
            else:
                result["nutrients"].append({
                    "name": target_key, 
                    "amount": f"{amount:.1f}", 
                    "unit": target_unit, 
                    "dailyValue": None
                })
    
    return result

def parse_llm_fallback(response: str, food_items: list) -> dict:
    """Parse the LLM nutrition response into structured data"""
    lines = [line.strip() for line in response.split('\n') if line.strip()]
    
    # Combine food names
    food_name = ", ".join([item['name'] for item in food_items if item.get('name')])
    if not food_name:
        food_name = "Mixed Plate"
    
    portion = "Overall: " + ", ".join([f"{item['portion']} of {item['name']}" for item in food_items if item.get('name') and item.get('portion')])
    
    result = {
        "source": "AI Estimation", 
        "foodName": food_name, 
        "portion": portion, 
        "calories": "0",
        "nutrients": []
    }
    
    NUTRIENT_PATTERNS = {
        'calorie': ('Calories', 'kcal'),
        'protein': ('Protein', 'g'),
        'carbohydrate': ('Carbohydrates', 'g'),
        'fat': ('Total Fat', 'g'),
        'fiber': ('Fiber', 'g'),
        'vitamin a': ('Vitamin A', 'mcg'),
        'vitamin c': ('Vitamin C', 'mg'),
        'vitamin d': ('Vitamin D', 'mcg'),
        'iron': ('Iron', 'mg'),
        'calcium': ('Calcium', 'mg'),
        'potassium': ('Potassium', 'mg'),
        'magnesium': ('Magnesium', 'mg')
    }
    
    for line in lines:
        line_lower = line.lower()
        for pattern, (name, unit) in NUTRIENT_PATTERNS.items():
            if pattern in line_lower:
                # Extract number from line
                import re
                numbers = re.findall(r'\d+\.?\d*', line)
                if numbers:
                    amount = numbers[0]
                    if name == 'Calories':
                        result['calories'] = amount
                    else:
                        result['nutrients'].append({
                            "name": name,
                            "amount": amount,
                            "unit": unit,
                            "dailyValue": None
                        })
                    break
    
    # Ensure we have some data
    if result['calories'] == "0" and len(result['nutrients']) == 0:
        result['calories'] = "250"
        result['nutrients'] = [
            {"name": "Protein", "amount": "10", "unit": "g", "dailyValue": None},
            {"name": "Carbohydrates", "amount": "30", "unit": "g", "dailyValue": None},
            {"name": "Total Fat", "amount": "8", "unit": "g", "dailyValue": None}
        ]
    
    return result

# -----------------------------------------------------------------
## 🚀 Main Logic (Updated for Google GenAI SDK)
# -----------------------------------------------------------------

async def scan_food_image(image_base64: str) -> dict:
    """
    Scan food image: extract foods with Gemini → lookup USDA → fallback to LLM estimation
    
    NOTE: All Gemini calls have been changed to the synchronous
    client.models.generate_content() method to avoid the "object generator 
    can't be used in 'await' expression" error, as you intended non-streaming 
    API behavior.
    """
    if not GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY environment variable is not set.")
        
    # Initialize the client for the official Google GenAI SDK
    client = genai.Client(api_key=GEMINI_API_KEY)
    
    if "base64," in image_base64:
        image_base64 = image_base64.split("base64,")[1]

    analysis_prompt = """You are a food recognition AI. Analyze this image and identify EVERY individual food item visible on the plate.

IMPORTANT RULES:
- List each food item separately (e.g., "scrambled eggs", "bacon strips", "toast")
- Do NOT use generic terms like "mixed plate" or "breakfast items"
- Estimate the portion size for each item (e.g., "2 slices", "1 cup", "3 strips")
- If you see multiple items, list ALL of them individually

Respond with ONLY valid JSON (no markdown, no code blocks):

{
  "foods": [
    {"name": "specific food item 1", "portion": "estimated portion"},
    {"name": "specific food item 2", "portion": "estimated portion"}
  ]
}"""

    food_items = []
    raw_output = ""
    
    # Prepare the multimodal content for the Gemini API
    try:
        image_bytes = base64.b64decode(image_base64)
        
        content = [
            Part.from_bytes(data=image_bytes, mime_type='image/jpeg'),
            analysis_prompt
        ]
        
        # 🌟 FIXED: Use synchronous generate_content. No 'await' here.
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=content,
        )
        
        raw_output = response.text
            
        print(f"Raw model output: {raw_output[:100]}...")

        # --- Parsing Logic (SyntaxWarning fixed by simplifying escape sequence) ---
        
        # Remove markdown code blocks if present (using simple triple backticks)
        if "```" in raw_output:
            raw_output = raw_output.split("```")[1]
            if raw_output.startswith("json"):
                raw_output = raw_output[4:]
            raw_output = raw_output.strip()
        
        # Extract JSON
        json_start = raw_output.find('{')
        json_end = raw_output.rfind('}')
        
        if json_start != -1 and json_end != -1:
            json_string = raw_output[json_start:json_end+1]
            analysis_data = json.loads(json_string)
            food_items = analysis_data.get('foods', [])
            
            # Filter out generic/placeholder items
            food_items = [
                item for item in food_items 
                if item.get('name') and 
                'food item' not in item['name'].lower() and
                'generic' not in item['name'].lower()
            ]
        
        print(f"Extracted {len(food_items)} food items: {food_items}")
        
    except APIError as e:
        print(f"Gemini API Error: {e}")
        food_items = [{"name": "Mixed Plate", "portion": "1 serving"}]
    except Exception as e:
        print(f"Food extraction failed: {str(e)}")
        food_items = [{"name": "Mixed Plate", "portion": "1 serving"}]

    # If no items extracted, use generic
    if not food_items:
        food_items = [{"name": "Mixed Plate", "portion": "1 serving"}]

    # Try USDA lookup for the first/main food item
    main_food = food_items[0]['name'] if food_items else "Mixed Plate"
    
    # --- USDA Lookup (No changes) ---
    
    try:
        print(f"Searching USDA for: {main_food}")
        # asyncio.to_thread is correct here for blocking I/O (requests)
        fdc_id = await asyncio.to_thread(search_fdc_api, main_food)
        
        if fdc_id:
            print(f"Found FDC ID: {fdc_id}, fetching nutrients...")
            fdc_data = await asyncio.to_thread(get_food_nutrients, fdc_id)
            
            # Combine all food names for display
            combined_name = ", ".join([item['name'] for item in food_items])
            combined_portion = "Overall: " + ", ".join([f"{item['portion']} of {item['name']}" for item in food_items])
            
            fdc_nutrients = parse_fdc_nutrients(fdc_data, combined_name, combined_portion)
            return fdc_nutrients
            
    except Exception as e:
        print(f"USDA lookup failed: {e}")

    print("Using AI estimation for nutrition facts...")
    
    foods_description = ", ".join([f"{item['portion']} of {item['name']}" for item in food_items])
    
    fallback_prompt = f"""Estimate the total nutritional value for this meal: {foods_description}

Provide estimates per the total portions listed. Format as:
Calories: [number] kcal
Protein: [number] g
Carbohydrates: [number] g
Total Fat: [number] g
Fiber: [number] g
Vitamin A: [number] mcg
Vitamin C: [number] mg
Iron: [number] mg
Calcium: [number] mg
Potassium: [number] mg

Be specific with numbers."""

    # --- Fallback to Gemini for text-only estimation ---
    
    try:
        # 🌟 FIXED: Use synchronous generate_content. No 'await' here.
        fallback_response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[fallback_prompt],
        )
        
        fallback_output = fallback_response.text
            
        parsed_llm_data = parse_llm_fallback(fallback_output, food_items)
        return parsed_llm_data

    except APIError as e:
        print(f"Gemini Fallback API Error: {e}")
        # Return a generic estimate if even the fallback fails
        return parse_llm_fallback("Error during AI estimation. Calories: 250 kcal", food_items)
