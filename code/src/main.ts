import * as path from 'path';
import * as fs from 'fs';
import { env } from './config/env';
import { CSVService } from './services/csv.service';
import { ImageService } from './services/image.service';
import { HistoryService } from './services/history.service';
import { EvidenceService } from './services/evidence.service';
import { ClaimExtractor } from './analyzers/claim-extractor';
import { ConversationSanitizer } from './analyzers/conversation-sanitizer';
import { ClaimComparator } from './analyzers/comparator';
import { EvidenceEvaluator } from './analyzers/evidence.evaluator';
import { DecisionEngine } from './analyzers/decision.analyzer';
import { OllamaProvider } from './providers/ollama.provider';
import { VisionAnalyzer } from './analyzers/vision.analyzer';
import { ClaimOutput, ClaimInput } from './types';
import { ModelObservation } from './schemas/model.schemas';

async function main() {
  console.log('🚀 Running main evidence verification pipeline...');

  const claimsCSVPath = path.join(env.WORKSPACE_ROOT, 'dataset/claims.csv');
  const userHistoryCSVPath = path.join(env.WORKSPACE_ROOT, 'dataset/user_history.csv');
  const evidenceCSVPath = path.join(env.WORKSPACE_ROOT, 'dataset/evidence_requirements.csv');
  const outputCSVPath = path.join(env.WORKSPACE_ROOT, 'output.csv');

  const csvService = new CSVService();
  const imageService = new ImageService(env.WORKSPACE_ROOT);

  // Load datasets
  const claims = csvService.readClaims(claimsCSVPath);
  const userHistory = csvService.readUserHistory(userHistoryCSVPath);
  const requirements = csvService.readEvidenceRequirements(evidenceCSVPath);

  // Instantiate services
  const historyService = new HistoryService(userHistory);
  const evidenceService = new EvidenceService(requirements);
  const sanitizer = new ConversationSanitizer();
  const claimExtractor = new ClaimExtractor();
  const claimComparator = new ClaimComparator();
  const evidenceEvaluator = new EvidenceEvaluator();
  const decisionEngine = new DecisionEngine();

  // Active vision provider
  const provider = new OllamaProvider();
  const analyzer = new VisionAnalyzer(provider);

  const results: ClaimOutput[] = [];

  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i];
    console.log(`Processing claim ${i + 1}/${claims.length} (User: ${claim.user_id}, Object: ${claim.claim_object})`);

    try {
      // 1. Sanitization
      const sanitization = sanitizer.sanitize(claim.user_claim);

      // 2. Claim Extraction
      const expectedClaim = claimExtractor.extractFromText(claim.claim_object, sanitization.sanitizedText);

      // 3. Evidence Rules Mapping
      const imagePaths = claim.image_paths.split(';').filter(p => p.trim().length > 0);
      const matchedReqs = evidenceService.getRequirements(
        claim.claim_object,
        expectedClaim.part,
        expectedClaim.issue,
        imagePaths.length > 1
      ).map(r => r.minimum_image_evidence);

      // 4. Load and Validate images with Sharp
      const imageBuffers = imagePaths.map(p => {
        const absPath = imageService.resolveImagePath(p);
        const filename = path.basename(p);
        const id = filename.split('.')[0];
        const buffer = imageService.readImageBuffer(absPath);
        return { id, buffer, mimeType: 'image/jpeg' };
      });

      const validations = await Promise.all(imageBuffers.map(img => imageService.validateImage(img.buffer)));

      // 5. Model visual observation check
      const observation = await analyzer.analyzeEvidence({
        userClaim: sanitization.sanitizedText,
        claimObject: claim.claim_object,
        extractedPart: expectedClaim.part,
        extractedIssue: expectedClaim.issue,
        images: imageBuffers,
        evidenceRequirements: matchedReqs,
      });

      // 6. User History Lookup
      const historyFlags = historyService.getHistoryRiskFlags(claim.user_id);

      // 7. Evidence Sufficiency Evaluation
      const evidenceEvaluation = evidenceEvaluator.evaluate(
        claim.claim_object,
        expectedClaim.part,
        expectedClaim.issue,
        validations,
        observation
      );

      // 8. Claims comparison
      const comparison = claimComparator.compare(claim.claim_object, expectedClaim, observation);

      // 9. Make final decision
      const output = decisionEngine.makeDecision({
        claimInput: claim,
        sanitization,
        historyFlags,
        evidenceEvaluation,
        comparison,
        observation,
      });

      results.push(output);

    } catch (err) {
      console.error(`❌ Error processing claim row ${i + 1}:`, err);
      // Fail-safe default row to satisfy schema and constraints
      results.push({
        user_id: claim.user_id,
        image_paths: claim.image_paths,
        user_claim: claim.user_claim,
        claim_object: claim.claim_object,
        evidence_standard_met: false,
        evidence_standard_met_reason: `System processing failure: ${(err as Error).message}`,
        risk_flags: 'manual_review_required',
        issue_type: 'unknown',
        object_part: 'unknown',
        claim_status: 'not_enough_information',
        claim_status_justification: `Visual analysis failed due to system exception: ${(err as Error).message}`,
        supporting_image_ids: 'none',
        valid_image: false,
        severity: 'unknown',
      });
    }
  }

  // Write outputs
  csvService.writeOutput(outputCSVPath, results);
  console.log(`🎉 Pipeline completed. Predictions written to: ${outputCSVPath}`);
}

main().catch(err => {
  console.error('❌ Pipeline runtime exception:', err);
  process.exit(1);
});
