# Content Editing Guide

This guide explains how to edit text content and translations on the LUX Studio website.

## Content Location

All editable text is stored in markdown files:

```
public/content/
├── de/                 # German (default)
│   ├── _global.md      # Shared text (navigation, footer, etc.)
│   ├── index.md        # Homepage
│   ├── mieten.md       # Rental page
│   ├── studio.md       # Studio page
│   ├── workshops.md    # Workshops page
│   └── veranstaltungen.md  # Events page
├── en/                 # English
├── fr/                 # French
└── lu/                 # Luxembourgish
```

## File Format

Each file uses YAML frontmatter format:

```yaml
---
# Comment (ignored)

section_name:
  key: "The text to display"
  another_key: "More text here"

another_section:
  title: "Section Title"
  text: "Section description text."
---
```

## Editing Text

### Step 1: Find the right file

| To edit... | Edit this file |
|------------|----------------|
| Navigation labels | `_global.md` |
| Footer text | `_global.md` |
| Homepage content | `index.md` |
| Rental page content | `mieten.md` |
| Studio page content | `studio.md` |
| Workshops content | `workshops.md` |
| Events content | `veranstaltungen.md` |

### Step 2: Locate the text

Open the file and find the key you want to change. Keys are organized by section:

```yaml
section_menschen:
  label: "Die Menschen"           # Section label
  title: "Florian & Martin..."    # Main title
  bio: "Vater und Sohn..."        # Biography text
  education_title: "Expertise"    # Subsection title
```

### Step 3: Edit and save

Change the text between quotes and save the file:

```yaml
# Before
title: "Old Title"

# After
title: "New Title"
```

### Step 4: Refresh the browser

Changes appear immediately after refreshing the page.

## Common Content Areas

### Navigation (`_global.md`)

```yaml
nav:
  workshops: "Workshops"
  veranstaltungen: "Veranstaltungen"
  studio: "Studio"
  mieten: "Mieten"
```

### Footer (`_global.md`)

```yaml
footer:
  partners_label: "Studiopartner:"
  impressum: "Impressum"
  datenschutz: "Datenschutz"
  agb: "AGB"
```

### Page Headers (page-specific files)

```yaml
header:
  title: "Page Title"
  text: "Introductory paragraph for the page."
```

### Call-to-Action Sections

```yaml
cta:
  title: "Anfragen"
  text: "Description text for the CTA section."
  link: "Kontakt"
```

### People/Profile Section

```yaml
section_menschen:
  label: "Die Menschen"
  title: "Florian & Martin Luxenburger"
  bio: "Biography text goes here..."
  education_title: "Expertise"
  expertise1_title: "Analoge Fotografie"
  expertise1_detail: "Großformat, Mittelformat, Dunkelkammer"
  expertise1_year: "seit 1985"
  expertise2_title: "Digitale Produktion"
  expertise2_detail: "Werbung, Portrait, Produktfotografie"
```

## Adding Translations

To add or update a translation:

1. Edit the file in **each language folder** (`de/`, `en/`, `fr/`, `lu/`)
2. Keep the keys identical, only change the text values

**Example - German (`de/index.md`):**
```yaml
cta:
  title: "Projekt starten"
  link: "Kontakt aufnehmen"
```

**Example - English (`en/index.md`):**
```yaml
cta:
  title: "Start Your Project"
  link: "Get in Touch"
```

## Language Support

| Code | Language |
|------|----------|
| `de` | German (default) |
| `en` | English |
| `fr` | French |
| `lu` | Luxembourgish |

Users can switch languages via the language selector in the menu or footer.

## Tips

### Quotes and Special Characters

Always wrap text in quotes. For text containing quotes, use the other quote style:

```yaml
# Use double quotes normally
title: "Regular Title"

# For text with apostrophes, double quotes work fine
text: "That's great"

# For text with double quotes, use single quotes outside
text: 'He said "Hello"'
```

### Multi-line Text

For longer text, keep it on one line or use `>`:

```yaml
# One line (recommended for shorter text)
text: "This is a complete sentence that fits on one line."

# Multi-line with > (preserves as single paragraph)
text: >
  This is a longer piece of text that spans
  multiple lines but will be rendered as
  a single paragraph.
```

### Missing Translations

If a translation is missing, the German version will be used as fallback.

## Images

Images are stored in `public/Assets/img/`. To change images, replace the files keeping the same filename, or update the image paths in the Astro page files (`src/pages/*.astro`).

## Need Help?

For structural changes (adding sections, changing layout), contact the developer. See `README.md` for technical documentation.
