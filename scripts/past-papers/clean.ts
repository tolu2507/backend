/** Turns the HTML that question sites publish into clean plain text the AI (and people) can read. */

/** Every HTML 4 named entity (generated from the standard list), with &nbsp; as a plain space. */
const ENTITIES: Record<string, string> = {
  Aacute: '\u00c1', aacute: '\u00e1', Acirc: '\u00c2', acirc: '\u00e2', acute: '\u00b4', AElig: '\u00c6', aelig: '\u00e6',
  Agrave: '\u00c0', agrave: '\u00e0', alefsym: '\u2135', Alpha: '\u0391', alpha: '\u03b1', amp: '&', and: '\u2227', ang: '\u2220',
  Aring: '\u00c5', aring: '\u00e5', asymp: '\u2248', Atilde: '\u00c3', atilde: '\u00e3', Auml: '\u00c4', auml: '\u00e4', bdquo: '\u201e',
  Beta: '\u0392', beta: '\u03b2', brvbar: '\u00a6', bull: '\u2022', cap: '\u2229', Ccedil: '\u00c7', ccedil: '\u00e7', cedil: '\u00b8',
  cent: '\u00a2', Chi: '\u03a7', chi: '\u03c7', circ: '\u02c6', clubs: '\u2663', cong: '\u2245', copy: '\u00a9', crarr: '\u21b5',
  cup: '\u222a', curren: '\u00a4', Dagger: '\u2021', dagger: '\u2020', dArr: '\u21d3', darr: '\u2193', deg: '\u00b0', Delta: '\u0394',
  delta: '\u03b4', diams: '\u2666', divide: '\u00f7', Eacute: '\u00c9', eacute: '\u00e9', Ecirc: '\u00ca', ecirc: '\u00ea',
  Egrave: '\u00c8', egrave: '\u00e8', empty: '\u2205', emsp: '\u2003', ensp: '\u2002', Epsilon: '\u0395', epsilon: '\u03b5',
  equiv: '\u2261', Eta: '\u0397', eta: '\u03b7', ETH: '\u00d0', eth: '\u00f0', Euml: '\u00cb', euml: '\u00eb', euro: '\u20ac',
  exist: '\u2203', fnof: '\u0192', forall: '\u2200', frac12: '\u00bd', frac14: '\u00bc', frac34: '\u00be', frasl: '\u2044',
  Gamma: '\u0393', gamma: '\u03b3', ge: '\u2265', gt: '>', hArr: '\u21d4', harr: '\u2194', hearts: '\u2665', hellip: '\u2026',
  Iacute: '\u00cd', iacute: '\u00ed', Icirc: '\u00ce', icirc: '\u00ee', iexcl: '\u00a1', Igrave: '\u00cc', igrave: '\u00ec',
  image: '\u2111', infin: '\u221e', int: '\u222b', Iota: '\u0399', iota: '\u03b9', iquest: '\u00bf', isin: '\u2208', Iuml: '\u00cf',
  iuml: '\u00ef', Kappa: '\u039a', kappa: '\u03ba', Lambda: '\u039b', lambda: '\u03bb', lang: '\u2329', laquo: '\u00ab', lArr: '\u21d0',
  larr: '\u2190', lceil: '\u2308', ldquo: '\u201c', le: '\u2264', lfloor: '\u230a', lowast: '\u2217', loz: '\u25ca', lrm: '\u200e',
  lsaquo: '\u2039', lsquo: '\u2018', lt: '<', macr: '\u00af', mdash: '\u2014', micro: '\u00b5', middot: '\u00b7', minus: '\u2212',
  Mu: '\u039c', mu: '\u03bc', nabla: '\u2207', nbsp: ' ', ndash: '\u2013', ne: '\u2260', ni: '\u220b', not: '\u00ac', notin: '\u2209',
  nsub: '\u2284', Ntilde: '\u00d1', ntilde: '\u00f1', Nu: '\u039d', nu: '\u03bd', Oacute: '\u00d3', oacute: '\u00f3', Ocirc: '\u00d4',
  ocirc: '\u00f4', OElig: '\u0152', oelig: '\u0153', Ograve: '\u00d2', ograve: '\u00f2', oline: '\u203e', Omega: '\u03a9', omega: '\u03c9',
  Omicron: '\u039f', omicron: '\u03bf', oplus: '\u2295', or: '\u2228', ordf: '\u00aa', ordm: '\u00ba', Oslash: '\u00d8', oslash: '\u00f8',
  Otilde: '\u00d5', otilde: '\u00f5', otimes: '\u2297', Ouml: '\u00d6', ouml: '\u00f6', para: '\u00b6', part: '\u2202', permil: '\u2030',
  perp: '\u22a5', Phi: '\u03a6', phi: '\u03c6', Pi: '\u03a0', pi: '\u03c0', piv: '\u03d6', plusmn: '\u00b1', pound: '\u00a3',
  Prime: '\u2033', prime: '\u2032', prod: '\u220f', prop: '\u221d', Psi: '\u03a8', psi: '\u03c8', quot: '"', radic: '\u221a',
  rang: '\u232a', raquo: '\u00bb', rArr: '\u21d2', rarr: '\u2192', rceil: '\u2309', rdquo: '\u201d', real: '\u211c', reg: '\u00ae',
  rfloor: '\u230b', Rho: '\u03a1', rho: '\u03c1', rlm: '\u200f', rsaquo: '\u203a', rsquo: '\u2019', sbquo: '\u201a', Scaron: '\u0160',
  scaron: '\u0161', sdot: '\u22c5', sect: '\u00a7', shy: '\u00ad', Sigma: '\u03a3', sigma: '\u03c3', sigmaf: '\u03c2', sim: '\u223c',
  spades: '\u2660', sub: '\u2282', sube: '\u2286', sum: '\u2211', sup: '\u2283', sup1: '\u00b9', sup2: '\u00b2', sup3: '\u00b3',
  supe: '\u2287', szlig: '\u00df', Tau: '\u03a4', tau: '\u03c4', there4: '\u2234', Theta: '\u0398', theta: '\u03b8', thetasym: '\u03d1',
  thinsp: '\u2009', THORN: '\u00de', thorn: '\u00fe', tilde: '\u02dc', times: '\u00d7', trade: '\u2122', Uacute: '\u00da',
  uacute: '\u00fa', uArr: '\u21d1', uarr: '\u2191', Ucirc: '\u00db', ucirc: '\u00fb', Ugrave: '\u00d9', ugrave: '\u00f9', uml: '\u00a8',
  upsih: '\u03d2', Upsilon: '\u03a5', upsilon: '\u03c5', Uuml: '\u00dc', uuml: '\u00fc', weierp: '\u2118', Xi: '\u039e', xi: '\u03be',
  Yacute: '\u00dd', yacute: '\u00fd', yen: '\u00a5', Yuml: '\u0178', yuml: '\u00ff', Zeta: '\u0396', zeta: '\u03b6', zwj: '\u200d',
  zwnj: '\u200c',
};

/** What Windows-1252 shows for bytes 0x80–0x9F, so misread text can be turned back into its original bytes. */
const CP1252 = '\u20ac\u0081\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u008d\u017d\u008f\u0090\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u009d\u017e\u0178';
const MOJIBAKE = new RegExp(`[\\u00c2-\\u00f4][\\u0080-\\u00bf${CP1252}]{1,3}`, 'g');

function decodeEntities(s: string): string {
  // Some pages escape twice ("&amp;lt;br&amp;gt;"), so decode until nothing changes.
  for (let i = 0; i < 3; i++) {
    const next = s
      .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
      .replace(/&([a-z][a-z0-9]*);/gi, (m, name: string) => ENTITIES[name] ?? m);
    if (next === s) break;
    s = next;
  }
  return s;
}

/** Text that was UTF-8 but got read as Latin-1 or Windows-1252 ("Ã©", "Â·", "â€™", "âˆ’"). Each run is repaired on its own. */
function repairMojibake(s: string): string {
  return s.replace(MOJIBAKE, (run) => {
    const bytes: number[] = [];
    for (const ch of run) {
      const i = CP1252.indexOf(ch);
      if (i >= 0) bytes.push(0x80 + i);
      else if (ch.charCodeAt(0) < 256) bytes.push(ch.charCodeAt(0));
      else return run;
    }
    const fixed = Buffer.from(bytes).toString('utf8');
    return fixed.includes('\ufffd') ? run : fixed;
  });
}

export function cleanText(html: string | null | undefined): string {
  if (!html) return '';
  let s = decodeEntities(html);
  s = s
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')
    .replace(/<sup[^>]*>\s*([\s\S]*?)\s*<\/sup>/gi, (_, x: string) => `^${/^\w$/.test(x) ? x : `(${x})`}`)
    .replace(/<sub[^>]*>\s*([\s\S]*?)\s*<\/sub>/gi, (_, x: string) => `_${/^\w$/.test(x) ? x : `(${x})`}`)
    .replace(/<img[^>]*>/gi, ' [image] ')
    .replace(/<(br|\/p|\/div|\/li|\/tr)\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\u2022 ')
    // Only real tags: maths like "x<y" must survive.
    .replace(/<\/?(?:a|b|i|u|em|strong|span|p|div|font|br|li|ul|ol|table|tbody|thead|tr|td|th|center|small|big|h\d|o:p)\b[^>]*>/gi, '');
  s = repairMojibake(decodeEntities(s))
    .replace(/\u00c2(?=[\s\u00a0-\u00bf]|$)/g, '') // a stray "Â" left before spaces and symbols
    .replace(/\u00e2\u02c6 /g, '\u2220 ') // "∠" whose last byte (a no-break space) was turned into a space
    // MathJax \( … \) and \[ … \] → $ … $, the notation our own questions use
    .replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_, m: string) => `$${m}$`)
    .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, m: string) => `$${m}$`);
  return s
    .replace(/[\t\u00a0 ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
