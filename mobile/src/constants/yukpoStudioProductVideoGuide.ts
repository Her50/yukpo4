/**
 * Authoritative English knowledge base for Yukpo IA when the user is in
 * ProductVideoCreationModal (Yukpo Studio — product video wizard).
 * Responses must still follow the user's UI language (see intelligentChatService langInstr).
 */

export const YUKPO_STUDIO_PRODUCT_VIDEO_REFERENCE = `
=== YUKPO STUDIO — PRODUCT VIDEO WIZARD (ProductVideoCreationModal) ===

**Purpose:** Build a vertical marketing video for a catalog product in ~6 guided steps. The pipeline feeds **Yukpo Composer** / backend generation: selected media, style, script, audio, and publish options become **edit decisions** (shot order, duration, overlays, music/voice mix, subtitles, export formats).

**Backend branding (default):** when \`enable_watermark\` is on, the server applies a **Yukpo end signature** on the **last seconds** of the export: **centered Yukpo logo** (scaled to the video width), optional **dark bottom band** for contrast, fade — not a tiny corner bug during the whole clip. Place \`yukpo_logo.png\` under \`assets/logo/\` or \`backend/assets/logo/\` on the server.

**Global concepts (montage impact):**
- **Source media** define what the viewer sees: order, duration per clip, crops, and which assets appear in the final timeline.
- **Style preset** (TikTok / Story / Cinematic / Carousel) changes **aspect emphasis**, pacing hints, and visual treatment suggestions — it biases transitions, text density, and perceived production value.
- **Script & storyboard** map **spoken / on-screen text** to scenes; each line typically becomes a **segment** in the edit.
- **Effects / transitions / overlays / color** alter **look & continuity** between shots (energy, clarity, brand consistency).
- **Music + voiceover + subtitles** define the **audio stack** and accessibility; levels and language affect engagement and platform compliance.
- **Distribution choices** do not change pixels in the same render pass but decide **where** variants go (chat card, product page, Shorts, etc.) and sometimes **format** (square / landscape add-ons).

---

### Step 1 — Product
- **Hero product:** the primary SKU/offer the video sells; drives copy, price overlays, and CTA.
- **Related / complementary products:** optional cross-sell; may insert extra shots or end-card suggestions in the montage.
- **Price / promotion / contact toggles:** when enabled, on-screen badges and end cards — affects **graphics layer** and legibility (keep text short).
- **Delivery options:** logistical promise text; impacts disclaimers and CTA wording, not raw pixels unless templates inject icons.
- **Generative video entry (Runway/Pika/Sora wizard):** optional **AI-generated b-roll** attached to the product — becomes additional timeline sources like camera media.

**Montage impact:** defines **subject**, **selling points**, and **legal/safe** messaging; wrong product = wrong entire storyboard.

---

### Step 2 — Media
- **Gallery vs Mediatech / service library toggles:** which pools are searched for clips/stills.
- **Multi-select media:** order matters for auto-storyboard; duration per asset influences **total runtime** vs target duration.
- **Uploads:** new assets enter the same pool; large sets increase **cut variety** but need stronger **pacing** control later.
- **AI media analysis (dominant colors, objects, ambiance, marketing angle):** informs **style suggestions**, **coach tips**, and **auto effects** — steers color harmony and shot emphasis in the edit.
- **AR immersive capture:** optional **custom take** merged like any clip — strong for **hero reveal**; file size/length affects render time.
- **Quick preview / short preview:** **sanity check** of selection — not the final grade but helps catch bad framing early.

**Montage impact:** media is the **visual backbone**; weak or mismatched shots cap perceived quality regardless of effects.

---

### Step 3 — Style & effects
- **Style preset (TikTok, Story, Cinematic, Carousel):** changes recommended **cut rhythm**, typography weight, and template bias.
- **Target duration:** hard constraint on **total length**; forces **fewer/longer shots** or **faster cuts**.
- **AI style suggestion / coach:** proposes palettes, effects, transitions aligned with **product + media analysis**.
- **Effects set, transitions set, overlay tips, color palette, music hint:** directly map to **timeline decoration** — whoosh vs fade, sticker overlays, brand colors.
- **Story template** (e.g. blog-style arcs): shapes **narrative order** (problem → proof → CTA).
- **Auto-storyboard on/off:** when on, AI sequences clips to match script beats; when off, user order weighs more.
- **Timeline variants / carousel paths:** can output **multiple editorial versions** (A/B pacing).
- **Color grading / auto-cut / advanced panels:** fine **shot timing** and **look**; misuse can harm **skin tones / product color accuracy** — prefer subtle moves for commerce.

**Montage impact:** this step is where **emotion + brand** are encoded; it interacts tightly with music and voice later.

---

### Step 4 — Script & edit (montage)
- **Headline / hook:** first on-screen line — sets **retention** in the first 1–2s.
- **Call to action:** closing directive — aligns **end card** and **voiceoutro**.
- **Script notes / outline:** feed scene segmentation; verbose text may crowd **lower-thirds**.
- **AI brief variants:** alternative **story flows**; picking one rewrites **scene order** and **VO lines**.
- **Voiceover script (preparation):** becomes **VO track** timing reference even if recorded/generated later.
- **Timeline editor / preview:** direct manipulation of **shot order**, **trim**, **per-clip duration** — the closest to classic **NLE** inside Yukpo Studio.
- **Storyboard view:** validates **scene ↔ media** mapping before render.
- **Captions / auto-captions language:** **text safe areas**; long captions may need **smaller type** or **fewer words per scene**.

**Montage impact:** this is the **editorial spine**; misaligned script vs media causes **jarring jumps** or **dead air**.

---

### Step 5 — Music & voice
- **Music mode / genre mood (pulse, lofi, ambient, cinematic, none):** drives **energy curve**; **none** = VO/SFX-forward.
- **Music volume:** balances **VO intelligibility** vs **groove**; too loud masks USP.
- **Library loops vs uploaded audio / curated loops:** licensing + **sonic consistency**; abrupt genre shifts feel amateur.
- **Voiceover on/off + language:** sets **dubbing**, **caption alignment**, and **lip-sync** expectations (product shots rarely need sync — VO overlays).
- **Audio sync / ducking panels (if shown):** automatic **sidechain** so music dips under speech.
- **Watermark / branding toggles (if present in UI):** **burned-in logo** — affects **safe margins** for text.

**Montage impact:** audio **carries half the message** on social; bad balance ruins **clarity** even with perfect visuals.

---

### Step 6 — Publishing & generation
- **Channel toggles (chat, product card, Shorts, Instagram, YouTube, etc.):** decide **delivery surfaces**; some surfaces need **shorter hooks** or **square crops**.
- **Square / landscape extra variants:** separate **aspect renders** — may reframe **center subject**; verify **text safe zones** per ratio.
- **Subtitle language:** **burned-in or soft** subs per platform norms.
- **Distribution / hashtag / plan IA:** marketing layer — hashtags do not change video pixels but guide **organic reach** strategy.
- **Cost estimate / job status:** operational; long jobs may mean **higher resolution** or **more effects**.
- **Video chaining / linked sessions / dependencies:** **sequel storytelling** — end cards link to **next episode**; impacts **continuity** across uploads.

**Montage impact:** publishing picks **who sees which crop** and **which CTA surface**; generative variants must be checked **per aspect**.

---

### Coach IA (contextual tips inside the modal)
- Reads **product highlights + media analysis + style** to suggest **effects, transitions, script tweaks, distribution**.
- Treat suggestions as **recommendations**; user choices remain authoritative for the final render.

### Hard rules for the assistant
- Always relate controls to **viewer perception** and **edit outcome** (pacing, clarity, brand, CTA).
- If unsure about a backend flag, say what the **UI intent** is and that **exact export specs** depend on server settings.
- Never invent **pricing/token** numbers not shown in the app UI the user sees.
`.trim();

export type ProductVideoStudioUiSnapshot = {
  activeStep: number;
  stepLabels?: string[];
  productName?: string;
  stylePreset?: string;
  durationTargetSec?: string;
  musicMode?: string;
  voiceoverEnabled?: boolean;
  voiceoverLang?: string;
  subtitleLang?: string;
  bilingualSubtitles?: boolean;
  subtitleTranslationLang?: string | null;
  selectedMediaCount?: number;
  effectsCount?: number;
  transitionsCount?: number;
  generativeWizardAvailable?: boolean;
};

export function buildYukpoStudioGuideText(snapshot: ProductVideoStudioUiSnapshot): string {
  const lines = [
    'CURRENT_WIZARD_STATE (JSON):',
    JSON.stringify(snapshot),
    '',
    'FULL_STUDIO_REFERENCE:',
    YUKPO_STUDIO_PRODUCT_VIDEO_REFERENCE,
  ];
  return lines.join('\n');
}
