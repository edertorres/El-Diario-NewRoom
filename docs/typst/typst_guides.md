# Typst Guides Documentation

## accessibility.md

---
description: |
  Learn how to create accessible documents with Typst. This guide covers semantic markup, reading order, alt text, color contrast, language settings, and PDF/UA compliance to ensure your files work for all readers and Assistive Technology.
---

# Accessibility Guide

Making a document accessible means that it can be used and understood by everyone. That not only includes people with permanent or temporary disabilities, but also those with different devices or preferences. To underscore why accessibility is important, consider that people might read your document in more contexts than you expected:

- A user may print the document on paper
- A user may read your document on a phone, with reflow in their PDF reader enabled
- A user may have their computer read the document back to them
- A user may ask artificial intelligence to summarize your document for them
- A user may convert your document to another file format like HTML that is more accessible to them

To accommodate all of these people and scenarios, you should design your document for **Universal Access.** Universal Access is a simple but powerful principle: instead of retrofitting a project for accessibility after the fact, design from the beginning to work for the broadest possible range of people and situations. This will improve the experience for all readers!

Typst can help you to create accessible files that read well on screen readers, look good even when reflowed for a different screen size, and pass automated accessibility checkers. However, to create accessible files, you will have to keep some rules in mind. This guide will help you learn what issues impact accessibility, how to design for Universal Access, and what tools Typst gives you to accomplish this. Much of the guidance here applies to all export targets, but the guide focuses on PDF export. Notable differences to HTML export are called out.

## Basics of Accessibility { #basics }

Accessible files allow software to do more with them than to just render them. Instead, your computer can understand what each part of the document is supposed to represent and use this information to present the document to the user.

This information is consumed by different software to provide access. When exporting a PDF from Typst, the _PDF viewer_ (sometimes also called a reader) will display the document's pages just as you designed them with Typst's preview. Some people rely on _Assistive Technology_ (AT) such as screen readers, braille displays, screen magnifiers, and more for consuming PDF files. In that case, the semantic information in the file is used to adapt the contents of a file into spoken or written text, or into a different visual representation. Other users will make the PDF viewer reflow the file to create a layout similar to a web page: The content will fit the viewport's width and scroll continuously. Finally, some users will repurpose the PDF into another format, for example plain text for ingestion into a Large Language Model (LLM) or HTML. A special form of repurposing is copy and paste where users use the clipboard to extract content from a file to use it in another application.

Accessibility support differs based on viewer and AT. Some combinations work better than others. In our testing, [Adobe Acrobat][Acrobat] paired with [NVDA][NVDA] on Windows and [VoiceOver][VoiceOver] on macOS provided the richest accessibility support. Paired with HTML export, browsers provide a more consistent baseline of accessibility when compared to PDF readers.

Only PDF and HTML export produce accessible files. Neither PNGs nor SVGs are accessible on their own. Both formats can be used in an accessible larger work by providing a [textual representation](#textual-representations).

## Maintaining semantics

To add correct semantic information for AT and repurposing to a file, Typst needs to know what semantic role each part of the file plays. For example, this means that a heading in a compiled PDF should not just be text that is large and bold. Instead, the file should contain the explicit information (known as a _tag_) that a particular text makes up a heading. A screen reader will then announce it as a heading and allow the user to navigate between headings.

If you are using Typst idiomatically, using the built-in markup and elements, Typst automatically adds tags with rich semantic information to your files. Let's take a look at two code examples:

```example
// ❌ Don't do this
#text(
  size: 16pt,
  weight: "bold",
)[Heading]
```

```example
// ✅ Do this
#show heading: set text(size: 16pt)
= Heading
```

Both of these examples look the same. They both contain the text "Heading" in boldface, sized at 16 point. However, only the second example is accessible. By using the heading markup, Typst knows that the semantic meaning of this text is that of a heading and can propagate that information to the final PDF. In the first example, it just knows that it should use boldface and larger type on otherwise normal text and cannot make the assumption that you meant that to be a heading and not a stylistic choice or some other element like a quote.

Using semantics is not limited to headings. Here are a few more examples for elements you should use:

- Use underscores / [`emph`] instead of the [`text`] function to make text emphasized
- Use stars / [`strong`] instead of the text function to make text carry strong emphasis
- Use lists ([`list`], [`enum`], [`terms`]) instead of normal text with newlines when working with itemized or ordered content
- Use [`quote`] for inline and block quotes
- Use the built-in [`bibliography`] and [`cite`] functions instead of manually printing a bibliography
- Use labels and [`ref`] or `@references` to reference other parts of your documents instead of just typing out a reference
- Use the [`caption` argument of the `figure` element]($figure.caption) to provide captions instead of adding them as text below the function call

If you want to style the default appearance of an element, do not replace it with your own custom function. Instead, use [set]($styling/#set-rules), show-set, and [show rules]($styling/#show-rules) to customize its appearance. Here is an example on how you can change how strong emphasis looks in your document:

```example
// Change how text inside of strong emphasis looks
#show strong: set text(tracking: 0.2em, fill: blue, weight: "black")

When setting up your tents, *never forget* to secure the pegs.
```

The show-set rule completely changes the default appearance of the [`strong`] element, but its semantic meaning will be preserved. If you need even more customization, you can provide show rules with fully custom layout code and Typst will still retain the semantic purpose of the element.

## Reading order

For AT to read the contents of a document in the right order and for repurposing applications, accessible files must make their reading order explicit. This is because the logical reading order can differ from layout order. Floating figures are a common example for such a difference: A figure may be relevant to a paragraph in the center of a page but appear at the top or bottom edge. In non-accessible files, PDF readers and AT have to assume that layout order equals the logical reading order, often leading to confusion for AT users. When the reading order is well-defined, screen readers read a footnote or a floating figure immediately where it makes sense.

Fortunately, Typst markup already implies a single reading order. You can assume that Typst documents will read in the order that content has been placed in the markup. For most documents, this is good enough. However, when using the [`place`] and [`move`] function or [floating figures]($figure.placement), you must pay special attention to place the function call at an appropriate spot in the logical reading order in markup, even if this has no consequence on the layout. Just ask yourself where you would want a screen reader to announce the content that you are placing.

## Layout containers

Typst provides some layout containers like [`grid`], [`stack`], [`box`], [`columns`], and [`block`] to visually arrange your content. None of these containers come with any semantic meaning attached. Typst will conserve some of these containers during PDF reflow while other containers will be discarded.

When designing for Universal Access, you need to be aware that AT users often cannot view the visual layout that the container creates. Instead, AT will just read its contents, so it is best to think about these containers as transparent in terms of accessibility. For example, a grid's contents will just be read out flatly, in the order that you have added the cells in the source code. If the layout you created is merely visual and decorative, this is fine. If, however, the layout carries semantic meaning that is apparent to a sighted user viewing the file in a regular PDF reader, it is not accessible. Instead, create an alternative representation of your content that leverages text or wrap your container in the [`figure`] element to provide an alternative textual description.

Do not use the grid container to represent tabular data. Instead, use [`table`]. Tables are accessible to AT users: their AT will allow them to navigate the table two-dimensionally. Tables are conserved during reflow and repurposing. When creating tables, use the [`table.header`]($table.header) and [`table.footer`]($table.footer) elements to mark up the semantic roles of individual rows. The table documentation contains an [accessibility section]($table/#accessibility) with more information on how to make your tables accessible. Keep in mind that while AT users can access tables, it is often cumbersome to them: Tables are optimized for visual consumption. Being read the contents of a set of cells while having to recall their row and column creates additional mental load. Consider making the core takeaway of the table accessible as text or a caption elsewhere.

Likewise, if you use functions like [`rotate`], [`scale`], and [`skew`], take care that this transformation either has no semantic meaning or that the meaning is available to AT users elsewhere, i.e. in figure [alt text](#textual-representations) or a caption.

## Artifacts

Some things on a page have no semantic meaning and are irrelevant to the content of a document. We call these items _artifacts._ Artifacts are hidden from AT and repurposing and will vanish during reflow. Here are some examples for artifacts:

- The hyphens inserted by automatic hyphenation at the end of a line
- The headers and footers on each page
- A purely decorative page background image

In general, every element on a page must either have some way for AT to announce it or be an artifact for a document to be considered accessible.

Typst automatically tags many layout artifacts such as headers, footers, page back- and foregrounds, and automatic hyphenation as artifacts. However, if you'd like to add purely decorative content to your document, you can use the [`pdf.artifact`] function to mark a piece of content as an artifact. If you are unsure if you should mark an element as an artifact, ask yourself this: Would it be purely annoying if a screen reader announced the element to you? Then, it may be an artifact. If, instead, it could be useful to have it announced, then it is not an artifact.

For technical reasons, once in an artifact, content cannot become semantic again. To stack artifacts and semantic contents, use [`place`] to move the contents on top of one another.

Please note that Typst will mark shapes and paths like [`square`] and [`circle`] as artifacts while their content will remain semantically relevant and accessible to AT. If your shapes have a semantic meaning, please wrap them in the [`figure`] element to provide an alternative textual description.

## Color use and contrast

Universal Access not only means that your documents works with AT, reflow, and repurposing, but also that visual access is possible to everyone, including people with impaired eyesight. Not only does aging often come with worse sight, a significant portion of people have problems differentiating color: About 8% of men and 0.5% of women are color blind.

<div style="display:flex; gap: 8px 16px; width: 100%; flex-wrap: wrap; margin: 24px auto; ">
<img src="chart-bad-regular.png" alt="Bar chart showing Energy production in Germany by kind in terawatt-hours on the X axis and the year on the y-axis. Each bar has up to four segments, for Nuclear (violet), Renewables (green), Fossil Fuels (red), and Other (blue). There is a legend in the top right corner associating the segment colors with their labels" width="958" height="637" style="box-shadow: 0 4px 12px rgb(89 85 101 / 20%); width: 200px; max-width: 100%; height: auto; display: block; border-radius: 6px; flex-grow: 1">
<img src="chart-bad-deuteranopia.png" alt="The same bar chart with changed colors, with the segments for Nuclear and Other in a very similar dark blue, and the neighboring segments of Renewables and Fossil Fuels in two almost indistinguishable shades of sickly yellow" width="958" height="637" style="box-shadow: 0 4px 12px rgb(89 85 101 / 20%); width: 200px; max-width: 100%; height: auto; display: block; border-radius: 6px; flex-grow: 1">
</div>

This means that color must not be the only way you make information accessible to sighted users in your documents. As an example, consider a stacked bar chart with multiple colored segments per bar. Our example shows a chart of the domestic energy production in Germany by kind[^1]. In the picture, you can see the chart as it would normally appear and a simulation of how it would appear to people with deuteranopia-type color blindness. You can see that the two pairs of the first and last segment both look blue and the center pair looks yellow-ish. The first challenge for the colorblind user is thus to make out the boundary of the "Renewable" and "Fossil Fuels" bar. Then, they must keep track of which bar is which by only their order, adding to their mental load. A way to make this chart even less accessible would be to make the order of segments not match their order in the legend.

How can we improve the chart? First, make sure that no information is solely communicated through color use. One possible way to do this by adding a pattern to each bar. Then, we can help the user make out the boundaries of each segment by adding a high-contrast border. Then, our chart could look something like this:

<div>
<img src="chart-good.png" alt="The same bar chart with the original colors. This time, black outlines around each segment are added. Additionally, each segment has a unique pattern." width="958" height="637" style="box-shadow: 0 4px 12px rgb(89 85 101 / 20%); width: 500px; max-width: 100%; height: auto; display: block; margin: 24px auto; border-radius: 6px">
</div>

This could be further improved by choosing colors that are differentiable to people afflicted by common colorblindness types. You could also iterate on the design by choosing two-tone patterns, aligning them to the bars, or changing font use.

You can check your design in the web app by using the built-in color blindness simulator. To use it, open the "View" menu and select the desired mode in the "Simulate color blindness" menu. You can also use other tools on the web to [simulate the color perception of various color blindnesses][color-blind-simulator] if you are not using our web app.

Also consider the color contrast between background and foreground. For example, when you are using light gray text for footnotes, they could become hard to read. Another situation that often leads to low contrast is superimposing text on an image.

<div>
<img src="color-contrast.png" alt="Two callout boxes with the text 'Caution: Keep hands away from active stapler' with different designs. Each box has a contrast gauge for its text and graphical elements below it. The left box is shaded in a light red and the text is a regular shade of red. It has a text contrast of 2.8:1 and a graphics contrast of 1.4:1. The right box is white with a red outline and dark red text. It has a text contrast of 5.9:1 and a graphics contrast of 3.9:1." width="1536" height="708" style="box-shadow: 0 4px 12px rgb(89 85 101 / 20%); width: 512px; max-width: 100%; height: auto; display: block; margin: 24px auto; border-radius: 6px">
</div>

In our example, we can see two designs for callout boxes. Because these boxes aim to help the user avoid a hazard, it is paramount that they can actually read them. However, in the first box, the background is fairly light, making it hard to make out the box. Worse, the red text is difficult to read on the light red background. The text has a 2.8:1 contrast ratio, failing the bar of 4.5:1 contrast the Web Content Accessibility Guidelines (WCAG) set. Likewise, the box has an 1.4:1 contrast ratio with the white page background, falling short of the 3:1 threshold for graphical objects.

Colors in the second example have been adjusted to meet WCAG AA color contrast thresholds. It should be markedly easier to read the text in the box, even if you have good vision!

There are [tools to compare how much contrast a pair of colors has][wcag-contrast] as foreground and background. The most common one is the WCAG color contrast ratio. For a given font size, a color pair may either fail the test, get to the AA level, or reach the higher AAA level. Aim for at least AA contrast for all your color pairings.

| Content                                | AA Ratio | AAA Ratio |
|----------------------------------------|---------:|----------:|
| Large text (≥18pt, or bold and ≥14pt)  | 3:1      | 4.5:1     |
| Small text                             | 4.5:1    | 7:1       |
| Non-text content                       | 3:1      | 3:1       |

Note that common accessibility frameworks like WCAG make an exception for purely decorative text and logos: Due to their graphic character, they can have contrast ratios that fail to achieve AA contrast ratio.

## Textual representations

To support AT use and some repurposing workflows, all elements with a semantic meaning must have a textual representation. Think about it in terms of Universal Access: If an item is not an [artifact](#artifacts), it has a semantic meaning. If, however, AT cannot ingest the item, the full semantic meaning of a document is not available to AT users. Hence, to provide Universal Access, use the mechanisms built into Typst to provide alternative representations.

When you add an image, be sure to use the [`alt` argument of the image function]($image.alt) to describe what's visible in the image. This alternative description (sometimes known as alt text) should describe the gist of the image: Think about how you would describe the image to a friend if you called them on the phone. To write good alternative descriptions, consider the context in which the image appears:

```example
#image("heron.jpg", alt: "?")

Herons have feet with interdigital
webbing, allowing for good mobility
when swimming, and wings that span
up to 2.3 m.
```

What could be a good alternative description for [this image][heron]? Let's consider a few examples for what _not_ to do:

- `{"Image of a heron"}` \
  ❌ The screen reader will already announce the image on its own, so saying this is an image is redundant. In this example, the AT user would hear "Image, Image of a heron".

- `{"A bird"}` \
  ❌ The alternative description is not specific enough. For example, it is relevant to a user that the image depicts a heron and both its feet and wings are visible.

- `{"Gray heron in flight. Picture by Makasch1966 on Wikimedia Commons, CC Attribution 4.0 International license"}` \
  ❌ The alternative description should not include details not visible in the image, such as attribution, jokes, or metadata. Keep in mind that it is not accessible to sighted users. That information belongs elsewhere.

- `{"Gray heron flying low, heading from the right to left. Its feet are extended and slightly point downwards, touching a blurred horizon where a dark forest becomes visible. The bird's wings are extended and arc upwards. There are out-of-focus branches visible in the lower left corner of the image."}` \
  ❌ The alternative description is too verbose. Use your discretion and determine how important the image is to the content. Think about how long a sighted user would realistically look at the image; your alt text should take about the same effort to 'consume.' For example, the anatomic description contained above could be appropriate for a longer discussion in a zoology textbook while the compositional information is useful when writing about photography. The context the example image comes with is relatively short, so write a more brief description.

Instead, in the given example, you could use this alternative text:

- `{"Heron in flight with feet and wings spread"}` \
  ✅ This alternative description describes the image, is relevant to the context, and matches its brevity.

There are resources available on the web [to learn more about writing good alternative descriptions][alt-text-tips]. The requirement to add alternative text to images applies to all image formats. Typst does not currently retain the tags of a PDF image in the compiled document, even if the PDF image file on its own was accessible.

Do not use images of text; likewise, do not use the path operations to draw text manually. Typst will not be able to process text in any images to make it accessible in the same way that native text is. There is one exception to this rule: Use an image of text when the appearance of the text is essential to the semantic meaning of the document and cannot be reproduced with Typst natively. In that case, you must describe both the textual content and the essential visual characteristics in the alternative description.

Like the image function, the figure function has a [`alt` attribute]($figure.alt). When you use this attribute, many screen readers and other AT will not announce the content inside of the figure and instead just read the alternative description. Your alternative description must be comprehensive enough so that the AT user does not need to access the body of the figure. Only use the alternative description if the content of the figure are not otherwise accessible. For example, do not use the `alt` attribute of a figure if it contains a `table` element, but do use it if you used shapes within that come with a semantic meaning. If you specify both `alt` and `caption`, both will be read by AT. When your figure contains an image, set the alternative description on the [image itself]($image.alt), not on the figure. Do not set both, as the image description would be overridden by the figure description.

```typ
#figure(
  alt: "Star with a blue outline",
  curve(
    stroke: blue,
    curve.move((25pt, 0pt)),
    curve.line((10pt, 50pt)),
    curve.line((50pt, 20pt)),
    curve.line((0pt, 20pt)),
    curve.line((40pt, 50pt)),
    curve.close(),
  ),
)
```

Finally, you can specify an alternative description on math using [`math.equation`]. Describe your formula as if read out loud in natural language. Currently, adding an alternative description is required for accessible math for all export formats. Not adding an alternative description for your formula will result in a failure of PDF/UA-1 export. In the future, Typst will automatically make math accessible in HTML and PDF 2.0 by leveraging MathML technology.

```typ
#math.equation(
  alt: "a squared plus b squared equals c squared",
  block: true,
  $ a^2 + b^2 = c^2 $,
)
```

Another element that represents itself as text are links. It is best to avoid non-descriptive link texts such as _here_ or _go._ These link texts also hurt Search Engine Optimization (SEO) if that is a consideration for your document. Instead, try to have the link contain text about where it is pointing to. Note that, unless you are aiming for the highest level of accessibility, it is also okay if the link itself is not descriptive but its purpose can be understood from the content immediately surrounding it.

## Natural Language

In order for screen readers to pronounce your document correctly and translation software to work properly, you must indicate in which natural language your document is written. Use the rule [`[#set text(lang: "..")]`]($text.lang) at the very start of your document or your template's capability to set a language. If you do not do so, Typst will assume that your content is in English. The natural language you choose not only impacts accessibility, but also how Typst will apply hyphenation, what typesetting conventions are applied, the labels of figures and references, and, in the web app, what language is used for spellcheck.

If you are using a language with significant variation between regions, such as Chinese or English, also use [the `region` argument]($text.region). For example, Chinese as it is spoken in Hong Kong would look like this:

```typ
#set text(lang: "zh", region: "HK")
```

To specify your language, use ISO 639 codes. For regions, use the [ISO 3166-1 alpha-2][iso-3166-1-alpha-2] code. ISO 639 contains three variants, one for two-letter language codes like "de" for German [(ISO 639-1)][iso-639-1-list] and two for three-letter language codes like "deu" ([ISO 639-2][iso-639-2-list] and [ISO 639-3][iso-639-3-list]). If your language has a two-letter ISO 639-1 code, always prefer using that. ISO 639-2 and 639-3 share most codes, but there are some differences. When your language code differs between the two standards, use ISO 639-2 when exporting to PDF 1.7 (Typst's default) and below and ISO 639-3 for export to PDF 2.0 and HTML.

There are three special language codes defined by both ISO 639-2 and ISO 639-3 that you can use when providing a normal language code is difficult:

- `zxx` for text that is not in a natural language
- `und` for text for which you cannot determine the natural language
- `mis` for text in languages that have not been assigned a language code

If your document contains text in multiple languages, you can use the text function or a scoped text set rule to enclose instances of other languages:

```example
This is #text(lang: "fr")[français].

#[
  #set text(lang: "es")
  Este es un fragmento más largo
  del texto en español.
]
```

## Document Title and Headings

Titling your document makes it easier to retrieve it and to navigate between it and other documents, both for AT users and regular users of PDF viewers. This is why accessibility standards such as WCAG and PDF/UA require you to set a machine-readable title for your document.

To do so in Typst, place this set rule in your document before any content:

```typ
#set document(title: "GlorboCorp Q1 2023 Revenue Report")
```

This will set the [title in the document's metadata]($document.title) and in the title bar of the PDF viewer or web browser. If this results in an error when using a template, consider whether your template may provide an alternative way to set the document title.

Most likely, you will also want to include the title visibly in your document. To do so, use the [`title`] element. When you add a call to the title element without any arguments, it will print the contents of what you set as the document's title. Alternatively, you can customize the title by passing content as the positional body argument. Do not use the title element more than once in your document.

Never use a heading for your document title; instead, use the title element. Should you have experience with HTML, it is important to remember that the semantics of the heading element in Typst differ from HTML headings. It is encouraged to use multiple first-level headings for section headings in Typst documents. When exporting to HTML, a [title] will be serialized as a `h1` tag while a [first-level heading]($heading.level) will be serialized as a `h2` tag. In PDF export, the title and headings will be correctly tagged based on the PDF version targeted.

It is important that the sequence of headings you use is sequential: Never skip a heading level when going deeper. This means that a third-level heading must be followed by a heading of level four or lower, but never a heading of level five or higher.

```typ
// ❌ Don't do this:
= First level heading
=== Third level heading
```

Note that in order to pass the [automated accessibility check in Adobe Acrobat][acro-check-outline], documents with 21 pages or more must contain outlined headings.

## Accessibility Standards and Legislation

Typst can help you to assert that your document is accessible by checking it against international standards. For PDF export, there are multiple standards for accessible files, most notably the PDF/UA standard. Its first part (PDF/UA-1) is already supported by Typst while support for the second part (PDF/UA-2) is planned for the future. Below, you can find an explanation of all relevant standards:

- **Tagged PDF:** Tagged PDFs contain machine-readable data about the semantic structure of a document that AT can parse. Typst will write Tagged PDFs by default, but keep in mind that Typst can only write appropriate tags if it knows about the semantic structure of your document. Refer to the Section [_Maintaining semantics_](#maintaining-semantics) to learn how to use Typst's elements to communicate semantics. To provide Universal Access, you are also responsible to provide textual representation of non-text content yourself.

- **PDF/UA-1:** The PDF/UA standard explains how to write a PDF 1.7 file optimized for Universal Access. It implies Tagged PDF, enforces alternative descriptions for images and mathematics, requires a document title, and introduces rules how document contents like tables should be structured. If you are following this guide, you are already avoiding most of the compiler errors that can occur during PDF/UA-1 export.

- **PDF/UA-2:** There is also the more recent part PDF/UA-2 that targets PDF 2.0 files. It improves accessibility for mathematics and some semantic elements. Support for PDF/UA-2 not yet available in Typst, but planned.

- **Well Tagged PDF (WTPDF):** This is an industry standard that is very similar to PDF/UA-2. Like PDF/UA-2, it is not currently supported by Typst. Originally, it was drafted because both parts of the PDF/UA specification were only available at a high cost from the International Standards Organization. Hence, [WTPDF][WTPDF] was designed so that all conforming files can also declare conformance with PDF/UA-2. By now, [both parts of the PDF/UA specification are available free of charge][pdf-ua-free], decreasing the relevance of WTPDF.

- **PDF/A-1a:** The PDF/A standard describes how to produce PDF files that are well-suited for archival. Parts one to three of the PDF/A standard feature multiple conformance levels. The strictest conformance level A contains rules for accessibility as only files meeting those rules remain usable to the broadest range of people in the far future. Level A implies conformance with Tagged PDF and forces you to provide alternative descriptions for images. Other PDF/A rules not relating to accessibility, e.g. about transparency, colors, and more also apply. This part of the PDF/A standard is based on the outdated PDF 1.4 specification. Only use it if your venue requires it or if you need a very compatible file. Otherwise, PDF/UA-1 and the second and third part of PDF/A provide better alternatives.

- **PDF/A-2a** and **PDF/A-3a:** Like the first part of PDF/A, these standards focus on creating files suitable for archival and long-term storage. Both of these standards target the newer PDF version 1.7 instead of PDF 1.4. Here too, the strictest conformance level A contains rules for accessibility. In addition to the rules in PDF/A-1a, these standards disallow the use of characters in the [Unicode Private Use Area][unic-pua] whose meaning is not universally defined. Improvements over PDF/A-1 include the ability to use transparency and better reflow. When choosing between these two parts of the PDF/A standard, choose PDF/A-2a unless you need to [attach]($pdf.attach) other files. Note that conformance level A has been removed from PDF/A-4 in favor of the dedicated PDF/UA standard.

The [PDF reference page]($pdf/#pdf-standards) contains more information about each supported standard. To enable either PDF/UA, PDF/A-2a, or PDF/A-3a, use the [appropriate flag in the CLI]($pdf/#command-line) or use the export dropdown and click on PDF in the web app. At the moment, you must choose between PDF/A and PDF/UA. For accessibility-focused documents, we recommend the latter.

When you select one of these standards for PDF export, Typst will detect if you are in violation of their rules and fail the export with a descriptive error message. For the strictest accessibility check currently available, choose PDF/UA-1. Do not disable tagging unless you have a good reason, as tags provide a baseline of accessibility across all documents you export.

Maybe you already noticed that some of the factors that go into Universal Access are hard to check automatically. For example, Typst will currently not automatically check that your color contrasts are sufficient or whether the configured natural language matches the actual natural language (although the amount of spellcheck errors should provide a hint if you are using the web app). There are two international standards that address some of these human factors in more detail:

- The **[Web Content Accessibility Guidelines (WCAG)][WCAG]**: Designed by the W3C, a big international consortium behind the technologies that power the internet, WCAG describes how to make a web site accessible. All of these rules are applicable to Typst's HTML output, and many of them apply to its PDF output. WCAG separates its rules into the three levels A, AA, and AAA. It is recommended that normal documents aim for AA. If you have high standards for Universal Access, you can also consider AAA Success Criteria. However, Typst does not yet expose all PDF features needed for AAA compliance, e.g. an AT-accessible way to define expansions for abbreviations.
- The **[European Norm EN 301 549][EN301549]**: Its Section 9 describes how to create accessible websites and its Section 10 describes what rules apply to non-web documents, including PDFs created by Typst. It points out which WCAG clauses are also applicable to PDFs. Conformance with this standard is a good start for complying with EU and national accessibility laws.

Keep in mind that in order to conform with EN 301 549 and the relevant WCAG provisions, your document must be tagged. If you aim for conformance, we strongly suggest using PDF/UA-1 for export to automate many of the checks for the success criteria within.

Many territories have accessibility legislation that requires you to create accessible files under some circumstances. Here are only some of them:

- **[European Accessibility Act (EAA, EU 2019/882)][EAA]**: This regulation applies to e-books, consumer banking services, e-commerce services, and more. It requires the files distributed in these applications to be accessible.
- **Americans with Disabilities Act (ADA)**: The Department of Justice will [require public sector organizations to provide files][ADA-2] in accordance to WCAG under Title II of the ADA by 2026. Likewise, [private organizations can be held liable][ADA-dominos] for inaccessible digital services under the ADA and state law.

Using this guide can help you reach compliance with either regulation.

## Testing for Accessibility

In order to test whether your PDF document is accessible, you can use automated tools and manual testing. Some standards like PDF/UA and PDF/A can be checked exclusively through automated tools, while some rules in WCAG and other standards require manual checks. Many of the automatable checks are automatically passed by Typst when Tagged PDF is enabled. For many other automatable checks, you can enable PDF/UA-1 export so that Typst will run them instead. Automated tools can only provide a baseline of accessibility. For truly Universal Access, it is best if you try the document yourself with AT.

Here is a list of automated checkers to try to test for conformance:

- **[veraPDF][veraPDF]:** This open-source tool can check if your PDF file conforms to the parts of the PDF/A and PDF/UA standards it declared conformance with. Use this tool if you have chosen one of these standards during export. Failures are considered bugs in Typst and should be [reported on GitHub](https://github.com/typst/typst/issues).

- **[PDF Accessibility Checker (PAC)][PAC]:** The freeware PAC checks whether your document complies with PDF/UA and WCAG rules. When you receive a hard error in the PDF/UA tab, this is considered a bug in Typst and should be [reported on GitHub](https://github.com/typst/typst/issues). Warnings in the PDF/UA and Quality tabs may either be bugs, problems in your document, or neither. Check on the [Forum][Typst Forum] or on [Discord][Discord] if you are unsure. Errors and warnings in the WCAG tab indicate problems with your document.

- **[Accessibility Check in Adobe Acrobat Pro][acro-check]:** The accessibility checker in the paid version of Adobe Acrobat checks all PDF documents for problems. Instead of checking compliance with a well-known international or industry standard, Adobe has created their own suite of tests. Because the rules behind these tests sometimes contradict international standards like PDF/UA, some of Acrobat's checks are expected to fail for Typst documents[^2]. Other checks, such as the contrast check are useful and indicate problems with your document.

When doing manual checking, you can start with a checklist. If your organization places emphasis on accessibility, they will sometimes have their own list. In absence of one, you can try lists by universities such as [Universität Bremen (in English)][checklist-unib] or governments such as in [Canada][checklist-canada] or by the [US Social Security Administration][checklist-us-ssa]. Although these checklists differ in verbosity, they all cover the most essential manual checks. Many of the technical checks in them can be skipped if you choose PDF/UA-1 export in Typst. If unsure which checklist to use, choose one from an organization culturally similar to yours.

However, to reach the highest standard of accessibility for widely circulated documents, consider checking your document with AT. Although there are many AT products and PDF viewers, it is typically sufficient to test a single combination. Which is best differs depending on your operating system:

- Windows: Test with [Adobe Acrobat][Acrobat] and [NVDA][NVDA]. NVDA is free, open-source software. A free version of Acrobat is available.
- macOS: Test with [Adobe Acrobat][Acrobat] and [VoiceOver][VoiceOver]. VoiceOver is the screen reader that is built into macOS and other Apple platforms.
- Linux: Test with [Evince][Evince] or [Okular][Okular] and [Orca][Orca]. All three tools are free, open-source software. However, AT support across Linux platforms lags behind what is available on Windows and macOS. Likewise, Evince and Okular have less accessibility support than Acrobat. We strongly suggest testing with Acrobat instead.

When first getting into testing, consider completing the interactive training program your screen reader offers, if any. Building confidence with a screen reader helps you experience your document like a full-time screen reader user. When checking your document, check that it not only makes all the same information accessible that is available to a sighted user, but also that it is easy to navigate. The experience your users will have will vary based on the pairing of PDF viewer and AT they use.

## Limits and considerations for export formats

Even when you design your document with accessibility in mind, you should be aware of the limitations of your export format. Fundamentally, AT support for PDF files is more difficult to implement than for other formats such as HTML. PDF was conceived in 1993 to accurately render print documents on a computer. Accessibility features were first added with PDF 1.4 in 2001, and improved in PDF 1.5 (2003) and PDF 2.0 (2017). By contrast, HTML offers a richer semantic model and more flexibility, so AT support in browsers generally surpasses what is possible in PDF viewers.

Also keep in mind that PDF files are mostly static. This allows you to disregard many WCAG and EN 301 549 rules designed for interactive content and multimedia. However, the lack of interactivity also makes it more difficult for users to customize a document's layout to their needs.

For example, [WCAG Success Criterion 1.4.12][wcag-sg-1412-us] (codified in Clause 10.1.4.12 of EN 301 549) prescribes that a user must be able to increase character, letter, line, and paragraph spacing to very wide values. This benefits users with reduced vision or dyslexia. The Success Criterion does not require you to design your document with these layout parameters. Instead, it only requires a mechanism through which users can increase these parameters when reading the document. For HTML files, it is easy to comply with this Success Criterion because the browser lets the user override these spacing parameters on a page. For PDF, the situation is more nuanced: Theoretically, Typst adds tags and attributes designed for reflow to a file. A PDF reader, when reflowing, could allow its user to increase spacings beyond what is codified in these tags. In practice, we are not aware of a PDF viewer with this feature. Instead, this Success Criterion can be satisfied by repurposing the PDF into a HTML file and opening it in a browser.

In practice, even if your file is technically compliant, you cannot expect your users to know about these workarounds. Therefore, if you are aiming to meet the highest standards of Universal Access, consider distributing an HTML version of your document alongside your PDF. Export this file directly using Typst's [HTML export]($html) (in preview). Even though HTML export will not conserve many aspects of your visual layout, it will produce a file that leverages semantic HTML and technologies like [Digital Publishing ARIA][dpub-aria] to provide Universal Access. It will be of a higher quality than a PDF file repurposed to HTML.

Finally, keep in mind that PDFs are designed for print. Hence, you should not assume that interactive features like links are available to users who chose to print your document.

As mentioned above, files created by PNG and SVG export are not accessible.

[^1]: Dataset from the German Federal Statistics Authority (Statistisches Bundesamt, Destatis). ["Bruttostromerzeugung nach Energieträgern in Deutschland ab 1990"](https://www.destatis.de/DE/Themen/Branchen-Unternehmen/Energie/Erzeugung/bar-chart-race.html), 2025, available under the _Data licence Germany – attribution – version 2.0._

[^2]: For example, when using footnotes, the check "Lbl and LBody must be children of LI" in the "List" section is expected to fail.

[NVDA]: https://www.nvaccess.org/download/
[Acrobat]: https://www.adobe.com/acrobat.html
[VoiceOver]: https://support.apple.com/guide/voiceover/welcome/mac
[wcag-contrast]: https://webaim.org/resources/contrastchecker/ "WebAIM Contrast Checker"
[wcag-sg-1412-us]: https://www.w3.org/WAI/WCAG21/Understanding/text-spacing.html "Understanding SC 1.4.12: Text Spacing (Level AA)"
[alt-text-tips]: https://webaim.org/techniques/alttext/
[iso-3166-1-alpha-2]: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2 "ISO 3166-1 alpha-2"
[iso-639-1-list]: https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes "List of ISO 639 language codes"
[iso-639-2-list]: https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes "List of ISO 639-2 codes"
[iso-639-3-list]: https://en.wikipedia.org/wiki/List_of_ISO_639-3_codes "List of ISO 639-3 codes"
[WCAG]: https://www.w3.org/TR/WCAG21/
[EN301549]: https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf
[EAA]: https://eur-lex.europa.eu/eli/dir/2019/882/oj "Directive (EU) 2019/882 of the European Parliament and of the Council of 17 April 2019 on the accessibility requirements for products and services (Text with EEA relevance)"
[ADA-2]: https://www.ada.gov/law-and-regs/regulations/title-ii-2010-regulations/ "Americans with Disabilities Act Title II Regulations"
[ADA-dominos]: https://www.boia.org/blog/the-robles-v.-dominos-settlement-and-why-it-matters "The Robles v. Domino’s Settlement (And Why It Matters)"
[color-blind-simulator]: https://daltonlens.org/colorblindness-simulator "Online Color Blindness Simulators"
[unic-pua]: https://en.wikipedia.org/wiki/Private_Use_Areas "Private Use Areas"
[pdf-ua-free]: https://pdfa.org/sponsored-standards/ "Sponsored ISO standards for PDF technology"
[WTPDF]: https://pdfa.org/wtpdf/ "Well-Tagged PDF (WTPDF)"
[acro-check]: https://helpx.adobe.com/acrobat/using/create-verify-pdf-accessibility.html "Create and verify PDF accessibility (Acrobat Pro)"
[acro-check-outline]: https://helpx.adobe.com/acrobat/using/create-verify-pdf-accessibility.html#Bookmarks "Create and verify PDF accessibility (Acrobat Pro) - Bookmarks"
[veraPDF]: https://verapdf.org "Industry Supported PDF/A Validation"
[PAC]: https://pac.pdf-accessibility.org/en "PDF Accessibility Checker"
[Typst Forum]: https://forum.typst.app/
[Discord]: https://discord.gg/2uDybryKPe
[checklist-unib]: https://www.uni-bremen.de/fileadmin/user_upload/universitaet/Digitale_Transformation/Projekt_BALLON/Checklisten/2._Auflage_englisch/Checklist_for_accessible_PDF_ENG-US_ver2.pdf "Accessible E-Learning and Teaching - Checklist for Creating and Reviewing Accessible PDF Documents"
[checklist-canada]: https://a11y.canada.ca/en/pdf-accessibility-checklist/ "PDF accessibility checklist"
[checklist-us-ssa]: https://www.ssa.gov/accessibility/checklists/PDF_508_Compliance_Checklist.pdf
"Portable Document Format (PDF) Basic Testing Guide"
[Evince]: https://wiki.gnome.org/Apps/Evince/
[Okular]: https://okular.kde.org/ "Okular - The Universal Document Viewer"
[Orca]: https://orca.gnome.org "Orca - A free and open source screen reader"
[heron]: https://commons.wikimedia.org/wiki/File:Reiher_im_Flug.jpg
[dpub-aria]: https://www.w3.org/TR/dpub-aria-1.1/ "Specification for Digital Publishing WAI-ARIA Module 1.1"


---

## guide-for-latex-users.md

---
description: |
  Are you a LaTeX user? This guide explains the differences and
  similarities between Typst and LaTeX so you can get started quickly.
---

# Guide for LaTeX Users { # }
This page is a good starting point if you have used LaTeX before and want to try
out Typst. We will explore the main differences between these two systems from a
user perspective. Although Typst is not built upon LaTeX and has a different
syntax, you will learn how to use your LaTeX skills to get a head start.

Just like LaTeX, Typst is a markup-based typesetting system: You compose your
document in a text file and mark it up with commands and other syntax. Then, you
use a compiler to typeset the source file into a PDF. However, Typst also
differs from LaTeX in several aspects: For one, Typst uses more dedicated syntax
(like you may know from Markdown) for common tasks. Typst's commands are also
more principled: They all work the same, so unlike in LaTeX, you just need to
understand a few general concepts instead of learning different conventions for
each package. Moreover Typst compiles faster than LaTeX: Compilation usually
takes milliseconds, not seconds, so the web app and the compiler can both
provide instant previews.

In the following, we will cover some of the most common questions a user
switching from LaTeX will have when composing a document in Typst. If you prefer
a step-by-step introduction to Typst, check out our [tutorial].

## Installation
You have two ways to use Typst: In [our web app](https://typst.app/signup/) or
by [installing the compiler](https://github.com/typst/typst/releases) on your
computer. When you use the web app, we provide a batteries-included
collaborative editor and run Typst in your browser, no installation required.

If you choose to use Typst on your computer instead, you can download the
compiler as a single, small binary which any user can run, no root privileges
required. Unlike popular LaTeX distributions such as TeX Live, packages are
downloaded when you first use them and then cached locally, keeping your Typst
installation lean. You can use your own editor and decide where to store your
files with the local compiler.

## How do I create a new, empty document? { #getting-started }
That's easy. You just create a new, empty text file (the file extension is
`.typ`). No boilerplate is needed to get started. Simply start by writing your
text. It will be set on an empty A4-sized page. If you are using the web app,
click "+ Empty document" to create a new project with a file and enter the
editor. [Paragraph breaks]($parbreak) work just as they do in LaTeX, just use a
blank line.

```example
Hey there!

Here are two paragraphs. The
output is shown to the right.
```

If you want to start from an preexisting LaTeX document instead, you can use
[Pandoc](https://pandoc.org) to convert your source code to Typst markup. This
conversion is also built into our web app, so you can upload your `.tex` file to
start your project in Typst.

## How do I create section headings, emphasis, ...? { #elements }
LaTeX uses the command `\section` to create a section heading. Nested headings
are indicated with `\subsection`, `\subsubsection`, etc. Depending on your
document class, there is also `\part` or `\chapter`.

In Typst, [headings]($heading) are less verbose: You prefix the line with the
heading on it with an equals sign and a space to get a first-order heading:
`[= Introduction]`. If you need a second-order heading, you use two equals
signs: `[== In this paper]`. You can nest headings as deeply as you'd like by
adding more equals signs.

Emphasis (usually rendered as italic text) is expressed by enclosing text in
`[_underscores_]` and strong emphasis (usually rendered in boldface) by using
`[*stars*]` instead.

Here is a list of common markup commands used in LaTeX and their Typst
equivalents. You can also check out the [full syntax cheat sheet]($syntax).

| Element                | LaTeX                     | Typst                  | See        |
|:-----------------------|:--------------------------|:-----------------------|:-----------|
| Strong emphasis        | `\textbf{strong}`         | `[*strong*]`           | [`strong`] |
| Emphasis               | `\emph{emphasis}`         | `[_emphasis_]`         | [`emph`]   |
| Link                   | `\url{https://typst.app}` | `[https://typst.app/]` | [`link`]   |
| Label                  | `\label{intro}`           | `[<intro>]`            | [`label`]  |
| Reference              | `\ref{intro}`             | `[@intro]`             | [`ref`]    |
| Citation               | `\cite{humphrey97}`       | `[@humphrey97]`        | [`cite`]   |
| Monospace (typewriter) | `\texttt{mono}` | `text` or `mono` functions | [`text`], [`mono`]($math.mono) |
| Code                   | `lstlisting` environment  | ``[`print(f"{x}")`]``  | [`raw`]  |
| Verbatim               | `verbatim` environment    | ``[`#typst-code()`]``  | [`raw`]  |
| Bullet list            | `itemize` environment     | `[- List]`             | [`list`]   |
| Numbered list          | `enumerate` environment   | `[+ List]`             | [`enum`]   |
| Term list              | `description` environment | `[/ Term: List]`       | [`terms`]  |
| Figure                 | `figure` environment      | `figure` function      | [`figure`] |
| Table                  | `table` environment       | `table` function       | [`table`]  |
| Equation               | `$x$`, `align` / `equation` environments | `[$x$]`, `[$ x = y $]` | [`equation`]($math.equation) |

[Lists]($list) do not rely on environments in Typst. Instead, they have
lightweight syntax like headings. To create an unordered list (`itemize`),
prefix each line of an item with a hyphen:

````example
To write this list in Typst...

```latex
\begin{itemize}
  \item Fast
  \item Flexible
  \item Intuitive
\end{itemize}
```

...just type this:

- Fast
- Flexible
- Intuitive

````

Nesting lists works just by using proper indentation. Adding a blank line in
between items results in a more [widely]($list.tight) spaced list.

To get a [numbered list]($enum) (`enumerate`) instead, use a `+` instead of the
hyphen. For a [term list]($terms) (`description`), write `[/ Term: Description]`
instead.

Note that the [`raw` function]($raw) and syntax (e.g. ``[`raw`]``) only work for
verbatim (unformatted) text. If you require formatting, you can use the
[`text` function]($text) with a monospace font instead, like in the example
below:

```example
#text(
  font: "DejaVu Sans Mono",
  size: 0.8em,
)[monospace *bold*]
```

## How do I use a command? { #commands }
LaTeX heavily relies on commands (prefixed by backslashes). It uses these
_macros_ to affect the typesetting process and to insert and manipulate content.
Some commands accept arguments, which are most frequently enclosed in curly
braces: `\cite{rasmus}`.

Typst differentiates between [markup mode and code mode]($scripting/#blocks).
The default is markup mode, where you compose text and apply syntactic
constructs such as `[*stars for bold text*]`. Code mode, on the other hand,
parallels programming languages like Python, providing the option to input and
execute segments of code.

Within Typst's markup, you can switch to code mode for a single command (or
rather, _expression_) using a hash (`#`). This is how you call functions to, for
example, split your project into different [files]($scripting/#modules) or
render text based on some [condition]($scripting/#conditionals). Within code
mode, it is possible to include normal markup [_content_]($content) by using
square brackets. Within code mode, this content is treated just as any other
normal value for a variable.

```example
First, a rectangle:
#rect()

Let me show how to do
#underline([_underlined_ text])

We can also do some maths:
#calc.max(3, 2 * 4)

And finally a little loop:
#for x in range(3) [
  Hi #x.
]
```

A function call always involves the name of the function ([`rect`],
[`underline`], [`calc.max`]($calc.max), [`range`]($array.range)) followed by
parentheses (as opposed to LaTeX where the square brackets and curly braces are
optional if the macro requires no arguments). The expected list of arguments
passed within those parentheses depends on the concrete function and is
specified in the [reference].

### Arguments
A function can have multiple arguments. Some arguments are positional, i.e., you
just provide the value: The function `[#lower("SCREAM")]` returns its argument
in all-lowercase. Many functions use named arguments instead of positional
arguments to increase legibility. For example, the dimensions and stroke of a
rectangle are defined with named arguments:

```example
#rect(
  width: 2cm,
  height: 1cm,
  stroke: red,
)
```

You specify a named argument by first entering its name (above, it's `width`,
`height`, and `stroke`), then a colon, followed by the value (`2cm`, `1cm`,
`red`). You can find the available named arguments in the [reference
page]($reference) for each function or in the autocomplete panel when typing.
Named arguments are similar to how some LaTeX environments are configured, for
example, you would type `\begin{enumerate}[label={\alph*)}]` to start a list
with the labels `a)`, `b)`, and so on.

Often, you want to provide some [content] to a function. For example, the LaTeX
command `\underline{Alternative A}` would translate to
`[#underline([Alternative A])]` in Typst. The square brackets indicate that a
value is [content]. Within these brackets, you can use normal markup.
However, that's a lot of parentheses for a pretty simple construct. This is why
you can also move trailing content arguments after the parentheses (and omit the
parentheses if they would end up empty).

```example
Typst is an #underline[alternative]
to LaTeX.

#rect(fill: aqua)[Get started here!]
```

### Data types
You likely already noticed that the arguments have distinctive data types. Typst
supports many [data types]($type). Below, there is a table with some of the most
important ones and how to write them. In order to specify values of any of these
types, you have to be in code mode!

| Data type                       | Example                           |
|:--------------------------------|:----------------------------------|
| [Content]($content)             | `{[*fast* typesetting]}`          |
| [String]($str)                  | `{"Pietro S. Author"}`            |
| [Integer]($int)                 | `{23}`                            |
| [Floating point number]($float) | `{1.459}`                         |
| [Absolute length]($length)      | `{12pt}`, `{5in}`, `{0.3cm}`, ... |
| [Relative length]($ratio)       | `{65%}`                           |

The difference between content and string is that content can contain markup,
including function calls, while a string really is just a plain sequence of
characters.

Typst provides [control flow constructs]($scripting/#conditionals) and
[operators]($scripting/#operators) such as `+` for adding things or `==` for
checking equality between two variables.

You can also store values, including functions, in your own
[variables]($scripting/#bindings). This can be useful to perform computations on
them, create reusable automations, or reference a value multiple times. The
variable binding is accomplished with the let keyword, which works similar to
`\newcommand`:

```example
// Store the integer `5`.
#let five = 5

// Define a function that
// increments a value.
#let inc(i) = i + 1

// Reference the variables.
I have #five fingers.

If I had one more, I'd have
#inc(five) fingers. Whoa!
```

### Commands to affect the remaining document { #rules }
In LaTeX, some commands like `\textbf{bold text}` receive an argument in curly
braces and only affect that argument. Other commands such as `\bfseries bold
text` act as switches (LaTeX calls this a declaration), altering the appearance
of all subsequent content within the document or current scope.

In Typst, the same function can be used both to affect the appearance for the
remainder of the document, a block (or scope), or just its arguments. For
example, `[#text(weight: "bold")[bold text]]` will only embolden its argument,
while `[#set text(weight: "bold")]` will embolden any text until the end of the
current block, or the end of the document, if there is none. The effects of a
function are immediately obvious based on whether it is used in a call or a
[set rule.]($styling/#set-rules)

```example
I am starting out with small text.

#set text(14pt)

This is a bit #text(18pt)[larger,]
don't you think?
```

Set rules may appear anywhere in the document. They can be thought of as
default argument values of their respective function:

```example
#set enum(numbering: "I.")

Good results can only be obtained by
+ following best practices
+ being aware of current results
  of other researchers
+ checking the data for biases
```

The `+` is syntactic sugar (think of it as an abbreviation) for a call to the
[`{enum}`]($enum) function, to which we apply a set rule above.
[Most syntax is linked to a function in this way.]($syntax) If you need to style
an element beyond what its arguments enable, you can completely redefine its
appearance with a [show rule]($styling/#show-rules) (somewhat comparable to
`\renewcommand`).

You can achieve the effects of LaTeX commands like `\textbf`, `\textsf`,
`\rmfamily`, `\mdseries`, and `\itshape` with the [`font`]($text.font),
[`style`]($text.style), and [`weight`]($text.weight) arguments of the `text`
function. The text function can be used in a set rule (declaration style) or
with a content argument. To replace `\textsc`, you can use the [`smallcaps`]
function, which renders its content argument as smallcaps. Should you want to
use it declaration style (like `\scshape`), you can use an
[_everything_ show rule]($styling/#show-rules) that applies the function to the
rest of the scope:

```example
#show: smallcaps

Boisterous Accusations
```

## How do I load a document class? { #templates }
In LaTeX, you start your main `.tex` file with the `\documentclass{article}`
command to define how your document is supposed to look. In that command, you
may have replaced `article` with another value such as `report` and `amsart` to
select a different look.

When using Typst, you style your documents with [functions]($function).
Typically, you use a template that provides a function that styles your whole
document. First, you import the function from a template file. Then, you apply
it to your whole document. This is accomplished with a
[show rule]($styling/#show-rules) that wraps the following document in a given
function. The following example illustrates how it works:

```example:single
>>> #let conf(
>>>   title: none,
>>>   authors: (),
>>>   abstract: [],
>>>   doc,
>>> ) = {
>>>   set text(font: "Libertinus Serif", 11pt)
>>>   set par(justify: true)
>>>   set page(
>>>     "us-letter",
>>>     margin: auto,
>>>     header: align(
>>>       right + horizon,
>>>       title
>>>     ),
>>>     numbering: "1",
>>>     columns: 2
>>>   )
>>>
>>>   show heading.where(
>>>     level: 1
>>>   ): it => block(
>>>     align(center,
>>>       text(
>>>         13pt,
>>>         weight: "regular",
>>>         smallcaps(it.body),
>>>       )
>>>     ),
>>>   )
>>>   show heading.where(
>>>     level: 2
>>>   ): it => box(
>>>     text(
>>>       11pt,
>>>       weight: "regular",
>>>       style: "italic",
>>>       it.body + [.],
>>>     )
>>>   )
>>>
>>>   place(top, float: true, scope: "parent", {
>>>     set align(center)
>>>     text(17pt, title)
>>>
>>>     let count = calc.min(authors.len(), 3)
>>>     grid(
>>>       columns: (1fr,) * count,
>>>       row-gutter: 24pt,
>>>       ..authors.map(author => [
>>>         #author.name \
>>>         #author.affiliation \
>>>         #link("mailto:" + author.email)
>>>       ]),
>>>     )
>>>
>>>     par(justify: false)[
>>>       *Abstract* \
>>>       #abstract
>>>     ]
>>>   })
>>>
>>>   set align(left)
>>>   doc
>>> }
<<< #import "conf.typ": conf
#show: conf.with(
  title: [
    Towards Improved Modelling
  ],
  authors: (
    (
      name: "Theresa Tungsten",
      affiliation: "Artos Institute",
      email: "tung@artos.edu",
    ),
    (
      name: "Eugene Deklan",
      affiliation: "Honduras State",
      email: "e.deklan@hstate.hn",
    ),
  ),
  abstract: lorem(80),
)

Let's get started writing this
article by putting insightful
paragraphs right here!
>>> #lorem(500)
```

The [`{import}`]($scripting/#modules) statement makes [functions]($function)
(and other definitions) from another file available. In this example, it imports
the `conf` function from the `conf.typ` file. This function formats a document
as a conference article. We use a show rule to apply it to the document and also
configure some metadata of the article. After applying the show rule, we can
start writing our article right away!

You can also use templates from Typst Universe (which is Typst's equivalent of
CTAN) using an import statement like this: `[#import
"@preview/elsearticle:0.2.1": elsearticle]`. Check the documentation of an
individual template to learn the name of its template function. Templates and
packages from Typst Universe are automatically downloaded when you first use
them.

In the web app, you can choose to create a project from a template on Typst
Universe or even create your own using the template wizard. Locally, you can use
the `typst init` CLI to create a new project from a template. Check out [the
list of templates]($universe/search/?kind=templates) published on Typst
Universe. You can also take a look at the [`awesome-typst`
repository](https://github.com/qjcg/awesome-typst) to find community templates
that aren't available through Universe.

You can also [create your own, custom templates.]($tutorial/making-a-template)
They are shorter and more readable than the corresponding LaTeX `.sty` files by
orders of magnitude, so give it a try!

<div class="info-box">

Functions are Typst's "commands" and can transform their arguments to an output
value, including document _content._ Functions are "pure", which means that they
cannot have any effects beyond creating an output value / output content. This
is in stark contrast to LaTeX macros that can have arbitrary effects on your
document.

To let a function style your whole document, the show rule processes everything
that comes after it and calls the function specified after the colon with the
result as an argument. The `.with` part is a _method_ that takes the `conf`
function and pre-configures some of its arguments before passing it on to the
show rule.
</div>

## How do I load packages? { #packages }
Typst is "batteries included," so the equivalent of many popular LaTeX packages
is built right-in. Below, we compiled a table with frequently loaded packages
and their corresponding Typst functions.

| LaTeX Package                   | Typst Alternative                          |
|:--------------------------------|:-------------------------------------------|
| graphicx, svg                   | [`image`] function                         |
| tabularx, tabularray            | [`table`], [`grid`] functions              |
| fontenc, inputenc, unicode-math | Just start writing!                        |
| babel, polyglossia              | [`text`]($text.lang) function: `[#set text(lang: "zh")]` |
| amsmath                         | [Math mode]($category/math)                |
| amsfonts, amssymb               | [`sym`]($category/symbols) module and [syntax]($syntax/#math) |
| geometry, fancyhdr              | [`page`] function                          |
| xcolor                          | [`text`]($text.fill) function: `[#set text(fill: rgb("#0178A4"))]` |
| hyperref                        | [`link`] function                          |
| bibtex, biblatex, natbib        | [`cite`], [`bibliography`] functions       |
| lstlisting, minted              | [`raw`] function and syntax                |
| parskip                         | [`block`]($block.spacing) and [`par`]($par.first-line-indent) functions |
| csquotes                        | Set the [`text`]($text.lang) language and type `["]` or `[']` |
| caption                         | [`figure`] function                        |
| enumitem                        | [`list`], [`enum`], [`terms`] functions    |
| nicefrac                        | [`frac.style`]($math.frac.style) property  |

Although _many_ things are built-in, not everything can be. That's why Typst has
its own [package ecosystem]($universe) where the community share its creations
and automations. Let's take, for instance, the _CeTZ_ package: This package
allows you to create complex drawings and plots. To use CeTZ in your document,
you can just write:

```typ
#import "@preview/cetz:0.4.1"
```

(The `@preview` is a _namespace_ that is used while the package manager is still
in its early and experimental state. It will be replaced in the future.)

Aside from the official package hub, you might also want to check out the
[awesome-typst repository](https://github.com/qjcg/awesome-typst), which
compiles a curated list of resources created for Typst.

If you need to load functions and variables from another file within your
project, for example to use a template, you can use the same
[`import`]($scripting/#modules) statement with a file name rather than a
package specification. To instead include the textual content of another file,
you can use an [`include`]($scripting/#modules) statement. It will retrieve
the content of the specified file and put it in your document.

## How do I input maths? { #maths }
To enter math mode in Typst, just enclose your equation in dollar signs. You can
enter display mode by adding spaces or newlines between the equation's contents
and its enclosing dollar signs.

```example
The sum of the numbers from
$1$ to $n$ is:

$ sum_(k=1)^n k = (n(n+1))/2 $
```

[Math mode]($category/math) works differently than regular markup or code mode.
Numbers and single characters are displayed verbatim, while multiple consecutive
(non-number) characters will be interpreted as Typst variables.

Typst pre-defines a lot of useful variables in math mode. All Greek (`alpha`,
`beta`, ...) and some Hebrew letters (`aleph`, `beth`, ...) are available through
their name. Some symbols are additionally available through shorthands, such as
`<=`, `>=`, and `->`.

Refer to the [symbol pages]($reference/symbols) for a full list of the symbols.
If a symbol is missing, you can also access it through a
[Unicode escape sequence]($syntax/#escapes).

Alternate and related forms of symbols can often be selected by
[appending a modifier]($symbol) after a period. For example,
`arrow.l.squiggly` inserts a squiggly left-pointing arrow. If you want to insert
multiletter text in your expression instead, enclose it in double quotes:

```example
$ delta "if" x <= 5 $
```

In Typst, delimiters will scale automatically for their expressions, just as if
`\left` and `\right` commands were implicitly inserted in LaTeX. You can
customize delimiter behaviour using the [`lr` function]($math.lr). To
prevent a pair of delimiters from scaling, you can escape them with backslashes.

Typst will automatically set terms around a slash `/` as a fraction while
honoring operator precedence. All round parentheses not made redundant by the
fraction will appear in the output.

```example
$ f(x) = (x + 1) / x $
```

[Sub- and superscripts]($math.attach) work similarly in Typst and LaTeX.
`{$x^2$}` will produce a superscript, `{$x_2$}` yields a subscript. If you want
to include more than one value in a sub- or superscript, enclose their contents
in parentheses: `{$x_(a -> epsilon)$}`.

Since variables in math mode do not need to be prepended with a `#` (or a `\`
like in LaTeX), you can also call functions without these special characters:

```example
$ f(x, y) := cases(
  1 "if" (x dot y)/2 <= 0,
  2 "if" x "is even",
  3 "if" x in NN,
  4 "else",
) $
```

The above example uses the [`cases` function]($math.cases) to describe f. Within
the cases function, arguments are delimited using commas and the arguments are
also interpreted as math. If you need to interpret arguments as Typst
values instead, prefix them with a `#`:

```example
$ (a + b)^2
  = a^2
  + text(fill: #maroon, 2 a b)
  + b^2 $
```

You can use all Typst functions within math mode and insert any content. If you
want them to work normally, with code mode in the argument list, you can prefix
their call with a `#`. Nobody can stop you from using rectangles or emoji as
your variables anymore:

```example
$ sum^10_(🤓=1)
  #rect(width: 4mm, height: 2mm)/🤓
  = 🧠 maltese $
```

If you'd like to enter your mathematical symbols directly as Unicode, that is
possible, too!

Math calls can have two-dimensional argument lists using `;` as a delimiter. The
most common use for this is the [`mat` function]($math.mat) that creates
matrices:

```example
$ mat(
  1, 2, ..., 10;
  2, 2, ..., 10;
  dots.v, dots.v, dots.down, dots.v;
  10, 10, ..., 10;
) $
```

## How do I get the "LaTeX look?" { #latex-look }
Papers set in LaTeX have an unmistakeable look. This is mostly due to their
font, Computer Modern, justification, narrow line spacing, and wide margins.

The example below
- sets wide [margins]($page.margin)
- enables [justification]($par.justify), [tighter lines]($par.leading) and
  [first-line-indent]($par.first-line-indent)
- [sets the font]($text.font) to "New Computer Modern", an OpenType derivative of
  Computer Modern for both text and [code blocks]($raw)
- decreases the [font weight]($text.weight) in math mode
- disables paragraph [spacing]($block.spacing)
- increases [spacing]($block.spacing) around [headings]($heading)

```typ
#set page(margin: 1.75in)
#set par(leading: 0.55em, spacing: 0.55em, first-line-indent: 1.8em, justify: true)
#set text(font: "New Computer Modern")
#show raw: set text(font: "New Computer Modern Mono")
#show math.equation: set text(weight: "regular")
#show heading: set block(above: 1.4em, below: 1em)
```

This should be a good starting point! If you want to go further, why not create
a reusable template?

## Bibliographies
Typst includes a fully-featured bibliography system that is compatible with
BibTeX files. You can continue to use your `.bib` literature libraries by
loading them with the [`bibliography`] function. Another possibility is to use
[Typst's YAML-based native format](https://github.com/typst/hayagriva/blob/main/docs/file-format.md).

Typst uses the Citation Style Language to define and process citation and
bibliography styles. You can compare CSL files to BibLaTeX's `.bbx` files.
The compiler already includes [over 80 citation styles]($bibliography.style),
but you can use any CSL-compliant style from the
[CSL repository](https://github.com/citation-style-language/styles) or write
your own.

You can cite an entry in your bibliography or reference a label in your document
with the same syntax: `[@key]` (this would reference an entry called `key`).
Alternatively, you can use the [`cite`] function.

Alternative forms for your citation, such as year only and citations for natural
use in prose (cf. `\citet` and `\textcite`) are available with
[`[#cite(<key>, form: "prose")]`]($cite.form).

You can find more information on the documentation page of the [`bibliography`]
function.

## What limitations does Typst currently have compared to LaTeX? { #limitations }
Although Typst can be a LaTeX replacement for many today, there are still
features that Typst does not (yet) support. Here is a list of them which, where
applicable, contains possible workarounds.

- **Well-established plotting ecosystem.** LaTeX users often create elaborate
  charts along with their documents in PGF/TikZ. The Typst ecosystem does not
  yet offer the same breadth of available options, but the ecosystem around the
  [`cetz` package](https://typst.app/universe/package/cetz) is catching up
  quickly.

- **Change page margins without a pagebreak.** In LaTeX, margins can always be
  adjusted, even without a pagebreak. To change margins in Typst, you use the
  [`page` function]($page) which will force a page break. If you just want a few
  paragraphs to stretch into the margins, then reverting to the old margins, you
  can use the [`pad` function]($pad) with negative padding.


---

## page-setup.md

---
description: |
  An in-depth guide to setting page dimensions, margins, and page numbers in
  Typst. Learn how to create appealing and clear layouts and get there quickly.
---

# Page Setup Guide
Your page setup is a big part of the first impression your document gives. Line
lengths, margins, and columns influence
[appearance](https://practicaltypography.com/page-margins.html) and
[legibility](https://designregression.com/article/line-length-revisited-following-the-research)
while the right headers and footers will help your reader easily navigate your
document. This guide will help you to customize pages, margins, headers,
footers, and page numbers so that they are the right fit for your content and
you can get started with writing.

In Typst, each page has a width, a height, and margins on all four sides. The
top and bottom margins may contain a header and footer. The set rule of the
[`{page}`]($page) element is where you control all of the page setup. If you
make changes with this set rule, Typst will ensure that there is a new and
conforming empty page afterward, so it may insert a page break. Therefore, it is
best to specify your [`{page}`]($page) set rule at the start of your document or
in your template.

```example
#set rect(
  width: 100%,
  height: 100%,
  inset: 4pt,
)
>>> #set text(6pt)
>>> #set page(margin: auto)

#set page(
  paper: "iso-b7",
  header: rect(fill: aqua)[Header],
  footer: rect(fill: aqua)[Footer],
  number-align: center,
)

#rect(fill: aqua.lighten(40%))
```

This example visualizes the dimensions for page content, headers, and footers.
The page content is the page size (ISO B7) minus each side's default margin. In
the top and the bottom margin, there are stroked rectangles visualizing the
header and footer. They do not touch the main content, instead, they are offset
by 30% of the respective margin. You can control this offset by specifying the
[`header-ascent`]($page.header-ascent) and
[`footer-descent`]($page.footer-descent) arguments.

Below, the guide will go more into detail on how to accomplish common page setup
requirements with examples.

## Customize page size and margins { #customize-margins }
Typst's default page size is A4 paper. Depending on your region and your use
case, you will want to change this. You can do this by using the
[`{page}`]($page) set rule and passing it a string argument to use a common page
size. Options include the complete ISO 216 series (e.g. `"a4"` and `"iso-c2"`),
customary US formats like `"us-legal"` or `"us-letter"`, and more. Check out the
reference for the [page's paper argument]($page.paper) to learn about all
available options.

```example
>>> #set page(margin: auto)
#set page("us-letter")

This page likes freedom.
```

If you need to customize your page size to some dimensions, you can specify the
named arguments [`width`]($page.width) and [`height`]($page.height) instead.

```example
>>> #set page(margin: auto)
#set page(width: 12cm, height: 12cm)

This page is a square.
```

### Change the page's margins { #change-margins }
Margins are a vital ingredient for good typography:
[Typographers consider lines that fit between 45 and 75 characters best length
for legibility](http://webtypography.net/2.1.2) and your margins and
[columns](#columns) help define line widths. By default, Typst will create
margins proportional to the page size of your document. To set custom margins,
you will use the [`margin`]($page.margin) argument in the [`{page}`]($page) set
rule.

The `margin` argument will accept a length if you want to set all margins to the
same width. However, you often want to set different margins on each side. To do
this, you can pass a dictionary:

```example
#set page(margin: (
  top: 3cm,
  bottom: 2cm,
  x: 1.5cm,
))

#lorem(100)
```

The page margin dictionary can have keys for each side (`top`, `bottom`, `left`,
`right`), but you can also control left and right together by setting the `x`
key of the margin dictionary, like in the example. Likewise, the top and bottom
margins can be adjusted together by setting the `y` key.

If you do not specify margins for all sides in the margin dictionary, the old
margins will remain in effect for the unset sides. To prevent this and set all
remaining margins to a common size, you can use the `rest` key. For example,
`[#set page(margin: (left: 1.5in, rest: 1in))]` will set the left margin to 1.5
inches and the remaining margins to one inch.

### Different margins on alternating pages { #alternating-margins }
Sometimes, you'll need to alternate horizontal margins for even and odd pages,
for example, to have more room towards the spine of a book than on the outsides
of its pages. Typst keeps track of whether a page is to the left or right of the
binding. You can use this information and set the `inside` or `outside` keys of
the margin dictionary. The `inside` margin points towards the spine, and the
`outside` margin points towards the edge of the bound book.

```typ
#set page(margin: (inside: 2.5cm, outside: 2cm, y: 1.75cm))
```

Typst will assume that documents written in Left-to-Right scripts are bound on
the left while books written in Right-to-Left scripts are bound on the right.
However, you will need to change this in some cases: If your first page is
output by a different app, the binding is reversed from Typst's perspective.
Also, some books, like English-language Mangas are customarily bound on the
right, despite English using Left-to-Right script. To change the binding side
and explicitly set where the `inside` and `outside` are, set the
[`binding`]($page.binding) argument in the [`{page}`]($page) set rule.

```typ
// Produce a book bound on the right,
// even though it is set in Spanish.
#set text(lang: "es")
#set page(binding: right)
```

If `binding` is `left`, `inside` margins will be on the left on odd pages, and
vice versa.

## Add headers and footers { #headers-and-footers }
Headers and footers are inserted in the top and bottom margins of every page.
You can add custom headers and footers or just insert a page number.

In case you need more than just a page number, the best way to insert a header
and a footer are the [`header`]($page.header) and [`footer`]($page.footer)
arguments of the [`{page}`]($page) set rule. You can pass any content as their
values:

```example
>>> #set page("a5", margin: (x: 2.5cm, y: 3cm))
#set page(header: [
  _Lisa Strassner's Thesis_
  #h(1fr)
  National Academy of Sciences
])

#lorem(150)
```

Headers are bottom-aligned by default so that they do not collide with the top
edge of the page. You can change this by wrapping your header in the
[`{align}`]($align) function.

### Different header and footer on specific pages { #specific-pages }
You'll need different headers and footers on some pages. For example, you may
not want a header and footer on the title page. The example below shows how to
conditionally remove the header on the first page:

```typ
>>> #set page("a5", margin: (x: 2.5cm, y: 3cm))
#set page(header: context {
  if counter(page).get().first() > 1 [
    _Lisa Strassner's Thesis_
    #h(1fr)
    National Academy of Sciences
  ]
})

#lorem(150)
```

This example may look intimidating, but let's break it down: By using the
`{context}` keyword, we are telling Typst that the header depends on where we
are in the document. We then ask Typst if the page [counter] is larger than one
at our (context-dependent) current position. The page counter starts at one, so
we are skipping the header on a single page. Counters may have multiple levels.
This feature is used for items like headings, but the page counter will always
have a single level, so we can just look at the first one.

You can, of course, add an `else` to this example to add a different header to
the first page instead.

### Adapt headers and footers on pages with specific elements { #specific-elements }
The technique described in the previous section can be adapted to perform more
advanced tasks using Typst's labels. For example, pages with big tables could
omit their headers to help keep clutter down. We will mark our tables with a
`<big-table>` [label] and use the [query system]($query) to find out if such a
label exists on the current page:

```typ
>>> #set page("a5", margin: (x: 2.5cm, y: 3cm))
#set page(header: context {
  let matches = query(<big-table>)
  let current = counter(page).get()
  let has-table = matches.any(m =>
    counter(page).at(m.location()) == current
  )

  if not has-table [
    _Lisa Strassner's Thesis_
    #h(1fr)
    National Academy of Sciences
  ]
})

#lorem(100)
#pagebreak()

#table(
  columns: 2 * (1fr,),
  [A], [B],
  [C], [D],
) <big-table>
```

Here, we query for all instances of the `<big-table>` label. We then check that
none of the tables are on the page at our current position. If so, we print the
header. This example also uses variables to be more concise. Just as above, you
could add an `else` to add another header instead of deleting it.

## Add and customize page numbers { #page-numbers }
Page numbers help readers keep track of and reference your document more easily.
The simplest way to insert page numbers is the [`numbering`]($page.numbering)
argument of the [`{page}`]($page) set rule. You can pass a
[_numbering pattern_]($numbering.numbering) string that shows how you want your
pages to be numbered.

```example
>>> #set page("iso-b6", margin: 1.75cm)
#set page(numbering: "1")

This is a numbered page.
```

Above, you can check out the simplest conceivable example. It adds a single
Arabic page number at the center of the footer. You can specify other characters
than `"1"` to get other numerals. For example, `"i"` will yield lowercase Roman
numerals. Any character that is not interpreted as a number will be output
as-is. For example, put dashes around your page number by typing this:

```example
>>> #set page("iso-b6", margin: 1.75cm)
#set page(numbering: "— 1 —")

This is a — numbered — page.
```

You can add the total number of pages by entering a second number character in
the string.

```example
>>> #set page("iso-b6", margin: 1.75cm)
#set page(numbering: "1 of 1")

This is one of many numbered pages.
```

Go to the [`{numbering}` function reference]($numbering.numbering) to learn more
about the arguments you can pass here.

In case you need to right- or left-align the page number, use the
[`number-align`]($page.number-align) argument of the [`{page}`]($page) set rule.
Alternating alignment between even and odd pages is not currently supported
using this property. To do this, you'll need to specify a custom footer with
your footnote and query the page counter as described in the section on
conditionally omitting headers and footers.

### Custom footer with page numbers
Sometimes, you need to add other content than a page number to your footer.
However, once a footer is specified, the [`numbering`]($page.numbering) argument
of the [`{page}`]($page) set rule is ignored. This section shows you how to add
a custom footer with page numbers and more.

```example
>>> #set page("iso-b6", margin: 1.75cm)
#set page(footer: context [
  *American Society of Proceedings*
  #h(1fr)
  #counter(page).display(
    "1/1",
    both: true,
  )
])

This page has a custom footer.
```

First, we add some strongly emphasized text on the left and add free space to
fill the line. Then, we call `counter(page)` to retrieve the page counter and
use its `display` function to show its current value. We also set `both` to
`{true}` so that our numbering pattern applies to the current _and_ final page
number.

We can also get more creative with the page number. For example, let's insert a
circle for each page.

```example
>>> #set page("iso-b6", margin: 1.75cm)
#set page(footer: context [
  *Fun Typography Club*
  #h(1fr)
  #let (num,) = counter(page).get()
  #let circles = num * (
    box(circle(
      radius: 2pt,
      fill: navy,
    )),
  )
  #box(
    inset: (bottom: 1pt),
    circles.join(h(1pt))
  )
])

This page has a custom footer.
```

In this example, we use the number of pages to create an array of
[circles]($circle). The circles are wrapped in a [box] so they can all appear on
the same line because they are blocks and would otherwise create paragraph
breaks. The length of this [array] depends on the current page number.

We then insert the circles at the right side of the footer, with 1pt of space
between them. The join method of an array will attempt to
[_join_]($scripting/#blocks) the different values of an array into a single
value, interspersed with its argument. In our case, we get a single content
value with circles and spaces between them that we can use with the align
function. Finally, we use another box to ensure that the text and the circles
can share a line and use the [`inset` argument]($box.inset) to raise the circles
a bit so they line up nicely with the text.

### Reset the page number and skip pages { #skip-pages }
Do you, at some point in your document, need to reset the page number? Maybe you
want to start with the first page only after the title page. Or maybe you need
to skip a few page numbers because you will insert pages into the final printed
product.

The right way to modify the page number is to manipulate the page [counter]. The
simplest manipulation is to set the counter back to 1.

```typ
#counter(page).update(1)
```

This line will reset the page counter back to one. It should be placed at the
start of a page because it will otherwise create a page break. You can also
update the counter given its previous value by passing a function:

```typ
#counter(page).update(n => n + 5)
```

In this example, we skip five pages. `n` is the current value of the page
counter and `n + 5` is the return value of our function.

In case you need to retrieve the actual page number instead of the value of the
page counter, you can use the [`page`]($location.page) method on the return
value of the [`here`] function:

```example
#counter(page).update(n => n + 5)

// This returns one even though the
// page counter was incremented by 5.
#context here().page()
```

You can also obtain the page numbering pattern from the location returned by
`here` with the [`page-numbering`]($location.page-numbering) method.

## Add columns { #columns }
Add columns to your document to fit more on a page while maintaining legible
line lengths. Columns are vertical blocks of text which are separated by some
whitespace. This space is called the gutter.

To lay out your content in columns, just specify the desired number of columns
in a [`{page}`]($page.columns) set rule. To adjust the amount of space between
the columns, add a set rule on the [`columns` function]($columns), specifying
the `gutter` parameter.

```example
>>> #set page(height: 120pt)
#set page(columns: 2)
#set columns(gutter: 12pt)

#lorem(30)
```

Very commonly, scientific papers have a single-column title and abstract, while
the main body is set in two-columns. To achieve this effect, Typst's [`place`
function]($place) can temporarily escape the two-column layout by specifying
`{float: true}` and `{scope: "parent"}`:

```example:single
>>> #set page(height: 180pt)
#set page(columns: 2)
#set par(justify: true)

#place(
  top + center,
  float: true,
  scope: "parent",
  text(1.4em, weight: "bold")[
    Impacts of Odobenidae
  ],
)

== About seals in the wild
#lorem(80)
```

_Floating placement_ refers to elements being pushed to the top or bottom of the
column or page, with the remaining content flowing in between. It is also
frequently used for [figures]($figure.placement).

### Use columns anywhere in your document { #columns-anywhere }
To create columns within a nested layout, e.g. within a rectangle, you can use
the [`columns` function]($columns) directly. However, it really should only be
used within nested layouts. At the page-level, the page set rule is preferable
because it has better interactions with things like page-level floats,
footnotes, and line numbers.

```example
#rect(
  width: 6cm,
  height: 3.5cm,
  columns(2, gutter: 12pt)[
    In the dimly lit gas station,
    a solitary taxi stood silently,
    its yellow paint fading with
    time. Its windows were dark,
    its engine idle, and its tires
    rested on the cold concrete.
  ]
)
```

### Balanced columns
If the columns on the last page of a document differ greatly in length, they may
create a lopsided and unappealing layout. That's why typographers will often
equalize the length of columns on the last page. This effect is called balancing
columns. Typst cannot yet balance columns automatically. However, you can
balance columns manually by placing [`[#colbreak()]`]($colbreak) at an
appropriate spot in your markup, creating the desired column break manually.


## One-off modifications
You do not need to override your page settings if you need to insert a single
page with a different setup. For example, you may want to insert a page that's
flipped to landscape to insert a big table or change the margin and columns for
your title page. In this case, you can call [`{page}`]($page) as a function with
your content as an argument and the overrides as the other arguments. This will
insert enough new pages with your overridden settings to place your content on
them. Typst will revert to the page settings from the set rule after the call.

```example
>>> #set page("a6")
#page(flipped: true)[
  = Multiplication table

  #table(
    columns: 5 * (1fr,),
    ..for x in range(1, 10) {
      for y in range(1, 6) {
        (str(x*y),)
      }
    }
  )
]
```


---

## tables.md

---
description: |
  Not sure how to change table strokes? Need to rotate a table? This guide
  explains all you need to know about tables in Typst.
---

# Table Guide
Tables are a great way to present data to your readers in an easily readable,
compact, and organized manner. They are not only used for numerical values, but
also survey responses, task planning, schedules, and more. Because of this wide
set of possible applications, there is no single best way to lay out a table.
Instead, think about the data you want to highlight, your document's overarching
design, and ultimately how your table can best serve your readers.

Typst can help you with your tables by automating styling, importing data from
other applications, and more! This guide takes you through a few of the most
common questions you may have when adding a table to your document with Typst.
Feel free to skip to the section most relevant to you – we designed this guide
to be read out of order.

If you want to look up a detail of how tables work, you should also [check out
their reference page]($table). And if you are looking for a table of contents
rather than a normal table, the reference page of the [`outline`
function]($outline) is the right place to learn more.

## How to create a basic table? { #basic-tables }
In order to create a table in Typst, use the [`table` function]($table). For a
basic table, you need to tell the table function two things:

- The number of columns
- The content for each of the table cells

So, let's say you want to create a table with two columns describing the
ingredients for a cookie recipe:

```example
#table(
  columns: 2,
  [*Amount*], [*Ingredient*],
  [360g], [Baking flour],
  [250g], [Butter (room temp.)],
  [150g], [Brown sugar],
  [100g], [Cane sugar],
  [100g], [70% cocoa chocolate],
  [100g], [35-40% cocoa chocolate],
  [2], [Eggs],
  [Pinch], [Salt],
  [Drizzle], [Vanilla extract],
)
```

This example shows how to call, configure, and populate a table. Both the column
count and cell contents are passed to the table as arguments. The [argument
list]($function) is surrounded by round parentheses. In it, we first pass the
column count as a named argument. Then, we pass multiple [content
blocks]($content) as positional arguments. Each content block contains the
contents for a single cell.

To make the example more legible, we have placed two content block arguments on
each line, mimicking how they would appear in the table. You could also write
each cell on its own line. Typst does not care on which line you place the
arguments. Instead, Typst will place the content cells from left to right (or
right to left, if that is the writing direction of your language) and then from
top to bottom. It will automatically add enough rows to your table so that it
fits all of your content.

It is best to wrap the header row of your table in the [`table.header`
function]($table.header). This clarifies your intent and will also allow Typst
to make the output more [accessible]($guides/accessibility) to users with a
screen reader:

```example
#table(
  columns: 2,
  table.header[*Amount*][*Ingredient*],
  [360g], [Baking flour],
<<<  // ... the remaining cells
>>>  [250g], [Butter (room temp.)],
>>>  [150g], [Brown sugar],
>>>  [100g], [Cane sugar],
>>>  [100g], [70% cocoa chocolate],
>>>  [100g], [35-40% cocoa chocolate],
>>>  [2], [Eggs],
>>>  [Pinch], [Salt],
>>>  [Drizzle], [Vanilla extract],
)
```

You could also write a show rule that automatically [strongly
emphasizes]($strong) the contents of the first cells for all tables. This
quickly becomes useful if your document contains multiple tables!

```example
#show table.cell.where(y: 0): strong

#table(
  columns: 2,
  table.header[Amount][Ingredient],
  [360g], [Baking flour],
<<<  // ... the remaining cells
>>>  [250g], [Butter (room temp.)],
>>>  [150g], [Brown sugar],
>>>  [100g], [Cane sugar],
>>>  [100g], [70% cocoa chocolate],
>>>  [100g], [35-40% cocoa chocolate],
>>>  [2], [Eggs],
>>>  [Pinch], [Salt],
>>>  [Drizzle], [Vanilla extract],
)
```

We are using a show rule with a selector for cell coordinates here instead of
applying our styles directly to `table.header`. This is due to a current
limitation of Typst that will be fixed in a future release.

Congratulations, you have created your first table! Now you can proceed to
[change column sizes](#column-sizes), [adjust the strokes](#strokes), [add
striped rows](#fills), and more!

## How to change the column sizes? { #column-sizes }
If you create a table and specify the number of columns, Typst will make each
column large enough to fit its largest cell. Often, you want something
different, for example, to make a table span the whole width of the page. You
can provide a list, specifying how wide you want each column to be, through the
`columns` argument. There are a few different ways to specify column widths:

- First, there is `{auto}`. This is the default behavior and tells Typst to grow
  the column to fit its contents. If there is not enough space, Typst will try
  its best to distribute the space among the `{auto}`-sized columns.
- [Lengths]($length) like `{6cm}`, `{0.7in}`, or `{120pt}`. As usual, you can
  also use the font-dependent `em` unit. This is a multiple of your current font
  size. It's useful if you want to size your table so that it always fits
  about the same amount of text, independent of font size.
- A [ratio in percent]($ratio) such as `{40%}`. This will make the column take
  up 40% of the total horizontal space available to the table, so either the
  inner width of the page or the table's container. You can also mix ratios and
  lengths into [relative lengths]($relative). Be mindful that even if you
  specify a list of column widths that sum up to 100%, your table could still
  become larger than its container. This is because there can be
  [gutter]($table.gutter) between columns that is not included in the column
  widths. If you want to make a table fill the page, the next option is often
  very useful.
- A [fractional part of the free space]($fraction) using the `fr` unit, such as
  `1fr`. This unit allows you to distribute the available space to columns. It
  works as follows: First, Typst sums up the lengths of all columns that do not
  use `fr`s. Then, it determines how much horizontal space is left. This
  horizontal space then gets distributed to all columns denominated in `fr`s.
  During this process, a `2fr` column will become twice as wide as a `1fr`
  column. This is where the name comes from: The width of the column is its
  fraction of the total fractionally sized columns.

Let's put this to use with a table that contains the dates, numbers, and
descriptions of some routine checks. The first two columns are `auto`-sized and
the last column is `1fr` wide as to fill the whole page.

```example
#table(
  columns: (auto, auto, 1fr),
  table.header[Date][°No][Description],
  [24/01/03], [813], [Filtered participant pool],
  [24/01/03], [477], [Transitioned to sec. regimen],
  [24/01/11], [051], [Cycled treatment substrate],
)
```

Here, we have passed our list of column lengths as an [array], enclosed in round
parentheses, with its elements separated by commas. The first two columns are
automatically sized, so that they take on the size of their content and the
third column is sized as `{1fr}` so that it fills up the remainder of the space
on the page. If you wanted to instead change the second column to be a bit more
spacious, you could replace its entry in the `columns` array with a value like
`{6em}`.

## How to caption and reference my table? { #captions-and-references }
A table is just as valuable as the information your readers draw from it. You
can enhance the effectiveness of both your prose and your table by making a
clear connection between the two with a cross-reference. Typst can help you with
automatic [references]($ref) and the [`figure` function]($figure).

Just like with images, wrapping a table in the `figure` function allows you to
add a caption and a label, so you can reference the figure elsewhere. Wrapping
your table in a figure also lets you use the figure's `placement` parameter to
float it to the top or bottom of a page.

Let's take a look at a captioned table and how to reference it in prose:

```example
>>> #set page(width: 14cm)
#show table.cell.where(y: 0): set text(weight: "bold")

#figure(
  table(
    columns: 4,
    stroke: none,

    table.header[Test Item][Specification][Test Result][Compliance],
    [Voltage], [220V ± 5%], [218V], [Pass],
    [Current], [5A ± 0.5A], [4.2A], [Fail],
  ),
  caption: [Probe results for design A],
) <probe-a>

The results from @probe-a show that the design is not yet optimal.
We will show how its performance can be improved in this section.
```

The example shows how to wrap a table in a figure, set a caption and a label,
and how to reference that label. We start by using the `figure` function. It
expects the contents of the figure as a positional argument. We just put the
table function call in its argument list, omitting the `#` character because it
is only needed when calling a function in markup mode. We also add the caption
as a named argument (above or below) the table.

After the figure call, we put a label in angle brackets (`[<probe-a>]`). This
tells Typst to remember this element and make it referenceable under this name
throughout your document. We can then reference it in prose by using the at sign
and the label name `[@probe-a]`. Typst will print a nicely formatted reference
and automatically update the label if the table's number changes.

## How to get a striped table? { #fills }
Many tables use striped rows or columns instead of strokes to differentiate
between rows and columns. This effect is often called _zebra stripes._ Tables
with zebra stripes are popular in Business and commercial Data Analytics
applications, while academic applications tend to use strokes instead.

To add zebra stripes to a table, we use the `table` function's `fill` argument.
It can take three kinds of arguments:

- A single color (this can also be a gradient or a tiling) to fill all cells
  with. Because we want some cells to have another color, this is not useful if
  we want to build zebra tables.
- An array with colors which Typst cycles through for each column. We can use an
  array with two elements to get striped columns.
- A function that takes the horizontal coordinate `x` and the vertical
  coordinate `y` of a cell and returns its fill. We can use this to create
  horizontal stripes or [checkerboard patterns]($grid.cell).

Let's start with an example of a horizontally striped table:

```example
>>> #set page(width: 16cm)
#set text(font: "IBM Plex Sans")

// Medium bold table header.
#show table.cell.where(y: 0): set text(weight: "medium")

// Bold titles.
#show table.cell.where(x: 1): set text(weight: "bold")

// See the strokes section for details on this!
#let frame(stroke) = (x, y) => (
  left: if x > 0 { 0pt } else { stroke },
  right: stroke,
  top: if y < 2 { stroke } else { 0pt },
  bottom: stroke,
)

#set table(
  fill: (rgb("EAF2F5"), none),
  stroke: frame(1pt + rgb("21222C")),
)

#table(
  columns: (0.4fr, 1fr, 1fr, 1fr),

  table.header[Month][Title][Author][Genre],
  [January], [The Great Gatsby], [F. Scott Fitzgerald], [Classic],
  [February], [To Kill a Mockingbird], [Harper Lee], [Drama],
  [March], [1984], [George Orwell], [Dystopian],
  [April], [The Catcher in the Rye], [J.D. Salinger], [Coming-of-Age],
)
```

This example shows a book club reading list. The line `{fill: (rgb("EAF2F5"),
 none)}` in `table`'s set rule is all that is needed to add striped columns. It
tells Typst to alternate between coloring columns with a light blue (in the
[`rgb`]($color.rgb) function call) and nothing (`{none}`). Note that we
extracted all of our styling from the `table` function call itself into set and
show rules, so that we can automatically reuse it for multiple tables.

Because setting the stripes itself is easy we also added some other styles to
make it look nice. The other code in the example provides a dark blue
[stroke](#stroke-functions) around the table and below the first line and
emboldens the first row and the column with the book title. See the
[strokes](#strokes) section for details on how we achieved this stroke
configuration.

Let's next take a look at how we can change only the set rule to achieve
horizontal stripes instead:

```example
>>> #set page(width: 16cm)
>>> #set text(font: "IBM Plex Sans")
>>> #show table.cell.where(x: 1): set text(weight: "medium")
>>> #show table.cell.where(y: 0): set text(weight: "bold")
>>>
>>> #let frame(stroke) = (x, y) => (
>>>   left: if x > 0 { 0pt } else { stroke },
>>>   right: stroke,
>>>   top: if y < 2 { stroke } else { 0pt },
>>>   bottom: stroke,
>>> )
>>>
#set table(
  fill: (_, y) => if calc.odd(y) { rgb("EAF2F5") },
  stroke: frame(1pt + rgb("21222C")),
)
>>>
>>> #table(
>>>   columns: (0.4fr, 1fr, 1fr, 1fr),
>>>
>>>   table.header[Month][Title][Author][Genre],
>>>   [January], [The Great Gatsby],
>>>     [F. Scott Fitzgerald], [Classic],
>>>   [February], [To Kill a Mockingbird],
>>>     [Harper Lee], [Drama],
>>>   [March], [1984],
>>>     [George Orwell], [Dystopian],
>>>   [April], [The Catcher in the Rye],
>>>     [J.D. Salinger], [Coming-of-Age],
>>> )
```

We just need to replace the set rule from the previous example with this one and
get horizontal stripes instead. Here, we are passing a function to `fill`. It
discards the horizontal coordinate with an underscore and then checks if the
vertical coordinate `y` of the cell is odd. If so, the cell gets a light blue
fill, otherwise, no fill is returned.

Of course, you can make this function arbitrarily complex. For example, if you
want to stripe the rows with a light and darker shade of blue, you could do
something like this:

```example
>>> #set page(width: 16cm)
>>> #set text(font: "IBM Plex Sans")
>>> #show table.cell.where(x: 1): set text(weight: "medium")
>>> #show table.cell.where(y: 0): set text(weight: "bold")
>>>
>>> #let frame(stroke) = (x, y) => (
>>>   left: if x > 0 { 0pt } else { stroke },
>>>   right: stroke,
>>>   top: if y < 2 { stroke } else { 0pt },
>>>   bottom: stroke,
>>> )
>>>
#set table(
  fill: (_, y) => (none, rgb("EAF2F5"), rgb("DDEAEF")).at(calc.rem(y, 3)),
  stroke: frame(1pt + rgb("21222C")),
)
>>>
>>> #table(
>>>   columns: (0.4fr, 1fr, 1fr, 1fr),
>>>
>>>   table.header[Month][Title][Author][Genre],
>>>   [January], [The Great Gatsby],
>>>     [F. Scott Fitzgerald], [Classic],
>>>   [February], [To Kill a Mockingbird],
>>>     [Harper Lee], [Drama],
>>>   [March], [1984],
>>>     [George Orwell], [Dystopian],
>>>   [April], [The Catcher in the Rye],
>>>     [J.D. Salinger], [Coming-of-Age],
>>> )
```

This example shows an alternative approach to write our fill function. The
function uses an array with three colors and then cycles between its values for
each row by indexing the array with the remainder of `y` divided by 3.

Finally, here is a bonus example that uses the _stroke_ to achieve striped rows:

```example
>>> #set page(width: 16cm)
>>> #set text(font: "IBM Plex Sans")
>>> #show table.cell.where(x: 1): set text(weight: "medium")
>>> #show table.cell.where(y: 0): set text(weight: "bold")
>>>
>>> #let frame(stroke) = (x, y) => (
>>>   left: if x > 0 { 0pt } else { stroke },
>>>   right: stroke,
>>>   top: if y < 2 { stroke } else { 0pt },
>>>   bottom: stroke,
>>> )
>>>
#set table(
  stroke: (x, y) => (
    y: 1pt,
    left: if x > 0 { 0pt } else if calc.even(y) { 1pt },
    right: if calc.even(y) { 1pt },
  ),
)
>>>
>>> #table(
>>>   columns: (0.4fr, 1fr, 1fr, 1fr),
>>>
>>>   table.header[Month][Title][Author][Genre],
>>>   [January], [The Great Gatsby],
>>>     [F. Scott Fitzgerald], [Classic],
>>>   [February], [To Kill a Mockingbird],
>>>     [Harper Lee], [Drama],
>>>   [March], [1984],
>>>     [George Orwell], [Dystopian],
>>>   [April], [The Catcher in the Rye],
>>>     [J.D. Salinger], [Coming-of-Age],
>>> )
```

### Manually overriding a cell's fill color { #fill-override }
Sometimes, the fill of a cell needs not to vary based on its position in the
table, but rather based on its contents. We can use the [`table.cell`
element]($table.cell) in the `table`'s parameter list to wrap a cell's content
and override its fill.

For example, here is a list of all German presidents, with the cell borders
colored in the color of their party.

```example
>>> #set page(width: 10cm)
#set text(font: "Roboto")

#let cdu(name) = ([CDU], table.cell(fill: black, text(fill: white, name)))
#let spd(name) = ([SPD], table.cell(fill: red, text(fill: white, name)))
#let fdp(name) = ([FDP], table.cell(fill: yellow, name))

#table(
  columns: (auto, auto, 1fr),
  stroke: (x: none),

  table.header[Tenure][Party][President],
  [1949-1959], ..fdp[Theodor Heuss],
  [1959-1969], ..cdu[Heinrich Lübke],
  [1969-1974], ..spd[Gustav Heinemann],
  [1974-1979], ..fdp[Walter Scheel],
  [1979-1984], ..cdu[Karl Carstens],
  [1984-1994], ..cdu[Richard von Weizsäcker],
  [1994-1999], ..cdu[Roman Herzog],
  [1999-2004], ..spd[Johannes Rau],
  [2004-2010], ..cdu[Horst Köhler],
  [2010-2012], ..cdu[Christian Wulff],
  [2012-2017], [n/a], [Joachim Gauck],
  [2017-],     ..spd[Frank-Walter-Steinmeier],
)
```

In this example, we make use of variables because there only have been a total
of three parties whose members have become president (and one unaffiliated
president). Their colors will repeat multiple times, so we store a function that
produces an array with their party's name and a table cell with that party's
color and the president's name (`cdu`, `spd`, and `fdp`). We then use these
functions in the `table` argument list instead of directly adding the name. We
use the [spread operator]($arguments/#spreading) `..` to turn the items of the
arrays into single cells. We could also write something like
`{[FDP], table.cell(fill: yellow)[Theodor Heuss]}` for each cell directly in the
`table`'s argument list, but that becomes unreadable, especially for the parties
whose colors are dark so that they require white text. We also delete vertical
strokes and set the font to Roboto.

The party column and the cell color in this example communicate redundant
information on purpose: Communicating important data using color only is a bad
accessibility practice. It disadvantages users with vision impairment and is in
violation of universal access standards, such as the
[WCAG 2.1 Success Criterion 1.4.1](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html).
To improve this table, we added a column printing the party name. Alternatively,
you could have made sure to choose a color-blindness friendly palette and mark
up your cells with an additional label that screen readers can read out loud.
The latter feature is not currently supported by Typst, but will be added in a
future release. You can check how colors look for color-blind readers with
[this Chrome extension](https://chromewebstore.google.com/detail/colorblindly/floniaahmccleoclneebhhmnjgdfijgg),
[Photoshop](https://helpx.adobe.com/photoshop/using/proofing-colors.html), or
[GIMP](https://docs.gimp.org/2.10/en/gimp-display-filter-dialog.html).

## How to adjust the lines in a table? { #strokes }
By default, Typst adds strokes between each row and column of a table. You can
adjust these strokes in a variety of ways. Which one is the most practical,
depends on the modification you want to make and your intent:

- Do you want to style all tables in your document, irrespective of their size
  and content? Use the `table` function's [stroke]($table.stroke) argument in a
  set rule.
- Do you want to customize all lines in a single table? Use the `table`
  function's [stroke]($table.stroke) argument when calling the table function.
- Do you want to change, add, or remove the stroke around a single cell? Use the
  `table.cell` element in the argument list of your table call.
- Do you want to change, add, or remove a single horizontal or vertical stroke
  in a single table? Use the [`table.hline`] and [`table.vline`] elements in the
  argument list of your table call.

We will go over all of these options with examples next! First, we will tackle
the `table` function's [stroke]($table.stroke) argument. Here, you can adjust
both how the table's lines get drawn and configure which lines are drawn at all.

Let's start by modifying the color and thickness of the stroke:

```example
#table(
  columns: 4,
  stroke: 0.5pt + rgb("666675"),
  [*Monday*], [11.5], [13.0], [4.0],
  [*Tuesday*], [8.0], [14.5], [5.0],
  [*Wednesday*], [9.0], [18.5], [13.0],
)
```

This makes the table lines a bit less wide and uses a bluish gray. You can see
that we added a width in point to a color to achieve our customized stroke. This
addition yields a value of the [stroke type]($stroke). Alternatively, you can
use the dictionary representation for strokes which allows you to access
advanced features such as dashed lines.

The previous example showed how to use the stroke argument in the table
function's invocation. Alternatively, you can specify the stroke argument in the
`table`'s set rule. This will have exactly the same effect on all subsequent
`table` calls as if the stroke argument was specified in the argument list. This
is useful if you are writing a template or want to style your whole document.

```typ
// Renders the exact same as the last example
#set table(stroke: 0.5pt + rgb("666675"))

#table(
  columns: 4,
  [*Monday*], [11.5], [13.0], [4.0],
  [*Tuesday*], [8.0], [14.5], [5.0],
  [*Wednesday*], [9.0], [18.5], [13.0],
)
```

For small tables, you sometimes want to suppress all strokes because they add
too much visual noise. To do this, just set the stroke argument to `{none}`:

```example
#table(
  columns: 4,
  stroke: none,
  [*Monday*], [11.5], [13.0], [4.0],
  [*Tuesday*], [8.0], [14.5], [5.0],
  [*Wednesday*], [9.0], [18.5], [13.0],
)
```

If you want more fine-grained control of where lines get placed in your table,
you can also pass a dictionary with the keys `top`, `left`, `right`, `bottom`
(controlling the respective cell sides), `x`, `y` (controlling vertical and
horizontal strokes), and `rest` (covers all strokes not styled by other
dictionary entries). All keys are optional; omitted keys will use their
previously set value, or the default value if never set. For example, to get a
table with only horizontal lines, you can do this:

```example
#table(
  columns: 2,
  stroke: (x: none),
  align: horizon,
  [☒], [Close cabin door],
  [☐], [Start engines],
  [☐], [Radio tower],
  [☐], [Push back],
)
```

This turns off all vertical strokes and leaves the horizontal strokes in place.
To achieve the reverse effect (only vertical strokes), set the stroke argument
to `{(y: none)}` instead.

[Further down in the guide](#stroke-functions), we cover how to use a function
in the stroke argument to customize all strokes individually. This is how you
achieve more complex stroking patterns.

### Adding individual lines in the table { #individual-lines }
If you want to add a single horizontal or vertical line in your table, for
example to separate a group of rows, you can use the [`table.hline`] and
[`table.vline`] elements for horizontal and vertical lines, respectively. Add
them to the argument list of the `table` function just like you would add
individual cells and a header.

Let's take a look at the following example from the reference:

```example
#set table.hline(stroke: 0.6pt)

#table(
  stroke: none,
  columns: (auto, 1fr),
  // Morning schedule abridged.
  [14:00], [Talk: Tracked Layout],
  [15:00], [Talk: Automations],
  [16:00], [Workshop: Tables],
  table.hline(),
  [19:00], [Day 1 Attendee Mixer],
)
```

In this example, you can see that we have placed a call to `table.hline` between
the cells, producing a horizontal line at that spot. We also used a set rule on
the element to reduce its stroke width to make it fit better with the weight of
the font.

By default, Typst places horizontal and vertical lines after the current row or
column, depending on their position in the argument list. You can also manually
move them to a different position by adding the `y` (for `hline`) or `x` (for
`vline`) argument. For example, the code below would produce the same result:

```typ
#set table.hline(stroke: 0.6pt)

#table(
  stroke: none,
  columns: (auto, 1fr),
  // Morning schedule abridged.
  table.hline(y: 3),
  [14:00], [Talk: Tracked Layout],
  [15:00], [Talk: Automations],
  [16:00], [Workshop: Tables],
  [19:00], [Day 1 Attendee Mixer],
)
```

Let's imagine you are working with a template that shows none of the table
strokes except for one between the first and second row. Now, since you have one
table that also has labels in the first column, you want to add an extra
vertical line to it. However, you do not want this vertical line to cross into
the top row. You can achieve this with the `start` argument:

```example
>>> #set page(width: 12cm)
>>> #show table.cell.where(y: 0): strong
>>> #set table(stroke: (_, y) => if y == 0 { (bottom: 1pt) })
// Base template already configured tables, but we need some
// extra configuration for this table.
#{
  set table(align: (x, _) => if x == 0 { left } else { right })
  show table.cell.where(x: 0): smallcaps
  table(
    columns: (auto, 1fr, 1fr, 1fr),
    table.vline(x: 1, start: 1),
    table.header[Trainset][Top Speed][Length][Weight],
    [TGV Réseau], [320 km/h], [200m], [383t],
    [ICE 403], [330 km/h], [201m], [409t],
    [Shinkansen N700], [300 km/h], [405m], [700t],
  )
}
```

In this example, we have added `table.vline` at the start of our positional
argument list. But because the line is not supposed to go to the left of the
first column, we specified the `x` argument as `{1}`. We also set the `start`
argument to `{1}` so that the line does only start after the first row.

The example also contains two more things: We use the align argument with a
function to right-align the data in all but the first column and use a show rule
to make the first column of table cells appear in small capitals. Because these
styles are specific to this one table, we put everything into a [code
block]($scripting/#blocks), so that the styling does not affect any further
tables.

### Overriding the strokes of a single cell { #stroke-override }
Imagine you want to change the stroke around a single cell. Maybe your cell is
very important and needs highlighting! For this scenario, there is the
[`table.cell` function]($table.cell). Instead of adding your content directly in
the argument list of the table, you wrap it in a `table.cell` call. Now, you can
use `table.cell`'s argument list to override the table properties, such as the
stroke, for this cell only.

Here's an example with a matrix of two of the Big Five personality factors, with
one intersection highlighted.

```example
>>> #set page(width: 16cm)
#table(
  columns: 3,
  stroke: (x: none),

  table.header[][*High Neuroticism*][*Low Neuroticism*],

  [*High Agreeableness*],
  table.cell(stroke: orange + 2pt)[
    _Sensitive_ \ Prone to emotional distress but very empathetic.
  ],
  [_Compassionate_ \ Caring and stable, often seen as a supportive figure.],

  [*Low Agreeableness*],
  [_Contentious_ \ Competitive and easily agitated.],
  [_Detached_ \ Independent and calm, may appear aloof.],
)
```

Above, you can see that we used the `table.cell` element in the table's argument
list and passed the cell content to it. We have used its `stroke` argument to
set a wider orange stroke. Despite the fact that we disabled vertical strokes on
the table, the orange stroke appeared on all sides of the modified cell, showing
that the table's stroke configuration is overwritten.

### Complex document-wide stroke customization { #stroke-functions }
This section explains how to customize all lines at once in one or multiple
tables. This allows you to draw only the first horizontal line or omit the outer
lines, without knowing how many cells the table has. This is achieved by
providing a function to the table's `stroke` parameter. The function should
return a stroke given the zero-indexed x and y position of the current cell. You
should only need these functions if you are a template author, do not use a
template, or need to heavily customize your tables. Otherwise, your template
should set appropriate default table strokes.

For example, this is a set rule that draws all horizontal lines except for the
very first and last line.

```example
#show table.cell.where(x: 0): set text(style: "italic")
#show table.cell.where(y: 0): set text(style: "normal", weight: "bold")
#set table(stroke: (_, y) => if y > 0 { (top: 0.8pt) })

#table(
  columns: 3,
  align: center + horizon,
  table.header[Technique][Advantage][Drawback],
  [Diegetic], [Immersive], [May be contrived],
  [Extradiegetic], [Breaks immersion], [Obtrusive],
  [Omitted], [Fosters engagement], [May fracture audience],
)
```

In the set rule, we pass a function that receives two arguments, assigning the
vertical coordinate to `y` and discarding the horizontal coordinate. It then
returns a stroke dictionary with a `{0.8pt}` top stroke for all but the first
line. The cells in the first line instead implicitly receive `{none}` as the
return value. You can easily modify this function to just draw the inner
vertical lines instead as `{(x, _) => if x > 0 { (left: 0.8pt) }}`.

Let's try a few more stroking functions. The next function will only draw a line
below the first row:

```example
>>> #show table.cell: it => if it.x == 0 and it.y > 0 {
>>>   set text(style: "italic")
>>>   it
>>> } else {
>>>   it
>>> }
>>>
>>> #show table.cell.where(y: 0): strong
#set table(stroke: (_, y) => if y == 0 { (bottom: 1pt) })

<<< // Table as seen above
>>> #table(
>>>   columns: 3,
>>>   align: center + horizon,
>>>   table.header[Technique][Advantage][Drawback],
>>>   [Diegetic], [Immersive], [May be contrived],
>>>   [Extradiegetic], [Breaks immersion], [Obtrusive],
>>>   [Omitted], [Fosters engagement], [May fracture audience],
>>> )
```

If you understood the first example, it becomes obvious what happens here. We
check if we are in the first row. If so, we return a bottom stroke. Otherwise,
we'll return `{none}` implicitly.

The next example shows how to draw all but the outer lines:

```example
>>> #show table.cell: it => if it.x == 0 and it.y > 0 {
>>>   set text(style: "italic")
>>>   it
>>> } else {
>>>   it
>>> }
>>>
>>> #show table.cell.where(y: 0): strong
#set table(stroke: (x, y) => (
  left: if x > 0 { 0.8pt },
  top: if y > 0 { 0.8pt },
))

<<< // Table as seen above
>>> #table(
>>>   columns: 3,
>>>   align: center + horizon,
>>>   table.header[Technique][Advantage][Drawback],
>>>   [Diegetic], [Immersive], [May be contrived],
>>>   [Extradiegetic], [Breaks immersion], [Obtrusive],
>>>   [Omitted], [Fosters engagement], [May fracture audience],
>>> )
```

This example uses both the `x` and `y` coordinates. It omits the left stroke in
the first column and the top stroke in the first row. The right and bottom lines
are not drawn.

Finally, here is a table that draws all lines except for the vertical lines in
the first row and horizontal lines in the table body. It looks a bit like a
calendar.

```example
>>> #show table.cell: it => if it.x == 0 and it.y > 0 {
>>>   set text(style: "italic")
>>>   it
>>> } else {
>>>   it
>>> }
>>>
>>> #show table.cell.where(y: 0): strong
#set table(stroke: (x, y) => (
  left: if x == 0 or y > 0 { 1pt } else { 0pt },
  right: 1pt,
  top: if y <= 1 { 1pt } else { 0pt },
  bottom: 1pt,
))

<<< // Table as seen above
>>> #table(
>>>   columns: 3,
>>>   align: center + horizon,
>>>   table.header[Technique][Advantage][Drawback],
>>>   [Diegetic], [Immersive], [May be contrived],
>>>   [Extradiegetic], [Breaks immersion], [Obtrusive],
>>>   [Omitted], [Fosters engagement], [May fracture audience],
>>> )
```

This example is a bit more complex. We start by drawing all the strokes on the
right of the cells. But this means that we have drawn strokes in the top row,
too, and we don't need those! We use the fact that `left` will override `right`
and only draw the left line if we are not in the first row or if we are in the
first column. In all other cases, we explicitly remove the left line. Finally,
we draw the horizontal lines by first setting the bottom line and then for the
first two rows with the `top` key, suppressing all other top lines. The last
line appears because there is no `top` line that could suppress it.

### How to achieve a double line? { #double-stroke }
Typst does not yet have a native way to draw double strokes, but there are
multiple ways to emulate them, for example with [tilings]($tiling). We will
show a different workaround in this section: Table gutters.

Tables can space their cells apart using the `gutter` argument. When a gutter is
applied, a stroke is drawn on each of the now separated cells. We can
selectively add gutter between the rows or columns for which we want to draw a
double line. The `row-gutter` and `column-gutter` arguments allow us to do this.
They accept arrays of gutter values. Let's take a look at an example:

```example
#table(
  columns: 3,
  stroke: (x: none),
  row-gutter: (2.2pt, auto),
  table.header[Date][Exercise Type][Calories Burned],
  [2023-03-15], [Swimming], [400],
  [2023-03-17], [Weightlifting], [250],
  [2023-03-18], [Yoga], [200],
)
```

We can see that we used an array for `row-gutter` that specifies a `{2.2pt}` gap
between the first and second row. It then continues with `auto` (which is the
default, in this case `{0pt}` gutter) which will be the gutter between all other
rows, since it is the last entry in the array.

## How to align the contents of the cells in my table? { #alignment }
You can use multiple mechanisms to align the content in your table. You can
either use the `table` function's `align` argument to set the alignment for your
whole table (or use it in a set rule to set the alignment for tables throughout
your document) or the [`align`] function (or `table.cell`'s `align` argument) to
override the alignment of a single cell.

When using the `table` function's align argument, you can choose between three
methods to specify an [alignment]:

- Just specify a single alignment like `right` (aligns in the top-right corner)
  or `center + horizon` (centers all cell content). This changes the alignment
  of all cells.
- Provide an array. Typst will cycle through this array for each column.
- Provide a function that is passed the horizontal `x` and vertical `y`
  coordinate of a cell and returns an alignment.

For example, this travel itinerary right-aligns the day column and left-aligns
everything else by providing an array in the `align` argument:

```example
>>> #set page(width: 12cm)
#set text(font: "IBM Plex Sans")
#show table.cell.where(y: 0): set text(weight: "bold")

#table(
  columns: 4,
  align: (right, left, left, left),
  fill: (_, y) => if calc.odd(y) { green.lighten(90%) },
  stroke: none,

  table.header[Day][Location][Hotel or Apartment][Activities],
  [1], [Paris, France], [Hôtel de l'Europe], [Arrival, Evening River Cruise],
  [2], [Paris, France], [Hôtel de l'Europe], [Louvre Museum, Eiffel Tower],
  [3], [Lyon, France], [Lyon City Hotel], [City Tour, Local Cuisine Tasting],
  [4], [Geneva, Switzerland], [Lakeview Inn], [Lake Geneva, Red Cross Museum],
  [5], [Zermatt, Switzerland], [Alpine Lodge], [Visit Matterhorn, Skiing],
)
```

However, this example does not yet look perfect — the header cells should be
bottom-aligned. Let's use a function instead to do so:

```example
>>> #set page(width: 12cm)
#set text(font: "IBM Plex Sans")
#show table.cell.where(y: 0): set text(weight: "bold")

#table(
  columns: 4,
  align: (x, y) =>
    if x == 0 { right } else { left } +
    if y == 0 { bottom } else { top },
  fill: (_, y) => if calc.odd(y) { green.lighten(90%) },
  stroke: none,

  table.header[Day][Location][Hotel or Apartment][Activities],
  [1], [Paris, France], [Hôtel de l'Europe], [Arrival, Evening River Cruise],
  [2], [Paris, France], [Hôtel de l'Europe], [Louvre Museum, Eiffel Tower],
<<<  // ... remaining days omitted
>>>  [3], [Lyon, France], [Lyon City Hotel], [City Tour, Local Cuisine Tasting],
>>>  [4], [Geneva, Switzerland], [Lakeview Inn], [Lake Geneva, Red Cross Museum],
>>>  [5], [Zermatt, Switzerland], [Alpine Lodge], [Visit Matterhorn, Skiing],
)
```

In the function, we calculate a horizontal and vertical alignment based on
whether we are in the first column (`{x == 0}`) or the first row (`{y == 0}`).
We then make use of the fact that we can add horizontal and vertical alignments
with `+` to receive a single, two-dimensional alignment.

You can find an example of using `table.cell` to change a single cell's
alignment on [its reference page]($table.cell).

## How to merge cells? { #merge-cells }
When a table contains logical groupings or the same data in multiple adjacent
cells, merging multiple cells into a single, larger cell can be advantageous.
Another use case for cell groups are table headers with multiple rows: That way,
you can group for example a sales data table by quarter in the first row and by
months in the second row.

A merged cell spans multiple rows and/or columns. You can achieve it with the
[`table.cell`] function's `rowspan` and `colspan` arguments: Just specify how
many rows or columns you want your cell to span.

The example below contains an attendance calendar for an office with in-person
and remote days for each team member. To make the table more glanceable, we
merge adjacent cells with the same value:

```example
>>> #set page(width: 22cm)
#let ofi = [Office]
#let rem = [_Remote_]
#let lea = [*On leave*]

#show table.cell.where(y: 0): set text(
  fill: white,
  weight: "bold",
)

#table(
  columns: 6 * (1fr,),
  align: (x, y) => if x == 0 or y == 0 { left } else { center },
  stroke: (x, y) => (
    // Separate black cells with white strokes.
    left: if y == 0 and x > 0 { white } else { black },
    rest: black,
  ),
  fill: (_, y) => if y == 0 { black },

  table.header(
    [Team member],
    [Monday],
    [Tuesday],
    [Wednesday],
    [Thursday],
    [Friday]
  ),
  [Evelyn Archer],
    table.cell(colspan: 2, ofi),
    table.cell(colspan: 2, rem),
    ofi,
  [Lila Montgomery],
    table.cell(colspan: 5, lea),
  [Nolan Pearce],
    rem,
    table.cell(colspan: 2, ofi),
    rem,
    ofi,
)
```

In the example, we first define variables with "Office", "Remote", and "On
leave" so we don't have to write these labels out every time. We can then use
these variables in the table body either directly or in a `table.cell` call if
the team member spends multiple consecutive days in office, remote, or on leave.

The example also contains a black header (created with `table`'s `fill`
argument) with white strokes (`table`'s `stroke` argument) and white text (set
by the `table.cell` set rule). Finally, we align all the content of all table
cells in the body in the center. If you want to know more about the functions
passed to `align`, `stroke`, and `fill`, you can check out the sections on
[alignment], [strokes](#stroke-functions), and [striped
tables](#fills).

This table would be a great candidate for fully automated generation from an
external data source! Check out the [section about importing
data](#importing-data) to learn more about that.

## How to rotate a table? { #rotate-table }
When tables have many columns, a portrait paper orientation can quickly get
cramped. Hence, you'll sometimes want to switch your tables to landscape
orientation. There are two ways to accomplish this in Typst:

- If you want to rotate only the table but not the other content of the page and
  the page itself, use the [`rotate` function]($rotate) with the `reflow`
  argument set to `{true}`.
- If you want to rotate the whole page the table is on, you can use the [`page`
  function]($page) with its `flipped` argument set to `{true}`. The header,
  footer, and page number will now also appear on the long edge of the page.
  This has the advantage that the table will appear right side up when read on a
  computer, but it also means that a page in your document has different
  dimensions than all the others, which can be jarring to your readers.

Below, we will demonstrate both techniques with a student grade book table.

First, we will rotate the table on the page. The example also places some text
on the right of the table.

```example
#set page("a5", columns: 2, numbering: "— 1 —")
>>> #set page(margin: auto)
#show table.cell.where(y: 0): set text(weight: "bold")

#rotate(
  -90deg,
  reflow: true,

  table(
    columns: (1fr,) + 5 * (auto,),
    inset: (x: 0.6em,),
    stroke: (_, y) => (
      x: 1pt,
      top: if y <= 1 { 1pt } else { 0pt },
      bottom: 1pt,
    ),
    align: (left, right, right, right, right, left),

    table.header(
      [Student Name],
      [Assignment 1], [Assignment 2],
      [Mid-term], [Final Exam],
      [Total Grade],
    ),
    [Jane Smith], [78%], [82%], [75%], [80%], [B],
    [Alex Johnson], [90%], [95%], [94%], [96%], [A+],
    [John Doe], [85%], [90%], [88%], [92%], [A],
    [Maria Garcia], [88%], [84%], [89%], [85%], [B+],
    [Zhang Wei], [93%], [89%], [90%], [91%], [A-],
    [Marina Musterfrau], [96%], [91%], [74%], [69%], [B-],
  ),
)

#lorem(80)
```


What we have here is a two-column document on ISO A5 paper with page numbers on
the bottom. The table has six columns and contains a few customizations to
[stroke](#strokes), alignment and spacing. But the most important part is that
the table is wrapped in a call to the `rotate` function with the `reflow`
argument being `{true}`. This will make the table rotate 90 degrees
counterclockwise. The reflow argument is needed so that the table's rotation
affects the layout. If it was omitted, Typst would lay out the page as if the
table was not rotated (`{true}` might become the default in the future).

The example also shows how to produce many columns of the same size: To the
initial `{1fr}` column, we add an array with five `{auto}` items that we
create by multiplying an array with one `{auto}` item by five. Note that arrays
with just one item need a trailing comma to distinguish them from merely
parenthesized expressions.

The second example shows how to rotate the whole page, so that the table stays
upright:

```example
#set page("a5", numbering: "— 1 —")
>>> #set page(margin: auto)
#show table.cell.where(y: 0): set text(weight: "bold")

#page(flipped: true)[
  #table(
    columns: (1fr,) + 5 * (auto,),
    inset: (x: 0.6em,),
    stroke: (_, y) => (
      x: 1pt,
      top: if y <= 1 { 1pt } else { 0pt },
      bottom: 1pt,
    ),
    align: (left, right, right, right, right, left),

    table.header(
      [Student Name],
      [Assignment 1], [Assignment 2],
      [Mid-term], [Final Exam],
      [Total Grade],
    ),
    [Jane Smith], [78%], [82%], [75%], [80%], [B],
    [Alex Johnson], [90%], [95%], [94%], [96%], [A+],
    [John Doe], [85%], [90%], [88%], [92%], [A],
    [Maria Garcia], [88%], [84%], [89%], [85%], [B+],
    [Zhang Wei], [93%], [89%], [90%], [91%], [A-],
    [Marina Musterfrau], [96%], [91%], [74%], [69%], [B-],
  )

  #pad(x: 15%, top: 1.5em)[
    = Winter 2023/24 results
    #lorem(80)
  ]
]
```

Here, we take the same table and the other content we want to set with it and
put it into a call to the [`page`] function while supplying `{true}` to the
`flipped` argument. This will instruct Typst to create new pages with width and
height swapped and place the contents of the function call onto a new page.
Notice how the page number is also on the long edge of the paper now. At the
bottom of the page, we use the [`pad`] function to constrain the width of the
paragraph to achieve a nice and legible line length.

## How to break a table across pages? { #table-across-pages }
It is best to contain a table on a single page. However, some tables just have
many rows, so breaking them across pages becomes unavoidable. Fortunately, Typst
supports breaking tables across pages out of the box. If you are using the
[`table.header`] and [`table.footer`] functions, their contents will be repeated
on each page as the first and last rows, respectively. If you want to disable
this behavior, you can set `repeat` to `{false}` on either of them.

If you have placed your table inside of a [figure], it becomes unable to break
across pages by default. However, you can change this behavior. Let's take a
look:

```example
#set page(width: 9cm, height: 6cm)
#show table.cell.where(y: 0): set text(weight: "bold")
#show figure: set block(breakable: true)

#figure(
  caption: [Training regimen for Marathon],
  table(
    columns: 3,
    fill: (_, y) => if y == 0 { gray.lighten(75%) },

    table.header[Week][Distance (km)][Time (hh:mm:ss)],
    [1], [5],  [00:30:00],
    [2], [7],  [00:45:00],
    [3], [10], [01:00:00],
    [4], [12], [01:10:00],
    [5], [15], [01:25:00],
    [6], [18], [01:40:00],
    [7], [20], [01:50:00],
    [8], [22], [02:00:00],
    [...], [...], [...],
    table.footer[_Goal_][_42.195_][_02:45:00_],
  )
)
```

A figure automatically produces a [block] which cannot break by default.
However, we can reconfigure the block of the figure using a show rule to make it
`breakable`. Now, the figure spans multiple pages with the headers and footers
repeating.

## How to import data into a table? { #importing-data }
Often, you need to put data that you obtained elsewhere into a table. Sometimes,
this is from Microsoft Excel or Google Sheets, sometimes it is from a dataset
on the web or from your experiment. Fortunately, Typst can load many [common
file formats]($category/data-loading), so you can use scripting to include their
data in a table.

The most common file format for tabular data is CSV. You can obtain a CSV file
from Excel by choosing "Save as" in the _File_ menu and choosing the file format
"CSV UTF-8 (Comma-delimited) (.csv)". Save the file and, if you are using the
web app, upload it to your project.

In our case, we will be building a table about Moore's Law. For this purpose, we
are using a statistic with [how many transistors the average microprocessor
consists of per year from Our World in
Data](https://ourworldindata.org/grapher/transistors-per-microprocessor). Let's
start by pressing the "Download" button to get a CSV file with the raw data.

Be sure to move the file to your project or somewhere Typst can see it, if you
are using the CLI. Once you did that, we can open the file to see how it is
structured:

```csv
Entity,Code,Year,Transistors per microprocessor
World,OWID_WRL,1971,2308.2417
World,OWID_WRL,1972,3554.5222
World,OWID_WRL,1974,6097.5625
```

The file starts with a header and contains four columns: Entity (which is to
whom the metric applies), Code, the year, and the number of transistors per
microprocessor. Only the last two columns change between each row, so we can
disregard "Entity" and "Code".

First, let's start by loading this file with the [`csv`] function. It accepts
the file name of the file we want to load as a string argument:

```typ
#let moore = csv("moore.csv")
```

We have loaded our file (assuming we named it `moore.csv`) and [bound
it]($scripting/#bindings) to the new variable `moore`. This will not produce any
output, so there's nothing to see yet. If we want to examine what Typst loaded,
we can either hover the name of the variable in the web app or print some items
from the array:

```example
#let moore = csv("moore.csv")

#moore.slice(0, 3)
```

With the arguments `{(0, 3)}`, the [`slice`]($array.slice) method returns the
first three items in the array (with the indices 0, 1, and 2). We can see that
each row is its own array with one item per cell.

Now, let's write a loop that will transform this data into an array of cells
that we can use with the table function.

```example
#let moore = csv("moore.csv")

#table(
  columns: 2,
  ..for (.., year, count) in moore {
    (year, count)
  }
)
```

The example above uses a for loop that iterates over the rows in our CSV file
and returns an array for each iteration. We use the for loop's
[destructuring]($scripting/#bindings) capability to discard all but the last two
items of each row. We then create a new array with just these two. Because Typst
will concatenate the array results of all the loop iterations, we get a
one-dimensional array in which the year column and the number of transistors
alternate. We can then insert the array as cells. For this we use the [spread
operator]($arguments/#spreading) (`..`). By prefixing an array, or, in our case
an expression that yields an array, with two dots, we tell Typst that the
array's items should be used as positional arguments.

Alternatively, we can also use the [`map`]($array.map), [`slice`]($array.slice),
and [`flatten`]($array.flatten) array methods to write this in a more functional
style:

```typ
#let moore = csv("moore.csv")

#table(
   columns: 2,
   ..moore.map(m => m.slice(2, 4)).flatten(),
)
```

This example renders the same as the previous one, but we first load the CSV and
then transform each row using `map`. The function we pass to `map` is applied to
each row of the data and returns a new array that replaces the original row.
Here, we use `{.slice(2, 4)}` to extract only the third and fourth column, since
these are the ones we want to keep. Because `moore` is a two-dimensional array
(each row is itself an array), the result of mapping is still a nested array.
The `flatten` function converts this nested structure into a one-dimensional
array, which is required when spreading the data into the `table` function.
Finally, we explicitly specify `{columns: 2}` because we are keeping exactly two
columns from each row.

Now that we have nice code for our table, we should try to also make the table
itself nice! The transistor counts go from millions in 1995 to trillions in 2021
and changes are difficult to see with so many digits. We could try to present
our data logarithmically to make it more digestible:

```example
#let moore = csv("moore.csv")
#let moore-log = moore.slice(1).map(m => {
  let (.., year, count) = m
  let log = calc.log(float(count))
  let rounded = str(calc.round(log, digits: 2))
  (year, rounded)
})

#show table.cell.where(x: 0): strong

#table(
   columns: moore-log.first().len(),
   align: right,
   fill: (_, y) => if calc.odd(y) { rgb("D7D9E0") },
   stroke: none,

   table.header[Year][Transistor count ($log_10$)],
   table.hline(stroke: rgb("4D4C5B")),
   ..moore-log.flatten(),
)
```

In this example, we first drop the header row from the data since we are adding
our own. Then, we discard all but the last two columns as above. We do this by
[destructuring]($scripting/#bindings) the array `m`, discarding all but the two
last items. We then convert the string in `count` to a floating point number,
calculate its logarithm and store it in the variable `log`. Finally, we round it
to two digits, convert it to a string, and store it in the variable `rounded`.
Then, we return an array with `year` and `rounded` that replaces the original
row. In our table, we have added our custom header that tells the reader that
we've applied a logarithm to the values. Then, we spread the flattened data as
above.

We also styled the table with [stripes](#fills), a
[horizontal line](#individual-lines) below the first row, [aligned](#alignment)
everything to the right, and emboldened the first column. Click on the links to
go to the relevant guide sections and see how it's done!

## What if I need the table function for something that isn't a table? { #table-and-grid }
Tabular layouts of content can be useful not only for matrices of closely
related data, like shown in the examples throughout this guide, but also for
presentational purposes. Typst differentiates between grids that are for layout
and presentational purposes only and tables, in which the arrangement of the
cells itself conveys information.

To make this difference clear to other software and allow templates to heavily
style tables, Typst has two functions for grid and table layout:

- The [`table`] function explained throughout this guide which is intended for
  tabular data.
- The [`grid`] function which is intended for presentational purposes and page
  layout.

Both elements work the same way and have the same arguments. You can apply
everything you have learned about tables in this guide to grids. There are only
three differences:

- You'll need to use the [`grid.cell`], [`grid.vline`], and [`grid.hline`]
  elements instead of [`table.cell`], [`table.vline`], and [`table.hline`].
- The grid has different defaults: It draws no strokes by default and has no
  spacing (`inset`) inside of its cells.
- Elements like `figure` do not react to grids since they are supposed to have
  no semantical bearing on the document structure.


---

## welcome.md

---
description: Guides for Typst.
---

# Guides
Welcome to the Guides section! Here, you'll find helpful material for specific
user groups or use cases. Please see the list below for the available guides.
Feel free to propose other topics for guides!

## List of Guides
- [Guide for LaTeX Users]($guides/for-latex-users)
- [Page Setup Guide]($guides/page-setup)
- [Table Guide]($guides/tables)
- [Accessibility Guide]($guides/accessibility)


---

