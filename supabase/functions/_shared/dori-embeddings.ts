// Embedding helper.
//
// One entry point so every edge function uses the same provider, model,
// and dimension. Mixing dims would corrupt the IVFFlat index — so the
// dimension is locked to 768 and asserted at runtime.
//
// Provider chain:
//   1. Lovable AI gateway (preferred — same key the rest of Dori uses).
//   2. Direct Gemini (fallback when LOVABLE_API_KEY is absent).
//
// Returns L2-normalised vectors so cosine == dot product downstream.

const EMBED_DIM = 768;
const EMBED_MODEL = 'google/text-embedding-004';

export interface EmbeddingResult {
  vector: number[];
  model: string;
  dim: number;
}

export async function embedText(text: string): Promise<EmbeddingResult> {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim().slice(0, 8000);
  if (!cleaned) {
    throw new Error('embedText: empty input');
  }

  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  const geminiKey = Deno.env.get('GEMINI_API_KEY');

  if (lovableKey) {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: cleaned }),
    });
    if (res.ok) {
      const data = await res.json();
      const vec = data?.data?.[0]?.embedding as number[] | undefined;
      if (Array.isArray(vec) && vec.length === EMBED_DIM) {
        return { vector: l2Normalise(vec), model: EMBED_MODEL, dim: EMBED_DIM };
      }
      // Some gateway responses come back at native dimensionality
      // (e.g. 3072 for OpenAI-style text-embedding-3-large). Reduce
      // to EMBED_DIM via Matryoshka truncation + renormalise.
      if (Array.isArray(vec) && vec.length > EMBED_DIM) {
        return { vector: l2Normalise(vec.slice(0, EMBED_DIM)), model: EMBED_MODEL, dim: EMBED_DIM };
      }
      console.warn('[embedText] Lovable returned unexpected shape, falling back', {
        len: Array.isArray(vec) ? vec.length : 'n/a',
      });
    } else {
      console.warn('[embedText] Lovable embedding failed', res.status, await res.text().catch(() => ''));
    }
  }

  if (geminiKey) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text: cleaned }] },
          taskType: 'RETRIEVAL_DOCUMENT',
        }),
      },
    );
    if (res.ok) {
      const data = await res.json();
      const vec = data?.embedding?.values as number[] | undefined;
      if (Array.isArray(vec) && vec.length === EMBED_DIM) {
        return { vector: l2Normalise(vec), model: 'gemini/text-embedding-004', dim: EMBED_DIM };
      }
    }
    console.warn('[embedText] Gemini embedding failed', res.status);
  }

  throw new Error('embedText: no embedding provider configured (need LOVABLE_API_KEY or GEMINI_API_KEY)');
}

// pgvector accepts both array and stringified-vector literals, but
// the JS client serialises arrays as arrays, which the bigint-friendly
// JSON path can mangle. The string literal form is unambiguous.
export function toPgVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

function l2Normalise(v: number[]): number[] {
  let sumSq = 0;
  for (const x of v) sumSq += x * x;
  const norm = Math.sqrt(sumSq) || 1;
  return v.map((x) => x / norm);
}

export const EMBEDDING_DIM = EMBED_DIM;
