import { Router } from 'express';
import { searchGrants, fetchOpportunity } from '../lib/grants-api.mjs';

const router = Router();

function normalizeOpportunityDetail(result) {
  const data = result?.data || result || {};
  const synopsis = data.synopsis || {};
  return {
    id: data.id || synopsis.opportunityId,
    opportunityNumber: data.opportunityNumber || synopsis.opportunityNumber,
    opportunityTitle: data.opportunityTitle || synopsis.opportunityTitle,
    owningAgencyCode: data.owningAgencyCode || synopsis.agencyCode,
    opportunityCategory: data.opportunityCategory,
    ost: data.ost || synopsis.oppStatus || 'POSTED',
    synopsis: {
      opportunityId: synopsis.opportunityId,
      agencyCode: synopsis.agencyCode,
      agencyName: synopsis.agencyName,
      agencyContactName: synopsis.agencyContactName,
      agencyContactEmail: synopsis.agencyContactEmail,
      agencyContactPhone: synopsis.agencyContactPhone,
      synopsisDesc: synopsis.synopsisDesc,
      applicantEligibilityDesc: synopsis.applicantEligibilityDesc,
      responseDate: synopsis.responseDate,
      responseDateDesc: synopsis.responseDateDesc,
      postingDate: synopsis.postingDate,
      archiveDate: synopsis.archiveDate,
      fundingDescLinkUrl: synopsis.fundingDescLinkUrl,
      fundingDescLinkDesc: synopsis.fundingDescLinkDesc,
      costSharing: synopsis.costSharing,
      numberOfAwards: synopsis.numberOfAwards,
      estimatedFunding: synopsis.estimatedFunding,
      awardCeiling: synopsis.awardCeiling,
      awardFloor: synopsis.awardFloor,
      applicantTypes: synopsis.applicantTypes || [],
      fundingInstruments: synopsis.fundingInstruments || [],
      fundingActivityCategories: synopsis.fundingActivityCategories || [],
    },
    cfdas: (data.cfdas || []).map((cfda) => ({
      cfdaNumber: cfda.cfdaNumber,
      programTitle: cfda.programTitle,
    })),
    opportunityPkgs: (data.opportunityPkgs || []).map((pkg) => ({
      packageId: pkg.packageId,
      opportunityNumber: pkg.opportunityNumber,
      openingDate: pkg.openingDate,
      closingDate: pkg.closingDate,
      contactInfo: pkg.contactInfo,
    })),
    synopsisAttachmentFolders: data.synopsisAttachmentFolders || [],
    synopsisDocumentURLs: data.synopsisDocumentURLs || [],
  };
}

// POST /api/v1/grants/search — proxy to Grants.gov search2
router.post('/search', async (req, res, next) => {
  try {
    const result = await searchGrants(req.body);
    const data = result?.data || {};
    res.json({
      ...result,
      oppHits: data.oppHits || result.oppHits || [],
      opportunities: data.oppHits || result.opportunities || [],
      hitCount: data.hitCount ?? result.hitCount ?? 0,
      startRecord: data.startRecord ?? result.startRecord,
    });
  } catch (err) { next(err); }
});

// GET /api/v1/grants/:opportunityId — proxy to Grants.gov fetchOpportunity
router.get('/:opportunityId', async (req, res, next) => {
  try {
    const result = await fetchOpportunity(req.params.opportunityId);
    res.json(normalizeOpportunityDetail(result));
  } catch (err) { next(err); }
});

export default router;
