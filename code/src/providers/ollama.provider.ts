import { IVisionProvider, VisionAnalysisInput } from './vision-provider.interface';
import { env } from '../config/env';
import { ModelObservation, ModelObservationSchema } from '../schemas/model.schemas';
import sharp from 'sharp';

export class OllamaProvider implements IVisionProvider {
  private url: string;
  private model: string;

  constructor() {
    this.url = env.OLLAMA_URL;
    this.model = env.OLLAMA_MODEL;
  }

  async analyze(input: VisionAnalysisInput): Promise<ModelObservation> {
    const endpoint = `${this.url}/api/chat`;

    // Convert image buffers to base64 strings after converting to PNG to avoid decoding issues in llama.cpp
    const base64Images = await Promise.all(
      input.images.map(async img => {
        const pngBuffer = await sharp(img.buffer).png().toBuffer();
        return pngBuffer.toString('base64');
      })
    );

    const prompt = `
You are a highly precise visual inspection system. Analyze the attached images to evaluate a damage claim.
Do NOT make final policy decisions (such as claim status or risk flags). Focus ONLY on raw visual observations.

Expected Claim Context:
- Object Type: "${input.claimObject}"
- Expected Damaged Part: "${input.extractedPart}"
- Expected Damage Issue: "${input.extractedIssue}"
- Minimum Evidence Requirements:
${input.evidenceRequirements.map(req => `  * ${req}`).join('\n')}

Image IDs submitted: [${input.images.map(img => img.id).join(', ')}]

Please inspect the images and return a JSON object with this exact structure:
{
  "visible_object": "string (the primary object visible in the image, e.g., car, laptop, cardboard box, mailer, keyboard, smartphone, or unknown)",
  "visible_part": "string (the specific part of the object visible, e.g., rear_bumper, front_bumper, windshield, side_mirror, screen, keyboard, trackpad, hinge, lid, corner, box, seal, contents, or unknown)",
  "visible_issue": "string (the physical damage seen, e.g., dent, scratch, crack, glass_shatter, broken_part, missing_part, torn_packaging, crushed_packaging, water_damage, stain, none, or unknown)",
  "damage_visible": boolean (true if visual damage corresponding to the claim or other clear damage is visible on the part),
  "part_visible": boolean (true if the expected claimed part is clearly visible in the image set),
  "image_quality": "good" | "blurry" | "cropped" | "obstructed" | "glare" | "low_light" | "bad",
  "confidence": number (between 0.0 and 1.0, indicating your visual classification confidence),
  "observations": "string (brief description of what is physically visible in the image, including colors, object details, text presence, or background context)",
  "supporting_image_ids": ["array of image ID strings that show the part or damage. If no image shows the part/damage, return an empty array []"]
}
`;

    try {
      console.log(`[OllamaProvider] Raw request model name: ${this.model}`);

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
            temperature: 0.0, // set temperature to 0 for maximum consistency and deterministic outputs
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

      console.log(`[OllamaProvider] Raw Ollama response content before parsing: ${content}`);

      let parsedJSON: any;
      try {
        parsedJSON = JSON.parse(content.trim());
      } catch (parseError) {
        console.error('[OllamaProvider] Parsing error:', parseError);
        throw parseError;
      }

      const validatedOutput = ModelObservationSchema.safeParse(parsedJSON);

      if (!validatedOutput.success) {
        console.error('[OllamaProvider] Validation error:', validatedOutput.error.format());
        console.warn('⚠️ Ollama raw observations output schema validation failed. Adapting fallback values.', validatedOutput.error.format());
        return {
          visible_object: typeof parsedJSON.visible_object === 'string' ? parsedJSON.visible_object : 'unknown',
          visible_part: typeof parsedJSON.visible_part === 'string' ? parsedJSON.visible_part : 'unknown',
          visible_issue: typeof parsedJSON.visible_issue === 'string' ? parsedJSON.visible_issue : 'unknown',
          damage_visible: typeof parsedJSON.damage_visible === 'boolean' ? parsedJSON.damage_visible : false,
          part_visible: typeof parsedJSON.part_visible === 'boolean' ? parsedJSON.part_visible : false,
          image_quality: ['good', 'blurry', 'cropped', 'obstructed', 'glare', 'low_light', 'bad'].includes(parsedJSON.image_quality) ? parsedJSON.image_quality : 'good',
          confidence: typeof parsedJSON.confidence === 'number' ? parsedJSON.confidence : 0.5,
          observations: typeof parsedJSON.observations === 'string' ? parsedJSON.observations : 'Failed to retrieve structured observations.',
          supporting_image_ids: Array.isArray(parsedJSON.supporting_image_ids) ? parsedJSON.supporting_image_ids : [],
        };
      }

      return validatedOutput.data;

    } catch (error) {
      console.error('❌ Error in Ollama Provider:', error);
      // Return a safe fallback observation structure
      return {
        visible_object: 'unknown',
        visible_part: 'unknown',
        visible_issue: 'unknown',
        damage_visible: false,
        part_visible: false,
        image_quality: 'bad',
        confidence: 0.0,
        observations: `Provider failure: ${(error as Error).message}`,
        supporting_image_ids: [],
      };
    }
  }
}
