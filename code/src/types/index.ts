export type ClaimObject = 'car' | 'laptop' | 'package';

export type ClaimStatus = 'supported' | 'contradicted' | 'not_enough_information';

export type Severity = 'none' | 'low' | 'medium' | 'high' | 'unknown';

export type IssueType =
  | 'dent'
  | 'scratch'
  | 'crack'
  | 'glass_shatter'
  | 'broken_part'
  | 'missing_part'
  | 'torn_packaging'
  | 'crushed_packaging'
  | 'water_damage'
  | 'stain'
  | 'none'
  | 'unknown';

export type CarObjectPart =
  | 'front_bumper'
  | 'rear_bumper'
  | 'door'
  | 'hood'
  | 'windshield'
  | 'side_mirror'
  | 'headlight'
  | 'taillight'
  | 'fender'
  | 'quarter_panel'
  | 'body'
  | 'unknown';

export type LaptopObjectPart =
  | 'screen'
  | 'keyboard'
  | 'trackpad'
  | 'hinge'
  | 'lid'
  | 'corner'
  | 'port'
  | 'base'
  | 'body'
  | 'unknown';

export type PackageObjectPart =
  | 'box'
  | 'package_corner'
  | 'package_side'
  | 'seal'
  | 'label'
  | 'contents'
  | 'item'
  | 'unknown';

export type ObjectPart = CarObjectPart | LaptopObjectPart | PackageObjectPart;

export type RiskFlag =
  | 'none'
  | 'blurry_image'
  | 'cropped_or_obstructed'
  | 'low_light_or_glare'
  | 'wrong_angle'
  | 'wrong_object'
  | 'wrong_object_part'
  | 'damage_not_visible'
  | 'claim_mismatch'
  | 'possible_manipulation'
  | 'non_original_image'
  | 'text_instruction_present'
  | 'user_history_risk'
  | 'manual_review_required';

export interface ClaimInput {
  user_id: string;
  image_paths: string;
  user_claim: string;
  claim_object: ClaimObject;
}

export interface UserHistory {
  user_id: string;
  past_claim_count: number;
  accept_claim: number;
  manual_review_claim: number;
  rejected_claim: number;
  last_90_days_claim_count: number;
  history_flags: string; // semicolon-separated history flags
  history_summary: string;
}

export interface EvidenceRequirement {
  requirement_id: string;
  claim_object: string; // 'car' | 'laptop' | 'package' | 'all'
  applies_to: string; // issue family description
  minimum_image_evidence: string;
}

export interface ClaimOutput {
  user_id: string;
  image_paths: string;
  user_claim: string;
  claim_object: ClaimObject;
  evidence_standard_met: boolean;
  evidence_standard_met_reason: string;
  risk_flags: string; // semicolon-separated risk flags
  issue_type: IssueType;
  object_part: ObjectPart;
  claim_status: ClaimStatus;
  claim_status_justification: string;
  supporting_image_ids: string; // semicolon-separated image IDs or 'none'
  valid_image: boolean;
  severity: Severity;
}
