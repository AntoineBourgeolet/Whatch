import type {
  RecommendationAction,
  Series,
  StoredRecommendationPreference,
  StoredSeriesScore,
} from "@/types/series";

const STORAGE_KEY = "whatch-series-scores";
const RECOMMENDATION_ACTIONS_KEY = "whatch-recommendation-actions";

type ScoreMap = Record<string, StoredSeriesScore>;
type RecommendationPreferenceMap = Record<string, StoredRecommendationPreference>;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getStoredSeriesScores(): ScoreMap {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    return rawValue ? (JSON.parse(rawValue) as ScoreMap) : {};
  } catch {
    return {};
  }
}

export function getStoredRecommendationActions(): RecommendationPreferenceMap {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(RECOMMENDATION_ACTIONS_KEY);
    return rawValue ? (JSON.parse(rawValue) as RecommendationPreferenceMap) : {};
  } catch {
    return {};
  }
}

function persistScores(scoreMap: ScoreMap) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scoreMap));
}

function persistRecommendationActions(preferences: RecommendationPreferenceMap) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(RECOMMENDATION_ACTIONS_KEY, JSON.stringify(preferences));
}

function updateEntry(scoreMap: ScoreMap, series: Series, delta: number) {
  const currentEntry = scoreMap[String(series.id)] ?? {
    id: series.id,
    name: series.name,
    posterUrl: series.posterUrl,
    genres: series.genres,
    score: 0,
    updatedAt: 0,
  };

  scoreMap[String(series.id)] = {
    ...currentEntry,
    name: series.name,
    posterUrl: series.posterUrl,
    genres: series.genres,
    score: currentEntry.score + delta,
    updatedAt: Date.now(),
  };
}

function getRecommendationImpact(action?: RecommendationAction) {
  switch (action) {
    case "liked":
      return 2;
    case "disliked":
      return -2;
    default:
      return 0;
  }
}

export function saveDuelResult(winner: Series, loser: Series) {
  const scoreMap = getStoredSeriesScores();

  updateEntry(scoreMap, winner, 1);
  updateEntry(scoreMap, loser, -1);

  persistScores(scoreMap);
  return scoreMap;
}

export function saveTieResult(firstSeries: Series, secondSeries: Series) {
  const scoreMap = getStoredSeriesScores();

  updateEntry(scoreMap, firstSeries, 1);
  updateEntry(scoreMap, secondSeries, 1);

  persistScores(scoreMap);
  return scoreMap;
}

export function saveRecommendationSelection(series: Series, action: RecommendationAction) {
  const preferences = getStoredRecommendationActions();
  const previousAction = preferences[String(series.id)]?.action;

  preferences[String(series.id)] = {
    id: series.id,
    name: series.name,
    posterUrl: series.posterUrl,
    action,
    updatedAt: Date.now(),
  };

  persistRecommendationActions(preferences);

  const scoreDelta = getRecommendationImpact(action) - getRecommendationImpact(previousAction);

  if (scoreDelta !== 0) {
    const scoreMap = getStoredSeriesScores();
    updateEntry(scoreMap, series, scoreDelta);
    persistScores(scoreMap);
  }

  return preferences;
}

export function getTopRatedSeries(limit = 5): StoredSeriesScore[] {
  return Object.values(getStoredSeriesScores())
    .sort((left, right) => right.score - left.score || right.updatedAt - left.updatedAt)
    .slice(0, limit);
}

export function getPreferredGenres(limit = 3): number[] {
  const rankedSeries = getTopRatedSeries(8);
  const genreWeights = new Map<number, number>();

  rankedSeries.forEach((series, index) => {
    const weight = Math.max(series.score, 0) + Math.max(4 - index, 1);

    series.genres.forEach((genreId) => {
      genreWeights.set(genreId, (genreWeights.get(genreId) ?? 0) + weight);
    });
  });

  return [...genreWeights.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([genreId]) => genreId);
}

export function clearStoredSeriesScores() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(RECOMMENDATION_ACTIONS_KEY);
}
