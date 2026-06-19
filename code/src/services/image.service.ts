import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

export interface ImageValidationResult {
  isValid: boolean;
  width?: number;
  height?: number;
  candidateFlags: string[];
  errorMessage?: string;
}

export class ImageService {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Resolves a relative image path (e.g. 'images/sample/case_001/img_1.jpg') to an absolute path.
   * Handles pre-pending 'dataset/' if needed.
   */
  public resolveImagePath(relativePattern: string): string {
    const cleanPattern = relativePattern.trim();
    // Check if the path exists directly
    let fullPath = path.resolve(this.workspaceRoot, cleanPattern);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }

    // Try prepending 'dataset' if the workspace contains 'dataset'
    fullPath = path.resolve(this.workspaceRoot, 'dataset', cleanPattern);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }

    throw new Error(`Image file not found: ${relativePattern}`);
  }

  /**
   * Reads an image file as a Buffer.
   */
  public readImageBuffer(absolutePath: string): Buffer {
    return fs.readFileSync(absolutePath);
  }

  /**
   * Performs deterministic image validation on a buffer using Sharp.
   * Checks for corruption, dimensions, blurriness, aspect ratio, and lighting.
   */
  public async validateImage(buffer: Buffer): Promise<ImageValidationResult> {
    const candidateFlags: string[] = [];

    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        return {
          isValid: false,
          candidateFlags: ['cropped_or_obstructed'],
          errorMessage: 'Image metadata lacks width or height',
        };
      }

      const { width, height } = metadata;

      // 1. Check for extremely small dimensions (invalid files or cropped thumbnails)
      if (width < 120 || height < 120) {
        candidateFlags.push('cropped_or_obstructed');
      }

      // 2. Check for extreme aspect ratios (indicating cropped strips/panoramas)
      const aspect = width / height;
      if (aspect < 0.2 || aspect > 5.0) {
        candidateFlags.push('cropped_or_obstructed');
      }

      // Extract raw grayscale pixels to compute basic metrics
      const rawResized = await image
        .resize(128, 128, { fit: 'fill' })
        .grayscale()
        .raw()
        .toBuffer();

      // Compute statistics (mean brightness, variance, edge differences)
      let sum = 0;
      for (let i = 0; i < rawResized.length; i++) {
        sum += rawResized[i];
      }
      const mean = sum / rawResized.length;

      // Check for low light
      if (mean < 35) {
        candidateFlags.push('low_light_or_glare');
      }

      // Check for glare (percentage of pixels that are near-white)
      let highBrightnessCount = 0;
      for (let i = 0; i < rawResized.length; i++) {
        if (rawResized[i] > 245) {
          highBrightnessCount++;
        }
      }
      const glareRatio = highBrightnessCount / rawResized.length;
      if (glareRatio > 0.15) {
        candidateFlags.push('low_light_or_glare');
      }

      // Check for blurriness using variance of horizontal differences (simplified Sobel/Laplacian)
      let diffSum = 0;
      let diffSqSum = 0;
      let diffCount = 0;

      // 128x128 grid
      const size = 128;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size - 1; x++) {
          const idx1 = y * size + x;
          const idx2 = y * size + (x + 1);
          const diff = Math.abs(rawResized[idx1] - rawResized[idx2]);
          diffSum += diff;
          diffSqSum += diff * diff;
          diffCount++;
        }
      }

      const diffMean = diffSum / diffCount;
      const diffVariance = (diffSqSum / diffCount) - (diffMean * diffMean);

      // Low difference variance indicates fewer sharp edges (blurriness)
      if (diffVariance < 45.0) {
        candidateFlags.push('blurry_image');
      }

      return {
        isValid: true,
        width,
        height,
        candidateFlags,
      };

    } catch (error) {
      return {
        isValid: false,
        candidateFlags: [],
        errorMessage: `Unreadable or corrupt image: ${(error as Error).message}`,
      };
    }
  }
}
