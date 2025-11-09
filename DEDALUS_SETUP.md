# Dedalus Labs Setup Guide

This guide explains what you need to configure in your Dedalus Labs account to make the nutrition tracking app work properly.

## Overview

Your app uses Dedalus Labs to run AI agents with access to external data sources through MCP (Model Context Protocol) servers. You need to configure MCP servers in your Dedalus account.

## Required MCP Servers

### 1. **Brave Search MCP** (for symptom analysis)
- **Purpose**: Allows the AI to search for medical/nutritional information about symptoms
- **How to add**: 
  1. Log in to [Dedalus Labs Console](https://console.dedaluslabs.ai)
  2. Go to "MCP Servers" section
  3. Click "Add Server"
  4. Select "Brave Search" from the marketplace
  5. Configure with your Brave Search API key (get from https://brave.com/search/api/)

### 2. **Custom Nutrition Data MCP** (for food analysis)
- **Purpose**: Provides access to USDA FoodData Central API for nutritional information
- **Type**: Custom HTTP MCP server

You have two options:

#### Option A: Use USDA API directly (Recommended)
The app already has built-in USDA API integration. You don't need an MCP server for this.

Your `FDC_API_KEY` environment variable is already set up.

#### Option B: Create a custom MCP server
If you want to use Dedalus for the USDA API:

1. Create a new custom MCP server in Dedalus console
2. Configure it to call: `https://api.nal.usda.gov/fdc/v1/`
3. Add the following endpoints:
   - `foods/search` - Search for foods
   - `food/{fdcId}` - Get detailed food info

## Current Python Backend Configuration

Your Python backend files use these MCP servers:

### analyze-symptoms.py
\`\`\`python
mcp_servers=["windsor/brave-search-mcp"]  # For searching symptom information
\`\`\`

### scan-food.py
Uses direct API calls to USDA FoodData Central (no MCP needed)

## Environment Variables Needed

Make sure these are set in your Vercel project:

\`\`\`bash
DEDALUS_API_KEY=your_dedalus_api_key_here
FDC_API_KEY=your_usda_fdc_api_key_here
\`\`\`

## Testing Your Setup

### Test 1: Symptom Analysis
1. Go to your app homepage
2. Type: "I feel tired and have brain fog"
3. The AI should:
   - Search for information about these symptoms
   - Reference your current nutritional intake from the database
   - Suggest specific nutrients you might be lacking

### Test 2: Food Scanner
1. Go to the scanner page
2. Upload or capture a food image
3. The system should:
   - Extract individual food items using Gemini
   - Look up each food in USDA database
   - Return detailed nutritional information
   - If not in USDA, use LLM to estimate nutrients

## Troubleshooting

### "No MCP servers found" error
- Make sure you've added Brave Search MCP in your Dedalus console
- Verify the server name is exactly `windsor/brave-search-mcp`

### "API key invalid" error
- Check your `DEDALUS_API_KEY` in Vercel environment variables
- Regenerate the key from Dedalus console if needed

### Food scanner returns incomplete data
- Verify `FDC_API_KEY` is set correctly
- Check Vercel logs for USDA API errors
- The app will fall back to LLM estimation if USDA fails

## Alternative: Without Dedalus MCP Servers

If you don't want to set up MCP servers, you can modify the Python files to use direct API calls:

1. For symptom analysis: Use OpenAI/Anthropic directly instead of Dedalus
2. For food scanning: Already uses direct USDA API calls (no changes needed)

Would you like me to create a version that doesn't require MCP servers?
