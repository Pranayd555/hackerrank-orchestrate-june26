import { EvidenceRequirement, ClaimObject, IssueType, ObjectPart } from '../types';

export class EvidenceService {
  private requirements: EvidenceRequirement[];

  constructor(requirements: EvidenceRequirement[]) {
    this.requirements = requirements;
  }

  /**
   * Matches and filters the relevant evidence requirements based on object, part, and issue.
   */
  public getRequirements(
    claimObject: ClaimObject,
    part: ObjectPart,
    issue: IssueType,
    hasMultipleImages: boolean
  ): EvidenceRequirement[] {
    const matched: EvidenceRequirement[] = [];

    // 1. General rules that apply to all reviews
    const generalPartRule = this.requirements.find(r => r.requirement_id === 'REQ_GENERAL_OBJECT_PART');
    const trustRule = this.requirements.find(r => r.requirement_id === 'REQ_REVIEW_TRUST');

    if (generalPartRule) matched.push(generalPartRule);
    if (trustRule) matched.push(trustRule);

    // 2. Multi-image rule
    if (hasMultipleImages) {
      const multiRule = this.requirements.find(r => r.requirement_id === 'REQ_GENERAL_MULTI_IMAGE');
      if (multiRule) matched.push(multiRule);
    }

    // 3. Object and issue-specific rules
    if (claimObject === 'car') {
      if (issue === 'dent' || issue === 'scratch') {
        const rule = this.requirements.find(r => r.requirement_id === 'REQ_CAR_BODY_PANEL');
        if (rule) matched.push(rule);
      }
      if (issue === 'crack' || issue === 'broken_part' || issue === 'missing_part') {
        const rule = this.requirements.find(r => r.requirement_id === 'REQ_CAR_GLASS_LIGHT_MIRROR');
        if (rule) matched.push(rule);
      }
      if (part === 'side_mirror' || part === 'door' || part === 'fender' || part === 'quarter_panel') {
        const rule = this.requirements.find(r => r.requirement_id === 'REQ_CAR_IDENTITY_OR_SIDE');
        if (rule) matched.push(rule);
      }
    } else if (claimObject === 'laptop') {
      if (part === 'screen' || part === 'keyboard' || part === 'trackpad') {
        const rule = this.requirements.find(r => r.requirement_id === 'REQ_LAPTOP_SCREEN_KEYBOARD_TRACKPAD');
        if (rule) matched.push(rule);
      }
      if (part === 'hinge' || part === 'lid' || part === 'corner' || part === 'body' || part === 'port' || part === 'base') {
        const rule = this.requirements.find(r => r.requirement_id === 'REQ_LAPTOP_BODY_HINGE_PORT');
        if (rule) matched.push(rule);
      }
    } else if (claimObject === 'package') {
      if (issue === 'crushed_packaging' || issue === 'torn_packaging' || part === 'seal' || part === 'package_corner') {
        const rule = this.requirements.find(r => r.requirement_id === 'REQ_PACKAGE_EXTERIOR');
        if (rule) matched.push(rule);
      }
      if (issue === 'water_damage' || issue === 'stain' || part === 'label') {
        const rule = this.requirements.find(r => r.requirement_id === 'REQ_PACKAGE_LABEL_OR_STAIN');
        if (rule) matched.push(rule);
      }
      if (part === 'contents' || part === 'item') {
        const rule = this.requirements.find(r => r.requirement_id === 'REQ_PACKAGE_CONTENTS');
        if (rule) matched.push(rule);
      }
    }

    return matched;
  }
}
