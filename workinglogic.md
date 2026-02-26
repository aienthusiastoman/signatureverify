# SignatureVerify — Algorithm Writeup & Working Logic

This document is a detailed technical reference for how signature comparison works inside SignatureVerify. It covers every algorithm, every mathematical formula, all tuning parameters, the three comparison modes, multi-region mask weighting, and a rigorous discussion of what the confidence score means — and what it does not.

---

## Table of Contents

1. [Overview](#overview)
2. [Image Ingestion and Preprocessing](#image-ingestion-and-preprocessing)
3. [Adaptive Gaussian Thresholding](#adaptive-gaussian-thresholding)
4. [Morphological Operations](#morphological-operations)
5. [Black-Hat Transform](#black-hat-transform)
6. [Line Removal](#line-removal)
7. [Connected Component Labeling and Blob Extraction](#connected-component-labeling-and-blob-extraction)
8. [Zhang-Suen Thinning (Skeletonization)](#zhang-suen-thinning-skeletonization)
9. [Signature Normalization](#signature-normalization)
10. [Similarity Metrics](#similarity-metrics)
    - [Curve Profile Correlation](#1-curve-profile-correlation)
    - [Grid Density Correlation](#2-grid-density-correlation)
    - [IoU Pixel Similarity](#3-iou-pixel-similarity)
11. [Comparison Modes and Score Composition](#comparison-modes-and-score-composition)
12. [Multi-Region Mask Weighting](#multi-region-mask-weighting)
13. [PDF Audit Report Generation](#pdf-audit-report-generation)
14. [Auto-Detection of Signature Bounds](#auto-detection-of-signature-bounds)
15. [PDF Text Search and Page Anchoring](#pdf-text-search-and-page-anchoring)
16. [Confidence Score: Scientific Basis and Limitations](#confidence-score-scientific-basis-and-limitations)
17. [Constants Reference](#constants-reference)

---

## Overview

The system compares two signature specimens and returns a **confidence score between 0 and 100** representing how likely the two signatures were made by the same person. It does this by:

1. Extracting the relevant signature region from each document (image or PDF).
2. Running a multi-stage preprocessing pipeline to isolate ink strokes and remove printed content.
3. Normalizing both signatures to a common canvas size.
4. Computing three independent similarity metrics on the normalized images.
5. Combining the metrics with mode-specific weights and a boost multiplier to produce the final score.

All computation runs in a Deno-based Supabase Edge Function. No neural network or trained model is used — the pipeline is entirely classical computer vision.

---

## Image Ingestion and Preprocessing

### Grayscale Conversion

The first step converts the RGB image to a single-channel grayscale image using a minimum-channel strategy:

```
gray(x, y) = min(R(x, y), G(x, y), B(x, y))
```

This is deliberately not the standard luminance formula `0.299R + 0.587G + 0.114B`. By taking the **minimum** channel, ink that appears coloured on a coloured-paper background is captured more reliably. Dark ink tends to have low values in all channels, while the paper background is high in all channels — the min operation exaggerates this contrast.

### Inward Crop

A 6-pixel border is removed from all sides before any processing. This eliminates JPEG compression artefacts, scanner edge noise, and border lines that would otherwise confuse the adaptive threshold.

---

## Adaptive Gaussian Thresholding

Classical global thresholding fails on documents with uneven lighting, yellowed paper, or scanned edges. The system uses **adaptive local thresholding**, where each pixel's threshold is computed from its local neighbourhood.

### Gaussian Kernel Construction

A 1D Gaussian kernel of size `blockSize = 31` is constructed:

```
sigma = (blockSize - 1) / 6
k[i] = exp(-(i²) / (2 × sigma²))   for i in [-(blockSize/2), ..., (blockSize/2)]
kernel = k / sum(k)   (normalized to unit sum)
```

With `blockSize = 31`, `sigma ≈ 5.0`. The kernel has a FWHM of approximately 11.8 pixels, meaning local contrast is assessed over a neighbourhood of roughly 12 pixels in each direction.

### Separable 2D Convolution

The 1D kernel is applied first horizontally, then vertically (separable convolution). This is mathematically equivalent to a 2D Gaussian convolution but reduces the per-pixel operation count from O(blockSize²) to O(2 × blockSize).

### Threshold Decision

```
binary(x, y) = 1   if gray(x, y) < gaussian_blur(x, y) - C
binary(x, y) = 0   otherwise
```

`C` is an offset constant. The system tries `C = 15` first, then falls back to `C = 10` or `C = 20` if the resulting binary image contains too few or too many ink pixels.

**Intuition**: A pixel is classified as ink if it is darker than its local neighbourhood by at least `C` grey levels. This makes the threshold self-calibrate to paper colour and lighting.

---

## Morphological Operations

### Erosion and Dilation (Binary)

Standard binary morphological erosion and dilation are implemented with flat square/rectangular structuring elements.

**Erosion**: A pixel stays white only if all pixels in the structuring element neighbourhood are white.
**Dilation**: A pixel becomes white if any pixel in the structuring element neighbourhood is white.

### Grayscale Erosion and Dilation

For the Black-Hat transform, grayscale morphology is used:

```
erode_gray(x, y)  = min over (dx, dy) in SE { img(x+dx, y+dy) }
dilate_gray(x, y) = max over (dx, dy) in SE { img(x+dx, y+dy) }
```

With a circular structuring element of radius `r = 3` pixels.

---

## Black-Hat Transform

The Black-Hat morphological transform highlights dark structures that are smaller than the structuring element (i.e., ink strokes) relative to the background:

```
black_hat(x, y) = closing(x, y) - gray(x, y)

where closing = dilate(erode(gray))
```

This operation emphasises fine dark features (pen strokes) while suppressing large dark regions (shadows, photocopier artifacts, hole punches). After computing the Black-Hat image, a **percentile threshold** is applied: only pixels in the **top 30% of Black-Hat values** are retained. This aggressively prunes weak responses that correspond to paper texture, grain, and low-contrast smudges.

---

## Line Removal

Printed documents contain horizontal ruled lines, table borders, and form grid lines. These are structurally different from signatures and would corrupt the similarity metrics if left in.

### Horizontal Line Removal via Morphological Opening

A morphological opening with a **wide horizontal structuring element** is applied:

```
kernel_width = max(20, width × 0.15)   (at least 20 pixels, at most 15% of image width)
kernel_height = 1

horizontal_lines = erode(binary, horizontal_kernel)
                   followed by dilate(horizontal_kernel)

cleaned = binary AND NOT horizontal_lines
```

Opening with a wide horizontal kernel retains only structures that are continuous for at least `kernel_width` pixels horizontally — i.e., ruled lines. These are then subtracted from the binary image.

### Vertical Line Removal

The same operation is applied vertically with a `1 × kernel_height` kernel where:

```
kernel_height = max(20, height × 0.15)
```

### Effect

A printed form line with an ink signature running through it: after line removal, the ruled line is erased but the crossing pen strokes remain (because pen strokes are not continuous over 15% of image width in a single direction).

---

## Connected Component Labeling and Blob Extraction

After thresholding and line removal, the binary image contains multiple disconnected white regions ("blobs"): the signature, stray marks, dust, JPEG noise islands. The system must isolate the signature.

### Union-Find Algorithm

Connected Component Labeling (CCL) is performed with a Union-Find (Disjoint Set Union) structure with **path compression**:

```
find(x):
  if parent[x] != x: parent[x] = find(parent[x])
  return parent[x]

union(x, y):
  parent[find(x)] = find(y)
```

A two-pass scan labels each pixel. Pass 1 assigns provisional labels and records equivalences. Pass 2 resolves equivalences via `find()`.

### Blob Selection

After labeling, the system:

1. Counts the area (pixel count) of each component.
2. Rejects components smaller than `minBlobArea = 20 pixels`.
3. Selects the **single largest component** as the signature blob.
4. Sanity checks:
   - Area must be > 100 pixels (reject blank or near-blank regions).
   - Area must be < 60% of the total image area (reject full-page fills from thresholding errors).

If a blob fails sanity checks, the pipeline retries with a different `C` value for the adaptive threshold.

---

## Zhang-Suen Thinning (Skeletonization)

Before computing the Curve Profile metric, the signature blob is **thinned to a 1-pixel-wide skeleton** using the Zhang-Suen algorithm (Zhang & Suen, 1984, *Communications of the ACM*).

### Algorithm

The algorithm iterates until no more changes occur. Each iteration has two sub-passes. In each sub-pass, a pixel `P1` at position (r, c) is removed (set to background) if **all** of the following conditions hold:

Let the 8 neighbours in clockwise order from top be P2, P3, P4, P5, P6, P7, P8, P9.

```
B(P1) = number of non-zero neighbours of P1 (connectivity)
A(P1) = number of 01 transitions in P2, P3, P4, P5, P6, P7, P8, P9, P2 (circular)

Pass 1 removes P1 if:
  2 ≤ B(P1) ≤ 6
  A(P1) = 1
  P2 × P4 × P6 = 0
  P4 × P6 × P8 = 0

Pass 2 removes P1 if:
  2 ≤ B(P1) ≤ 6
  A(P1) = 1
  P2 × P4 × P8 = 0
  P2 × P6 × P8 = 0
```

**Why skeleton?** The Curve Profile metric tracks the vertical centre-of-mass per column. If thick pen strokes are used, the profile is biased towards the centre of the stroke rather than its trajectory. Skeletonization reduces all strokes to single-pixel width, making the centre-of-mass profile faithfully represent the trajectory of each pen stroke regardless of pen thickness.

---

## Signature Normalization

Both signatures are normalized to a common canvas before comparison. Two normalization strategies exist:

### Standard Normalization (`normalizeSignature`)

The bounding box of the ink pixels is found. The content is scaled to fit within a `600 × 250` pixel canvas with aspect ratio preserved. The canvas is centred.

### Tight Normalization (`normalizeSignatureTight`)

The content is scaled to fill as much of a `400 × 300` pixel canvas as possible, cropping to the tight bounding box first. Used when a signature appears in a constrained region.

**Why normalize?** The same physical signature captured at different scales, from different distances, or at different zoom levels would otherwise fail every pixel-level metric. Normalization removes scale and translation variance.

**Limitation**: Normalization does **not** remove rotation, shear, or stylistic variation (e.g., larger vs. smaller writing of the same signature). These remain as genuine comparison challenges.

---

## Similarity Metrics

Three independent metrics are computed on the normalized, skeletonized binary images. Each returns a value in `[0, 100]`.

### 1. Curve Profile Correlation

This metric measures **the trajectory of the signature strokes** by comparing vertical centre-of-mass profiles.

**Computation**:

```
For each column x from 0 to width-1:
  ink_pixels_x = all y-coordinates of ink pixels in column x

  if ink_pixels_x is empty:
    c[x] = height   (sentinel value = bottom of canvas)
  else:
    c[x] = mean(ink_pixels_x)   (vertical centre of mass of that column)

// c[x] traces the average vertical position of strokes across the image width
```

For two signatures, two profile vectors `c1` and `c2` are produced. The **Pearson correlation coefficient** is then computed:

```
m1 = mean(c1),  m2 = mean(c2)
s1 = sqrt(mean((c1 - m1)²)) + 1e-6    (standard deviation, ε to avoid /0)
s2 = sqrt(mean((c2 - m2)²)) + 1e-6

r = (1/width) × Σ_x [ (c1[x] - m1)/s1 × (c2[x] - m2)/s2 ]

curveScore = max(0, r) × 100
```

The `max(0, r)` clips negative correlations to zero. A Pearson `r = 1.0` means the signatures have identical up-down stroke trajectories. `r = 0` means the trajectories are completely uncorrelated. Negative `r` (inverse trajectories) is treated the same as `r = 0`.

**What this captures**: The overall shape and flow of the signature — whether it rises and falls in the same places, whether it has similar curvature. Two completely different signatures will almost never produce a high curve correlation.

**What this misses**: Rotation. A 90° rotated version of the same signature would score near zero. Very short signatures (sparse columns) may produce unstable estimates.

---

### 2. Grid Density Correlation

This metric measures **the spatial distribution of ink** across the image area.

**Computation**:

The normalized image (600 × 250) is divided into a 10-column × 4-row grid of 40 cells.

```
For each cell (i, j):
  cell_pixels = all pixels in the rectangular cell region
  ink_pixels  = sum of white pixel values in cell
  density[i,j] = ink_pixels / total_cell_pixels
```

This produces a 40-dimensional density vector for each signature. The Pearson correlation of these two vectors is the grid density score:

```
d1 = density vector of signature 1 (40 values)
d2 = density vector of signature 2 (40 values)

m1 = mean(d1),  m2 = mean(d2)
s1 = mean((d1 - m1)²),  s2 = mean((d2 - m2)²)

numerator   = mean((d1 - m1) × (d2 - m2))
denominator = sqrt(s1 × s2) + 1e-10

gridScore = max(0, numerator / denominator) × 100
```

**What this captures**: Where the ink is relative to the overall canvas. Signatures with similar overall spatial layouts will score high. This is robust to small local deformations and is insensitive to stroke thickness.

**What this misses**: Fine-grained stroke detail. Two signatures with ink in the same rough regions but with completely different internal structure would still score high.

---

### 3. IoU Pixel Similarity

Intersection over Union measures **the proportion of pixels where both signatures have ink**, normalized by the total area either has ink.

```
intersection = count of pixels that are ink in both signatures
union        = count of pixels that are ink in either signature

iouScore = (intersection / union) × 100
```

**Dilation before IoU**: Before computing IoU, both binary images are dilated by a small structuring element to allow for slight misalignment (a pen stroke 1–2 pixels to the left would otherwise count as non-overlapping):

| Mode          | Dilation Radius | Structuring Element |
|---------------|-----------------|---------------------|
| Strict        | 1 pixel         | 3 × 3 square        |
| Lenient       | 1 pixel         | 3 × 3 square        |
| Super Lenient | 4 pixels        | 9 × 9 square        |

**What this captures**: Literal pixel-level co-occurrence of ink. High IoU means the two signatures overlap substantially.

**What this misses**: Global structure. A forgery that places ink in the same general area but with a different pattern could coincidentally achieve moderate IoU while having very different curves.

---

## Comparison Modes and Score Composition

The three metrics are combined with a **weighted sum** followed by a **multiplicative boost**. The weights and boost differ by mode:

### Mode: Lenient (default)

```
raw = gridScore × 0.50 + iouScore × 0.30 + curveScore × 0.20
final = min(100, max(0, raw × 1.40))
```

- Emphasises spatial distribution (grid) over exact pixel overlap and trajectory.
- The 1.40× boost acknowledges that realistic same-person signatures may differ noticeably.
- This is the recommended mode for general document verification.

### Mode: Strict

```
raw = curveScore × 0.60 + iouScore × 0.30 + gridScore × 0.10
final = min(100, max(0, raw × 1.05))
```

- Emphasises the trajectory/curve metric heavily.
- Minimal boost (only 5%) means the raw signal dominates.
- Use for forensic or legal contexts where false positives are costly.

### Mode: Super Lenient

```
raw = gridScore × 0.50 + iouScore × 0.30 + curveScore × 0.20
final = min(100, max(0, raw × 2.00))
```

- Same weights as lenient but a 2× boost.
- IoU uses wide 9-pixel dilation, making the pixel overlap metric very forgiving.
- Use for highly stylised signatures, faint ink, or when documents are photographed at an angle.

### Confidence Thresholds

| Score Range | Lenient / Super Lenient | Strict  |
|-------------|------------------------|---------|
| Low         | 0–49%                  | 0–59%   |
| Moderate    | 50–74%                 | 60–79%  |
| High        | 75–100%                | 80–100% |

---

## Multi-Region Mask Weighting

When multiple signature locations are defined across a document (e.g., a signatory signs on page 1, page 3, and the final schedule), the system can aggregate scores across all positions.

### Single Mask, Multiple Signature Blobs

If the connected-component extraction within a single mask region finds multiple blobs (e.g., two initials side by side), each blob is independently compared to the reference. Scores are combined as:

```
if regionWeights provided:
  maskScore = Σ(subScore_i × regionWeight_i) / Σ(regionWeight_i)

else:
  maskScore = mean(subScore_i)
```

### Multiple Masks, Weighted Average

Each mask can be assigned a weight reflecting its relative importance. The final score is:

```
finalScore = Σ(maskScore_i × maskWeight_i) / Σ(maskWeight_i)
```

If no weights are provided, all masks default to weight = 1.0 and the result is a simple arithmetic mean.

### Example

A three-signature contract:

| Mask          | Score | Weight |
|---------------|-------|--------|
| Signature (main) | 81%  | 3      |
| Initials p.2   | 74%  | 1      |
| Initials p.4   | 77%  | 1      |

```
finalScore = (81 × 3 + 74 × 1 + 77 × 1) / (3 + 1 + 1)
           = (243 + 74 + 77) / 5
           = 394 / 5
           = 78.8%
```

The PDF audit report shows each mask's individual score, its weight as a percentage, and the full weighted formula.

---

## PDF Audit Report Generation

The system generates a PDF report containing:

1. **Confidence Score** with a colour-coded meter (green/amber/red).
2. **Score Formula** showing the weighted expression that produced the final number.
3. **Per-Mask Breakdown Table**: mask index, label, document page, score, weight %.
4. **Sub-score rows** when multiple blobs were extracted per mask.
5. **Cropped Signature Images**: the extracted region from both documents, side by side.
6. **Metadata**: job ID, timestamp, document file names, comparison mode.

The PDF is stored in Supabase Storage and a signed URL is returned with the API response.

---

## Auto-Detection of Signature Bounds

When no mask is provided by the user, the system attempts to automatically locate the signature within the region using one of three strategies:

### Simple Brightness Detection

```
For each pixel in the region:
  brightness = (R + G + B) / 3
  if brightness < 160: mark as potential ink

Find bounding box of all marked pixels.
Pad by max(10px, 5% of detected width/height).
```

Threshold 160 (out of 255) catches most dark inks on white or light-coloured paper.

### Filtered Stroke Detection

A more accurate variant that runs the full preprocessing pipeline (Gaussian threshold + line removal + blob extraction) before computing the bounding box:

1. Extract strokes using the same adaptive threshold and morphological pipeline.
2. Find the bounding box of the largest resulting blob.
3. Pad by 20 pixels in each direction.

This variant is used after the user draws a rough region — the system refines the bounds to tightly fit the actual signature content.

---

## PDF Text Search and Page Anchoring

For multi-page PDFs, a mask can be anchored to a text string (e.g., "Signed by the Borrower") rather than a fixed page number. This allows templates to work on documents where the signatory page is variable.

### Search Algorithm

```
normalizedQuery = query.trim().toLowerCase().replace(/\s+/g, ' ')

loosyRegex = words.join('[\\s\\S]{0,80}')
  // allows up to 80 characters between words, matching across line breaks

For each page in PDF:
  text = extractPageText(page).toLowerCase()

  if text.includes(normalizedQuery): match = true
  else if text.replace(/\s+/g, ' ').includes(normalizedQuery): match = true
  else if looseRegex.test(text): match = true
  else if query.words.every(w => text.includes(w)) AND words.length >= 3: match = true

If multiple pages match and a mask rect is provided:
  return page with highest ink density within the mask region
Else:
  return first matching page
```

The "most ink in the mask region" tie-breaker ensures that when a phrase appears in a table of contents and again on the actual signature page, the system selects the page where the signature is actually present.

---

## Confidence Score: Scientific Basis and Limitations

This section provides a rigorous account of what the confidence score means, what supports its validity, and where it should not be relied upon as definitive.

### What the Score Represents

The score is a **composite similarity index** computed from three independent measurements of visual resemblance between two signature images:

1. **Trajectory correlation** (Pearson r on vertical centre-of-mass profiles)
2. **Spatial distribution correlation** (Pearson r on 40-cell grid densities)
3. **Pixel co-occurrence** (Intersection over Union after normalization and dilation)

Each metric is dimensionally grounded:

- Pearson r is a bounded, unit-free measure of linear association, equal to 1.0 for perfectly aligned profiles and 0 for no linear relationship.
- IoU is a bounded set similarity coefficient, equal to 1.0 when the two binary images are identical and 0 when they share no ink pixels.

The weighted combination and boost are **empirically calibrated heuristics**, not derived from a statistical model. The specific weights (e.g., 0.50/0.30/0.20 in lenient mode) and boost factors (1.40×, 2.00×) were chosen to produce intuitively reasonable scores on representative document scans. They are not fitted to a labelled dataset of genuine vs. forged signature pairs.

### What a Score of X% Means — and Does Not Mean

**A score of 85% does not mean there is an 85% probability the signatures are from the same person.**

The score is an index of visual similarity on the three metrics described. It has no calibrated probabilistic interpretation without:

- A reference dataset of genuine same-person signature pairs and their score distribution.
- A reference dataset of different-person (or forged) signature pairs and their score distribution.
- Likelihood-ratio or ROC analysis on those distributions.

Without such a dataset, the score cannot be converted into a posterior probability of genuineness.

### Factors That Inflate the Score (False Positives)

The following conditions can cause the system to report a high score for two signatures that are not from the same person:

| Factor | Explanation |
|--------|-------------|
| Similar signing style | People who write in a similar hand will produce correlated profiles. The system is not trained to distinguish individuals. |
| Short or simple signatures | A signature consisting of a single horizontal stroke will match many signatures. The grid and curve metrics converge when there is little spatial information. |
| Heavy super-lenient dilation | The 9 × 9 dilation in super-lenient mode causes signatures in similar regions to overlap heavily even when the actual strokes are different. |
| Scale normalisation | Normalising to a common canvas forces alignment of scale, reducing a genuine distinguishing factor. |
| Partial document coverage | If the mask region is too small, only a fragment of the signature is compared. |

### Factors That Deflate the Score (False Negatives)

The following conditions can cause the system to report a low score for two genuine signatures from the same person:

| Factor | Explanation |
|--------|-------------|
| Intra-person variability | The same person's signature varies day-to-day, with stress, pen type, surface hardness, and writing speed. Studies report within-person IoU values in the range 0.30–0.65 for natural variation (Impedovo & Pirlo, 2008). |
| Document condition | Faded, crumpled, photographed-at-angle, or photocopied documents degrade ink pixel quality before the algorithm even begins. |
| Asymmetric pen pressure | Ballpoint vs. gel pen on the same signature produces very different Black-Hat response magnitudes. |
| Rotation | The normalisation pipeline accounts for scale and translation but not rotation. A slightly tilted document can shift the curve profile significantly. |
| PDF rendering resolution | PDFs are rendered at 144 DPI (2× screen). Some documents with embedded low-resolution signature images will produce blurry crops after scaling. |

### Algorithm-Specific Caveats

**Adaptive threshold `C` parameter**: The system tries `C ∈ {15, 10, 20}` sequentially. Different values produce meaningfully different binary images. The final preprocessing result depends on which value first passes the sanity check. Two runs on the same image can in theory produce slightly different binary images if pixel values are near the threshold boundary.

**Largest-blob assumption**: The system assumes the signature is the largest connected ink component after line removal. This fails if a large stamp, annotation, or watermark overlaps the signature region.

**Zhang-Suen assumptions**: The skeleton algorithm assumes the input is a well-connected binary blob. Fragmented ink (e.g., from a leaking pen) produces disconnected skeletons that compute unstable curve profiles.

**Fixed grid size**: The 10 × 4 grid used for density correlation is fixed regardless of signature aspect ratio. A very tall, narrow signature and a wide, short one are compared on the same grid, which may not capture their relevant structure.

**Boost is a multiplier, not a probability**: The boost factor (1.40×, 2.00×) is a post-hoc scalar applied to the weighted sum. It has no statistical derivation. Scores above ~71 (for lenient) or ~50 (for super lenient) before the boost will produce a final score > 100, which is then clamped to 100. The boost means that a raw weighted similarity of, say, 65% is reported as 91% in lenient mode. This is by design (to account for genuine intra-person variation) but it means the reported number is not a direct measure of visual similarity — it includes a deliberate upward correction.

### Comparison with Published Research

Signature verification is a mature research area. For context:

- **Human verifiers** achieve 5–15% False Rejection Rate (FRR) and 2–8% False Acceptance Rate (FAR) in controlled studies (Impedovo & Pirlo, 2008, *IEEE Trans. Systems, Man, Cybernetics*).
- **Offline automated systems** (static image comparison without stylus dynamics) using classical features typically report EER (Equal Error Rate) of 7–20% on standard benchmarks (CEDAR, MCYT, GPDS).
- **Deep learning approaches** (e.g., SigNet, VerSig) achieve EER of 2–5% on the same benchmarks but require training on thousands of labelled signature pairs.

The algorithm used here is a **classical unsupervised method**. It has not been evaluated on a standard benchmark. The confidence score should be interpreted as a **screening tool** — a high score is evidence consistent with a genuine match, and a low score is evidence of dissimilarity — but it is not a substitute for human expert review in legally consequential decisions.

### Recommended Usage

- **Score ≥ 75 (lenient)**: Treat as consistent with a genuine match. Proceed with standard workflow. Flag for human review if the transaction value is high.
- **Score 50–74 (lenient)**: Inconclusive. Human review recommended.
- **Score < 50 (lenient)**: Treat as a likely mismatch. Do not proceed without human expert review.
- **For legal or forensic use**: Always supplement with a qualified forensic document examiner. The system output is not admissible as expert evidence without separate qualification.

---

## Constants Reference

| Constant | Value | Location | Purpose |
|----------|-------|----------|---------|
| `blockSize` | 31 | Edge function | Adaptive threshold Gaussian radius |
| `C (threshold offset)` | 15, 10, 20 | Edge function | Adaptive threshold bias (tried in sequence) |
| `inwardCrop` | 6 px | Edge function | Border noise removal |
| `blackHatRadius` | 3 px | Edge function | Morphological closing radius |
| `percentileKeep` | 0.30 | Edge function | Keep top 30% of black-hat response |
| `hLineKernelLen` | max(20, w × 0.15) | Edge function | Horizontal line removal kernel width |
| `vLineKernelLen` | max(20, h × 0.15) | Edge function | Vertical line removal kernel height |
| `minBlobArea` | 20 px | Edge function | Minimum post-cleanup blob size |
| `minBlobThreshold` | 100 px | Edge function | Minimum accepted signature blob |
| `maxBlobFraction` | 0.60 | Edge function | Maximum blob as fraction of image |
| `dilate1 radius` | 1 px | Edge function | 3 × 3 dilation (strict/lenient IoU) |
| `dilate3 radius` | 2 px | Edge function | 5 × 5 dilation (internal cleanup) |
| `dilate5 radius` | 4 px | Edge function | 9 × 9 dilation (super lenient IoU) |
| `normTarget` | 600 × 250 px | Edge function | Standard normalization canvas |
| `normTight` | 400 × 300 px | Edge function | Tight normalization canvas |
| `gridCols` | 10 | Edge function | Grid density metric columns |
| `gridRows` | 4 | Edge function | Grid density metric rows |
| `boostLenient` | 1.40 | Edge function | Score multiplier, lenient mode |
| `boostStrict` | 1.05 | Edge function | Score multiplier, strict mode |
| `boostSuperLenient` | 2.00 | Edge function | Score multiplier, super lenient mode |
| `RENDER_SCALE` | 2.0 | Frontend | PDF rendering resolution multiplier |
| `blockSize (frontend)` | 31 | Frontend | Same adaptive threshold |
| `C (frontend)` | 15 | Frontend | Same offset |
| `lineKernelLen (frontend)` | 29 px | Frontend | Line removal kernel (scaled from 400 DPI ref) |
| `minArea (frontend)` | 50 px | Frontend | Minimum stroke area for auto-detect |
| `autoDetectBrightnessThreshold` | 160 / 255 | Frontend | Dark pixel threshold |
| `autoDetectMargin` | 10 px | Frontend | Padding around auto-detected bounds |
| `filteredDetectMargin` | 20 px | Frontend | Padding after stroke-filtered detection |

---

*This document describes the state of the algorithm as implemented. All tuning parameters are subject to change as the system is refined.*
