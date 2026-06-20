import * as fs from 'fs';
import { ClaimInput, UserHistory, EvidenceRequirement, ClaimOutput } from '../types';
import { ClaimInputSchema, UserHistorySchema, EvidenceRequirementSchema } from '../schemas/input.schemas';

export class CSVService {
  /**
   * Parses a CSV string into a 2D array of strings, handling quoted values and newlines inside quotes.
   */
  public parseCSV(content: string): string[][] {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentVal = '';

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const nextChar = content[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentVal += '"';
          i++; // skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentVal);
        currentVal = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(currentVal);
        lines.push(row);
        row = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }

    if (row.length > 0 || currentVal) {
      row.push(currentVal);
      lines.push(row);
    }

    return lines;
  }

  /**
   * Reads and validates the claims input CSV.
   */
  public readClaims(filePath: string): ClaimInput[] {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = this.parseCSV(content);
    if (parsed.length <= 1) return [];

    const headers = parsed[0].map(h => h.trim().replace(/^"|"$/g, ''));
    const claims: ClaimInput[] = [];

    for (let i = 1; i < parsed.length; i++) {
      const row = parsed[i];
      if (row.length === headers.length) {
        const obj: any = {};
        headers.forEach((h, index) => {
          obj[h] = row[index];
        });
        const validated = ClaimInputSchema.safeParse(obj);
        if (validated.success) {
          claims.push(validated.data);
        } else {
          console.warn(`⚠️ Skipped invalid claim row ${i}:`, validated.error.format());
        }
      }
    }
    return claims;
  }

  /**
   * Reads and validates the user history CSV.
   */
  public readUserHistory(filePath: string): UserHistory[] {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = this.parseCSV(content);
    if (parsed.length <= 1) return [];

    const headers = parsed[0].map(h => h.trim().replace(/^"|"$/g, ''));
    const history: UserHistory[] = [];

    for (let i = 1; i < parsed.length; i++) {
      const row = parsed[i];
      if (row.length === headers.length) {
        const obj: any = {};
        headers.forEach((h, index) => {
          obj[h] = row[index];
        });
        const validated = UserHistorySchema.safeParse(obj);
        if (validated.success) {
          history.push(validated.data);
        } else {
          console.warn(`⚠️ Skipped invalid user history row ${i}:`, validated.error.format());
        }
      }
    }
    return history;
  }

  /**
   * Reads and validates evidence requirements CSV.
   */
  public readEvidenceRequirements(filePath: string): EvidenceRequirement[] {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = this.parseCSV(content);
    if (parsed.length <= 1) return [];

    const headers = parsed[0].map(h => h.trim().replace(/^"|"$/g, ''));
    const requirements: EvidenceRequirement[] = [];

    for (let i = 1; i < parsed.length; i++) {
      const row = parsed[i];
      if (row.length === headers.length) {
        const obj: any = {};
        headers.forEach((h, index) => {
          obj[h] = row[index];
        });
        const validated = EvidenceRequirementSchema.safeParse(obj);
        if (validated.success) {
          requirements.push(validated.data);
        } else {
          console.warn(`⚠️ Skipped invalid requirement row ${i}:`, validated.error.format());
        }
      }
    }
    return requirements;
  }

  /**
   * Escapes a cell value for CSV generation.
   */
  private escapeCSVCell(val: string): string {
    const clean = val.replace(/"/g, '""');
    return `"${clean}"`;
  }

  /**
   * Writes the prediction results to the specified output CSV path in the exact required column order.
   */
  public writeOutput(filePath: string, results: ClaimOutput[]): void {
    const headers = [
      'user_id',
      'image_paths',
      'user_claim',
      'claim_object',
      'evidence_standard_met',
      'evidence_standard_met_reason',
      'risk_flags',
      'issue_type',
      'object_part',
      'claim_status',
      'claim_status_justification',
      'supporting_image_ids',
      'valid_image',
      'severity'
    ];

    const lines: string[] = [];
    // Write headers
    lines.push(headers.map(h => `"${h}"`).join(','));

    // Write data rows
    results.forEach(row => {
      const line = [
        this.escapeCSVCell(row.user_id),
        this.escapeCSVCell(row.image_paths),
        this.escapeCSVCell(row.user_claim),
        this.escapeCSVCell(row.claim_object),
        row.evidence_standard_met ? 'true' : 'false',
        this.escapeCSVCell(row.evidence_standard_met_reason),
        this.escapeCSVCell(row.risk_flags),
        this.escapeCSVCell(row.issue_type),
        this.escapeCSVCell(row.object_part),
        this.escapeCSVCell(row.claim_status),
        this.escapeCSVCell(row.claim_status_justification),
        this.escapeCSVCell(row.supporting_image_ids),
        row.valid_image ? 'true' : 'false',
        this.escapeCSVCell(row.severity)
      ].join(',');
      lines.push(line);
    });

    // Write file using UTF-8 and standard Unix \n line endings as requested by AGENTS.md
    fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
  }
}
