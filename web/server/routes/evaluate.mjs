import { Router } from 'express';
import { fetchOpportunity } from '../lib/grants-api.mjs';
import { evaluateGrant } from '../lib/claude.mjs';

const router = Router();

// POST /api/v1/evaluate
router.post('/', async (req, res, next) => {
  try {
    if (!req.orgId) {
      return res.status(400).json({ error: 'Create an organization profile first' });
    }

    const { opportunity_id } = req.body;
    if (!opportunity_id) {
      return res.status(400).json({ error: 'opportunity_id is required' });
    }

    // Fetch opportunity from Grants.gov
    const opportunity = await fetchOpportunity(opportunity_id);

    // Load org profile
    const { data: org, error: orgError } = await req.supabase
      .from('organizations')
      .select('*')
      .eq('id', req.orgId)
      .single();

    if (orgError) throw orgError;

    // Check if already evaluated
    const { data: existingReport } = await req.supabase
      .from('reports')
      .select('id')
      .eq('org_id', req.orgId)
      .eq('opportunity_id', opportunity_id)
      .single();

    if (existingReport) {
      return res.status(409).json({
        error: 'Already evaluated',
        report_id: existingReport.id
      });
    }

    // Set up SSE for streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    let fullText = '';
    await evaluateGrant(opportunity, org, (chunk) => {
      if (chunk.type === 'text') {
        fullText += chunk.text;
        res.write(`data: ${JSON.stringify({ type: 'text', text: chunk.text })}\n\n`);
      }
    });

    // Parse the evaluation result
    let evaluation;
    try {
      // Extract JSON from the response (may be wrapped in markdown code blocks)
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      evaluation = JSON.parse(jsonMatch ? jsonMatch[0] : fullText);
    } catch {
      evaluation = {
        global_score: 0,
        status: 'Evaluated',
        recommendation: 'Error',
        report_md: fullText,
      };
    }

    // Get next entry number
    const { data: maxEntry } = await req.supabase
      .from('applications')
      .select('entry_num')
      .eq('org_id', req.orgId)
      .order('entry_num', { ascending: false })
      .limit(1)
      .single();

    const entryNum = (maxEntry?.entry_num || 0) + 1;

    const oppData = opportunity.opportunity || opportunity;
    const agency = oppData.agencyCode || oppData.agency?.code || '';
    const program = oppData.title || oppData.opportunityTitle || '';
    const deadline = oppData.closeDateStr || oppData.closeDate || null;
    const fundingFloor = oppData.awardFloor || null;
    const fundingCeiling = oppData.awardCeiling || null;
    const url = `https://www.grants.gov/search-results-detail/${opportunity_id}`;
    const category = oppData.fundingActivityCategories || '';

    // Save report
    const { data: report, error: reportError } = await req.supabase
      .from('reports')
      .insert({
        org_id: req.orgId,
        entry_num: entryNum,
        agency,
        program,
        opportunity_id,
        score: evaluation.global_score || 0,
        url,
        category: typeof category === 'string' ? category : JSON.stringify(category),
        deadline: deadline ? new Date(deadline) : null,
        funding_floor: fundingFloor,
        funding_ceiling: fundingCeiling,
        status: evaluation.status || 'Evaluated',
        body_md: evaluation.report_md || fullText,
      })
      .select()
      .single();

    if (reportError) throw reportError;

    // Save application tracker entry
    await req.supabase
      .from('applications')
      .upsert({
        org_id: req.orgId,
        entry_num: entryNum,
        agency,
        program,
        opportunity_id,
        score: evaluation.global_score || 0,
        status: evaluation.status || 'Evaluated',
        deadline: deadline ? new Date(deadline) : null,
        report_id: report.id,
        notes: evaluation.recommendation || '',
      }, { onConflict: 'org_id,opportunity_id' });

    // Update pipeline status
    await req.supabase
      .from('pipeline')
      .update({ status: evaluation.status === 'SKIP' ? 'skip' : 'done' })
      .eq('org_id', req.orgId)
      .eq('opportunity_id', opportunity_id);

    // Send final result
    res.write(`data: ${JSON.stringify({ type: 'result', evaluation, report_id: report.id })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
      res.end();
    } else {
      next(err);
    }
  }
});

export default router;
