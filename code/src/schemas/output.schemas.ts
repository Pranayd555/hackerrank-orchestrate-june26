import { z } from 'zod';

export const ClaimStatusSchema = z.enum(['supported', 'contradicted', 'not_enough_information']);

export const SeveritySchema = z.enum(['none', 'low', 'medium', 'high', 'unknown']);

export const IssueTypeSchema = z.enum([
  'dent',
  'scratch',
  'crack',
  'glass_shatter',
  'broken_part',
  'missing_part',
  'torn_packaging',
  'crushed_packaging',
  'water_damage',
  'stain',
  'none',
  'unknown'
]);

export const CarPartSchema = z.enum([
  'front_bumper',
  'rear_bumper',
  'door',
  'hood',
  'windshield',
  'side_mirror',
  'headlight',
  'taillight',
  'fender',
  'quarter_panel',
  'body',
  'unknown'
]);

export const LaptopPartSchema = z.enum([
  'screen',
  'keyboard',
  'trackpad',
  'hinge',
  'lid',
  'corner',
  'port',
  'base',
  'body',
  'unknown'
]);

export const PackagePartSchema = z.enum([
  'box',
  'package_corner',
  'package_side',
  'seal',
  'label',
  'contents',
  'item',
  'unknown'
]);

export const RiskFlagSchema = z.enum([
  'none',
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
  'text_instruction_present',
  'user_history_risk',
  'manual_review_required'
]);

const BaseOutputSchema = z.object({
  user_id: z.string().min(1),
  image_paths: z.string(),
  user_claim: z.string(),
  claim_object: z.enum(['car', 'laptop', 'package']),
  evidence_standard_met: z.boolean(),
  evidence_standard_met_reason: z.string().min(1),
  risk_flags: z.string().refine(val => {
    if (val === 'none') return true;
    const flags = val.split(';').map(f => f.trim());
    return flags.every(f => RiskFlagSchema.safeParse(f).success);
  }, { message: "Invalid risk_flags format or value" }),
  issue_type: IssueTypeSchema,
  object_part: z.string(),
  claim_status: ClaimStatusSchema,
  claim_status_justification: z.string().min(1),
  supporting_image_ids: z.string().refine(val => {
    if (val === 'none') return true;
    const ids = val.split(';').map(id => id.trim());
    return ids.every(id => id.length > 0);
  }, { message: "Invalid supporting_image_ids format" }),
  valid_image: z.boolean(),
  severity: SeveritySchema,
});

export const ClaimOutputSchema = BaseOutputSchema.superRefine((data, ctx) => {
  // Validate object_part based on claim_object
  if (data.claim_object === 'car') {
    if (!CarPartSchema.safeParse(data.object_part).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['object_part'],
        message: `Invalid part "${data.object_part}" for car claim`,
      });
    }
  } else if (data.claim_object === 'laptop') {
    if (!LaptopPartSchema.safeParse(data.object_part).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['object_part'],
        message: `Invalid part "${data.object_part}" for laptop claim`,
      });
    }
  } else if (data.claim_object === 'package') {
    if (!PackagePartSchema.safeParse(data.object_part).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['object_part'],
        message: `Invalid part "${data.object_part}" for package claim`,
      });
    }
  }

  // Validate supporting_image_ids match image_paths filenames (without extension)
  if (data.supporting_image_ids !== 'none') {
    const supIds = data.supporting_image_ids.split(';').map(id => id.trim());
    const validIds = data.image_paths.split(';').map(p => {
      const parts = p.split('/');
      const file = parts[parts.length - 1] || '';
      return file.split('.')[0] || '';
    }).filter(id => id.length > 0);

    for (const supId of supIds) {
      if (!validIds.includes(supId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['supporting_image_ids'],
          message: `Supporting image ID "${supId}" is not in the submitted images list: [${validIds.join(', ')}]`,
        });
      }
    }
  }
});

export type ValidatedClaimOutput = z.infer<typeof ClaimOutputSchema>;
