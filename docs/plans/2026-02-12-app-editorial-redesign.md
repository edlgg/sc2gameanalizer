# App Editorial Redesign - Design Specification

**Date:** 2026-02-12
**Goal:** Redesign logged-in application UI to match editorial landing page aesthetic while preserving all data, charts, tables, and functionality.

## Design Approach

**Selected:** Approach 3 - Hero + Clean Data
- Top section (Game Overview): Full editorial treatment with dramatic stats, Bebas Neue, rotated cards, blue accents
- Charts/Tables below: Clean and functional with editorial typography, blue accents, but no rotation/overlap

## Design System

**Typography:**
- Display/Headers: Bebas Neue (already loaded)
- Body/Labels: DM Sans (already loaded)
- Code/Monospace: 'Courier New' monospace

**Colors:**
- Blue accent: #1a8fff (var(--ed-blue))
- Background: #0a0a0a
- Secondary background: rgba(15, 15, 20, 0.4)
- Text: white / gray-400 / gray-500
- Borders: rgba(26, 143, 255, 0.15)

**Spacing:**
- Consistent use of clamp() for responsive scaling
- Max width: 1400px
- Section gaps: 4rem between major groups, 2rem between charts

## Component Specifications

### 1. Navigation Header

**Container:**
- Background: rgba(10, 10, 10, 0.8) with backdrop-blur(12px)
- Border-bottom: 1px solid rgba(26, 143, 255, 0.15)
- Height: 72px, sticky positioning

**Logo:**
- "SC2" in Bebas Neue 32px
- "REPLAY ANALYZER" in DM Sans 10px, letter-spacing 0.15em
- Stacked vertically with blue accent dot

**Navigation:**
- Bebas Neue 16px, uppercase, letter-spacing 0.02em
- Active state: blue underline (3px) with smooth slide animation
- Hover: color shift to blue, 200ms transition

**User Section:**
- Upload counter: "2/3 UPLOADS" in Bebas Neue 14px
- User email in DM Sans 12px, gray-400
- Pro badge: "PRO" with blue background
- Logout in DM Sans 12px

### 2. Game Overview Hero

**Layout:**
- Full-width container, dark gradient background
- Blue accent line across top (4px, 60% opacity)
- Two-column: 55% dramatic stats, 40% metadata grid
- Mobile: Stack vertically

**Left Column - Dramatic Stats:**
- Matchup: Bebas Neue 48px, letter-spacing 0.02em
- Map: Bebas Neue 32px, #1a8fff color
- Result/Duration with rotated decorative elements
- Vertical blue accent line (4px × 60%)

**Right Column - Metadata Grid:**
- 2×2 grid of stat cards
- Label: DM Sans 12px uppercase, gray-400
- Value: Bebas Neue 24px, white
- Border-left blue accent (2px)
- No icons

### 3. Chart Sections

**Section Headers:**
- Numbered: "01 ECONOMY COMPARISON"
- Title: Bebas Neue 28px with blue accent number
- Subtitle: DM Sans 14px, gray-400
- Blue accent line below (2px × 40px)

**Containers:**
- Background: rgba(15, 15, 20, 0.4)
- Border: 1px solid rgba(26, 143, 255, 0.15)
- Sharp corners (border-radius: 0)
- Padding: 2rem, margin-bottom: 2rem

**Chart Colors:**
- Primary: #1a8fff
- Secondary: #60a5fa
- Grid lines: rgba(255, 255, 255, 0.05)
- Axis labels: DM Sans 11px, gray-500

### 4. Data Tables

**Headers:**
- Bebas Neue 14px, uppercase, letter-spacing 0.05em
- Blue accent bottom border (2px)
- Background: rgba(26, 143, 255, 0.05)

**Rows:**
- Alternating: transparent / rgba(255, 255, 255, 0.02)
- Hover: rgba(26, 143, 255, 0.1)
- DM Sans 13px content
- Subtle dividers: 1px rgba(255, 255, 255, 0.05)

### 5. Animations

**Page Load:**
- Stagger cascade: hero (0ms) → charts (150ms+)
- fadeSlideUp animation (opacity 0→1, translateY 20px→0)

**Hover States:**
- Chart containers: border opacity 0.15 → 0.3
- Table rows: blue tint, 150ms transition
- Buttons: scale 1.0 → 1.02 + blue glow

**Loading States:**
- Skeleton screens with blue animated gradient
- Loading text: Bebas Neue "ANALYZING REPLAY..."

## Implementation Plan

### Files to Create:
1. `frontend/src/components/EditorialHeader.tsx`
2. `frontend/src/components/EditorialLayout.tsx`
3. `frontend/src/components/GameOverviewHero.tsx`
4. `frontend/src/components/charts/EditorialSectionHeader.tsx`

### Files to Modify:
1. `frontend/src/index.css` - Add editorial design system classes
2. `frontend/src/App.tsx` - Integrate EditorialHeader when logged in
3. `frontend/src/components/ComparisonDashboard.tsx` - Apply editorial layout
4. `frontend/src/components/Dashboard.tsx` - Apply editorial layout
5. All chart components in `frontend/src/components/charts/` - Wrap with editorial containers

### CSS Organization:
- Add CSS custom properties to `:root`
- Create reusable classes: `.editorial-*`
- Define animation keyframes
- Update existing component classes

### Migration Strategy:
**All at Once** - Implement entire design system in single session for visual consistency.

### Verification:
- Use MCP Chrome DevTools to validate
- Test all views: Dashboard, Comparison, Game Detail
- Validate responsive breakpoints (mobile, tablet, desktop)
- Check animations and interactive states
- Run frontend lint: `cd frontend && npm run lint`

## Success Criteria

- [ ] Editorial header matches landing page aesthetic
- [ ] Game Overview hero is dramatic and magazine-style
- [ ] All chart sections have editorial headers with numbering
- [ ] Tables use editorial typography and styling
- [ ] Color palette consistent (#1a8fff blue accent)
- [ ] Typography uses Bebas Neue + DM Sans throughout
- [ ] Animations smooth and polished
- [ ] Responsive design works on all breakpoints
- [ ] All existing functionality preserved
- [ ] No console errors
- [ ] Lint passes
