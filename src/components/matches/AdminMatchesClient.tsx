"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { confirmLevel, dismissLevelCheck, saveMatchSettings } from "@/app/actions/openMatches";
import { useReadOnly } from "@/components/admin/ReadOnly";
import { useLabels } from "@/hooks/useLabels";
import {
  LEVELS,
  MATCH_SPORTS,
  RELEASE_HOUR_CHOICES,
  levelText,
  rangeText,
  type ClubMatchesView,
  type MatchSettings,
} from "@/lib/openMatches";
import { useWhen } from "./bits";

export default function AdminMatchesClient({
  settings: initial,
  upcoming,
  stats,
  checks,
  clubSlug,
}: {
  settings: MatchSettings;
  upcoming: ClubMatchesView["upcoming"];
  stats: ClubMatchesView["stats"];
  checks: ClubMatchesView["checks"];
  clubSlug: string;
}) {
  const t = useTranslations("matches.admin");
  const tm = useTranslations("matches");
  const labels = useLabels();
  const when = useWhen();
  const router = useRouter();
  const { readOnly, hint } = useReadOnly();
  const [settings, setSettings] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(settings) !== JSON.stringify(initial);

  const save = () =>
    startTransition(async () => {
      setMessage(null);
      const r = await saveMatchSettings(settings);
      if (r.error) {
        setMessage({ ok: false, text: r.error === "noSports" ? t("noSports") : tm(`errors.${r.error}`) });
        return;
      }
      setMessage({ ok: true, text: t("saved") });
      router.refresh();
    });

  const statCard = (label: string, value: React.ReactNode, sub: string, warn = false) => (
    <div className={`rounded-2xl border p-4 ${warn ? "border-amber-200 bg-amber-50" : "border-ink-100 bg-white"}`}>
      <p className={`text-xs font-semibold tracking-wider uppercase ${warn ? "text-amber-900" : "text-ink-600"}`}>{label}</p>
      <p className={`mt-1.5 text-[26px] font-bold ${warn ? "text-amber-900" : "text-ink-900"}`}>{value}</p>
      <p className={`text-xs ${warn ? "text-amber-900" : "text-ink-600"}`}>{sub}</p>
    </div>
  );

  return (
    <div className="flex max-w-[1140px] flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-ink-900">{t("title")}</h1>
          <p className="mt-1 text-sm text-ink-600">{t("subtitle")}</p>
        </div>
        <Link href={`/clubs/${clubSlug}`} className="btn-secondary">
          {t("seeAsPlayer")}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCard(t("statOpened"), stats.opened, t("last7"))}
        {statCard(t("statFilled"), `${stats.filled}/${stats.opened}`, t("statFilledSub"))}
        {statCard(t("statPlayers"), stats.players, t("statPlayersSub"))}
        {statCard(t("statReleased"), stats.released, t("statReleasedSub"), stats.released > 0)}
      </div>

      <div className="flex flex-wrap items-start gap-5">
        {/* Coming up */}
        <section aria-labelledby="up" className="min-w-0 flex-[999_1_520px] overflow-hidden rounded-[20px] border border-ink-100 bg-white">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
            <h2 id="up" className="text-base font-bold text-ink-900">
              {t("comingUp")}
            </h2>
            <span className="text-xs text-ink-600">{t("next14")}</span>
          </div>
          {upcoming.length === 0 ? (
            <p className="px-5 py-8 text-sm text-ink-600">{t("none")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] tracking-wider text-ink-600 uppercase">
                    <th scope="col" className="px-5 py-2.5 font-semibold">{t("when")}</th>
                    <th scope="col" className="px-2 py-2.5 font-semibold">{t("court")}</th>
                    <th scope="col" className="px-2 py-2.5 font-semibold">{t("level")}</th>
                    <th scope="col" className="px-2 py-2.5 font-semibold">{t("players")}</th>
                    <th scope="col" className="py-2.5 pr-5 pl-2 font-semibold">{t("status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((m) => {
                    const full = m.taken >= m.max_players;
                    const pill =
                      m.status === "released"
                        ? ["border border-ink-100 bg-ink-50 text-ink-600", t("released")]
                        : full
                          ? ["bg-brand-50 text-brand-900", t("full")]
                          : ["bg-amber-50 text-amber-900", t("needs", { n: m.max_players - m.taken })];
                    return (
                      <tr key={m.id} className="border-t border-ink-100">
                        <td className="px-5 py-3">
                          <span className="font-semibold text-ink-900">{when(m.starts_at)}</span>
                          <br />
                          <span className="text-xs text-ink-600">
                            {m.organiser} · {m.competitive ? tm("competitive") : tm("friendly")}
                            {m.keep_court && !full && m.status === "open" ? ` · ${t("kept")}` : ""}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          {m.court ?? "–"}
                          <br />
                          <span className="text-xs text-ink-600">{labels.sport(m.sport)}</span>
                        </td>
                        <td className="px-2 py-3">{rangeText(m.level_min, m.level_max)}</td>
                        <td className="px-2 py-3">
                          {m.taken}/{m.max_players}
                        </td>
                        <td className="py-3 pr-5 pl-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${pill[0]}`}>{pill[1]}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
          {/* Settings */}
          <section aria-labelledby="set" className="flex flex-col gap-4 rounded-[20px] border border-ink-100 bg-white p-5">
            <h2 id="set" className="text-base font-bold text-ink-900">
              {t("settings")}
            </h2>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="flex flex-col">
                <span className="font-semibold text-ink-900">{t("enabled")}</span>
                <span className="text-xs text-ink-600">{t("enabledHint")}</span>
              </span>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                className="size-5 accent-ink-900"
              />
            </label>

            <fieldset disabled={!settings.enabled} className="flex flex-col gap-4 disabled:opacity-50">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-[13px] font-semibold text-ink-900">{t("sports")}</legend>
                <div className="flex flex-wrap gap-4 text-[13px]">
                  {MATCH_SPORTS.map((s) => (
                    <label key={s} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={settings.sports.includes(s)}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            sports: e.target.checked ? [...settings.sports, s] : settings.sports.filter((x) => x !== s),
                          })
                        }
                        className="size-[18px] accent-ink-900"
                      />
                      {labels.sport(s)}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="release" className="text-[13px] font-semibold text-ink-900">
                  {t("release")}
                </label>
                <select
                  id="release"
                  value={settings.release_hours}
                  onChange={(e) => setSettings({ ...settings, release_hours: Number(e.target.value) })}
                  className="input"
                >
                  {RELEASE_HOUR_CHOICES.map((h) => (
                    <option key={h} value={h}>
                      {t("releaseOption", { hours: h })}
                    </option>
                  ))}
                </select>
                <span className="text-xs leading-relaxed text-ink-600">{t("releaseHint")}</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="who" className="text-[13px] font-semibold text-ink-900">
                  {t("who")}
                </label>
                <select
                  id="who"
                  value={settings.members_only ? "members" : "anyone"}
                  onChange={(e) => setSettings({ ...settings, members_only: e.target.value === "members" })}
                  className="input"
                >
                  <option value="anyone">{t("anyone")}</option>
                  <option value="members">{t("membersOnly")}</option>
                </select>
              </div>
            </fieldset>

            <div className="flex items-center gap-3">
              <button type="button" onClick={save} disabled={readOnly || pending || !dirty} title={hint} className="btn-primary">
                {pending ? t("saving") : t("save")}
              </button>
              {message && (
                <span role="status" className={`text-[13px] ${message.ok ? "text-brand-900" : "text-red-700"}`}>
                  {message.text}
                </span>
              )}
            </div>
          </section>

          {/* Level checks */}
          <section aria-labelledby="chk" className="flex flex-col gap-3 rounded-[20px] border border-ink-100 bg-white p-5">
            <h2 id="chk" className="text-base font-bold text-ink-900">
              {t("checks")} {checks.length > 0 && <span className="font-medium text-ink-600">{checks.length}</span>}
            </h2>
            <p className="-mt-1 text-xs leading-relaxed text-ink-600">{t("checksHint")}</p>
            {checks.length === 0 ? (
              <p className="text-[13px] text-ink-600">{t("noChecks")}</p>
            ) : (
              checks.map((c) => <CheckRow key={`${c.id}-${c.sport}`} check={c} />)
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function CheckRow({ check: c }: { check: ClubMatchesView["checks"][number] }) {
  const t = useTranslations("matches.admin");
  const tm = useTranslations("matches");
  const labels = useLabels();
  const router = useRouter();
  const { readOnly, hint } = useReadOnly();
  const [level, setLevel] = useState(Number(c.level));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (r.error) {
        setError(tm(`errors.${r.error}`));
        return;
      }
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-2 border-t border-ink-100 pt-3 first-of-type:border-0 first-of-type:pt-0">
      <span className="text-[13px]">
        <span className="font-semibold text-ink-900">{c.name}</span>{" "}
        <span className="text-ink-600">
          · {labels.sport(c.sport)} · {t("says", { level: levelText(c.level) })}
        </span>
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`lvl-${c.id}-${c.sport}`} className="sr-only">
          {t("level")}
        </label>
        <select
          id={`lvl-${c.id}-${c.sport}`}
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          className="input w-24 py-2"
        >
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {levelText(l)}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={readOnly || pending}
          title={hint}
          onClick={() => run(() => confirmLevel(c.id, c.sport, level))}
          className="btn-primary px-3.5 py-2 text-xs"
        >
          {Number(c.level) === level ? t("confirm") : t("confirmAt", { level: levelText(level) })}
        </button>
        <button
          type="button"
          disabled={readOnly || pending}
          title={hint}
          onClick={() => run(() => dismissLevelCheck(c.id, c.sport))}
          className="btn-ghost px-3 py-2 text-xs"
        >
          {t("dismiss")}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
