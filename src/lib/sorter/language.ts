/**
 * Portuguese detection, by hand.
 *
 * A language-detection dependency would be a lot of bytes for one badge. The inputs here are
 * bookmark titles — short, noisy, often padded with an English site name ("… | UX Collective") —
 * which is a bad case for statistical detectors anyway. Stopwords plus a couple of
 * Portuguese-specific signals do better on this shape of text, and cost nothing.
 */

/**
 * Portuguese function words, weighted by how much seeing one actually tells you.
 *
 * Counting stopwords equally does not work here, because "a", "as", "e", "do" and "no" are
 * ordinary English words: "How to Agree Ways of Working **as a** Product Team" scores exactly as
 * high as "Iniciativas **do** time **de** design". Weighting separates them — three weak hits
 * stay below the line, one strong hit plus a weak one clears it.
 */
const STRONG_STOPWORDS = new Set([
  "às", "com", "como", "da", "das", "de", "dos", "em", "essa", "esse", "esta", "este", "eu",
  "foi", "isso", "já", "mais", "mas", "muito", "na", "nas", "não", "ou", "para", "pela", "pelo",
  "por", "qual", "quando", "que", "quem", "sem", "ser", "seu", "seus", "sua", "suas", "são",
  "só", "também", "tem", "uma", "você", "vocês", "é", "sobre", "entre", "cada", "pode", "onde",
]);

/** Also everyday English words. Real evidence, but only in aggregate. */
const WEAK_STOPWORDS = new Set(["a", "as", "ao", "aos", "do", "e", "no", "nos", "o", "os", "se", "um"]);

const STRONG_WEIGHT = 1;
const WEAK_WEIGHT = 0.35;
/** Per unit of stopword weight, capped so a long title cannot run away with the score. */
const STOPWORD_RATE = 0.22;
const STOPWORD_CAP = 0.6;

/** Words that are unmistakably Portuguese in a design context. */
const MARKERS = new Set([
  "design", // never counted alone — see below
  "conteúdo", "usuário", "usuários", "pesquisa", "pesquisas", "produto", "produtos", "prática",
  "práticas", "ferramentas", "recursos", "princípios", "acessibilidade", "hipóteses", "hipótese",
  "guia", "artigos", "aprendizado", "entrevista", "entrevistas", "métricas", "gestão", "processo",
  "experiência", "negócio", "negócios", "cultura", "começar", "fazer", "criar", "melhorar",
  "documentar", "planejamento", "roteiro", "teste", "testes", "usabilidade", "iniciativas",
]);

/**
 * ã, õ and ç are effectively Portuguese-only among the languages these bookmarks contain.
 * On its own an accent never crosses the line — it needs a stopword hit alongside it, which is
 * what keeps a title like "…by Huī Lí" from picking up a badge for someone's name.
 */
const STRONG_ACCENTS = /[ãõç]/;
/** Acutes and circumflexes show up in transliterated names and loanwords too — weaker evidence. */
const WEAK_ACCENTS = /[áéíóúâêô]/;

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{Letter}]+/u)
    .filter(Boolean);
}

export type LanguageGuess = {
  isPortuguese: boolean;
  /** Rough confidence, 0–1. Exposed for tuning; the UI only reads `isPortuguese`. */
  score: number;
  reasons: string[];
};

/**
 * Guesses whether a bookmark is Portuguese from its title and URL.
 *
 * "design" is in both languages, so it is deliberately never enough on its own — a title like
 * "Design systems at scale" must not pick up a PT badge.
 */
export function detectPortuguese(title: string, url: string): LanguageGuess {
  const reasons: string[] = [];
  let score = 0;

  const titleWords = words(title);
  const markerHits = titleWords.filter(
    (word) => word !== "design" && MARKERS.has(word),
  );

  let stopWeight = 0;
  const stopHits: string[] = [];
  for (const word of titleWords) {
    if (STRONG_STOPWORDS.has(word)) {
      stopWeight += STRONG_WEIGHT;
      stopHits.push(word);
    } else if (WEAK_STOPWORDS.has(word)) {
      stopWeight += WEAK_WEIGHT;
      stopHits.push(word);
    }
  }
  if (stopWeight > 0) {
    score += Math.min(STOPWORD_CAP, STOPWORD_RATE * stopWeight);
    reasons.push(`stopwords: ${stopHits.slice(0, 4).join(", ")}`);
  }

  if (markerHits.length > 0) {
    score += 0.35;
    reasons.push(`words: ${markerHits.slice(0, 3).join(", ")}`);
  }

  if (STRONG_ACCENTS.test(title)) {
    score += 0.4;
    reasons.push("ã/õ");
  } else if (WEAK_ACCENTS.test(title)) {
    score += 0.15;
    reasons.push("accents");
  }

  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    host = "";
  }
  if (host.endsWith(".br")) {
    score += 0.5;
    reasons.push(".br domain");
  }
  // Medium and LinkedIn slugs carry the title, so percent-encoded PT accents show up there too.
  if (/%C3%[A3B5]/i.test(url)) {
    score += 0.3;
    reasons.push("encoded ã/õ in URL");
  }

  return { isPortuguese: score >= 0.5, score: Math.min(1, score), reasons };
}
