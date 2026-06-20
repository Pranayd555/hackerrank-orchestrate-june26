import { ClaimObject, IssueType, ObjectPart } from '../types';

export interface ExtractedClaim {
  part: ObjectPart;
  issue: IssueType;
}

export class ClaimExtractor {
  /**
   * Deterministically extracts the claimed object part and issue type from the sanitized conversation text
   * using multilingual keyword-matching heuristics.
   */
  public extractFromText(claimObject: ClaimObject, text: string): ExtractedClaim {
    const lower = text.toLowerCase();

    if (claimObject === 'car') {
      let part: ObjectPart = 'unknown';
      let issue: IssueType = 'unknown';

      // 1. Part matching
      if (lower.includes('rear bumper') || lower.includes('back bumper') || lower.includes('rear bumper') || lower.includes('parachoques trasero')) {
        part = 'rear_bumper';
      } else if (lower.includes('front bumper') || lower.includes('parachoques delantero')) {
        part = 'front_bumper';
      } else if (lower.includes('windshield') || lower.includes('front glass') || lower.includes('wind shield')) {
        part = 'windshield';
      } else if (lower.includes('side mirror') || lower.includes('espejo') || lower.includes('left mirror') || lower.includes('right mirror')) {
        part = 'side_mirror';
      } else if (lower.includes('taillight') || lower.includes('tail light') || lower.includes('back light')) {
        part = 'taillight';
      } else if (lower.includes('headlight') || lower.includes('head light')) {
        part = 'headlight';
      } else if (lower.includes('door') || lower.includes('puerta')) {
        part = 'door';
      } else if (lower.includes('hood') || lower.includes('capo') || lower.includes('top panel')) {
        part = 'hood';
      } else if (lower.includes('fender')) {
        part = 'fender';
      } else if (lower.includes('quarter panel')) {
        part = 'quarter_panel';
      } else if (lower.includes('body') || lower.includes('panel')) {
        part = 'body';
      }

      // 2. Issue matching
      if (lower.includes('shatter') || lower.includes('shattered')) {
        issue = 'glass_shatter';
      } else if (lower.includes('crack') || lower.includes('cracked')) {
        issue = 'crack';
      } else if (lower.includes('dent') || lower.includes('dented') || lower.includes('bump')) {
        issue = 'dent';
      } else if (lower.includes('scratch') || lower.includes('scratched') || lower.includes('scrape') || lower.includes('mark')) {
        issue = 'scratch';
      } else if (lower.includes('broken') || lower.includes('toot')) {
        issue = 'broken_part';
      } else if (lower.includes('missing') || lower.includes('lost') || lower.includes('faltan')) {
        issue = 'missing_part';
      }

      return { part, issue };
    }

    if (claimObject === 'laptop') {
      let part: ObjectPart = 'unknown';
      let issue: IssueType = 'unknown';

      // 1. Part matching
      if (lower.includes('screen') || lower.includes('display') || lower.includes('pantalla')) {
        part = 'screen';
      } else if (lower.includes('keyboard') || lower.includes('keycap') || lower.includes('keys') || lower.includes('teclado') || lower.includes('teclas')) {
        part = 'keyboard';
      } else if (lower.includes('trackpad') || lower.includes('touchpad') || lower.includes('palm-rest') || lower.includes('palm rest')) {
        part = 'trackpad';
      } else if (lower.includes('hinge') || lower.includes('mechanically')) {
        part = 'hinge';
      } else if (lower.includes('lid') || lower.includes('outer lid')) {
        part = 'lid';
      } else if (lower.includes('corner')) {
        part = 'corner';
      } else if (lower.includes('port') || lower.includes('ports')) {
        part = 'port';
      } else if (lower.includes('base') || lower.includes('bottom')) {
        part = 'base';
      } else if (lower.includes('body') || lower.includes('outer body') || lower.includes('edge')) {
        part = 'body';
      }

      // 2. Issue matching
      if (lower.includes('crack') || lower.includes('cracked') || lower.includes('shattered')) {
        issue = 'crack';
      } else if (lower.includes('stain') || lower.includes('liquid') || lower.includes('spill') || lower.includes('coffee') || lower.includes('water')) {
        issue = 'stain';
      } else if (lower.includes('missing') || lower.includes('came off') || lower.includes('faltan')) {
        issue = 'missing_part';
      } else if (lower.includes('dent') || lower.includes('dented')) {
        issue = 'dent';
      } else if (lower.includes('scratch') || lower.includes('scratched')) {
        issue = 'scratch';
      } else if (lower.includes('broken')) {
        issue = 'broken_part';
      }

      return { part, issue };
    }

    if (claimObject === 'package') {
      let part: ObjectPart = 'unknown';
      let issue: IssueType = 'unknown';

      // 1. Part matching
      if (lower.includes('corner')) {
        part = 'package_corner';
      } else if (lower.includes('side')) {
        part = 'package_side';
      } else if (lower.includes('seal') || lower.includes('tape') || lower.includes('flap')) {
        part = 'seal';
      } else if (lower.includes('label')) {
        part = 'label';
      } else if (lower.includes('contents') || lower.includes('item') || lower.includes('product') || lower.includes('inside') || lower.includes('missing product')) {
        part = 'contents';
      } else if (lower.includes('box') || lower.includes('package') || lower.includes('parcel')) {
        part = 'box';
      }

      // 2. Issue matching
      if (lower.includes('crushed') || lower.includes('crush') || lower.includes('squashed') || lower.includes('bent') || lower.includes('dab')) {
        issue = 'crushed_packaging';
      } else if (lower.includes('torn') || lower.includes('open') || lower.includes('phati')) {
        issue = 'torn_packaging';
      } else if (lower.includes('water') || lower.includes('wet') || lower.includes('rain')) {
        issue = 'water_damage';
      } else if (lower.includes('stain') || lower.includes('oily') || lower.includes('oil')) {
        issue = 'stain';
      }

      return { part, issue };
    }

    return { part: 'unknown', issue: 'unknown' };
  }
}
