import { ClaimObject, IssueType, ObjectPart } from '../types';
import { ModelObservation } from '../schemas/model.schemas';

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

export interface IVisionProvider {
  analyze(input: VisionAnalysisInput): Promise<ModelObservation>;
}
