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
      return await this.provider.analyze(input);
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
}
