// Minimal i18n: string dictionaries per language, `t(key, vars)`, a language switch that
// re-applies every `[data-i18n]` element and notifies subscribers (panel, labels, dome).
import { tutorialEn, tutorialRu } from './i18n.tutorial.js';

export const LANGS = ['en', 'ru'];
const STORAGE_KEY = 'radar-lab-lang';

const en = {
  title: 'AESA / X-BAND — Array Laboratory',
  'top.wordmark': 'AESA', 'top.band': '/ X-BAND',
  'top.crumbs1': 'ARRAY SYSTEMS', 'top.crumbs2': 'VIRTUAL TEST CELL', 'top.lab': 'LAB / 001',
  'status.ready': 'SYSTEM READY', 'status.radiating': 'RADIATING', 'status.degraded': 'DEGRADED −{db} dB',
  'status.jammed': 'JAMMED', 'status.nulled': 'NULLED', 'status.overtemp': 'OVERTEMP',
  'sec.view': '01 VISUALIZATION', 'sec.camera': '02 CAMERA', 'sec.systems': '03 RADAR SYSTEMS',
  'view.assembled': 'ASSEMBLED', 'view.cutaway': 'CUTAWAY', 'view.xray': 'X-RAY', 'view.signal': 'SIGNAL PATH',
  'viewLabel.assembled': 'ASSEMBLED VIEW', 'viewLabel.cutaway': 'SECTION VIEW', 'viewLabel.xray': 'X-RAY VIEW', 'viewLabel.signal': 'SIGNAL PATH',
  'cam.rear': 'REAR', 'cam.front': 'FRONT', 'cam.plan': 'PLAN', 'cam.dome': 'DOME',
  'vp.eyebrow': 'X-BAND / ACTIVE ELECTRONICALLY SCANNED ARRAY', 'vp.headline': 'Aperture, exposed.',
  'vp.subtitle': '{view} / 576 T/R MODULES / 4 SUBARRAYS',
  'vp.idle': 'PRESS SPACE OR START TO RADIATE',
  'vp.exag': 'BEAM DRAWN 2× TRUE WIDTH · 1 OF 100 PULSES DRAWN · DWELLS ~10× SLOW · COVERAGE AZ ±70° EL −10…50° · 5° CELLS',
  'vp.hint': 'DRAG TO ORBIT · SCROLL TO ZOOM · CLICK TO INSPECT',
  'vp.inset': 'APERTURE · FROM FRONT',
  'legend.search': 'SEARCH BEAM / TX PULSE', 'legend.track': 'TRACK BEAM', 'legend.echo': 'ECHO / DETECTION',
  'legend.target': 'TARGET (BRACKET = TRACKED)', 'legend.fault': 'FAULT / JAMMER', 'legend.rf': 'RF PATH',
  'legend.control': 'STEERING COMMANDS (DASHED)', 'legend.standby': 'STANDBY',
  'roster.search': 'B{id}  SEARCH · {qs} · {pattern} {where} · {width}° · {pps} PPS',
  'roster.track': 'B{id}  TRACK · {qs} · {tgt} · {width}°',
  'roster.bar': 'BAR {n}/8', 'roster.hop': 'HOP #{n}', 'roster.trackDwell': 'TRACK DWELL',
  'roster.acquiring': 'ACQUIRING', 'roster.onTarget': '→ T{id} · DWELL {s} s',
  'insp.title': '04 COMPONENT INSPECTOR', 'insp.sysNone': 'SYS · —', 'insp.sys': 'SYS · {code}',
  'insp.none': 'Select a component', 'insp.noneDesc': 'Click a part in the 3-D view or in the systems list to inspect it.',
  'tel.title': 'LIVE TELEMETRY', 'tel.rate': '10 Hz', 'tel.jam': 'MAINBEAM JAM — RECEIVER SATURATED',
  'tel.beamAzDeg': 'BEAM AZ', 'tel.beamElDeg': 'BEAM EL', 'tel.steerAngleDeg': 'STEER ANGLE', 'tel.beamwidthDeg': 'BEAMWIDTH',
  'tel.scanLossDb': 'SCAN LOSS', 'tel.prf': 'PRF', 'tel.unambRangeKm': 'UNAMBIG. RANGE', 'tel.dutyCycle': 'DUTY CYCLE',
  'tel.peakPowerKw': 'PEAK POWER', 'tel.avgPowerKw': 'AVG POWER', 'tel.activeElements': 'ACTIVE ELEMENTS', 'tel.activeBeams': 'BEAMS',
  'tel.tracked': 'TRACKS', 'tel.detected': 'DETECTIONS', 'tel.hops': 'BEAM HOPS', 'tel.dwellMs': 'DWELL',
  'tel.pulsesPerDwell': 'PULSES / DWELL', 'tel.eirpLossDb': 'EIRP LOSS', 'tel.arrayTempC': 'ARRAY TEMP',
  'tel.pulsesSent': 'PULSES SENT', 'tel.echoes': 'ECHOES',
  'chart.az': 'BEAM AZ', 'chart.el': 'EL', 'chart.temp': 'TEMP', 'chart.window': '60 s',
  'unit.hz': 'Hz', 'unit.km': 'km', 'unit.db': 'dB', 'unit.kw': 'kW', 'unit.w': 'W', 'unit.ms': 'ms', 'unit.c': '°C', 'unit.kg': 'kg', 'unit.pct': '%',
  'ctl.title': 'RADAR CONTROL', 'ctl.keys': 'CTRL / SPACE', 'ctl.start': 'START RADIATING', 'ctl.stop': 'STOP RADIATING', 'ctl.reset': 'RESET',
  'scan.title': 'SCAN PATTERN', 'scan.rate': 'SCAN RATE',
  'scan.hint': 'BEAM HOPS IN µs — NO INERTIA · A REAL AESA TIME-SHARES THE FULL APERTURE BETWEEN SEARCH AND TRACK DWELLS',
  'pattern.sector': 'SECTOR', 'pattern.raster': 'RASTER (8-BAR)', 'pattern.circular': 'CIRCULAR (CUED ACQ.)',
  'pattern.spiral': 'SPIRAL (ACQUISITION)', 'pattern.agile': 'AGILE (RANDOM HOPS)',
  'patternShort.sector': 'SECTOR', 'patternShort.raster': 'RASTER', 'patternShort.circular': 'CIRCULAR', 'patternShort.spiral': 'SPIRAL', 'patternShort.agile': 'AGILE',
  'emit.title': 'EMISSION', 'emit.prf': 'PRF', 'emit.power': 'POWER', 'emit.explode': 'EXPLODE', 'emit.hint': 'Rᵤ = c / 2·PRF · 12 W GaN MODULES',
  'sub.title': 'SUBARRAY TASKING', 'sub.front': 'FRONT VIEW (+Z)', 'sub.rear': 'REAR VIEW (−Z) · MIRRORED',
  'sub.hint': 'SPLITTING THE FACE GIVES SIMULTANEOUS BEAMS BUT EACH LOSES 6 dB EIRP PER HALVING AND DOUBLES ITS BEAMWIDTH',
  'mode.search': 'SEARCH', 'mode.track': 'TRACK', 'mode.standby': 'STBY', 'tile.acq': 'ACQ',
  'fail.title': 'FAILURE SIMULATION', 'fail.note': 'CONTROLLED EVENT', 'fail.modules': 'FAIL 15 % OF T/R MODULES',
  'fail.jam': 'SIMULATE JAMMING', 'fail.null': 'ADAPTIVE NULL',
  'fail.readout': 'EIRP −{db} dB · SIDELOBE FLOOR ≈ −35 dB', 'fail.nominal': 'ALL 576 MODULES NOMINAL',
  'foot.left': 'CONCEPTUAL ENGINEERING VISUALIZATION', 'foot.band': 'X-BAND 9.5 GHz / λ 31.6 mm /', 'foot.calls': 'CALLS /', 'foot.fps': 'FPS',
  'dome.target': 'T{id} · {km} km · σ {rcs} m²',
  'lang.en': 'EN', 'lang.ru': 'RU',
  'font.smaller': 'Smaller text', 'font.larger': 'Larger text', 'font.reset': 'Reset text size to 100 %',
  'pat.title': '04 ANTENNA PATTERN', 'pat.search': 'SEARCH BEAM LOBE (3-D)', 'pat.track': 'TRACK BEAM LOBES (3-D)', 'pat.cuts': 'AZ / EL CUTS',
  'pat.spacing': 'SPACING', 'pat.taper': 'TAPER', 'pat.readout': 'BW {bw}° · SLL {sll} dB · PEAK {peak} dB', 'pat.grating': 'GRATING LOBE',
  'pat.hint': 'PATTERN FROM ALL 576 ELEMENT STATES · 0 dB = FULL UNIFORM ARRAY · FLOOR −40 dB', 'legend.pattern': 'PATTERN LOBE (dB SURFACE)',
  'rm.title': '05 RESOURCE MANAGER', 'rm.timeline': 'DWELL TIMELINE', 'rm.revisit': 'REVISIT', 'rm.cap': 'TRACK CAP',
  'rm.load': 'SEARCH {s} % · TRACK {t} % · CONFIRM {c} %', 'rm.tracks': 'TWS TRACKS {n} · SEARCH FRAME {f}',
  'rm.overload': 'OVERLOAD — LOWEST-PRIORITY TRACK DROPPED', 'rm.hint': 'PRIORITY: CONFIRM > TRACK UPDATE > SEARCH · SEARCH ONLY ADVANCES IN ITS OWN DWELLS',
  'tl.pooled': 'B0 POOLED', 'tl.search': 'SEARCH', 'tl.track': 'TRACK', 'tl.confirm': 'CONFIRM', 'dome.tws': 'TWS',
  'theme.dark': 'DARK', 'theme.light': 'LIGHT', 'theme.title': 'Colour theme (the 3-D view stays dark: its glow is additive)',
};

const ru = {
  title: 'АФАР / X-ДИАПАЗОН — Антенная лаборатория',
  'top.wordmark': 'АФАР', 'top.band': '/ X-ДИАПАЗОН',
  'top.crumbs1': 'АНТЕННЫЕ СИСТЕМЫ', 'top.crumbs2': 'ВИРТУАЛЬНЫЙ СТЕНД', 'top.lab': 'ЛАБ / 001',
  'status.ready': 'СИСТЕМА ГОТОВА', 'status.radiating': 'ИЗЛУЧЕНИЕ', 'status.degraded': 'ДЕГРАДАЦИЯ −{db} дБ',
  'status.jammed': 'ПОМЕХА', 'status.nulled': 'НУЛЬ ДН', 'status.overtemp': 'ПЕРЕГРЕВ',
  'sec.view': '01 ВИЗУАЛИЗАЦИЯ', 'sec.camera': '02 КАМЕРА', 'sec.systems': '03 СИСТЕМЫ РЛС',
  'view.assembled': 'В СБОРЕ', 'view.cutaway': 'РАЗРЕЗ', 'view.xray': 'РЕНТГЕН', 'view.signal': 'ТРАКТ СИГНАЛА',
  'viewLabel.assembled': 'ВИД В СБОРЕ', 'viewLabel.cutaway': 'ВИД В РАЗРЕЗЕ', 'viewLabel.xray': 'РЕНТГЕН', 'viewLabel.signal': 'ТРАКТ СИГНАЛА',
  'cam.rear': 'СЗАДИ', 'cam.front': 'СПЕРЕДИ', 'cam.plan': 'СВЕРХУ', 'cam.dome': 'КУПОЛ',
  'vp.eyebrow': 'X-ДИАПАЗОН / АКТИВНАЯ ФАЗИРОВАННАЯ АНТЕННАЯ РЕШЁТКА', 'vp.headline': 'Апертура, без покровов.',
  'vp.subtitle': '{view} / 576 ППМ / 4 ПОДРЕШЁТКИ',
  'vp.idle': 'НАЖМИТЕ ПРОБЕЛ ИЛИ «ПУСК», ЧТОБЫ НАЧАТЬ ИЗЛУЧЕНИЕ',
  'vp.exag': 'ЛУЧ НАРИСОВАН В 2× ШИРЕ · ПОКАЗАН 1 ИЗ 100 ИМПУЛЬСОВ · ДИСКРЕТЫ ~10× МЕДЛЕННЕЕ · ЗОНА ОБЗОРА АЗ ±70° УМ −10…50° · ЯЧЕЙКИ 5°',
  'vp.hint': 'ВРАЩЕНИЕ — МЫШЬ · МАСШТАБ — КОЛЕСО · КЛИК — ОСМОТР',
  'vp.inset': 'АПЕРТУРА · ВИД СПЕРЕДИ',
  'legend.search': 'ОБЗОРНЫЙ ЛУЧ / ИМПУЛЬС', 'legend.track': 'ЛУЧ СОПРОВОЖДЕНИЯ', 'legend.echo': 'ЭХО / ОБНАРУЖЕНИЕ',
  'legend.target': 'ЦЕЛЬ (В СКОБКАХ = СОПРОВОЖДАЕТСЯ)', 'legend.fault': 'ОТКАЗ / ПОСТАНОВЩИК ПОМЕХ', 'legend.rf': 'ВЧ-ТРАКТ',
  'legend.control': 'КОМАНДЫ УПРАВЛЕНИЯ ЛУЧОМ (ПУНКТИР)', 'legend.standby': 'РЕЗЕРВ',
  'roster.search': 'B{id}  ОБЗОР · {qs} · {pattern} {where} · {width}° · {pps} ИМП/С',
  'roster.track': 'B{id}  СОПР. · {qs} · {tgt} · {width}°',
  'roster.bar': 'СТРОКА {n}/8', 'roster.hop': 'СКАЧОК №{n}', 'roster.trackDwell': 'ДИСКРЕТ СОПР.',
  'roster.acquiring': 'ЗАХВАТ', 'roster.onTarget': '→ T{id} · ДИСКРЕТ {s} с',
  'insp.title': '04 ИНСПЕКТОР КОМПОНЕНТОВ', 'insp.sysNone': 'СИС · —', 'insp.sys': 'СИС · {code}',
  'insp.none': 'Выберите компонент', 'insp.noneDesc': 'Нажмите на деталь в 3D-виде или в списке систем, чтобы осмотреть её.',
  'tel.title': 'ТЕЛЕМЕТРИЯ', 'tel.rate': '10 Гц', 'tel.jam': 'ПОМЕХА ПО ГЛАВНОМУ ЛУЧУ — ПРИЁМНИК НАСЫЩЕН',
  'tel.beamAzDeg': 'АЗИМУТ ЛУЧА', 'tel.beamElDeg': 'УГОЛ МЕСТА', 'tel.steerAngleDeg': 'УГОЛ ОТКЛОНЕНИЯ', 'tel.beamwidthDeg': 'ШИРИНА ЛУЧА',
  'tel.scanLossDb': 'ПОТЕРИ СКАНИР.', 'tel.prf': 'ЧПИ', 'tel.unambRangeKm': 'ОДНОЗН. ДАЛЬНОСТЬ', 'tel.dutyCycle': 'СКВАЖНОСТЬ',
  'tel.peakPowerKw': 'ПИКОВАЯ МОЩН.', 'tel.avgPowerKw': 'СРЕДНЯЯ МОЩН.', 'tel.activeElements': 'АКТИВНЫХ ЭЛЕМ.', 'tel.activeBeams': 'ЛУЧЕЙ',
  'tel.tracked': 'ТРАСС', 'tel.detected': 'ОБНАРУЖЕНИЙ', 'tel.hops': 'СКАЧКОВ ЛУЧА', 'tel.dwellMs': 'ДИСКРЕТ',
  'tel.pulsesPerDwell': 'ИМП. / ДИСКРЕТ', 'tel.eirpLossDb': 'ПОТЕРИ ЭИИМ', 'tel.arrayTempC': 'ТЕМП. РЕШЁТКИ',
  'tel.pulsesSent': 'ИМП. ИЗЛУЧЕНО', 'tel.echoes': 'ЭХО-СИГНАЛОВ',
  'chart.az': 'АЗ ЛУЧА', 'chart.el': 'УМ', 'chart.temp': 'ТЕМП', 'chart.window': '60 с',
  'unit.hz': 'Гц', 'unit.km': 'км', 'unit.db': 'дБ', 'unit.kw': 'кВт', 'unit.w': 'Вт', 'unit.ms': 'мс', 'unit.c': '°C', 'unit.kg': 'кг', 'unit.pct': '%',
  'ctl.title': 'УПРАВЛЕНИЕ РЛС', 'ctl.keys': 'CTRL / ПРОБЕЛ', 'ctl.start': 'ПУСК ИЗЛУЧЕНИЯ', 'ctl.stop': 'СТОП ИЗЛУЧЕНИЯ', 'ctl.reset': 'СБРОС',
  'scan.title': 'РЕЖИМ ОБЗОРА', 'scan.rate': 'СКОРОСТЬ',
  'scan.hint': 'ЛУЧ ПЕРЕКЛЮЧАЕТСЯ ЗА мкс — БЕЗ ИНЕРЦИИ · РЕАЛЬНАЯ АФАР ДЕЛИТ ВРЕМЯ ВСЕЙ АПЕРТУРЫ МЕЖДУ ОБЗОРОМ И СОПРОВОЖДЕНИЕМ',
  'pattern.sector': 'СЕКТОР', 'pattern.raster': 'РАСТР (8 СТРОК)', 'pattern.circular': 'КРУГОВОЙ (ЗАХВАТ ПО ЦУ)',
  'pattern.spiral': 'СПИРАЛЬ (ЗАХВАТ)', 'pattern.agile': 'ГИБКИЙ (СЛУЧАЙНЫЕ СКАЧКИ)',
  'patternShort.sector': 'СЕКТОР', 'patternShort.raster': 'РАСТР', 'patternShort.circular': 'КРУГОВОЙ', 'patternShort.spiral': 'СПИРАЛЬ', 'patternShort.agile': 'ГИБКИЙ',
  'emit.title': 'ИЗЛУЧЕНИЕ', 'emit.prf': 'ЧПИ', 'emit.power': 'МОЩНОСТЬ', 'emit.explode': 'РАЗНЕСЕНИЕ', 'emit.hint': 'Rодн = c / 2·ЧПИ · МОДУЛИ GaN 12 Вт',
  'sub.title': 'ЗАДАЧИ ПОДРЕШЁТОК', 'sub.front': 'ВИД СПЕРЕДИ (+Z)', 'sub.rear': 'ВИД СЗАДИ (−Z) · ЗЕРКАЛЬНО',
  'sub.hint': 'РАЗДЕЛЕНИЕ ПОЛОТНА ДАЁТ ОДНОВРЕМЕННЫЕ ЛУЧИ, НО КАЖДЫЙ ТЕРЯЕТ 6 дБ ЭИИМ НА КАЖДОЕ ДЕЛЕНИЕ ПОПОЛАМ И ВДВОЕ РАСШИРЯЕТСЯ',
  'mode.search': 'ОБЗОР', 'mode.track': 'СОПР.', 'mode.standby': 'РЕЗЕРВ', 'tile.acq': 'ЗАХВ.',
  'fail.title': 'ИМИТАЦИЯ ОТКАЗОВ', 'fail.note': 'УПРАВЛЯЕМОЕ СОБЫТИЕ', 'fail.modules': 'ОТКАЗ 15 % ППМ',
  'fail.jam': 'ИМИТАЦИЯ ПОМЕХ', 'fail.null': 'АДАПТИВНЫЙ НУЛЬ',
  'fail.readout': 'ЭИИМ −{db} дБ · УРОВЕНЬ БОКОВЫХ ≈ −35 дБ', 'fail.nominal': 'ВСЕ 576 МОДУЛЕЙ ИСПРАВНЫ',
  'foot.left': 'КОНЦЕПТУАЛЬНАЯ ИНЖЕНЕРНАЯ ВИЗУАЛИЗАЦИЯ', 'foot.band': 'X-ДИАПАЗОН 9,5 ГГц / λ 31,6 мм /', 'foot.calls': 'ВЫЗОВОВ /', 'foot.fps': 'К/С',
  'dome.target': 'T{id} · {km} км · σ {rcs} м²',
  'lang.en': 'EN', 'lang.ru': 'RU',
  'font.smaller': 'Мельче текст', 'font.larger': 'Крупнее текст', 'font.reset': 'Сбросить размер текста на 100 %',
  'pat.title': '04 ДИАГРАММА НАПРАВЛЕННОСТИ', 'pat.search': 'ЛЕПЕСТОК ОБЗОРНОГО ЛУЧА (3D)', 'pat.track': 'ЛЕПЕСТКИ ЛУЧЕЙ СОПР. (3D)', 'pat.cuts': 'СЕЧЕНИЯ ПО АЗ / УМ',
  'pat.spacing': 'ШАГ', 'pat.taper': 'ВЗВЕШ.', 'pat.readout': 'ШЛ {bw}° · УБЛ {sll} дБ · МАКС {peak} дБ', 'pat.grating': 'ДИФР. ЛЕПЕСТОК',
  'pat.hint': 'ДИАГРАММА ПО СОСТОЯНИЮ ВСЕХ 576 ЭЛЕМЕНТОВ · 0 дБ = ПОЛНАЯ РАВНОМЕРНАЯ РЕШЁТКА · НИЗ −40 дБ', 'legend.pattern': 'ЛЕПЕСТОК ДН (ПОВЕРХНОСТЬ дБ)',
  'rm.title': '05 ДИСПЕТЧЕР РЕСУРСА', 'rm.timeline': 'ЛЕНТА ДИСКРЕТОВ', 'rm.revisit': 'ОБНОВЛ.', 'rm.cap': 'ЛИМИТ СОПР.',
  'rm.load': 'ОБЗОР {s} % · СОПР. {t} % · ПОДТВ. {c} %', 'rm.tracks': 'ТРАСС СНП {n} · ЦИКЛ ОБЗОРА {f}',
  'rm.overload': 'ПЕРЕГРУЗКА — СБРОШЕНА ТРАССА С НИЗШИМ ПРИОРИТЕТОМ', 'rm.hint': 'ПРИОРИТЕТ: ПОДТВЕРЖДЕНИЕ > ОБНОВЛЕНИЕ ТРАССЫ > ОБЗОР · ОБЗОР ИДЁТ ТОЛЬКО В СВОИХ ДИСКРЕТАХ',
  'tl.pooled': 'B0 ОБЩИЙ', 'tl.search': 'ОБЗОР', 'tl.track': 'СОПР.', 'tl.confirm': 'ПОДТВ.', 'dome.tws': 'СНП',
  'theme.dark': 'ТЁМНАЯ', 'theme.light': 'СВЕТЛАЯ', 'theme.title': 'Цветовая тема (3D-вид остаётся тёмным: его свечение аддитивное)',

  // parts catalogue — name / description / design / metric (units come from unit.* keys via parts.js)
  'part.radome.name': 'Обтекатель',
  'part.radome.description': 'Малопотерьный трёхслойный диэлектрический обтекатель, защищающий апертуру; настроен так, что X-диапазон проходит с потерями ~0,4 дБ в одну сторону.',
  'part.radome.design': 'ТРЁХСЛОЙНЫЙ ДИЭЛЕКТРИК · ПОТЕРИ 0,4 дБ', 'part.radome.metric': 'ПОТЕРИ',
  'part.aperture.name': 'Решётка излучателей',
  'part.aperture.description': 'Один излучатель на каждый ППМ на решётке с шагом полволны (15,8 мм на 9,5 ГГц); диаграмма элемента ограничивает полезное сканирование ±60°.',
  'part.aperture.design': 'РЕШЁТКА 24 × 24 λ/2 · СЛОЙ WAIM', 'part.aperture.metric': 'УГОЛ ОТКЛОНЕНИЯ',
  'part.trm.name': 'Слой приёмо-передающих модулей',
  'part.trm.description': 'На каждый элемент — свой ППМ: усилитель мощности на GaN, МШУ, ограничитель, 6-битный фазовращатель и аттенюатор, перезагружаемые контроллером на каждый луч.',
  'part.trm.design': '576 ППМ НА GaN · 12 Вт ПИК · 6-БИТ ФАЗА', 'part.trm.metric': 'АКТИВНЫХ МОДУЛЕЙ',
  'part.coldplate.name': 'Холодная плита и коллектор охлаждения',
  'part.coldplate.description': 'Жидкостная плита, прилегающая к слою ППМ; отводит тепло усилителей, которое иначе ограничивает скважность и ресурс модулей.',
  'part.coldplate.design': 'ЖИДКОСТНЫЙ КОНТУР PAO · ПРЕДЕЛ 85 °C', 'part.coldplate.metric': 'ТЕМП. РЕШЁТКИ',
  'part.manifold.name': 'ВЧ-коллектор / диаграммообразующая схема',
  'part.manifold.description': 'Пассивная схема, объединяющая 144 элемента каждого квадранта в порт подрешётки; четыре порта дают независимые лучи.',
  'part.manifold.design': '4 ПОРТА ПОДРЕШЁТОК · ПОЛОСКОВЫЙ СУММАТОР', 'part.manifold.metric': 'ПОРТЫ ПОДРЕШЁТОК',
  'part.bsc.name': 'Контроллер управления лучом',
  'part.bsc.description': 'Вычисляет фазу и усиление для каждого модуля на каждое положение луча, поэтому луч перебрасывается в любую точку за микросекунды.',
  'part.bsc.design': 'ПЕРЕКЛЮЧЕНИЕ ЛУЧА ЗА мкс · 6-БИТ ФАЗА', 'part.bsc.metric': 'СКАЧКОВ ЛУЧА',
  'part.rex.name': 'Приёмник-возбудитель',
  'part.rex.description': 'Формирует когерентный сигнал X-диапазона (ЧПИ, длительность импульса, перестройка частоты) и переносит принятые эхо-сигналы на промежуточную частоту.',
  'part.rex.design': 'КОГЕРЕНТНЫЙ ВОЗБУДИТЕЛЬ · 9,5 ГГц', 'part.rex.metric': 'ЧПИ',
  'part.sdp.name': 'Процессор сигналов и данных',
  'part.sdp.description': 'Сжатие импульсов, доплеровская фильтрация и обнаружение CFAR; ведёт трассы и планирует обзорные и сопроводительные дискреты.',
  'part.sdp.design': 'ИМПУЛЬСНО-ДОПЛЕРОВСКИЙ · СОПРОВОЖДЕНИЕ НА ПРОХОДЕ', 'part.sdp.metric': 'ТРАСС',
  'part.psu.name': 'Преобразователь питания',
  'part.psu.description': 'Преобразует первичное питание в импульсную сильноточную шину постоянного тока для усилителей модулей; накапливает энергию на каждый импульс.',
  'part.psu.design': 'ИМПУЛЬСНАЯ ШИНА DC · НАКОПИТЕЛЬ ЭНЕРГИИ', 'part.psu.metric': 'СРЕДНЯЯ МОЩНОСТЬ',
  'part.chassis.name': 'Объединительная плата и шасси',
  'part.chassis.description': 'Плата с ВЧ-, силовыми и управляющими соединениями и цапфовая подвеска для переориентации неподвижного полотна решётки.',
  'part.chassis.design': 'ФРЕЗЕРОВАННАЯ AL ПЛАТА · ЦАПФЫ', 'part.chassis.metric': 'МАССА',
};

Object.assign(en, tutorialEn);
Object.assign(ru, tutorialRu);
const DICT = { en, ru };
const subscribers = new Set();
let lang = detectLanguage();

function detectLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch { /* storage unavailable */ }
  return (navigator.language || '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function t(key, vars) {
  let s = DICT[lang][key] ?? en[key] ?? key;
  if (vars) for (const k in vars) s = s.replace(`{${k}}`, vars[k]);
  return s;
}

/** Localised field of a parts-catalogue entry, falling back to the English text in parts.js. */
export function tPart(part, field) {
  return DICT[lang][`part.${part.id}.${field}`] ?? part[field];
}

export function getLang() { return lang; }

export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return;
  lang = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  applyStatic();
  for (const fn of subscribers) fn(next);
}

export function onLangChange(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Re-applies every element carrying data-i18n (textContent) and the document title. */
export function applyStatic(root = document) {
  document.documentElement.lang = lang;
  document.title = t('title');
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
}
