import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, query, recipeName, dietaryPreferences } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "suggest") {
      systemPrompt = `You are a helpful culinary assistant. Suggest 5 recipe ideas based on the user's query. 
Return JSON with this exact structure:
{
  "suggestions": [
    {
      "name": "Recipe Name",
      "description": "Brief description",
      "category": "main|breakfast|side|soup|salad|dessert|snack|drink",
      "prepTime": 15,
      "cookTime": 30
    }
  ]
}`;
      userPrompt = `Suggest recipes for: ${query}${dietaryPreferences ? `. Dietary preferences: ${dietaryPreferences}` : ''}`;
    } else if (type === "fill") {
      systemPrompt = `You are a culinary expert. Given a recipe name, provide complete recipe details.
Return JSON with this exact structure:
{
  "recipe": {
    "name": "Recipe Name",
    "description": "Brief appetizing description",
    "category": "main|breakfast|side|soup|salad|dessert|snack|drink",
    "servings": 4,
    "prepTime": 15,
    "cookTime": 30,
    "instructions": "Step-by-step instructions with numbered steps",
    "ingredients": [
      { "name": "Ingredient", "quantity": "2", "unit": "cups", "category": "produce|dairy|meat|pantry|frozen|other" }
    ]
  }
}`;
      userPrompt = `Provide a complete recipe for: ${recipeName}${dietaryPreferences ? `. Dietary preferences: ${dietaryPreferences}` : ''}`;
    } else if (type === "explore") {
      systemPrompt = `You are a creative culinary assistant. Suggest unique and interesting recipe ideas.
Return JSON with this exact structure:
{
  "suggestions": [
    {
      "name": "Recipe Name",
      "description": "Brief appetizing description",
      "category": "main|breakfast|side|soup|salad|dessert|snack|drink",
      "prepTime": 15,
      "cookTime": 30,
      "cuisine": "Italian|Mexican|Asian|etc"
    }
  ]
}`;
      userPrompt = `Suggest 5 interesting and creative recipe ideas${query ? ` related to: ${query}` : ''}${dietaryPreferences ? `. Dietary preferences: ${dietaryPreferences}` : ''}. Include a mix of cuisines and categories.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add more credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content in AI response");
    }

    const parsed = JSON.parse(content);
    
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Recipe assistant error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
