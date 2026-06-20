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
      return cache[cacheKey];
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

  private parseFromThinking(thinking: string, claimObject: string): any {
    const text = thinking.toLowerCase();
    
    // 1. Identify visible_object
    let visible_object = claimObject;
    if (text.includes('car') || text.includes('vehicle') || text.includes('bumper') || text.includes('mirror') || text.includes('windshield')) {
      visible_object = 'car';
    } else if (text.includes('laptop') || text.includes('screen') || text.includes('keyboard') || text.includes('hinge') || text.includes('lid') || text.includes('trackpad')) {
      visible_object = 'laptop';
    } else if (text.includes('package') || text.includes('box') || text.includes('mailer') || text.includes('seal') || text.includes('contents') || text.includes('cardboard')) {
      visible_object = 'package';
    }

    // 2. Identify visible_part
    let visible_part = 'unknown';
    if (visible_object === 'car') {
      if (text.includes('front bumper') || text.includes('front_bumper') || text.includes('front end') || text.includes('grille')) {
        visible_part = 'front_bumper';
      } else if (text.includes('rear bumper') || text.includes('rear_bumper') || text.includes('back bumper') || text.includes('rear end') || text.includes('back of the car')) {
        visible_part = 'rear_bumper';
      } else if (text.includes('windshield') || text.includes('glass') || text.includes('window')) {
        visible_part = 'windshield';
      } else if (text.includes('mirror') || text.includes('side mirror') || text.includes('side_mirror')) {
        visible_part = 'side_mirror';
      } else if (text.includes('headlight') || text.includes('head light') || text.includes('headlamp')) {
        visible_part = 'headlight';
      } else if (text.includes('taillight') || text.includes('tail light') || text.includes('tail_light')) {
        visible_part = 'taillight';
      } else if (text.includes('door') || text.includes('panel')) {
        visible_part = 'door';
      }
    } else if (visible_object === 'laptop') {
      if (text.includes('screen') || text.includes('display') || text.includes('panel')) {
        visible_part = 'screen';
      } else if (text.includes('keyboard') || text.includes('keys')) {
        visible_part = 'keyboard';
      } else if (text.includes('trackpad') || text.includes('touchpad')) {
        visible_part = 'trackpad';
      } else if (text.includes('hinge') || text.includes('hinges')) {
        visible_part = 'hinge';
      } else if (text.includes('lid') || text.includes('cover') || text.includes('outer shell')) {
        visible_part = 'lid';
      } else if (text.includes('corner') || text.includes('edge')) {
        visible_part = 'corner';
      }
    } else if (visible_object === 'package') {
      if (text.includes('seal') || text.includes('tape') || text.includes('closing')) {
        visible_part = 'seal';
      } else if (text.includes('contents') || text.includes('inside') || text.includes('item')) {
        visible_part = 'contents';
      } else if (text.includes('side') || text.includes('panel')) {
        visible_part = 'package_side';
      } else if (text.includes('corner') || text.includes('edge')) {
        visible_part = 'package_corner';
      } else if (text.includes('box') || text.includes('carton') || text.includes('mailer') || text.includes('package')) {
        visible_part = 'box';
      }
    }

    // 3. Identify visible_issue
    let visible_issue = 'unknown';
    if (text.includes('shatter') || text.includes('shattered')) {
      visible_issue = 'glass_shatter';
    } else if (text.includes('missing') || text.includes('gone') || text.includes('lost') || text.includes('detached')) {
      visible_issue = 'missing_part';
    } else if (text.includes('broken') || text.includes('damage') || text.includes('smash') || text.includes('smashed') || text.includes('wrecked') || text.includes('crushed')) {
      if (claimObject === 'package') {
        visible_issue = 'crushed_packaging';
      } else {
        visible_issue = 'broken_part';
      }
    } else if (text.includes('crack') || text.includes('cracked')) {
      visible_issue = 'crack';
    } else if (text.includes('dent') || text.includes('dented') || text.includes('depression')) {
      visible_issue = 'dent';
    } else if (text.includes('scratch') || text.includes('scratched') || text.includes('scrape') || text.includes('scraped')) {
      visible_issue = 'scratch';
    } else if (text.includes('torn') || text.includes('rip') || text.includes('ripped')) {
      visible_issue = 'torn_packaging';
    } else if (text.includes('water') || text.includes('wet') || text.includes('leak') || text.includes('liquid') || text.includes('moisture')) {
      visible_issue = 'water_damage';
    } else if (text.includes('stain') || text.includes('stained') || text.includes('discolor')) {
      visible_issue = 'stain';
    }

    return {
      visible_object,
      visible_part,
      visible_issue,
      confidence: 0.8
    };
  }
}
