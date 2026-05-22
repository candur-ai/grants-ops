import Anthropic from '@anthropic-ai/sdk';

let client = null;

function getClient() {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// Scoring rubric system prompt (from modes/_shared.md)
const SCORING_SYSTEM_PROMPT = `You are an expert grant evaluator for nonprofit organizations. You evaluate federal grant opportunities against an organization's profile using a structured methodology.

## Eligibility Gate (pass/fail — runs BEFORE scoring)

| Check | Pass Condition |
|-------|----------------|
| Entity type eligible | Org's type in NOFO eligibility list |
| SAM.gov registration | Status = active |
| UEI present | Non-empty |
| Geographic match | Org in eligible area |
| Deadline not passed | Deadline > today |

If ANY check fails → Score: 0.0/5, Status: SKIP. Do not proceed to scoring.

## Scoring Dimensions (only if eligibility passes)

| Dimension | Weight | What to assess |
|-----------|--------|----------------|
| Mission Alignment | 30% | How closely org's mission maps to grant objectives |
| Competitive Position | 25% | Likelihood of winning (past performance, geographic advantage, partnerships) |
| Feasibility | 20% | Can the org execute? (timeline, staff, capacity) |
| Financial Fit | 15% | Budget alignment, cost share burden, indirect rate |
| Strategic Value | 10% | Agency relationship building, mission advancement |

Global Score = weighted average, 1.0–5.0 scale.

## Output Format

You MUST respond with valid JSON in this exact structure:
{
  "eligibility": {
    "passed": boolean,
    "checks": [
      { "name": "Entity type eligible", "passed": boolean, "detail": "explanation" },
      { "name": "SAM.gov registration", "passed": boolean, "detail": "explanation" },
      { "name": "UEI present", "passed": boolean, "detail": "explanation" },
      { "name": "Geographic match", "passed": boolean, "detail": "explanation" },
      { "name": "Deadline not passed", "passed": boolean, "detail": "explanation" }
    ]
  },
  "scores": {
    "mission_alignment": { "score": number, "rationale": "..." },
    "competitive_position": { "score": number, "rationale": "..." },
    "feasibility": { "score": number, "rationale": "..." },
    "financial_fit": { "score": number, "rationale": "..." },
    "strategic_value": { "score": number, "rationale": "..." }
  },
  "global_score": number,
  "status": "Evaluated" | "SKIP",
  "recommendation": "Don't Apply" | "Marginal" | "Apply" | "Strong Apply",
  "summary": "2-3 sentence summary",
  "report_md": "Full markdown report body with ## sections: Grant Summary, Eligibility Analysis, Scoring Breakdown, Recommendation, Next Steps"
}

If eligibility fails, set global_score to 0.0, status to "SKIP", and still provide the full report explaining why.
Scores below 3.0 → "Don't Apply". 3.0-3.9 → "Marginal". 4.0-4.4 → "Apply". 4.5+ → "Strong Apply".`;

export async function evaluateGrant(opportunity, orgProfile, onChunk) {
  const anthropic = getClient();

  const orgContext = `## Organization Profile
- Name: ${orgProfile.legal_name}
- Entity Type: ${orgProfile.entity_type}
- EIN: ${orgProfile.ein || 'PENDING'}
- UEI: ${orgProfile.uei || 'PENDING'}
- SAM Status: ${orgProfile.sam_registration?.status || 'not_registered'}
- State: ${orgProfile.address?.state || 'Unknown'}
- Founded: ${orgProfile.founded_year || 'Unknown'}
- Staff: ${orgProfile.staff_size || 0}
- Annual Budget: $${orgProfile.annual_budget || 0}
- Mission: ${orgProfile.narrative?.mission || 'Not provided'}
- Differentiator: ${orgProfile.narrative?.differentiator || 'Not provided'}
- Focus Areas: ${orgProfile.target_grants?.focus_areas?.join(', ') || 'Not specified'}
- Past Performance: ${JSON.stringify(orgProfile.past_performance || [])}

## Deal-Breakers & Custom Profile
${orgProfile.profile_md || 'No custom profile set.'}`;

  const userMessage = `Evaluate this grant opportunity for the organization described above.

## Opportunity Details
${JSON.stringify(opportunity, null, 2)}

Today's date: ${new Date().toISOString().split('T')[0]}

Perform the full evaluation: eligibility gate first, then scoring if eligible. Return the JSON response.`;

  if (onChunk) {
    // Streaming mode
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: [
        { type: 'text', text: SCORING_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: orgContext }
      ],
      messages: [{ role: 'user', content: userMessage }],
    });

    let fullText = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.text) {
        fullText += event.delta.text;
        onChunk({ type: 'text', text: event.delta.text });
      }
    }
    onChunk({ type: 'done', text: fullText });
    return fullText;
  } else {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: [
        { type: 'text', text: SCORING_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: orgContext }
      ],
      messages: [{ role: 'user', content: userMessage }],
    });

    return response.content[0].text;
  }
}

export async function generateNarrative(section, opportunity, orgProfile, reportMd, instructions) {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: `You are an expert grant writer. Generate compelling, specific narrative sections for federal grant applications. Write in a professional but engaging tone. Be concrete and specific — avoid generic filler. Every claim should be backed by evidence from the organization's profile.`,
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [{
      role: 'user',
      content: `Generate the "${section}" section for this grant application.

## Organization
${JSON.stringify(orgProfile, null, 2)}

## Grant Opportunity
${JSON.stringify(opportunity, null, 2)}

## Evaluation Report
${reportMd}

${instructions ? `## Additional Instructions\n${instructions}` : ''}

Write the narrative section. Be specific to this organization and this grant. Target 250-500 words unless the section warrants more.`
    }],
  });

  return response.content[0].text;
}

export async function buildBudget(opportunity, orgProfile, parameters) {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: [{
      type: 'text',
      text: `You are an expert grant budget builder. Create realistic, defensible SF-424A budgets for federal grants. Use the organization's budget defaults for rates. Return a structured JSON budget.

Output JSON format:
{
  "total_federal": number,
  "total_cost_share": number,
  "total_project": number,
  "period_months": number,
  "line_items": [
    {
      "category": "Personnel" | "Fringe Benefits" | "Travel" | "Equipment" | "Supplies" | "Contractual" | "Other" | "Indirect Costs",
      "items": [
        { "description": "...", "quantity": number, "unit_cost": number, "federal": number, "cost_share": number, "justification": "..." }
      ],
      "subtotal_federal": number,
      "subtotal_cost_share": number
    }
  ]
}`,
      cache_control: { type: 'ephemeral' }
    }],
    messages: [{
      role: 'user',
      content: `Build a budget for this grant application.

## Organization Budget Defaults
${JSON.stringify(orgProfile.budget_defaults, null, 2)}

## Organization Details
- Staff size: ${orgProfile.staff_size || 0}
- Annual budget: $${orgProfile.annual_budget || 0}
- Indirect cost rate: ${orgProfile.compliance?.indirect_cost_rate?.rate || 10}% (${orgProfile.compliance?.indirect_cost_rate?.type || 'de_minimis_10'})

## Grant Opportunity
${JSON.stringify(opportunity, null, 2)}

## Parameters
${JSON.stringify(parameters, null, 2)}

Build a realistic, defensible budget. Return JSON only.`
    }],
  });

  return response.content[0].text;
}
