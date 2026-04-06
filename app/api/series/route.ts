import { NextResponse } from "next/server";

import type { Series } from "@/types/series";

export const dynamic = "force-dynamic";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

type TMDBSeries = {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genre_ids: number[];
  vote_average: number;
  first_air_date?: string;
};

type TMDBListResponse = {
  results: TMDBSeries[];
};

function mapSeries(item: TMDBSeries): Series {
  return {
    id: item.id,
    name: item.name,
    overview: item.overview || "Pas encore de synopsis pour cette série.",
    posterUrl: item.poster_path ? `${TMDB_IMAGE_BASE_URL}${item.poster_path}` : "",
    backdropUrl: item.backdrop_path ? `${TMDB_IMAGE_BASE_URL}${item.backdrop_path}` : undefined,
    genres: item.genre_ids ?? [],
    voteAverage: Number(item.vote_average ?? 0),
    firstAirDate: item.first_air_date,
  };
}

async function tmdbFetch<T>(path: string, params: Record<string, string>) {
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    throw new Error("TMDB_API_KEY est manquante. Ajoute-la dans .env.local.");
  }

  const searchParams = new URLSearchParams({
    api_key: apiKey,
    language: "fr-FR",
    ...params,
  });

  const response = await fetch(`${TMDB_BASE_URL}${path}?${searchParams.toString()}`, {
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`TMDB a répondu ${response.status}: ${details}`);
  }

  return (await response.json()) as T;
}

function pickSeries(results: TMDBSeries[], count: number) {
  return [...results]
    .filter((item) => item.poster_path && item.genre_ids?.length)
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map(mapSeries);
}

function parseNumberList(value: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry > 0);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") ?? "duel";

  try {
    if (mode === "duel") {
      const randomPage = String(Math.floor(Math.random() * 8) + 1);
      const payload = await tmdbFetch<TMDBListResponse>("/tv/popular", {
        page: randomPage,
      });

      const results = pickSeries(payload.results, 2);

      if (results.length < 2) {
        return NextResponse.json({ error: "Impossible de préparer un duel pour le moment." }, { status: 500 });
      }

      return NextResponse.json({ mode, results });
    }

    if (mode === "recommendations") {
      const genres = searchParams.get("genres");

      if (!genres) {
        return NextResponse.json(
          { error: "Le paramètre genres est requis pour les recommandations." },
          { status: 400 },
        );
      }

      const excludedIds = new Set(parseNumberList(searchParams.get("excludeIds")));
      const rawCount = Number(searchParams.get("count") ?? "8");
      const count = Number.isFinite(rawCount) ? Math.min(Math.max(Math.trunc(rawCount), 1), 12) : 8;
      const sharedParams = {
        with_genres: genres,
        sort_by: "popularity.desc",
        include_adult: "false",
        "vote_count.gte": "100",
      };

      const [firstPage, secondPage] = await Promise.all([
        tmdbFetch<TMDBListResponse>("/discover/tv", {
          ...sharedParams,
          page: "1",
        }),
        tmdbFetch<TMDBListResponse>("/discover/tv", {
          ...sharedParams,
          page: String(Math.floor(Math.random() * 4) + 2),
        }),
      ]);

      const mergedResults = [...firstPage.results, ...secondPage.results].filter((item) => !excludedIds.has(item.id));
      const uniqueResults = mergedResults.filter(
        (item, index, collection) => collection.findIndex((candidate) => candidate.id === item.id) === index,
      );

      const results = pickSeries(uniqueResults, count);
      return NextResponse.json({ mode, results });
    }

    return NextResponse.json({ error: `Mode inconnu : ${mode}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Une erreur inattendue est survenue.",
      },
      { status: 500 },
    );
  }
}
