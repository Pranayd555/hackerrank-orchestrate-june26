import { ClaimInput, ClaimOutput, ClaimStatus, Severity, IssueType, ObjectPart, ClaimObject } from '../types';
import { SanitizationResult } from './conversation-sanitizer';
import { ComparisonResult } from './comparator';
import { EvidenceEvaluationResult } from './evidence.evaluator';
import { ModelObservation } from '../schemas/model.schemas';
import { ClaimOutputSchema } from '../schemas/output.schemas';

export interface DecisionInput {
  claimInput: ClaimInput;
  sanitization: SanitizationResult;
  historyFlags: string[];
  evidenceEvaluation: EvidenceEvaluationResult;
  comparison: ComparisonResult;
  observation: ModelObservation;
}

export class DecisionEngine {
  /**
   * Deterministically decides the severity based on object, part, and issue type.
   */
  private determineSeverity(
    claimObject: ClaimObject,
    part: ObjectPart,
    issue: IssueType,
    damageVisible: boolean
  ): Severity {
    if (!damageVisible || issue === 'none') {
      return 'none';
    }
    if (issue === 'unknown') {
      return 'unknown';
    }

    if (claimObject === 'package') {
      // Package exterior damage (crushed, torn, wet)
      if (issue === 'water_damage' || issue === 'stain') return 'medium';
      if (issue === 'crushed_packaging' || issue === 'torn_packaging') return 'medium';
      return 'low';
    }

    if (claimObject === 'laptop') {
      if (part === 'corner') return 'low';
      if (part === 'screen') return 'medium';
      if (part === 'keyboard') return 'medium';
      if (part === 'trackpad') return 'medium';
      if (part === 'hinge') return 'medium';
      if (issue === 'crack') return 'medium';
      if (issue === 'broken_part') return 'medium';
      if (issue === 'stain') return 'medium';
      return 'low';
    }

    if (claimObject === 'car') {
      if (issue === 'scratch') return 'low';
      if (issue === 'dent') {
        if (part === 'door' || part === 'rear_bumper' || part === 'front_bumper') return 'medium';
        return 'low';
      }
      if (issue === 'crack') return 'medium';
      if (issue === 'broken_part') {
        if (part === 'front_bumper' || part === 'rear_bumper') return 'high';
        return 'medium';
      }
      if (issue === 'glass_shatter' || issue === 'missing_part') {
        return 'high';
      }
    }

    return 'medium';
  }

  /**
   * Orchestrates the final claim decision based on history, visual evidence evaluation, and claim comparison.
   * Enforces strict schema validations and rules.
   */
  public makeDecision(input: DecisionInput): ClaimOutput {
    const { claimInput, sanitization, historyFlags, evidenceEvaluation, comparison, observation } = input;

    let claim_status: ClaimStatus = 'not_enough_information';
    let severity: Severity = 'unknown';
    let issue_type: IssueType = 'unknown';
    let object_part: ObjectPart = 'unknown';
    let justification = '';

    // 1. Determine claim_status based on Decision Rules
    if (!evidenceEvaluation.valid_image || !evidenceEvaluation.evidence_standard_met) {
      claim_status = 'not_enough_information';
      issue_type = 'unknown';
      object_part = 'unknown';
      severity = 'unknown';
      justification = evidenceEvaluation.evidence_standard_met_reason;
    } else {
      // Evidence is sufficient, evaluate comparison details
      if (comparison.partMatch && comparison.issueMatch && observation.damage_visible) {
        claim_status = 'supported';
        issue_type = observation.visible_issue as IssueType;
        object_part = observation.visible_part as ObjectPart;
        justification = comparison.justification;

        // Deterministically assign severity
        severity = this.determineSeverity(claimInput.claim_object, object_part, issue_type, true);

        // Ground justification with history flags warning if present
        if (historyFlags.includes('user_history_risk')) {
          justification += ' However, user history indicates prior risk flags.';
        }
      } else {
        // If the part is visible but the issue is absent or different, or wrong object is visible
        claim_status = 'contradicted';
        issue_type = observation.visible_issue as IssueType;
        object_part = observation.visible_part as ObjectPart;
        justification = comparison.justification;

        // If wrong_object is flagged, overwrite part and issue to unknown as they belong to the wrong object
        if (comparison.mismatchFlags.includes('wrong_object')) {
          issue_type = 'unknown';
          object_part = 'unknown';
          severity = 'low'; // Wrong object showing damage has a low severity by default
        } else if (observation.damage_visible) {
          severity = this.determineSeverity(claimInput.claim_object, object_part, issue_type, true);
        } else {
          severity = 'none';
        }
      }
    }

    // Double check specific not_enough_information triggers
    if (!observation.part_visible && claim_status !== 'not_enough_information') {
      claim_status = 'not_enough_information';
      issue_type = 'unknown';
      object_part = 'unknown';
      severity = 'unknown';
    }

    // 2. Compile and filter Risk Flags
    const combinedFlags: string[] = [];

    // History risk flags
    historyFlags.forEach(f => {
      if (f !== 'none') combinedFlags.push(f);
    });

    // Sanitization flags
    if (sanitization.hasInjectionAttempt) {
      combinedFlags.push('text_instruction_present');
    }

    // Visual mismatch flags
    comparison.mismatchFlags.forEach(f => {
      if (f !== 'none') combinedFlags.push(f);
    });

    // Quality flags
    evidenceEvaluation.quality_flags.forEach(f => {
      if (f !== 'none') combinedFlags.push(f);
    });

    // Apply manual review requirement triggers:
    // Any serious mismatch, history risk, or injection forces manual review
    const triggersManualReview = 
      combinedFlags.includes('claim_mismatch') ||
      combinedFlags.includes('wrong_object') ||
      combinedFlags.includes('wrong_object_part') ||
      combinedFlags.includes('non_original_image') ||
      combinedFlags.includes('possible_manipulation') ||
      combinedFlags.includes('user_history_risk') ||
      combinedFlags.includes('text_instruction_present');

    if (triggersManualReview && !combinedFlags.includes('manual_review_required')) {
      combinedFlags.push('manual_review_required');
    }

    // Deduplicate flags
    const uniqueFlags = [...new Set(combinedFlags)].filter(f => f.length > 0);
    const risk_flags = uniqueFlags.length > 0 ? uniqueFlags.join(';') : 'none';

    // 3. Format supporting_image_ids
    let supporting_image_ids = 'none';
    if (claim_status === 'supported' || (claim_status === 'contradicted' && observation.damage_visible)) {
      if (observation.supporting_image_ids && observation.supporting_image_ids.length > 0) {
        const validIds = observation.supporting_image_ids.map(id => id.trim()).filter(id => id.length > 0);
        if (validIds.length > 0) {
          supporting_image_ids = validIds.join(';');
        }
      }
    }

    // Construct raw output
    const rawOutput: ClaimOutput = {
      user_id: claimInput.user_id,
      image_paths: claimInput.image_paths,
      user_claim: claimInput.user_claim,
      claim_object: claimInput.claim_object,
      evidence_standard_met: evidenceEvaluation.evidence_standard_met,
      evidence_standard_met_reason: evidenceEvaluation.evidence_standard_met_reason,
      risk_flags,
      issue_type,
      object_part,
      claim_status,
      claim_status_justification: justification || 'No justification provided.',
      supporting_image_ids,
      valid_image: evidenceEvaluation.valid_image,
      severity,
    };

    // Strict validation against Zod schema to fail early if invalid
    const validated = ClaimOutputSchema.safeParse(rawOutput);
    if (!validated.success) {
      console.error('❌ Output validation failed for claim:', validated.error.format());
      console.error('Raw output:', rawOutput);
      return {
        ...rawOutput,
        issue_type: 'unknown',
        object_part: 'unknown',
        claim_status: 'not_enough_information',
        claim_status_justification: 'Schema validation failed during decision orchestrations.',
        severity: 'unknown',
        supporting_image_ids: 'none',
      };
    }

    return rawOutput;
  }
}
