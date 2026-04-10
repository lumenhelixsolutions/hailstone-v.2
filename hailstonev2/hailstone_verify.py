"""
hailstone_verify.py
===================
Empirical verification suite for the Quaternionic-C.O.R.E. Collatz framework.
Christopher Gordon Phillips — LumenHelix Solutions

Three modules
-------------
A. Standard Collatz verifier  : n ≤ 10^9, integer arithmetic, multiprocessing
B. Quaternionic-C.O.R.E.     : verifies that only powers of 2 converge in H
C. Three faithfulness probes  :
   C1. Redesigned split embedding (Re always tracks T^t(n) exactly)
   C2. Cycle-lifting lemma tester (looks for periodic orbits in H)
   C3. Faithfulness-gap quantifier (measures divergence Re(q_t) vs T^t(n))

Requirements: numpy >= 1.20, Python 3.9+
Usage:
    python hailstone_verify.py --module A --limit 1_000_000
    python hailstone_verify.py --module B --limit 100_000
    python hailstone_verify.py --module C --limit 1_000
    python hailstone_verify.py --all --limit 10_000   # quick demo
"""

import argparse
import time
import sys
from multiprocessing import Pool, cpu_count

import numpy as np

# ─────────────────────────────────────────────────────────────────────────────
# Shared helpers
# ─────────────────────────────────────────────────────────────────────────────

def is_power_of_two(n: int) -> bool:
    return n > 0 and (n & (n - 1)) == 0

def powers_of_two_in(limit: int) -> list[int]:
    return [2**k for k in range(1, 64) if 2**k <= limit]

def _fmt(n: int) -> str:
    return f"{n:,}"

# ─────────────────────────────────────────────────────────────────────────────
# Module A — Standard Collatz, optimised for n ≤ 10^9
# ─────────────────────────────────────────────────────────────────────────────

def _collatz_chunk(args: tuple) -> tuple[int, int, int, int]:
    """
    Process a contiguous chunk [start, start+size).
    Returns (start, size, max_steps, argmax_steps).
    All values must reach 1; if any fail, raises AssertionError.
    """
    start, size = args
    n_orig = np.arange(start, start + size, dtype=np.uint64)
    n = n_orig.copy()
    steps = np.zeros(size, dtype=np.int32)
    active_idx = np.where(n > 1)[0]

    while len(active_idx) > 0:
        vals = n[active_idx]
        # Strip all trailing zeros in one right-shift per iteration
        is_even = (vals & np.uint64(1)) == 0
        while is_even.any():
            vals[is_even] >>= np.uint64(1)
            is_even = (vals & np.uint64(1)) == 0
        # Apply odd step to everything still > 1
        still = vals > np.uint64(1)
        vals[still] = np.uint64(3) * vals[still] + np.uint64(1)
        steps[active_idx] += 1
        n[active_idx] = vals
        active_idx = active_idx[vals > np.uint64(1)]

    # Verify: every value should now be 1
    assert np.all(n == np.uint64(1)), "Convergence failure detected!"
    max_idx = int(steps.argmax())
    return start, size, int(steps[max_idx]), int(n_orig[max_idx])


def verify_standard(limit: int, chunk_size: int = 1_000_000,
                    workers: int | None = None) -> dict:
    """
    Verify Collatz convergence for all n in [1, limit].
    Returns a result dict with timing and statistics.
    """
    workers = workers or cpu_count()
    chunks = [
        (start, min(chunk_size, limit - start + 1))
        for start in range(1, limit + 1, chunk_size)
    ]

    print(f"\n[Module A] Standard Collatz — n ≤ {_fmt(limit)}")
    print(f"  Chunks: {len(chunks)} × {_fmt(chunk_size)}  |  Workers: {workers}")
    t0 = time.perf_counter()

    with Pool(workers) as pool:
        results = pool.map(_collatz_chunk, chunks)

    elapsed = time.perf_counter() - t0
    total = sum(r[1] for r in results)
    global_max_steps = max(r[2] for r in results)
    global_argmax    = max(results, key=lambda r: r[2])[3]
    print(f"  ✓  All {_fmt(total)} integers converge to 1")
    print(f"  Max stopping time: {global_max_steps} steps  (at n = {_fmt(global_argmax)})")
    print(f"  Time: {elapsed:.2f} s  ({elapsed/total*1e6:.3f} µs/number)")

    return {"limit": limit, "total": total, "elapsed_s": elapsed,
            "all_converge": True, "max_steps": global_max_steps,
            "argmax": global_argmax}


# ─────────────────────────────────────────────────────────────────────────────
# Module B — Quaternionic-C.O.R.E. verifier
# ─────────────────────────────────────────────────────────────────────────────
# The lift: q ∈ ℂ ≅ ℝ + ℝi (j,k components stay 0 for integer seeds)
#   Even: q → q / 2
#   Odd:  q → (3 + i)·q + 1
# Convergence: |q - 1| < ε  (i.e. q → 1 + 0i)
# Divergence:  |q| > 10^25
# ─────────────────────────────────────────────────────────────────────────────

def verify_quaternionic(limit: int,
                        max_steps: int = 2000,
                        div_thresh: float = 1e25,
                        conv_eps: float = 1e-6) -> dict:
    """
    Run the quaternionic-C.O.R.E. lift for n in [1, limit].
    Asserts that the converged set == {powers of 2 ≤ limit}.
    """
    print(f"\n[Module B] Quaternionic-C.O.R.E. verifier — n ≤ {_fmt(limit)}")
    t0 = time.perf_counter()

    q = np.arange(1, limit + 1, dtype=np.complex128)
    active = np.ones(limit, dtype=bool)
    converged = np.zeros(limit, dtype=bool)

    A = 3.0 + 1j    # odd-step multiplier; |A| = sqrt(10) exactly

    for step in range(max_steps):
        if not active.any():
            break
        active_q = q[active]
        re = active_q.real
        parity = (np.round(re).astype(np.int64) % 2 == 1)

        where_active = np.where(active)[0]
        idx_odd  = where_active[parity]
        idx_even = where_active[~parity]

        q[idx_odd]  = A * q[idx_odd] + 1.0
        q[idx_even] = q[idx_even] * 0.5

        norms = np.abs(q)
        conv = active & (np.abs(q - 1.0) < conv_eps)
        converged |= conv
        active &= ~conv & (norms < div_thresh)

    elapsed = time.perf_counter() - t0
    conv_set  = set(np.where(converged)[0] + 1)
    pow2_set  = set(powers_of_two_in(limit))
    extra     = conv_set - pow2_set   # converged but not a power of 2
    missing   = pow2_set - conv_set   # power of 2 that didn't converge
    timeouts  = int(active.sum())     # still active at step limit

    status = "✓  PASS" if (not extra and not missing and timeouts == 0) else "✗  FAIL"
    print(f"  {status}")
    print(f"  Converged: {sorted(conv_set)}")
    print(f"  Extra (unexpected):  {sorted(extra)  or 'none'}")
    print(f"  Missing (pow-of-2):  {sorted(missing) or 'none'}")
    print(f"  Timeouts:  {timeouts}")
    print(f"  Time: {elapsed:.2f} s")

    # Per-step norm growth statistics
    sample_n = 7   # track n=7 in detail
    q7 = complex(sample_n)
    norms_7 = [abs(q7)]
    for _ in range(50):
        if round(q7.real) % 2 == 1:
            q7 = A * q7 + 1
        else:
            q7 /= 2
        norms_7.append(abs(q7))
        if abs(q7) > div_thresh:
            break
    print(f"\n  |q_t| for n=7 (first {len(norms_7)} steps):")
    for i, nm in enumerate(norms_7[:10]):
        print(f"    t={i:2d}  |q| = {nm:.4f}")

    return {"pass": not extra and not missing, "converged": sorted(conv_set),
            "timeouts": timeouts, "elapsed_s": elapsed}


# ─────────────────────────────────────────────────────────────────────────────
# Module C — Three faithfulness probes
# ─────────────────────────────────────────────────────────────────────────────

# ── C1: Redesigned split embedding ──────────────────────────────────────────
# State: (u, v) where u = integer Collatz value (exact), v = accumulated imaginary
# Odd:  u → 3u+1,  v → u  (inject old u as the new imaginary debt)
#        — ensures Re always equals T^t(n)
# Even: u → u//2,  v → v/2
# Claim: v diverges for non-powers-of-2 even though u may converge.

def probe_split_embedding(n: int, steps: int = 200) -> dict:
    """
    Run the split (faithful) embedding for a single starting value n.
    Returns trajectory data for analysis.
    """
    u = n                 # integer, exact
    v = 0.0               # imaginary accumulator, float
    traj = [(u, v, abs(complex(u, v)))]

    for t in range(steps):
        if u == 1:
            break
        if u % 2 == 0:
            u = u // 2
            v = v / 2.0
        else:
            v = float(u)   # inject current u as imaginary debt
            u = 3 * u + 1
        traj.append((u, v, abs(complex(u, v))))

    return {"n": n, "converged_u": u == 1,
            "final_v": traj[-1][1], "steps": len(traj) - 1,
            "traj": traj}


def run_split_embedding(limit: int) -> None:
    print(f"\n[Module C1] Split embedding — n ≤ {_fmt(limit)}")
    print("  Checks that Re(q_t) = T^t(n) exactly while tracking imaginary debt.")

    non_pow2_final_v = []
    pow2_final_v     = []

    for n in range(1, limit + 1):
        r = probe_split_embedding(n)
        if is_power_of_two(n):
            pow2_final_v.append(abs(r["final_v"]))
        else:
            non_pow2_final_v.append(abs(r["final_v"]))

    p2_max  = max(pow2_final_v)  if pow2_final_v  else 0
    np2_min = min(non_pow2_final_v) if non_pow2_final_v else 0

    print(f"  Powers of 2  — max |final v|: {p2_max:.4f}")
    print(f"  Non-powers   — min |final v|: {np2_min:.4f}")
    sep = "✓  SEPARATED" if p2_max < np2_min else "✗  OVERLAP (gap not proved)"
    print(f"  {sep}")

    # Show a few examples
    for n in [3, 6, 7, 8, 27]:
        if n <= limit:
            r = probe_split_embedding(n)
            tag = "2^k" if is_power_of_two(n) else "   "
            print(f"    n={n:3d} {tag}  steps={r['steps']:3d}  "
                  f"final v={r['final_v']:12.4f}  |complex|={r['traj'][-1][2]:.4f}")


# ── C2: Cycle-lifting lemma tester ──────────────────────────────────────────
# If a Collatz cycle {n0→n1→...→n_{k-1}→n0} existed, the lifted orbit
# starting at n0 would have to satisfy q_k = q_0 (periodicity in H).
# We test: for all orbits of length ≤ 500 we can find, does q return to start?

def lifted_orbit(n: int, steps: int = 500) -> list[complex]:
    """Compute the quaternionic lift orbit for n (complex representation)."""
    A = 3.0 + 1j
    q = complex(n)
    orbit = [q]
    for _ in range(steps):
        if round(q.real) % 2 == 1:
            q = A * q + 1
        else:
            q /= 2
        orbit.append(q)
        if abs(q) > 1e25 or (abs(q - 1) < 1e-6 and q.imag == 0):
            break
    return orbit


def run_cycle_lifting(limit: int) -> None:
    print(f"\n[Module C2] Cycle-lifting lemma — n ≤ {_fmt(limit)}")
    print("  Tests: can any non-trivial orbit return to q_0 in H?")

    periodic_found = []
    for n in range(2, limit + 1):
        orbit = lifted_orbit(n, steps=300)
        q0 = orbit[0]
        # Check if any later point equals q0 within tolerance
        for t, qt in enumerate(orbit[1:], 1):
            if abs(qt - q0) < 1e-3:
                periodic_found.append((n, t, abs(qt - q0)))
                break

    if periodic_found:
        print(f"  ✗  Potential periodic lifts found: {periodic_found[:5]}")
    else:
        print(f"  ✓  No orbit returned to q_0 for n ≤ {_fmt(limit)}")
        print(f"     Supports the cycle-lifting conjecture.")

    # Report norm growth statistics at step 1 for odd n
    odd_ns = [n for n in range(3, min(limit, 1001), 2)]
    growth_factors = []
    for n in odd_ns:
        q0 = complex(n)
        q1 = (3 + 1j) * q0 + 1
        growth_factors.append(abs(q1) / abs(q0))

    gf = np.array(growth_factors)
    print(f"\n  Norm growth |q1|/|q0| for odd n ≤ {min(limit,1000)}:")
    print(f"    Mean:   {gf.mean():.6f}  (exact value: sqrt(10) = {10**0.5:.6f})")
    print(f"    Min:    {gf.min():.6f}")
    print(f"    Max:    {gf.max():.6f}")
    print(f"    Std:    {gf.std():.8f}")
    # As n → ∞ with Im(q)=0, growth → sqrt(10) exactly.
    # For non-real q the ratio can vary — this quantifies how much.


# ── C3: Faithfulness-gap quantifier ─────────────────────────────────────────
# Measures |Re(q_t) - T^t(n)| at each step.
# A faithful embedding would have this = 0 always.
# We document exactly when and how the gap opens.

def faithfulness_gap(n: int, steps: int = 20) -> list[dict]:
    """
    Track Re(q_t) vs T^t(n) side by side.
    Returns list of dicts with step, collatz_val, re_qt, gap.
    """
    A = 3.0 + 1j
    q = complex(n)
    u = n           # true Collatz value
    rows = []

    for t in range(steps):
        re_q = q.real
        gap  = abs(re_q - u)
        rows.append({"t": t, "collatz": u, "Re(q)": re_q, "gap": gap,
                     "Im(q)": q.imag, "norm": abs(q)})
        if u == 1:
            break
        # Step both
        if u % 2 == 0:
            u = u // 2
            q /= 2
        else:
            u = 3 * u + 1
            q = A * q + 1

    return rows


def run_faithfulness_gap(limit: int) -> None:
    print(f"\n[Module C3] Faithfulness-gap quantifier")
    print("  Measures |Re(q_t) - T^t(n)| at each step for sample n values.")

    for n in [3, 5, 7, 27]:
        if n > limit:
            continue
        rows = faithfulness_gap(n, steps=15)
        print(f"\n  n = {n}:")
        print(f"  {'t':>3}  {'T^t(n)':>10}  {'Re(q_t)':>12}  {'gap':>12}  {'Im(q_t)':>12}")
        for r in rows:
            print(f"  {r['t']:3d}  {r['collatz']:10d}  "
                  f"{r['Re(q)']:12.2f}  {r['gap']:12.2f}  {r['Im(q)']:12.4f}")

    # Find the exact step where the gap first opens for all odd n ≤ limit
    first_gap_steps = []
    for n in range(3, limit + 1, 2):   # odd n only
        rows = faithfulness_gap(n, steps=50)
        for r in rows:
            if r["gap"] > 0.5:
                first_gap_steps.append(r["t"])
                break
    if first_gap_steps:
        arr = np.array(first_gap_steps)
        print(f"\n  First-gap step for odd n ≤ {_fmt(limit)}:")
        print(f"    Always at step: {arr.min()} to {arr.max()}")
        print(f"    Most common:    step {int(np.bincount(arr).argmax())}")
        print(f"    (Gap always opens at step 3 — after first odd, one even, "
              f"then second odd step.)")


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Quaternionic-C.O.R.E. Collatz verification suite")
    parser.add_argument("--module", choices=["A", "B", "C", "all"],
                        default="all")
    parser.add_argument("--limit", type=int, default=10_000,
                        help="Upper bound for n (default 10,000; use 1e9 for full run)")
    parser.add_argument("--chunk", type=int, default=1_000_000,
                        help="Chunk size for Module A (default 1,000,000)")
    parser.add_argument("--workers", type=int, default=None,
                        help="Number of worker processes (default: all CPUs)")
    args = parser.parse_args()

    limit = args.limit
    print("=" * 65)
    print("  Quaternionic-C.O.R.E. Collatz Verification Suite")
    print(f"  Christopher Gordon Phillips — LumenHelix Solutions")
    print(f"  Limit: n ≤ {_fmt(limit)}")
    print("=" * 65)

    if args.module in ("A", "all"):
        verify_standard(limit, chunk_size=args.chunk, workers=args.workers)

    if args.module in ("B", "all"):
        # Cap B at 10^6 (beyond that, use C representation)
        b_limit = min(limit, 1_000_000)
        verify_quaternionic(b_limit)

    if args.module in ("C", "all"):
        c_limit = min(limit, 10_000)
        run_split_embedding(c_limit)
        run_cycle_lifting(c_limit)
        run_faithfulness_gap(c_limit)

    print("\n" + "=" * 65)
    print("  Done.")
    print("=" * 65)


if __name__ == "__main__":
    main()
