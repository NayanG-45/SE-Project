/**
 * NarcoTest Vision (NTV) — Deterministic Computer Vision & Color Mathematics
 *
 * SPECIFICATION REFERENCE: README.md Section 7
 * Pure mathematical functions for:
 * 1. Region of Interest (ROI) extraction
 * 2. Quality Gate (Luminance mean/variance check for blank/dark/glare/covered lens)
 * 3. sRGB -> CIE XYZ -> CIE L*a*b* conversion (D65 illuminant, inverse companding)
 * 4. Delta E (CIE76) perceptual color distance
 * 5. Deterministic Reagent Reference Centroid Matching
 *
 * HARD PROHIBITIONS (Section 3):
 * - NO external ML libraries or black-box classifiers.
 * - 100% deterministic, reproducible, auditable in court.
 */

// Calibrated Reagent Reference Centroids (README.md Section 7.4)
export const REAGENT_CENTROIDS = [
  {
    name: 'Marquis — Purple/Violet',
    targetLab: { L: 30, a: 45, b: -45 },
    classification: 'PRESUMPTIVE POSITIVE: OPIATE CLASS (MARQUIS PURPLE)'
  },
  {
    name: 'Marquis — Orange/Brown',
    targetLab: { L: 55, a: 40, b: 55 },
    classification: 'PRESUMPTIVE POSITIVE: AMPHETAMINE CLASS (MARQUIS ORANGE)'
  },
  {
    name: 'Scott — Turquoise/Blue',
    targetLab: { L: 45, a: -10, b: -45 },
    classification: 'PRESUMPTIVE POSITIVE: COCAINE CLASS (SCOTT BLUE)'
  },
  {
    name: 'Mecke — Blue-Green',
    targetLab: { L: 40, a: -35, b: 15 },
    classification: 'PRESUMPTIVE POSITIVE: OPIATE/HEROIN CLASS (MECKE GREEN)'
  }
];

export const DELTA_E_NO_REACTION_THRESHOLD = 12.0;
export const DELTA_E_MATCH_MAX_THRESHOLD = 45.0;

/**
 * 7.1 Region of Interest (ROI) Pixel Extraction
 * Extracts ImageData from the center 100x100 pixel square of a canvas.
 *
 * @param {CanvasRenderingContext2D} ctx - 2D context of the captured frame
 * @param {number} canvasWidth - Width of the source canvas (e.g., 480)
 * @param {number} canvasHeight - Height of the source canvas (e.g., 360)
 * @param {number} roiSize - Square ROI dimension (default 100px)
 * @returns {ImageData}
 */
export function extractCenterROI(ctx, canvasWidth, canvasHeight, roiSize = 100) {
  // TODO: Extract exact center coordinates: startX = (canvasWidth - roiSize) / 2, startY = (canvasHeight - roiSize) / 2
  const startX = Math.floor((canvasWidth - roiSize) / 2);
  const startY = Math.floor((canvasHeight - roiSize) / 2);
  return ctx.getImageData(startX, startY, roiSize, roiSize);
}

/**
 * 7.2 Quality Gate (Blank / Dark / Covered Lens / Glare Detection)
 * Evaluates relative luminance Yi = 0.2126*R + 0.7152*G + 0.0722*B
 * Rejection thresholds:
 *   - Dark/Covered: mu_Y < 25
 *   - Glare/Overexposed: mu_Y > 248
 *   - Flat/Solid blank frame: sigma_Y < 1.5
 *
 * @param {ImageData} roiImageData - Raw pixels of the ROI
 * @returns {{ valid: boolean, reason?: string, mu_Y: number, sigma_Y: number }}
 */
export function evaluateQualityGate(roiImageData) {
  // TODO: Iterate over pixels to compute mean luminance (mu_Y) and standard deviation (sigma_Y)
  const data = roiImageData.data;
  const numPixels = data.length / 4;
  let sumY = 0;
  const luminances = new Float32Array(numPixels);

  for (let i = 0; i < numPixels; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luminances[i] = y;
    sumY += y;
  }

  const mu_Y = sumY / numPixels;

  let varianceSum = 0;
  for (let i = 0; i < numPixels; i++) {
    const diff = luminances[i] - mu_Y;
    varianceSum += diff * diff;
  }
  const sigma_Y = Math.sqrt(varianceSum / numPixels);

  if (mu_Y < 25) {
    return { valid: false, reason: 'Dark / Covered Lens Detected (mean luminance < 25)', mu_Y, sigma_Y };
  }
  if (mu_Y > 248) {
    return { valid: false, reason: 'Overexposed / Severe Glare Detected (mean luminance > 248)', mu_Y, sigma_Y };
  }
  if (sigma_Y < 1.5) {
    return { valid: false, reason: 'Flat / Solid Blank Frame Detected (luminance std dev < 1.5)', mu_Y, sigma_Y };
  }

  return { valid: true, mu_Y, sigma_Y };
}

/**
 * Computes average RGB of an ROI.
 *
 * @param {ImageData} roiImageData
 * @returns {{ r: number, g: number, b: number }}
 */
export function computeAverageRGB(roiImageData) {
  // TODO: Accumulate channel values across ROI pixels and return normalized average
  const data = roiImageData.data;
  const numPixels = data.length / 4;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  for (let i = 0; i < numPixels; i++) {
    sumR += data[i * 4];
    sumG += data[i * 4 + 1];
    sumB += data[i * 4 + 2];
  }

  return {
    r: sumR / numPixels,
    g: sumG / numPixels,
    b: sumB / numPixels
  };
}

/**
 * 7.3 sRGB to CIE L*a*b* Conversion (D65 Standard Illuminant)
 * Applies inverse sRGB companding -> CIE XYZ -> CIE L*a*b*
 *
 * @param {number} r - Red channel [0, 255]
 * @param {number} g - Green channel [0, 255]
 * @param {number} b - Blue channel [0, 255]
 * @returns {{ L: number, a: number, b: number }}
 */
export function rgbToCielab(r, g, b) {
  // TODO: Inverse sRGB companding
  const cLin = (c) => {
    const norm = c / 255.0;
    return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
  };

  const rLin = cLin(r);
  const gLin = cLin(g);
  const bLin = cLin(b);

  // Linear RGB to CIE XYZ (D65 Standard Illuminant)
  const X = 0.4124564 * rLin + 0.3575761 * gLin + 0.1804375 * bLin;
  const Y = 0.2126729 * rLin + 0.7151522 * gLin + 0.0721750 * bLin;
  const Z = 0.0193339 * rLin + 0.1191920 * gLin + 0.9503041 * bLin;

  // D65 reference white points
  const Xn = 0.95047;
  const Yn = 1.00000;
  const Zn = 1.08883;

  const epsilon = 0.008856;
  const kappa = 903.3;

  const f = (t) => {
    return t > epsilon ? Math.cbrt(t) : (kappa * t + 16.0) / 116.0;
  };

  const fx = f(X / Xn);
  const fy = f(Y / Yn);
  const fz = f(Z / Zn);

  const L = 116.0 * fy - 16.0;
  const aVal = 500.0 * (fx - fy);
  const bVal = 200.0 * (fy - fz);

  return { L, a: aVal, b: bVal };
}

/**
 * 7.4 Perceptual Color Distance (CIE Delta E 1976)
 * Delta E = sqrt((L2 - L1)^2 + (a2 - a1)^2 + (b2 - b1)^2)
 *
 * @param {{ L: number, a: number, b: number }} lab1
 * @param {{ L: number, a: number, b: number }} lab2
 * @returns {number}
 */
export function computeDeltaE(lab1, lab2) {
  // TODO: Compute Euclidean distance in CIE L*a*b* space
  const dL = lab2.L - lab1.L;
  const da = lab2.a - lab1.a;
  const db = lab2.b - lab1.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Classifies reaction against calibrated chemical reference centroids.
 *
 * @param {{ L: number, a: number, b: number }} baselineLab - Frame 1 Lab
 * @param {{ L: number, a: number, b: number }} reactedLab - Frame 2 Lab
 * @returns {{ deltaE_shift: number, matchedResult: string, nearestCentroid?: string, centroidDeltaE?: number }}
 */
export function classifyReaction(baselineLab, reactedLab) {
  // TODO: Compute deltaE_shift between baseline and reacted frames
  const deltaE_shift = computeDeltaE(baselineLab, reactedLab);

  // No-Reaction Gate (< 12.0)
  if (deltaE_shift < DELTA_E_NO_REACTION_THRESHOLD) {
    return {
      deltaE_shift,
      matchedResult: 'NEGATIVE — NO SIGNIFICANT REACTION'
    };
  }

  // Find nearest centroid
  let bestMatch = null;
  let minDistance = Infinity;

  for (const centroid of REAGENT_CENTROIDS) {
    const dist = computeDeltaE(reactedLab, centroid.targetLab);
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = centroid;
    }
  }

  if (bestMatch && minDistance <= DELTA_E_MATCH_MAX_THRESHOLD) {
    return {
      deltaE_shift,
      matchedResult: bestMatch.classification,
      nearestCentroid: bestMatch.name,
      centroidDeltaE: minDistance
    };
  }

  return {
    deltaE_shift,
    matchedResult: 'INCONCLUSIVE — UNRECOGNIZED COLOR SHIFT',
    nearestCentroid: bestMatch ? bestMatch.name : undefined,
    centroidDeltaE: minDistance
  };
}
