// Sport / league taxonomy for the markets sidebar.
// Top-level = sport. Leagues are optional sub-categories shown when expanded.
// Add new sports or leagues here; the sidebar and event-creation flow pick them up automatically.

export interface League {
  id: string;
  label: string;
  iconUrl?: string;
}

export interface Sport {
  id: string;
  label: string;
  iconUrl?: string;
  leagues: League[];
}

// Logos live in /public/sports category/. The folder name has a space so we URL-encode.
const LOGO = (file: string) => `/sports%20category/${file}`;

export const SPORT_TAXONOMY: Sport[] = [
  {
    id: 'football',
    label: 'Football',
    iconUrl: LOGO('football category.avif'),
    leagues: [
      { id: 'uefa-champions', label: 'UEFA Champions League', iconUrl: LOGO('uefa image.avif') },
      { id: 'premier-league', label: 'English Premier League', iconUrl: LOGO('english premier league.avif') },
      { id: 'off-the-pitch', label: 'Off the Pitch', iconUrl: LOGO('off pitch image.avif') },
      { id: 'la-liga', label: 'Spain LaLiga', iconUrl: LOGO('laliga spain league.avif') },
      { id: 'uefa-europa-conf', label: 'UEFA Europa Conference', iconUrl: LOGO('eufa europa conference league.avif') },
      { id: 'bundesliga', label: 'Bundesliga', iconUrl: LOGO('Bundesliga league.avif') },
      { id: 'fifa-world-cup', label: 'FIFA World Cup', iconUrl: LOGO('fifa world cup.avif') },
      { id: 'uefa-europa', label: 'UEFA Europa League', iconUrl: LOGO('uefa europa league.avif') },
      { id: 'efl-championship', label: 'EFL Championship', iconUrl: LOGO('efl championship league.avif') },
      { id: 'fa-cup', label: 'FA Cup', iconUrl: LOGO('FA cup.avif') },
      { id: 'efl-cup', label: 'EFL Cup', iconUrl: LOGO('efl cup.avif') },
      { id: 'serie-a', label: 'Italy Serie A', iconUrl: LOGO('italy serie A.avif') },
      { id: 'coppa-italia', label: 'Coppa Italia', iconUrl: LOGO('coppa italia.avif') },
      { id: 'copa-del-rey', label: 'Copa del Rey', iconUrl: LOGO('copa de rey.avif') },
      { id: 'ligue-1', label: 'France Ligue 1', iconUrl: LOGO('france ligue 1.avif') },
      { id: 'coupe-de-france', label: 'Coupe de France', iconUrl: LOGO('cuope de france.avif') },
    ],
  },
  {
    id: 'esports',
    label: 'Esports',
    iconUrl: LOGO('esport.avif'),
    leagues: [
      { id: 'fifa', label: 'FIFA', iconUrl: LOGO('fifa.png') },
      { id: 'efootball', label: 'eFootball', iconUrl: LOGO('efootball.png') },
      { id: 'free-fire', label: 'Free Fire', iconUrl: LOGO('free fire.jpg') },
      { id: 'call-of-duty', label: 'Call of Duty Mobile', iconUrl: LOGO('call of duty.jpg') },
      { id: 'nba-2k', label: 'NBA 2K', iconUrl: LOGO('NBA2k.jpg') },
      { id: 'mortal-kombat', label: 'Mortal Kombat', iconUrl: LOGO('mortal kombat.jpg') },
      { id: 'fortnite', label: 'Fortnite', iconUrl: LOGO('fortnite.jpg') },
      { id: 'lol', label: 'LoL', iconUrl: LOGO('Lol.avif') },
      { id: 'dota2', label: 'Dota 2', iconUrl: LOGO('Dota 2.avif') },
      { id: 'cs2', label: 'CS2', iconUrl: LOGO('CS 2.avif') },
      { id: 'madden', label: 'Madden NFL', iconUrl: LOGO('nflmaiden.png') },
      { id: 'snooker', label: 'Snooker', iconUrl: LOGO('snookers.jpg') },
      { id: 'chess', label: 'Chess', iconUrl: LOGO('chess.jpg') },
      { id: 'props', label: 'Props', iconUrl: LOGO('props.avif') },
      { id: 'valorant', label: 'Valorant', iconUrl: LOGO('Valorant.avif') },
    ],
  },
  {
    id: 'basketball',
    label: 'Basketball',
    iconUrl: LOGO('basketball.avif'),
    leagues: [{ id: 'nba', label: 'NBA', iconUrl: LOGO('NBA.avif') }],
  },
  {
    id: 'pro-basketball',
    label: 'Pro Basketball',
    iconUrl: LOGO('basketball.avif'),
    leagues: [],
  },
  {
    id: 'college-basketball-m',
    label: 'College Basketball (M)',
    iconUrl: LOGO('basketball.avif'),
    leagues: [],
  },
  {
    id: 'baseball',
    label: 'Baseball',
    leagues: [],
  },
  {
    id: 'college-baseball',
    label: 'College Baseball',
    leagues: [],
  },
  {
    id: 'hockey',
    label: 'Hockey',
    iconUrl: LOGO('Hockey.avif'),
    leagues: [{ id: 'nhl', label: 'NHL', iconUrl: LOGO('NHL.avif') }],
  },
  {
    id: 'pro-hockey',
    label: 'Pro Hockey',
    iconUrl: LOGO('Hockey.avif'),
    leagues: [],
  },
  {
    id: 'pro-football',
    label: 'Pro Football',
    leagues: [],
  },
  {
    id: 'formula-1',
    label: 'Formula 1',
    iconUrl: LOGO('Formula one.avif'),
    leagues: [{ id: 'f1', label: 'F1', iconUrl: LOGO('Formula one.avif') }],
  },
  {
    id: 'racing',
    label: 'Racing',
    leagues: [],
  },
  {
    id: 'boxing',
    label: 'Boxing',
    leagues: [],
  },
  {
    id: 'mma',
    label: 'MMA',
    leagues: [],
  },
  {
    id: 'cricket',
    label: 'Cricket',
    leagues: [],
  },
  {
    id: 'golf',
    label: 'Golf',
    leagues: [],
  },
  {
    id: 'tennis',
    label: 'Tennis',
    leagues: [],
  },
];

export const SPORT_IDS = SPORT_TAXONOMY.map((s) => s.id);

export function getSport(sportId: string): Sport | undefined {
  return SPORT_TAXONOMY.find((s) => s.id === sportId);
}

export function getLeague(sportId: string, leagueId: string): League | undefined {
  return getSport(sportId)?.leagues.find((l) => l.id === leagueId);
}
