// Amplitude taper across one axis of the array: cosine-squared on a pedestal.
// t = 0 → uniform illumination (−13 dB first sidelobe), t = 1 → cos² on a 0.2 pedestal (≈ −27 dB
// sidelobes, ~1.5× wider beam, ~9 dB less transmit power). Shared by the element colouring and
// the pattern computation.
export function taperWeight(i, t, n = 24) {
  const c = Math.cos((Math.PI * (i - (n - 1) / 2)) / n);
  const depth = 0.8 * t;
  return 1 - depth + depth * c * c;
}
