// Shared briefing news generator.
//
// Curates real, specific recent news for a set of topics via OpenAI and
// returns structured items with Google News search links. Extracted from the
// `morning-briefing` edge function so it can be reused by the scheduled
// `briefing-dispatch-cron` (which runs with the service role and therefore
// cannot carry an end-user JWT to call `morning-briefing` directly).

export interface NewsItem {
  headline: string;
  summary: string;
  category: string;
  url: string;
}

export interface NewsLocation {
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

function buildLocationContext(location?: NewsLocation | null): string {
  if (!location) return '';
  if (location.city && location.country) {
    return ` The user is located in ${location.city}, ${location.country}.`;
  }
  if (location.country) {
    return ` The user is located in ${location.country}.`;
  }
  if (location.latitude != null && location.longitude != null) {
    return ` The user's coordinates are approximately ${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}.`;
  }
  return '';
}

/**
 * Generate curated news items for the given topics.
 *
 * @param topics    Topics to cover. Falls back to general topics when empty.
 * @param location  Optional location context for localised news.
 * @param maxItems  Soft cap on the number of items to request (default 5).
 * @param apiKey    OpenAI API key. Defaults to the OPENAI_API_KEY env var.
 */
export async function generateNews(
  topics: string[],
  location?: NewsLocation | null,
  maxItems = 5,
  apiKey: string | undefined = Deno.env.get('OPENAI_API_KEY'),
): Promise<NewsItem[]> {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const topicsToSearch = (topics || []).map((t) => t.trim()).filter(Boolean).slice(0, 5);
  if (topicsToSearch.length === 0) {
    topicsToSearch.push('technology', 'business', 'productivity');
  }

  const topicsString = topicsToSearch.join(', ');
  const locationContext = buildLocationContext(location);
  const itemCount = Math.max(1, Math.min(maxItems || 5, 10));

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a news curator that provides REAL, SPECIFIC news from the last 24 hours. You must provide actual current events that happened recently, NOT generic topic summaries.

Focus on topics: ${topicsString}.${locationContext}

CRITICAL REQUIREMENTS:
1. Each news item must be a SPECIFIC real event/announcement (e.g., "OpenAI announces GPT-5 release date" NOT "AI continues to evolve")
2. Include company names, product names, or specific details
3. The searchQuery must be VERY SPECIFIC - include proper nouns, dates, or unique identifiers
4. Each searchQuery should be 3-8 words that would find the EXACT news article
5. Return at most ${itemCount} items, most important first

Format your response as a JSON array with objects containing:
- "headline": Specific headline with names/dates (max 100 chars)
- "summary": 1-2 sentences with specific details
- "category": The topic category
- "searchQuery": Highly specific search terms (e.g., "OpenAI GPT-5 December 2024" NOT "AI news")

Only return the JSON array, no other text.`,
        },
        {
          role: 'user',
          content: `What are the most important SPECIFIC news events and announcements in ${topicsString} from the last 24-48 hours?${locationContext} Today's date is ${new Date().toISOString().split('T')[0]}. Give me real headlines with company/product names.`,
        },
      ],
      temperature: 0.5,
      max_tokens: 700,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('OpenAI error:', errorData);
    throw new Error('Failed to fetch news from AI');
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';

  const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsedItems = JSON.parse(cleanContent) as Array<{
    headline: string;
    summary: string;
    category: string;
    searchQuery?: string;
  }>;

  return parsedItems.slice(0, itemCount).map((item) => ({
    headline: item.headline,
    summary: item.summary,
    category: item.category,
    url: `https://news.google.com/search?q=${encodeURIComponent(item.searchQuery || item.headline)}&hl=en`,
  }));
}
