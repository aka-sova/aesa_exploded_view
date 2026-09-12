// Parts catalogue, front to back. `offset` is the explode displacement along Z at explode = 1.
// `metricKey` names a telemetry field for the inspector readout; `metricConst` is used instead
// when the value is fixed.
export const PARTS = [
  {
    id: 'radome', code: '01', name: 'Radome', offset: 1.4,
    metric: 'LOSS', unit: 'dB', metricKey: null, metricConst: 0.4,
    design: 'A-SANDWICH DIELECTRIC · 0.4 dB LOSS',
    description: 'Low-loss dielectric sandwich shell protecting the aperture; tuned so X-band passes with ~0.4 dB one-way loss.',
  },
  {
    id: 'aperture', code: '02', name: 'Radiating element array', offset: 0,
    metric: 'STEER ANGLE', unit: '°', metricKey: 'steerAngleDeg', metricConst: null,
    design: '24 × 24 λ/2 LATTICE · WAIM SHEET',
    description: 'One radiator per T/R module on a half-wavelength lattice (15.8 mm at 9.5 GHz); the element pattern limits useful scan to ±60°.',
  },
  {
    id: 'trm', code: '03', name: 'T/R module layer', offset: -0.7,
    metric: 'ACTIVE MODULES', unit: '', metricKey: 'activeElements', metricConst: null,
    design: '576 GaN T/R MODULES · 12 W PEAK · 6-BIT PHASE',
    description: 'One T/R module per element: GaN power amp, LNA, limiter, 6-bit phase shifter and attenuator, reloaded by the BSC every beam.',
  },
  {
    id: 'coldplate', code: '04', name: 'Cold plate & cooling manifold', offset: -1.4,
    metric: 'ARRAY TEMP', unit: '°C', metricKey: 'arrayTempC', metricConst: null,
    design: 'PAO LIQUID LOOP · 85 °C LIMIT',
    description: 'Liquid-cooled plate bonded to the T/R layer; removes the amplifier heat that otherwise limits duty cycle and module life.',
  },
  {
    id: 'manifold', code: '05', name: 'RF manifold / beamformer', offset: -2.1,
    metric: 'SUBARRAY PORTS', unit: '', metricKey: 'activeSubarrays', metricConst: null,
    design: '4 SUBARRAY PORTS · STRIPLINE COMBINER',
    description: "Passive corporate feed combining each quadrant's 144 elements to a subarray port; four ports allow independent beams.",
  },
  {
    id: 'bsc', code: '06', name: 'Beam steering controller', offset: -2.8,
    metric: 'BEAM HOPS', unit: '', metricKey: 'hops', metricConst: null,
    design: 'µs BEAM SWITCHING · 6-BIT PHASE',
    description: 'Computes a phase and gain word for every module per beam position, so the beam can jump anywhere in microseconds.',
  },
  {
    id: 'rex', code: '07', name: 'Receiver-exciter', offset: -3.5,
    metric: 'PRF', unit: 'Hz', metricKey: 'prf', metricConst: null,
    design: 'COHERENT EXCITER · 9.5 GHz',
    description: 'Generates the coherent X-band waveform (PRF, pulse width, frequency agility) and down-converts received echoes.',
  },
  {
    id: 'sdp', code: '08', name: 'Signal & data processor', offset: -4.2,
    metric: 'TRACKS', unit: '', metricKey: 'tracked', metricConst: null,
    design: 'PULSE-DOPPLER · TRACK-WHILE-SCAN',
    description: 'Pulse compression, Doppler filtering and CFAR detection; runs the tracker and schedules search and track dwells.',
  },
  {
    id: 'psu', code: '09', name: 'Power conditioning', offset: -4.9,
    metric: 'AVG POWER', unit: 'W', metricKey: 'avgPowerW', metricConst: null,
    design: 'PULSED DC BUS · ENERGY STORAGE',
    description: 'Converts prime power to the pulsed high-current DC bus feeding the module amplifiers; stores energy for each pulse.',
  },
  {
    id: 'chassis', code: '10', name: 'Backplane & chassis', offset: -5.8,
    metric: 'MASS', unit: 'kg', metricKey: null, metricConst: 640,
    design: 'MACHINED AL BACKPLANE · TRUNNION',
    description: 'Backplane carrying RF, DC and control interconnects, with the trunnion mount used to reposition the fixed-face array.',
  },
];

export const PART_IDS = PARTS.map((p) => p.id);
export const PART_BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p]));
