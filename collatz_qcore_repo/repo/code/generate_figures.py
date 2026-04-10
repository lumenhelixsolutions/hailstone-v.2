"""
generate_figures.py
===================
Generates all figures for the Quaternionic-C.O.R.E. Collatz paper.
Outputs PNG files to the ../figures/ directory.

Usage:
    python generate_figures.py

Requirements: numpy, matplotlib
    pip install numpy matplotlib
"""

import numpy as np
import os

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'figures')
os.makedirs(OUTPUT_DIR, exist_ok=True)

try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import matplotlib.colors as mcolors
    HAS_MPL = True
except ImportError:
    HAS_MPL = False
    print("matplotlib not installed — skipping figure generation.")
    print("Install with: pip install matplotlib")
    raise SystemExit(0)

plt.rcParams.update({
    'font.family': 'serif',
    'font.size': 11,
    'axes.titlesize': 12,
    'axes.labelsize': 11,
    'figure.dpi': 150,
})


# ─────────────────────────────────────────────────────────────────────────────
# Figure 1: Norm growth for original lift — n=7 and n=16
# ─────────────────────────────────────────────────────────────────────────────
def fig1_norm_growth():
    A = 3.0 + 1j
    samples = {7: 'non-power (n=7)', 16: 'power of 2 (n=16)'}
    colors  = {7: '#e05252', 16: '#4e9de0'}

    fig, ax = plt.subplots(figsize=(7, 4))

    for n, label in samples.items():
        q = complex(n)
        norms = [abs(q)]
        for _ in range(40):
            if round(q.real) % 2 == 1:
                q = A * q + 1
            else:
                q /= 2
            norms.append(abs(q))
            if abs(q) > 1e6 or (abs(q - 1) < 1e-6 and q.imag == 0):
                break
        ax.semilogy(range(len(norms)), norms, 'o-', markersize=3,
                    label=label, color=colors[n], linewidth=1.5)

    # Reference line: (sqrt(10))^(t/2) — one odd step per 2 steps on average
    t_ref = np.arange(0, 20)
    ax.semilogy(t_ref, 7 * (10**0.25)**t_ref, '--', color='gray',
                alpha=0.5, linewidth=1, label=r'$7 \cdot 10^{t/4}$ (reference)')

    ax.set_xlabel('Step $t$')
    ax.set_ylabel(r'$|q_t|$ (log scale)')
    ax.set_title('Fig. 1 — Norm growth under the quaternionic-C.O.R.E. lift')
    ax.legend(fontsize=9)
    ax.grid(True, which='both', alpha=0.3)
    fig.tight_layout()
    path = os.path.join(OUTPUT_DIR, 'fig1_norm_growth.png')
    fig.savefig(path)
    plt.close(fig)
    print(f"Saved: {path}")


# ─────────────────────────────────────────────────────────────────────────────
# Figure 2: Faithfulness gap over steps for n = 3, 7, 27
# ─────────────────────────────────────────────────────────────────────────────
def fig2_faithfulness_gap():
    A = 3.0 + 1j

    def gap_sequence(n, steps=30):
        q = complex(n)
        u = n
        gaps = [0.0]
        for _ in range(steps):
            if u == 1:
                break
            if u % 2 == 0:
                u //= 2
                q /= 2
            else:
                u = 3 * u + 1
                q = A * q + 1
            gaps.append(abs(q.real - u))
        return gaps

    fig, ax = plt.subplots(figsize=(7, 4))
    colors = ['#e05252', '#e07e52', '#9b59b6']
    for n, color in zip([3, 7, 27], colors):
        g = gap_sequence(n, 20)
        ax.plot(range(len(g)), g, 'o-', markersize=4, label=f'n={n}',
                color=color, linewidth=1.5)

    ax.axvline(x=3, color='gray', linestyle=':', alpha=0.6, linewidth=1)
    ax.text(3.1, ax.get_ylim()[1] * 0.5 if ax.get_ylim()[1] > 0 else 1,
            'gap opens\nat step 3', fontsize=8, color='gray')

    ax.set_xlabel('Step $t$')
    ax.set_ylabel(r'$|\operatorname{Re}(q_t) - T^t(n)|$')
    ax.set_title('Fig. 2 — Faithfulness gap: $|\\operatorname{Re}(q_t) - T^t(n)|$')
    ax.legend(fontsize=9)
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    path = os.path.join(OUTPUT_DIR, 'fig2_faithfulness_gap.png')
    fig.savefig(path)
    plt.close(fig)
    print(f"Saved: {path}")


# ─────────────────────────────────────────────────────────────────────────────
# Figure 3: Split embedding imaginary debt for n = 1..100
# ─────────────────────────────────────────────────────────────────────────────
def fig3_split_debt():
    def final_debt(n, steps=500):
        u, v = n, 0.0
        for _ in range(steps):
            if u == 1:
                break
            if u % 2 == 0:
                u //= 2
                v /= 2
            else:
                v = float(u)
                u = 3 * u + 1
        return abs(v)

    ns = range(1, 101)
    debts = [final_debt(n) for n in ns]
    is_pow2 = [((n & (n-1)) == 0) for n in ns]

    colors = ['#4e9de0' if p else '#e05252' for p in is_pow2]

    fig, ax = plt.subplots(figsize=(8, 3.5))
    ax.bar(list(ns), debts, color=colors, width=0.7, alpha=0.85)
    ax.axhline(y=5/16, color='gray', linestyle='--', linewidth=1, alpha=0.7,
               label='$5/16 = 0.3125$ (empirical minimum for non-powers)')

    from matplotlib.patches import Patch
    legend_elements = [
        Patch(facecolor='#4e9de0', label='Power of 2 (debt = 0)'),
        Patch(facecolor='#e05252', label='Non-power of 2'),
    ]
    ax.legend(handles=legend_elements, fontsize=9)
    ax.set_xlabel('$n$')
    ax.set_ylabel('Final imaginary debt $|v_\\infty|$')
    ax.set_title('Fig. 3 — Split embedding: final imaginary debt for $n \\leq 100$')
    ax.grid(True, axis='y', alpha=0.3)
    fig.tight_layout()
    path = os.path.join(OUTPUT_DIR, 'fig3_split_debt.png')
    fig.savefig(path)
    plt.close(fig)
    print(f"Saved: {path}")


# ─────────────────────────────────────────────────────────────────────────────
# Figure 4: Convergence map — which n converge in the quaternionic lift
# ─────────────────────────────────────────────────────────────────────────────
def fig4_convergence_map():
    A = 3.0 + 1j
    limit = 200
    conv_set = []
    for n in range(1, limit + 1):
        q = complex(n)
        converged = False
        for _ in range(2000):
            if abs(q - 1) < 1e-6 and abs(q.imag) < 1e-6:
                converged = True
                break
            if abs(q) > 1e25:
                break
            if round(q.real) % 2 == 1:
                q = A * q + 1
            else:
                q /= 2
        if converged:
            conv_set.append(n)

    fig, ax = plt.subplots(figsize=(9, 2.5))
    all_n = np.arange(1, limit + 1)
    status = np.array([1 if n in conv_set else 0 for n in all_n])
    ax.bar(all_n[status == 0], np.ones(np.sum(status == 0)),
           color='#e05252', width=0.8, alpha=0.7, label='Diverges')
    ax.bar(np.array(conv_set), np.ones(len(conv_set)),
           color='#4e9de0', width=0.8, alpha=0.95, label='Converges (power of 2)')
    ax.set_xlabel('$n$')
    ax.set_yticks([])
    ax.set_title(f'Fig. 4 — Quaternionic verifier: convergence for $n \\leq {limit}$')
    ax.legend(fontsize=9, loc='upper right')
    ax.set_xlim(0, limit + 1)
    fig.tight_layout()
    path = os.path.join(OUTPUT_DIR, 'fig4_convergence_map.png')
    fig.savefig(path)
    plt.close(fig)
    print(f"Saved: {path}")
    print(f"  Converged set: {conv_set}")


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("Generating figures...")
    fig1_norm_growth()
    fig2_faithfulness_gap()
    fig3_split_debt()
    fig4_convergence_map()
    print(f"\nAll figures saved to: {os.path.abspath(OUTPUT_DIR)}")
