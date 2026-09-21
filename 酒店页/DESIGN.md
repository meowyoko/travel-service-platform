---
name: Serene Corporate Wellness
colors:
  surface: '#fbf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fbf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae8e7'
  surface-container-highest: '#e4e2e1'
  on-surface: '#1b1c1c'
  on-surface-variant: '#3f484b'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0f0'
  outline: '#6f797c'
  outline-variant: '#bfc8cb'
  surface-tint: '#176778'
  primary: '#126576'
  on-primary: '#ffffff'
  primary-container: '#367e8f'
  on-primary-container: '#f9fdff'
  inverse-primary: '#8cd1e4'
  secondary: '#36656e'
  on-secondary: '#ffffff'
  secondary-container: '#baebf5'
  on-secondary-container: '#3c6b75'
  tertiary: '#555d5f'
  on-tertiary: '#ffffff'
  tertiary-container: '#6e7678'
  on-tertiary-container: '#f8fdff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#adecff'
  primary-fixed-dim: '#8cd1e4'
  on-primary-fixed: '#001f26'
  on-primary-fixed-variant: '#004e5c'
  secondary-fixed: '#baebf5'
  secondary-fixed-dim: '#9fced9'
  on-secondary-fixed: '#001f25'
  on-secondary-fixed-variant: '#1b4d56'
  tertiary-fixed: '#dce4e6'
  tertiary-fixed-dim: '#c0c8ca'
  on-tertiary-fixed: '#151d1f'
  on-tertiary-fixed-variant: '#40484a'
  background: '#fbf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e1'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 36px
    fontWeight: '500'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 28px
    fontWeight: '500'
    lineHeight: 36px
  headline-md:
    fontFamily: Manrope
    fontSize: 22px
    fontWeight: '500'
    lineHeight: 30px
  headline-sm:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
  body-lg:
    fontFamily: Noto Sans SC
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Noto Sans SC
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 40px
  section-gap: 64px
  element-gap: 16px
  gutter: 24px
---

## Brand & Style

This design system is tailored for a high-end corporate employee service platform focused on healing and convalescence. The brand personality is **Professional, Empathetic, and Translucent**. It balances the structural reliability required by a large corporation with the restorative, calming atmosphere of a premium travel and wellness service.

The design style follows a **Refined Minimalist** approach. It avoids the heavy "container-within-container" clutter of traditional e-commerce. Instead, it utilizes expansive whitespace, hair-line dividers, and subtle tonal shifts to organize information. The goal is to reduce cognitive load, reflecting the "healing" nature of the service itself through a clean, airy, and sophisticated interface.

## Colors

The palette is anchored in **Low-Saturation Teal** to provide a sense of calm authority. 

- **Primary (#4A90A2):** Used for key actions and brand presence. It is professional yet softer than standard corporate blue.
- **Healing Accent (#98B4A6):** A muted sage green used sparingly to signify wellness, nature, and convalescence.
- **Background (#FAFAFA):** A clinical yet warm off-white that prevents screen glare and provides a soft canvas for content.
- **Text (#333333):** Deep charcoal ensures high legibility while appearing more sophisticated and less "digital" than pure black.
- **Dividers (#EEEEEE):** Ultra-thin lines used to separate sections without creating visual barriers.

## Typography

The typography system prioritizes clarity and a "breathable" rhythm. **Manrope** is used for Latin characters and numerals to provide a modern, technical precision, while **Noto Sans SC** handles Chinese text with grace and neutrality.

- **Weight Restraint:** Use `Medium (500)` for headings instead of Bold to maintain a sophisticated, lightweight feel.
- **Line Height:** Body text uses a generous `1.7x` or `1.8x` line height to enhance the feeling of "space" and ease of reading.
- **Hierarchy:** Contrast is achieved through size and subtle color shifts (e.g., using Secondary Teal for sub-headers) rather than heavy weights.

## Layout & Spacing

The layout utilizes a **Fixed Grid** for desktop (12 columns, 1200px max-width) to ensure a controlled, premium reading experience. 

- **Breathing Room:** We utilize an 8px base grid but often double the standard padding to create "intentional voids." Section headers should have significant top-margin to clearly delineate service categories.
- **Thin Dividers:** Instead of cards, use horizontal rules (`1px`, `#EEEEEE`) to separate list items.
- **Mobile Adaptivity:** On mobile, margins reduce to 20px, and vertical spacing between items is increased to maintain touch-target safety without adding visual bulk.

## Elevation & Depth

To maintain the "Clean & Healing" aesthetic, this design system **avoids heavy shadows**. Depth is communicated through:

- **Tonal Layering:** Using the Tertiary Teal (#E8F0F2) as a subtle background tint for hovered states or "sticky" navigation bars.
- **Flat Surface Logic:** Elements sit on the same plane, separated by whitespace and thin lines. 
- **Soft Overlays:** For modal dialogues, use a high-blur (40px+) backdrop filter (glassmorphism) with a very low opacity white tint to keep the user grounded in the service context.

## Shapes

The shape language is **Soft (Level 1)**. 

We use small corner radii (4px to 8px) to provide a "human" touch without becoming too playful or "bubbly." This strikes a balance between the precision of a corporate tool and the comfort of a wellness service. Interactive elements like buttons and input fields should feel crisp but never sharp.

## Components

### Buttons
- **Primary:** Solid #4A90A2 with white text. No shadows. Refined padding (12px 24px).
- **Ghost:** Thin 1px border in Primary Teal. Used for secondary actions to keep the UI light.

### Chips & Status Tags
- Used for "Convalescence Status" (e.g., 待执行, 已完成).
- Backgrounds should be very pale tints of the status color (e.g., pale green for "Active") with slightly darker text. No borders.

### List Items
- Wide, horizontal layout with high internal padding.
- Imagery (destination photos) should have a 4px corner radius and be presented in a consistent aspect ratio (16:9 or 4:3).
- Titles use `headline-sm`, descriptions use `body-md` in a lighter grey.

### Input Fields
- Underline style or very light 4-sided border (#DDDDDD). 
- Focus state uses a simple color change to Primary Teal without heavy glow effects.

### Cards (Restrained)
- Only used for featured "Healing Packages." 
- No borders; use a very subtle #000000 (0.04 opacity) shadow or a light grey fill to distinguish from the background.