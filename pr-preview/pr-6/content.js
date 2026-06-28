// Landing-page content (CONTENT.md §3, §4). Data-driven so a future lecture or
// exhibition is "edit this file + swap the theme" — with ZERO converter changes
// (CONTENT.md §2, §6). Nothing here imports from or reaches into /converter/**.
//
// Each history entry is a content object: { id, title, body (markdown), media[],
// references[] }. `references` holds ids into the `references` list below; the
// footer reproduces the full citations (CONTENT.md §3, §4).

export const content = {
  lang: 'en',

  // Which theme file the page loads. Switching exhibitions = swapping this for
  // another theme-<name>.css (CONTENT.md §5, §6).
  theme: 'theme-museo-ruso.css',

  // 3.1 — Hero.
  hero: {
    eyebrow: 'Museo Ruso de Málaga · Lecture & Exposition',
    title: 'Stereoscopy',
    subtitle: 'Two eyes, one world, and the long road to 3D',
    hook:
      'How a Victorian curiosity about *why we see depth* grew into stereo cards, ' +
      'View-Masters, Soviet glasses-free cinema — and the converter below, which ' +
      'turns a single flat photo into 3D in your browser.',
    cta: { label: 'Try the converter', target: '#converter-section' },
  },

  // 3.2 — The converter section (the app is mounted here by landing.js).
  converter: {
    id: 'converter-section',
    title: 'Try it: turn a photo into 3D',
    intro:
      'Pick any existing photo and the converter builds a stereoscopic view from ' +
      'it — entirely on your device, no account required. Everything runs in your ' +
      'browser; your image never leaves it.',
    note:
      'In **AI mode** you can also turn 2D artwork and paintings into 3D, tune the ' +
      'depth, or make just one subject pop out while the rest stays flat.',
  },

  // 3.3 / §4 — History & science (lecture companion, referenced).
  //
  // Editorial note (§4): the Queen-Victoria / Great-Exhibition popularization is
  // presented as the traditional, widely-repeated account (it rests largely on
  // Brewster's own telling); what is independently documented is her later
  // purchase from Claudet (1852). The closing "under the hood" section documents
  // the converter's own pipeline (depth estimation → DIBR → Dubois anaglyph).
  sections: [
    {
      id: 'stereopsis',
      title: 'The discovery of stereopsis & the first stereoscope',
      body:
        'In 1838 **Charles Wheatstone** read a paper to the Royal Society on ' +
        'binocular vision, showing that the brain fuses the slightly different ' +
        'images from our two eyes into a single sensation of depth. To prove it he ' +
        'built the **mirror (reflecting) stereoscope**, presenting a separate ' +
        'drawing to each eye.\n\n' +
        'Crucially this *predates photography*: the depth illusion comes from ' +
        '**binocular disparity** alone — the horizontal offset between the two ' +
        'views — not from any photographic trick. June 21 is still marked ' +
        'informally as "Stereoscopy Day."',
      media: [],
      references: ['wheatstone1838'],
    },
    {
      id: 'brewster',
      title: 'Brewster & the Great Exhibition (1849–1851)',
      body:
        '**David Brewster** designed a compact **lenticular** stereoscope — ' +
        'handheld, using lenses/prisms instead of mirrors — and **Jules Duboscq** ' +
        'built it in Paris. It was shown at the **1851 Great Exhibition** in the ' +
        'Crystal Palace, where (in the traditional account, which rests largely on ' +
        "Brewster's own telling) **Queen Victoria's** delight sparked a craze. " +
        'What is independently documented is her later purchase of a stereoscope ' +
        'from **Claudet in 1852**.\n\n' +
        'Either way, the device took off — soon "no home without a stereoscope."',
      media: [],
      references: ['brewster', 'queenvictoria'],
    },
    {
      id: 'holmes',
      title: 'Holmes & the stereograph craze (1859 →)',
      body:
        '**Oliver Wendell Holmes** designed a cheap, open hand-viewer and ' +
        '**deliberately left it unpatented** so anyone could make one. Paired with ' +
        'standardized **stereo cards** — the two photos spaced about **7 cm** ' +
        'apart, roughly matching the eyes — it made stereoscopy the **first mass ' +
        'photographic medium**: a Victorian "VR" found in parlours everywhere.',
      media: [],
      references: ['holmes'],
    },
    {
      id: 'anaglyph',
      title: 'The anaglyph (1853 / 1891)',
      body:
        'The **anaglyph** encodes the two eye-views in different colours, ' +
        'separated by coloured glasses. **Wilhelm Rollmann** described the ' +
        'red/blue line method in **Stargard, 1853**; **Joseph D’Almeida** ' +
        'projected anaglyphs in **1858**; and **Louis Ducos du Hauron** made ' +
        'printed photographic anaglyphs in **1891**.\n\n' +
        'Modern glasses are **red/cyan**. The trade-offs are **ghosting** and ' +
        '**retinal rivalry** — largely tamed by the **Dubois** colour matrix, ' +
        'which is exactly what the converter above uses by default.',
      media: [],
      references: ['rollmann', 'ducosduhauron', 'dubois'],
    },
    {
      id: 'polarized',
      title: 'Polarized 3D & the View-Master (1939)',
      body:
        '**Edwin Land**’s Polaroid **polarizers** separate the two views by ' +
        'polarization rather than colour, so they **preserve full colour**. ' +
        'Polarized 3D films appeared in **1939**, the same year as the **' +
        'View-Master** — whose reels later saw **WWII training** use. This is the ' +
        'lineage that leads to modern cinema and VR 3D.',
      media: [],
      references: ['polaroid', 'viewmaster'],
    },
    {
      id: 'brian-may-lsc',
      title: 'Brian May & the London Stereoscopic Company revival (2009 →)',
      body:
        '**Brian May** — lead guitarist of **Queen** and holder of a PhD in ' +
        'Astrophysics from **Imperial College London** (2007) — revived the ' +
        '**London Stereoscopic Company** (LSC) around **2009**. Originally ' +
        'founded in **1854**, the Victorian LSC became the world\'s leading ' +
        'publisher of stereoviews, issuing over **100,000 titles** before ' +
        'eventually closing.\n\n' +
        'Working with researcher **Elena Vidal** and later **Denis Pellerin**, ' +
        'May republished rare stereoview collections in richly annotated books, ' +
        'each bundled with an **OWL Stereoscope** — a compact, affordable card-' +
        'viewer of his own design that requires no special equipment. Titles ' +
        'include *A Village Lost and Found* (2009), which uses T.R. Williams\'s ' +
        '1850s views to recover a vanished English village scene by scene, and ' +
        '*Diableries: Stereoscopic Adventures in Hell* (2013), presenting rare ' +
        'French skeletal-fantasy cards from the 1860s.\n\n' +
        'May argues that 3D photographs are uniquely powerful historical documents ' +
        '— "people in stereo are far more *real* than people in a flat photograph" ' +
        '— and through the LSC he continues to advocate for the preservation and ' +
        'public accessibility of stereoscopic heritage. ' +
        '[London Stereoscopic Company ↗](https://www.londonstereo.com/modern_stereos_brianmay.html)',
      media: [],
      references: ['londonstereo'],
    },
    {
      id: 'perception',
      title: 'How human depth perception works',
      body:
        'Depth from two eyes comes from **binocular disparity** plus ' +
        '**convergence** (how far the eyes turn inward). The average adult ' +
        '**interpupillary distance (IPD)** is about **63 mm** (roughly ' +
        '50–75 mm), and stereo content is authored for ~**63–65 mm**.\n\n' +
        'That is why a synthesized "second eye" is just a **small, IPD-scale ' +
        'lateral shift** — and why an AI prompt for the right-eye view asks for a ' +
        'viewpoint "**~6 cm to the right**."',
      media: [],
      references: ['ipd'],
    },
    {
      id: 'under-the-hood',
      title: 'Under the hood: how the converter works',
      body:
        'The converter ships **two interchangeable engines** — choose above.\n\n' +
        '**Local engine (on-device).** Runs entirely in your browser; your image ' +
        'never leaves the device. **Depth Anything V2** (~50 MB, WebGPU or ' +
        'WebAssembly via **transformers.js**) estimates a per-pixel depth map. A ' +
        '**DIBR** warp then synthesizes the second eye view by shifting each pixel ' +
        'horizontally in proportion to its depth ' +
        '(`Δx = parallax · (depth − convergence)`). The two views are finally ' +
        'merged into a **red/cyan anaglyph** using the **Dubois** colour matrix — ' +
        'the same lineage described above. ' +
        '[Source ↗](https://github.com/gaarutyunov/stereoscope/blob/main/converter/engine-local.js)\n\n' +
        '**AI engine (optional).** Sends your photo to an image model on ' +
        '**OpenRouter** together with a ' +
        '[system prompt](https://github.com/gaarutyunov/stereoscope/blob/main/converter/engine-openrouter.js#L17) ' +
        'that covers the full notion of anaglyph stereoscopy and instructs the ' +
        'model to output a single finished **red/cyan anaglyph** directly — there ' +
        'is no separate compositor step. You pay with your own credits over a ' +
        'secure OAuth connection.',
      media: [],
      references: ['depthanything', 'transformersjs', 'dubois'],
    },
  ],

  // 3.4 — About this lecture / credits.
  about: {
    id: 'about',
    title: 'About: Stereoscopy Day',
    body:
      'Built as a companion to **Stereoscopy Day** — *"Experiencia fotográfica ' +
      'en 3D"* — held at the **Colección del Museo Ruso** in Málaga on **21 ' +
      'June**, the date Charles Wheatstone presented his discoveries on ' +
      'stereoscopic vision to the Royal Society of London in **1838**. The day ' +
      'gathers photography historians and promoters — collector **Juan Antonio ' +
      'Fernández Rivero**, **Pepe Zapata** (director of *Play It Again*), with ' +
      'the **Centro de la Fotografía en Málaga** — around the idea that we still ' +
      'marvel at images, whether printed, digital, or in three dimensions. The ' +
      'history sections here trace stereoscopy from that 1838 experiment onward, ' +
      'and the converter lets visitors turn their own photos into 3D on the ' +
      'spot. Admission is free until capacity and the sessions are in Spanish — ' +
      'see the [event page](https://www.coleccionmuseoruso.es/event/stereoscopy-day/) ' +
      'for details.',
    credits: [
      { label: 'Event', value: 'Stereoscopy Day · Experiencia fotográfica en 3D' },
      { label: 'Venue', value: 'Colección del Museo Ruso, Málaga' },
      { label: 'Date', value: '21 June · 11:30–14:30' },
      { label: 'Admission', value: 'Free until capacity' },
      { label: 'Language', value: 'Spanish' },
    ],
  },

  // 3.5 — Footer: full references list reproduced here (CONTENT.md §3, §4).
  references: [
    {
      id: 'wheatstone1838',
      text: 'Charles Wheatstone, "Contributions to the Physiology of Vision — ' +
        'On Some Remarkable, and Hitherto Unobserved, Phenomena of Binocular ' +
        'Vision," Philosophical Transactions of the Royal Society, 1838.',
      url: 'https://en.wikipedia.org/wiki/Charles_Wheatstone',
    },
    {
      id: 'brewster',
      text: 'David Brewster, the lenticular stereoscope, and Jules Duboscq’s ' +
        'Paris-built instrument shown at the 1851 Great Exhibition.',
      url: 'https://en.wikipedia.org/wiki/David_Brewster',
    },
    {
      id: 'queenvictoria',
      text: 'The Great Exhibition popularization narrative (traditional account, ' +
        'after Brewster); Queen Victoria’s documented 1852 purchase from Antoine ' +
        'Claudet.',
      url: 'https://en.wikipedia.org/wiki/Stereoscope',
    },
    {
      id: 'holmes',
      text: 'Oliver Wendell Holmes, the unpatented open "Holmes" stereoscope ' +
        '(1859) and standardized stereo cards.',
      url: 'https://en.wikipedia.org/wiki/Stereoscope#Holmes_stereoscope',
    },
    {
      id: 'rollmann',
      text: 'Wilhelm Rollmann’s red/blue line anaglyph method (Stargard, 1853); ' +
        'Joseph d’Almeida’s 1858 projection.',
      url: 'https://en.wikipedia.org/wiki/Anaglyph_3D',
    },
    {
      id: 'ducosduhauron',
      text: 'Louis Ducos du Hauron, printed photographic anaglyphs, 1891.',
      url: 'https://en.wikipedia.org/wiki/Louis_Ducos_du_Hauron',
    },
    {
      id: 'dubois',
      text: 'Eric Dubois, "A Projection Method to Generate Anaglyph Stereo ' +
        'Images," ICASSP 2001 — the red/cyan colour matrix used by default here.',
      url: 'https://www.site.uottawa.ca/~edubois/anaglyph/',
    },
    {
      id: 'polaroid',
      text: 'Edwin Land / Polaroid polarizers and the 1939 polarized 3D films.',
      url: 'https://en.wikipedia.org/wiki/Polarized_3D_system',
    },
    {
      id: 'viewmaster',
      text: 'The View-Master (introduced 1939) and its WWII training use.',
      url: 'https://en.wikipedia.org/wiki/View-Master',
    },
    {
      id: 'londonstereo',
      text: 'Brian May & Elena Vidal, London Stereoscopic Company (revived c. 2009) — ' +
        'publisher of Victorian stereoview heritage books including ' +
        '*A Village Lost and Found* (2009) and *Diableries* (2013); ' +
        'creators of the OWL Stereoscope.',
      url: 'https://www.londonstereo.com/modern_stereos_brianmay.html',
    },
    {
      id: 'ipd',
      text: 'Interpupillary distance: average adult ≈ 63 mm (≈ 50–75 mm range); ' +
        'stereo content authored for ~63–65 mm.',
      url: 'https://en.wikipedia.org/wiki/Pupillary_distance',
    },
    {
      id: 'depthanything',
      text: 'Depth Anything V2 (Small, Apache-2.0) — monocular depth estimation ' +
        'run on-device as an fp16 ONNX model.',
      url: 'https://github.com/DepthAnything/Depth-Anything-V2',
    },
    {
      id: 'transformersjs',
      text: 'Hugging Face Transformers.js — in-browser machine-learning runtime ' +
        '(WebGPU / WebAssembly).',
      url: 'https://github.com/huggingface/transformers.js',
    },
    {
      id: 'event',
      text: 'Colección del Museo Ruso, Málaga — "Stereoscopy Day: Experiencia ' +
        'fotográfica en 3D," 21 June (admission free until capacity; in Spanish).',
      url: 'https://www.coleccionmuseoruso.es/event/stereoscopy-day/',
    },
  ],

  footer: {
    license:
      'Content licensed CC BY 4.0. The converter is a separate, brand-agnostic ' +
      'module (see SPEC.md).',
    links: [
      { label: 'Build spec (SPEC.md)', url: './SPEC.md' },
      { label: 'Content spec (CONTENT.md)', url: './CONTENT.md' },
      { label: 'Source on GitHub', url: 'https://github.com/gaarutyunov/stereoscope' },
    ],
  },
};
