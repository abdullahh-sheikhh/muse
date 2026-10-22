// Turn a spoken inventory number into the printed form.
// "I N V four eight eight four" → "INV 4884"; "quatre mille huit cent quatre-vingt-quatre" → "4884".

const UNITS: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  zéro: 0, zero_fr: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, sept: 7, huit: 8,
  neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
  vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
};
// "six" is shared by en/fr.
const SINGLE_DIGIT = new Set(Object.keys(UNITS).filter((k) => UNITS[k]! <= 9));
const HUNDRED = new Set(["hundred", "cent", "cents"]);
const THOUSAND = new Set(["thousand", "mille"]);
const FILLER = new Set(["and", "et", "number", "numéro", "numero", "no", "dash", "tiret"]);

function isNumWord(t: string) {
  return t in UNITS || HUNDRED.has(t) || THOUSAND.has(t);
}

function parseCompound(words: string[]) {
  let total = 0;
  let current = 0;
  for (const w of words) {
    if (HUNDRED.has(w)) current = (current || 1) * 100;
    else if (THOUSAND.has(w)) {
      total += (current || 1) * 1000;
      current = 0;
    } else if ((w === "vingt" || w === "vingts") && current % 100 === 4) current += 76; // quatre-vingt
    else current += UNITS[w]!;
  }
  return String(total + current);
}

function numberGroup(words: string[]) {
  if (words.every((w) => SINGLE_DIGIT.has(w))) return words.map((w) => String(UNITS[w])).join("");
  return parseCompound(words);
}

export function normalizeSpokenRef(text: string): string {
  const tokens = text
    .toLowerCase()
    .replace(/[-–—]/g, " ")
    .replace(/[.,;:!?'"]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !FILLER.has(t));

  const groups: string[] = [];
  let letters = "";
  let digits = "";
  let words: string[] = [];
  const flushWords = () => {
    if (words.length) digits += numberGroup(words);
    words = [];
  };
  const flushDigits = () => {
    flushWords();
    if (digits) groups.push(digits);
    digits = "";
  };
  const flushLetters = () => {
    if (letters) groups.push(letters.toUpperCase());
    letters = "";
  };

  for (const t of tokens) {
    if (isNumWord(t)) {
      flushLetters();
      words.push(t);
    } else if (/^\d+$/.test(t)) {
      flushLetters();
      flushWords();
      digits += t;
    } else if (/^[a-z]$/.test(t) || /^[a-z]+$/.test(t)) {
      flushDigits();
      letters += t;
    } else {
      flushLetters();
      flushDigits();
      groups.push(t.toUpperCase());
    }
  }
  flushLetters();
  flushDigits();
  return groups.join(" ");
}
