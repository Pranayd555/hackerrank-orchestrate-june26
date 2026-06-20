import { fetch as undiciFetch, Agent } from 'undici';
import { env } from '../config/env';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

async function test() {
  const workspaceRoot = path.resolve(__dirname, '../../..');
  const imgPath = path.join(workspaceRoot, 'dataset/images/sample/case_008/img_1.jpg');
  const buffer = fs.readFileSync(imgPath);
  const pngBuffer = await sharp(buffer).resize({ width: 1024 }).png().toBuffer();
  const b64 = pngBuffer.toString('base64');

  const prompt = `
Analyze the image. Identify the primary visible object, the most prominent visible part of the object, and the most prominent visible issue (damage) on that part.

Return a JSON object:
{
  "visible_part": "rear_bumper|front_bumper|windshield|side_mirror|screen|keyboard|trackpad|hinge|lid|corner|box|seal|contents|unknown",
  "visible_issue": "dent|scratch|crack|glass_shatter|broken_part|missing_part|torn_packaging|crushed_packaging|water_damage|stain|none|unknown",
  "confidence": number (0.0 to 1.0)
}
Do NOT wrap the JSON in markdown code blocks. Start directly with '{'.
`;

  console.log('Sending request to Ollama with different thinking options...');
  const res = await undiciFetch(`${env.OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.OLLAMA_MODEL,
      messages: [{ role: 'user', content: prompt, images: [b64] }],
      options: { 
        temperature: 0.0, 
        num_predict: 100,
        think: false,
        nothink: true,
        show_thinking: false
      },
      stream: false,
    }),
    dispatcher: new Agent({ headersTimeout: 0, bodyTimeout: 0 }),
  });

  const text = await res.text();
  console.log('Raw response:');
  console.log(text);
}

test().catch(console.error);
