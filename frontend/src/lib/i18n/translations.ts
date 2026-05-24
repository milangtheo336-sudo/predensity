export type LangCode = 'en' | 'ko' | 'zh' | 'ru' | 'es' | 'fr';

export interface Translations {
  // Header
  portfolio: string;
  balance: string;
  deposit: string;
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
}

export const LANGUAGES: { code: LangCode; name: string; nativeName: string; flag: string; countryCodes: string[] }[] = [
  { code: 'en', name: 'English',            nativeName: 'English',    flag: '🇬🇧', countryCodes: ['US','GB','AU','CA','NZ','IE','ZA','NG','KE','GH','UG','TZ'] },
  { code: 'ko', name: 'Korean',             nativeName: '한국어',      flag: '🇰🇷', countryCodes: ['KR'] },
  { code: 'zh', name: 'Chinese',            nativeName: '中文',        flag: '🇨🇳', countryCodes: ['CN','TW','HK','SG','MO'] },
  { code: 'ru', name: 'Russian',            nativeName: 'Русский',    flag: '🇷🇺', countryCodes: ['RU','BY','KZ','KG','TJ'] },
  { code: 'es', name: 'Spanish',            nativeName: 'Español',    flag: '🇪🇸', countryCodes: ['ES','MX','AR','CO','CL','PE','VE','EC','BO','PY','UY','CR','PA','DO','HN','SV','GT','NI','CU','PR'] },
  { code: 'fr', name: 'French',             nativeName: 'Français',   flag: '🇫🇷', countryCodes: ['FR','BE','CH','LU','MC','BF','BI','BJ','CD','CF','CG','CI','CM','DJ','DZ','GA','GN','GW','HT','KM','MA','MG','ML','MR','MU','NE','RW','SC','SN','TD','TG','TN'] },
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
    portfolio: 'Portfolio', balance: 'Bal', deposit: 'Deposit', withdraw: 'Withdraw',
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
    heroCrypto: 'Crypto', heroTagline: 'Profit from bold, early, and accurate price forecasts on BTC, ETH, HBAR and more.',
    loginOrSignUp: 'Log in or sign up', continueWithGoogle: 'Continue with Google',
    emailAddress: 'Email address', continueWithWallet: 'Continue with a wallet',
    agreeTerms: 'By continuing, you agree to our', termsOfService: 'Terms of Service',
    privacyPolicy: 'Privacy Policy', securedBy: 'Secured by', authenticating: 'Authenticating...',
    selectLanguage: 'Select Language', currentLanguage: 'Current Language', cancel: 'Cancel', apply: 'Apply',
    selectYourWallet: 'Select your wallet', lastUsed: 'Last used', requestingSignature: 'Requesting Signature', pleaseSign: 'Please sign to connect.', back: 'Back',
    home: 'Home', search: 'Search', breaking: 'Breaking', more: 'More', support: 'Support', termsOfUse: 'Terms of Use', close: 'Close',
  },
  ko: {
    portfolio: '포트폴리오', balance: '잔액', deposit: '입금', withdraw: '출금',
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
    loginOrSignUp: '로그인 또는 회원가입', continueWithGoogle: 'Google로 계속',
    emailAddress: '이메일 주소', continueWithWallet: '지갑으로 계속',
    agreeTerms: '계속하면 다음에 동의하는 것입니다', termsOfService: '서비스 약관',
    privacyPolicy: '개인정보처리방침', securedBy: '보안 제공', authenticating: '인증 중...',
    selectLanguage: '언어 선택', currentLanguage: '현재 언어', cancel: '취소', apply: '적용',
    selectYourWallet: '지갑 선택', lastUsed: '최근 사용', requestingSignature: '서명 요청 중', pleaseSign: '지갑에서 서명해 주세요.', back: '뒤로',
    home: '홈', search: '검색', breaking: '속보', more: '더보기', support: '지원', termsOfUse: '이용약관', close: '닫기',
  },
  zh: {
    portfolio: '投资组合', balance: '余额', deposit: '充值', withdraw: '提现',
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
    loginOrSignUp: '登录或注册', continueWithGoogle: '使用Google继续',
    emailAddress: '电子邮件地址', continueWithWallet: '使用钱包继续',
    agreeTerms: '继续即表示您同意我们的', termsOfService: '服务条款',
    privacyPolicy: '隐私政策', securedBy: '安全由', authenticating: '验证中...',
    selectLanguage: '选择语言', currentLanguage: '当前语言', cancel: '取消', apply: '应用',
    selectYourWallet: '选择钱包', lastUsed: '最近使用', requestingSignature: '请求签名', pleaseSign: '请在钱包中签名。', back: '返回',
    home: '首页', search: '搜索', breaking: '突发', more: '更多', support: '支持', termsOfUse: '使用条款', close: '关闭',
  },
  ru: {
    portfolio: 'Портфель', balance: 'Баланс', deposit: 'Пополнить', withdraw: 'Вывести',
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
    loginOrSignUp: 'Войти или зарегистрироваться', continueWithGoogle: 'Продолжить с Google',
    emailAddress: 'Адрес электронной почты', continueWithWallet: 'Продолжить с кошельком',
    agreeTerms: 'Продолжая, вы соглашаетесь с нашими', termsOfService: 'Условиями использования',
    privacyPolicy: 'Политикой конфиденциальности', securedBy: 'Защищено', authenticating: 'Аутентификация...',
    selectLanguage: 'Выбор языка', currentLanguage: 'Текущий язык', cancel: 'Отмена', apply: 'Применить',
    selectYourWallet: 'Выберите кошелёк', lastUsed: 'Последний использованный', requestingSignature: 'Запрос подписи', pleaseSign: 'Подпишите запрос в кошельке.', back: 'Назад',
    home: 'Главная', search: 'Поиск', breaking: 'Срочно', more: 'Ещё', support: 'Поддержка', termsOfUse: 'Условия', close: 'Закрыть',
  },
  es: {
    portfolio: 'Portafolio', balance: 'Saldo', deposit: 'Depositar', withdraw: 'Retirar',
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
    loginOrSignUp: 'Iniciar sesión o registrarse', continueWithGoogle: 'Continuar con Google',
    emailAddress: 'Correo electrónico', continueWithWallet: 'Continuar con cartera',
    agreeTerms: 'Al continuar, aceptas nuestros', termsOfService: 'Términos de servicio',
    privacyPolicy: 'Política de privacidad', securedBy: 'Protegido por', authenticating: 'Autenticando...',
    selectLanguage: 'Seleccionar idioma', currentLanguage: 'Idioma actual', cancel: 'Cancelar', apply: 'Aplicar',
    selectYourWallet: 'Selecciona tu cartera', lastUsed: 'Último usado', requestingSignature: 'Solicitando firma', pleaseSign: 'Por favor firma en tu cartera.', back: 'Atrás',
    home: 'Inicio', search: 'Buscar', breaking: 'Urgente', more: 'Más', support: 'Soporte', termsOfUse: 'Términos de uso', close: 'Cerrar',
  },
  fr: {
    portfolio: 'Portefeuille', balance: 'Solde', deposit: 'Déposer', withdraw: 'Retirer',
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
    loginOrSignUp: 'Se connecter ou s\'inscrire', continueWithGoogle: 'Continuer avec Google',
    emailAddress: 'Adresse e-mail', continueWithWallet: 'Continuer avec un portefeuille',
    agreeTerms: 'En continuant, vous acceptez nos', termsOfService: 'Conditions d\'utilisation',
    privacyPolicy: 'Politique de confidentialité', securedBy: 'Sécurisé par', authenticating: 'Authentification...',
    selectLanguage: 'Choisir la langue', currentLanguage: 'Langue actuelle', cancel: 'Annuler', apply: 'Appliquer',
    selectYourWallet: 'Choisissez votre portefeuille', lastUsed: 'Dernièrement utilisé', requestingSignature: 'Demande de signature', pleaseSign: 'Veuillez signer dans votre portefeuille.', back: 'Retour',
    home: 'Accueil', search: 'Rechercher', breaking: 'Urgent', more: 'Plus', support: 'Assistance', termsOfUse: "Conditions d'utilisation", close: 'Fermer',
  },
};

export default T;
