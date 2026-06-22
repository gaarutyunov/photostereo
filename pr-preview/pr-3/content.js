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
    steps: [
      'Choose an existing photo (drag-and-drop or browse).',
      'Pick an engine — **Local** (free, offline, on-device depth) or **AI** ' +
        '(OpenRouter, paid with your own credits).',
      'Get a red/cyan **anaglyph** — put on red/cyan glasses to see it pop.',
    ],
    note:
      'In **AI mode** you can also turn 2D artwork and paintings into 3D, tune the ' +
      'depth, or make just one subject pop out while the rest stays flat.',
  },

  // 3.3 / §4 — History & science (lecture companion, referenced).
  //
  // Editorial note (§4): the Queen-Victoria / Great-Exhibition popularization is
  // presented as the traditional, widely-repeated account (it rests largely on
  // Brewster's own telling); what is independently documented is her later
  // purchase from Claudet (1852). A few technical figures (Stereokino screen
  // specs; NIKFI award date/wording) are flagged in-text for a primary-source
  // check before print.
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
      id: 'wigglegram',
      title: 'Glasses-free depth: parallax & the wigglegram',
      body:
        '**Motion parallax** — nearer things shifting more than far ones as the ' +
        'viewpoint moves — is itself a depth cue. **Wiggle stereoscopy** exploits ' +
        'it by rapidly **alternating the left and right views**: depth with **no ' +
        'glasses**, on **any screen**, and it even works for **one-eyed ' +
        'viewers**. The catch: it **can’t be printed**. A wiggle is the kind ' +
        'of glasses-free output this family of tools is built to deliver.',
      media: [],
      references: [],
    },
    {
      id: 'livephoto',
      title: 'Live Photos / Motion Photos as wiggle 3D',
      body:
        'A wiggle is, technically, a **still plus a short motion clip** — exactly ' +
        'the shape of phone "living" photos. An **Apple Live Photo** is a ' +
        'JPEG/HEIC paired with a ~3 s MOV tied by an asset id; a **Google Motion ' +
        'Photo** is a JPEG/HEIC with an **embedded MP4 via XMP**. A synthesized ' +
        'parallax sweep is precisely such a clip, so a **Google Motion Photo** is ' +
        'the closest "Live-Photo-like" artifact reproducible in a browser.',
      media: [],
      references: [],
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
      id: 'soviet-cinema',
      title: 'Russian / Soviet stereo cinema',
      body:
        'A natural anchor for a Russian-museum exhibition. **Semyon Ivanov** ' +
        'developed a **parallax-barrier, glasses-free** system (Stalin Prize, ' +
        '**1941**). Moscow’s **"Stereokino"** theatre opened to the public on ' +
        '**4 February 1941** with *Zemlya molodosti* ("Land of Youth"), and ' +
        '*Robinzon Kruzo* (**1947**) was an early glasses-free feature. Later, ' +
        '**NIKFI**’s **Stereo 70** format earned an Academy Sci/Tech award.\n\n' +
        '*(Stereokino screen specifications and the exact NIKFI award date/wording ' +
        'should be confirmed against a primary source before print.)*',
      media: [],
      references: ['ivanov', 'stereokino', 'stereo70'],
    },
  ],

  // 3.4 — About this lecture / credits.
  about: {
    id: 'about',
    title: 'About this lecture',
    body:
      'Presented as a lecture-and-exposition companion at the **Museo Ruso de ' +
      'Málaga**. The history sections trace stereoscopy from Wheatstone’s ' +
      '1838 experiment to Soviet glasses-free cinema; the converter lets visitors ' +
      'turn their own photos into 3D on the spot.',
    credits: [
      { label: 'Venue', value: 'Museo Ruso de Málaga' },
      { label: 'Format', value: 'Lecture & exposition' },
    ],
  },

  // 3.5 — Footer: full references list reproduced here (CONTENT.md §3, §4).
  references: [
    {
      id: 'wheatstone1838',
      text: 'Charles Wheatstone, “Contributions to the Physiology of Vision — ' +
        'On Some Remarkable, and Hitherto Unobserved, Phenomena of Binocular ' +
        'Vision,” Philosophical Transactions of the Royal Society, 1838.',
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
      text: 'Oliver Wendell Holmes, the unpatented open “Holmes” stereoscope ' +
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
      text: 'Eric Dubois, “A Projection Method to Generate Anaglyph Stereo ' +
        'Images,” ICASSP 2001 — the red/cyan colour matrix used by default here.',
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
      id: 'ipd',
      text: 'Interpupillary distance: average adult ≈ 63 mm (≈ 50–75 mm range); ' +
        'stereo content authored for ~63–65 mm.',
      url: 'https://en.wikipedia.org/wiki/Pupillary_distance',
    },
    {
      id: 'ivanov',
      text: 'Semyon Ivanov’s parallax-barrier glasses-free stereo cinema system ' +
        '(Stalin Prize, 1941).',
      url: 'https://en.wikipedia.org/wiki/Stereoscopy#History',
    },
    {
      id: 'stereokino',
      text: 'Moscow “Stereokino” theatre, public opening 4 Feb 1941 with Zemlya ' +
        'molodosti; Robinzon Kruzo (1947). [Screen specs: verify primary source.]',
      url: 'https://en.wikipedia.org/wiki/Stereo_cinema',
    },
    {
      id: 'stereo70',
      text: 'NIKFI Stereo 70 format and its Academy Scientific/Technical ' +
        'recognition. [Award date/wording: verify primary source.]',
      url: 'https://en.wikipedia.org/wiki/Stereo_70',
    },
  ],

  footer: {
    license:
      'Content licensed CC BY 4.0. The converter is a separate, brand-agnostic ' +
      'module (see SPEC.md).',
    links: [
      { label: 'Build spec (SPEC.md)', url: './SPEC.md' },
      { label: 'Content spec (CONTENT.md)', url: './CONTENT.md' },
      { label: 'Source on GitHub', url: 'https://github.com/gaarutyunov/photostereo' },
    ],
  },
};
