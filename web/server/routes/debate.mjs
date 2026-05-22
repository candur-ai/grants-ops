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

function sendEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function streamFallback(res, debate) {
  sendEvent(res, { type: 'title', title: debate.title });
  for (const round of debate.rounds) {
    sendEvent(res, { type: 'round', round });
  }
  sendEvent(res, { type: 'synthesis', synthesis: debate.synthesis });
  sendEvent(res, { type: 'result', debate });
  res.write('data: [DONE]\n\n');
  res.end();
}

router.post('/', async (req, res, next) => {
  try {
    const { idea, agentA, agentB, context = [] } = req.body || {};
    if (!idea?.trim()) return res.status(400).json({ error: 'idea is required' });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('...')) {
      return streamFallback(res, fallbackDebate({ idea, agentA, agentB, context }));
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const debate = { title: `Debate: ${idea}`, rounds: [], synthesis: '' };
    let lineBuffer = '';
    let fullText = '';

    const stream = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 1800,
      stream: true,
      system: 'You run disciplined debates between two AI agents. Output newline-delimited JSON only. Each line must be a complete JSON object.',
      messages: [{
        role: 'user',
        content: `Idea: ${idea}

Agent A:
${JSON.stringify(agentA, null, 2)}

Agent B:
${JSON.stringify(agentB, null, 2)}

Search context:
${JSON.stringify(context.slice(0, 12), null, 2)}

Create a substantive debate. Stream it as newline-delimited JSON, one object per line, in this exact order:
{"type":"title","title":"..."}
{"type":"round","round":{"speaker":"...","stance":"...","text":"..."}}
{"type":"round","round":{"speaker":"...","stance":"...","text":"..."}}
{"type":"round","round":{"speaker":"...","stance":"...","text":"..."}}
{"type":"round","round":{"speaker":"...","stance":"...","text":"..."}}
{"type":"synthesis","synthesis":"..."}

Do not wrap the output in markdown. Do not include prose outside JSON lines. Use the search context where relevant, but clearly distinguish evidence from inference.`,
      }],
    });

    function processLine(rawLine) {
      const line = rawLine.trim();
      if (!line) return;

      try {
        const event = JSON.parse(line);
        if (event.type === 'title' && event.title) {
          debate.title = event.title;
          sendEvent(res, { type: 'title', title: event.title });
        } else if (event.type === 'round' && event.round) {
          debate.rounds.push(event.round);
          sendEvent(res, { type: 'round', round: event.round });
        } else if (event.type === 'synthesis' && event.synthesis) {
          debate.synthesis = event.synthesis;
          sendEvent(res, { type: 'synthesis', synthesis: event.synthesis });
        }
      } catch {
        // Ignore incomplete or non-JSON lines; final fallback handles raw output.
      }
    }

    for await (const event of stream) {
      if (event.type !== 'content_block_delta' || event.delta?.type !== 'text_delta') continue;
      const text = event.delta.text || '';
      fullText += text;
      lineBuffer += text;

      const lines = lineBuffer.split(/\r?\n/);
      lineBuffer = lines.pop() || '';
      for (const line of lines) processLine(line);
    }

    processLine(lineBuffer);

    if (!debate.rounds.length && fullText.trim()) {
      debate.rounds.push({ speaker: 'Moderator', stance: 'raw output', text: fullText.trim() });
      sendEvent(res, { type: 'round', round: debate.rounds[0] });
    }

    sendEvent(res, { type: 'result', debate });
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    if (res.headersSent) {
      sendEvent(res, { type: 'error', error: err.message || 'Debate failed' });
      res.end();
    } else {
      next(err);
    }
  }
});

export default router;
