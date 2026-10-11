---
name: frontend-expert
description: >-
  Expert guidance for modern, scalable, production-grade frontend architecture and engineering.
  Use when building web user interfaces, styling systems (Tailwind CSS, CSS Modules), component design,
  state management, responsive design, accessibility, performance optimization, and avoiding generic "vibe coded" aesthetics.
---

# Frontend Expert Skill

This skill guides the construction of resilient, clean, and professional modern frontends that avoid sloppy AI tropes ("vibe-coded", random gradients, misaligned spacing, fragile monolithic JS).

## Core Principles

1. **Design System & Tokens**:
   - Establish strict typographic scales, consistent semantic color tokens (surface, background, border, text-muted, accent), and spacing scales.
   - Avoid random gradients, over-the-top neon glows, or arbitrary inline styles.

2. **Component Architecture**:
   - Modular, single-responsibility components with clear props and typing.
   - Separation of data-fetching / state orchestration from pure presentation components.

3. **Performance & Clean State**:
   - Debounce search and high-frequency inputs.
   - Virtualize or paginate long lists (such as job/internship tables).
   - Clean state handling for Loading, Empty, Error, and Populated states.

4. **UX Patterns**:
   - Instant optimistic feedback on user interactions.
   - Accessible keyboard navigation (`Cmd+K` palette, escape to close modals, tab indexes).
   - High data density balanced with readable whitespace (e.g., Linear, GitHub, Stripe, Vercel design aesthetic).
