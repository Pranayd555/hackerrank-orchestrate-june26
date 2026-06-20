import { ClaimObject, ObjectPart, IssueType } from '../types';
import { ModelObservation } from '../schemas/model.schemas';
import { ExtractedClaim } from './claim-extractor';

export interface ComparisonResult {
  partMatch: boolean;
  issueMatch: boolean;
  mismatchFlags: string[];
  justification: string;
}

export class ClaimComparator {
  /**
   * Compares the textually expected claim with the visually observed claim from the VLM.
   * Generates deterministic matching flags and justifications.
   */
  public compare(
    claimObject: ClaimObject,
    expected: ExtractedClaim,
    observed: ModelObservation
  ): ComparisonResult {
    const mismatchFlags: string[] = [];
    let partMatch = false;
    let issueMatch = false;
    let justification = '';

    // Standardize strings for comparison
    const expectedPart = expected.part.toLowerCase().trim();
    const expectedIssue = expected.issue.toLowerCase().trim();
    const observedPart = observed.visible_part.toLowerCase().trim();
    const observedIssue = observed.visible_issue.toLowerCase().trim();
    const observedObject = observed.visible_object.toLowerCase().trim();

    // 1. Check Object Match
    let objectMatch = true;
    if (observedObject !== 'unknown' && observedObject.length > 0) {
      if (claimObject === 'car' && !observedObject.includes('car') && !observedObject.includes('vehicle')) {
        objectMatch = false;
      } else if (claimObject === 'laptop' && !observedObject.includes('laptop') && !observedObject.includes('computer')) {
        objectMatch = false;
      } else if (claimObject === 'package' && !observedObject.includes('box') && !observedObject.includes('package') && !observedObject.includes('parcel') && !observedObject.includes('mailer')) {
        objectMatch = false;
      }
    }

    if (!objectMatch) {
      mismatchFlags.push('wrong_object');
    }

    // 2. Check Part Match
    // If the expected part is found in the observed part, or vice-versa
    if (expectedPart === observedPart || 
        (observedPart !== 'unknown' && (observedPart.includes(expectedPart) || expectedPart.includes(observedPart)))) {
      partMatch = true;
    }

    // Special package mapping cases
    if (claimObject === 'package') {
      if ((expectedPart === 'package_corner' && observedPart === 'corner') ||
          (expectedPart === 'package_side' && observedPart === 'side') ||
          (expectedPart === 'box' && (observedPart === 'box' || observedPart === 'package'))) {
        partMatch = true;
      }
    }

    if (!partMatch && observed.part_visible) {
      mismatchFlags.push('wrong_object_part');
    }

    // 3. Check Issue Match
    if (expectedIssue === observedIssue || 
        (observedIssue !== 'unknown' && (observedIssue.includes(expectedIssue) || expectedIssue.includes(observedIssue)))) {
      issueMatch = true;
    }

    // Map packaging issues closely
    if (claimObject === 'package') {
      if ((expectedIssue === 'crushed_packaging' && observedIssue === 'crushed') ||
          (expectedIssue === 'torn_packaging' && observedIssue === 'torn') ||
          (expectedIssue === 'water_damage' && (observedIssue === 'water' || observedIssue === 'wet'))) {
        issueMatch = true;
      }
    }

    // 4. Handle Visual Mismatch Flags
    if (observed.part_visible && !observed.damage_visible) {
      // The expected part is visible but no damage of any type is visible
      mismatchFlags.push('damage_not_visible');
      justification = `The claimed part (${expected.part}) is visible in the images, but no damage is visible.`;
    } else if (partMatch && !issueMatch && observed.damage_visible) {
      // Part matches but the damage type is different (e.g. scratch observed instead of dent)
      mismatchFlags.push('claim_mismatch');
      justification = `A different issue (${observed.visible_issue}) was visible on the claimed part compared to the claim (${expected.issue}).`;
    } else if (!partMatch && observed.damage_visible) {
      // Damage is visible, but on a completely different part (e.g. bumper damage instead of hood scratch)
      mismatchFlags.push('claim_mismatch');
      justification = `Damage was observed in the image set, but on the ${observed.visible_part} rather than the claimed ${expected.part}.`;
    } else if (!observed.part_visible) {
      mismatchFlags.push('damage_not_visible');
      justification = `The claimed part (${expected.part}) is not visible in the submitted images.`;
    } else if (partMatch && issueMatch) {
      justification = `The visual evidence shows a visible ${observed.visible_issue} on the ${observed.visible_part}, matching the claim.`;
    }

    // Overwrite description if wrong object is shown
    if (!objectMatch) {
      mismatchFlags.push('claim_mismatch');
      justification = `The image set shows a different object (${observed.visible_object}) than the claimed ${claimObject}.`;
    }

    // Deduplicate mismatch flags
    const uniqueMismatchFlags = [...new Set(mismatchFlags)];

    return {
      partMatch,
      issueMatch,
      mismatchFlags: uniqueMismatchFlags,
      justification,
    };
  }
}
