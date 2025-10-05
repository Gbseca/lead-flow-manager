import type { Lead } from '../types';

interface ParseOptions {
  hideRJ: boolean;
  operatorPrefix: string;
}

interface ParsedLine {
  name: string;
  ddd?: string;
  local?: string;
  raw: string;
  international: boolean;
  internationalDigits?: string;
  invalid?: boolean;
}

function onlyDigits(s: string): string {
  return (s || '').toString().replace(/\D/g, '');
}

function parseLineGeneric(line: string): ParsedLine | null {
  const raw = (line || '').trim();
  if (!raw) return null;

  const plusMatch = raw.match(/\+(\d{6,15})/);
  if (plusMatch) {
    const all = plusMatch[1];
    return {
      raw,
      international: true,
      internationalDigits: all,
      name: raw.replace(plusMatch[0], '').replace(/[-–—|;:\t(),]+/g, ' ').trim() || '--',
    };
  }

  const digits = onlyDigits(raw);
  if (digits.length < 10) return { raw, invalid: true, name: raw, international: false };

  let d = digits;
  if (d.startsWith('55') && d.length > 10) d = d.slice(2);
  if (d.length > 11) d = d.slice(-11);

  const ddd = d.slice(0, 2);
  const local = d.slice(2);
  
  const patternParts = d.split('').map(c => c.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\D*').join('');
  const rx = new RegExp(patternParts, 'g');
  let name = raw.replace(rx, '').replace(/[-–—|;,\t()]+/g, ' ').trim();

  if (!name) {
    const parts = raw.split(/[,;\t\-|]/).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2 && onlyDigits(parts[parts.length - 1]).length >= 10) {
      name = parts.slice(0, parts.length - 1).join(' ');
    } else {
      name = '--';
    }
  }

  return { name, ddd, local, raw, international: false };
}

function normalizeParsed(p: ParsedLine, opts: ParseOptions): Lead | null {
  if (!p || p.invalid) return null;
  const { hideRJ, operatorPrefix } = opts;
  const now = Date.now();
  
  const lead: Omit<Lead, 'id'> = {
    name: p.name || '--',
    original: p.raw || '',
    attempts: [false, false, false],
    attemptsResults: [null, null, null],
    currentAttempt: 0,
    result: '',
    locked: false,
    note: '',
    favorite: false,
    scheduleISO: '',
    onHold: false,
    createdAt: now,
    priority: 3,
    display: '',
    tel: '',
    wa: '',
    international: p.international,
  };

  if (p.international) {
    lead.international = true;
    lead.internationalDigits = p.internationalDigits;
    lead.display = `+${p.internationalDigits}`;
    lead.tel = `tel:+${p.internationalDigits}`;
    lead.wa = `https://wa.me/${p.internationalDigits}`;
  } else {
    lead.international = false;
    lead.ddd = p.ddd;
    lead.local = p.local;
    const RJs = ['21', '22', '24'];
    const isRJ = RJs.includes(p.ddd!);
    const fullNumber = `${p.ddd}${p.local}`;

    lead.display = (isRJ && hideRJ) ? p.local! : fullNumber;
    
    let callDigits;
    if (isRJ && hideRJ) {
      callDigits = p.local!;
    } else {
      callDigits = operatorPrefix ? `0${operatorPrefix}${fullNumber}` : fullNumber;
    }
    lead.tel = `tel:${callDigits}`;
    
    lead.wa = `https://wa.me/55${fullNumber}`;
  }

  return { ...lead, id: `${lead.wa}-${now}-${Math.random()}` };
}

export async function importFromText(txt: string, opts: ParseOptions): Promise<Lead[]> {
  const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const mapped = lines.map(l => parseLineGeneric(l)).filter((p): p is ParsedLine => p !== null);
  const normalized = mapped.map(p => normalizeParsed(p, opts)).filter((l): l is Lead => l !== null);
  return normalized;
}