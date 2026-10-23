// scripts/lib/strip-latex.js
// Turns inline LaTeX from arXiv abstracts into plain text for cards and digests.
// "$\boldsymbol{u}$-prediction" -> "u-prediction", "$\alpha=0.5$" -> "α=0.5".
// Money stays: a $...$ span that starts with a digit or space, or has no
// maths characters, is left alone ("$1 billion ... $999 million").

const SYMBOLS = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', theta: 'θ',
  lambda: 'λ', mu: 'μ', pi: 'π', sigma: 'σ', tau: 'τ', phi: 'φ', varphi: 'φ', psi: 'ψ',
  omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Sigma: 'Σ', Phi: 'Φ',
  Psi: 'Ψ', Omega: 'Ω', times: '×', cdot: '·', leq: '≤', geq: '≥', le: '≤', ge: '≥',
  neq: '≠', approx: '≈', sim: '~', infty: '∞', pm: '±', to: '→', rightarrow: '→',
  in: '∈', ell: 'ℓ',
};

const WRAPPERS = /\\(?:boldsymbol|mathbf|mathrm|mathit|mathcal|mathbb|mathsf|mathtt|text|textbf|textit|emph|operatorname|bm|hat|tilde|bar|vec|overline)\s*\{([^{}]*)\}/g;

function cleanMath(source) {
  let out = String(source);
  for (let i = 0; i < 3; i += 1) out = out.replace(WRAPPERS, '$1');
  out = out.replace(/\\([A-Za-z]+)/g, (match, name) => SYMBOLS[name] ?? name);
  return out.replace(/[{}]/g, '').replace(/\\[,;:! ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function stripLatex(text = '') {
  let s = String(text ?? '');
  s = s.replace(/\$\$([^$]+)\$\$/g, (m, x) => cleanMath(x));
  s = s.replace(/\\\((.+?)\\\)|\\\[(.+?)\\\]/g, (m, a, b) => cleanMath(a ?? b));
  s = s.replace(/\$([^$\n]{1,80}?)\$/g, (m, x) => {
    const looksLikeMath = !/^[\s\d]/.test(x) && (/[\\^_{}]/.test(x) || /^[A-Za-z\u0370-\u03FF]{1,3}$/.test(x.trim()));
    return looksLikeMath ? cleanMath(x) : m;
  });
  if (/\\[A-Za-z]+/.test(s)) {
    s = s.replace(WRAPPERS, '$1').replace(/\\([A-Za-z]+)/g, (m, name) => SYMBOLS[name] ?? name);
  }
  return s.replace(/[ \t]{2,}/g, ' ');
}
