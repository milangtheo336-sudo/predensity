// Sport / league taxonomy for the markets sidebar.
// Top-level = sport. Leagues are optional sub-categories shown when expanded.
// Add new sports or leagues here; the sidebar and event-creation flow pick them up automatically.

export interface League {
  id: string;
  label: string;
}

export interface Sport {
  id: string;
  label: string;
  leagues: League[];
}

export const SPORT_TAXONOMY: Sport[] = [
  {
    id: 'football',
    label: 'Football',
    leagues: [
      { id: 'uefa-champions', label: 'UEFA Champions League' },
      { id: 'premier-league', label: 'English Premier League' },
      { id: 'off-the-pitch', label: 'Off the Pitch' },
      { id: 'la-liga', label: 'Spain LaLiga' },
      { id: 'uefa-europa-conf', label: 'UEFA Europa Conference' },
      { id: 'bundesliga', label: 'Bundesliga' },
      { id: 'fifa-world-cup', label: 'FIFA World Cup' },
      { id: 'uefa-europa', label: 'UEFA Europa League' },
      { id: 'efl-championship', label: 'EFL Championship' },
      { id: 'fa-cup', label: 'FA Cup' },
      { id: 'efl-cup', label: 'EFL Cup' },
      { id: 'serie-a', label: 'Italy Serie A' },
      { id: 'coppa-italia', label: 'Coppa Italia' },
      { id: 'copa-del-rey', label: 'Copa del Rey' },
      { id: 'ligue-1', label: 'France Ligue 1' },
      { id: 'coupe-de-france', label: 'Coupe de France' },
    ],
  },
  {
    id: 'esports',
    label: 'Esports',
    leagues: [
      { id: 'props', label: 'Props' },
      { id: 'cs2', label: 'CS2' },
      { id: 'dota2', label: 'Dota 2' },
      { id: 'valorant', label: 'Valorant' },
      { id: 'lol', label: 'LoL' },
    ],
  },
  {
    id: 'basketball',
    label: 'Basketball',
    leagues: [{ id: 'nba', label: 'NBA' }],
  },
  {
    id: 'pro-basketball',
    label: 'Pro Basketball',
    leagues: [],
  },
  {
    id: 'college-basketball-m',
    label: 'College Basketball (M)',
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
    leagues: [{ id: 'nhl', label: 'NHL' }],
  },
  {
    id: 'pro-hockey',
    label: 'Pro Hockey',
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
    leagues: [{ id: 'f1', label: 'F1' }],
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
