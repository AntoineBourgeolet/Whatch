"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookmarkPlus,
  CheckCircle2,
  ExternalLink,
  Heart,
  RefreshCw,
  SkipForward,
  Sparkles,
  ThumbsDown,
  Trophy,
  Tv,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getRandomDuel, getSeriesRecommendations } from "@/lib/series-catalog";
import {
  getPreferredGenres,
  getStoredRecommendationActions,
  getTopRatedSeries,
  saveDuelResult,
  saveRecommendationSelection,
} from "@/lib/storage";
import type { RecommendationAction, Series, StoredRecommendationPreference, StoredSeriesScore } from "@/types/series";

const VISIBLE_RECOMMENDATIONS = 5;
const RECOMMENDATION_BATCH_SIZE = 10;

const recommendationActionLabels: Record<RecommendationAction, string> = {
  watchlist: "Dans ta watchlist",
  liked: "Déjà vue et aimée",
  disliked: "Déjà vue et pas aimée",
};

function getRecommendationButtonClasses(action: RecommendationAction, isActive: boolean) {
  const activeClasses =
    action === "liked"
      ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
      : action === "disliked"
        ? "border-rose-400/60 bg-rose-500/15 text-rose-100"
        : "border-fuchsia-400/60 bg-fuchsia-500/15 text-fuchsia-100";

  return [
    "inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60",
    isActive ? activeClasses : "border-white/10 bg-slate-900/80 text-slate-100 hover:border-white/20 hover:bg-slate-800",
  ].join(" ");
}

function SeriesCard({
  series,
  onClick,
  disabled,
  animate,
}: {
  series: Series;
  onClick: () => void;
  disabled: boolean;
  animate: { x: number; opacity: number; scale: number };
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      animate={animate}
      transition={{ duration: 0.35, ease: "easeOut" }}
      whileHover={disabled ? undefined : { y: -4, scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className="group mx-auto w-full max-w-[260px] overflow-hidden rounded-[22px] border border-white/10 bg-slate-950/75 text-left shadow-xl shadow-fuchsia-950/20 backdrop-blur disabled:cursor-not-allowed disabled:opacity-80"
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        <Image
          src={series.posterUrl}
          alt={series.name}
          fill
          sizes="(max-width: 768px) 70vw, 260px"
          className="object-cover transition duration-500 group-hover:scale-105"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/10 to-transparent" />
      </div>

      <div className="space-y-1 p-3 text-center">
        <h2 className="line-clamp-2 text-base font-semibold text-white sm:text-lg">{series.name}</h2>
        <p className="text-xs text-slate-400">{series.firstAirDate?.slice(0, 4) || "À découvrir"}</p>
      </div>
    </motion.button>
  );
}

export function DuelPage() {
  const [duel, setDuel] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [roundKey, setRoundKey] = useState(0);
  const [favorites, setFavorites] = useState<StoredSeriesScore[]>([]);
  const [recommendations, setRecommendations] = useState<Series[]>([]);
  const [recommendationPool, setRecommendationPool] = useState<Series[]>([]);
  const [recommendationActions, setRecommendationActions] = useState<Record<string, StoredRecommendationPreference>>({});
  const [recommendationMessage, setRecommendationMessage] = useState<string | null>(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [updatingRecommendationId, setUpdatingRecommendationId] = useState<number | null>(null);

  const refreshLocalStats = useCallback(() => {
    setFavorites(getTopRatedSeries(3));
  }, []);

  const refreshRecommendationActions = useCallback(() => {
    setRecommendationActions(getStoredRecommendationActions());
  }, []);

  const loadDuel = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const results = await getRandomDuel();

      if (!Array.isArray(results) || results.length !== 2) {
        throw new Error("Le duel reçu est incomplet.");
      }

      setDuel(results);
      setRoundKey((value) => value + 1);
      setSelectedId(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDuel();
    refreshLocalStats();
    refreshRecommendationActions();
  }, [loadDuel, refreshLocalStats, refreshRecommendationActions]);

  const handleVote = async (winnerIndex: number) => {
    if (isVoting || duel.length !== 2) {
      return;
    }

    const winner = duel[winnerIndex];
    const loser = duel[winnerIndex === 0 ? 1 : 0];

    setIsVoting(true);
    setSelectedId(winner.id);
    saveDuelResult(winner, loser);
    refreshLocalStats();

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      await loadDuel();
    } finally {
      setIsVoting(false);
    }
  };

  const handleNeutralDuel = async () => {
    if (isVoting || duel.length !== 2) {
      return;
    }

    setIsVoting(true);
    setSelectedId(-1);

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 320));
      await loadDuel();
    } finally {
      setIsVoting(false);
    }
  };

  const handleRecommendationSelection = async (series: Series, action: RecommendationAction) => {
    if (updatingRecommendationId === series.id) {
      return;
    }

    const nextActions = saveRecommendationSelection(series, action);
    setRecommendationActions(nextActions);
    refreshLocalStats();

    if (action === "watchlist") {
      return;
    }

    setUpdatingRecommendationId(series.id);

    try {
      const visibleIds = new Set(recommendations.map((item) => item.id));
      let replacement = recommendationPool.find((item) => !visibleIds.has(item.id) && !nextActions[String(item.id)]);

      if (replacement) {
        setRecommendationPool((currentPool) => currentPool.filter((item) => item.id !== replacement?.id));
      }

      if (!replacement) {
        const genres = getPreferredGenres(3);

        if (genres.length) {
          const excludedIds = [
            ...new Set([
              ...recommendations.map((item) => item.id),
              ...Object.keys(nextActions).map(Number),
            ]),
          ];
          const freshResults = await getSeriesRecommendations(genres, excludedIds, 6);

          if (freshResults.length > 0) {
            const [nextRecommendation, ...rest] = freshResults;
            replacement = nextRecommendation;
            setRecommendationPool((currentPool) => [...currentPool, ...rest]);
          }
        }
      }

      if (replacement) {
        const nextRecommendation = replacement;
        setRecommendations((current) => current.map((item) => (item.id === series.id ? nextRecommendation : item)));
        setRecommendationMessage(null);
      } else {
        setRecommendations((current) => current.filter((item) => item.id !== series.id));
        setRecommendationMessage("Ton avis a bien été enregistré. D'autres recommandations arriveront avec les prochains votes.");
      }
    } catch (caughtError) {
      setRecommendationMessage(caughtError instanceof Error ? caughtError.message : "Une erreur est survenue.");
    } finally {
      setUpdatingRecommendationId(null);
    }
  };

  const handleRecommendations = async () => {
    const genres = getPreferredGenres(3);

    if (!genres.length) {
      setRecommendations([]);
      setRecommendationPool([]);
      setRecommendationMessage("Vote sur quelques séries pour obtenir des recommandations personnalisées.");
      return;
    }

    try {
      setRecommendationsLoading(true);
      setRecommendationMessage(null);

      const storedActions = getStoredRecommendationActions();
      const storedIds = Object.keys(storedActions).map(Number);

      if (recommendations.length > 0) {
        let nextVisible = recommendationPool.slice(0, VISIBLE_RECOMMENDATIONS);
        let nextPool = recommendationPool.slice(VISIBLE_RECOMMENDATIONS);

        if (nextVisible.length < VISIBLE_RECOMMENDATIONS) {
          const excludedIds = [
            ...new Set([
              ...storedIds,
              ...recommendations.map((item) => item.id),
              ...recommendationPool.map((item) => item.id),
            ]),
          ];
          const freshResults = await getSeriesRecommendations(genres, excludedIds, RECOMMENDATION_BATCH_SIZE);
          const freshFilteredResults = freshResults.filter((series) => !storedActions[String(series.id)]);
          const combinedResults = [...nextVisible, ...nextPool, ...freshFilteredResults];

          nextVisible = combinedResults.slice(0, VISIBLE_RECOMMENDATIONS);
          nextPool = combinedResults.slice(VISIBLE_RECOMMENDATIONS);
        }

        setRecommendationActions(storedActions);
        setRecommendations(nextVisible);
        setRecommendationPool(nextPool);

        if (!nextVisible.length) {
          setRecommendationMessage("Aucune autre recommandation trouvée pour l'instant. Continue quelques duels pour affiner les résultats.");
        }

        return;
      }

      const results = await getSeriesRecommendations(genres, storedIds, RECOMMENDATION_BATCH_SIZE);
      const filteredResults = results.filter((series) => !storedActions[String(series.id)]);

      setRecommendationActions(storedActions);
      setRecommendations(filteredResults.slice(0, VISIBLE_RECOMMENDATIONS));
      setRecommendationPool(filteredResults.slice(VISIBLE_RECOMMENDATIONS));

      if (!filteredResults.length) {
        setRecommendationMessage("Aucune recommandation trouvée pour l'instant. Continue quelques duels pour affiner les résultats.");
      }
    } catch (caughtError) {
      setRecommendationMessage(caughtError instanceof Error ? caughtError.message : "Une erreur est survenue.");
      setRecommendations([]);
      setRecommendationPool([]);
    } finally {
      setRecommendationsLoading(false);
    }
  };

  const watchlistCount = Object.values(recommendationActions).filter((item) => item.action === "watchlist").length;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-[32px] border border-white/10 bg-slate-950/55 p-6 shadow-2xl shadow-fuchsia-950/10 backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-200">
              <Sparkles className="h-3.5 w-3.5" />
              Whatch V1
            </span>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Choisis ta série en duel.</h1>
              <p className="mt-2 max-w-2xl text-base text-slate-300 sm:text-lg">
                Deux affiches, un seul vote. Tes choix nourrissent ensuite des recommandations basées sur tes genres favoris.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadDuel()}
            disabled={loading || isVoting}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Nouveau duel
          </button>
        </div>
      </section>

      {favorites.length > 0 && (
        <section className="rounded-[28px] border border-white/10 bg-slate-950/50 p-4 backdrop-blur">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Trophy className="h-4 w-4 text-emerald-300" />
            Tes favorites du moment
          </div>
          <div className="flex flex-wrap gap-2">
            {favorites.map((favorite) => (
              <span
                key={favorite.id}
                className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-100"
              >
                {favorite.name} · score {favorite.score > 0 ? `+${favorite.score}` : favorite.score}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          <Tv className="h-4 w-4" />
          Vote maintenant
        </div>

        {error ? (
          <div className="rounded-[24px] border border-rose-500/30 bg-rose-500/10 p-4 text-rose-100">{error}</div>
        ) : null}

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid justify-items-center gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
            >
              <div className="aspect-[3/4] w-full max-w-[260px] animate-pulse rounded-[22px] border border-white/10 bg-white/5" />
              <div className="hidden h-full min-h-[120px] w-full max-w-[200px] rounded-[22px] border border-dashed border-white/10 bg-white/5 md:block" />
              <div className="aspect-[3/4] w-full max-w-[260px] animate-pulse rounded-[22px] border border-white/10 bg-white/5" />
            </motion.div>
          ) : (
            duel.length === 2 && (
              <motion.div
                key={`round-${roundKey}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="grid items-center justify-items-center gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
              >
                <SeriesCard
                  key={duel[0].id}
                  series={duel[0]}
                  disabled={isVoting}
                  onClick={() => void handleVote(0)}
                  animate={
                    selectedId === null
                      ? { x: 0, opacity: 1, scale: 1 }
                      : selectedId === duel[0].id
                        ? { x: 0, opacity: 1, scale: 1.02 }
                        : { x: -110, opacity: 0, scale: 0.92 }
                  }
                />

                <div className="flex w-full max-w-[200px] flex-col items-center gap-3 rounded-[22px] border border-fuchsia-500/20 bg-gradient-to-b from-slate-950/80 to-slate-900/70 px-3 py-4 text-center shadow-lg shadow-fuchsia-950/10">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-400">VS</span>
                  <button
                    type="button"
                    onClick={() => void handleNeutralDuel()}
                    disabled={isVoting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-3 text-sm font-semibold text-fuchsia-50 transition hover:bg-fuchsia-500/20 disabled:opacity-50"
                  >
                    <SkipForward className="h-4 w-4" />
                    Passer / Match nul
                  </button>
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    Un seul clic si tu ne connais pas les deux ou si le duel est trop serré.
                  </p>
                </div>

                <SeriesCard
                  key={duel[1].id}
                  series={duel[1]}
                  disabled={isVoting}
                  onClick={() => void handleVote(1)}
                  animate={
                    selectedId === null
                      ? { x: 0, opacity: 1, scale: 1 }
                      : selectedId === duel[1].id
                        ? { x: 0, opacity: 1, scale: 1.02 }
                        : { x: 110, opacity: 0, scale: 0.92 }
                  }
                />
              </motion.div>
            )
          )}
        </AnimatePresence>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6 backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Tes recommandations</h2>
            <p className="text-sm text-slate-300">
              Le moteur analyse les genres de tes séries les mieux notées pour proposer 5 pistes similaires. Les actions
              “déjà vu” enregistrent ton avis et chargent automatiquement une nouvelle carte.
            </p>
            {watchlistCount > 0 ? (
              <span className="mt-2 inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium text-fuchsia-100">
                <BookmarkPlus className="h-3.5 w-3.5" />
                {watchlistCount} série{watchlistCount > 1 ? "s" : ""} dans ta watchlist
              </span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void handleRecommendations()}
            disabled={recommendationsLoading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-fuchsia-400 disabled:opacity-60"
          >
            {recommendationsLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {recommendations.length > 0 ? "D'autres recommandations" : "Voir mes recommandations"}
          </button>
        </div>

        {recommendationMessage ? <p className="mt-4 text-sm text-slate-300">{recommendationMessage}</p> : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {recommendations.map((series) => {
            const selectedAction = recommendationActions[String(series.id)]?.action;
            const isReplacing = updatingRecommendationId === series.id;
            const cardBorderClass =
              selectedAction === "liked"
                ? "border-emerald-500/30"
                : selectedAction === "disliked"
                  ? "border-rose-500/30"
                  : selectedAction === "watchlist"
                    ? "border-fuchsia-500/30"
                    : "border-white/10";

            return (
              <article
                key={series.id}
                className={`overflow-hidden rounded-2xl border bg-slate-900/70 shadow-lg shadow-slate-950/20 ${cardBorderClass} ${
                  isReplacing ? "opacity-75" : ""
                }`}
              >
                <div className="relative aspect-[2/3]">
                  <Image
                    src={series.posterUrl}
                    alt={series.name}
                    fill
                    sizes="(max-width: 1024px) 50vw, 20vw"
                    className="object-cover"
                  />
                </div>
                <div className="space-y-3 p-3">
                  <div className="space-y-1">
                    <h3 className="line-clamp-2 text-sm font-semibold text-white">{series.name}</h3>
                    <p className="text-xs text-slate-400">{series.firstAirDate?.slice(0, 4) || "À découvrir"}</p>
                    <p className="line-clamp-3 text-xs leading-relaxed text-slate-300">{series.overview}</p>
                  </div>

                  {selectedAction ? (
                    <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-100">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                      {recommendationActionLabels[selectedAction]}
                    </p>
                  ) : null}

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => void handleRecommendationSelection(series, "watchlist")}
                      disabled={isReplacing}
                      className={getRecommendationButtonClasses("watchlist", selectedAction === "watchlist")}
                    >
                      <BookmarkPlus className="h-3.5 w-3.5" />
                      Watchlist
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void handleRecommendationSelection(series, "liked")}
                        disabled={isReplacing}
                        className={getRecommendationButtonClasses("liked", selectedAction === "liked")}
                      >
                        <Heart className="h-3.5 w-3.5" />
                        Déjà aimé
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleRecommendationSelection(series, "disliked")}
                        disabled={isReplacing}
                        className={getRecommendationButtonClasses("disliked", selectedAction === "disliked")}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                        Pas aimé
                      </button>
                    </div>

                    {isReplacing ? (
                      <p className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-medium text-slate-300">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Nouvelle suggestion en cours...
                      </p>
                    ) : (
                      <a
                        href={`https://www.themoviedb.org/tv/${series.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        En savoir plus
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
