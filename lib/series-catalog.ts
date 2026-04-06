import type { Series } from "@/types/series";

type SeriesCatalogResponse = {
  updatedAt: string;
  results: Series[];
};

const SERIES_DATA_PATH = "./data/series-catalog.json";

let catalogPromise: Promise<Series[]> | null = null;

function shuffle<T>(items: T[]) {
  const clone = [...items];

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[randomIndex]] = [clone[randomIndex], clone[index]];
  }

  return clone;
}

function getGenreScore(series: Series, genres: number[]) {
  const sharedGenres = series.genres.filter((genreId) => genres.includes(genreId)).length;
  return sharedGenres * 10 + series.voteAverage;
}

async function loadSeriesCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(SERIES_DATA_PATH, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json()) as SeriesCatalogResponse;

        if (!response.ok) {
          throw new Error("Impossible de charger le catalogue local de séries.");
        }

        if (!Array.isArray(data.results) || data.results.length < 2) {
          throw new Error("Le catalogue local de séries est indisponible.");
        }

        return data.results;
      })
      .catch((error) => {
        catalogPromise = null;
        throw error;
      });
  }

  return catalogPromise;
}

export async function getRandomDuel() {
  const catalog = await loadSeriesCatalog();
  return shuffle(catalog).slice(0, 2);
}

export async function getSeriesRecommendations(genres: number[], excludeIds: number[] = [], count = 10) {
  const catalog = await loadSeriesCatalog();
  const excludedIdsSet = new Set(excludeIds);

  return shuffle(catalog)
    .filter((series) => !excludedIdsSet.has(series.id) && series.genres.some((genreId) => genres.includes(genreId)))
    .sort((left, right) => getGenreScore(right, genres) - getGenreScore(left, genres))
    .slice(0, count);
}
