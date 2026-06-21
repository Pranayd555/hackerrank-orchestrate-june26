import { IVisionProvider, VisionAnalysisInput } from './vision-provider.interface';
import { env } from '../config/env';
import { ModelObservation, ModelObservationSchema } from '../schemas/model.schemas';
import sharp from 'sharp';
import { fetch as undiciFetch, Agent } from 'undici';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const cacheDir = path.resolve(env.WORKSPACE_ROOT, 'code/.cache');
const cachePath = path.join(cacheDir, 'observations.json');

export class OllamaProvider implements IVisionProvider {
  private url: string;
  private model: string;

  constructor() {
    this.url = env.OLLAMA_URL;
    this.model = env.OLLAMA_MODEL;
  }

  private getCache(): Record<string, ModelObservation> {
    try {
      if (fs.existsSync(cachePath)) {
        const data = fs.readFileSync(cachePath, 'utf8');
        return JSON.parse(data) as Record<string, ModelObservation>;
      }
    } catch (e) {
      console.warn('⚠️ Failed to read observation cache:', e);
    }
    return {};
  }

  private setCache(key: string, val: ModelObservation): void {
    try {
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      const cache = this.getCache();
      cache[key] = val;
      fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
    } catch (e) {
      console.warn('⚠️ Failed to write observation cache:', e);
    }
  }

  async analyze(input: VisionAnalysisInput): Promise<ModelObservation> {
    // 1. Caching Check
    const promptVersion = 'v2_reduced';
    const cacheKey = crypto
      .createHash('md5')
      .update(`${input.imagePaths || ''}_${this.model}_${promptVersion}`)
      .digest('hex');

    const cache = this.getCache();
    if (cache[cacheKey]) {
      console.log('CACHE HIT');
      const telemetry = (global as any).telemetry || {};
      telemetry.cacheHits = (telemetry.cacheHits || 0) + 1;
      
      const cachedVal = cache[cacheKey];
      if (cachedVal.observations && cachedVal.observations.startsWith('Parsed from thinking: ')) {
        const thinking = cachedVal.observations.replace('Parsed from thinking: ', '');
        const parsed = this.parseFromThinking(thinking, input.claimObject);
        cachedVal.visible_object = parsed.visible_object;
        cachedVal.visible_part = parsed.visible_part;
        cachedVal.visible_issue = parsed.visible_issue;
        cachedVal.damage_visible = parsed.visible_issue !== 'none' && parsed.visible_issue !== 'unknown';
        cachedVal.part_visible = parsed.visible_part !== 'none' && parsed.visible_part !== 'unknown';
      }
      return cachedVal;
    }

    console.log('CACHE MISS');
    const telemetry = (global as any).telemetry || {};
    telemetry.cacheMisses = (telemetry.cacheMisses || 0) + 1;

    const endpoint = `${this.url}/api/chat`;

    // 2. Convert and resize images to 1024px maximum width
    const base64Images = await Promise.all(
      input.images.map(async img => {
        const startImgPng = Date.now();
        let sharpPipeline = sharp(img.buffer);
        const meta = await sharpPipeline.metadata();
        if (meta.width && meta.width > 1024) {
          sharpPipeline = sharpPipeline.resize({ width: 1024 });
        }
        const pngBuffer = await sharpPipeline.png().toBuffer();
        const durationImgPng = Date.now() - startImgPng;

        if (telemetry.pngConversionTimes) telemetry.pngConversionTimes.push(durationImgPng);
        if (telemetry.origSizes) telemetry.origSizes.push(img.buffer.length);
        if (telemetry.pngSizes) telemetry.pngSizes.push(pngBuffer.length);

        const b64 = pngBuffer.toString('base64');
        if (telemetry.base64Sizes) telemetry.base64Sizes.push(b64.length);

        return b64;
      })
    );

    // Reduced prompt (Version B/C) without expected context bias to maximize accuracy
    const prompt = `
Analyze the image. Identify the primary visible object, the most prominent visible part of the object, and the most prominent visible issue (damage) on that part.

Return a JSON object with this exact structure:
{
  "visible_object": "car|laptop|package|unknown",
  "visible_part": "rear_bumper|front_bumper|windshield|side_mirror|screen|keyboard|trackpad|hinge|lid|corner|box|seal|contents|unknown",
  "visible_issue": "dent|scratch|crack|glass_shatter|broken_part|missing_part|torn_packaging|crushed_packaging|water_damage|stain|none|unknown",
  "confidence": number (0.0 to 1.0)
}
Do NOT wrap the JSON in markdown code blocks. Start directly with '{'.
`.trim();

    // 3. Setup timeout protection of 120s
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error(`\nTIMEOUT DETECTED for claim with user: ${input.userId || 'unknown'} (paths: ${input.imagePaths || 'unknown'})\n`);
      controller.abort();
    }, 120000);

    try {
      console.log(`[OllamaProvider] Raw request model name: ${this.model}`);

      const startModelCall = Date.now();
      let response;
      try {
        response = await undiciFetch(endpoint, {
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
              num_predict: 100, // strict 100-token generation limit
            },
            stream: false,
          }),
          dispatcher: new Agent({
            headersTimeout: 0, // disabled inside dispatcher, controlled by abort controller
            bodyTimeout: 0,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const modelCallDuration = Date.now() - startModelCall;
      if (telemetry.modelCallTimes) telemetry.modelCallTimes.push({
        userId: input.userId,
        duration: modelCallDuration,
        imagePaths: input.imagePaths
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText} (${response.status})`);
      }

      const responseData = (await response.json()) as {
        message?: { content?: string; thinking?: string };
      };
      const content = responseData.message?.content || '';
      const thinking = responseData.message?.thinking || '';

      console.log(`[OllamaProvider] Raw Ollama response content: ${content}`);
      console.log(`[OllamaProvider] Raw Ollama response thinking: ${thinking}`);

      let parsedJSON: any = null;

      // Extract JSON from content if present
      if (content.trim().length > 0) {
        try {
          let cleanedContent = content.trim();
          if (cleanedContent.startsWith('```')) {
            cleanedContent = cleanedContent.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '');
          }
          parsedJSON = JSON.parse(cleanedContent.trim());
        } catch (parseError) {
          console.error('[OllamaProvider] Parsing content JSON error:', parseError);
        }
      }

      // If content was empty or invalid, try parsing from thinking trace!
      if (!parsedJSON && thinking.trim().length > 0) {
        console.log('[OllamaProvider] Content empty/cut-off. Executing heuristic parse from thinking block...');
        parsedJSON = this.parseFromThinking(thinking, input.claimObject);
      }

      if (!parsedJSON) {
        throw new Error('Failed to retrieve structured observations from content or thinking.');
      }

      const visible_object = typeof parsedJSON.visible_object === 'string' ? parsedJSON.visible_object : input.claimObject;
      const visible_part = typeof parsedJSON.visible_part === 'string' ? parsedJSON.visible_part : 'unknown';
      const visible_issue = typeof parsedJSON.visible_issue === 'string' ? parsedJSON.visible_issue : 'unknown';
      const confidence = typeof parsedJSON.confidence === 'number' ? parsedJSON.confidence : 0.8;

      const output: ModelObservation = {
        visible_object,
        visible_part,
        visible_issue,
        damage_visible: visible_issue !== 'none' && visible_issue !== 'unknown',
        part_visible: visible_part !== 'none' && visible_part !== 'unknown',
        image_quality: 'good',
        confidence,
        observations: thinking.length > 0 ? `Parsed from thinking: ${thinking.substring(0, 500)}` : 'Observed details correctly parsed.',
        supporting_image_ids: input.images.map(img => img.id),
      };

      // 4. Save to cache
      this.setCache(cacheKey, output);
      return output;

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.error(`❌ Timeout Abort in Ollama Provider for user: ${input.userId}`);
      } else {
        console.error('❌ Error in Ollama Provider:', error);
      }
      throw error;
    }
  }


  private testRegex(text: string, keywords: string[]): boolean {
    const escaped = keywords.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'i');
    return pattern.test(text);
  }

  private parseFromThinking(thinking: string, claimObject: string): any {
    const text = thinking.toLowerCase();
    
    // 1. Identify visible_object
    let visible_object = claimObject;
    if (this.testRegex(text, ['car', 'cars', 'vehicle', 'vehicles', 'sedan', 'sedans', 'suv', 'suvs', 'bumper', 'bumpers', 'mirror', 'mirrors', 'windshield', 'windshields'])) {
      visible_object = 'car';
    } else if (this.testRegex(text, ['laptop', 'laptops', 'notebook', 'screen', 'screens', 'keyboard', 'keyboards', 'hinge', 'hinges', 'lid', 'lids', 'trackpad', 'trackpads'])) {
      visible_object = 'laptop';
    } else if (this.testRegex(text, ['package', 'packages', 'box', 'boxes', 'mailer', 'mailers', 'seal', 'seals', 'contents', 'cardboard'])) {
      visible_object = 'package';
    }

    // 2. Identify visible_part
    let visible_part = 'unknown';
    if (visible_object === 'car') {
      if (this.testRegex(text, ['front bumper', 'front_bumper', 'front end', 'grille', 'parachoques delantero'])) {
        visible_part = 'front_bumper';
      } else if (this.testRegex(text, ['rear bumper', 'rear_bumper', 'back bumper', 'rear end', 'back of the car', 'parachoques trasero'])) {
        visible_part = 'rear_bumper';
      } else if (this.testRegex(text, ['windshield', 'front glass', 'wind shield'])) {
        visible_part = 'windshield';
      } else if (this.testRegex(text, ['side mirror', 'side_mirror', 'espejo'])) {
        visible_part = 'side_mirror';
      } else if (this.testRegex(text, ['headlight', 'head light', 'headlamp', 'headlamps'])) {
        visible_part = 'headlight';
      } else if (this.testRegex(text, ['taillight', 'tail light', 'tail_light', 'back light'])) {
        visible_part = 'taillight';
      } else if (this.testRegex(text, ['door', 'doors', 'puerta', 'puertas'])) {
        visible_part = 'door';
      } else if (this.testRegex(text, ['hood', 'hoods', 'capo'])) {
        visible_part = 'hood';
      }
    } else if (visible_object === 'laptop') {
      if (this.testRegex(text, ['screen', 'display', 'panel', 'pantalla'])) {
        visible_part = 'screen';
      } else if (this.testRegex(text, ['keyboard', 'keys', 'keycaps', 'teclado'])) {
        visible_part = 'keyboard';
      } else if (this.testRegex(text, ['trackpad', 'touchpad'])) {
        visible_part = 'trackpad';
      } else if (this.testRegex(text, ['hinge', 'hinges'])) {
        visible_part = 'hinge';
      } else if (this.testRegex(text, ['lid', 'cover', 'outer shell'])) {
        visible_part = 'lid';
      } else if (this.testRegex(text, ['corner', 'edge'])) {
        visible_part = 'corner';
      }
    } else if (visible_object === 'package') {
      if (this.testRegex(text, ['seal', 'tape', 'closing'])) {
        visible_part = 'seal';
      } else if (this.testRegex(text, ['contents', 'inside', 'item'])) {
        visible_part = 'contents';
      } else if (this.testRegex(text, ['side', 'panel'])) {
        visible_part = 'package_side';
      } else if (this.testRegex(text, ['corner', 'edge'])) {
        visible_part = 'package_corner';
      } else if (this.testRegex(text, ['box', 'carton', 'mailer', 'package'])) {
        visible_part = 'box';
      }
    }

    // 3. Identify visible_issue
    let visible_issue = 'unknown';

    // Check for clear indication of no damage/undamaged/intact first
    const hasNoneIndicators = this.testRegex(text, [
      'undamaged', 'intact', 'no damage', 'no visible damage', 'no visible issue', 'no visible issues',
      'looks normal', 'smooth and undamaged', 'without any damage', 'no cracks', 'no scratches',
      'no dents', 'clean and intact', 'all keys look intact', 'smooth and clean', 'no obvious damage',
      'issue is none', 'issue would be none', 'visible_issue: none', 'visible_issue is none', 'not damaged'
    ]);

    if (hasNoneIndicators && !this.testRegex(text, ['but there is', 'however'])) {
      visible_issue = 'none';
    } else {
      if (this.testRegex(text, ['shatter', 'shattered', 'shattering'])) {
        visible_issue = 'glass_shatter';
      } else if (this.testRegex(text, ['missing', 'gone', 'lost', 'detached'])) {
        visible_issue = 'missing_part';
      } else if (this.testRegex(text, ['crack', 'cracked', 'cracks'])) {
        visible_issue = 'crack';
      } else if (this.testRegex(text, ['dent', 'dented', 'dents', 'hail'])) {
        visible_issue = 'dent';
      } else if (this.testRegex(text, ['scratch', 'scratched', 'scratches', 'scrape', 'scraped', 'scrapes'])) {
        visible_issue = 'scratch';
      } else if (this.testRegex(text, ['torn', 'rip', 'ripped', 'teared', 'open'])) {
        visible_issue = 'torn_packaging';
      } else if (this.testRegex(text, ['water', 'wet', 'leak', 'liquid', 'moisture'])) {
        visible_issue = 'water_damage';
      } else if (this.testRegex(text, ['stain', 'stained', 'stains', 'oily', 'oil'])) {
        visible_issue = 'stain';
      } else if (this.testRegex(text, ['broken', 'damage', 'damaged', 'smash', 'smashed', 'wrecked', 'crushed', 'crush'])) {
        if (claimObject === 'package') {
          visible_issue = 'crushed_packaging';
        } else {
          visible_issue = 'broken_part';
        }
      }
    }

    return {
      visible_object,
      visible_part,
      visible_issue,
      confidence: 0.8
    };
  }
}

