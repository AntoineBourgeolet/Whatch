import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const OUTPUT_FILE = path.join(process.cwd(), "public", "data", "series-catalog.json");

async function parseEnvFileValue(key) {
  try {
    const envFilePath = path.join(process.cwd(), ".env.local");
    const envContent = await readFile(envFilePath, "utf8");
    const matchingLine = envContent
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find((line) => line.startsWith(`${key}=`));

    if (!matchingLine) {
      return undefined;
    }

    return matchingLine.slice(key.length + 1).replace(/^['"]|['"]$/gu, "");
  } catch {
    return undefined;
  }
}

async function outputFileExists() {
  try {
    await access(OUTPUT_FILE);
    return true;
  } catch {
    return false;
  }
}

async function tmdbFetch(apiKey, pathname, params = {}) {
  const searchParams = new URLSearchParams({
    api_key: apiKey,
    language: "fr-FR",
    include_adult: "false",
    ...params,
  });

  const response = await fetch(`${TMDB_BASE_URL}${pathname}?${searchParams.toString()}`);

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`TMDB a répondu ${response.status}: ${details}`);
  }

  return response.json();
}

function mapSeries(item) {
  return {
    id: item.id,
    name: item.name,
    overview: item.overview || "Pas encore de synopsis pour cette série.",
    posterUrl: `${TMDB_IMAGE_BASE_URL}${item.poster_path}`,
    backdropUrl: item.backdrop_path ? `${TMDB_IMAGE_BASE_URL}${item.backdrop_path}` : undefined,
    genres: item.genre_ids ?? [],
    voteAverage: Number(item.vote_average ?? 0),
    firstAirDate: item.first_air_date,
  };
}

async function buildCatalog(apiKey) {
  const requests = [
    ...Array.from({ length: 5 }, (_, index) => tmdbFetch(apiKey, "/tv/popular", { page: String(index + 1) })),
    ...Array.from({ length: 4 }, (_, index) => tmdbFetch(apiKey, "/tv/top_rated", { page: String(index + 1) })),
    ...Array.from({ length: 3 }, (_, index) =>
      tmdbFetch(apiKey, "/discover/tv", {
        page: String(index + 1),
        sort_by: "popularity.desc",
        "vote_count.gte": "150",
      }),
    ),
  ];

  const payloads = await Promise.all(requests);
  const uniqueSeries = new Map();

  payloads.forEach((payload) => {
    const results = Array.isArray(payload.results) ? payload.results : [];

    results
      .filter((item) => item?.id && item?.name && item?.poster_path && Array.isArray(item.genre_ids) && item.genre_ids.length > 0)
      .forEach((item) => {
        uniqueSeries.set(item.id, mapSeries(item));
      });
  });

  return [...uniqueSeries.values()]
    .sort((left, right) => right.voteAverage - left.voteAverage)
    .slice(0, 180);
}

async function main() {
  const apiKey = process.env.TMDB_API_KEY ?? (await parseEnvFileValue("TMDB_API_KEY"));

  if (!apiKey) {
    console.warn("TMDB_API_KEY introuvable. Le catalogue existant est conservé.");
    return;
  }

  try {
    const results = await buildCatalog(apiKey);

    if (results.length < 20) {
      throw new Error(`Catalogue trop petit (${results.length} séries).`);
    }

    await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
    await writeFile(
      OUTPUT_FILE,
      `${JSON.stringify({ updatedAt: new Date().toISOString(), results }, null, 2)}\n`,
      "utf8",
    );

    console.log(`Catalogue généré avec ${results.length} séries : ${OUTPUT_FILE}`);
  } catch (error) {
    const hasExistingOutput = await outputFileExists();

    if (hasExistingOutput) {
      console.warn(`Génération TMDB indisponible, le catalogue existant est conservé. ${error}`);
      return;
    }

    throw error;
  }
}

await main();
