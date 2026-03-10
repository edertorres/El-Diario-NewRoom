# Typst Reference Documentation

## html.md

<div class="info-box">

Typst's HTML export is currently under active development. The feature is still
very incomplete and only available for experimentation behind a feature flag. Do
not use this feature for production use cases. In the CLI, you can experiment
with HTML export by passing `--features html` or setting the `TYPST_FEATURES`
environment variables to `html`. In the web app, HTML export is not available at
this time. Visit the [tracking issue](https://github.com/typst/typst/issues/5512)
to follow progress on HTML export and learn more about planned features.
</div>

HTML files describe a document structurally. The aim of Typst's HTML export is
to capture the structure of an input document and produce semantically rich HTML
that retains this structure. The resulting HTML should be accessible,
human-readable, and editable by hand and downstream tools.

PDF, PNG, and SVG export, in contrast, all produce _visual_ representations of a
fully-laid out document. This divergence in the formats' intents means that
Typst cannot simply produce perfect HTML for your existing Typst documents. It
cannot always know what the best semantic HTML representation of your content
is.

Instead, it gives _you_ full control: You can check the current export format
through the [`target`] function and when it is set to HTML, generate [raw HTML
elements]($html.elem). The primary intended use of these elements is in
templates and show rules. This way, the document's contents can be fully
agnostic to the export target and content can be shared between PDF and HTML
export.

Currently, Typst will always output a single HTML file. Support for outputting
directories with multiple HTML documents and assets, as well as support for
outputting fragments that can be integrated into other HTML documents is
planned.

Typst currently does not output CSS style sheets, instead focussing on emitting
semantic markup. You can of course write your own CSS styles and still benefit
from sharing your _content_ between PDF and HTML. For the future, we plan to
give you the option of automatically emitting CSS, taking more of your existing
set rules into account.

# Exporting as HTML
## Command Line
Pass `--format html` to the `compile` or `watch` subcommand or provide an output
file name that ends with `.html`. Note that you must also pass `--features html`
or set `TYPST_FEATURES=html` to enable this experimental export target.

When using `typst watch`, Typst will spin up a live-reloading HTTP server. You
can configure it as follows:

- Pass `--port` to change the port. (Defaults to the first free port in the
  range 3000-3005.)
- Pass `--no-reload` to disable injection of a live reload script. (The HTML
  that is written to disk isn't affected either way.)
- Pass `--no-serve` to disable the server altogether.

## Web App
Not currently available.

# HTML-specific functionality
Typst exposes HTML-specific functionality in the global `html` module. See below
for the definitions it contains.


---

## pdf.md

PDF files focus on accurately describing documents visually, but also have
facilities for annotating their structure. This hybrid approach makes
them a good fit for document exchange: They render exactly the same on every
device, but also support extraction of a document's content and structure (at
least to an extent). Unlike PNG files, PDFs are not bound to a specific
resolution. Hence, you can view them at any size without incurring a loss of
quality.

# Exporting as PDF
## Command Line
PDF is Typst's default export format. Running the `compile` or `watch`
subcommand without specifying a format will create a PDF. When exporting to PDF,
you have the following configuration options:

- Which [PDF standards](#pdf-standards) Typst should enforce conformance with by
  specifying `--pdf-standard` followed by one or multiple comma-separated
  standards. Valid standards are `1.4`, `1.5`, `1.6`, `1.7`, `2.0`, `a-1b`,
  `a-1a`, `a-2b`, `a-2u`, `a-2a`, `a-3b`, `a-3u`, `a-3a`, `a-4`, `a-4f`, `a-4e`,
  and `ua-1`. By default, Typst outputs PDF-1.7-compliant files.

- You can disable PDF tagging completely with `--no-pdf-tags`. By default, Typst
  will always write _Tagged PDF_ to provide a baseline level of accessibility.
  Using this flag, you can turn tags off. This will make your file inaccessible
  and prevent conformance with accessible conformance levels of PDF/A and all
  parts of PDF/UA.

- Which pages to export by specifying `--pages` followed by a comma-separated
  list of numbers or dash-separated number ranges. Ranges can be half-open.
  Example: `2,3,7-9,11-`.

## Web App
Click the quick download button at the top right to export a PDF with default
settings. For further configuration, click "File" > "Export as" > "PDF" or click
the downwards-facing arrow next to the quick download button and select "Export
as PDF". When exporting to PDF, you have the following configuration options:

- Which PDF standards Typst should enforce conformance with. By default, Typst
  outputs PDF-1.7-compliant files. You can choose the PDF version freely between
  1.4 and 2.0. Valid additional standards are `A-1b`, `A-1a`, `A-2b`, `A-2u`,
  `A-2a`, `A-3b`. `A-3u`, `A-3a`, `A-4`, `A-4f`, `A-4e`, and `UA-1`.

- Which pages to export. Valid options are "All pages", "Current page", and
  "Custom ranges". Custom ranges are a comma-separated list of numbers or
  dash-separated number ranges. Ranges can be half-open. Example: `2,3,7-9,11-`.

# PDF standards
The International Standards Organization (ISO) has published the base PDF
standard and various standards that extend it to make PDFs more suitable for
specific use-cases. By default, Typst exports PDF 1.7 files. Adobe Acrobat 8 and
later as well as all other commonly used PDF viewers are compatible with this
PDF version.

Some features of Typst may not be available depending on the PDF standard you
choose. You currently cannot choose both PDF/A and PDF/UA at the same time.

## PDF versions
Typst supports five different PDF versions: 1.4, 1.5, 1.6, 1.7 (default), and
2.0. You can choose each of these versions for your document export. However,
based on the features you used there may be a minimum version. Likewise, the
standards you target can limit which versions you can choose (see below for
more).

Here is a list on how each new version improves over PDF 1.4 for Typst
documents:

- **PDF 1.5** (2003): Improved color management, text extraction, table
  accessibility, reflow, and emoji fonts
- **PDF 1.6** (2004): More flexible links
- **PDF 1.7** (2006): Allows [attachments]($pdf.attach), improved reflow
- **PDF 2.0** (2017): Improved both metadata and tag semantics for accessibility

The software used to read your file must support your PDF version. Under normal
circumstances, this poses no problem, but it can be a source of errors when
working with older hardware. For general exchange, we recommend keeping the
default PDF 1.7 setting or choosing PDF 2.0.

When using PDF files as [images]($image) in your document, the export PDF
version must equal or exceed the image file versions.

## PDF/UA
Typst supports writing PDF/UA-conformant files. PDF/UA files are designed
for _[Universal Access]($guides/accessibility/#basics)._ When you choose this PDF
standard, Typst will run additional checks when exporting your document. These
checks will make sure that you are following accessibility best practices. For
example, it will make sure that all your images come with alternative
descriptions.

Note that there are some rules in PDF/UA that are crucial for accessibility but
cannot be automatically checked. Hence, when exporting a PDF/UA-1 document, make
sure you did the following:

- If your document is written in a different language than English, make sure
  [set the text language]($text.lang) before any content.
- Make sure to use Typst's semantic elements (like [headings]($heading),
  [figures]($figure), and [lists]($list)) when appropriate instead of defining
  custom constructs. This lets Typst know (and export) the role a construct
  plays in the document. See [the Accessibility guide]($guides/accessibility)
  for more details.
- Do not exclusively use contrast, color, format, or layout to communicate an
  idea. Use text or alternative descriptions instead of or in addition to these
  elements.
- Wrap all decorative elements without a semantic meaning in [`pdf.artifact`].
- Do not use images of text. Instead, insert the text directly into your markup.

Typst currently only supports part one (PDF/UA-1) which is based on PDF 1.7
(2006). When exporting to PDF/UA-1, be aware that you will need to manually
provide [alternative descriptions of mathematics]($category/math/#accessibility)
in natural language.

New accessibility features were added to PDF 2.0 (2017). When set to PDF 2.0
export, Typst will leverage some of these features. PDF 2.0 and PDF/UA-1,
however, are mutually incompatible. For accessible documents, we currently
recommend exporting to PDF/UA-1 instead of PDF 2.0 for the additional checks and
greater compatibility. The second part of PDF/UA is designed for PDF 2.0, but
not yet supported by Typst.

## PDF/A
Typst optionally supports emitting PDF/A-conformant files. PDF/A files are
geared towards maximum compatibility with current and future PDF tooling. They
do not rely on difficult-to-implement or proprietary features and contain
exhaustive metadata. This makes them suitable for long-term archival.

The PDF/A Standard has multiple versions (_parts_ in ISO terminology) and most
parts have multiple profiles that indicate the file's conformance level. You can
target one part and conformance level at a time. Currently, Typst supports these
PDF/A output profiles:

- **PDF/A-1b:** The _basic_ conformance level of ISO 19005-1. This version of
  PDF/A is based on PDF 1.4 (2001) and results in self-contained, archivable PDF
  files. As opposed to later parts of the PDF/A standard, transparency is not
  allowed in PDF/A-1 files.

- **PDF/A-1a:** This is the _accessible_ conformance level that builds on the
  basic level PDF/A-1b. To conform to this level, your file must be an
  accessible _Tagged PDF_ file. Note that accessibility is improved with later
  parts as not all PDF accessibility features are available for PDF 1.4 files.
  Furthermore, all text in the file must consist of known Unicode code points.

- **PDF/A-2b:** The _basic_ conformance level of ISO 19005-2. This version of
  PDF/A is based on PDF 1.7 (2006) and results in self-contained, archivable PDF
  files.

- **PDF/A-2u:** This is the _Unicode-mappable_ conformance level that builds on
  the basic level A-2b. It also adds rules that all text in the document must
  consist of known Unicode code points. If possible, always prefer this standard
  over PDF/A-2b.

- **PDF/A-2a:** This is the _accessible_ conformance level that builds on the
  Unicode-mappable level A-2u. This conformance level also adds two
  requirements: Your file must be an accessible _Tagged PDF_ file. Typst
  automatically adds tags to help you reach this conformance level. Also pay
  attention to the Accessibility Sections throughout the reference and the
  [Accessibility Guide]($guides/accessibility) when targeting this conformance
  level. Finally, PDF/A-2a forbids you from using code points in the [Unicode
  Private Use area](https://en.wikipedia.org/wiki/Private_Use_Areas). If you
  want to build an accessible file, also consider additionally targeting
  PDF/UA-1, which enables more automatic accessibility checks.

- **PDF/A-3b:** The _basic_ conformance level of ISO 19005-3. This version of
  PDF/A is based on PDF 1.7 (2006) and results in archivable PDF files that can
  contain arbitrary other related files as [attachments]($pdf.attach). The only
  difference between it and PDF/A-2b is the capability to attach
  non-PDF/A-conformant files.

- **PDF/A-3u:** This is the _Unicode-mappable_ conformance level that builds on
  the basic level A-3b. Just like PDF/A-2b, this requires all text to consist
  of known Unicode code points. These rules do not apply to attachments. If
  possible, always prefer this standard over PDF/A-3b.

- **PDF/A-3a:** This is the _accessible_ conformance level that builds on the
  Unicode-mappable level A-3u. Just like PDF/A-2a, this requires files to be
  accessible _Tagged PDF_ and to not use characters from the Unicode Private Use
  area. Just like before, these rules do not apply to attachments.

- **PDF/A-4:** The basic conformance level of ISO 19005-4. This version of PDF/A
  is based on PDF 2.0 (2017) and results in self-contained, archivable PDF
  files. PDF/A-4 has no parts relating to accessibility. Instead, the topic has
  been elaborated on more in the dedicated PDF/UA standard. PDF/A-4 files can
  conform to PDF/UA-2 (currently not supported in Typst).

- **PDF/A-4f:** The _embedded files_ conformance level that builds on the basic
  level A-4. Files conforming to this level can contain arbitrary other related
  files as [attachments]($pdf.attach), just as files conforming to part 3 of ISO
  19005. The only difference between it and PDF/A-4 is the capability to attach
  non-PDF/A-conformant files.

- **PDF/A-4e:** The _engineering_ conformance level that builds on the embedded
  files level A-4f. Files conforming to this level can contain 3D objects. Typst
  does not support 3D content, so this is functionally equivalent to PDF/A-4f
  from a Typst perspective.

If you want to target PDF/A but are unsure about which particular setting to
use, there are some good rules of thumb. First, you must determine your
**part,** that's the "version number" of the standard. Ask yourself these
questions:

1. **Does pre-2006 software or equipment need to be able to read my file?** If
   so, choose part one (PDF/A-1).

2. **If not, does my file need [attachments]($pdf.attach)?** If so, you must
   choose part three (PDF/A-3) or the embedded files level of part four
   (PDF/A-4f).

3. **Does your file need to use features introduced in PDF 2.0?** Currently, use
   of PDF 2.0 features in Typst is limited to minor improvements in
   accessibility, e.g. for the [title element]($title). If you can do without
   these improvements, maximize compatibility by choosing part two (when you
   don't need attachments) or part three (when you do need attachments). If you
   rely on PDF 2.0 features, use part four.

Now, you only need to choose a **conformance level** (the lowercase letter at
the end).

- **If you decided on part one, two, or three,** you should typically choose the
  accessible conformance level of your part, indicated by a lowercase `a` at the
  end. If your document is inherently inaccessible, e.g. an artist's portfolio
  that cannot be boiled down to alternative descriptions, choose conformance
  level `u` instead. Only if this results in a compiler error, e.g. because you
  used code points from the Unicode Private Use Area, use the basic level `b`.

- **If you have chosen part four,** you should choose the basic conformance
  level (PDF/A-4) except when needing to embed files.

When choosing between exporting PDF/A and regular PDF, keep in mind that PDF/A
files contain additional metadata, and that some readers will prevent the user
from modifying a PDF/A file.

# PDF-specific functionality
Typst exposes PDF-specific functionality in the global `pdf` module. See below
for the definitions it contains.

This module contains some functions without a final API. They are designed to
enhance accessibility for documents with complex tables. This includes
[`table-summary`]($pdf.table-summary), [`header-cell`]($pdf.header-cell), and
[`data-cell`]($pdf.data-cell). All of these functions will be removed in a
future Typst release, either through integration into table functions or through
full removal. You can enable these functions by passing `--features a11y-extras`
or setting the `TYPST_FEATURES` environment variable to `a11y-extras`. In the
web app, these features are not available at this time.


---

## png.md

Instead of creating a PDF, Typst can also directly render pages to PNG raster
graphics. PNGs are losslessly compressed images that can contain one page at a
time. When exporting a multi-page document, Typst will emit multiple PNGs. PNGs
are a good choice when you want to use Typst's output in an image editing
software or when you can use none of Typst's other export formats.

In contrast to Typst's other export formats, PNGs are bound to a specific
resolution. When exporting to PNG, you can configure the resolution as pixels
per inch (PPI). If the medium you view the PNG on has a finer resolution than
the PNG you exported, you will notice a loss of quality. Typst calculates the
resolution of your PNGs based on each page's physical dimensions and the PPI. If
you need guidance for choosing a PPI value, consider the following:

- A value of 300 or 600 is typical for desktop printing.
- Professional prints of detailed graphics can go up to 1200 PPI.
- If your document is only viewed at a distance, e.g. a poster, you may choose a
  smaller value than 300.
- If your document is viewed on screens, a typical PPI value for a smartphone is
  400-500.

Because PNGs only contain a pixel raster, the text within cannot be extracted
automatically (without OCR), for example by copy/paste or a screen reader. If
you need the text to be accessible, export a PDF or HTML file instead.

PNGs can have transparent backgrounds. By default, Typst will output a PNG with
an opaque white background. You can make the background transparent using
`[#set page(fill: none)]`. Learn more on the
[`page` function's reference page]($page.fill).

# Exporting as PNG
## Command Line
Pass `--format png` to the `compile` or `watch` subcommand or provide an output
file name that ends with `.png`.

If your document has more than one page, Typst will create multiple image files.
The output file name must then be a template string containing at least one of
- `[{p}]`, which will be replaced by the page number
- `[{0p}]`, which will be replaced by the zero-padded page number (so that all
  numbers have the same length)
- `[{t}]`, which will be replaced by the total number of pages

When exporting to PNG, you have the following configuration options:

- Which resolution to render at by specifying `--ppi` followed by a number of
  pixels per inch. The default is `144`.

- Which pages to export by specifying `--pages` followed by a comma-separated
  list of numbers or dash-separated number ranges. Ranges can be half-open.
  Example: `2,3,7-9,11-`.

## Web App
Click "File" > "Export as" > "PNG" or click the downwards-facing arrow next to
the quick download button and select "Export as PNG". When exporting to PNG, you
have the following configuration options:

- The resolution at which the pages should be rendered, as a number of pixels
  per inch. The default is `144`.

- Which pages to export. Valid options are "All pages", "Current page", and
  "Custom ranges". Custom ranges are a comma-separated list of numbers or
  dash-separated number ranges. Ranges can be half-open. Example: `2,3,7-9,11-`.


---

## svg.md

Instead of creating a PDF, Typst can also directly render pages to scalable
vector graphics (SVGs), which are the preferred format for embedding vector
graphics in web pages. Like PDF files, SVGs display your document exactly how
you have laid it out in Typst. Likewise, they share the benefit of not being
bound to a specific resolution. Hence, you can print or view SVG files on any
device without incurring a loss of quality. (Note that font printing quality may
be better with a PDF.) In contrast to a PDF, an SVG cannot contain multiple
pages. When exporting a multi-page document, Typst will emit multiple SVGs.

SVGs can represent text in two ways: By embedding the text itself and rendering
it with the fonts available on the viewer's computer or by embedding the shapes
of each glyph in the font used to create the document. To ensure that the SVG
file looks the same across all devices it is viewed on, Typst chooses the latter
method. This means that the text in the SVG cannot be extracted automatically,
for example by copy/paste or a screen reader. If you need the text to be
accessible, export a PDF or HTML file instead.

SVGs can have transparent backgrounds. By default, Typst will output an SVG with
an opaque white background. You can make the background transparent using
`[#set page(fill: none)]`. Learn more on the
[`page` function's reference page]($page.fill).

# Exporting as SVG
## Command Line
Pass `--format svg` to the `compile` or `watch` subcommand or provide an output
file name that ends with `.svg`.

If your document has more than one page, Typst will create multiple image files.
The output file name must then be a template string containing at least one of
- `[{p}]`, which will be replaced by the page number
- `[{0p}]`, which will be replaced by the zero-padded page number (so that all
  numbers have the same length)
- `[{t}]`, which will be replaced by the total number of pages

When exporting to SVG, you have the following configuration options:

- Which pages to export by specifying `--pages` followed by a comma-separated
  list of numbers or dash-separated number ranges. Ranges can be half-open.
  Example: `2,3,7-9,11-`.

## Web App
Click "File" > "Export as" > "SVG" or click the downwards-facing arrow next to
the quick download button and select "Export as SVG". When exporting to SVG, you
have the following configuration options:

- Which pages to export. Valid options are "All pages", "Current page", and
  "Custom ranges". Custom ranges are a comma-separated list of numbers or
  dash-separated number ranges. Ranges can be half-open. Example: `2,3,7-9,11-`.


---

## context.md

---
description: |
   How to deal with content that reacts to its location in the document.
---

# Context
Sometimes, we want to create content that reacts to its location in the
document. This could be a localized phrase that depends on the configured text
language or something as simple as a heading number which prints the right
value based on how many headings came before it. However, Typst code isn't
directly aware of its location in the document. Some code at the beginning of
the source text could yield content that ends up at the back of the document.

To produce content that is reactive to its surroundings, we must thus
specifically instruct Typst: We do this with the `{context}` keyword, which
precedes an expression and ensures that it is computed with knowledge of its
environment. In return, the context expression itself ends up opaque. We cannot
directly access whatever results from it in our code, precisely because it is
contextual: There is no one correct result, there may be multiple results in
different places of the document. For this reason, everything that depends on
the contextual data must happen inside of the context expression.

Aside from explicit context expressions, context is also established implicitly
in some places that are also aware of their location in the document:
[Show rules]($styling/#show-rules) provide context[^1] and numberings in the
outline, for instance, also provide the proper context to resolve counters.

## Style context
With set rules, we can adjust style properties for parts or the whole of our
document. We cannot access these without a known context, as they may change
throughout the course of the document. When context is available, we can
retrieve them simply by accessing them as fields on the respective element
function.

```example
#set text(lang: "de")
#context text.lang
```

As explained above, a context expression is reactive to the different
environments it is placed into. In the example below, we create a single context
expression, store it in the `value` variable and use it multiple times. Each use
properly reacts to the current surroundings.

```example
#let value = context text.lang
#value

#set text(lang: "de")
#value

#set text(lang: "fr")
#value
```

Crucially, upon creation, `value` becomes opaque [content] that we cannot peek
into. It can only be resolved when placed somewhere because only then the
context is known. The body of a context expression may be evaluated zero, one,
or multiple times, depending on how many different places it is put into.

## Location context
We've already seen that context gives us access to set rule values. But it can
do more: It also lets us know _where_ in the document we currently are, relative
to other elements, and absolutely on the pages. We can use this information to
create very flexible interactions between different document parts. This
underpins features like heading numbering, the table of contents, or page
headers dependent on section headings.

Some functions like [`counter.get`]($counter.get) implicitly access the current
location. In the example below, we want to retrieve the value of the heading
counter. Since it changes throughout the document, we need to first enter a
context expression. Then, we use `get` to retrieve the counter's current value.
This function accesses the current location from the context to resolve the
counter value. Counters have multiple levels and `get` returns an array with the
resolved numbers. Thus, we get the following result:

```example
#set heading(numbering: "1.")

= Introduction
#lorem(5)

#context counter(heading).get()

= Background
#lorem(5)

#context counter(heading).get()
```

For more flexibility, we can also use the [`here`] function to directly extract
the current [location] from the context. The example below
demonstrates this:

- We first have `{counter(heading).get()}`, which resolves to `{(2,)}` as
  before.
- We then use the more powerful  [`counter.at`] with [`here`], which in
  combination is equivalent to `get`, and thus get `{(2,)}`.
- Finally, we use `at` with a [label] to retrieve the value of the counter at a
  _different_ location in the document, in our case that of the introduction
  heading. This yields `{(1,)}`. Typst's context system gives us time travel
  abilities and lets us retrieve the values of any counters and states at _any_
  location in the document.

```example
#set heading(numbering: "1.")

= Introduction <intro>
#lorem(5)

= Background <back>
#lorem(5)

#context [
  #counter(heading).get() \
  #counter(heading).at(here()) \
  #counter(heading).at(<intro>)
]
```

As mentioned before, we can also use context to get the physical position of
elements on the pages. We do this with the [`locate`] function, which works
similarly to `counter.at`: It takes a location or other [selector] that resolves
to a unique element (could also be a label) and returns the position on the
pages for that element.

```example
Background is at: \
#context locate(<back>).position()

= Introduction <intro>
#lorem(5)
#pagebreak()

= Background <back>
#lorem(5)
```

There are other functions that make use of the location context, most
prominently [`query`]. Take a look at the
[introspection]($category/introspection) category for more details on those.

## Nested contexts
Context is also accessible from within function calls nested in context blocks.
In the example below, `foo` itself becomes a contextual function, just like
[`to-absolute`]($length.to-absolute) is.

```example
#let foo() = 1em.to-absolute()
#context {
  foo() == text.size
}
```

Context blocks can be nested. Contextual code will then always access the
innermost context. The example below demonstrates this: The first `text.lang`
will access the outer context block's styles and as such, it will **not**
see the effect of `{set text(lang: "fr")}`. The nested context block around the
second `text.lang`, however, starts after the set rule and will thus show
its effect.

```example
#set text(lang: "de")
#context [
  #set text(lang: "fr")
  #text.lang \
  #context text.lang
]
```

You might wonder why Typst ignores the French set rule when computing the first
`text.lang` in the example above. The reason is that, in the general case, Typst
cannot know all the styles that will apply as set rules can be applied to
content after it has been constructed. Below, `text.lang` is already computed
when the template function is applied. As such, it cannot possibly be aware of
the language change to French in the template.

```example
#let template(body) = {
  set text(lang: "fr")
  upper(body)
}

#set text(lang: "de")
#context [
  #show: template
  #text.lang \
  #context text.lang
]
```

The second `text.lang`, however, _does_ react to the language change because
evaluation of its surrounding context block is deferred until the styles for it
are known. This illustrates the importance of picking the right insertion point for a context to get access to precisely the right styles.

The same also holds true for the location context. Below, the first
`{c.display()}` call will access the outer context block and will thus not see
the effect of `{c.update(2)}` while the second `{c.display()}` accesses the inner context and will thus see it.

```example
#let c = counter("mycounter")
#c.update(1)
#context [
  #c.update(2)
  #c.display() \
  #context c.display()
]
```

## Compiler iterations
To resolve contextual interactions, the Typst compiler processes your document
multiple times. For instance, to resolve a `locate` call, Typst first provides a
placeholder position, layouts your document and then recompiles with the known
position from the finished layout. The same approach is taken to resolve
counters, states, and queries. In certain cases, Typst may even need more than
two iterations to resolve everything. While that's sometimes a necessity, it may
also be a sign of misuse of contextual functions (e.g. of
[state]($state/#caution)). If Typst cannot resolve everything within five
attempts, it will stop and output the warning "document did not converge within
five attempts."

A very careful reader might have noticed that not all of the functions presented
above actually make use of the current location. While
`{counter(heading).get()}` definitely depends on it,
`{counter(heading).at(<intro>)}`, for instance, does not. However, it still
requires context. While its value is always the same _within_ one compilation
iteration, it may change over the course of multiple compiler iterations. If one
could call it directly at the top level of a module, the whole module and its
exports could change over the course of multiple compiler iterations, which
would not be desirable.

[^1]: Currently, all show rules provide [style context](#style-context), but
      only show rules on [locatable]($location/#locatable) elements provide a
      [location context](#location-context).


---

## scripting.md

---
description: Automate your document with Typst's scripting capabilities.
---

# Scripting
Typst embeds a powerful scripting language. You can automate your documents and
create more sophisticated styles with code. Below is an overview over the
scripting concepts.

## Expressions
In Typst, markup and code are fused into one. All but the most common elements
are created with _functions._ To make this as convenient as possible, Typst
provides compact syntax to embed a code expression into markup: An expression is
introduced with a hash (`#`) and normal markup parsing resumes after the
expression is finished. If a character would continue the expression but should
be interpreted as text, the expression can forcibly be ended with a semicolon
(`;`). You can [escape a literal `#` or `;` with a backslash]($syntax/#escapes).

```example
#emph[Hello] \
#emoji.face \
#"hello".len()
```

The example above shows a few of the available expressions, including
[function calls]($function), [field accesses]($scripting/#fields), and
[method calls]($scripting/#methods). More kinds of expressions are
discussed in the remainder of this chapter. A few kinds of expressions are not
compatible with the hash syntax (e.g. binary operator expressions). To embed
these into markup, you can use parentheses, as in `[#(1 + 2)]`.

## Blocks
To structure your code and embed markup into it, Typst provides two kinds of
_blocks:_

- **Code block:** `{{ let x = 1; x + 2 }}` \
  When writing code, you'll probably want to split up your computation into
  multiple statements, create some intermediate variables and so on. Code blocks
  let you write multiple expressions where one is expected. The individual
  expressions in a code block should be separated by line breaks or semicolons.
  The output values of the individual expressions in a code block are joined to
  determine the block's value. Expressions without useful output, like `{let}`
  bindings yield `{none}`, which can be joined with any value without effect.

- **Content block:** `{[*Hey* there!]}` \
  With content blocks, you can handle markup/content as a programmatic value,
  store it in variables and pass it to [functions]($function). Content
  blocks are delimited by square brackets and can contain arbitrary markup. A
  content block results in a value of type [content]. An arbitrary number of
  content blocks can be passed as trailing arguments to functions. That is,
  `{list([A], [B])}` is equivalent to `{list[A][B]}`.

Content and code blocks can be nested arbitrarily. In the example below,
`{[hello ]}` is joined with the output of  `{a + [ the ] + b}` yielding
`{[hello from the *world*]}`.

```example
#{
  let a = [from]
  let b = [*world*]
  [hello ]
  a + [ the ] + b
}
```

## Bindings and Destructuring { #bindings }
As already demonstrated above, variables can be defined with `{let}` bindings.
The variable is assigned the value of the expression that follows the `=` sign.
A [valid variable name](#identifiers) may contain `-`, but cannot start with `-`.
The assignment of a value is optional, if no value is assigned, the variable
will be initialized as `{none}`. The `{let}` keyword can also be used to create
a [custom named function]($function/#defining-functions). Variables can be
accessed for the rest of the containing block (or the rest of the file if there
is no containing block).

```example
#let name = "Typst"
This is #name's documentation.
It explains #name.

#let my-add(x, y) = x + y
Sum is #my-add(2, 3).
```

Let bindings can also be used to destructure [arrays]($array) and
[dictionaries]($dictionary). In this case, the left-hand side of the
assignment should mirror an array or dictionary. The `..` operator can be used
once in the pattern to collect the remainder of the array's or dictionary's
items.

```example
#let (x, y) = (1, 2)
The coordinates are #x, #y.

#let (a, .., b) = (1, 2, 3, 4)
The first element is #a.
The last element is #b.

#let books = (
  Shakespeare: "Hamlet",
  Homer: "The Odyssey",
  Austen: "Persuasion",
)

#let (Austen,) = books
Austen wrote #Austen.

#let (Homer: h) = books
Homer wrote #h.

#let (Homer, ..other) = books
#for (author, title) in other [
  #author wrote #title.
]
```

You can use the underscore to discard elements in a destructuring pattern:

```example
#let (_, y, _) = (1, 2, 3)
The y coordinate is #y.
```

Destructuring also works in argument lists of functions ...

```example
#let left = (2, 4, 5)
#let right = (3, 2, 6)
#left.zip(right).map(
  ((a,b)) => a + b
)
```

... and on the left-hand side of normal assignments. This can be useful to
swap variables among other things.

```example
#{
  let a = 1
  let b = 2
  (a, b) = (b, a)
  [a = #a, b = #b]
}
```

## Conditionals
With a conditional, you can display or compute different things depending on
whether some condition is fulfilled. Typst supports `{if}`, `{else if}` and
`{else}` expressions. When the condition evaluates to `{true}`, the conditional
yields the value resulting from the if's body, otherwise yields the value
resulting from the else's body.

```example
#if 1 < 2 [
  This is shown
] else [
  This is not.
]
```

Each branch can have a code or content block as its body.

- `{if condition {..}}`
- `{if condition [..]}`
- `{if condition [..] else {..}}`
- `{if condition [..] else if condition {..} else [..]}`

## Loops
With loops, you can repeat content or compute something iteratively. Typst
supports two types of loops: `{for}` and `{while}` loops. The former iterate
over a specified collection whereas the latter iterate as long as a condition
stays fulfilled. Just like blocks, loops _join_ the results from each iteration
into one value.

In the example below, the three sentences created by the for loop join together
into a single content value and the length-1 arrays in the while loop join
together into one larger array.

```example
#for c in "ABC" [
  #c is a letter.
]

#let n = 2
#while n < 10 {
  n = (n * 2) - 1
  (n,)
}
```

For loops can iterate over a variety of collections:

- `{for value in array {..}}` \
  Iterates over the items in the [array]. The destructuring syntax described in
  [Let binding]($scripting/#bindings) can also be used here.

- `{for pair in dict {..}}` \
  Iterates over the key-value pairs of the [dictionary]. The pairs can also be
  destructured by using `{for (key, value) in dict {..}}`. It is more efficient
  than `{for pair in dict.pairs() {..}}` because it doesn't create a temporary
  array of all key-value pairs.

- `{for letter in "abc" {..}}` \
  Iterates over the characters of the [string]($str). Technically, it iterates
  over the grapheme clusters of the string. Most of the time, a grapheme cluster
  is just a single codepoint. However, a grapheme cluster could contain multiple
  codepoints, like a flag emoji.

- `{for byte in bytes("😀") {..}}` \
  Iterates over the [bytes], which can be converted from a [string]($str) or
  [read] from a file without encoding. Each byte value is an [integer]($int)
  between `{0}` and `{255}`.

To control the execution of the loop, Typst provides the `{break}` and
`{continue}` statements. The former performs an early exit from the loop while
the latter skips ahead to the next iteration of the loop.

```example
#for letter in "abc nope" {
  if letter == " " {
    break
  }

  letter
}
```

The body of a loop can be a code or content block:

- `{for .. in collection {..}}`
- `{for .. in collection [..]}`
- `{while condition {..}}`
- `{while condition [..]}`

## Fields
You can use _dot notation_ to access fields on a value. For values of type
[`content`], you can also use the [`fields`]($content.fields) function to list
the fields.

The value in question can be either:
- a [dictionary] that has the specified key,
- a [symbol] that has the specified modifier,
- a [module] containing the specified definition,
- [content] consisting of an element that has the specified field. The
  available fields match the arguments of the
  [element function]($function/#element-functions) that were given when the
  element was constructed.

```example
#let it = [= Heading]
#it.body \
#it.depth \
#it.fields()

#let dict = (greet: "Hello")
#dict.greet \
#emoji.face

```

## Methods
A _method call_ is a convenient way to call a function that is scoped to a
value's [type]. For example, we can call the [`str.len`]($str.len) function in
the following two equivalent ways:

```example
#str.len("abc") is the same as
#"abc".len()
```

The structure of a method call is `{value.method(..args)}` and its equivalent
full function call is `{type(value).method(value, ..args)}`. The documentation
of each type lists its scoped functions. You cannot currently define your own
methods.

```example
#let values = (1, 2, 3, 4)
#values.pop() \
#values.len() \

#("a, b, c"
    .split(", ")
    .join[ --- ])

#"abc".len() is the same as
#str.len("abc")
```

There are a few special functions that modify the value they are called on (e.g.
[`array.push`]($array.push)). These functions _must_ be called in method form.
In some cases, when the method is only called for its side effect, its return
value should be ignored (and not participate in joining). The canonical way to
discard a value is with a let binding: `{let _ = array.remove(1)}`.

## Modules
You can split up your Typst projects into multiple files called _modules._ A
module can refer to the content and definitions of another module in multiple
ways:

- **Including:** `{include "bar.typ"}` \
  Evaluates the file at the [path] `bar.typ` and returns the resulting
  [content].

- **Import:** `{import "bar.typ"}` \
  Evaluates the file at the [path] `bar.typ` and inserts the resulting [module]
  into the current scope as `bar` (filename without extension). You can use the
  `as` keyword to rename the imported module: `{import "bar.typ" as baz}`. You
  can import nested items using dot notation: `{import "bar.typ": baz.a}`.

- **Import items:** `{import "bar.typ": a, b}` \
  Evaluates the file at the [path] `bar.typ`, extracts the values of the
  variables `a` and `b` (that need to be defined in `bar.typ`, e.g. through
  `{let}` bindings) and defines them in the current file. Replacing `a, b` with
  `*` loads all variables defined in a module. You can use the `as` keyword to
  rename the individual items: `{import "bar.typ": a as one, b as two}`

Instead of a string or [path], you can also use a [module value]($module), as
shown in the following example:

```example
#import emoji: face
#face.grin
```

## Packages
To reuse building blocks across projects, you can also create and import Typst
_packages._ A package import is specified as a triple of a namespace, a name,
and a version.

```example
>>> #let add(x, y) = x + y
<<< #import "@preview/example:0.1.0": add
#add(2, 7)
```

The `preview` namespace contains packages shared by the community. You can find
all available community packages on [Typst Universe]($universe).

If you are using Typst locally, you can also create your own system-local
packages. For more details on this, see the
[package repository](https://github.com/typst/packages).

## Operators
The following table lists all available unary and binary operators with effect,
arity (unary, binary) and precedence level (higher binds stronger). Some
operations, such as [modulus]($calc.rem-euclid), do not have a special syntax
and can be achieved using functions from the
[`calc`]($category/foundations/calc) module.

| Operator   | Effect                          | Arity  | Precedence |
|:----------:|---------------------------------|:------:|:----------:|
|  `{-}`     | Negation                        | Unary  |     7      |
|  `{+}`     | No effect (exists for symmetry) | Unary  |     7      |
|  `{*}`     | Multiplication                  | Binary |     6      |
|  `{/}`     | Division                        | Binary |     6      |
|  `{+}`     | Addition                        | Binary |     5      |
|  `{-}`     | Subtraction                     | Binary |     5      |
|  `{==}`    | Check equality                  | Binary |     4      |
|  `{!=}`    | Check inequality                | Binary |     4      |
|  `{<}`     | Check less-than                 | Binary |     4      |
|  `{<=}`    | Check less-than or equal        | Binary |     4      |
|  `{>}`     | Check greater-than              | Binary |     4      |
|  `{>=}`    | Check greater-than or equal     | Binary |     4      |
|  `{in}`    | Check if in collection          | Binary |     4      |
| `{not in}` | Check if not in collection      | Binary |     4      |
|  `{not}`   | Logical "not"                   | Unary  |     3      |
|  `{and}`   | Short-circuiting logical "and"  | Binary |     3      |
|  `{or}`    | Short-circuiting logical "or"   | Binary |     2      |
|  `{=}`     | Assignment                      | Binary |     1      |
|  `{+=}`    | Add-Assignment                  | Binary |     1      |
|  `{-=}`    | Subtraction-Assignment          | Binary |     1      |
|  `{*=}`    | Multiplication-Assignment       | Binary |     1      |
|  `{/=}`    | Division-Assignment             | Binary |     1      |

[semver]: https://semver.org/


---

## styling.md

---
description: All concepts needed to style your document with Typst.
---

# Styling
Typst includes a flexible styling system that automatically applies styling of
your choice to your document. With _set rules,_ you can configure basic
properties of elements. This way, you create most common styles. However, there
might not be a built-in property for everything you wish to do. For this reason,
Typst further supports _show rules_ that can completely redefine the appearance
of elements.

## Set rules
With set rules, you can customize the appearance of elements. They are written
as a [function call]($function) to an [element
function]($function/#element-functions) preceded by the `{set}` keyword (or
`[#set]` in markup). Only optional parameters of that function can be provided
to the set rule. Refer to each function's documentation to see which parameters
are optional. In the example below, we use two set rules to change the
[font family]($text.font) and [heading numbering]($heading.numbering).

```example
#set heading(numbering: "I.")
#set text(
  font: "New Computer Modern"
)

= Introduction
With set rules, you can style
your document.
```

A top level set rule stays in effect until the end of the file. When nested
inside of a block, it is only in effect until the end of that block. With a
block, you can thus restrict the effect of a rule to a particular segment of
your document. Below, we use a content block to scope the list styling to one
particular list.

```example
This list is affected: #[
  #set list(marker: [--])
  - Dash
]

This one is not:
- Bullet
```

Sometimes, you'll want to apply a set rule conditionally. For this, you can use
a _set-if_ rule.

```example
#let task(body, critical: false) = {
  set text(red) if critical
  [- #body]
}

#task(critical: true)[Food today?]
#task(critical: false)[Work deadline]
```

## Show rules
With show rules, you can deeply customize the look of a type of element. The
most basic form of show rule is a _show-set rule._ Such a rule is written as the
`{show}` keyword followed by a [selector], a colon and then a set rule. The most
basic form of selector is an [element function]($function/#element-functions).
This lets the set rule only apply to the selected element. In the example below,
headings become dark blue while all other text stays black.

```example
#show heading: set text(navy)

= This is navy-blue
But this stays black.
```

With show-set rules you can mix and match properties from different functions to
achieve many different effects. But they still limit you to what is predefined
in Typst. For maximum flexibility, you can instead write a _transformational_
show rule that defines how to format an element from scratch. To write such a
show rule, replace the set rule after the colon with an arbitrary [function].
This function receives the element in question and can return arbitrary content.
The function is often defined inline as `{it => ..}` using the
[unnamed function syntax]($function/#unnamed). The function's parameter is
typically named `it` by convention.

The available [fields]($scripting/#fields) on the element passed to the function
match the parameters of the respective element function. Below, we define a show
rule that formats headings for a fantasy encyclopedia.

The show rule itself adds tilde characters around the title (these must be
escaped with a backslash because otherwise they would indicate a non-breaking
space), emphasizes the title with italics, and then displays the heading counter
after the title.

For this example, we also wanted center alignment and a different font. While we
could've added these set rules into the existing show rule, we instead added
them as separate show-set rules. This is good practice because now these rules
can still be overridden by later show-set rules in the document, keeping styling
composable. In contrast, set rules within a transformational show rule would not
be overridable anymore.

```example
#set heading(numbering: "(I)")
#show heading: set align(center)
#show heading: set text(font: "Inria Serif")
#show heading: it => block[
  \~
  #emph(it.body)
  #counter(heading).display()
  \~
]

= Dragon
With a base health of 15, the dragon is the most
powerful creature.

= Manticore
While less powerful than the dragon, the manticore
gets extra style points.
```

Like set rules, show rules are in effect until the end of the current block or
file.

Instead of a function, the right-hand side of a show rule can also take a
literal string or content block that should be directly substituted for the
element. And apart from a function, the left-hand side of a show rule can also
take a number of other _selectors_ that define what to apply the transformation
to:

- **Everything:** `{show: rest => ..}` \
  Transform everything after the show rule. This is useful to apply a more
  complex layout to your whole document without wrapping everything in a giant
  function call.

- **Text:** `{show "Text": ..}` \
  Style, transform or replace text.

- **Regex:** `{show regex("\w+"): ..}` \
  Select and transform text with a regular expression for even more flexibility.
  See the documentation of the [`regex` type]($regex) for details.

- **Function with fields:** `{show heading.where(level: 1): ..}` \
  Transform only elements that have the specified fields. For example, you might
  want to only change the style of level-1 headings.

- **Label:** `{show <intro>: ..}` \
  Select and transform elements that have the specified label. See the
  documentation of the [`label` type]($label) for more details.

```example
#show "Project": smallcaps
#show "badly": "great"

We started Project in 2019
and are still working on it.
Project is progressing badly.
```


---

## syntax.md

---
description: |
   A compact reference for Typst's syntax. Learn more about the language within
   markup, math, and code mode.
---

# Syntax
Typst is a markup language. This means that you can use simple syntax to
accomplish common layout tasks. The lightweight markup syntax is complemented by
set and show rules, which let you style your document easily and automatically.
All this is backed by a tightly integrated scripting language with built-in and
user-defined functions.

## Modes
Typst has three syntactical modes: Markup, math, and code. Markup mode is the
default in a Typst document, math mode lets you write mathematical formulas, and
code mode lets you use Typst's scripting features.

You can switch to a specific mode at any point by referring to the following
table:

| New mode | Syntax                          | Example                         |
|----------|---------------------------------|---------------------------------|
| Code     | Prefix the code with `#`        | `[Number: #(1 + 2)]`            |
| Math     | Surround equation with `[$..$]` | `[$-x$ is the opposite of $x$]` |
| Markup   | Surround markup with `[[..]]`   | `{let name = [*Typst!*]}`       |

Once you have entered code mode with `#`, you don't need to use further hashes
unless you switched back to markup or math mode in between.

## Markup
Typst provides built-in markup for the most common document elements. Most of
the syntax elements are just shortcuts for a corresponding function. The table
below lists all markup that is available and links to the  best place to learn
more about their syntax and usage.

| Name               | Example                      | See                      |
| ------------------ | ---------------------------- | ------------------------ |
| Paragraph break    | Blank line                   | [`parbreak`]             |
| Strong emphasis    | `[*strong*]`                 | [`strong`]               |
| Emphasis           | `[_emphasis_]`               | [`emph`]                 |
| Raw text           | ``[`print(1)`]``             | [`raw`]                  |
| Link               | `[https://typst.app/]`       | [`link`]                 |
| Label              | `[<intro>]`                  | [`label`]                |
| Reference          | `[@intro]`                   | [`ref`]                  |
| Heading            | `[= Heading]`                | [`heading`]              |
| Bullet list        | `[- item]`                   | [`list`]                 |
| Numbered list      | `[+ item]`                   | [`enum`]                 |
| Term list          | `[/ Term: description]`      | [`terms`]                |
| Math               | `[$x^2$]`                    | [Math]($category/math)   |
| Line break         | `[\]`                        | [`linebreak`]            |
| Smart quote        | `['single' or "double"]`     | [`smartquote`]           |
| Symbol shorthand   | `[~]`, `[---]`               | [Symbols]($category/symbols/) |
| Code expression    | `[#rect(width: 1cm)]`        | [Scripting]($scripting/#expressions) |
| Character escape   | `[Tweet at us \#ad]`         | [Below](#escapes)        |
| Comment            | `[/* block */]`, `[// line]` | [Below](#comments)       |

## Math mode { #math }
Math mode is a special markup mode that is used to typeset mathematical
formulas. It is entered by wrapping an equation in `[$]` characters. This works
both in markup and code. The equation will be typeset into its own block if it
starts and ends with at least one space (e.g. `[$ x^2 $]`). Inline math can be
produced by omitting the whitespace (e.g. `[$x^2$]`). An overview over the
syntax specific to math mode follows:

| Name                   | Example                  | See                      |
| ---------------------- | ------------------------ | ------------------------ |
| Inline math            | `[$x^2$]`                | [Math]($category/math)   |
| Block-level math       | `[$ x^2 $]`              | [Math]($category/math)   |
| Bottom attachment      | `[$x_1$]`                | [`attach`]($category/math/attach) |
| Top attachment         | `[$x^2$]`                | [`attach`]($category/math/attach) |
| Fraction               | `[$1 + (a+b)/5$]`        | [`frac`]($math.frac)     |
| Line break             | `[$x \ y$]`              | [`linebreak`]            |
| Alignment point        | `[$x &= 2 \ &= 3$]`      | [Math]($category/math)   |
| Variable access        | `[$#x$, $pi$]`           | [Math]($category/math)   |
| Field access           | `[$arrow.r.long$]`       | [Scripting]($scripting/#fields) |
| Implied multiplication | `[$x y$]`                | [Math]($category/math)   |
| Symbol shorthand       | `[$->$]`, `[$!=$]`       | [Symbols]($category/symbols/) |
| Text/string in math    | `[$a "is natural"$]`     | [Math]($category/math)   |
| Math function call     | `[$floor(x)$]`           | [Math]($category/math)   |
| Code expression        | `[$#rect(width: 1cm)$]`  | [Scripting]($scripting/#expressions) |
| Character escape       | `[$x\^2$]`               | [Below](#escapes)        |
| Comment                | `[$/* comment */$]`      | [Below](#comments)       |

## Code mode { #code }
Within code blocks and expressions, new expressions can start without a leading
`#` character. Many syntactic elements are specific to expressions. Below is
a table listing all syntax that is available in code mode:

| Name                     | Example                       | See                                |
| ------------------------ | ----------------------------- | ---------------------------------- |
| None                     | `{none}`                      | [`none`]                           |
| Auto                     | `{auto}`                      | [`auto`]                           |
| Boolean                  | `{false}`, `{true}`           | [`bool`]                           |
| Integer                  | `{10}`, `{0xff}`              | [`int`]                            |
| Floating-point number    | `{3.14}`, `{1e5}`             | [`float`]                          |
| Length                   | `{2pt}`, `{3mm}`, `{1em}`, .. | [`length`]                         |
| Angle                    | `{90deg}`, `{1rad}`           | [`angle`]                          |
| Fraction                 | `{2fr}`                       | [`fraction`]                       |
| Ratio                    | `{50%}`                       | [`ratio`]                          |
| String                   | `{"hello"}`                   | [`str`]                            |
| Label                    | `{<intro>}`                   | [`label`]                          |
| Math                     | `[$x^2$]`                     | [Math]($category/math)             |
| Raw text                 | ``[`print(1)`]``              | [`raw`]                            |
| Variable access          | `{x}`                         | [Scripting]($scripting/#blocks)    |
| Code block               | `{{ let x = 1; x + 2 }}`      | [Scripting]($scripting/#blocks)    |
| Content block            | `{[*Hello*]}`                 | [Scripting]($scripting/#blocks)    |
| Parenthesized expression | `{(1 + 2)}`                   | [Scripting]($scripting/#blocks)    |
| Array                    | `{(1, 2, 3)}`                 | [Array]($array)                    |
| Dictionary               | `{(a: "hi", b: 2)}`           | [Dictionary]($dictionary)          |
| Unary operator           | `{-x}`                        | [Scripting]($scripting/#operators) |
| Binary operator          | `{x + y}`                     | [Scripting]($scripting/#operators) |
| Assignment               | `{x = 1}`                     | [Scripting]($scripting/#operators) |
| Field access             | `{x.y}`                       | [Scripting]($scripting/#fields)    |
| Method call              | `{x.flatten()}`               | [Scripting]($scripting/#methods)   |
| Function call            | `{min(x, y)}`                 | [Function]($function)              |
| Argument spreading       | `{min(..nums)}`               | [Arguments]($arguments)            |
| Unnamed function         | `{(x, y) => x + y}`           | [Function]($function/#unnamed)     |
| Let binding              | `{let x = 1}`                 | [Scripting]($scripting/#bindings)  |
| Named function           | `{let f(x) = 2 * x}`          | [Function]($function)              |
| Set rule                 | `{set text(14pt)}`            | [Styling]($styling/#set-rules)     |
| Set-if rule              | `{set text(..) if .. }`       | [Styling]($styling/#set-rules)     |
| Show-set rule            | `{show heading: set block(..)}` | [Styling]($styling/#show-rules)  |
| Show rule with function  | `{show raw: it => {..}}`      | [Styling]($styling/#show-rules)    |
| Show-everything rule     | `{show: template}`            | [Styling]($styling/#show-rules)    |
| Context expression       | `{context text.lang}`         | [Context]($context)                |
| Conditional              | `{if x == 1 {..} else {..}}`  | [Scripting]($scripting/#conditionals) |
| For loop                 | `{for x in (1, 2, 3) {..}}`   | [Scripting]($scripting/#loops)     |
| While loop               | `{while x < 10 {..}}`         | [Scripting]($scripting/#loops)     |
| Loop control flow        | `{break, continue}`           | [Scripting]($scripting/#loops)     |
| Return from function     | `{return x}`                  | [Function]($function)              |
| Include module           | `{include "bar.typ"}`         | [Scripting]($scripting/#modules)   |
| Import module            | `{import "bar.typ"}`          | [Scripting]($scripting/#modules)   |
| Import items from module | `{import "bar.typ": a, b, c}` | [Scripting]($scripting/#modules)   |
| Comment                  | `{/* block */}`, `{// line}`  | [Below](#comments)                 |

## Comments
Comments are ignored by Typst and will not be included in the output. This is
useful to exclude old versions or to add annotations. To comment out a single
line, start it with `//`:
```example
// our data barely supports
// this claim

We show with $p < 0.05$
that the difference is
significant.
```

Comments can also be wrapped between `/*` and `*/`. In this case, the comment
can span over multiple lines:
```example
Our study design is as follows:
/* Somebody write this up:
   - 1000 participants.
   - 2x2 data design. */
```

## Escape sequences { #escapes }
Escape sequences are used to insert special characters that are hard to type or
otherwise have special meaning in Typst. To escape a character, precede it with
a backslash. To insert any Unicode codepoint, you can write a hexadecimal escape
sequence: `[\u{1f600}]`. The same kind of escape sequences also work in
[strings]($str).

```example
I got an ice cream for
\$1.50! \u{1f600}
```

## Identifiers
Names of variables, functions, and so on (_identifiers_) can contain letters,
numbers, hyphens (`-`), and underscores (`_`). They must start with a letter or
an underscore.

More specifically, the identifier syntax in Typst is based on the
[Unicode Standard Annex #31](https://www.unicode.org/reports/tr31/), with two
extensions: Allowing `_` as a starting character, and allowing both `_` and `-`
as continuing characters.

For multi-word identifiers, the recommended case convention is
[Kebab case](https://en.wikipedia.org/wiki/Letter_case#Kebab_case). In Kebab
case, words are written in lowercase and separated by hyphens (as in
`top-edge`). This is especially relevant when developing modules and packages
for others to use, as it keeps things predictable.

```example
#let kebab-case = [Using hyphen]
#let _schön = "😊"
#let 始料不及 = "😱"
#let π = calc.pi

#kebab-case
#if -π < 0 { _schön } else { 始料不及 }
// -π means -1 * π,
// so it's not a valid identifier
```


---

## data-loading.md

Data loading from external files.

These functions help you with loading and embedding data, for example from the
results of an experiment.

# Encoding
Some of the functions are also capable of encoding, e.g. [`cbor.encode`]. They
facilitate passing structured data to [plugins]($plugin).

However, each data format has its own native types. Therefore, for an arbitrary
Typst value, the encode-to-decode roundtrip might be lossy. In general, numbers,
strings, and [arrays]($array) or [dictionaries]($dictionary) composed of them
can be reliably converted, while other types may fall back to strings via [`repr`],
which is [for debugging purposes only]($repr/#debugging-only). Please refer to
the page of each data format for details.


---

## foundations.md

Foundational types and functions.

Here, you'll find documentation for basic data types like [integers]($int) and
[strings]($str) as well as details about core computational functions.


---

## introspection.md

Interactions between document parts.

This category is home to Typst's introspection capabilities: With the `counter`
function, you can access and manipulate page, section, figure, and equation
counters or create custom ones. Meanwhile, the `query` function lets you search
for elements in the document to construct things like a list of figures or
headers which show the current chapter title.

Most of the functions are _contextual._ It is recommended to read the chapter on
[context] before continuing here.


---

## layout.md

Arranging elements on the page in different ways.

By combining layout functions, you can create complex and automatic layouts.


---

## math.md

Typst has special [syntax]($syntax/#math) and library functions to typeset
mathematical formulas. Math formulas can be displayed inline with text or as
separate blocks. They will be typeset into their own block if they start and end
with at least one space (e.g. `[$ x^2 $]`).

# Variables
In math, single letters are always displayed as is. Multiple letters, however,
are interpreted as variables and functions. To display multiple letters
verbatim, you can place them into quotes and to access single letter variables,
you can use the [hash syntax]($scripting/#expressions).

```example
$ A = pi r^2 $
$ "area" = pi dot "radius"^2 $
$ cal(A) :=
    { x in RR | x "is natural" } $
#let x = 5
$ #x < 17 $
```

# Symbols
Math mode makes a wide selection of [symbols]($category/symbols/sym) like `pi`,
`dot`, or `RR` available. Many mathematical symbols are available in different
variants. You can select between different variants by applying
[modifiers]($symbol) to the symbol. Typst further recognizes a number of
shorthand sequences like `=>` that approximate a symbol. When such a shorthand
exists, the symbol's documentation lists it.

```example
$ x < y => x gt.eq.not y $
```

# Line Breaks
Formulas can also contain line breaks. Each line can contain one or multiple
_alignment points_ (`&`) which are then aligned.

```example
$ sum_(k=0)^n k
    &= 1 + ... + n \
    &= (n(n+1)) / 2 $
```

# Function calls
Math mode supports special function calls without the hash prefix. In these
"math calls", the argument list works a little differently than in code:

- Within them, Typst is still in "math mode". Thus, you can write math directly
  into them, but need to use hash syntax to pass code expressions (except for
  strings, which are available in the math syntax).
- They support positional and named arguments, as well as argument spreading.
- They don't support trailing content blocks.
- They provide additional syntax for 2-dimensional argument lists. The semicolon
  (`;`) merges preceding arguments separated by commas into an array argument.

```example
$ frac(a^2, 2) $
$ vec(1, 2, delim: "[") $
$ mat(1, 2; 3, 4) $
$ mat(..#range(1, 5).chunks(2)) $
$ lim_x =
    op("lim", limits: #true)_x $
```

To write a verbatim comma or semicolon in a math call, escape it with a
backslash. The colon on the other hand is only recognized in a special way if
directly preceded by an identifier, so to display it verbatim in those cases,
you can just insert a space before it.

Functions calls preceded by a hash are normal code function calls and not
affected by these rules.

# Alignment
When equations include multiple _alignment points_ (`&`), this creates blocks of
alternatingly right- and left-aligned columns. In the example below, the
expression `(3x + y) / 7` is right-aligned and `= 9` is left-aligned. The word
"given" is also left-aligned because `&&` creates two alignment points in a row,
alternating the alignment twice. `& &` and `&&` behave exactly the same way.
Meanwhile, "multiply by 7" is right-aligned because just one `&` precedes it.
Each alignment point simply alternates between right-aligned/left-aligned.

```example
$ (3x + y) / 7 &= 9 && "given" \
  3x + y &= 63 & "multiply by 7" \
  3x &= 63 - y && "subtract y" \
  x &= 21 - y/3 & "divide by 3" $
```

# Math fonts
You can set the math font by with a [show-set rule]($styling/#show-rules) as
demonstrated below. Note that only special OpenType math fonts are suitable for
typesetting maths.

```example
#show math.equation: set text(font: "Fira Math")
$ sum_(i in NN) 1 + i $
```

# Math module
All math functions are part of the `math` [module]($scripting/#modules), which
is available by default in equations. Outside of equations, they can be accessed
with the `math.` prefix.

# Accessibility
To make math accessible, you must provide alternative descriptions of equations
in natural language using the [`alt` parameter of
`math.equation`]($math.equation.alt). For more information, see the [Textual
Representations section of the Accessibility
Guide]($guides/accessibility/#textual-representations).

```example
#math.equation(
  alt: "d S equals delta q divided by T",
  block: true,
  $ dif S = (delta q) / T $,
)
```

In the future, Typst will automatically make equations without alternative
descriptions accessible in HTML and PDF 2.0 export.


---

## model.md

Document structuring.

Here, you can find functions to structure your document and interact with that
structure. This includes section headings, figures, bibliography management,
cross-referencing and more.


---

## symbols.md

These two modules give names to symbols and emoji to make them easy to insert
with a normal keyboard. Alternatively, you can also always directly enter
Unicode symbols into your text and formulas. In addition to the symbols listed
below, math mode defines `dif` and `Dif`. These are not normal symbol values
because they also affect spacing and font style.

You can define custom symbols with the constructor function of the
[symbol]($symbol) type.


---

## text.md

Text styling.

The [text function]($text) is of particular interest.


---

## visualize.md

Drawing and data visualization.

If you want to create more advanced drawings or plots, also have a look at the
[CeTZ](https://github.com/johannes-wolf/cetz) package as well as more
specialized [packages]($universe) for your use case.

# Accessibility

All shapes and paths drawn by Typst are automatically marked as
[artifacts]($pdf.artifact) to make them invisible to Assistive Technology (AT)
during PDF export. However, their contents (if any) remain accessible.

If you are using the functions in this category to create an illustration with
semantic meaning, make it accessible by wrapping it in a [`figure`] function
call. Use its [`alt` parameter]($figure.alt) to provide an
[alternative description]($guides/accessibility/#textual-representations).


---

## welcome.md

---
description: |
  The Typst reference is a systematic and comprehensive guide to the Typst
  typesetting language.
---

# Reference
This reference documentation is a comprehensive guide to all of Typst's syntax,
concepts, types, and functions. If you are completely new to Typst, we recommend
starting with the [tutorial] and then coming back to the reference to learn more
about Typst's features as you need them.

## Language
The reference starts with a language part that gives an overview over
[Typst's syntax]($syntax) and contains information about concepts involved in
[styling documents,]($styling) using
[Typst's scripting capabilities.]($scripting)

## Functions
The second part includes chapters on all functions used to insert, style, transform,
and layout content in Typst documents. Each function is documented with a
description of its purpose, a list of its parameters, and examples of how to use
it.

The final part of the reference explains all functions that are used within
Typst's code mode to manipulate and transform data. Just as in the previous
part, each function is documented with a description of its purpose, a list of
its parameters, and examples of how to use it.


---

