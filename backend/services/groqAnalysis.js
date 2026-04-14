const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

/**
 * Build a distance label from km value.
 */
function distanceLabel(km) {
  if (km == null) return "No Location Data";
  if (km < 1)  return `${(km * 1000).toFixed(0)}m — Very Close (Same Area)`;
  if (km < 5)  return `${km.toFixed(1)}km — Nearby (Plausible Match)`;
  if (km < 20) return `${km.toFixed(1)}km — Moderate Distance`;
  return `${km.toFixed(1)}km — Far (Unlikely Same Sighting)`;
}

/**
 * Human-readable Re-ID similarity interpretation.
 */
function reidInterpretation(score) {
  const pct = Math.round(score * 100);
  if (pct >= 80) return `${pct}% — Very Strong visual match. The body shape, clothing texture, color profile, and overall silhouette are highly consistent. This is a strong Re-ID signal.`;
  if (pct >= 60) return `${pct}% — Moderate visual match. Several visual features align (build, posture, clothing tone), but some differences detected in texture/color details. Worth investigating.`;
  if (pct >= 40) return `${pct}% — Weak match. Some general similarities (e.g. similar clothing type), but significant visual differences in body proportions, color patterns, or accessories.`;
  return `${pct}% — Very Weak. The persons appear visually distinct. Different clothing, body build, or overall appearance detected by the neural network.`;
}

/**
 * Analyse search results using Groq LLM.
 */
async function analyzeSearchResults(probeAttrs, results) {
  if (!results || results.length === 0) return [];

  const probeSection = probeAttrs
    ? `PROBE IMAGE ATTRIBUTES:
  Gender: ${probeAttrs.gender || "Unknown"}
  Age: ${probeAttrs.age || "Unknown"}
  Upper Clothing: ${probeAttrs.upperBodyClothing || "Unknown"}
  Lower Clothing: ${probeAttrs.lowerBodyClothing || "Unknown"}
  Hat: ${probeAttrs.hasHat ? "Yes" : "No"}
  Glasses: ${probeAttrs.hasGlasses ? "Yes" : "No"}
  Bag: ${probeAttrs.hasBag ? "Yes" : "No"}
  Backpack: ${probeAttrs.hasBackpack ? "Yes" : "No"}
  Shoulder Bag: ${probeAttrs.hasShoulderBag ? "Yes" : "No"}
  Hand Bag: ${probeAttrs.hasHandBag ? "Yes" : "No"}
  Boots: ${probeAttrs.wearingBoots ? "Yes" : "No"}
  Orientation: ${probeAttrs.orientation || "Unknown"}
  Upper Pattern: ${probeAttrs.upperBodyPattern || "Plain"}
  Lower Pattern: ${probeAttrs.lowerBodyPattern || "Plain"}
  Confidence: ${probeAttrs.confidence ? Math.round(probeAttrs.confidence * 100) + "%" : "Unknown"}`
    : "PROBE IMAGE: No attributes available";

  const caseSections = results.map((r, i) => {
    const attrs = r.attributes || {};
    const reidPct = Math.round((r.reidScore || 0) * 100);
    const reidExplain = reidInterpretation(r.reidScore || 0);
    return `
CASE #${i + 1}: ${r.name || "Unknown"} (ID: ${r.caseId})
  ── Score Breakdown ──
  Re-ID Score: ${reidPct}% (OSNet 512-dim visual embedding cosine similarity)
  Re-ID Meaning: ${reidExplain}
  Attribute Score: ${Math.round((r.attributeScore || 0) * 100)}% (PA-100K attribute match)
  Location Score: ${Math.round((r.locationScore || 0) * 100)}%
  Fusion Score: ${Math.round((r.fusionScore || 0) * 100)}% (weighted combination)
  ── Location ──
  Distance: ${r.distanceKm != null ? r.distanceKm + " km" : "No coordinates available"}
  Distance Label: ${distanceLabel(r.distanceKm)}
  Last Seen Location: ${r.lastSeenLocation || "Unknown"}
  ── Case Attributes ──
  Gender: ${attrs.gender || r.gender || "Unknown"}
  Age: ${attrs.age || r.age || "Unknown"}
  Upper Clothing: ${attrs.upperBodyClothing || "Unknown"}
  Lower Clothing: ${attrs.lowerBodyClothing || "Unknown"}
  Hat: ${attrs.hasHat ? "Yes" : "No"}
  Glasses: ${attrs.hasGlasses ? "Yes" : "No"}
  Bag: ${attrs.hasBag ? "Yes" : "No"}`;
  }).join("\n");

  const prompt = `You are a senior forensic analyst AI assistant for GuardianEye — a Missing Person Identification System. You analyze multi-modal search results and provide expert assessments on whether each matched case could be the same person as the probe image.

UNDERSTANDING THE SCORES:
- Re-ID Score (OSNet): A 512-dimensional neural network embedding that captures visual appearance — body shape, clothing texture, color patterns, silhouette. Higher scores mean the visual appearance is more similar across camera views. >70% is strong, 50-70% is moderate, <50% is weak.
- Attribute Score (PA-100K): Comparison of 26 pedestrian attributes (gender, age, clothing type, accessories). Uses weighted matching where gender and clothing type matter more than minor accessories.
- Location Score: Based on Haversine distance between search coordinates and last-seen coordinates. <1km is very strong, 1-5km is plausible, >20km is unlikely for recent sightings.
- Fusion Score: Weighted combination (40% Re-ID + 30% Attributes + 30% Location).

${probeSection}

MATCHED CASES:
${caseSections}

For EACH case, provide a detailed JSON analysis with these fields:
- "caseId": the case ID
- "likelihood": "HIGH", "MEDIUM", or "LOW"
- "verdict": A single decisive sentence: "Likely the SAME person" or "Likely DIFFERENT persons" or "Inconclusive — requires further investigation"
- "reasoning": 3-4 sentences of forensic reasoning. Mention specific matching and non-matching attributes. Explain what the Re-ID score means in human terms (e.g., "The 72% Re-ID score indicates matching body build and similar clothing color/texture patterns detected by the neural network").
- "reidExplanation": 1-2 sentences explaining ONLY the Re-ID embedding comparison in plain language — what visual features the neural network likely picked up on (body shape, clothing color, pose similarity etc.)
- "locationAnalysis": 1-2 sentences about location plausibility — could the person have traveled this distance? Is the location consistent?
- "keyMatches": array of matching attribute names
- "keyMismatches": array of non-matching attribute names
- "overallSummary": One line summary for a quick glance (e.g., "Strong candidate — matching gender, clothing, and nearby location")

Respond with ONLY a valid JSON array. No markdown, no code blocks, no extra text.
[{"caseId":"MP-001","likelihood":"HIGH","verdict":"...","reasoning":"...","reidExplanation":"...","locationAnalysis":"...","keyMatches":["gender"],"keyMismatches":["hat"],"overallSummary":"..."}]`;

  try {
    console.log("[Groq] Sending prompt to", MODEL, "—", results.length, "cases");
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: MODEL,
      temperature: 0.3,
      max_tokens: 3000,
    });

    const raw = completion.choices[0]?.message?.content || "[]";
    console.log("[Groq] Raw response length:", raw.length);

    let jsonStr = raw.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) jsonStr = arrayMatch[0];

    const analysis = JSON.parse(jsonStr);
    console.log("[Groq] Parsed", Array.isArray(analysis) ? analysis.length : 0, "verdicts");
    return Array.isArray(analysis) ? analysis : [];
  } catch (err) {
    console.error("[Groq] Analysis error:", err.message);
    console.error("[Groq] Full error:", err);
    return results.map(r => ({
      caseId: r.caseId,
      likelihood: "UNKNOWN",
      verdict: "Analysis unavailable",
      reasoning: "AI analysis unavailable — " + err.message,
      reidExplanation: reidInterpretation(r.reidScore || 0),
      locationAnalysis: distanceLabel(r.distanceKm),
      keyMatches: [],
      keyMismatches: [],
      overallSummary: "Could not reach AI service",
    }));
  }
}

/**
 * Analyse Re-ID gallery matches (new Re-ID system).
 */
async function analyzeReidResults(matches) {
  if (!matches || matches.length === 0) return null;

  const caseLines = matches
    .map((m, i) =>
      `Match #${i + 1}: person_id="${m.person_id}" | similarity=${(m.similarity * 100).toFixed(1)}% | image_path="${m.image_path}"`
    )
    .join('\n');

  const prompt = `You are a forensic AI assistant for a Person Re-Identification system.
A query image was compared against a gallery using OSNet deep Re-ID (512-dim cosine similarity).

GALLERY MATCHES (ranked by similarity):
${caseLines}

For each match, return a JSON object with:
- "person_id": string
- "likelihood": "HIGH" | "MEDIUM" | "LOW"  (>75% HIGH, 50-75% MEDIUM, <50% LOW)
- "verdict": one-sentence decision
- "explanation": 2-3 sentences explaining what the similarity score means visually (body build, clothing texture, color patterns captured by the neural network)
- "recommendation": short action recommendation (e.g. "Verify with additional camera angles")

Respond with ONLY a valid JSON array. No markdown, no extra text.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: MODEL,
      temperature: 0.2,
      max_tokens: 1500,
    });
    let raw = completion.choices[0]?.message?.content?.trim() || '[]';
    if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const arr = raw.match(/\[[\s\S]*\]/);
    return arr ? JSON.parse(arr[0]) : [];
  } catch (err) {
    console.error('[Groq] analyzeReidResults error:', err.message);
    return null;
  }
}

function _fmtStructured(label, s) {
  if (!s) return `${label}: (unknown)`;
  return `${label}: gender=${s.gender || '—'}; age=${s.age || '—'}; upper=${s.upperBodyClothing || '—'}; lower=${s.lowerBodyClothing || '—'}; hat=${s.hasHat ? 'yes' : 'no'}; glasses=${s.hasGlasses ? 'yes' : 'no'}; backpack=${s.hasBackpack ? 'yes' : 'no'}; bag=${s.hasBag ? 'yes' : 'no'}; boots=${s.wearingBoots ? 'yes' : 'no'}; orientation=${s.orientation || '—'}`;
}

/**
 * Multimodal (OSNet + PA-100K fusion) gallery match analysis.
 */
async function analyzeMultimodalMatches(matches, queryStructured) {
  if (!matches || matches.length === 0) return null;

  const probe = _fmtStructured('QUERY', queryStructured);

  const matchLines = matches.map((m, i) => {
    const fus = m.fusion_score ?? m.similarity ?? 0;
    const reid = m.reid_score ?? 0;
    const attr = m.attribute_score ?? 0;
    const s = m.structured_attributes || {};
    return `Match #${i + 1}: person_id="${m.person_id}" | fusion=${(fus * 100).toFixed(1)}% | reid=${(reid * 100).toFixed(1)}% | attr=${(attr * 100).toFixed(1)}% | image_path="${m.image_path}"
  ${_fmtStructured('  Gallery', s)}`;
  }).join('\n');

  const prompt = `You are a forensic AI assistant for GuardianEye multimodal person search.
Ranking uses weighted fusion: fusion_score = w_reid * OSNet cosine + w_attr * PA-100K attribute cosine (L2-normalized probability vectors).

${probe}

MATCHES (ranked by fusion score):
${matchLines}

For each match, return a JSON object with:
- "person_id": string (must match exactly)
- "likelihood": "HIGH" | "MEDIUM" | "LOW" (use fusion score: >0.75 HIGH, 0.5-0.75 MEDIUM, <0.5 LOW)
- "verdict": one-sentence decision comparing query vs gallery structured attributes and scores
- "explanation": 2-3 sentences on how OSNet appearance and PA-100K attributes support or weaken the match
- "recommendation": short next step (e.g. verify identity, collect more angles)

Respond with ONLY a valid JSON array. No markdown, no extra text.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: MODEL,
      temperature: 0.2,
      max_tokens: 2000,
    });
    let raw = completion.choices[0]?.message?.content?.trim() || '[]';
    if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const arr = raw.match(/\[[\s\S]*\]/);
    return arr ? JSON.parse(arr[0]) : [];
  } catch (err) {
    console.error('[Groq] analyzeMultimodalMatches error:', err.message);
    return null;
  }
}

/**
 * Analyse multimodal gallery matches (fusion of appearance, attributes, gait).
 */
async function analyzeMultimodalResults(matches, querySummary) {
  if (!matches || matches.length === 0) return null;

  const q =
    querySummary && typeof querySummary === 'object'
      ? JSON.stringify(querySummary, null, 2)
      : String(querySummary || '');

  const caseLines = matches
    .map((m, i) => {
      const fs = m.fusion_score != null ? (m.fusion_score * 100).toFixed(1) : 'n/a';
      const ap = m.appearance_score != null ? (m.appearance_score * 100).toFixed(1) : (m.similarity * 100).toFixed(1);
      const at = m.attribute_score != null ? (m.attribute_score * 100).toFixed(1) : 'n/a';
      const g = m.gait_score != null ? (m.gait_score * 100).toFixed(1) : 'n/a';
      return (
        `Match #${i + 1}: person_id="${m.person_id}" | fusion_score=${fs}% | ` +
        `appearance=${ap}% | attributes=${at}% | gait=${g}% | image_path="${m.image_path}"`
      );
    })
    .join('\n');

  const prompt = `You are a forensic AI assistant for a multimodal Person Re-Identification system.
The system fused three signals: (1) appearance — OSNet 512-dim cosine similarity, (2) attributes — PA-100K pedestrian attribute agreement, (3) gait — GaitSet embedding cosine similarity between query and candidate images.

QUERY STRUCTURED ATTRIBUTES (probe):
${q || 'Not provided'}

GALLERY MATCHES (ranked by fusion_score — weighted combination of appearance, attributes, gait):
${caseLines}

For each match, return a JSON object with:
- "person_id": string
- "likelihood": "HIGH" | "MEDIUM" | "LOW" (use fusion_score: >75% HIGH, 50-75% MEDIUM, <50% LOW)
- "verdict": one-sentence decision
- "explanation": 2-3 sentences explaining fusion_score and how appearance vs attributes vs gait support or weaken the match
- "recommendation": short action recommendation

Mention fusion_score explicitly and contrast appearance (visual embedding) with attribute agreement and gait where useful.

Respond with ONLY a valid JSON array. No markdown, no extra text.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: MODEL,
      temperature: 0.2,
      max_tokens: 2000,
    });
    let raw = completion.choices[0]?.message?.content?.trim() || '[]';
    if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const arr = raw.match(/\[[\s\S]*\]/);
    return arr ? JSON.parse(arr[0]) : [];
  } catch (err) {
    console.error('[Groq] analyzeMultimodalResults error:', err.message);
    return null;
  }
}

/**
 * Generate plain-language description of PA-100K attribute predictions.
 */
async function analyzeAttributes(attributes) {
  if (!attributes) return null;

  const attrLines = Object.entries(attributes)
    .filter(([, v]) => v.predicted)
    .map(([k, v]) => `${k}: ${(v.confidence * 100).toFixed(1)}%`)
    .join(', ');

  const prompt = `You are analyzing pedestrian attributes predicted by a PA-100K deep learning model.

PREDICTED ATTRIBUTES (confidence > 50%):
${attrLines || 'None predicted above threshold'}

Write a concise 2-3 sentence description of this person based on these predicted attributes.
Then write one sentence about which attributes have the highest confidence and are most reliable.
Return ONLY a JSON object: {"description": "...", "reliability": "..."}`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: MODEL,
      temperature: 0.3,
      max_tokens: 400,
    });
    let raw = completion.choices[0]?.message?.content?.trim() || '{}';
    if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const obj = raw.match(/\{[\s\S]*\}/);
    return obj ? JSON.parse(obj[0]) : null;
  } catch (err) {
    console.error('[Groq] analyzeAttributes error:', err.message);
    return null;
  }
}

/**
 * Analyse gait recognition results.
 */
async function analyzeGaitResults(matches, framesReceived) {
  if (!matches || matches.length === 0) return null;

  const matchLines = matches
    .map((m, i) =>
      `Match #${i + 1}: person_id="${m.person_id}" | similarity=${(m.similarity * 100).toFixed(1)}%`
    )
    .join('\n');

  const prompt = `You are a forensic AI assistant analyzing gait recognition results.
The system matched a walking silhouette sequence (${framesReceived} frames) against a gallery using SimpleGaitSet deep learning.

GAIT MATCHES:
${matchLines}

For each match, return a JSON object with:
- "person_id": string
- "confidence_level": "HIGH" | "MEDIUM" | "LOW"
- "assessment": 2 sentences assessing the match quality and what gait features likely matched (stride pattern, body silhouette, walking rhythm)
- "caveats": one-sentence caveat (e.g. clothing changes, camera angle, health conditions can affect gait)

Return ONLY a valid JSON array. No markdown, no extra text.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: MODEL,
      temperature: 0.2,
      max_tokens: 800,
    });
    let raw = completion.choices[0]?.message?.content?.trim() || '[]';
    if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const arr = raw.match(/\[[\s\S]*\]/);
    return arr ? JSON.parse(arr[0]) : [];
  } catch (err) {
    console.error('[Groq] analyzeGaitResults error:', err.message);
    return null;
  }
}

module.exports = {
  analyzeSearchResults,
  analyzeReidResults,
  analyzeMultimodalMatches,
  analyzeMultimodalResults,
  analyzeAttributes,
  analyzeGaitResults,
  distanceLabel,
  reidInterpretation,
};
