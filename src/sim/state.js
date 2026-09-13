export const SCAN_PATTERNS = ['sector', 'raster', 'circular', 'spiral', 'agile'];
export const SCAN_LABELS = {
  sector: 'SECTOR',
  raster: 'RASTER (8-BAR)',
  circular: 'CIRCULAR (CUED ACQ.)',
  spiral: 'SPIRAL (ACQUISITION)',
  agile: 'AGILE (SEARCH + TRACK)',
};
export const VIEW_MODES = ['assembled', 'cutaway', 'xray', 'signal'];
export const VIEW_LABELS = {
  assembled: 'ASSEMBLED VIEW',
  cutaway: 'SECTION VIEW',
  xray: 'X-RAY VIEW',
  signal: 'SIGNAL PATH',
};
export const CAMERA_PRESETS = ['rear', 'front', 'plan', 'dome'];
export const QUADRANT_MODES = ['search', 'track', 'standby'];
export const COLORS = {
  search: 0x2ee6d6,
  track: 0xf5a623,
  standby: 0x3a4a5a,
  detect: 0xffffff,
  fault: 0xe24b4a,
  signal: 0x7f77dd,
  control: 0x2ee6d6,
  dome: 0x0d1620,
  bg: 0x05080c,
};

const defaultTelemetry = () => ({
  beamAzDeg: 0, beamElDeg: 0, steerAngleDeg: 0, beamwidthDeg: 4.2, scanLossDb: 0,
  activeElements: 576, activeSubarrays: 4, activeBeams: 0, tracked: 0, detected: 0,
  hops: 0, dwellMs: 0, pulsesPerDwell: 0,
  dutyCycle: 0.012, pulseWidthUs: 10, peakPowerKw: 0, avgPowerKw: 0, unambRangeKm: 125,
  eirpLossDb: 0, arrayTempC: 22, pulsesSent: 0, echoes: 0, mainbeamJam: false,
  patternBwDeg: 4.2, patternSllDb: -13.3, patternPeakDb: 0, gratingLobe: false,
});

export class SimState {
  running = false;
  time = 0;
  viewMode = 'assembled';
  explode = 0;
  explodeTarget = 0;
  cameraPreset = 'rear';
  scanPattern = 'raster';
  prf = 1200;
  power = 60;
  scanRate = 1;
  quadrantModes = ['search', 'search', 'search', 'search'];
  failedFraction = 0;
  jamming = false;
  nulling = false;
  spacingLambda = 0.5;        // element spacing in wavelengths (0.5..1.0); > 0.5 admits grating lobes
  taper = 0;                  // amplitude taper 0..1 (uniform .. heavy)
  patternSearch = true;       // draw the search beam's pattern lobe
  patternTrack = true;        // draw track beams' pattern lobes
  patternCuts = true;         // show the az/el cut plot
  selectedPart = null;
  hoveredPart = null;
  hoveredQuadrant = null;
  beams = [];
  targets = [];
  telemetry = defaultTelemetry();

  reset() {
    this.running = false;
    this.time = 0;
    this.hoveredQuadrant = null;
    this.telemetry = defaultTelemetry();
  }
}

export const ts = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
