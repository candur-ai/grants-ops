import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

function fallbackDebate({ idea, agentA, agentB, context }) {
  const a = agentA?.name || 'Agent A';
  const b = agentB?.name || 'Agent B';
  const lensA = agentA?.persona || 'optimistic builder';
  const lensB = agentB?.persona || 'skeptical operator';
  const evidence = (context || []).slice(0, 4).map((r) => r.title).filter(Boolean).join('; ') || 'No external search context was provided.';
  return {
    title: `Debate: ${idea}`,
    rounds: [
      { speaker: a, stance: lensA, text: `The strongest case for this idea is that it can convert scattered research into a concrete action path. The search context points toward ${evidence}, which suggests there is enough signal to form a testable thesis.` },
      { speaker: b, stance: lensB, text: `The risk is mistaking retrieved material for validation. I would press for sharper proof: who needs this now, what decision changes, and what failure mode would make us stop?` },
      { speaker: a, stance: lensA, text: `A practical next move is to use the evidence as prompts for focused experiments, not as a verdict. Give each agent a distinct mandate, force disagreement, and preserve cited claims.` },
      { speaker: b, stance: lensB, text: `I would add constraints: require sources, name uncertainty, and separate what the search shows from what the agents infer. That keeps the debate useful instead of theatrical.` },
    ],
    synthesis: 'Use the search layer as evidence intake, then make the debate layer expose assumptions, tradeoffs, and next tests.',
  };
}

router.post('/', async (req, res, next) => {
  try {
    const { idea, agentA, agentB, context = [] } = req.body || {};
    if (!idea?.trim()) return res.status(400).json({ error: 'idea is required' });

    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('...')) {
      return res.json(fallbackDebate({ idea, agentA, agentB, context }));
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 1800,
      system: 'You run disciplined debates between two AI agents. Return valid JSON only.',
      messages: [{
        role: 'user',
        content: `Idea: ${idea}

Agent A:
${JSON.stringify(agentA, null, 2)}

Agent B:
${JSON.stringify(agentB, null, 2)}

Search context:
${JSON.stringify(context.slice(0, 12), null, 2)}

Create a substantive debate. Return JSON:
{
  "title": "...",
  "rounds": [
    { "speaker": "...", "stance": "...", "text": "..." }
  ],
  "synthesis": "..."
}
Use the search context where relevant, but clearly distinguish evidence from inference.`,
      }],
    });

    try {
      res.json(JSON.parse(response.content[0].text));
    } catch {
      res.json({ title: `Debate: ${idea}`, rounds: [{ speaker: 'Moderator', stance: 'raw output', text: response.content[0].text }], synthesis: '' });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
