import { UserHistory } from '../types';

export class HistoryService {
  private historyMap: Map<string, UserHistory> = new Map();

  constructor(histories: UserHistory[]) {
    histories.forEach(h => {
      this.historyMap.set(h.user_id, h);
    });
  }

  /**
   * Looks up a user's prior history record.
   */
  public lookupHistory(userId: string): UserHistory | undefined {
    return this.historyMap.get(userId);
  }

  /**
   * Helper to inspect the risk categories for a user's history.
   * Returns a list of candidate risk flags based entirely on user history.
   */
  public getHistoryRiskFlags(userId: string): string[] {
    const history = this.lookupHistory(userId);
    if (!history) {
      return []; // New user, no prior risk
    }

    const candidateFlags: string[] = [];

    // Parse existing history flags from CSV
    if (history.history_flags && history.history_flags !== 'none') {
      const flags = history.history_flags.split(';').map(f => f.trim());
      flags.forEach(f => {
        if (f.length > 0 && f !== 'none') {
          candidateFlags.push(f);
        }
      });
    }

    // Heuristics based on prior claim counts and rejection rates:
    // If rejection rate is high (e.g. >= 40%) and has multiple claims
    if (history.past_claim_count >= 3) {
      const rejectionRate = history.rejected_claim / history.past_claim_count;
      if (rejectionRate >= 0.4) {
        if (!candidateFlags.includes('user_history_risk')) {
          candidateFlags.push('user_history_risk');
        }
      }
    }

    // If history flags indicate risk, we should also flag manual review required
    if (candidateFlags.includes('user_history_risk') || candidateFlags.includes('manual_review_required')) {
      if (!candidateFlags.includes('manual_review_required')) {
        candidateFlags.push('manual_review_required');
      }
    }

    return candidateFlags;
  }
}
