import { z } from 'zod';

/**
 * Schema for structured JSON observations from VLM models (e.g. Qwen, Gemma, Gemini)
 */
export const ModelObservationSchema = z.object({
  visible_object: z.string(), // The main object seen in the images, e.g. "car", "laptop", "package", "toy", etc.
  visible_part: z.string(),   // The specific object part visible, or "unknown", "none"
  visible_issue: z.string(),  // The visible damage type, e.g. "dent", "scratch", "none", "unknown"
  damage_visible: z.boolean(),
  part_visible: z.boolean(),
  image_quality: z.enum(['good', 'blurry', 'cropped', 'obstructed', 'glare', 'low_light', 'bad']),
  confidence: z.number().min(0.0).max(1.0),
  observations: z.string(),   // Text description detailing the physical evidence
  supporting_image_ids: z.array(z.string()), // Filenames (without extensions) showing the evidence
});

export type ModelObservation = z.infer<typeof ModelObservationSchema>;
