export type LangCode = 'en' | 'ko' | 'zh' | 'ru' | 'es' | 'fr' | 'hi';

export interface Translations {
  // Header
  portfolio: string;
  balance: string;
  deposit: string;
  placePrediction: string;
  withdraw: string;
  notifications: string;
  settings: string;
  myBets: string;
  signOut: string;
  signIn: string;
  location: string;
  language: string;
  switchLanguage: string;

  // Category tabs
  top: string;
  politics: string;
  crypto: string;
  technology: string;
  sports: string;
  finance: string;

  // Market filters & page
  searchMarkets: string;
  sortBy: string;
  allMarkets: string;
  open: string;
  closed: string;
  resolved: string;
  loadingMarkets: string;
  noMarketsFound: string;
  tryAdjusting: string;
  mostActive: string;
  highVolume: string;
  newest: string;
  closingSoon: string;

  // Market cards
  yes: string;
  no: string;
  vol: string;
  live: string;
  remaining: string;
  daysLeft: string;
  monthsLeft: string;
  aboutMonthsLeft: string;
  moreOutcomes: string;

  // Hero
  heroCrypto: string;
  heroTagline: string;
  heroSports: string;
  heroSportsTagline: string;
  heroPolitics: string;
  heroPoliticsTagline: string;
  heroTechnology: string;
  heroTechnologyTagline: string;
  heroFinance: string;
  heroFinanceTagline: string;

  // Auth modal
  loginOrSignUp: string;
  continueWithGoogle: string;
  emailAddress: string;
  continueWithWallet: string;
  agreeTerms: string;
  termsOfService: string;
  privacyPolicy: string;
  securedBy: string;
  authenticating: string;

  // Language switcher
  selectLanguage: string;
  currentLanguage: string;
  cancel: string;
  apply: string;

  // Auth modal extras
  selectYourWallet: string;
  lastUsed: string;
  requestingSignature: string;
  pleaseSign: string;
  back: string;

  // Mobile nav
  home: string;
  search: string;
  breaking: string;
  more: string;
  support: string;
  termsOfUse: string;
  close: string;
  blog: string;
  whitepaper: string;
  cookiePolicy: string;
  comingSoon: string;
  getEarlyAccess: string;
  waitlistTagline: string;
  waitlistSubtagline: string;
  joinWaitlist: string;
  joining: string;

  // Header dropdown
  darkMode: string;
  helpCenter: string;
  disconnectWallet: string;
  disconnectAndLogOut: string;
  logout: string;

  // Search hints
  searchHints: string[];

  // Market filters
  hideCrypto: string;
  hidePolitics: string;
  hideSports: string;
  hideTechnology: string;
  clearFilters: string;

  // Deposit modal
  portfolioBalance: string;
  useCrypto: string;
  useFiat: string;
  transferCrypto: string;
  noLimitInstant: string;
  arc: string;
  transferFromWallet: string;
  connectWallet: string;
  sendUSDCDirectly: string;
  fromExchange: string;
  withdrawUSDCFromCEX: string;

  // Market detail page
  marketNotFound: string;

  // Trade multipliers (prediction card expanded)
  sharpness: string;
  leadTime: string;
  totalQuality: string;
  estFee: string;
  estProfit: string;

  // Sort dropdown
  averagePrice: string;
  alphabetically: string;
  date: string;

  // My bets / portfolio page
  availableToTrade: string;
  positionsValue: string;
  biggestWin: string;
  predictions: string;
  profitLoss: string;
  positions: string;
  activity: string;
  active: string;
  closedPositions: string;
  searchPositions: string;
  result: string;
  market: string;
  totalTraded: string;
  amount: string;
  staked: string;
  noActivePositions: string;
  joined: string;
  total: string;

  // Prediction card
  backToMarkets: string;
  resolvesIn: string;
  currentPrice: string;
  communityForecast: string;
  noPredictionsYet: string;
  priceRangeUSD: string;
  tradeMultipliers: string;
  minLeadRequired: string;
  minimum24hLead: string;
  rules: string;
  marketContext: string;
  showMore: string;
  showLess: string;
  max: string;
  approvingUSDC: string;

  // Time remaining (fully localized, no English prefix)
  hoursRemaining: string;
  minutesRemaining: string;
  oneDayLeft: string;
  oneMonthLeft: string;
}

export const LANGUAGES: { code: LangCode; name: string; nativeName: string; flag: string; countryCodes: string[] }[] = [
  { code: 'en', name: 'English',            nativeName: 'English',    flag: '🇬🇧', countryCodes: ['US','GB','AU','CA','NZ','IE','ZA','NG','KE','GH','UG','TZ'] },
  { code: 'ko', name: 'Korean',             nativeName: '한국어',      flag: '🇰🇷', countryCodes: ['KR'] },
  { code: 'zh', name: 'Chinese',            nativeName: '中文',        flag: '🇨🇳', countryCodes: ['CN','TW','HK','SG','MO'] },
  { code: 'ru', name: 'Russian',            nativeName: 'Русский',    flag: '🇷🇺', countryCodes: ['RU','BY','KZ','KG','TJ'] },
  { code: 'es', name: 'Spanish',            nativeName: 'Español',    flag: '🇪🇸', countryCodes: ['ES','MX','AR','CO','CL','PE','VE','EC','BO','PY','UY','CR','PA','DO','HN','SV','GT','NI','CU','PR'] },
  { code: 'fr', name: 'French',             nativeName: 'Français',   flag: '🇫🇷', countryCodes: ['FR','BE','CH','LU','MC','BF','BI','BJ','CD','CF','CG','CI','CM','DJ','DZ','GA','GN','GW','HT','KM','MA','MG','ML','MR','MU','NE','RW','SC','SN','TD','TG','TN'] },
  { code: 'hi', name: 'Hindi',              nativeName: 'हिन्दी',     flag: '🇮🇳', countryCodes: ['IN'] },
];

/** Return the suggested language code for a given ISO country code */
export function suggestLanguage(countryCode: string): LangCode {
  const upper = countryCode.toUpperCase();
  for (const lang of LANGUAGES) {
    if (lang.countryCodes.includes(upper)) return lang.code;
  }
  return 'en';
}

const T: Record<LangCode, Translations> = {
  en: {
    portfolio: 'Portfolio', deposit: 'Deposit', placePrediction: 'Place Prediction', withdraw: 'Withdraw',
    notifications: 'Notifications', settings: 'Settings', myBets: 'My Bets',
    signOut: 'Sign Out', signIn: 'Sign In', location: 'Location', language: 'Language',
    switchLanguage: 'Switch Language',
    top: 'Top', politics: 'Politics', crypto: 'Crypto', technology: 'Technology',
    sports: 'Sports', finance: 'Finance',
    searchMarkets: 'Search markets...', sortBy: 'Sort by', allMarkets: 'All Markets',
    open: 'Open', closed: 'Closed', resolved: 'Resolved',
    loadingMarkets: 'Loading markets...', noMarketsFound: 'No markets found',
    tryAdjusting: 'Try adjusting your filters or search query',
    mostActive: 'Most Active 24h', highVolume: 'High Volume', newest: 'Newest', closingSoon: 'Closing Soon',
    yes: 'Yes', no: 'No', vol: 'Vol', live: 'LIVE', remaining: 'remaining',
    daysLeft: 'days left', monthsLeft: 'months left', aboutMonthsLeft: 'about {n} months left',
    moreOutcomes: '+{n} more outcomes',
    heroCrypto: 'Crypto', heroTagline: 'Profit from bold, early, and accurate price forecasts on BTC, ETH, ARC and more.',
    heroSports: 'Sports', heroSportsTagline: 'Predict match outcomes, scores, and championship winners before the final whistle.',
    heroPolitics: 'Politics', heroPoliticsTagline: 'Forecast elections, policy outcomes, and geopolitical events with real stakes.',
    heroTechnology: 'Technology', heroTechnologyTagline: 'Predict product launches, AI breakthroughs, and the future of tech.',
    heroFinance: 'Finance', heroFinanceTagline: 'Forecast stocks, interest rates, and macroeconomic shifts before the market moves.',
    loginOrSignUp: 'Log in or sign up', continueWithGoogle: 'Continue with Google',
    emailAddress: 'Email address', continueWithWallet: 'Continue with a wallet',
    agreeTerms: 'By continuing, you agree to our', termsOfService: 'Terms of Service',
    privacyPolicy: 'Privacy Policy', securedBy: 'Secured by', authenticating: 'Authenticating...',
    selectLanguage: 'Select Language', currentLanguage: 'Current Language', cancel: 'Cancel', apply: 'Apply',
    selectYourWallet: 'Select your wallet', lastUsed: 'Last used', requestingSignature: 'Requesting Signature', pleaseSign: 'Please sign to connect.', back: 'Back',
    home: 'Home', search: 'Search', breaking: 'Breaking', more: 'More', support: 'Support', termsOfUse: 'Terms of Use', close: 'Close',
    blog: 'Blog', whitepaper: 'Whitepaper', cookiePolicy: 'Cookie Policy', comingSoon: 'Coming Soon', getEarlyAccess: 'Get early access', waitlistTagline: "The prediction market that doesn't care if you're right or wrong.", waitlistSubtagline: 'Monetize your boldness on Predensity.', joinWaitlist: 'Join waitlist', joining: 'Joining...',
    darkMode: 'Dark Mode', helpCenter: 'Help Center', disconnectWallet: 'Disconnect Wallet', disconnectAndLogOut: 'Disconnect & Log Out', logout: 'Logout',
    hoursRemaining: '{n}h remaining', minutesRemaining: '{n}m remaining', oneDayLeft: '1 day left', oneMonthLeft: '1 month left',
    searchHints: ['Where Will BTC Price Land?', 'Will BTC hit $150K?', 'Where will ETH price land?', 'World Cup winner?', 'Fed interest rates?', 'Tesla stock price?', 'FIFA World Cup 2026?'],
    hideCrypto: 'Hide crypto', hidePolitics: 'Hide politics', hideSports: 'Hide sports', hideTechnology: 'Hide technology', clearFilters: 'Clear filters',
    backToMarkets: 'Back to Markets', resolvesIn: 'Resolves in', currentPrice: 'Current Price', communityForecast: 'Community Forecast',
    noPredictionsYet: 'No predictions yet. Place a bet to see the community forecast.',
    priceRangeUSD: 'Price Range (USD)', tradeMultipliers: 'Trade Multipliers & Fees', minLeadRequired: 'Min 24h lead required', minimum24hLead: 'Minimum 24h lead time required',
    balance: 'Balance', rules: 'Rules', marketContext: 'Market Context', showMore: 'Show more', showLess: 'Show less', max: 'MAX', approvingUSDC: 'Approving USDC...',
    portfolioBalance: 'Portfolio Balance', useCrypto: 'Use Crypto', useFiat: 'Use Fiat',
    transferCrypto: 'Transfer Crypto', noLimitInstant: 'No limit - Instant', arc: 'Arc',
    transferFromWallet: 'Transfer from Wallet', connectWallet: 'Connect Wallet', sendUSDCDirectly: 'Send USDC directly',
    fromExchange: 'From Exchange', withdrawUSDCFromCEX: 'Withdraw USDC from CEX',
    marketNotFound: 'Market Not Found',
    sharpness: 'Sharpness', leadTime: 'Lead Time', totalQuality: 'Total Quality', estFee: 'Est. Fee', estProfit: 'Est. Profit',
    availableToTrade: 'Available to trade', positionsValue: 'Positions Value', biggestWin: 'Biggest Win', predictions: 'Predictions',
    profitLoss: 'Profit/Loss', positions: 'Positions', activity: 'Activity', active: 'Active', closedPositions: 'Closed',
    searchPositions: 'Search positions', result: 'Result', totalTraded: 'Total Traded', amount: 'Amount',
    staked: 'staked', noActivePositions: 'No active positions.', joined: 'Joined', total: 'total',
    market: 'Market', averagePrice: 'Average Price', alphabetically: 'Alphabetically', date: 'Date',
  },
  ko: {
    portfolio: '포트폴리오', deposit: '입금', placePrediction: '예측하기', withdraw: '출금',
    notifications: '알림', settings: '설정', myBets: '내 베팅',
    signOut: '로그아웃', signIn: '로그인', location: '위치', language: '언어',
    switchLanguage: '언어 변경',
    top: '인기', politics: '정치', crypto: '크립토', technology: '기술',
    sports: '스포츠', finance: '금융',
    searchMarkets: '마켓 검색...', sortBy: '정렬', allMarkets: '전체 마켓',
    open: '진행 중', closed: '종료', resolved: '해결됨',
    loadingMarkets: '마켓 로딩 중...', noMarketsFound: '마켓을 찾을 수 없습니다',
    tryAdjusting: '필터 또는 검색어를 조정해 보세요',
    mostActive: '24시간 가장 활발', highVolume: '높은 거래량', newest: '최신', closingSoon: '마감 임박',
    yes: '예', no: '아니오', vol: '거래량', live: '실시간', remaining: '남음',
    daysLeft: '일 남음', monthsLeft: '개월 남음', aboutMonthsLeft: '약 {n}개월 남음',
    moreOutcomes: '+{n}개 더보기',
    heroCrypto: '크립토', heroTagline: 'BTC, ETH, HBAR 등의 대담하고 정확한 가격 예측으로 수익을 창출하세요.',
    heroSports: '스포츠', heroSportsTagline: '최종 휘슬 전에 경기 결과, 점수, 챔피언십 우승자를 예측하세요.',
    heroPolitics: '정치', heroPoliticsTagline: '선거, 정책 결과, 지정학적 이벤트를 실제 베팅으로 예측하세요.',
    heroTechnology: '기술', heroTechnologyTagline: '제품 출시, AI 혁신, 기술의 미래를 예측하세요.',
    heroFinance: '금융', heroFinanceTagline: '시장이 움직이기 전에 주식, 금리, 거시경제 변화를 예측하세요.',
    loginOrSignUp: '로그인 또는 회원가입', continueWithGoogle: 'Google로 계속',
    emailAddress: '이메일 주소', continueWithWallet: '지갑으로 계속',
    agreeTerms: '계속하면 다음에 동의하는 것입니다', termsOfService: '서비스 약관',
    privacyPolicy: '개인정보처리방침', securedBy: '보안 제공', authenticating: '인증 중...',
    selectLanguage: '언어 선택', currentLanguage: '현재 언어', cancel: '취소', apply: '적용',
    selectYourWallet: '지갑 선택', lastUsed: '최근 사용', requestingSignature: '서명 요청 중', pleaseSign: '지갑에서 서명해 주세요.', back: '뒤로',
    home: '홈', search: '검색', breaking: '속보', more: '더보기', support: '지원', termsOfUse: '이용약관', close: '닫기',
    blog: '블로그', whitepaper: '백서', cookiePolicy: '쿠키 정책', comingSoon: '곧 출시', getEarlyAccess: '사전 등록하기', waitlistTagline: '맞든 틀리든 상관없는 예측 시장.', waitlistSubtagline: 'Predensity에서 대담함을 수익으로.', joinWaitlist: '대기자 명단 등록', joining: '등록 중...',
    darkMode: '다크 모드', helpCenter: '도움말 센터', disconnectWallet: '지갑 연결 해제', disconnectAndLogOut: '연결 해제 및 로그아웃', logout: '로그아웃',
    hoursRemaining: '{n}시간 남음', minutesRemaining: '{n}분 남음', oneDayLeft: '1일 남음', oneMonthLeft: '1개월 남음',
    searchHints: ['HBAR 가격은 어디에 착지할까요?', 'BTC가 $150K에 도달할까요?', 'ETH 가격은 어디에 착지할까요?', '월드컵 우승팀은?', '연준 금리는?', '테슬라 주가는?', 'FIFA 월드컵 2026?'],
    hideCrypto: '크립토 숨기기', hidePolitics: '정치 숨기기', hideSports: '스포츠 숨기기', hideTechnology: '기술 숨기기', clearFilters: '필터 초기화',
    backToMarkets: '마켓으로 돌아가기', resolvesIn: '종료까지', currentPrice: '현재 가격', communityForecast: '커뮤니티 예측',
    noPredictionsYet: '아직 예측이 없습니다. 베팅하여 커뮤니티 예측을 확인하세요.',
    priceRangeUSD: '가격 범위 (USD)', tradeMultipliers: '거래 배수 및 수수료', minLeadRequired: '최소 24시간 선행 필요', minimum24hLead: '최소 24시간 선행 시간 필요',
    balance: '잔액', rules: '규칙', marketContext: '마켓 컨텍스트', showMore: '더 보기', showLess: '접기', max: '최대', approvingUSDC: 'USDC 승인 중...',
    portfolioBalance: '포트폴리오 잔액', useCrypto: '크립토 사용', useFiat: '법정화폐 사용',
    transferCrypto: '크립토 전송', noLimitInstant: '한도 없음 - 즉시', arc: 'Arc',
    transferFromWallet: '지갑에서 전송', connectWallet: '지갑 연결', sendUSDCDirectly: 'USDC 직접 전송',
    fromExchange: '거래소에서', withdrawUSDCFromCEX: 'CEX에서 USDC 출금',
    marketNotFound: '마켓을 찾을 수 없습니다',
    sharpness: '정확도', leadTime: '리드 타임', totalQuality: '총 품질', estFee: '예상 수수료', estProfit: '예상 수익',
    availableToTrade: '거래 가능', positionsValue: '포지션 가치', biggestWin: '최대 수익', predictions: '예측',
    profitLoss: '수익/손실', positions: '포지션', activity: '활동', active: '활성', closedPositions: '종료됨',
    searchPositions: '포지션 검색', result: '결과', totalTraded: '총 거래량', amount: '금액',
    staked: '스테이킹됨', noActivePositions: '활성 포지션이 없습니다.', joined: '가입', total: '합계',
    market: '마켓', averagePrice: '평균 가격', alphabetically: '알파벳순', date: '날짜',
  },
  zh: {
    portfolio: '投资组合', deposit: '充值', placePrediction: '下预测', withdraw: '提现',
    notifications: '通知', settings: '设置', myBets: '我的预测',
    signOut: '退出登录', signIn: '登录', location: '位置', language: '语言',
    switchLanguage: '切换语言',
    top: '热门', politics: '政治', crypto: '加密', technology: '科技',
    sports: '体育', finance: '金融',
    searchMarkets: '搜索市场...', sortBy: '排序', allMarkets: '全部市场',
    open: '进行中', closed: '已关闭', resolved: '已解决',
    loadingMarkets: '加载市场中...', noMarketsFound: '未找到市场',
    tryAdjusting: '请尝试调整筛选条件或搜索词',
    mostActive: '24小时最活跃', highVolume: '高交易量', newest: '最新', closingSoon: '即将结束',
    yes: '是', no: '否', vol: '交易量', live: '直播', remaining: '剩余',
    daysLeft: '天后结束', monthsLeft: '个月后结束', aboutMonthsLeft: '约{n}个月后结束',
    moreOutcomes: '+{n}个结果',
    heroCrypto: '加密货币', heroTagline: '通过对BTC、ETH、HBAR等的大胆、精准预测获利。',
    heroSports: '体育', heroSportsTagline: '在终场哨声前预测比赛结果、比分和冠军得主。',
    heroPolitics: '政治', heroPoliticsTagline: '预测选举、政策走向和地缘政治事件，真实押注。',
    heroTechnology: '科技', heroTechnologyTagline: '预测产品发布、AI突破和科技未来走向。',
    heroFinance: '金融', heroFinanceTagline: '在市场变动前预测股票、利率和宏观经济走势。',
    loginOrSignUp: '登录或注册', continueWithGoogle: '使用Google继续',
    emailAddress: '电子邮件地址', continueWithWallet: '使用钱包继续',
    agreeTerms: '继续即表示您同意我们的', termsOfService: '服务条款',
    privacyPolicy: '隐私政策', securedBy: '安全由', authenticating: '验证中...',
    selectLanguage: '选择语言', currentLanguage: '当前语言', cancel: '取消', apply: '应用',
    selectYourWallet: '选择钱包', lastUsed: '最近使用', requestingSignature: '请求签名', pleaseSign: '请在钱包中签名。', back: '返回',
    home: '首页', search: '搜索', breaking: '突发', more: '更多', support: '支持', termsOfUse: '使用条款', close: '关闭',
    blog: '博客', whitepaper: '白皮书', cookiePolicy: 'Cookie 政策', comingSoon: '即将推出', getEarlyAccess: '抢先体验', waitlistTagline: '不在乎你对错的预测市场。', waitlistSubtagline: '在 Predensity 上将你的大胆变现。', joinWaitlist: '加入等候名单', joining: '加入中...',
    darkMode: '深色模式', helpCenter: '帮助中心', disconnectWallet: '断开钱包', disconnectAndLogOut: '断开并退出', logout: '退出登录',
    hoursRemaining: '{n}小时后', minutesRemaining: '{n}分钟后', oneDayLeft: '1天后结束', oneMonthLeft: '1个月后结束',
    searchHints: ['HBAR价格会落在哪里？', 'BTC会突破$150K吗？', 'ETH价格走向何方？', '世界杯冠军？', '美联储利率？', '特斯拉股价？', 'FIFA世界杯2026？'],
    hideCrypto: '隐藏加密', hidePolitics: '隐藏政治', hideSports: '隐藏体育', hideTechnology: '隐藏科技', clearFilters: '清除筛选',
    backToMarkets: '返回市场', resolvesIn: '结束于', currentPrice: '当前价格', communityForecast: '社区预测',
    noPredictionsYet: '暂无预测。下注以查看社区预测。',
    priceRangeUSD: '价格范围 (USD)', tradeMultipliers: '交易倍数与费用', minLeadRequired: '需至少24小时提前', minimum24hLead: '最少需要24小时提前时间',
    balance: '余额', rules: '规则', marketContext: '市场背景', showMore: '显示更多', showLess: '收起', max: '最大', approvingUSDC: '正在授权 USDC...',
    portfolioBalance: '投资组合余额', useCrypto: '使用加密货币', useFiat: '使用法币',
    transferCrypto: '转账加密货币', noLimitInstant: '无限额 - 即时', arc: 'Arc',
    transferFromWallet: '从钱包转账', connectWallet: '连接钱包', sendUSDCDirectly: '直接发送USDC',
    fromExchange: '从交易所', withdrawUSDCFromCEX: '从CEX提取USDC',
    marketNotFound: '市场未找到',
    sharpness: '精准度', leadTime: '提前量', totalQuality: '综合质量', estFee: '预估费用', estProfit: '预估收益',
    availableToTrade: '可交易余额', positionsValue: '持仓价值', biggestWin: '最大盈利', predictions: '预测',
    profitLoss: '盈亏', positions: '持仓', activity: '活动', active: '活跃', closedPositions: '已关闭',
    searchPositions: '搜索持仓', result: '结果', totalTraded: '总交易额', amount: '金额',
    staked: '已质押', noActivePositions: '暂无活跃持仓。', joined: '加入于', total: '合计',
    market: '市场', averagePrice: '平均价格', alphabetically: '按字母排序', date: '日期',
  },
  ru: {
    portfolio: 'Портфель', deposit: 'Пополнить', placePrediction: 'Сделать прогноз', withdraw: 'Вывести',
    notifications: 'Уведомления', settings: 'Настройки', myBets: 'Мои ставки',
    signOut: 'Выйти', signIn: 'Войти', location: 'Местоположение', language: 'Язык',
    switchLanguage: 'Сменить язык',
    top: 'Топ', politics: 'Политика', crypto: 'Крипто', technology: 'Технологии',
    sports: 'Спорт', finance: 'Финансы',
    searchMarkets: 'Поиск рынков...', sortBy: 'Сортировка', allMarkets: 'Все рынки',
    open: 'Открытые', closed: 'Закрытые', resolved: 'Завершённые',
    loadingMarkets: 'Загрузка рынков...', noMarketsFound: 'Рынки не найдены',
    tryAdjusting: 'Попробуйте изменить фильтры или поисковый запрос',
    mostActive: 'Самые активные за 24ч', highVolume: 'Высокий объём', newest: 'Новые', closingSoon: 'Скоро закрываются',
    yes: 'Да', no: 'Нет', vol: 'Объём', live: 'LIVE', remaining: 'осталось',
    daysLeft: 'дн. осталось', monthsLeft: 'мес. осталось', aboutMonthsLeft: 'около {n} мес.',
    moreOutcomes: '+{n} исходов',
    heroCrypto: 'Крипто', heroTagline: 'Зарабатывайте на смелых и точных прогнозах цен BTC, ETH, HBAR и других.',
    heroSports: 'Спорт', heroSportsTagline: 'Предсказывайте результаты матчей, счёта и победителей до финального свистка.',
    heroPolitics: 'Политика', heroPoliticsTagline: 'Прогнозируйте выборы, политические решения и геополитические события.',
    heroTechnology: 'Технологии', heroTechnologyTagline: 'Предсказывайте запуски продуктов, прорывы ИИ и будущее технологий.',
    heroFinance: 'Финансы', heroFinanceTagline: 'Прогнозируйте акции, процентные ставки и макроэкономические сдвиги.',
    loginOrSignUp: 'Войти или зарегистрироваться', continueWithGoogle: 'Продолжить с Google',
    emailAddress: 'Адрес электронной почты', continueWithWallet: 'Продолжить с кошельком',
    agreeTerms: 'Продолжая, вы соглашаетесь с нашими', termsOfService: 'Условиями использования',
    privacyPolicy: 'Политикой конфиденциальности', securedBy: 'Защищено', authenticating: 'Аутентификация...',
    selectLanguage: 'Выбор языка', currentLanguage: 'Текущий язык', cancel: 'Отмена', apply: 'Применить',
    selectYourWallet: 'Выберите кошелёк', lastUsed: 'Последний использованный', requestingSignature: 'Запрос подписи', pleaseSign: 'Подпишите запрос в кошельке.', back: 'Назад',
    home: 'Главная', search: 'Поиск', breaking: 'Срочно', more: 'Ещё', support: 'Поддержка', termsOfUse: 'Условия', close: 'Закрыть',
    blog: 'Блог', whitepaper: 'Документация', cookiePolicy: 'Политика cookies', comingSoon: 'Скоро', getEarlyAccess: 'Получите ранний доступ', waitlistTagline: 'Рынок прогнозов, которому всё равно, правы вы или нет.', waitlistSubtagline: 'Монетизируйте свою смелость на Predensity.', joinWaitlist: 'В список ожидания', joining: 'Регистрация...',
    darkMode: 'Тёмный режим', helpCenter: 'Центр помощи', disconnectWallet: 'Отключить кошелёк', disconnectAndLogOut: 'Отключить и выйти', logout: 'Выйти',
    hoursRemaining: 'осталось {n}ч', minutesRemaining: 'осталось {n}мин', oneDayLeft: '1 день осталось', oneMonthLeft: '1 мес. осталось',
    searchHints: ['Куда пойдёт цена HBAR?', 'BTC достигнет $150K?', 'Куда пойдёт цена ETH?', 'Победитель Кубка мира?', 'Ставки ФРС?', 'Акции Tesla?', 'ЧМ FIFA 2026?'],
    hideCrypto: 'Скрыть крипто', hidePolitics: 'Скрыть политику', hideSports: 'Скрыть спорт', hideTechnology: 'Скрыть технологии', clearFilters: 'Сбросить фильтры',
    backToMarkets: 'Назад к рынкам', resolvesIn: 'Завершится через', currentPrice: 'Текущая цена', communityForecast: 'Прогноз сообщества',
    noPredictionsYet: 'Прогнозов пока нет. Сделайте ставку, чтобы увидеть прогноз.',
    priceRangeUSD: 'Диапазон цен (USD)', tradeMultipliers: 'Множители и комиссии', minLeadRequired: 'Мин. 24ч упреждения', minimum24hLead: 'Требуется минимум 24ч упреждения',
    balance: 'Баланс', rules: 'Правила', marketContext: 'Контекст рынка', showMore: 'Подробнее', showLess: 'Свернуть', max: 'МАКС', approvingUSDC: 'Одобрение USDC...',
    portfolioBalance: 'Баланс портфеля', useCrypto: 'Использовать крипто', useFiat: 'Использовать фиат',
    transferCrypto: 'Перевод крипто', noLimitInstant: 'Без лимита - Мгновенно', arc: 'Arc',
    transferFromWallet: 'Перевод с кошелька', connectWallet: 'Подключить кошелёк', sendUSDCDirectly: 'Отправить USDC напрямую',
    fromExchange: 'С биржи', withdrawUSDCFromCEX: 'Вывести USDC с CEX',
    marketNotFound: 'Рынок не найден',
    sharpness: 'Точность', leadTime: 'Упреждение', totalQuality: 'Общее качество', estFee: 'Комиссия', estProfit: 'Ожид. прибыль',
    availableToTrade: 'Доступно для торговли', positionsValue: 'Стоимость позиций', biggestWin: 'Лучший выигрыш', predictions: 'Прогнозы',
    profitLoss: 'Прибыль/Убыток', positions: 'Позиции', activity: 'Активность', active: 'Активные', closedPositions: 'Закрытые',
    searchPositions: 'Поиск позиций', result: 'Результат', totalTraded: 'Всего торговано', amount: 'Сумма',
    staked: 'поставлено', noActivePositions: 'Нет активных позиций.', joined: 'Зарегистрирован', total: 'итого',
    market: 'Рынок', averagePrice: 'Средняя цена', alphabetically: 'По алфавиту', date: 'Дата',
  },
  es: {
    portfolio: 'Portafolio', deposit: 'Depositar', placePrediction: 'Hacer predicción', withdraw: 'Retirar',
    notifications: 'Notificaciones', settings: 'Configuración', myBets: 'Mis apuestas',
    signOut: 'Cerrar sesión', signIn: 'Iniciar sesión', location: 'Ubicación', language: 'Idioma',
    switchLanguage: 'Cambiar idioma',
    top: 'Popular', politics: 'Política', crypto: 'Cripto', technology: 'Tecnología',
    sports: 'Deportes', finance: 'Finanzas',
    searchMarkets: 'Buscar mercados...', sortBy: 'Ordenar por', allMarkets: 'Todos los mercados',
    open: 'Abierto', closed: 'Cerrado', resolved: 'Resuelto',
    loadingMarkets: 'Cargando mercados...', noMarketsFound: 'No se encontraron mercados',
    tryAdjusting: 'Intenta ajustar los filtros o la búsqueda',
    mostActive: 'Más activos 24h', highVolume: 'Alto volumen', newest: 'Más recientes', closingSoon: 'Cierra pronto',
    yes: 'Sí', no: 'No', vol: 'Vol', live: 'EN VIVO', remaining: 'restante',
    daysLeft: 'días restantes', monthsLeft: 'meses restantes', aboutMonthsLeft: 'aprox. {n} meses',
    moreOutcomes: '+{n} resultados más',
    heroCrypto: 'Cripto', heroTagline: 'Obtén ganancias con predicciones audaces y precisas sobre BTC, ETH, HBAR y más.',
    heroSports: 'Deportes', heroSportsTagline: 'Predice resultados, marcadores y campeones antes del pitido final.',
    heroPolitics: 'Política', heroPoliticsTagline: 'Pronostica elecciones, políticas y eventos geopolíticos con apuestas reales.',
    heroTechnology: 'Tecnología', heroTechnologyTagline: 'Predice lanzamientos, avances en IA y el futuro de la tecnología.',
    heroFinance: 'Finanzas', heroFinanceTagline: 'Pronostica acciones, tasas de interés y cambios macroeconómicos antes del mercado.',
    loginOrSignUp: 'Iniciar sesión o registrarse', continueWithGoogle: 'Continuar con Google',
    emailAddress: 'Correo electrónico', continueWithWallet: 'Continuar con cartera',
    agreeTerms: 'Al continuar, aceptas nuestros', termsOfService: 'Términos de servicio',
    privacyPolicy: 'Política de privacidad', securedBy: 'Protegido por', authenticating: 'Autenticando...',
    selectLanguage: 'Seleccionar idioma', currentLanguage: 'Idioma actual', cancel: 'Cancelar', apply: 'Aplicar',
    selectYourWallet: 'Selecciona tu cartera', lastUsed: 'Último usado', requestingSignature: 'Solicitando firma', pleaseSign: 'Por favor firma en tu cartera.', back: 'Atrás',
    home: 'Inicio', search: 'Buscar', breaking: 'Urgente', more: 'Más', support: 'Soporte', termsOfUse: 'Términos de uso', close: 'Cerrar',
    blog: 'Blog', whitepaper: 'Libro blanco', cookiePolicy: 'Política de cookies', comingSoon: 'Próximamente', getEarlyAccess: 'Obtén acceso anticipado', waitlistTagline: 'El mercado de predicciones al que no le importa si tienes razón o no.', waitlistSubtagline: 'Monetiza tu audacia en Predensity.', joinWaitlist: 'Unirse a la lista', joining: 'Uniéndose...',
    darkMode: 'Modo oscuro', helpCenter: 'Centro de ayuda', disconnectWallet: 'Desconectar cartera', disconnectAndLogOut: 'Desconectar y salir', logout: 'Cerrar sesión',
    hoursRemaining: '{n}h restantes', minutesRemaining: '{n}min restantes', oneDayLeft: '1 día restante', oneMonthLeft: '1 mes restante',
    searchHints: ['¿Dónde llegará el precio del HBAR?', '¿BTC llegará a $150K?', '¿Dónde irá el precio de ETH?', '¿Ganador del Mundial?', '¿Tasas de la Fed?', '¿Precio acción Tesla?', '¿Copa Mundial FIFA 2026?'],
    hideCrypto: 'Ocultar cripto', hidePolitics: 'Ocultar política', hideSports: 'Ocultar deportes', hideTechnology: 'Ocultar tecnología', clearFilters: 'Borrar filtros',
    backToMarkets: 'Volver a mercados', resolvesIn: 'Resuelve en', currentPrice: 'Precio actual', communityForecast: 'Pronóstico comunitario',
    noPredictionsYet: 'Sin predicciones aún. Haz una apuesta para ver el pronóstico.',
    priceRangeUSD: 'Rango de precio (USD)', tradeMultipliers: 'Multiplicadores y comisiones', minLeadRequired: 'Mín. 24h de anticipación', minimum24hLead: 'Se requiere mínimo 24h de anticipación',
    balance: 'Saldo', rules: 'Reglas', marketContext: 'Contexto del mercado', showMore: 'Ver más', showLess: 'Ver menos', max: 'MÁX', approvingUSDC: 'Aprobando USDC...',
    portfolioBalance: 'Saldo del portafolio', useCrypto: 'Usar Cripto', useFiat: 'Usar Fiat',
    transferCrypto: 'Transferir Cripto', noLimitInstant: 'Sin límite - Instantáneo', arc: 'Arc',
    transferFromWallet: 'Transferir desde Cartera', connectWallet: 'Conectar Cartera', sendUSDCDirectly: 'Enviar USDC directo',
    fromExchange: 'Desde Exchange', withdrawUSDCFromCEX: 'Retirar USDC del CEX',
    marketNotFound: 'Mercado no encontrado',
    sharpness: 'Precisión', leadTime: 'Tiempo de anticipación', totalQuality: 'Calidad total', estFee: 'Tarifa est.', estProfit: 'Ganancia est.',
    availableToTrade: 'Disponible para operar', positionsValue: 'Valor de posiciones', biggestWin: 'Mayor ganancia', predictions: 'Predicciones',
    profitLoss: 'Ganancia/Pérdida', positions: 'Posiciones', activity: 'Actividad', active: 'Activo', closedPositions: 'Cerradas',
    searchPositions: 'Buscar posiciones', result: 'Resultado', totalTraded: 'Total operado', amount: 'Cantidad',
    staked: 'apostado', noActivePositions: 'Sin posiciones activas.', joined: 'Unido', total: 'total',
    market: 'Mercado', averagePrice: 'Precio promedio', alphabetically: 'Alfabéticamente', date: 'Fecha',
  },
  fr: {
    portfolio: 'Portefeuille', deposit: 'Déposer', placePrediction: 'Faire une prédiction', withdraw: 'Retirer',
    notifications: 'Notifications', settings: 'Paramètres', myBets: 'Mes paris',
    signOut: 'Se déconnecter', signIn: 'Se connecter', location: 'Localisation', language: 'Langue',
    switchLanguage: 'Changer de langue',
    top: 'Tendances', politics: 'Politique', crypto: 'Crypto', technology: 'Technologie',
    sports: 'Sports', finance: 'Finance',
    searchMarkets: 'Rechercher des marchés...', sortBy: 'Trier par', allMarkets: 'Tous les marchés',
    open: 'Ouvert', closed: 'Fermé', resolved: 'Résolu',
    loadingMarkets: 'Chargement des marchés...', noMarketsFound: 'Aucun marché trouvé',
    tryAdjusting: 'Essayez de modifier vos filtres ou votre recherche',
    mostActive: 'Plus actifs 24h', highVolume: 'Volume élevé', newest: 'Plus récents', closingSoon: 'Ferme bientôt',
    yes: 'Oui', no: 'Non', vol: 'Vol', live: 'EN DIRECT', remaining: 'restant',
    daysLeft: 'jours restants', monthsLeft: 'mois restants', aboutMonthsLeft: 'environ {n} mois',
    moreOutcomes: '+{n} résultats',
    heroCrypto: 'Crypto', heroTagline: 'Profitez de prévisions audacieuses et précises sur BTC, ETH, HBAR et plus encore.',
    heroSports: 'Sports', heroSportsTagline: 'Prédisez les résultats, scores et champions avant le coup de sifflet final.',
    heroPolitics: 'Politique', heroPoliticsTagline: 'Pronostiquez élections, politiques et événements géopolitiques avec de vrais enjeux.',
    heroTechnology: 'Technologie', heroTechnologyTagline: 'Anticipez les lancements produits, avancées en IA et l\'avenir de la tech.',
    heroFinance: 'Finance', heroFinanceTagline: 'Prévoyez actions, taux d\'intérêt et changements macroéconomiques avant le marché.',
    loginOrSignUp: 'Se connecter ou s\'inscrire', continueWithGoogle: 'Continuer avec Google',
    emailAddress: 'Adresse e-mail', continueWithWallet: 'Continuer avec un portefeuille',
    agreeTerms: 'En continuant, vous acceptez nos', termsOfService: 'Conditions d\'utilisation',
    privacyPolicy: 'Politique de confidentialité', securedBy: 'Sécurisé par', authenticating: 'Authentification...',
    selectLanguage: 'Choisir la langue', currentLanguage: 'Langue actuelle', cancel: 'Annuler', apply: 'Appliquer',
    selectYourWallet: 'Choisissez votre portefeuille', lastUsed: 'Dernièrement utilisé', requestingSignature: 'Demande de signature', pleaseSign: 'Veuillez signer dans votre portefeuille.', back: 'Retour',
    home: 'Accueil', search: 'Rechercher', breaking: 'Urgent', more: 'Plus', support: 'Assistance', termsOfUse: "Conditions d'utilisation", close: 'Fermer',
    blog: 'Blog', whitepaper: 'Livre blanc', cookiePolicy: 'Politique de cookies', comingSoon: 'Bientôt disponible', getEarlyAccess: 'Obtenez un accès anticipé', waitlistTagline: "Le marché de prédictions qui se moque que vous ayez raison ou tort.", waitlistSubtagline: 'Monétisez votre audace sur Predensity.', joinWaitlist: "Rejoindre la liste d'attente", joining: 'Inscription...',
    darkMode: 'Mode sombre', helpCenter: "Centre d'aide", disconnectWallet: 'Déconnecter le portefeuille', disconnectAndLogOut: 'Déconnecter et quitter', logout: 'Se déconnecter',
    hoursRemaining: '{n}h restantes', minutesRemaining: '{n}min restantes', oneDayLeft: '1 jour restant', oneMonthLeft: '1 mois restant',
    searchHints: ['Où ira le prix du HBAR?', 'BTC atteindra $150K?', 'Où ira le prix de l\'ETH?', 'Vainqueur de la Coupe du monde?', 'Taux de la Fed?', 'Cours Tesla?', 'FIFA Coupe du monde 2026?'],
    hideCrypto: 'Masquer crypto', hidePolitics: 'Masquer politique', hideSports: 'Masquer sports', hideTechnology: 'Masquer technologie', clearFilters: 'Effacer les filtres',
    backToMarkets: 'Retour aux marchés', resolvesIn: 'Se résout dans', currentPrice: 'Prix actuel', communityForecast: 'Prévision communautaire',
    noPredictionsYet: "Pas encore de prédictions. Placez un pari pour voir la prévision.",
    priceRangeUSD: 'Plage de prix (USD)', tradeMultipliers: 'Multiplicateurs & frais', minLeadRequired: 'Min. 24h d\'avance requis', minimum24hLead: 'Délai minimum de 24h requis',
    balance: 'Solde', rules: 'Règles', marketContext: 'Contexte du marché', showMore: 'Afficher plus', showLess: 'Afficher moins', max: 'MAX', approvingUSDC: 'Approbation USDC...',
    portfolioBalance: 'Solde du portefeuille', useCrypto: 'Utiliser Crypto', useFiat: 'Utiliser Fiat',
    transferCrypto: 'Transférer Crypto', noLimitInstant: 'Sans limite - Instantané', arc: 'Arc',
    transferFromWallet: 'Transférer depuis Portefeuille', connectWallet: 'Connecter Portefeuille', sendUSDCDirectly: 'Envoyer USDC directement',
    fromExchange: 'Depuis Exchange', withdrawUSDCFromCEX: 'Retirer USDC du CEX',
    marketNotFound: 'Marché introuvable',
    sharpness: 'Précision', leadTime: 'Délai', totalQuality: 'Qualité totale', estFee: 'Frais est.', estProfit: 'Profit est.',
    availableToTrade: 'Disponible pour trader', positionsValue: 'Valeur des positions', biggestWin: 'Meilleur gain', predictions: 'Prédictions',
    profitLoss: 'Profit/Perte', positions: 'Positions', activity: 'Activité', active: 'Actif', closedPositions: 'Fermées',
    searchPositions: 'Rechercher positions', result: 'Résultat', totalTraded: 'Total tradé', amount: 'Montant',
    staked: 'misé', noActivePositions: 'Aucune position active.', joined: 'Inscrit', total: 'total',
    market: 'Marché', averagePrice: 'Prix moyen', alphabetically: 'Alphabétiquement', date: 'Date',
  },
  hi: {
    portfolio: 'पोर्टफोलियो', deposit: 'जमा करें', placePrediction: 'भविष्यवाणी करें', withdraw: 'निकालें',
    notifications: 'सूचनाएं', settings: 'सेटिंग्स', myBets: 'मेरी बेट्स',
    signOut: 'साइन आउट', signIn: 'साइन इन', location: 'स्थान', language: 'भाषा',
    switchLanguage: 'भाषा बदलें',
    top: 'टॉप', politics: 'राजनीति', crypto: 'क्रिप्टो', technology: 'तकनीक',
    sports: 'खेल', finance: 'वित्त',
    searchMarkets: 'बाज़ार खोजें...', sortBy: 'क्रमबद्ध करें', allMarkets: 'सभी बाज़ार',
    open: 'खुला', closed: 'बंद', resolved: 'हल हुआ',
    loadingMarkets: 'बाज़ार लोड हो रहे हैं...', noMarketsFound: 'कोई बाज़ार नहीं मिला',
    tryAdjusting: 'फ़िल्टर या खोज बदलकर देखें',
    mostActive: '24 घंटे सबसे सक्रिय', highVolume: 'उच्च वॉल्यूम', newest: 'नवीनतम', closingSoon: 'जल्द बंद',
    yes: 'हाँ', no: 'नहीं', vol: 'वॉल्यूम', live: 'लाइव', remaining: 'शेष',
    daysLeft: 'दिन बाकी', monthsLeft: 'महीने बाकी', aboutMonthsLeft: 'लगभग {n} महीने बाकी',
    moreOutcomes: '+{n} और परिणाम',
    heroCrypto: 'क्रिप्टो', heroTagline: 'BTC, ETH, HBAR और अन्य पर साहसी और सटीक मूल्य पूर्वानुमान से कमाएं।',
    heroSports: 'खेल', heroSportsTagline: 'अंतिम सीटी से पहले मैच परिणाम, स्कोर और चैंपियन का पूर्वानुमान लगाएं।',
    heroPolitics: 'राजनीति', heroPoliticsTagline: 'चुनाव, नीतिगत परिणाम और भू-राजनीतिक घटनाओं का पूर्वानुमान लगाएं।',
    heroTechnology: 'तकनीक', heroTechnologyTagline: 'उत्पाद लॉन्च, AI सफलताओं और तकनीक के भविष्य का पूर्वानुमान लगाएं।',
    heroFinance: 'वित्त', heroFinanceTagline: 'बाज़ार हिलने से पहले स्टॉक, ब्याज दरों और आर्थिक बदलावों का पूर्वानुमान लगाएं।',
    loginOrSignUp: 'लॉग इन या साइन अप', continueWithGoogle: 'Google से जारी रखें',
    emailAddress: 'ईमेल पता', continueWithWallet: 'वॉलेट से जारी रखें',
    agreeTerms: 'जारी रखकर आप हमारी', termsOfService: 'सेवा की शर्तों',
    privacyPolicy: 'गोपनीयता नीति', securedBy: 'सुरक्षित', authenticating: 'प्रमाणीकरण...',
    selectLanguage: 'भाषा चुनें', currentLanguage: 'वर्तमान भाषा', cancel: 'रद्द करें', apply: 'लागू करें',
    selectYourWallet: 'अपना वॉलेट चुनें', lastUsed: 'अंतिम उपयोग', requestingSignature: 'हस्ताक्षर का अनुरोध', pleaseSign: 'कृपया अपने वॉलेट में हस्ताक्षर करें।', back: 'वापस',
    home: 'होम', search: 'खोजें', breaking: 'ब्रेकिंग', more: 'और', support: 'सहायता', termsOfUse: 'उपयोग की शर्तें', close: 'बंद करें',
    blog: 'ब्लॉग', whitepaper: 'श्वेतपत्र', cookiePolicy: 'कुकी नीति', comingSoon: 'जल्द आ रहा है', getEarlyAccess: 'जल्दी पहुँच पाएं', waitlistTagline: 'भविष्यवाणी बाज़ार जिसे परवाह नहीं कि आप सही हैं या गलत।', waitlistSubtagline: 'Predensity पर अपनी हिम्मत को कमाई में बदलें।', joinWaitlist: 'प्रतीक्षा सूची में शामिल हों', joining: 'शामिल हो रहे हैं...',
    darkMode: 'डार्क मोड', helpCenter: 'सहायता केंद्र', disconnectWallet: 'वॉलेट डिस्कनेक्ट करें', disconnectAndLogOut: 'डिस्कनेक्ट करें और बाहर निकलें', logout: 'लॉग आउट',
    hoursRemaining: '{n}घं. शेष', minutesRemaining: '{n}मि. शेष', oneDayLeft: '1 दिन बाकी', oneMonthLeft: '1 महीना बाकी',
    searchHints: ['HBAR की कीमत कहां जाएगी?', 'क्या BTC $150K तक पहुंचेगा?', 'ETH की कीमत कहां जाएगी?', 'विश्व कप विजेता?', 'Fed ब्याज दरें?', 'Tesla शेयर मूल्य?', 'FIFA विश्व कप 2026?'],
    hideCrypto: 'क्रिप्टो छुपाएं', hidePolitics: 'राजनीति छुपाएं', hideSports: 'खेल छुपाएं', hideTechnology: 'तकनीक छुपाएं', clearFilters: 'फ़िल्टर हटाएं',
    backToMarkets: 'बाज़ार पर वापस', resolvesIn: 'समाप्त होगा', currentPrice: 'वर्तमान मूल्य', communityForecast: 'समुदाय पूर्वानुमान',
    noPredictionsYet: 'अभी तक कोई भविष्यवाणी नहीं। समुदाय पूर्वानुमान देखने के लिए दांव लगाएं।',
    priceRangeUSD: 'मूल्य सीमा (USD)', tradeMultipliers: 'ट्रेड गुणक और शुल्क', minLeadRequired: 'न्यूनतम 24 घंटे आवश्यक', minimum24hLead: 'न्यूनतम 24 घंटे की अग्रिम समय आवश्यक',
    balance: 'शेष', rules: 'नियम', marketContext: 'बाज़ार संदर्भ', showMore: 'अधिक दिखाएं', showLess: 'कम दिखाएं', max: 'अधिकतम', approvingUSDC: 'USDC स्वीकृत हो रहा है...',
    portfolioBalance: 'पोर्टफोलियो बैलेंस', useCrypto: 'क्रिप्टो उपयोग करें', useFiat: 'फिएट उपयोग करें',
    transferCrypto: 'क्रिप्टो ट्रांसफर करें', noLimitInstant: 'कोई सीमा नहीं - तुरंत', arc: 'Arc',
    transferFromWallet: 'वॉलेट से ट्रांसफर', connectWallet: 'वॉलेट जोड़ें', sendUSDCDirectly: 'USDC सीधे भेजें',
    fromExchange: 'एक्सचेंज से', withdrawUSDCFromCEX: 'CEX से USDC निकालें',
    marketNotFound: 'बाज़ार नहीं मिला',
    sharpness: 'सटीकता', leadTime: 'लीड टाइम', totalQuality: 'कुल गुणवत्ता', estFee: 'अनुमानित शुल्क', estProfit: 'अनुमानित लाभ',
    availableToTrade: 'ट्रेड के लिए उपलब्ध', positionsValue: 'पोजीशन मूल्य', biggestWin: 'सबसे बड़ी जीत', predictions: 'पूर्वानुमान',
    profitLoss: 'लाभ/हानि', positions: 'पोजीशन', activity: 'गतिविधि', active: 'सक्रिय', closedPositions: 'बंद',
    searchPositions: 'पोजीशन खोजें', result: 'परिणाम', totalTraded: 'कुल ट्रेड', amount: 'राशि',
    staked: 'स्टेक किया', noActivePositions: 'कोई सक्रिय पोजीशन नहीं।', joined: 'जुड़े', total: 'कुल',
    market: 'बाज़ार', averagePrice: 'औसत मूल्य', alphabetically: 'वर्णानुक्रम में', date: 'तारीख',
  },
};

export default T;
