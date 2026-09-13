// Tutorial texts (merged into the main dictionaries by i18n.js). Bodies may contain simple
// inline HTML (<b>, <i>, <sup>, <br>) — they are authored here, never user-supplied.
export const tutorialEn = {
  'tut.button': 'TUTORIAL', 'tut.next': 'NEXT', 'tut.back': 'BACK', 'tut.finish': 'FINISH', 'tut.exit': 'Exit tutorial',
  'tut.stepOf': 'STEP {n} / {total}', 'tut.try': 'TRY IT',

  'tut.intro.title': 'What is an AESA?',
  'tut.intro.body': `An <b>active electronically scanned array</b> has no moving dish. Its face is a grid of 576 small radiators, each driven by its own transmit/receive (T/R) module with a phase shifter. Setting a different phase on every module tilts the wavefront and points the beam — in microseconds, with nothing mechanical.<br><br>This tour goes through the hardware stack first, then through what the radar is doing while it radiates. Use <b>Next</b> / <b>Back</b> or the ← → keys; <b>Esc</b> exits and restores your settings.`,

  'tut.stack.title': 'The component stack',
  'tut.stack.body': `Front to back: the <b>radome</b> protects the face; the <b>element array</b> radiates; every element has a <b>T/R module</b> behind it; the <b>cold plate</b> carries away the amplifier heat; the <b>RF manifold</b> combines each quadrant's 144 elements into one port; the <b>beam steering controller</b> loads a phase word into every module for every beam; the <b>receiver-exciter</b> generates the waveform; the <b>signal processor</b> detects and tracks; <b>power conditioning</b> feeds the pulsed amplifiers; the <b>backplane</b> ties it all to a trunnion mount.`,
  'tut.stack.try': 'Hover or click a layer, or drag the EXPLODE slider.',

  'tut.aperture.title': 'The radiating face',
  'tut.aperture.body': `The elements sit on a <b>half-wavelength lattice</b> — 15.8 mm at 9.5 GHz (the model is drawn about 6× oversize). Half-wave spacing is what lets the array steer out to ±60° without <i>grating lobes</i>, spurious beams that would appear at wider spacing. The inset at the top right always shows the face from the front.`,

  'tut.trm.title': 'T/R modules',
  'tut.trm.body': `Behind each element is one module: a GaN <b>power amplifier</b> (about 12 W peak here), a <b>low-noise amplifier</b> for receive, a <b>limiter</b> that protects it, a <b>6-bit phase shifter</b> (64 steps of 5.6°) and an <b>attenuator</b>. 576 of them share the work — there is no single high-power transmitter whose failure would silence the radar.`,

  'tut.steering.title': 'Phase steering',
  'tut.steering.body': `To point the beam at angle θ the controller gives element n the phase <b>−k·x<sub>n</sub>·sin θ</b>. On the face this appears as <b>fringes</b> — bands of equal phase perpendicular to the steer direction — and they get tighter the further the beam steers. Watch the inset while the sector scan sweeps ±60°.<br><br>Every change of pointing is a <b>hop</b>: the phases are reloaded and the beam jumps. There is no slewing and no inertia.`,

  'tut.beamwidth.title': 'Beamwidth and scan loss',
  'tut.beamwidth.body': `Twenty-four half-wave elements per side give a <b>4.2°</b> beam at boresight. Off boresight the array looks smaller — its projected width shrinks as cos θ — so the beam <b>broadens as 1/cos θ</b> and the gain falls roughly as cos<sup>1.3</sup> θ. At 60° the beam is twice as wide and about 4 dB weaker. That is why one flat face covers only ±60–70°, and 360° needs several faces.`,
  'tut.beamwidth.try': 'Watch BEAMWIDTH and SCAN LOSS in the telemetry as the beam reaches the sector edges.',

  'tut.pattern.title': 'The antenna pattern: sidelobes, taper, grating lobes',
  'tut.pattern.body': `The translucent lobe is the array's real <b>radiation pattern</b>, recomputed from all 576 element phases and weights on every hop: the main lobe, the first sidelobes at −13 dB for uniform illumination, and the nulls between them. Dead modules and single-quadrant beams change it live, and the plot on the left shows the azimuth and elevation cuts in dB.<br><br><b>Taper</b> lowers the edge elements' amplitude: sidelobes sink, but the beam widens and gain drops — the eternal trade. On transmit a taper also throws away amplifier power, which is why real AESAs run the transmitters flat out and taper on receive only. <b>Element spacing</b> above λ/2 lets a <b>grating lobe</b>, a second full-strength beam, appear as the array steers — which is why the lattice is half-wave.`,
  'tut.pattern.try': 'Raise TAPER and watch the sidelobes sink in the plot; set SPACING to 0.8 λ and watch a grating lobe grow as the sector scan steers.',
  'tut.pulses.title': 'Pulses and echoes',
  'tut.pulses.body': `The radar transmits short pulses. Each <b>ring</b> is a wavefront leaving the aperture — at the instant of emission it is a plane tilted by the steer angle. When a pulse crosses a target inside the beam, an <b>echo</b> (white dot) travels back to the face, and the detection is registered when it arrives.<br><br>The <b>PRF</b> sets pulses per second — and the maximum unambiguous range <b>R = c / (2·PRF)</b>: a higher PRF means the next pulse leaves before a distant echo is back.`,
  'tut.pulses.try': 'Move the PRF slider and watch UNAMBIG. RANGE (1 of 100 pulses is drawn).',

  'tut.dome.title': 'The coverage dome and scan patterns',
  'tut.dome.body': `The dome in the distance is the radar's sky, divided into <b>5° cells</b> of azimuth and elevation. A cell glows while the beam points at it, flashes when a pulse arrives, then fades — leaving a slow trace that lets you read the pattern: a <b>raster</b> of bars for volume search, a <b>sector</b> sweep, a small <b>circle</b> or a <b>spiral</b> to re-acquire a target that was cued from elsewhere. The dashed line is the pattern's path.`,
  'tut.dome.try': 'Switch between the scan patterns.',

  'tut.subarrays.title': 'Search and track at the same time',
  'tut.subarrays.body': `The face is split into four <b>quadrants</b>, each with its own port on the manifold. Quadrants in SEARCH pool into one search beam (teal). A quadrant switched to <b>TRACK</b> forms its own beam (amber) from its own phase centre, acquires a detected target and follows it with 10 Hz updates.<br><br>The price of splitting: a quarter of the face makes a beam <b>twice as wide</b> and loses <b>6 dB</b> of EIRP for every halving.`,
  'tut.subarrays.try': 'Click the quadrant tiles to change their tasking.',

  'tut.agile.title': 'How a real AESA does it: time-sharing',
  'tut.agile.body': `Splitting the face is one option. What a real AESA mostly does is <b>interleave in time</b>: the whole aperture hops through search positions and, whenever a track is due, spends one short dwell on it (shown amber; white for a confirmation of a fresh detection). Because a hop costs microseconds, a single array can search a volume, track dozens of targets and update missile guidance within the same second.`,
  'tut.manager.title': 'The resource manager',
  'tut.manager.body': `The strip at the bottom of the view is the radar's <b>schedule</b>: every dwell of the pooled beam in the last six seconds — teal search positions, white <b>confirmation</b> dwells fired at fresh detections, amber <b>track updates</b> due every revisit interval — plus the dedicated quadrant beams on their own lanes. Priority is confirm > track > search, and the search pattern only advances during its own dwells, so every track you carry stretches the <b>search frame</b>. When track load exceeds the cap, the manager sheds the lowest-priority (farthest) track rather than let search starve.`,
  'tut.manager.try': 'Set REVISIT to 0.3 s and watch search time collapse and the frame stretch; lower TRACK CAP until a track is dropped (red marker).',

  'tut.signal.title': 'Inside: the signal path',
  'tut.signal.body': `<b>Purple</b>: the RF chain. The exciter's waveform goes through the manifold and the T/R modules to the elements, and echoes come back the same way — the dashes run backwards for a moment when an echo is received.<br><br><b>Teal dashes</b>: the beam steering controller's commands, which flash to all four quadrants on every hop. Those commands are what makes the array "electronically scanned".`,

  'tut.degradation.title': 'Graceful degradation',
  'tut.degradation.body': `With 15 % of the modules dead (black elements in the inset) the radar keeps working. Random failures <b>do not widen the beam</b> — beamwidth comes from the aperture size, which is unchanged. They cost about <b>1.4 dB of EIRP</b> and raise the diffuse <b>sidelobe floor</b>: the faint wide halo around the beam and the speckle on the dome.`,
  'tut.degradation.try': 'Toggle the failure button and compare EIRP LOSS.',

  'tut.jamming.title': 'Jamming',
  'tut.jamming.body': `A noise jammer at azimuth +40° floods the receiver. When the beam points near it the receiver <b>saturates</b> — the red strobe on the dome and the MAINBEAM JAM warning — and through the sidelobes it raises the noise along that whole bearing, hiding targets there.`,

  'tut.nulling.title': 'Adaptive nulling',
  'tut.nulling.body': `Because every module's phase and gain is adjustable, the array can reshape its pattern to put a <b>null</b> on the jammer's bearing — the red outline on the dome — while keeping the main beam elsewhere, and recover detections. This electronic counter-countermeasure is something a mechanically scanned dish cannot do.`,

  'tut.thermal.title': 'Duty cycle and heat',
  'tut.thermal.body': `Average power = peak power × <b>duty cycle</b> (PRF × pulse width). The T/R amplifiers turn most of it into heat, which is why the cold plate sits directly behind them. With PRF and power at maximum, watch the array temperature climb toward the 85 °C limit — in practice it is duty cycle and cooling, not peak power, that bound how long and how far a radar can look.`,
  'tut.thermal.try': 'Lower PRF or POWER and watch the temperature fall.',

  'tut.end.title': "You're ready",
  'tut.end.body': `Recap: a phase per module points the beam in microseconds · pointing is a sequence of hops and dwells · pulses go out as wavefronts and echoes come back · one flat face covers ±60° · search and track share the array by splitting it or by time-sharing · failures degrade gracefully, and jamming can be nulled.<br><br>Keys: <b>Space</b> start/stop · <b>1–4</b> view modes · <b>E</b> explode · <b>EN/RU</b> language. Explore!`,
};

export const tutorialRu = {
  'tut.button': 'ОБУЧЕНИЕ', 'tut.next': 'ДАЛЕЕ', 'tut.back': 'НАЗАД', 'tut.finish': 'ЗАВЕРШИТЬ', 'tut.exit': 'Выйти из обучения',
  'tut.stepOf': 'ШАГ {n} / {total}', 'tut.try': 'ПОПРОБУЙТЕ',

  'tut.intro.title': 'Что такое АФАР?',
  'tut.intro.body': `У <b>активной фазированной антенной решётки</b> нет подвижного зеркала. Её полотно — сетка из 576 небольших излучателей, каждый со своим приёмо-передающим модулем (ППМ) и фазовращателем. Задавая каждому модулю свою фазу, решётка наклоняет фронт волны и поворачивает луч — за микросекунды, без единой движущейся детали.<br><br>Сначала пройдём по аппаратной части, затем — по тому, что делает РЛС во время излучения. Используйте <b>Далее</b> / <b>Назад</b> или клавиши ← →; <b>Esc</b> выходит и восстанавливает ваши настройки.`,

  'tut.stack.title': 'Состав изделия',
  'tut.stack.body': `Спереди назад: <b>обтекатель</b> защищает полотно; <b>решётка излучателей</b> излучает; за каждым элементом стоит свой <b>ППМ</b>; <b>холодная плита</b> отводит тепло усилителей; <b>ВЧ-коллектор</b> объединяет 144 элемента каждого квадранта в один порт; <b>контроллер луча</b> загружает в каждый модуль фазовое слово для каждого положения луча; <b>приёмник-возбудитель</b> формирует сигнал; <b>процессор</b> обнаруживает и сопровождает; <b>преобразователь питания</b> питает импульсные усилители; <b>объединительная плата</b> собирает всё на цапфовой подвеске.`,
  'tut.stack.try': 'Наведите или нажмите на слой, либо потяните ползунок РАЗНЕСЕНИЕ.',

  'tut.aperture.title': 'Излучающее полотно',
  'tut.aperture.body': `Элементы стоят на <b>решётке с шагом полволны</b> — 15,8 мм на 9,5 ГГц (модель нарисована примерно в 6 раз крупнее). Именно полуволновой шаг позволяет отклонять луч до ±60° без <i>дифракционных лепестков</i> — паразитных лучей, которые появились бы при большем шаге. Врезка справа вверху всегда показывает полотно спереди.`,

  'tut.trm.title': 'Приёмо-передающие модули',
  'tut.trm.body': `За каждым элементом — один модуль: <b>усилитель мощности</b> на GaN (здесь около 12 Вт в импульсе), <b>малошумящий усилитель</b> на приём, <b>ограничитель</b> для его защиты, <b>6-битный фазовращатель</b> (64 ступени по 5,6°) и <b>аттенюатор</b>. 576 модулей делят работу между собой — нет одного мощного передатчика, отказ которого заставил бы РЛС замолчать.`,

  'tut.steering.title': 'Фазовое управление лучом',
  'tut.steering.body': `Чтобы направить луч под углом θ, контроллер задаёт элементу n фазу <b>−k·x<sub>n</sub>·sin θ</b>. На полотне это видно как <b>полосы</b> — линии равной фазы, перпендикулярные направлению отклонения; чем дальше отклонён луч, тем они чаще. Следите за врезкой, пока секторный обзор проходит ±60°.<br><br>Каждая смена направления — это <b>скачок</b>: фазы перезагружаются, и луч перепрыгивает. Никакого плавного поворота и никакой инерции.`,

  'tut.beamwidth.title': 'Ширина луча и потери при сканировании',
  'tut.beamwidth.body': `24 полуволновых элемента на сторону дают луч шириной <b>4,2°</b> по нормали. При отклонении решётка «выглядит» меньше — её проекция сжимается как cos θ, — поэтому луч <b>расширяется как 1/cos θ</b>, а усиление падает примерно как cos<sup>1,3</sup> θ. На 60° луч вдвое шире и слабее примерно на 4 дБ. Поэтому одно плоское полотно покрывает лишь ±60–70°, а для 360° нужно несколько полотен.`,
  'tut.beamwidth.try': 'Следите за ШИРИНОЙ ЛУЧА и ПОТЕРЯМИ СКАНИР. в телеметрии на краях сектора.',

  'tut.pattern.title': 'Диаграмма направленности: боковые, взвешивание, дифракционные лепестки',
  'tut.pattern.body': `Полупрозрачный лепесток — реальная <b>диаграмма направленности</b> решётки, пересчитываемая по фазам и весам всех 576 элементов при каждом скачке: главный лепесток, первые боковые на −13 дБ при равномерном распределении и нули между ними. Отказавшие модули и лучи одного квадранта меняют её вживую, а график слева показывает сечения по азимуту и углу места в дБ.<br><br><b>Взвешивание</b> снижает амплитуду краевых элементов: боковые лепестки опускаются, но луч расширяется, а усиление падает — вечный компромисс. На передачу взвешивание ещё и выбрасывает мощность усилителей, поэтому настоящие АФАР излучают на полной мощности, а взвешивают только на приёме. <b>Шаг элементов</b> больше λ/2 позволяет <b>дифракционному лепестку</b> — второму лучу полной силы — появиться при отклонении; поэтому решётка полуволновая.`,
  'tut.pattern.try': 'Увеличьте ВЗВЕШ. и следите, как опускаются боковые лепестки на графике; установите ШАГ 0,8 λ и наблюдайте рост дифракционного лепестка при отклонении луча.',
  'tut.pulses.title': 'Импульсы и эхо-сигналы',
  'tut.pulses.body': `РЛС излучает короткие импульсы. Каждое <b>кольцо</b> — фронт волны, уходящий от апертуры; в момент излучения это плоскость, наклонённая на угол отклонения луча. Когда импульс проходит через цель внутри луча, к полотну возвращается <b>эхо</b> (белая точка), и обнаружение фиксируется по его приходу.<br><br><b>ЧПИ</b> задаёт число импульсов в секунду — и максимальную однозначную дальность <b>R = c / (2·ЧПИ)</b>: при высокой ЧПИ следующий импульс уходит раньше, чем вернётся эхо от далёкой цели.`,
  'tut.pulses.try': 'Подвигайте ползунок ЧПИ и следите за ОДНОЗН. ДАЛЬНОСТЬЮ (показан 1 из 100 импульсов).',

  'tut.dome.title': 'Купол зоны обзора и режимы обзора',
  'tut.dome.body': `Купол вдали — «небо» РЛС, разбитое на <b>ячейки по 5°</b> азимута и угла места. Ячейка светится, пока луч направлен на неё, вспыхивает при приходе импульса и затем гаснет, оставляя медленный след, по которому читается режим обзора: <b>растр</b> из строк для обзора пространства, <b>секторный</b> проход, малый <b>круг</b> или <b>спираль</b> для повторного захвата цели по внешнему целеуказанию. Пунктир — траектория режима.`,
  'tut.dome.try': 'Переключите режимы обзора.',

  'tut.subarrays.title': 'Обзор и сопровождение одновременно',
  'tut.subarrays.body': `Полотно разделено на четыре <b>квадранта</b>, у каждого свой порт на коллекторе. Квадранты в режиме ОБЗОР объединяются в один обзорный луч (бирюзовый). Квадрант, переведённый в <b>СОПРОВОЖДЕНИЕ</b>, формирует собственный луч (янтарный) из своего фазового центра, захватывает обнаруженную цель и ведёт её с обновлением 10 Гц.<br><br>Цена разделения: четверть полотна даёт луч <b>вдвое шире</b> и теряет <b>6 дБ</b> ЭИИМ на каждое деление пополам.`,
  'tut.subarrays.try': 'Нажимайте на плитки квадрантов, чтобы менять их задачу.',

  'tut.agile.title': 'Как это делает настоящая АФАР: разделение по времени',
  'tut.agile.body': `Разделение полотна — лишь один из вариантов. В основном настоящая АФАР <b>чередует задачи во времени</b>: вся апертура перескакивает по позициям обзора и, как только подходит срок обновления трассы, тратит на неё один короткий дискрет (янтарный; белый — подтверждение свежего обнаружения). Поскольку скачок стоит микросекунды, одна решётка за одну секунду успевает обозревать пространство, сопровождать десятки целей и обновлять наведение ракет.`,
  'tut.manager.title': 'Диспетчер ресурса',
  'tut.manager.body': `Лента внизу окна — <b>расписание</b> РЛС: каждый дискрет общего луча за последние шесть секунд — бирюзовые позиции обзора, белые дискреты <b>подтверждения</b> по свежим обнаружениям, янтарные <b>обновления трасс</b>, назначаемые через интервал обновления, — а также выделенные квадрантные лучи на своих дорожках. Приоритет: подтверждение > трасса > обзор, и обзор продвигается только в своих дискретах, поэтому каждая сопровождаемая трасса удлиняет <b>цикл обзора</b>. Когда нагрузка сопровождения превышает лимит, диспетчер сбрасывает трассу с низшим приоритетом (самую дальнюю), а не даёт обзору остановиться.`,
  'tut.manager.try': 'Установите ОБНОВЛ. 0,3 с и наблюдайте, как схлопывается время обзора и растёт цикл; уменьшайте ЛИМИТ СОПР., пока трасса не будет сброшена (красная метка).',

  'tut.signal.title': 'Внутри: тракт сигнала',
  'tut.signal.body': `<b>Фиолетовый</b> — ВЧ-тракт. Сигнал возбудителя проходит через коллектор и ППМ к излучателям, а эхо возвращается тем же путём — при приёме эха штрихи на мгновение бегут назад.<br><br><b>Бирюзовый пунктир</b> — команды контроллера луча, которые при каждом скачке уходят во все четыре квадранта. Именно эти команды делают решётку «электронно сканируемой».`,

  'tut.degradation.title': 'Постепенная деградация',
  'tut.degradation.body': `Даже при отказе 15 % модулей (чёрные элементы во врезке) РЛС продолжает работать. Случайные отказы <b>не расширяют луч</b> — его ширина задаётся размером апертуры, а он не изменился. Они стоят около <b>1,4 дБ ЭИИМ</b> и поднимают диффузный <b>уровень боковых лепестков</b>: слабое широкое гало вокруг луча и «зерно» на куполе.`,
  'tut.degradation.try': 'Переключите кнопку отказа и сравните ПОТЕРИ ЭИИМ.',

  'tut.jamming.title': 'Радиопомехи',
  'tut.jamming.body': `Постановщик шумовой помехи на азимуте +40° забивает приёмник. Когда луч направлен рядом с ним, приёмник <b>насыщается</b> — красная засветка на куполе и предупреждение о помехе по главному лучу, — а через боковые лепестки помеха поднимает шум по всему этому пеленгу, скрывая там цели.`,

  'tut.nulling.title': 'Адаптивное формирование нуля',
  'tut.nulling.body': `Поскольку фаза и усиление каждого модуля регулируются, решётка может перестроить диаграмму направленности и поставить <b>нуль</b> на пеленг помехи — красный контур на куполе, — сохранив главный луч в другом направлении, и вернуть обнаружения. Такая радиоэлектронная защита недоступна механически сканирующему зеркалу.`,

  'tut.thermal.title': 'Скважность и тепло',
  'tut.thermal.body': `Средняя мощность = пиковая мощность × <b>скважность</b> (ЧПИ × длительность импульса). Усилители ППМ превращают большую её часть в тепло — поэтому холодная плита стоит сразу за ними. При максимальных ЧПИ и мощности следите, как температура решётки ползёт к пределу 85 °C: на практике именно скважность и охлаждение, а не пиковая мощность, ограничивают, как долго и как далеко может смотреть РЛС.`,
  'tut.thermal.try': 'Уменьшите ЧПИ или МОЩНОСТЬ и следите за падением температуры.',

  'tut.end.title': 'Вы готовы',
  'tut.end.body': `Итог: фаза на каждом модуле направляет луч за микросекунды · наведение — это последовательность скачков и дискретов · импульсы уходят фронтами волн, эхо возвращается · одно плоское полотно покрывает ±60° · обзор и сопровождение делят решётку либо по полотну, либо по времени · отказы деградируют плавно, а помеху можно занулить.<br><br>Клавиши: <b>Пробел</b> пуск/стоп · <b>1–4</b> режимы вида · <b>E</b> разнесение · <b>EN/RU</b> язык. Исследуйте!`,
};
