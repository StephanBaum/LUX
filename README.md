# LUX Studio Website

Technical documentation for developers.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
# → http://localhost:4321

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
site_v3/
├── src/
│   ├── layouts/
│   │   └── Base.astro          # Main layout (header, footer, scripts)
│   ├── components/
│   │   ├── Header.astro        # Site header with logo + menu toggle
│   │   ├── MenuOverlay.astro   # Full-screen menu overlay
│   │   └── Footer.astro        # Site footer with contact + nav
│   └── pages/
│       ├── index.astro         # Homepage
│       ├── mieten.astro        # Rental/booking page
│       ├── studio.astro        # Studio information
│       ├── workshops.astro     # Workshops listing
│       └── veranstaltungen.astro # Events listing
├── public/
│   ├── Assets/                 # Images and media
│   │   └── img/
│   ├── js/                     # Client-side scripts
│   │   ├── animations.js       # GSAP scroll animations
│   │   ├── menu.js             # Menu toggle functionality
│   │   ├── hero.js             # Homepage hero interactions
│   │   ├── slider.js           # Image carousel
│   │   ├── accordion.js        # Expandable sections
│   │   ├── calendar.js         # Date picker
│   │   ├── form.js             # Form validation
│   │   └── i18n.js             # Translation system
│   ├── styles/
│   │   ├── main.css            # Global styles + design tokens
│   │   └── components/         # Component-specific styles
│   └── content/                # Translation files (see EDITING.md)
│       ├── de/
│       ├── en/
│       ├── fr/
│       └── lu/
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

## Technology Stack

| Technology | Purpose |
|------------|---------|
| [Astro](https://astro.build) | Static site generator |
| [@astrojs/sitemap](https://docs.astro.build/en/guides/integrations-guide/sitemap/) | Sitemap generation |
| Vanilla JS | Client-side interactions |
| [GSAP](https://greensock.com/gsap/) | Animations & scroll effects |
| CSS Custom Properties | Design tokens |

## SEO & Structured Data

The site includes comprehensive SEO optimization for Google Rich Snippets.

### Features
- **Sitemap**: Auto-generated at `/sitemap-index.xml`
- **Open Graph tags**: For social media sharing (Facebook, LinkedIn)
- **Twitter Cards**: Large image cards for Twitter
- **Canonical URLs**: Prevent duplicate content issues
- **JSON-LD Structured Data**: Schema.org markup for rich snippets

### Structured Data by Page

| Page | Schema Type | Data |
|------|-------------|------|
| `index.astro` | Organization | Company info, contact, address |
| `studio.astro` | PhotographyBusiness | Location, hours, services |
| `workshops.astro` | Course (x3) | Workshop details, provider |
| `mieten.astro` | Product (x3) | Rental options with pricing |

### SEO Component

Reusable component for JSON-LD structured data:

```astro
---
import SEO from '../components/SEO.astro';

const schema = {
  '@type': 'Organization',
  name: 'Studio Luxenburger',
  // ... schema data
};
---

<Base title="Page Title">
  <SEO schema={schema} slot="head" />
  <!-- Page content -->
</Base>
```

### Verification Tools
- **Rich Results Test**: https://search.google.com/test/rich-results
- **Schema Validator**: https://validator.schema.org/
- **OG Debugger**: https://developers.facebook.com/tools/debug/

## Components

### Base.astro
The main layout wrapper. All pages use this layout.

**Props:**
- `title` (string) - Page title (used in `<title>` and OG tags)
- `description` (string) - Meta description (defaults to site description)
- `image` (string) - OG image URL (defaults to `/Assets/img/og-image.jpg`)
- `type` (string) - OG type: `website` or `article` (defaults to `website`)
- `noindex` (boolean) - Set `true` to exclude from search engines

**Slots:**
- `default` - Main page content
- `head` - Additional elements for `<head>` (JSON-LD, etc.)
- `scripts` - Page-specific scripts

**Usage:**
```astro
---
import Base from '../layouts/Base.astro';
import SEO from '../components/SEO.astro';
---

<Base
  title="Page Title - LUX Studio"
  description="Custom page description for SEO"
  image="/Assets/img/custom-og.jpg"
>
  <SEO schema={schemaObject} slot="head" />

  <!-- Page content -->

  <script src="../scripts/page-script.js" slot="scripts"></script>
</Base>
```

### Header.astro
Site header with logo and hamburger menu toggle. No props.

### MenuOverlay.astro
Full-screen navigation overlay. Contains:
- Navigation links
- Contact information
- Language switcher
- Legal links

### Footer.astro
Site footer with:
- Logo
- Address
- Contact details
- Navigation
- Partners
- Language switcher

## Adding a New Page

1. Create `src/pages/newpage.astro`:
```astro
---
import Base from '../layouts/Base.astro';
---

<Base title="New Page - LUX Studio">
  <section class="page-header">
    <div class="page-header__container grid">
      <h1 class="page-header__title" data-i18n="header.title">Page Title</h1>
    </div>
  </section>

  <!-- Page content -->
</Base>
```

2. Create translation files in `public/content/*/newpage.md`

3. Add navigation links in:
   - `src/components/MenuOverlay.astro`
   - `src/components/Footer.astro`

## Scripts

Scripts use the `is:inline` directive to prevent Astro bundling:

```astro
<!-- In Base.astro or page files -->
<script is:inline src="/js/script-name.js"></script>
```

### Page-specific scripts
Add to the `scripts` slot in your page:
```astro
<script is:inline src="/js/accordion.js" slot="scripts"></script>
```

## Styling

### Design Tokens
Defined in `public/styles/main.css`:

```css
:root {
  --color-primary: #2A9D8F;
  --color-black: #1a1a1a;
  --color-white: #ffffff;

  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 48px;

  --font-body: 'Inter', sans-serif;
  --font-detail: 'Lekton', monospace;
}
```

### Grid System
12-column grid with `grid` class:
```html
<div class="grid">
  <!-- Content aligned to grid -->
</div>
```

## i18n System

Client-side translation using markdown files with YAML frontmatter.

### How it works
1. `i18n.js` loads on page load
2. Detects language from: cookie → URL param → browser → default (de)
3. Fetches `/content/{lang}/_global.md` and `/content/{lang}/{page}.md`
4. Replaces content in elements with `data-i18n` attribute

### Adding translatable text
```html
<span data-i18n="section.key">Fallback text</span>
```

See `EDITING.md` for content editing instructions.

## Build Output

```bash
npm run build
```

Generates static HTML in `dist/`. Deploy to any static host.

## Git Workflow

```bash
# Current branch
git branch
# → astro-migration

# To revert to original HTML version
git checkout master
```
