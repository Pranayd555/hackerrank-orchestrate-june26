import { z } from 'zod';
import { IssueTypeSchema, SeveritySchema, ClaimStatusSchema } from './output.schemas';

/**
 * Schema for structured JSON output from VLM models
 */
export const ModelOutputSchema = z.object({
  evidence_standard_met: z.boolean(),
  evidence_standard_met_reason: z.string(),
  // Candidate risk flags found from visual inspection
  visual_risk_flags: z.array(z.enum([
    'blurry_image',
    'cropped_or_obstructed',
    'low_light_or_glare',
    'wrong_angle',
    'wrong_object',
    'wrong_object_part',
    'damage_not_visible',
    'claim_mismatch',
    'possible_manipulation',
    'non_original_image',
    'text_instruction_present'
  ])),
  issue_type: IssueTypeSchema,
  object_part: z.string(),
  claim_status: ClaimStatusSchema,
  claim_status_justification: z.string(),
  supporting_image_ids: z.array(z.string()),
  valid_image: z.boolean(),
  severity: SeveritySchema,
});

export type ModelOutput = z.infer<typeof ModelOutputSchema>;
export type VisualRiskFlag = ModelOutput['visual_risk_flags'][number];
