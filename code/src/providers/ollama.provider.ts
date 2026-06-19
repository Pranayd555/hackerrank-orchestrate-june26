import { IVisionProvider, VisionAnalysisInput, VisionAnalysisResult } from './vision-provider.interface';
import { env } from '../config/env';
import { ModelOutputSchema } from '../schemas/model.schemas';

export class OllamaProvider implements IVisionProvider {
  private url: string;
  private model: string;

  constructor() {
    this.url = env.OLLAMA_URL;
    this.model = env.OLLAMA_MODEL;
  }

  async analyze(input: VisionAnalysisInput): Promise<VisionAnalysisResult> {
    const endpoint = `${this.url}/api/chat`;

    // Convert image buffers to base64 strings
    const base64Images = input.images.map(img => img.buffer.toString('base64'));

    // Construct a structured prompt instructing the model to return JSON conforming to the schema.
    // Note: Per user request, final prompts are kept simple for now and will be detailed later.
    const prompt = `
Analyze the damage claim for this object: "${input.claimObject}".
Claimed Part: "${input.extractedPart}".
Claimed Issue: "${input.extractedIssue}".
Evidence Requirements:
${input.evidenceRequirements.map(req => `- ${req}`).join('\n')}

User Claim Statement:
"${input.userClaim}"

Verify the visual evidence in the attached images. Return a JSON object matching this structure:
{
  "evidence_standard_met": boolean,
  "evidence_standard_met_reason": "string describing evidence sufficiency",
  "visual_risk_flags": Array of strings (allowed: blurry_image, cropped_or_obstructed, low_light_or_glare, wrong_angle, wrong_object, wrong_object_part, damage_not_visible, claim_mismatch, possible_manipulation, non_original_image, text_instruction_present),
  "issue_type": "string" (allowed: dent, scratch, crack, glass_shatter, broken_part, missing_part, torn_packaging, crushed_packaging, water_damage, stain, none, unknown),
  "object_part": "string" (allowed: front_bumper, rear_bumper, door, hood, windshield, side_mirror, headlight, taillight, fender, quarter_panel, body, screen, keyboard, trackpad, hinge, lid, corner, port, base, box, package_corner, package_side, seal, label, contents, item, unknown),
  "claim_status": "string" (allowed: supported, contradicted, not_enough_information),
  "claim_status_justification": "string",
  "supporting_image_ids": Array of strings (image filenames without extension),
  "valid_image": boolean,
  "severity": "string" (allowed: none, low, medium, high, unknown),
  "confidence": number (between 0.0 and 1.0)
}
`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt,
              images: base64Images,
            },
          ],
          options: {
            temperature: 0.1, // low temperature for deterministic classifications
          },
          format: 'json',
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText} (${response.status})`);
      }

      const responseData = (await response.json()) as {
        message?: { content?: string };
      };
      const content = responseData.message?.content;

      if (!content) {
        throw new Error('Ollama returned empty response content.');
      }

      const parsedJSON = JSON.parse(content.trim());
      
      // Validate model output structure using Zod
      const validatedOutput = ModelOutputSchema.safeParse(parsedJSON);
      if (!validatedOutput.success) {
        console.warn('⚠️ Ollama output did not match expected schema, adapting:', validatedOutput.error.format());
      }

      // Extract confidence from raw output if present, or assign fallback
      const confidence = typeof parsedJSON.confidence === 'number' ? parsedJSON.confidence : 0.8;

      return {
        evidence_standard_met: parsedJSON.evidence_standard_met ?? false,
        evidence_standard_met_reason: parsedJSON.evidence_standard_met_reason ?? 'No evaluation reason provided',
        visual_risk_flags: Array.isArray(parsedJSON.visual_risk_flags) ? parsedJSON.visual_risk_flags : [],
        issue_type: parsedJSON.issue_type ?? 'unknown',
        object_part: parsedJSON.object_part ?? 'unknown',
        claim_status: parsedJSON.claim_status ?? 'not_enough_information',
        claim_status_justification: parsedJSON.claim_status_justification ?? 'Inference completed without details.',
        supporting_image_ids: Array.isArray(parsedJSON.supporting_image_ids) ? parsedJSON.supporting_image_ids : [],
        valid_image: parsedJSON.valid_image ?? true,
        severity: parsedJSON.severity ?? 'unknown',
        confidence,
      };

    } catch (error) {
      console.error('❌ Error during Ollama Vision provider analysis:', error);
      // Fallback response on error
      return {
        evidence_standard_met: false,
        evidence_standard_met_reason: `Ollama analysis failed: ${(error as Error).message}`,
        visual_risk_flags: [],
        issue_type: 'unknown',
        object_part: 'unknown',
        claim_status: 'not_enough_information',
        claim_status_justification: `Fallback triggered due to provider failure: ${(error as Error).message}`,
        supporting_image_ids: [],
        valid_image: false,
        severity: 'unknown',
        confidence: 0.0,
      };
    }
  }
}
