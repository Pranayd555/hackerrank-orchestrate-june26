import { ClaimObject, IssueType, ObjectPart } from '../types';

export interface ExtractedClaim {
  part: ObjectPart;
  issue: IssueType;
}

export class ClaimExtractor {
  private containsKeyword(text: string, keywords: string[]): boolean {
    const escaped = keywords.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'i');
    return pattern.test(text);
  }

  /**
   * Deterministically extracts the claimed object part and issue type from the sanitized conversation text
   * using multilingual keyword-matching heuristics with strict word boundaries.
   */
  public extractFromText(claimObject: ClaimObject, text: string): ExtractedClaim {
    const lower = text.toLowerCase();

    if (claimObject === 'car') {
      let part: ObjectPart = 'unknown';
      let issue: IssueType = 'unknown';

      // 1. Part matching
      if (this.containsKeyword(lower, ['rear bumper', 'back bumper', 'parachoques trasero'])) {
        part = 'rear_bumper';
      } else if (this.containsKeyword(lower, ['front bumper', 'parachoques delantero'])) {
        part = 'front_bumper';
      } else if (this.containsKeyword(lower, ['windshield', 'front glass', 'wind shield'])) {
        part = 'windshield';
      } else if (this.containsKeyword(lower, ['side mirror', 'espejo', 'left mirror', 'right mirror'])) {
        part = 'side_mirror';
      } else if (this.containsKeyword(lower, ['taillight', 'tail light', 'back light'])) {
        part = 'taillight';
      } else if (this.containsKeyword(lower, ['headlight', 'head light'])) {
        part = 'headlight';
      } else if (this.containsKeyword(lower, ['door', 'puerta'])) {
        part = 'door';
      } else if (this.containsKeyword(lower, ['hood', 'capo', 'top panel'])) {
        part = 'hood';
      } else if (this.containsKeyword(lower, ['fender'])) {
        part = 'fender';
      } else if (this.containsKeyword(lower, ['quarter panel'])) {
        part = 'quarter_panel';
      } else if (this.containsKeyword(lower, ['body', 'panel'])) {
        part = 'body';
      }

      // 2. Issue matching
      if (this.containsKeyword(lower, ['shatter', 'shattered'])) {
        issue = 'glass_shatter';
      } else if (this.containsKeyword(lower, ['crack', 'cracked'])) {
        issue = 'crack';
      } else if (this.containsKeyword(lower, ['dent', 'dented', 'bump', 'bumps', 'bumped', 'hail'])) {
        issue = 'dent';
      } else if (this.containsKeyword(lower, ['scratch', 'scratched', 'scrape', 'scraped', 'mark', 'marks'])) {
        issue = 'scratch';
      } else if (this.containsKeyword(lower, ['broken', 'toot'])) {
        issue = 'broken_part';
      } else if (this.containsKeyword(lower, ['missing', 'lost', 'faltan'])) {
        issue = 'missing_part';
      }

      return { part, issue };
    }

    if (claimObject === 'laptop') {
      let part: ObjectPart = 'unknown';
      let issue: IssueType = 'unknown';

      // 1. Part matching
      if (this.containsKeyword(lower, ['screen', 'display', 'pantalla'])) {
        part = 'screen';
      } else if (this.containsKeyword(lower, ['keyboard', 'keycap', 'keycaps', 'keys', 'teclado', 'teclas'])) {
        part = 'keyboard';
      } else if (this.containsKeyword(lower, ['trackpad', 'touchpad', 'palm-rest', 'palm rest'])) {
        part = 'trackpad';
      } else if (this.containsKeyword(lower, ['hinge', 'hinges', 'mechanically'])) {
        part = 'hinge';
      } else if (this.containsKeyword(lower, ['lid', 'outer lid'])) {
        part = 'lid';
      } else if (this.containsKeyword(lower, ['corner', 'corners'])) {
        part = 'corner';
      } else if (this.containsKeyword(lower, ['port', 'ports'])) {
        part = 'port';
      } else if (this.containsKeyword(lower, ['base', 'bottom'])) {
        part = 'base';
      } else if (this.containsKeyword(lower, ['body', 'outer body', 'edge'])) {
        part = 'body';
      }

      // 2. Issue matching
      if (this.containsKeyword(lower, ['crack', 'cracked', 'shattered'])) {
        issue = 'crack';
      } else if (this.containsKeyword(lower, ['stain', 'stained', 'liquid', 'spill', 'spills', 'coffee', 'water'])) {
        issue = 'stain';
      } else if (this.containsKeyword(lower, ['missing', 'came off', 'faltan'])) {
        issue = 'missing_part';
      } else if (this.containsKeyword(lower, ['dent', 'dented'])) {
        issue = 'dent';
      } else if (this.containsKeyword(lower, ['scratch', 'scratched'])) {
        issue = 'scratch';
      } else if (this.containsKeyword(lower, ['broken'])) {
        issue = 'broken_part';
      }

      return { part, issue };
    }

    if (claimObject === 'package') {
      let part: ObjectPart = 'unknown';
      let issue: IssueType = 'unknown';

      // 1. Part matching
      if (this.containsKeyword(lower, ['corner', 'corners'])) {
        part = 'package_corner';
      } else if (this.containsKeyword(lower, ['side', 'sides'])) {
        part = 'package_side';
      } else if (this.containsKeyword(lower, ['seal', 'tape', 'flap', 'flaps'])) {
        part = 'seal';
      } else if (this.containsKeyword(lower, ['label', 'labels'])) {
        part = 'label';
      } else if (this.containsKeyword(lower, ['contents', 'item', 'items', 'product', 'products', 'inside', 'missing product'])) {
        part = 'contents';
      } else if (this.containsKeyword(lower, ['box', 'boxes', 'package', 'packages', 'parcel', 'parcels'])) {
        part = 'box';
      }

      // 2. Issue matching
      if (this.containsKeyword(lower, ['crushed', 'crush', 'squashed', 'bent', 'dab'])) {
        issue = 'crushed_packaging';
      } else if (this.containsKeyword(lower, ['torn', 'open', 'opened', 'phati'])) {
        issue = 'torn_packaging';
      } else if (this.containsKeyword(lower, ['water', 'wet', 'rain'])) {
        issue = 'water_damage';
      } else if (this.containsKeyword(lower, ['stain', 'stained', 'oily', 'oil'])) {
        issue = 'stain';
      }

      return { part, issue };
    }

    return { part: 'unknown', issue: 'unknown' };
  }
}

