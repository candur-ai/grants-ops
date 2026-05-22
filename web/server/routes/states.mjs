import { Router } from 'express';
const router = Router();

const CANONICAL_STATES = [
  { id: 'discovered', label: 'Discovered', aliases: ['found', 'new', 'scanned'], group: 'discovered' },
  { id: 'evaluated', label: 'Evaluated', aliases: ['reviewed', 'assessed'], group: 'evaluated' },
  { id: 'preparing', label: 'Preparing', aliases: ['drafting', 'in_progress', 'writing'], group: 'preparing' },
  { id: 'applied', label: 'Applied', aliases: ['submitted', 'sent'], group: 'applied' },
  { id: 'under_review', label: 'Under Review', aliases: ['pending_review', 'in_review'], group: 'under_review' },
  { id: 'awarded', label: 'Awarded', aliases: ['funded', 'approved', 'won'], group: 'awarded' },
  { id: 'not_funded', label: 'Not Funded', aliases: ['rejected', 'declined', 'unfunded'], group: 'not_funded' },
  { id: 'withdrawn', label: 'Withdrawn', aliases: ['cancelled', 'retracted'], group: 'withdrawn' },
  { id: 'skip', label: 'SKIP', aliases: ['no_apply', 'pass', 'ineligible'], group: 'skip' },
];

// GET /api/v1/states
router.get('/', (_req, res) => {
  res.json(CANONICAL_STATES);
});

export default router;
