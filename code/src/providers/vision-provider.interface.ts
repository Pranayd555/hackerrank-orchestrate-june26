import { ClaimObject, IssueType, ObjectPart, ClaimStatus, Severity } from '../types';

export interface VisionAnalysisInput {
  userClaim: string;
  claimObject: ClaimObject;
  extractedPart: ObjectPart;
  extractedIssue: IssueType;
  images: Array<{
    id: string; // filename without extension
    buffer: Buffer;
    mimeType: string;
  }>;
  evidenceRequirements: string[];
}

export interface VisionAnalysisResult {
  evidence_standard_met: boolean;
  evidence_standard_met_reason: string;
  visual_risk_flags: string[]; // List of matching risk flags (excluding user history flags)
  issue_type: IssueType;
  object_part: ObjectPart;
  claim_status: ClaimStatus;
  claim_status_justification: string;
  supporting_image_ids: string[]; // IDs of images supporting the decision
  valid_image: boolean;
  severity: Severity;
  confidence: number; // Score between 0.0 and 1.0 indicating model confidence
}

export interface IVisionProvider {
  analyze(input: VisionAnalysisInput): Promise<VisionAnalysisResult>;
}
