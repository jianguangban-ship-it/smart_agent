import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '../markdown'

/**
 * Test realistic EKF / vehicle dynamics math content that an LLM would produce.
 * Covers: display math, inline math, matrices, fractions, code blocks, mixed content.
 */

// Simulate a typical LLM response for "EKF 3-DOF vehicle lateral acceleration estimator"
const EKF_RESPONSE_DOLLARS = `
## EKF-Based 3-DOF Vehicle Lateral Acceleration Estimator

### 1. State Vector

The state vector for a 3-DOF lateral dynamics model:

$$
\\mathbf{x} = \\begin{bmatrix} v_y \\\\ \\dot{\\psi} \\\\ a_y \\end{bmatrix}
$$

where:
- $v_y$ is the lateral velocity
- $\\dot{\\psi}$ is the yaw rate
- $a_y$ is the lateral acceleration

### 2. System Model

The continuous-time state equation:

$$
\\dot{\\mathbf{x}} = \\begin{bmatrix} a_y - v_x \\dot{\\psi} \\\\ \\frac{2(C_f + C_r)}{I_z} v_y + \\frac{2(l_f C_f - l_r C_r)}{I_z} \\dot{\\psi} \\\\ 0 \\end{bmatrix}
$$

The discretized state transition matrix (using Euler method with step $\\Delta t$):

$$
F_k = I + \\Delta t \\begin{bmatrix} 0 & -v_x & 1 \\\\ \\frac{2(C_f+C_r)}{m v_x} & \\frac{2(l_f C_f - l_r C_r)}{m v_x} & 0 \\\\ 0 & 0 & 0 \\end{bmatrix}
$$

### 3. Measurement Model

$$
z_k = H \\mathbf{x}_k + v_k, \\quad H = \\begin{bmatrix} 0 & 1 & 0 \\\\ 0 & 0 & 1 \\end{bmatrix}
$$

### 4. EKF Algorithm

**Prediction step:**

$$
\\hat{\\mathbf{x}}_{k|k-1} = f(\\hat{\\mathbf{x}}_{k-1|k-1}, u_k)
$$

$$
P_{k|k-1} = F_k P_{k-1|k-1} F_k^T + Q_k
$$

**Update step:**

$$
K_k = P_{k|k-1} H^T (H P_{k|k-1} H^T + R_k)^{-1}
$$

$$
\\hat{\\mathbf{x}}_{k|k} = \\hat{\\mathbf{x}}_{k|k-1} + K_k (z_k - H \\hat{\\mathbf{x}}_{k|k-1})
$$

$$
P_{k|k} = (I - K_k H) P_{k|k-1}
$$

### 5. Implementation

\`\`\`python
import numpy as np

class EKF3DOF:
    def __init__(self, dt, Cf, Cr, lf, lr, m, Iz, vx):
        self.dt = dt
        self.Cf, self.Cr = Cf, Cr
        self.lf, self.lr = lf, lr
        self.m, self.Iz = m, Iz
        self.vx = vx

        # State: [vy, yaw_rate, ay]
        self.x = np.zeros((3, 1))
        self.P = np.eye(3) * 0.1
        self.Q = np.diag([0.01, 0.001, 0.1])
        self.R = np.diag([0.01, 0.05])

    def predict(self):
        vy, r, ay = self.x.flatten()
        # State transition
        self.x = self.x + self.dt * np.array([
            [ay - self.vx * r],
            [2*(self.Cf+self.Cr)/(self.Iz) * vy],
            [0.0]
        ])
        F = np.eye(3) + self.dt * np.array([
            [0, -self.vx, 1],
            [2*(self.Cf+self.Cr)/(self.m*self.vx), 0, 0],
            [0, 0, 0]
        ])
        self.P = F @ self.P @ F.T + self.Q

    def update(self, z):
        H = np.array([[0, 1, 0], [0, 0, 1]])
        S = H @ self.P @ H.T + self.R
        K = self.P @ H.T @ np.linalg.inv(S)
        self.x = self.x + K @ (z - H @ self.x)
        self.P = (np.eye(3) - K @ H) @ self.P
\`\`\`

The estimated lateral acceleration $\\hat{a}_y = \\mathbf{x}[2]$ converges within $\\sqrt{P_{33}}$ bounds.
`

// Same content but using bracket delimiters (common from some LLMs)
const EKF_RESPONSE_BRACKETS = `
## EKF State Vector

The state vector:

\\[
\\mathbf{x} = \\begin{bmatrix} v_y \\\\ \\dot{\\psi} \\\\ a_y \\end{bmatrix}
\\]

where \\( v_y \\) is lateral velocity and \\( \\dot{\\psi} \\) is yaw rate.

The Kalman gain:

\\[
K_k = P_{k|k-1} H^T (H P_{k|k-1} H^T + R_k)^{-1}
\\]
`

// LaTeX accidentally wrapped in code fences
const LATEX_IN_CODE_FENCE = `
Here is the state transition matrix:

\`\`\`latex
\\begin{bmatrix} 0 & -v_x & 1 \\\\ \\frac{2C_f}{m v_x} & 0 & 0 \\\\ 0 & 0 & 0 \\end{bmatrix}
\`\`\`
`

// Mixed: code block with ASCII art + math
const CODE_AND_MATH_MIXED = `
### Architecture

\`\`\`
+--------+      +-------+      +--------+
| Sensor | ---> |  EKF  | ---> | Output |
+--------+      +-------+      +--------+
     |              ^
     v              |
  [IMU, GPS]    [Model]
\`\`\`

The filter uses $\\Delta t = 0.01$ seconds with process noise $Q = \\text{diag}(0.01, 0.001, 0.1)$.

$$
\\hat{a}_y = \\frac{F_{yf} + F_{yr}}{m}
$$
`

describe('Math rendering — EKF vehicle dynamics', () => {

  describe('Dollar-delimited math', () => {
    let html: string
    beforeAll(() => { html = renderMarkdown(EKF_RESPONSE_DOLLARS) })

    it('renders display math ($$...$$) as KaTeX', () => {
      expect(html).toContain('katex')
      expect(html).toContain('bmatrix')
    })

    it('does NOT leak raw LaTeX tokens as visible text', () => {
      // KaTeX puts source in <annotation> tags — that's fine.
      // Check that raw LaTeX doesn't appear OUTSIDE annotation/mathml tags
      // by stripping all KaTeX-generated markup and checking the remainder.
      const withoutKatex = html
        .replace(/<span class="katex-mathml">[\s\S]*?<\/span><span class="katex-html"/g, '<span class="katex-html"')
        .replace(/<annotation[\s\S]*?<\/annotation>/g, '')
      expect(withoutKatex).not.toContain('\\begin{bmatrix}')
      expect(withoutKatex).not.toContain('\\frac{')
      expect(withoutKatex).not.toContain('$$')
    })

    it('renders inline math ($...$)', () => {
      // $v_y$, $\dot{\psi}$, $\Delta t$ should become KaTeX spans
      expect(html).not.toContain('$v_y$')
      expect(html).not.toContain('$\\dot{')
    })

    it('preserves Python code block as code', () => {
      expect(html).toContain('<pre>')
      expect(html).toContain('<code')
      expect(html).toContain('EKF3DOF')
    })

    it('does NOT mangle code block content', () => {
      // The code block should NOT have math transformations applied
      expect(html).toContain('np.zeros')
      expect(html).toContain('np.linalg.inv')
    })

    it('renders headings', () => {
      expect(html).toContain('<h2')
      expect(html).toContain('<h3')
    })

    it('renders list items', () => {
      expect(html).toContain('<li>')
      expect(html).toContain('lateral velocity')
    })
  })

  describe('Bracket-delimited math (\\[...\\] and \\(...\\))', () => {
    let html: string
    beforeAll(() => { html = renderMarkdown(EKF_RESPONSE_BRACKETS) })

    it('converts bracket delimiters and renders as KaTeX', () => {
      expect(html).toContain('katex')
    })

    it('does NOT leak raw bracket delimiters', () => {
      expect(html).not.toContain('\\[')
      expect(html).not.toContain('\\]')
      expect(html).not.toContain('\\(')
      expect(html).not.toContain('\\)')
    })

    it('does NOT leak raw LaTeX commands as visible text', () => {
      const withoutKatex = html
        .replace(/<span class="katex-mathml">[\s\S]*?<\/span><span class="katex-html"/g, '<span class="katex-html"')
        .replace(/<annotation[\s\S]*?<\/annotation>/g, '')
      expect(withoutKatex).not.toContain('\\begin{bmatrix}')
      expect(withoutKatex).not.toContain('\\mathbf{x}')
    })
  })

  describe('LaTeX accidentally in code fences', () => {
    let html: string
    beforeAll(() => { html = renderMarkdown(LATEX_IN_CODE_FENCE) })

    it('unwraps LaTeX from code fence and renders as math', () => {
      expect(html).toContain('katex')
    })

    it('does NOT show raw \\begin{bmatrix} as visible text', () => {
      const withoutKatex = html
        .replace(/<span class="katex-mathml">[\s\S]*?<\/span><span class="katex-html"/g, '<span class="katex-html"')
        .replace(/<annotation[\s\S]*?<\/annotation>/g, '')
      expect(withoutKatex).not.toContain('\\begin{bmatrix}')
    })
  })

  describe('Code blocks with ASCII art + math mixed', () => {
    let html: string
    beforeAll(() => { html = renderMarkdown(CODE_AND_MATH_MIXED) })

    it('preserves ASCII art in code block', () => {
      expect(html).toContain('+--------+')
      expect(html).toContain('Sensor')
      expect(html).toContain('EKF')
    })

    it('does NOT mangle ASCII art arrows or pipes', () => {
      expect(html).toContain('---&gt;')  // ---> gets HTML-escaped in code
    })

    it('renders the display math outside code block', () => {
      expect(html).toContain('katex')
    })

    it('renders inline math outside code block', () => {
      // $\Delta t = 0.01$ should be rendered
      expect(html).not.toContain('$\\Delta')
    })
  })

  describe('Spaced dollar delimiters (LLM common output)', () => {
    it('renders inline math with spaces: $ \\hat{v} $', () => {
      const html = renderMarkdown('Lateral speed: $ \\hat{v} $')
      expect(html).toContain('katex')
      expect(html).not.toMatch(/\$\s*\\hat/)  // raw $ should not appear
    })

    it('renders inline math: $ S = H P_{k|k-1} H^T + R $', () => {
      const html = renderMarkdown('Innovation covariance:\n$ S = H P_{k|k-1} H^T + R $')
      expect(html).toContain('katex')
      expect(html).not.toMatch(/\$ S = H/)
    })

    it('renders inline math: $ K = P_{k|k-1} H^T S^{-1} $', () => {
      const html = renderMarkdown('Kalman gain:\n$ K = P_{k|k-1} H^T S^{-1} $')
      expect(html).toContain('katex')
    })

    it('renders inline math: $ Q $ and $ R $', () => {
      const html = renderMarkdown('Tune $ Q $ and $ R $ to balance responsiveness.')
      expect(html).toContain('katex')
      // Should not show raw dollar signs
      expect(html).not.toMatch(/\$ Q \$/)
    })

    it('renders $ \\hat{a}_y = \\frac{...}{m} $', () => {
      const html = renderMarkdown('$ \\hat{a}_y = \\frac{C_f \\alpha_f \\cos\\delta + C_r \\alpha_r}{m} $')
      expect(html).toContain('katex')
    })

    it('does NOT break real currency amounts', () => {
      // Currency $N is inherently ambiguous with $-delimited math.
      // remark-math may treat $5 ... $100 as math. Verify the text still renders
      // without errors (no raw $ leaking as broken output).
      const html = renderMarkdown('The price is $5 and the total is $100.')
      expect(html).toContain('price')
      expect(html).toContain('100')
    })

    it('handles multiple spaced inline math on same line', () => {
      const html = renderMarkdown('with $ \\alpha_f $, $ \\alpha_r $ computed from $ \\hat{u} $, $ \\hat{v} $, $ \\hat{r} $.')
      expect(html).toContain('katex')
    })
  })

  describe('Display math — multiline $$ blocks (Chinese text issue)', () => {
    it('renders multiline $$ bmatrix block', () => {
      const input = `2.4 雅可比矩阵 F

$$F = \\frac{\\partial f}{\\partial x} = \\begin{bmatrix}
\\frac{\\partial \\dot{u}}{\\partial u} & \\frac{\\partial \\dot{u}}{\\partial v} & \\frac{\\partial \\dot{u}}{\\partial r} \\\\
\\frac{\\partial \\dot{v}}{\\partial u} & \\frac{\\partial \\dot{v}}{\\partial v} & \\frac{\\partial \\dot{v}}{\\partial r} \\\\
\\frac{\\partial \\dot{r}}{\\partial u} & \\frac{\\partial \\dot{r}}{\\partial v} & \\frac{\\partial \\dot{r}}{\\partial r}
\\end{bmatrix}$$`
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      // Should not show raw \begin{bmatrix} as visible text
      const withoutAnnotations = html.replace(/<annotation[\s\S]*?<\/annotation>/g, '')
      expect(withoutAnnotations).not.toContain('\\begin{bmatrix}')
    })

    it('renders $$ with spaces: $$ F = ... $$', () => {
      const input = `$$ F = \\frac{\\partial f}{\\partial x} $$`
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
    })

    it('renders Chinese + math mixed content', () => {
      const input = `### 状态向量

状态向量定义为：

$$\\mathbf{x} = \\begin{bmatrix} u \\\\ v \\\\ r \\end{bmatrix}$$

其中 $u$ 为纵向速度，$v$ 为横向速度，$r$ 为横摆角速度。`
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      expect(html).toContain('状态向量')
      expect(html).toContain('纵向速度')
    })
  })

  describe('LaTeX line breaks with spacing (\\\\[4pt])', () => {
    it('preserves \\\\[4pt] line break inside display math', () => {
      const input = `$$
\\mathbf{x}_k = f(\\mathbf{x}_{k-1}, \\mathbf{u}_{k-1}) + \\mathbf{w}_{k-1} \\\\[4pt]
\\mathbf{y}_k = h(\\mathbf{x}_k) + \\mathbf{v}_k
$$`
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      // Should NOT show raw \\[4pt] as visible text
      const withoutAnnotations = html.replace(/<annotation[\s\S]*?<\/annotation>/g, '')
      expect(withoutAnnotations).not.toContain('[4pt]')
      expect(withoutAnnotations).not.toContain('\\[4pt]')
    })

    it('preserves \\\\[6pt] line break inside bracket-delimited display math', () => {
      const input = `\\[
\\mathbf{x}_k = f(\\mathbf{x}_{k-1}) \\\\[6pt]
\\mathbf{y}_k = h(\\mathbf{x}_k)
\\]`
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      const withoutAnnotations = html.replace(/<annotation[\s\S]*?<\/annotation>/g, '')
      expect(withoutAnnotations).not.toContain('[6pt]')
    })

    it('preserves \\\\[10mm] line break inside matrix', () => {
      const input = `$$
\\begin{bmatrix}
a & b \\\\[10mm]
c & d
\\end{bmatrix}
$$`
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      const withoutAnnotations = html.replace(/<annotation[\s\S]*?<\/annotation>/g, '')
      expect(withoutAnnotations).not.toContain('[10mm]')
    })

    it('still converts double-escaped display math \\\\[...\\\\] to $$...$$', () => {
      // This is the LLM double-escape case (not a line break)
      const input = `\\\\[
\\mathbf{x} = \\begin{bmatrix} 1 \\\\ 2 \\end{bmatrix}
\\\\]`
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
    })
  })

  describe('Pipe characters in math inside tables', () => {
    it('renders $P_{k|k-1}$ inside a markdown table', () => {
      const input = `| Step | Formula |
|------|---------|
| Predict | $P_{k|k-1} = F P_{k-1|k-1} F^T + Q$ |
| Update  | $K = P_{k|k-1} H^T S^{-1}$ |`
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      // Table should render properly
      expect(html).toContain('<table')
      expect(html).toContain('<td')
    })

    it('renders conditional notation $\\hat{x}_{k|k}$ in table', () => {
      const input = `| Variable | Expression |
|----------|------------|
| State estimate | $\\hat{\\mathbf{x}}_{k|k}$ |`
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      expect(html).toContain('<table')
    })

    it('does NOT break tables without math', () => {
      const input = `| Name | Value |
|------|-------|
| foo  | 42    |`
      const html = renderMarkdown(input)
      expect(html).toContain('<table')
      expect(html).toContain('foo')
      expect(html).toContain('42')
    })

    it('wraps tables in a horizontal-scroll container', () => {
      const input = `| Name | Value |
|------|-------|
| foo  | 42    |`
      const html = renderMarkdown(input)
      expect(html).toContain('class="table-scroll"')
      expect(html).toContain('<table')
      expect(html).toContain('<td')
      // Exactly one wrapper per table (open/close balanced)
      expect((html.match(/class="table-scroll"/g) || []).length).toBe(1)
    })

    it('handles pipe in display math outside tables', () => {
      const input = `$$|x| + |y| = |x + y|$$`
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
    })
  })

  describe('Multiline $$ with bmatrix (LLM output pattern)', () => {
    it('renders $$...\\begin{bmatrix}...\\end{bmatrix}$$ on same line as content', () => {
      // Exact pattern from failing LLM output
      const input = `### 2.3 System Dynamics (Simplified 3-DOF)

$$\\dot{X} = f(X, u) = \\begin{bmatrix}
r \\cdot v_y + a_x \\\\
-v_x \\cdot r + \\frac{2}{m}(C_f \\cdot \\delta + C_r \\cdot \\beta) \\\\
\\frac{1}{I_z}(l_f \\cdot C_f \\cdot \\delta - l_r \\cdot C_r \\cdot \\beta)
\\end{bmatrix}$$

**Parameters:**
- $m$ = vehicle mass
- $I_z$ = yaw moment of inertia
- $C_f, C_r$ = cornering stiffness (front/rear)
- $l_f, l_r$ = distance from CG to front/rear axle`
      const html = renderMarkdown(input)
      // Display math should render as KaTeX
      expect(html).toContain('katex')
      // Should NOT leak raw LaTeX
      const withoutAnnotations = html.replace(/<annotation[\s\S]*?<\/annotation>/g, '')
      expect(withoutAnnotations).not.toContain('\\begin{bmatrix}')
      expect(withoutAnnotations).not.toContain('\\cdot')
      expect(withoutAnnotations).not.toContain('$$')
      // Inline math in parameters should also render
      expect(html).not.toContain('$m$')
      expect(html).not.toContain('$I_z$')
    })

    it('renders $$ bmatrix without blank line after heading', () => {
      const input = `### 2.3 System Dynamics
$$\\dot{X} = f(X, u) = \\begin{bmatrix}
a \\\\
b
\\end{bmatrix}$$`
      const html = renderMarkdown(input)
      const withoutAnnotations = html.replace(/<annotation[\s\S]*?<\/annotation>/g, '')
      expect(withoutAnnotations).not.toContain('\\begin{bmatrix}')
    })
  })

  describe('Streaming mode', () => {
    it('hides trailing unclosed $$ during streaming', () => {
      const partial = 'Some text\n\n$$\n\\begin{bmatrix} v_y'
      const html = renderMarkdown(partial, true)
      // Should trim the unclosed $$ block
      expect(html).not.toContain('\\begin{bmatrix}')
    })

    it('hides trailing unclosed \\[ during streaming', () => {
      const partial = 'Yaw rate is important.\n\n\\[\n\\dot{\\psi}'
      const html = renderMarkdown(partial, true)
      expect(html).not.toContain('\\dot{')
    })

    it('renders complete math blocks during streaming', () => {
      const complete = 'The gain: $$K = PH^T$$ is computed.'
      const html = renderMarkdown(complete, true)
      expect(html).toContain('katex')
    })
  })

  describe('Markdown code blocks rendered as code (not interpreted)', () => {
    it('shows ```markdown content as code, not rendered markdown', () => {
      const input = '````markdown\n# Hello World\n**bold** and *italic*\n````'
      const html = renderMarkdown(input)
      expect(html).toContain('<pre>')
      expect(html).toContain('<code')
      // Content should appear as literal text, not as <h1> or <strong>
      expect(html).not.toContain('<h1')
      expect(html).not.toContain('<strong>')
    })

    it('preserves code block with $ signs inside (no math rendering)', () => {
      const input = '```bash\necho "Total: $100"\nprice=$50\n```'
      const html = renderMarkdown(input)
      expect(html).toContain('<pre>')
      expect(html).toContain('<code')
      // $ signs inside code should NOT trigger KaTeX
      expect(html).toContain('$100')
      expect(html).toContain('$50')
    })

    it('preserves inline code with math-like content', () => {
      const input = 'Use `$x + $y` in the template.'
      const html = renderMarkdown(input)
      expect(html).toContain('<code>')
      // Inline code should not be treated as math
      expect(html).not.toContain('katex')
    })
  })

  describe('Additional LLM output edge cases', () => {
    it('renders \\( inline \\) delimiters converted to $', () => {
      const input = 'The velocity \\( v_x \\) is measured.'
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      expect(html).not.toContain('\\(')
    })

    it('renders nested fractions in display math', () => {
      const input = '$$\\frac{\\frac{a}{b}}{\\frac{c}{d}}$$'
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      const noAnnot = html.replace(/<annotation[\s\S]*?<\/annotation>/g, '')
      expect(noAnnot).not.toContain('\\frac')
    })

    it('handles empty math gracefully', () => {
      const html = renderMarkdown('$$$$')
      // Should not crash — empty math or no-op
      expect(html).toBeDefined()
    })

    it('handles mixed bold + inline math without interference', () => {
      const input = '**Important:** the value $\\alpha$ must satisfy $0 < \\alpha < 1$.'
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      expect(html).toContain('<strong>')
    })

    it('renders GFM strikethrough alongside math', () => {
      const input = '~~old formula $x^2$~~ replaced by $x^3$.'
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      expect(html).toContain('<del>')
    })

    it('renders task list items with math', () => {
      const input = '- [x] Implement $\\hat{x}$ estimator\n- [ ] Add $R$ tuning'
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      // Checkboxes (<input>) are stripped by DOMPurify FORBID_TAGS — expected
      expect(html).toContain('task-list-item')
    })
  })

  describe('Chinese + English bilingual math rendering', () => {
    it('renders inline math directly adjacent to Chinese characters (no space)', () => {
      // Chinese text often has NO space before/after $...$
      const input = '横向加速度$a_y$的估计值通过EKF获得。'
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      expect(html).toContain('横向加速度')
      expect(html).toContain('的估计值')
      expect(html).not.toContain('$a_y$')
    })

    it('renders multiple inline math in Chinese sentence', () => {
      const input = '其中$C_f$为前轮侧偏刚度，$C_r$为后轮侧偏刚度，$l_f$和$l_r$分别为前后轴距。'
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      expect(html).toContain('前轮侧偏刚度')
      expect(html).not.toContain('$C_f$')
      expect(html).not.toContain('$l_r$')
    })

    it('renders display math between Chinese paragraphs', () => {
      const input = `卡尔曼增益计算公式如下：

$$K_k = P_{k|k-1} H^T (H P_{k|k-1} H^T + R_k)^{-1}$$

其中$P_{k|k-1}$为预测协方差矩阵。`
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      expect(html).toContain('卡尔曼增益')
      expect(html).toContain('预测协方差矩阵')
    })

    it('renders Chinese headings with math', () => {
      const input = `### 2.1 状态方程 $\\dot{x} = Ax + Bu$

系统的状态空间表示为上述形式。`
      const html = renderMarkdown(input)
      expect(html).toContain('<h3>')
      expect(html).toContain('katex')
      expect(html).toContain('状态方程')
    })

    it('renders Chinese list items with math', () => {
      const input = `**参数说明：**
- $m$ — 整车质量（kg）
- $I_z$ — 绕z轴的转动惯量（kg·m²）
- $\\delta$ — 前轮转角（rad）
- $\\beta$ — 车身侧偏角（rad）`
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      expect(html).toContain('整车质量')
      expect(html).toContain('转动惯量')
      expect(html).not.toContain('$m$')
      expect(html).not.toContain('$\\delta$')
    })

    it('renders Chinese table with math in cells', () => {
      const input = `| 参数 | 符号 | 单位 |
|------|------|------|
| 整车质量 | $m$ | kg |
| 横摆角速度 | $\\dot{\\psi}$ | rad/s |`
      const html = renderMarkdown(input)
      expect(html).toContain('<table')
      expect(html).toContain('katex')
      expect(html).toContain('整车质量')
      expect(html).toContain('横摆角速度')
    })

    it('handles Chinese punctuation next to math delimiters', () => {
      // Full-width comma，period。colon：semicolon；
      const input = '当$\\alpha > 0$时，系统稳定；当$\\alpha < 0$时，系统不稳定。'
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      expect(html).toContain('系统稳定')
      expect(html).not.toContain('$\\alpha')
    })

    it('renders bracket-delimited math with Chinese text', () => {
      const input = `横向力学方程：

\\[
F_y = m \\cdot a_y = C_f \\alpha_f + C_r \\alpha_r
\\]

其中\\(a_y\\)为横向加速度。`
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      expect(html).toContain('横向力学方程')
      expect(html).not.toContain('\\[')
      expect(html).not.toContain('\\(')
    })

    it('renders multiline bmatrix with Chinese context', () => {
      const input = `### 系统动力学方程

$$\\dot{X} = \\begin{bmatrix}
\\dot{u} \\\\
\\dot{v} \\\\
\\dot{r}
\\end{bmatrix} = \\begin{bmatrix}
r \\cdot v + a_x \\\\
-u \\cdot r + \\frac{F_{yf} + F_{yr}}{m} \\\\
\\frac{l_f F_{yf} - l_r F_{yr}}{I_z}
\\end{bmatrix}$$

**说明：** 以上为简化的三自由度模型。`
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      expect(html).toContain('系统动力学方程')
      expect(html).toContain('三自由度模型')
      const noAnnot = html.replace(/<annotation[\s\S]*?<\/annotation>/g, '')
      expect(noAnnot).not.toContain('\\begin{bmatrix}')
    })

    it('renders spaced dollar delimiters in Chinese text', () => {
      // LLMs sometimes add spaces around $ even in Chinese context
      const input = '横摆角速度 $ \\dot{\\psi} $ 通过陀螺仪测量。'
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      expect(html).not.toMatch(/\$\s*\\dot/)
    })

    it('preserves code blocks in Chinese context', () => {
      const input = `### 实现代码

\`\`\`python
# 横向加速度估计器
class LateralEstimator:
    def __init__(self, m=1500, Iz=2500):
        self.m = m      # 整车质量
        self.Iz = Iz    # 转动惯量
\`\`\`

其中 $m$ 为整车质量参数。`
      const html = renderMarkdown(input)
      expect(html).toContain('<pre>')
      expect(html).toContain('LateralEstimator')
      expect(html).toContain('整车质量')
      // Code block content should not be math-rendered. Syntax highlighting wraps
      // `self` in a token span, but the `.m = m` assignment stays literal text —
      // if the `m`s had been turned into KaTeX, this contiguous string would be
      // broken up by katex markup.
      expect(html).toContain('.m = m')
    })

    it('handles mixed English/Chinese with math in same paragraph', () => {
      const input = 'EKF算法使用状态转移矩阵$F_k$和观测矩阵$H$来实现state estimation，其中Kalman gain $K_k$由以下公式计算。'
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      expect(html).toContain('EKF算法')
      expect(html).toContain('state estimation')
      expect(html).not.toContain('$F_k$')
      expect(html).not.toContain('$H$')
    })
  })

  describe('Consecutive single-line $$ blocks (production LLM pattern)', () => {
    it('renders consecutive $$...$$ blocks separated by text', () => {
      // Exact pattern from production: LLM outputs single-line $$...$$ blocks
      // with Chinese text between them — normalizeDisplayMathBlocks must NOT
      // merge them by eating through closing $$ on the same line.
      const input = `**加法**：同型矩阵对应元素相加
$$(A + B)_{ij} = a_{ij} + b_{ij}$$

**数乘**：标量与矩阵每个元素相乘
$$(kA)_{ij} = k \\cdot a_{ij}$$`
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      expect(html).toContain('加法')
      expect(html).toContain('数乘')
      // Both $$ blocks should be rendered, not merged
      const noAnnot = html.replace(/<annotation[\s\S]*?<\/annotation>/g, '')
      expect(noAnnot).not.toContain('$$(A + B)')
      expect(noAnnot).not.toContain('$$(kA)')
    })

    it('renders multiple consecutive single-line $$ formulas', () => {
      const input = `**运算规律**：
$$A + B = B + A \\quad \\text{（交换律）}$$
$$(A + B) + C = A + (B + C) \\quad \\text{（结合律）}$$
$$k(lA) = (kl)A \\quad \\text{（结合律）}$$
$$k(A + B) = kA + kB \\quad \\text{（分配律）}$$`
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      // Should not leak raw LaTeX
      const noAnnot = html.replace(/<annotation[\s\S]*?<\/annotation>/g, '')
      expect(noAnnot).not.toContain('\\quad')
      expect(noAnnot).not.toContain('\\text')
    })

    it('renders single-line $$ with Chinese inline math between', () => {
      const input = `**定义**：$A \\in \\mathbb{R}^{m \\times n}$，$B \\in \\mathbb{R}^{n \\times p}$，则 $C = AB \\in \\mathbb{R}^{m \\times p}$
$$c_{ij} = \\sum_{k=1}^{n} a_{ik} \\cdot b_{kj}$$`
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      const noAnnot = html.replace(/<annotation[\s\S]*?<\/annotation>/g, '')
      expect(noAnnot).not.toContain('\\sum_')
    })

    it('renders matrix formula tables in Chinese summary', () => {
      const input = `| 主题 | 核心公式 |
|------|----------|
| 乘法 | $c_{ij} = \\sum_k a_{ik}b_{kj}$ |
| 行列式 | $\\det(AB) = \\det(A)\\det(B)$ |
| 逆矩阵 | $A^{-1} = \\frac{1}{\\det(A)}A^*$ |`
      const html = renderMarkdown(input)
      expect(html).toContain('<table')
      expect(html).toContain('katex')
      expect(html).toContain('乘法')
    })

    it('renders vmatrix determinant notation', () => {
      const input = `$$\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix} = ad - bc$$`
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      const noAnnot = html.replace(/<annotation[\s\S]*?<\/annotation>/g, '')
      expect(noAnnot).not.toContain('\\begin{vmatrix}')
    })

    it('renders bmatrix with multiline block-style $$', () => {
      const input = `$$A^* = \\begin{bmatrix} C_{11} & C_{21} & \\cdots & C_{n1} \\\\ C_{12} & C_{22} & \\cdots & C_{n2} \\\\ \\vdots & \\vdots & & \\vdots \\\\ C_{1n} & C_{2n} & \\cdots & C_{nn} \\end{bmatrix}$$`
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      const noAnnot = html.replace(/<annotation[\s\S]*?<\/annotation>/g, '')
      expect(noAnnot).not.toContain('\\begin{bmatrix}')
    })

    it('renders inline math with \\left[ and \\right] brackets', () => {
      const input = '其中 $\\mathbf{c} = \\left[-\\frac{C_f + C_r}{m v_x}, \\frac{C_f L_f - C_r L_r}{m v_x} + v_x, 0\\right]^T$'
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      expect(html).toContain('其中')
      const noAnnot = html.replace(/<annotation[\s\S]*?<\/annotation>/g, '')
      expect(noAnnot).not.toContain('$\\mathbf')
      expect(noAnnot).not.toContain('\\left[')
      expect(noAnnot).not.toContain('\\right]')
    })
  })
  describe('Bare / un-delimited LaTeX (model ignored the $ instruction)', () => {
    // Helper: KaTeX keeps the source in <annotation>; strip that to assert the
    // raw LaTeX isn't leaking as visible text.
    const stripKatex = (html: string) =>
      html
        .replace(/<span class="katex-mathml">[\s\S]*?<\/span><span class="katex-html"/g, '<span class="katex-html"')
        .replace(/<annotation[\s\S]*?<\/annotation>/g, '')

    it('renders the exact reported MPC cost function (bare, double-escaped)', () => {
      const input = 'J = \\sum_{i=1}^{N} \\left\\vert i(k+i\\vert k) - i^*(k+i) \\right\\vert _Q^2 + \\sum_{i=0}^{N-1} \\left\\vert u(k+i\\vert k) \\right\\vert _R^2'
      const html = renderMarkdown(input)
      expect(html).toContain('katex')
      const visible = stripKatex(html)
      expect(visible).not.toContain('\\sum')
      expect(visible).not.toContain('\\vert')
      expect(visible).not.toContain('\\left')
    })

    it('wraps a bare equation line with \\frac', () => {
      const html = renderMarkdown('a_y = \\frac{F_{yf} + F_{yr}}{m}')
      expect(html).toContain('katex')
      expect(stripKatex(html)).not.toContain('\\frac')
    })

    it('repairs double-escaped commands on a bare line', () => {
      const html = renderMarkdown('S = \\\\sum_{i}^{N} \\\\frac{a}{b}')
      expect(html).toContain('katex')
      expect(stripKatex(html)).not.toContain('\\frac')
    })

    // ── Guard cases: these must NOT be wrapped/mangled ──────────────────────
    it('does NOT wrap a prose line that merely mentions one \\frac', () => {
      const html = renderMarkdown('The fraction \\frac{a}{b} represents the ratio of a to b here.')
      expect(html).not.toContain('katex')
    })

    it('does NOT wrap a Windows path', () => {
      const html = renderMarkdown('Open C:\\Users\\name\\file.txt to continue.')
      expect(html).not.toContain('katex')
    })

    it('does NOT break a GFM table row', () => {
      const input = `| Symbol | Meaning |
|--------|---------|
| \\alpha | angle |`
      const html = renderMarkdown(input)
      expect(html).toContain('<table')
    })

    it('does NOT wrap LaTeX-looking content inside a code fence', () => {
      const input = '```\nJ = \\sum_{i=1}^{N} x_i\n```'
      const html = renderMarkdown(input)
      expect(html).toContain('<pre>')
      expect(html).not.toContain('katex')
    })

    it('does NOT wrap a Chinese prose line ending in a command', () => {
      const html = renderMarkdown('请参考求和符号 \\sum 的定义说明。')
      expect(html).not.toContain('katex')
    })
  })
})

import { beforeAll } from 'vitest'
