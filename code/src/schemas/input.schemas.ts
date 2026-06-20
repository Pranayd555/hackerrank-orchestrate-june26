import { z } from 'zod';

export const ClaimInputSchema = z.object({
  user_id: z.string().min(1),
  image_paths: z.string(),
  user_claim: z.string(),
  claim_object: z.enum(['car', 'laptop', 'package']),
});

export const UserHistorySchema = z.object({
  user_id: z.string().min(1),
  past_claim_count: z.preprocess((val) => Number(val), z.number().int().nonnegative()),
  accept_claim: z.preprocess((val) => Number(val), z.number().int().nonnegative()),
  manual_review_claim: z.preprocess((val) => Number(val), z.number().int().nonnegative()),
  rejected_claim: z.preprocess((val) => Number(val), z.number().int().nonnegative()),
  last_90_days_claim_count: z.preprocess((val) => Number(val), z.number().int().nonnegative()),
  history_flags: z.string(),
  history_summary: z.string(),
});

export const EvidenceRequirementSchema = z.object({
  requirement_id: z.string().min(1),
  claim_object: z.string(),
  applies_to: z.string(),
  minimum_image_evidence: z.string(),
});

export type ValidatedClaimInput = z.infer<typeof ClaimInputSchema>;
export type ValidatedUserHistory = z.infer<typeof UserHistorySchema>;
export type ValidatedEvidenceRequirement = z.infer<typeof EvidenceRequirementSchema>;
