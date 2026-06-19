import { ImageValidationResult } from '../services/image.service';
import { ModelObservation } from '../schemas/model.schemas';
import { ClaimObject, ObjectPart, IssueType } from '../types';

export interface EvidenceEvaluationResult {
  evidence_standard_met: boolean;
  evidence_standard_met_reason: string;
  quality_flags: string[];
  valid_image: boolean;
}

export class EvidenceEvaluator {
  /**
   * Determinisitcally evaluates if the evidence standard is met based on local image checks and VLM observations.
   */
  public evaluate(
    claimObject: ClaimObject,
    expectedPart: ObjectPart,
    expectedIssue: IssueType,
    imageValidations: ImageValidationResult[],
    observation: ModelObservation
  ): EvidenceEvaluationResult {
    const quality_flags: string[] = [];
    let valid_image = true;
    let evidence_standard_met = true;
    let evidence_standard_met_reason = '';

    // 1. Evaluate local image validations
    if (imageValidations.length === 0) {
      return {
        evidence_standard_met: false,
        evidence_standard_met_reason: 'No images were submitted with this claim.',
        quality_flags: ['cropped_or_obstructed'],
        valid_image: false,
      };
    }

    // Check if ALL images are unreadable/corrupt
    const allUnreadable = imageValidations.every(v => !v.isValid);
    if (allUnreadable) {
      return {
        evidence_standard_met: false,
        evidence_standard_met_reason: 'All submitted image files are corrupt or unreadable.',
        quality_flags: ['cropped_or_obstructed'],
        valid_image: false,
      };
    }

    // Compile quality flags from all valid images
    imageValidations.forEach(val => {
      if (val.isValid && val.candidateFlags) {
        val.candidateFlags.forEach(f => {
          if (!quality_flags.includes(f)) {
            quality_flags.push(f);
          }
        });
      }
    });

    // If there's an explicit "non_original_image" or serious authentication issue
    if (observation.observations.toLowerCase().includes('non-original') || 
        observation.observations.toLowerCase().includes('screen photo') ||
        observation.observations.toLowerCase().includes('manipulat')) {
      valid_image = false;
      quality_flags.push('non_original_image');
    }

    // If image validation failed on any image, it could make the set invalid if it's the only one
    const hasUnreadableImage = imageValidations.some(v => !v.isValid);
    if (hasUnreadableImage && imageValidations.length === 1) {
      valid_image = false;
    }

    // 2. Evaluate evidence sufficiency based on VLM observations
    if (!observation.part_visible) {
      evidence_standard_met = false;
      quality_flags.push('wrong_angle');
      evidence_standard_met_reason = `The claimed part (${expectedPart}) is not visible in the images, so the claim cannot be verified.`;
    } else if (observation.image_quality === 'bad' || observation.image_quality === 'blurry') {
      // If the VLM flags that the image quality is bad or too blurry to inspect
      evidence_standard_met = false;
      if (!quality_flags.includes('blurry_image')) {
        quality_flags.push('blurry_image');
      }
      evidence_standard_met_reason = `The image quality is too blurry or obstructed to inspect the claimed ${expectedPart}.`;
    } else if (claimObject === 'package' && expectedPart === 'contents' && !observation.damage_visible && !observation.part_visible) {
      // Missing item case (like Case 19)
      evidence_standard_met = false;
      if (!quality_flags.includes('cropped_or_obstructed')) {
        quality_flags.push('cropped_or_obstructed');
      }
      evidence_standard_met_reason = `The images do not clearly show the expected contents or enough of the opened package to verify whether anything is missing.`;
      valid_image = false; // As per Case 19 label in sample claims
    } else {
      // Standard is met, but describe what we see
      if (observation.damage_visible) {
        evidence_standard_met_reason = `The ${expectedPart} is visible and the ${observation.visible_issue} can be verified from the submitted images.`;
      } else {
        evidence_standard_met_reason = `The ${expectedPart} is visible and appears undamaged, so the claim can be evaluated.`;
      }
    }

    return {
      evidence_standard_met,
      evidence_standard_met_reason,
      quality_flags,
      valid_image,
    };
  }
}
