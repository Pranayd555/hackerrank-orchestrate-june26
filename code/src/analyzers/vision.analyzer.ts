import { IVisionProvider, VisionAnalysisInput } from '../providers/vision-provider.interface';
import { ModelObservation } from '../schemas/model.schemas';

export class VisionAnalyzer {
  private provider: IVisionProvider;

  constructor(provider: IVisionProvider) {
    this.provider = provider;
  }

  /**
   * Delegates image observation checks to the configured visual model provider.
   */
  public async analyzeEvidence(input: VisionAnalysisInput): Promise<ModelObservation> {
    try {
      const observation = await this.provider.analyze(input);
      // Normalize the observed part to fit strict schema definitions
      observation.visible_part = this.normalizePart(input.claimObject, observation.visible_part, input.extractedPart);
      return observation;
    } catch (error) {
      console.error('❌ Error during visual evidence analysis:', error);
      return {
        visible_object: 'unknown',
        visible_part: 'unknown',
        visible_issue: 'unknown',
        damage_visible: false,
        part_visible: false,
        image_quality: 'bad',
        confidence: 0.0,
        observations: `Vision analyzer failed: ${(error as Error).message}`,
        supporting_image_ids: [],
      };
    }
  }

  private normalizePart(claimObject: string, part: string, expectedPart: string): string {
    const p = part.toLowerCase().trim().replace(/[-_ ]+/g, '_');
    const ep = expectedPart.toLowerCase().trim();

    if (claimObject === 'package') {
      if (p === 'side' || p === 'package_side' || p === 'packageside') {
        return 'package_side';
      }
      if (p === 'corner' || p === 'package_corner' || p === 'packagecorner') {
        return 'package_corner';
      }
      if (p === 'box' || p === 'package' || p === 'parcel' || p === 'mailer') {
        return 'box';
      }
      if (p === 'seal' || p === 'tape') {
        return 'seal';
      }
    }

    if (claimObject === 'car') {
      if (p === 'front' || p === 'front_bumper' || p === 'front_bumper_area') {
        return 'front_bumper';
      }
      if (p === 'rear' || p === 'rear_bumper' || p === 'rear_bumper_area' || p === 'back') {
        return 'rear_bumper';
      }
      if (p === 'bumper') {
        if (ep === 'front_bumper' || ep === 'rear_bumper') {
          return ep;
        }
        return 'rear_bumper';
      }
      if (p === 'mirror' || p === 'side_mirror') {
        return 'side_mirror';
      }
      if (p === 'headlight' || p === 'head_light' || p === 'headlamp') {
        return 'headlight';
      }
      if (p === 'taillight' || p === 'tail_light' || p === 'tail_lamp') {
        return 'taillight';
      }
      if (p === 'glass' || p === 'windshield') {
        return 'windshield';
      }
    }

    if (claimObject === 'laptop') {
      if (p === 'display' || p === 'screen') {
        return 'screen';
      }
      if (p === 'hinges' || p === 'hinge') {
        return 'hinge';
      }
      if (p === 'trackpad' || p === 'touchpad' || p === 'track_pad') {
        return 'trackpad';
      }
      if (p === 'corner' || p === 'laptop_corner') {
        return 'corner';
      }
    }

    // Default to original if no specific mapping is matched
    return part;
  }
}
