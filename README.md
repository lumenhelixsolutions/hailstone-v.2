# Quaternionic-C.O.R.E. Framework for the Collatz Map

**Author:** Christopher Gordon Phillips  
**Affiliation:** LumenHelix Solutions — chris@oiq.to  
**Version:** 2.0 (March 2026)  
**arXiv target:** math.NT (cross-list: math.DS)

---

## Overview

This repository contains the paper, verification code, and supporting
materials for:

> *The Quaternionic-C.O.R.E. Framework for the Collatz Map:  
> Algebraic Structure, Norm Obstruction, and Empirical Verification to n ≤ 10⁹*

The paper introduces a reversible algebraic embedding of the Collatz map
into the complex plane. It does **not** claim a proof of the Collatz
conjecture. It contributes:

1. **Exact norm growth theorem** — `|Aq| = √10 · |q|` for all `q ∈ ℂ`,
   where `A = 3 + i`. This is exact, not asymptotic.

2. **Affine correction formula** — The actual odd branch is `q ↦ Aq + 1`
   (affine, not linear). The exact formula is:
   `|Aq+1|² = 10|q|² + 6·Re(q) − 2·Im(q) + 1`

3. **Split embedding** — A redesigned faithful lift that keeps `Re(qₜ) = Tᵗ(n)`
   exactly at every step. The imaginary debt `vₜ = 0` for all `t` if and
   only if `n` is a power of 2.

4. **Faithfulness characterisation** — The original lift is fully faithful
   for `n` iff the Collatz orbit of `n` has at most one odd number. These
   are exactly `n = 2ᵃ · (4ᵏ−1)/3`.

5. **Affine cycle reduction** — Baker's theorem shows the linear part
   of the full cycle composition never has modulus 1, reducing the
   no-nontrivial-cycle question to an arithmetic fixed-point problem
   (Open Problem 1).

6. **Empirical verification** — All `n ≤ 10⁹` verified via optimised
   multi-core integer algorithm; quaternionic verifier confirms powered-of-2
   convergence for `n ≤ 10⁵`.

---

## Repository Structure

```
.
├── README.md
├── LICENSE
├── CITATION.cff
├── .gitignore
├── paper/
│   ├── hailstone_v2.tex        # Main LaTeX source
│   └── references.bib          # Bibliography (standalone)
├── code/
│   ├── hailstone_verify.py     # Full verification suite (Modules A, B, C)
│   └── requirements.txt        # Python dependencies
├── figures/                    # Generated figures (see code/generate_figures.py)
└── .github/
    └── workflows/
        └── verify.yml          # CI: runs Module A on n ≤ 10,000
```

---

## Claim Taxonomy

Every result in the paper is explicitly labelled:

| Label | Meaning |
|-------|---------|
| **Proved** | Full unconditional proof given |
| **Empirical** | Verified computationally over stated range |
| **Conditional** | Proved assuming a stated open problem |
| **Conjectural** | Supported by evidence, not proved |
| **Open** | Explicitly unresolved |

---

## Quickstart

### Requirements

```
Python >= 3.9
numpy >= 1.20
```

```bash
pip install -r code/requirements.txt
```

### Run the verification suite

```bash
# Quick demo (n ≤ 10,000, ~5 seconds)
python code/hailstone_verify.py --module all --limit 10000

# Module A only: standard Collatz convergence
python code/hailstone_verify.py --module A --limit 1000000

# Full n ≤ 10⁹ run (~60 min, 2 cores; ~15 min, 8 cores)
python code/hailstone_verify.py --module A --limit 1000000000

# Quaternionic verifier
python code/hailstone_verify.py --module B --limit 100000

# Three faithfulness probes
python code/hailstone_verify.py --module C --limit 10000
```

### Expected output (Module A, n ≤ 10⁶)

```
[Module A] Standard Collatz — n ≤ 1,000,000
  Chunks: 1 × 1,000,000  |  Workers: 2
  ✓  All 1,000,000 integers converge to 1
  Max stopping time: 196 steps  (at n = 837,799)
  Time: ~4 s
```

Note: 196 is the compressed stopping time (trailing-zero stripping collapses
consecutive even steps). The standard stopping time for n = 837,799 is 524,
consistent with known tables.

### Compile the paper

```bash
cd paper
pdflatex hailstone_v2.tex
pdflatex hailstone_v2.tex   # second pass for cross-references
```

Requires TeX Live 2020 or later with `amsart`, `hyperref`, `listings`,
`booktabs`, `enumitem`.

---

## Open Problems

The four open problems stated in the paper, in order of centrality:

**OP1 (Critical — Affine fixed-point problem)**  
For every valid Collatz step pattern (r odd steps, s even steps), the affine
fixed point `q₀ = b/(1−M)` (where `M = Aʳ/2ˢ`, `b` = accumulated +1 terms)
is not a positive integer. Baker's theorem establishes `|M| ≠ 1`; the
arithmetic step remains open.

**OP2 (Split embedding norm bound)**  
Find a norm-growth lower bound for the split embedding tight enough to rule
out non-trivial cycles.

**OP3 (Cycle-lifting conjecture)**  
No non-trivial Collatz cycle lifts to a periodic orbit under Φ. Follows from
OP1 if resolved.

**OP4 (Faithful intertwiner)**  
Construct (or prove impossible) a map Ψ : ℕ → ℂ satisfying
`Re(Ψ(n)) = n`, `Ψ(T(n)) = AΨ(n)+1` (odd), `Ψ(T(n)) = Ψ(n)/2` (even).

---

## Known Limitations

- The paper does **not** prove the Collatz conjecture.
- The norm theorem (`|Aq| = √10|q|`) applies to the **homogeneous** part
  only. The actual odd branch `q ↦ Aq+1` has a correction term; this is
  documented explicitly in Remark 2.3 of the paper.
- The `5/16` universal imaginary debt observation is **conditional on
  Collatz convergence**; it is not an unconditional theorem.
- Computational verification to `n ≤ 10⁹` is a consistency check for the
  implementation. The known verification frontier is `n ≤ 2⁶⁸`
  (Oliveira e Silva et al., 2014).

---

## Citation

```bibtex
@misc{phillips2026qcore,
  author       = {Christopher Gordon Phillips},
  title        = {The Quaternionic-{C.O.R.E.} Framework for the {Collatz} Map:
                  Algebraic Structure, Norm Obstruction, and Empirical
                  Verification to $n \leq 10^9$},
  year         = {2026},
  institution  = {LumenHelix Solutions},
  note         = {Preprint. arXiv:XXXX.XXXXX [math.NT]}
}
```

---

## License

Code: MIT License (see `LICENSE`).  
Paper: CC BY 4.0.
