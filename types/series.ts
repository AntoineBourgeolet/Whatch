export interface Series {
  id: number;
  name: string;
  overview: string;
  posterUrl: string;
  backdropUrl?: string;
  genres: number[];
  voteAverage: number;
  firstAirDate?: string;
}

export interface StoredSeriesScore {
  id: number;
  name: string;
  posterUrl: string;
  genres: number[];
  score: number;
  updatedAt: number;
}

export type RecommendationAction = "watchlist" | "liked" | "disliked";

export interface StoredRecommendationPreference {
  id: number;
  name: string;
  posterUrl: string;
  action: RecommendationAction;
  updatedAt: number;
}
