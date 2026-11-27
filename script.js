/* DEEPFAKE ALERT — vanilla JS. Files never leave the browser unless you set CFG.endpoint. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ================= CONFIG / FUTURE MODEL API =================
   To connect a real detector, set CFG.endpoint to YOUR OWN https API.
   Request : POST multipart/form-data { file, type: "image"|"video"|"audio" }
   Response: JSON { probability: 0..1, confidence: "low"|"medium"|"high",
                    indicators: [string], summary: string,
                    regions: [{ x, y, w, h, label }]  // normalized 0..1, images only }
   c2paValidator: optional async (file) => ({ valid: boolean, issuer?: string }) */
const CFG = {
  endpoint: null,
  c2paValidator: null,
  local: true, // true = run open-source models inside the browser (files never leave your device)
  models: { // Hugging Face ONNX models loaded by Transformers.js (weights are downloaded once, then cached)
    image: 'onnx-community/CommunityForensics-DeepfakeDet-ViT-ONNX',
    audio: 'ai8shiro/deepfake-audio-wav2vec2-ONNX'
  },
  maxMB: { image: 10, video: 50, audio: 20 },
  types: {
    image: { ext: ['png', 'jpg', 'jpeg', 'webp'], mime: ['image/png', 'image/jpeg', 'image/webp'] },
    video: { ext: ['mp4', 'webm'], mime: ['video/mp4', 'video/webm'] },
    audio: { ext: ['mp3', 'wav', 'm4a'], mime: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mp4', 'audio/x-m4a', 'audio/m4a'] }
  }
};

/* ================= TRANSLATIONS: key -> [EN, RU, KK] ================= */
const LANGS = ['en', 'ru', 'kk'];
const D = {
  nav_home: ['Home', 'Главная', 'Басты бет'], nav_scan: ['AI Scanner', 'ИИ-сканер', 'ЖИ сканері'],
  nav_how: ['How It Works', 'Как это работает', 'Қалай жұмыс істейді'], nav_learn: ['Learn', 'Обучение', 'Үйрену'],
  nav_hist: ['History', 'История', 'Тарих'], nav_about: ['About', 'О проекте', 'Жоба туралы'],
  start: ['Get Started', 'Начать', 'Бастау'],
  h1: ['SEE BEYOND WHAT YOU SEE.', 'ВИДЬ БОЛЬШЕ, ЧЕМ ВИДНО.', 'КӨРІНГЕННЕН ГӨРІ КӨБІРЕК КӨР.'],
  sub: ['Detect AI-generated content. Verify digital authenticity. Protect the truth.', 'Находите контент, созданный ИИ. Проверяйте цифровую подлинность. Защищайте правду.', 'ЖИ жасаған контентті анықта. Цифрлық шынайылықты тексер. Шындықты қорға.'],
  b_scan: ['Start Scanning', 'Начать проверку', 'Тексеруді бастау'], b_tech: ['Explore Technology', 'Узнать о технологии', 'Технологияны білу'],
  st1: ['AI-generated content awareness', 'Осведомлённость об ИИ-контенте', 'ЖИ контенті туралы хабардарлық'],
  st2: ['Media verification', 'Проверка медиа', 'Медиаларды тексеру'], st3: ['Digital safety', 'Цифровая безопасность', 'Цифрлық қауіпсіздік'],
  st4: ['Threat detection', 'Обнаружение угроз', 'Қауіптерді анықтау'],
  stn: ['Illustrative card — no real statistics.', 'Иллюстративная карточка — без реальной статистики.', 'Иллюстрациялық карточка — нақты статистикасыз.'],
  badge: ['DEMO DATA', 'ДЕМО-ДАННЫЕ', 'ДЕМО ДЕРЕКТЕР'],
  sc_title: ['AI Scanner', 'ИИ-сканер', 'ЖИ сканері'], t_image: ['Image Analysis', 'Анализ изображений', 'Суретті талдау'],
  t_video: ['Video Analysis', 'Анализ видео', 'Бейнені талдау'], t_audio: ['Audio Analysis', 'Анализ аудио', 'Аудионы талдау'],
  drop: ['Drop a file here or click to upload', 'Перетащите файл или нажмите для загрузки', 'Файлды осында тастаңыз немесе басыңыз'],
  limits: ['Formats: {f}. Max size: {m} MB.', 'Форматы: {f}. Макс. размер: {m} МБ.', 'Форматтар: {f}. Ең үлкен өлшем: {m} МБ.'],
  analyze: ['Analyze Content', 'Анализировать', 'Талдау'],
  p1: ['Preparing file…', 'Подготовка файла…', 'Файл дайындалуда…'], p2: ['Running analysis…', 'Выполняется анализ…', 'Талдау жүріп жатыр…'], p3: ['Building report…', 'Формирование отчёта…', 'Есеп жасалуда…'],
  f_name: ['Name', 'Название', 'Атауы'], f_size: ['Size', 'Размер', 'Өлшемі'], f_fmt: ['Format', 'Формат', 'Формат'],
  res_empty: ['Results will appear here after analysis.', 'Результаты появятся здесь после анализа.', 'Нәтижелер талдаудан кейін осында шығады.'],
  demo_mode: ['DEMO MODE — no AI model is connected. No real analysis was performed and no probability is shown.', 'DEMO MODE — ИИ-модель не подключена. Реальный анализ не выполнялся, вероятность не показывается.', 'DEMO MODE — ЖИ моделі қосылмаған. Нақты талдау жасалмады, ықтималдық көрсетілмейді.'],
  real_mode: ['Result from an AI model running in your browser: {m}. This is an estimate, not proof.', 'Результат ИИ-модели в вашем браузере: {m}. Это оценка, а не доказательство.', 'Браузеріңіздегі ЖИ моделінің нәтижесі: {m}. Бұл бағалау, дәлел емес.'],
  sum_local: ['The score comes from an open-source model ({m}) running locally on your device. It looks for statistical artifacts only and can be wrong, especially on new generators, edited or compressed files. For video, several frames are checked separately; lip-sync and motion are not analyzed. Always verify the source.', 'Оценка получена от открытой модели ({m}), работающей локально на вашем устройстве. Она ищет только статистические артефакты и может ошибаться, особенно на новых генераторах, а также на отредактированных или сжатых файлах. В видео отдельно проверяются несколько кадров; синхронизация губ и движение не анализируются. Всегда проверяйте источник.', 'Баға құрылғыңызда жұмыс істейтін ашық модельден ({m}) алынды. Ол тек статистикалық артефактілерді іздейді және қателесуі мүмкін, әсіресе жаңа генераторларда, өңделген не сығылған файлдарда. Бейнеде бірнеше кадр бөлек тексеріледі; ерін синхроны мен қозғалыс талданбайды. Әрқашан көзін тексеріңіз.'],
  dl: ['Downloading AI model (first run only)…', 'Загрузка ИИ-модели (только при первом запуске)…', 'ЖИ моделі жүктелуде (тек бірінші рет)…'],
  r_auth: ['Authenticity Assessment', 'Оценка подлинности', 'Шынайылықты бағалау'], r_prob: ['AI Manipulation Probability', 'Вероятность ИИ-манипуляции', 'ЖИ манипуляциясының ықтималдығы'],
  r_conf: ['Confidence Level', 'Уровень уверенности', 'Сенімділік деңгейі'], r_ind: ['Detected Indicators', 'Обнаруженные признаки', 'Анықталған белгілер'],
  r_sum: ['Analysis Summary', 'Итог анализа', 'Талдау қорытындысы'], r_rec: ['Recommendations', 'Рекомендации', 'Ұсыныстар'],
  a_demo: ['Not analyzed', 'Не анализировалось', 'Талданбады'], a_low: ['No strong indicators found', 'Явных признаков не найдено', 'Айқын белгілер табылмады'],
  a_mid: ['Inconclusive', 'Неопределённо', 'Белгісіз'], a_high: ['Likely manipulated', 'Вероятна манипуляция', 'Манипуляция ықтимал'],
  c_low: ['Low', 'Низкий', 'Төмен'], c_medium: ['Medium', 'Средний', 'Орташа'], c_high: ['High', 'Высокий', 'Жоғары'],
  na: ['N/A', 'Н/Д', 'Жоқ'], no_ind: ['No indicators reported.', 'Признаки не сообщены.', 'Белгілер жоқ.'],
  sum_demo: ['Set CFG.endpoint in script.js to connect a detection model and get real results.', 'Укажите CFG.endpoint в script.js, чтобы подключить модель и получать реальные результаты.', 'Нақты нәтиже алу үшін script.js ішінде CFG.endpoint көрсетіңіз.'],
  rec1: ['Check the original source of the file.', 'Проверьте первоисточник файла.', 'Файлдың бастапқы көзін тексеріңіз.'],
  rec2: ['Look for the same material in trusted outlets.', 'Найдите этот материал в надёжных изданиях.', 'Бұл материалды сенімді басылымдардан іздеңіз.'],
  rec3: ['Treat any tool result as a hint, not proof.', 'Считайте результат любого инструмента подсказкой, а не доказательством.', 'Кез келген құрал нәтижесін дәлел емес, нұсқау деп санаңыз.'],
  limit_note: ['No detector is 100% accurate. Absence of detected indicators does not mean the content is authentic.', 'Ни один детектор не точен на 100%. Отсутствие признаков не означает, что контент подлинный.', 'Ешбір детектор 100% дәл емес. Белгілердің болмауы контенттің шынайы екенін білдірмейді.'],
  how_title: ['How It Works', 'Как это работает', 'Қалай жұмыс істейді'],
  s1: ['Upload: choose a file. It stays in your browser.', 'Загрузка: выберите файл. Он остаётся в вашем браузере.', 'Жүктеу: файлды таңдаңыз. Ол браузеріңізде қалады.'],
  s2: ['Analyze: a connected model checks the content.', 'Анализ: подключённая модель проверяет контент.', 'Талдау: қосылған модель контентті тексереді.'],
  s3: ['Review: see probability, evidence and limits.', 'Результат: вероятность, доказательства и ограничения.', 'Нәтиже: ықтималдық, дәлел және шектеулер.'],
  ev_title: ['AI Evidence Map', 'Карта доказательств ИИ', 'ЖИ дәлелдер картасы'], sample: ['SAMPLE VISUALIZATION', 'ПРИМЕР ВИЗУАЛИЗАЦИИ', 'ҮЛГІ ВИЗУАЛИЗАЦИЯ'],
  ev_real: ['VISUALIZATION FROM YOUR MODEL', 'ВИЗУАЛИЗАЦИЯ ВАШЕЙ МОДЕЛИ', 'МОДЕЛІҢІЗДІҢ ВИЗУАЛИЗАЦИЯСЫ'],
  ev_orig: ['Original Image', 'Оригинал', 'Түпнұсқа'], ev_viz: ['Analysis Visualization', 'Визуализация анализа', 'Талдау визуализациясы'],
  ev_reg: ['Highlighted Regions', 'Выделенные области', 'Белгіленген аймақтар'], opac: ['Mask opacity', 'Прозрачность маски', 'Маска мөлдірлігі'],
  ev_expl: ['Explanation of Detected Patterns', 'Объяснение найденных паттернов', 'Табылған заңдылықтар түсіндірмесі'],
  ev_text: ['Highlighted areas show where a model suspects synthetic artifacts, such as blended edges or inconsistent texture. Without a connected model this is only an illustration.', 'Выделенные области показывают, где модель подозревает синтетические артефакты: размытые границы, неоднородную текстуру. Без подключённой модели это лишь иллюстрация.', 'Белгіленген аймақтар модель синтетикалық артефактілерді (бұлыңғыр шекаралар, біркелкі емес текстура) күдіктенетін жерді көрсетеді. Модельсіз бұл тек иллюстрация.'],
  reg_s1: ['Face boundary (sample)', 'Граница лица (пример)', 'Бет шекарасы (үлгі)'], reg_s2: ['Mouth area (sample)', 'Область рта (пример)', 'Ауыз аймағы (үлгі)'],
  rc_title: ['Reality Certificate', 'Сертификат реальности', 'Шынайылық сертификаты'], rc_btn: ['Inspect file', 'Проверить файл', 'Файлды тексеру'],
  rc_empty: ['Choose a file to inspect its provenance data.', 'Выберите файл для проверки данных о происхождении.', 'Шығу тегі деректерін тексеру үшін файл таңдаңыз.'],
  rc_note: ['Metadata can be edited or removed. It never proves authenticity on its own.', 'Метаданные можно изменить или удалить. Сами по себе они не доказывают подлинность.', 'Метадеректерді өзгертуге немесе жоюға болады. Олар жалғыз өзі шынайылықты дәлелдемейді.'],
  rc_status: ['Verification', 'Верификация', 'Верификация'], rc_date: ['File modified date (file system, not creation date)', 'Дата изменения файла (файловая система, не дата создания)', 'Файл өзгерту күні (файлдық жүйе, жасалған күн емес)'],
  rc_cc: ['Content Credentials (C2PA)', 'Content Credentials (C2PA)', 'Content Credentials (C2PA)'],
  rc_yes: ['Marker found; signature NOT validated here', 'Маркер найден; подпись здесь НЕ проверена', 'Маркер табылды; қол таңба мұнда тексерілмеді'],
  rc_no: ['No marker found', 'Маркер не найден', 'Маркер табылмады'],
  v_ok: ['Verified Provenance', 'Происхождение подтверждено', 'Шығу тегі расталды'], v_un: ['Unverified', 'Не подтверждено', 'Расталмаған'], v_inc: ['Inconclusive', 'Неопределённо', 'Белгісіз'],
  why_ok: ['The provenance signature was validated by your validator.', 'Подпись происхождения проверена вашим валидатором.', 'Шығу тегі қол таңбасын сіздің валидаторыңыз тексерді.'],
  why_inc: ['A provenance marker exists but its signature was not cryptographically validated.', 'Маркер происхождения есть, но подпись не проверена криптографически.', 'Шығу тегі маркері бар, бірақ қол таңба криптографиялық тексерілмеді.'],
  why_un: ['No provenance data found. This does not mean the file is fake.', 'Данных о происхождении нет. Это не значит, что файл поддельный.', 'Шығу тегі деректері жоқ. Бұл файлдың жалған екенін білдірмейді.'],
  ch_title: ['REAL OR FAKE?', 'НАСТОЯЩЕЕ ИЛИ ФЕЙК?', 'ШЫНАЙЫ МА, ЖАЛҒАН БА?'], real: ['Real', 'Настоящее', 'Шынайы'], fake: ['AI-generated', 'Создано ИИ', 'ЖИ жасаған'],
  next: ['Next', 'Далее', 'Келесі'], again: ['Play again', 'Пройти заново', 'Қайта өту'], right: ['Correct!', 'Верно!', 'Дұрыс!'], wrong: ['Not quite.', 'Неверно.', 'Қате.'],
  score: ['Score', 'Очки', 'Ұпай'], final: ['Final score', 'Итоговый результат', 'Қорытынды нәтиже'], ill: ['ILLUSTRATIVE SCENARIO', 'ИЛЛЮСТРАТИВНЫЙ СЦЕНАРИЙ', 'ИЛЛЮСТРАЦИЯЛЫҚ СЦЕНАРИЙ'],
  ch_note: ['Text scenarios for now. Add your own licensed images or videos via QUIZ[].img in script.js.', 'Пока это текстовые сценарии. Добавьте свои лицензионные изображения или видео через QUIZ[].img в script.js.', 'Әзірге мәтіндік сценарийлер. QUIZ[].img арқылы өз лицензиялы суреттеріңізді қосыңыз.'],
  learn_title: ['Learn Center', 'Обучающий центр', 'Үйрену орталығы'], close: ['Close', 'Закрыть', 'Жабу'],
  hist_title: ['History', 'История', 'Тарих'], clear: ['Clear history', 'Очистить историю', 'Тарихты тазалау'],
  hist_empty: ['No checks yet. Run a scan to see it here.', 'Проверок пока нет. Запустите сканирование.', 'Тексеру әлі жоқ. Сканерлеуді бастаңыз.'],
  hist_note: ['Only file name, type, date and status are stored. File contents are never saved.', 'Сохраняются только имя файла, тип, дата и статус. Содержимое файлов не сохраняется.', 'Тек файл атауы, түрі, күні және мәртебесі сақталады. Файл мазмұны сақталмайды.'],
  del: ['Delete', 'Удалить', 'Жою'],
  about_title: ['About', 'О проекте', 'Жоба туралы'],
  mission: ['Making the digital world a safer place through artificial intelligence and media literacy.', 'Делаем цифровой мир безопаснее с помощью искусственного интеллекта и медиаграмотности.', 'Жасанды интеллект пен медиа сауаттылық арқылы цифрлық әлемді қауіпсіздеу ету.'],
  m_h: ['Our Mission', 'Наша миссия', 'Біздің миссиямыз'], m_t: ['Help people question what they see and hear online, and give them tools to check it.', 'Помогать людям критически относиться к увиденному и услышанному в сети и давать инструменты для проверки.', 'Адамдарға желідегі көрген-естігенін сыни бағалауға және тексеруге көмектесу.'],
  w_h: ['Why Deepfake Detection Matters', 'Почему важно обнаруживать дипфейки', 'Дипфейкті анықтау неге маңызды'], w_t: ['Synthetic media enables fraud, harassment and disinformation. Early checks and media literacy reduce the harm.', 'Синтетические медиа помогают мошенникам, травле и дезинформации. Ранняя проверка и медиаграмотность снижают вред.', 'Синтетикалық медиа алаяқтыққа, қудалауға және жалған ақпаратқа жол ашады. Ерте тексеру мен медиа сауаттылық зиянды азайтады.'],
  tc_h: ['Our Technology', 'Наши технологии', 'Біздің технология'], tc_t: ['The interface is ready for image, video and audio detectors via a simple API. Files are processed in your browser unless you connect your own server.', 'Интерфейс готов к подключению детекторов изображений, видео и аудио через простой API. Файлы обрабатываются в браузере, пока вы не подключите свой сервер.', 'Интерфейс сурет, бейне және аудио детекторларын қарапайым API арқылы қосуға дайын. Өз серверіңізді қоспайынша файлдар браузерде қалады.'],
  v_h: ['Our Vision', 'Наше видение', 'Біздің көзқарас'], v_t: ['A web where authenticity can be checked by anyone, and honest limits are part of every result.', 'Интернет, где каждый может проверить подлинность, а честные ограничения — часть любого результата.', 'Кез келген адам шынайылықты тексере алатын және әр нәтижеде шектеулер ашық айтылатын желі.'],
  foot: ['DEEPFAKE ALERT · Educational project. Not a guarantee of authenticity.', 'DEEPFAKE ALERT · Образовательный проект. Не гарантирует подлинность.', 'DEEPFAKE ALERT · Білім беру жобасы. Шынайылыққа кепілдік бермейді.'],
  e_type: ['Unsupported file type.', 'Неподдерживаемый тип файла.', 'Қолдау көрсетілмейтін файл түрі.'], e_size: ['File is too large.', 'Файл слишком большой.', 'Файл тым үлкен.'],
  e_api: ['Analysis failed. Check your internet connection and try again.', 'Анализ не удался. Проверьте интернет и повторите.', 'Талдау сәтсіз. Интернетті тексеріп, қайталаңыз.'], e_read: ['Could not read the file.', 'Не удалось прочитать файл.', 'Файлды оқу мүмкін болмады.'],
  ok_done: ['Analysis complete.', 'Анализ завершён.', 'Талдау аяқталды.'], ok_clear: ['History cleared.', 'История очищена.', 'Тарих тазаланды.'],
  ok_del: ['Entry deleted.', 'Запись удалена.', 'Жазба жойылды.'], ok_file: ['File loaded.', 'Файл загружен.', 'Файл жүктелді.']
};
const LEARN = [
  ['What is Deepfake?', 'Что такое дипфейк?', 'Дипфейк деген не?',
    'A deepfake is media (image, video or audio) generated or altered with deep learning so that a person appears to say or do something they never did.',
    'Дипфейк — изображение, видео или аудио, созданное либо изменённое с помощью глубокого обучения так, что человек будто бы говорит или делает то, чего не делал.',
    'Дипфейк — терең оқыту арқылы жасалған немесе өзгертілген сурет, бейне не аудио; адам ешқашан айтпаған немесе істемеген әрекетті жасағандай көрінеді.'],
  ['How AI Creates Synthetic Media', 'Как ИИ создаёт синтетические медиа', 'ЖИ синтетикалық медиаға қалай жасайды',
    'Models such as GANs and diffusion models learn statistical patterns from large datasets and then generate new pixels or sound that follow those patterns.',
    'Модели вроде GAN и диффузионных учатся статистическим закономерностям на больших наборах данных, а затем генерируют новые пиксели или звук по этим закономерностям.',
    'GAN және диффузиялық модельдер үлкен деректерден статистикалық заңдылықтарды үйреніп, соларға сай жаңа пиксель немесе дыбыс жасайды.'],
  ['How to Recognize Manipulated Content', 'Как распознать манипуляцию', 'Манипуляцияны қалай тану',
    'Look for odd hands, teeth or reflections, blurred face edges, unnatural blinking, lip-sync errors and inconsistent lighting. Then check the source: who posted it first?',
    'Обратите внимание на странные руки, зубы, отражения, размытые края лица, неестественное моргание, рассинхрон губ и неровное освещение. Затем проверьте источник: кто опубликовал первым?',
    'Біртүрлі қол, тіс, шағылысуға, бет жиектерінің бұлыңғырлығына, тым табиғи емес жыпылықтауға, ерін мен дыбыс сәйкессіздігіне назар аударыңыз. Содан кейін көзін тексеріңіз.'],
  ['Voice Cloning Threats', 'Угрозы клонирования голоса', 'Дауысты клондау қаупі',
    'A few seconds of recorded speech can be enough to imitate a voice. Agree on a family code word and call back on a known number before acting on urgent voice requests.',
    'Нескольких секунд записи речи может хватить для имитации голоса. Договоритесь о семейном кодовом слове и перезвоните на известный номер, прежде чем выполнять срочную просьбу.',
    'Дауысты еліктеуге бірнеше секундтық жазба жеткілікті болуы мүмкін. Отбасылық код сөз келісіп, шұғыл өтінішті орындамас бұрын белгілі нөмірге қайта қоңырау шалыңыз.'],
  ['Deepfake Scams', 'Дипфейк-мошенничество', 'Дипфейк алаяқтығы',
    'Scammers use fake video calls, cloned voices and fake endorsements to demand money or data. Pause, verify through a second channel and never send money under pressure.',
    'Мошенники используют фальшивые видеозвонки, клонированные голоса и поддельные рекомендации, чтобы вытянуть деньги или данные. Остановитесь, проверьте по другому каналу и не переводите деньги под давлением.',
    'Алаяқтар жалған бейнеқоңыраулар мен клондалған дауыстарды ақша не деректер алу үшін қолданады. Тоқтап, екінші арна арқылы тексеріңіз, қысыммен ақша аудармаңыз.'],
  ['How to Protect Your Identity', 'Как защитить свою личность', 'Жеке басыңызды қалай қорғау',
    'Limit public photos and voice clips, use strong unique passwords with two-factor authentication, and report impersonation to the platform quickly.',
    'Ограничьте публичные фото и записи голоса, используйте надёжные уникальные пароли и двухфакторную аутентификацию, быстро сообщайте платформе о выдаче себя за вас.',
    'Жария фото мен дауыс жазбаларын шектеңіз, берік бірегей құпиясөздер мен екі факторлы аутентификацияны қолданыңыз, жалған аккаунтты платформаға тез хабарлаңыз.'],
  ['Digital Privacy', 'Цифровая приватность', 'Цифрлық құпиялылық',
    'Every shared photo can become training material. Review app permissions, strip location metadata before posting, and prefer private sharing for personal media.',
    'Любое выложенное фото может стать обучающим материалом. Проверяйте разрешения приложений, удаляйте геометки перед публикацией и делитесь личным медиа приватно.',
    'Әр жарияланған фото оқыту материалына айналуы мүмкін. Қолданба рұқсаттарын тексеріңіз, жариялар алдында геотегтерді жойыңыз, жеке медиаңызбен жабық бөлісіңіз.']
];
const QUIZ = [ // img: optional path to your own licensed image/video poster
  { img: '', fake: true, p: ['A portrait where one hand has six fingers and the text on the sign behind is garbled.', 'Портрет: на одной руке шесть пальцев, а надпись на вывеске сзади нечитаема.', 'Портрет: бір қолда алты саусақ, артқы жазу оқылмайды.'],
    e: ['Anatomical errors and garbled text are classic signs of image generators.', 'Анатомические ошибки и искажённый текст — типичные признаки генераторов изображений.', 'Анатомиялық қателер мен бұзылған мәтін — кескін генераторларының әдеттегі белгілері.'] },
  { img: '', fake: false, p: ['A phone photo with natural sensor noise, consistent shadows, and a matching original reported by several outlets.', 'Фото с телефона: естественный шум сенсора, согласованные тени, оригинал подтверждён несколькими изданиями.', 'Телефон фотосы: табиғи сенсор шуы, сәйкес көлеңкелер, түпнұсқаны бірнеше басылым растаған.'],
    e: ['Consistent physics and independent confirmation point to a genuine photo, though never prove it.', 'Согласованная физика и независимые подтверждения говорят в пользу подлинности, но не доказывают её.', 'Үйлесімді физика мен тәуелсіз растау шынайылыққа меңзейді, бірақ дәлелдемейді.'] },
  { img: '', fake: true, p: ['A video of a CEO asking for an urgent transfer. Lips drift out of sync and the face edge flickers when the head turns.', 'Видео: директор просит срочный перевод. Губы рассинхронизированы, край лица мерцает при повороте головы.', 'Бейне: директор шұғыл аударым сұрайды. Ерін сәйкес емес, бас бұрғанда бет жиегі жыпылықтайды.'],
    e: ['Lip-sync drift and edge flicker are common face-swap artifacts, and urgency is a scam signal.', 'Рассинхрон губ и мерцание краёв — частые артефакты подмены лица, а срочность — признак мошенничества.', 'Ерін сәйкессіздігі мен жиек жыпылықтауы — бет алмастыру артефактілері, ал асығыстық — алаяқтық белгісі.'] },
  { img: '', fake: false, p: ['A voice message that your relative confirms sending, using your family code word.', 'Голосовое сообщение, которое родственник подтвердил по телефону и произнёс ваше кодовое слово.', 'Туысыңыз растаған және отбасылық код сөзді қамтыған дауыстық хабар.'],
    e: ['An independent confirmation and a shared secret make a genuine message very likely.', 'Независимое подтверждение и общий секрет делают подлинность сообщения весьма вероятной.', 'Тәуелсіз растау мен ортақ құпия хабардың шынайы болу ықтималдығын арттырады.'] }
];

/* ================= STATE & HELPERS ================= */
let L = 'en', type = 'image', file = null, objURL = null, lastResult = null, lastRC = null, gauge = null;
const quiz = { i: 0, score: 0, done: false, answered: false };
const t = k => (D[k] && (D[k][LANGS.indexOf(L)] || D[k][0])) || k;
const el = (tag, txt, cls) => { const n = document.createElement(tag); if (txt != null) n.textContent = txt; if (cls) n.className = cls; return n; };
const icons = () => window.lucide && window.lucide.createIcons();
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage may be blocked */ } }
};
function toast(key, err) {
  const n = el('div', t(key), 'toast' + (err ? ' err' : ''));
  $('#toasts').append(n); setTimeout(() => n.remove(), 3500);
}
const fmtSize = b => b > 1048576 ? (b / 1048576).toFixed(2) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

/* ================= LANGUAGE ================= */
function applyLang() {
  document.documentElement.lang = L;
  $$('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  $('#limits').textContent = t('limits').replace('{f}', CFG.types[type].ext.join(', ').toUpperCase()).replace('{m}', CFG.maxMB[type]);
  $('#mclose').setAttribute('aria-label', t('close'));
  renderFile(); renderResult(); renderRC(); renderLearn(); renderHist(); renderQuiz(); renderEvidenceList();
}

/* ================= FILE HANDLING & VALIDATION ================= */
function validate(f) {
  const ext = f.name.split('.').pop().toLowerCase(), c = CFG.types[type];
  if (!c.ext.includes(ext) || !c.mime.includes(f.type)) return 'e_type';
  if (f.size > CFG.maxMB[type] * 1048576) return 'e_size';
  return null;
}
function resetFile() {
  file = null; lastResult = null;
  if (objURL) URL.revokeObjectURL(objURL); objURL = null;
  $('#preview').hidden = true; $('#preview').replaceChildren(); $('#analyze').disabled = true; $('#file').value = '';
  $('#rbody').hidden = true; $('#empty').hidden = false; renderFile(); drawEvidence();
}
function handleFile(f) {
  if (!f) return;
  const err = validate(f);
  if (err) { toast(err, true); return; }
  resetFile(); file = f; objURL = URL.createObjectURL(f);
  const box = $('#preview'), m = el(type === 'image' ? 'img' : type === 'video' ? 'video' : 'audio');
  m.src = objURL; if (type !== 'image') m.controls = true; if (type === 'image') m.alt = f.name;
  box.replaceChildren(m); box.hidden = false;
  $('#analyze').disabled = false; renderFile(); toast('ok_file'); drawEvidence();
}
function renderFile() {
  const ul = $('#finfo'); ul.replaceChildren();
  if (!file) return;
  [['f_name', file.name], ['f_size', fmtSize(file.size)], ['f_fmt', file.name.split('.').pop().toUpperCase() + ' · ' + file.type]].forEach(([k, v]) => {
    const li = el('li'); li.append(el('b', t(k) + ': '), document.createTextNode(v)); ul.append(li);
  });
}
function setType(tp) {
  type = tp;
  $$('.tab').forEach(b => { const on = b.dataset.type === tp; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  $('#file').accept = CFG.types[tp].ext.map(e => '.' + e).join(',');
  resetFile(); applyLang();
}

/* ================= ANALYSIS (model hook) ================= */
async function runAnalysis(f, tp) {
  if (!CFG.endpoint) return CFG.local ? localAnalyze(f, tp) : { demo: true }; // demo = nothing is analyzed
  const fd = new FormData(); fd.append('file', f); fd.append('type', tp);
  const r = await fetch(CFG.endpoint, { method: 'POST', body: fd });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (typeof j.probability !== 'number' || j.probability < 0 || j.probability > 1) throw new Error('Bad response');
  return { demo: false, ...j };
}
/* ---- In-browser inference via Transformers.js: only model weights are downloaded, your file stays local ---- */
let tf = null, modelLoading = false; const pipes = {};
async function getPipe(tp) {
  const key = tp === 'audio' ? 'audio' : 'image';
  if (!tf) tf = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3');
  if (pipes[key]) return pipes[key];
  const task = key === 'audio' ? 'audio-classification' : 'image-classification';
  const cb = p => { if (p.status === 'progress' && typeof p.progress === 'number') $('#progtxt').textContent = t('dl') + ' ' + Math.round(p.progress) + '%'; };
  modelLoading = true;
  try { pipes[key] = await tf.pipeline(task, CFG.models[key], { progress_callback: cb }); }
  catch (e) { pipes[key] = await tf.pipeline(task, CFG.models[key], { dtype: 'fp32', progress_callback: cb }); }
  finally { modelLoading = false; }
  return pipes[key];
}
function fakeProb(out) { // convert classifier labels into P(fake); refuse to guess if labels are unknown
  const f = out.find(o => /fake|\bai\b|synth|generat|spoof/i.test(o.label));
  if (f) return f.score;
  const r = out.find(o => /real|authentic|human|bona|genuine/i.test(o.label));
  if (r) return 1 - r.score;
  throw new Error('Unknown labels: ' + out.map(o => o.label).join(', '));
}
async function videoFrames(url, n = 6) {
  const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = url;
  await new Promise((ok, no) => { v.onloadedmetadata = ok; v.onerror = no; });
  const c = document.createElement('canvas'), W = Math.min(v.videoWidth || 640, 640); c.width = W; c.height = Math.round(W * (v.videoHeight || 360) / (v.videoWidth || 640));
  const d = isFinite(v.duration) && v.duration > 0 ? v.duration : 1, out = [];
  for (let i = 0; i < n; i++) {
    v.currentTime = d * (i + .5) / n;
    await new Promise(ok => { v.onseeked = ok; });
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); out.push(c.toDataURL('image/jpeg', .92));
  }
  return out;
}
async function localAnalyze(f, tp) {
  const pipe = await getPipe(tp), ind = []; let p;
  if (tp === 'image') p = fakeProb(await pipe(objURL, { top_k: 5 }));
  else if (tp === 'video') {
    const ps = []; for (const u of await videoFrames(objURL)) ps.push(fakeProb(await pipe(u, { top_k: 5 })));
    ps.forEach((x, i) => ind.push('#' + (i + 1) + ': ' + Math.round(x * 100) + '%')); p = ps.reduce((a, b) => a + b, 0) / ps.length;
  } else { const a = await tf.read_audio(objURL, 16000); p = fakeProb(await pipe(a.slice(0, 160000), { top_k: 5 })); }
  const margin = Math.abs(p - .5) * 2; // distance of the score from 50/50, used as a rough confidence level
  return { demo: false, probability: p, confidence: margin < .4 ? 'low' : margin < .75 ? 'medium' : 'high', indicators: ind, sumKey: 'sum_local', model: CFG.models[tp === 'audio' ? 'audio' : 'image'] };
}
async function onAnalyze() {
  if (!file) { toast('e_nofile', true); return; }
  const btn = $('#analyze'), pv = $('#preview'), steps = ['p1', 'p2', 'p3'];
  btn.disabled = true; $('#prog').hidden = false; pv.classList.add('scanning');
  let s = 0; $('#progtxt').textContent = t(steps[0]);
  const timer = setInterval(() => { if (modelLoading) return; s = Math.min(s + 1, 2); $('#progtxt').textContent = t(steps[s]); }, 700);
  try {
    const [res] = await Promise.all([runAnalysis(file, type), new Promise(r => setTimeout(r, 2000))]);
    lastResult = res; renderResult(); drawEvidence(); saveHistory(res); toast('ok_done');
  } catch (e) { console.error(e); toast('e_api', true); }
  clearInterval(timer); $('#prog').hidden = true; $('#progtxt').textContent = ''; pv.classList.remove('scanning'); btn.disabled = false;
}
function verdictKey(r) { return r.demo ? 'a_demo' : r.probability < 0.35 ? 'a_low' : r.probability <= 0.65 ? 'a_mid' : 'a_high'; }
function renderResult() {
  const r = lastResult; if (!r) return;
  $('#empty').hidden = true; $('#rbody').hidden = false;
  const m = $('#rmode'); m.textContent = t(r.demo ? 'demo_mode' : 'real_mode').replace('{m}', r.model || ''); m.classList.toggle('real', !r.demo);
  const p = r.demo ? null : Math.round(r.probability * 100);
  $('#gval').textContent = p == null ? '—' : p + '%';
  $('#r1').textContent = t(verdictKey(r)); $('#r2').textContent = p == null ? t('na') : p + '%';
  $('#r3').textContent = r.demo ? t('na') : t('c_' + (['low', 'medium', 'high'].includes(r.confidence) ? r.confidence : 'low'));
  const ind = $('#rind'); ind.replaceChildren();
  (r.demo || !Array.isArray(r.indicators) || !r.indicators.length ? [t('no_ind')] : r.indicators).forEach(x => ind.append(el('li', String(x))));
  $('#rsum').textContent = r.demo ? t('sum_demo') : r.sumKey ? t(r.sumKey).replace('{m}', r.model) : String(r.summary || '');
  const rec = $('#rrec'); rec.replaceChildren(); ['rec1', 'rec2', 'rec3'].forEach(k => rec.append(el('li', t(k))));
  if (window.Chart) {
    const data = p == null ? [0, 100] : [p, 100 - p], col = p == null ? ['#8995A8', '#1a2338'] : ['#815BFF', '#1a2338'];
    if (!gauge) gauge = new Chart($('#gauge'), { type: 'doughnut', data: { datasets: [{ data, backgroundColor: col, borderWidth: 0 }] }, options: { cutout: '78%', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } } } });
    else { gauge.data.datasets[0].data = data; gauge.data.datasets[0].backgroundColor = col; gauge.update(); }
  }
}

/* ================= EVIDENCE MAP ================= */
const SAMPLE = [{ x: .3, y: .12, w: .4, h: .6, label: 'reg_s1' }, { x: .4, y: .5, w: .2, h: .1, label: 'reg_s2' }];
function regions() { const r = lastResult; return r && !r.demo && type === 'image' && Array.isArray(r.regions) && r.regions.length ? r.regions : null; }
function drawEvidence() {
  const c1 = $('#ev1'), c2 = $('#ev2'), W = c1.width, H = c1.height, x1 = c1.getContext('2d'), x2 = c2.getContext('2d');
  const real = regions(), useImg = type === 'image' && file && $('#preview img');
  const paint = base => {
    [x1, x2].forEach(c => { c.clearRect(0, 0, W, H); base(c); });
    const a = $('#opac').value / 100;
    (real || SAMPLE).forEach(g => {
      x2.fillStyle = `rgba(255,60,140,${a})`; x2.strokeStyle = '#ff3c8c'; x2.lineWidth = 2;
      x2.fillRect(g.x * W, g.y * H, g.w * W, g.h * H); x2.strokeRect(g.x * W, g.y * H, g.w * W, g.h * H);
    });
  };
  $('#evbadge').textContent = t(real ? 'ev_real' : 'sample');
  if (useImg) {
    const im = new Image(); im.onload = () => { const k = Math.min(W / im.width, H / im.height), w = im.width * k, h = im.height * k;
      paint(c => c.drawImage(im, (W - w) / 2, (H - h) / 2, w, h)); }; im.src = objURL;
  } else paint(c => { // generated placeholder, NOT a real photo
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0D1422'); g.addColorStop(1, '#241a4d'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = '#2b3a5c'; c.beginPath(); c.ellipse(W / 2, H * .42, W * .17, H * .3, 0, 0, 7); c.fill();
    c.fillStyle = '#00D9FF'; [.43, .57].forEach(px => { c.beginPath(); c.arc(W * px, H * .36, 5, 0, 7); c.fill(); });
  });
  renderEvidenceList();
}
function renderEvidenceList() {
  const ul = $('#evlist'); ul.replaceChildren();
  (regions() || SAMPLE).forEach((g, i) => ul.append(el('li', (i + 1) + '. ' + (D[g.label] ? t(g.label) : String(g.label || 'Region')))));
}

/* ================= REALITY CERTIFICATE ================= */
async function inspect(f) {
  try {
    const head = new TextDecoder('latin1').decode(await f.slice(0, 1048576).arrayBuffer());
    const marker = /c2pa|jumb|contentcredentials/i.test(head);
    let valid = false;
    if (marker && typeof CFG.c2paValidator === 'function') valid = !!(await CFG.c2paValidator(f)).valid;
    lastRC = { f, marker, status: valid ? 'v_ok' : marker ? 'v_inc' : 'v_un', why: valid ? 'why_ok' : marker ? 'why_inc' : 'why_un', date: new Date(f.lastModified) };
    renderRC();
  } catch (e) { console.error(e); toast('e_read', true); }
}
function renderRC() {
  const box = $('#rcout'); if (!lastRC) return;
  const r = lastRC; box.className = ''; box.replaceChildren();
  const row = (k, v) => { const d = el('div', null, 'rc-row'); d.append(el('span', k, 'muted'), el('b', v)); box.append(d); };
  row(t('f_name'), r.f.name); row(t('f_size'), fmtSize(r.f.size)); row(t('f_fmt'), r.f.type || '—');
  row(t('rc_date'), r.date.toLocaleString(L === 'kk' ? 'kk-KZ' : L === 'ru' ? 'ru-RU' : 'en-US'));
  row(t('rc_cc'), t(r.marker ? 'rc_yes' : 'rc_no'));
  box.append(el('p', t('rc_status') + ':', 'muted'), el('span', t(r.status), 'vs ' + (r.status === 'v_ok' ? 'v' : r.status === 'v_inc' ? 'i' : 'u')), el('p', t(r.why)));
}

/* ================= CHALLENGE ================= */
function renderQuiz() {
  const q = QUIZ[quiz.i], n = QUIZ.length;
  $('#chscore').textContent = quiz.score; $('#chbar').style.width = (quiz.done ? 100 : quiz.i / n * 100) + '%';
  $('#chq').hidden = quiz.done; $('#chend').hidden = !quiz.done; $('#chfinal').textContent = quiz.score + ' / ' + n;
  $('#chstep').textContent = Math.min(quiz.i + 1, n) + ' / ' + n;
  if (quiz.done) return;
  const art = $('#chart'); art.replaceChildren();
  if (q.img) { const im = el('img'); im.src = q.img; im.alt = ''; art.append(im); } else art.append(el('i', ''), el('span', t('ill'), 'badge'));
  $('#chtxt').textContent = q.p[LANGS.indexOf(L)];
  $('#chReal').disabled = $('#chFake').disabled = quiz.answered; $('#chNext').hidden = !quiz.answered;
  if (!quiz.answered) { $('#chfb').textContent = ''; $('#chfb').className = 'fb'; }
}
function answer(sayFake) {
  if (quiz.answered) return; const q = QUIZ[quiz.i], ok = sayFake === q.fake;
  quiz.answered = true; if (ok) quiz.score++;
  const fb = $('#chfb'); fb.className = 'fb ' + (ok ? 'ok' : 'no'); fb.textContent = t(ok ? 'right' : 'wrong') + ' ' + q.e[LANGS.indexOf(L)];
  renderQuiz(); $('#chfb').textContent = fb.textContent; $('#chfb').className = 'fb ' + (ok ? 'ok' : 'no');
}

/* ================= LEARN + MODAL ================= */
let lastFocus = null;
function renderLearn() {
  const g = $('#learnGrid'); g.replaceChildren(); const i = LANGS.indexOf(L);
  LEARN.forEach((a, idx) => {
    const b = el('button', null, 'glass pad card'); b.type = 'button'; b.append(el('h3', a[i]), el('p', a[3 + i].slice(0, 70) + '…', 'muted'));
    b.addEventListener('click', () => openModal(idx)); g.append(b);
  });
}
function openModal(idx) {
  const i = LANGS.indexOf(L); lastFocus = document.activeElement;
  $('#mtitle').textContent = LEARN[idx][i]; $('#mbody').textContent = LEARN[idx][3 + i];
  $('#modal').hidden = false; $('#mclose').focus();
}
function closeModal() { $('#modal').hidden = true; if (lastFocus) lastFocus.focus(); }

/* ================= HISTORY (metadata only, never file contents) ================= */
function saveHistory(res) {
  const h = store.get('dfa_hist', []);
  h.unshift({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 6), name: file.name, type, date: new Date().toISOString(), status: verdictKey(res), prob: res.demo ? null : Math.round(res.probability * 100) });
  store.set('dfa_hist', h.slice(0, 50)); renderHist();
}
function renderHist() {
  const ul = $('#hist'), h = store.get('dfa_hist', []); ul.replaceChildren();
  if (!h.length) { const li = el('li', t('hist_empty'), 'muted'); li.style.display = 'block'; ul.append(li); return; }
  h.forEach(e => {
    const li = el('li'), b = el('button', null); b.type = 'button'; b.setAttribute('aria-label', t('del')); b.textContent = '✕';
    b.addEventListener('click', () => { store.set('dfa_hist', store.get('dfa_hist', []).filter(x => x.id !== e.id)); renderHist(); toast('ok_del'); });
    li.append(el('span', String(e.name)), el('span', t('t_' + e.type).split(' ')[0]), el('span', new Date(e.date).toLocaleString(L === 'kk' ? 'kk-KZ' : L === 'ru' ? 'ru-RU' : 'en-US')),
      el('span', t(e.status)), el('span', e.prob == null ? t('na') : e.prob + '%'), b);
    ul.append(li);
  });
}

/* ================= INIT ================= */
function init() {
  L = store.get('dfa_lang', 'en'); if (!LANGS.includes(L)) L = 'en'; $('#lang').value = L;
  $('#lang').addEventListener('change', e => { L = e.target.value; store.set('dfa_lang', L); applyLang(); });
  $$('.tab').forEach(b => b.addEventListener('click', () => setType(b.dataset.type)));
  const drop = $('#drop'), input = $('#file');
  input.addEventListener('change', () => handleFile(input.files[0]));
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => handleFile(e.dataTransfer.files[0]));
  $('#analyze').addEventListener('click', onAnalyze);
  $('#opac').addEventListener('input', drawEvidence);
  $('#rcfile').addEventListener('change', e => e.target.files[0] && inspect(e.target.files[0]));
  $('#chReal').addEventListener('click', () => answer(false)); $('#chFake').addEventListener('click', () => answer(true));
  $('#chNext').addEventListener('click', () => { quiz.answered = false; quiz.i++; if (quiz.i >= QUIZ.length) quiz.done = true; renderQuiz(); });
  $('#chAgain').addEventListener('click', () => { Object.assign(quiz, { i: 0, score: 0, done: false, answered: false }); renderQuiz(); });
  $('#clearHist').addEventListener('click', () => { store.set('dfa_hist', []); renderHist(); toast('ok_clear'); });
  $('#mclose').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });
  $('#burger').addEventListener('click', () => { const o = $('#menu').classList.toggle('open'); $('#burger').setAttribute('aria-expanded', o); });
  $$('#menu a').forEach(a => a.addEventListener('click', () => $('#menu').classList.remove('open')));
  const top = $('#top'); top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  window.addEventListener('scroll', () => { top.hidden = window.scrollY < 600; }, { passive: true });
  setType('image'); drawEvidence(); icons();
}
document.addEventListener('DOMContentLoaded', init);
})();
