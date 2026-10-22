"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, ArrowLeft, Check, Minus, Plus, X } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useLabels } from "@/hooks/useLabels";
import { SPORTS } from "@/lib/labels";
import { GROUP_LEVELS, ISO_DAYS, clubFormat, daysText, hhmm, money, noon, weekdayName } from "@/lib/groups";
import {
  createGroup,
  previewSessions,
  updateGroup,
  type CourtChoices,
  type GroupInput,
  type PreviewRow,
} from "@/app/[locale]/admin/groups/actions";
import type { Group, GroupBreak, Sport } from "@/types/database";

export type FormCourt = { id: string; name: string; sport: Sport };
export type FormCoach = { id: string; name: string };
export type FormPlan = { id: string; name: string };

/** 1 September – 30 June: the school year most clubs follow. */
function defaultSeason(today: string) {
  const [y, m] = today.split("-").map(Number);
  return { starts_on: today, ends_on: `${m >= 7 ? y + 1 : y}-06-30` };
}

export default function GroupForm({
  group,
  courts,
  coaches,
  plans,
  today,
}: {
  group?: Group;
  courts: FormCourt[];
  coaches: FormCoach[];
  plans: FormPlan[];
  today: string;
}) {
  const t = useTranslations("groups");
  const tf = useTranslations("groups.form");
  const labels = useLabels();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const season = defaultSeason(today);
  const [form, setForm] = useState<GroupInput>(() => ({
    name: group?.name ?? "",
    kind: group?.kind ?? "season",
    sport: group?.sport ?? courts[0]?.sport ?? "tennis",
    level: group?.level ?? "beginner",
    age_min: group?.age_min ?? null,
    age_max: group?.age_max ?? null,
    adults: group?.adults ?? false,
    coach_id: group?.coach_id ?? coaches[0]?.id ?? null,
    court_id: group?.court_id ?? courts[0]?.id ?? null,
    days: group?.days ?? [],
    start_time: group ? hhmm(group.start_time) : "17:00",
    end_time: group ? hhmm(group.end_time) : "18:00",
    starts_on: group?.starts_on ?? season.starts_on,
    ends_on: group?.ends_on ?? season.ends_on,
    breaks: group?.breaks ?? [],
    max_players: group?.max_players ?? 8,
    price: group ? Number(group.price) : 0,
    member_price: group?.member_price ?? null,
    member_plan_id: group?.member_plan_id ?? plans[0]?.id ?? null,
    online_signup: group?.online_signup ?? true,
    coach_approves: group?.coach_approves ?? false,
    trial: group?.trial ?? true,
    description: group?.description ?? "",
  }));
  const set = <K extends keyof GroupInput>(key: K, value: GroupInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const [priceText, setPriceText] = useState(group ? String(Number(group.price)) : "");
  const [memberPriceText, setMemberPriceText] = useState(
    group?.member_price != null ? String(Number(group.member_price)) : "",
  );

  // ---- The court check ----------------------------------------------------
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [choices, setChoices] = useState<CourtChoices>({});
  const scheduleKey = JSON.stringify([
    form.court_id,
    form.coach_id,
    form.days,
    form.start_time,
    form.end_time,
    form.starts_on,
    form.ends_on,
    form.breaks,
  ]);
  const latest = useRef(scheduleKey);

  useEffect(() => {
    latest.current = scheduleKey;
    const ready =
      form.court_id && form.days.length > 0 && form.start_time < form.end_time && form.starts_on <= form.ends_on;
    const timer = setTimeout(() => {
      if (!ready) {
        setPreview(null);
        return;
      }
      setChecking(true);
      previewSessions(form, group?.id).then((result) => {
        if (latest.current !== scheduleKey) return;
        setChecking(false);
        const rows = result.rows ?? null;
        setPreview(rows);
        // Use the free court when there is one, unless already chosen.
        setChoices((old) => {
          const next: CourtChoices = {};
          for (const r of rows ?? []) {
            if (r.clash !== "court") continue;
            if (old[r.day] !== undefined) next[r.day] = old[r.day];
            else if (r.free_court_id) next[r.day] = r.free_court_id;
          }
          return next;
        });
      });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleKey]);

  const sessions = preview?.length ?? 0;
  const clashes = (preview ?? []).filter((r) => r.clash && !r.existing);
  const sessionsKept = sessions - clashes.filter((r) => !(r.clash === "court" && choices[r.day])).length;
  const courtName = courts.find((c) => c.id === form.court_id)?.name ?? "";

  // ---- Breaks ---------------------------------------------------------------
  const [newBreak, setNewBreak] = useState<GroupBreak | null>(null);

  const save = () => {
    setError(null);
    const price = priceText === "" ? 0 : Number(priceText.replace(",", "."));
    const memberPrice = memberPriceText === "" ? null : Number(memberPriceText.replace(",", "."));
    startTransition(async () => {
      const input = { ...form, price, member_price: memberPrice };
      const result = group ? await updateGroup(group.id, input, choices) : await createGroup(input, choices);
      if (result.error && !result.id) {
        setError(tf(`errors.${result.error}`));
        return;
      }
      const q = new URLSearchParams();
      if (result.created) q.set("created", String(result.created));
      if (result.cancelled) q.set("removed", String(result.cancelled));
      if (result.skipped?.length) q.set("skipped", String(result.skipped.length));
      router.push(`/admin/groups/${result.id}${q.size ? `?${q}` : ""}`);
      router.refresh();
    });
  };

  const saveButton = (
    <button
      type="button"
      onClick={save}
      disabled={pending || !form.name.trim() || form.days.length === 0}
      className="btn-primary disabled:opacity-50"
    >
      {pending ? tf("saving") : group ? tf("save") : tf("create")}
    </button>
  );

  const sportCourts = courts.filter((c) => c.sport === form.sport);
  const courtChoices = sportCourts.length ? sportCourts : courts;

  return (
    <div className="mx-auto max-w-[1240px]">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={group ? `/admin/groups/${group.id}` : "/admin/groups"}
            aria-label={tf("back")}
            className="grid size-[38px] shrink-0 place-items-center rounded-full border border-ink-200 bg-white text-ink-900 hover:bg-ink-50"
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </Link>
          <h1 className="truncate font-display text-2xl font-extrabold tracking-tight text-ink-900">
            {group ? tf("editTitle") : t("new")}
          </h1>
        </div>
        {saveButton}
      </header>

      <div className="flex flex-wrap items-start gap-6">
        <form
          className="flex min-w-0 flex-[999_1_560px] flex-col gap-[18px]"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {error && (
            <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {/* 1. The group */}
          <Section title={tf("sections.group")}>
            <Field label={tf("name")}>
              <input
                className="input"
                value={form.name}
                maxLength={80}
                placeholder={tf("namePlaceholder")}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tf("sport")} group>
                <Segmented
                  value={form.sport}
                  options={SPORTS.map((s) => ({ value: s, label: labels.sport(s) }))}
                  onChange={(s) => {
                    set("sport", s);
                    const first = courts.find((c) => c.sport === s);
                    if (first && courts.find((c) => c.id === form.court_id)?.sport !== s) set("court_id", first.id);
                  }}
                />
              </Field>
              <Field label={tf("coach")}>
                <select
                  className="input"
                  value={form.coach_id ?? ""}
                  onChange={(e) => set("coach_id", e.target.value || null)}
                >
                  <option value="">{tf("noCoach")}</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tf("level")} group>
                <Pills
                  value={form.level}
                  options={GROUP_LEVELS.map((l) => ({ value: l, label: t(`level.${l}`) }))}
                  onChange={(l) => set("level", l)}
                />
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-ink-900">{tf("ages")}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[13px] text-ink-600">
                    {tf("from")}
                    <input
                      type="number"
                      min={3}
                      max={99}
                      disabled={form.adults}
                      aria-label={tf("ageFrom")}
                      className="input w-[68px] px-3 disabled:opacity-40"
                      value={form.age_min ?? ""}
                      onChange={(e) => set("age_min", e.target.value ? Number(e.target.value) : null)}
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-[13px] text-ink-600">
                    {tf("to")}
                    <input
                      type="number"
                      min={3}
                      max={99}
                      disabled={form.adults}
                      aria-label={tf("ageTo")}
                      className="input w-[68px] px-3 disabled:opacity-40"
                      value={form.age_max ?? ""}
                      onChange={(e) => set("age_max", e.target.value ? Number(e.target.value) : null)}
                    />
                  </label>
                  <label className="ml-1 flex items-center gap-1.5 text-[13px] text-ink-600">
                    <input
                      type="checkbox"
                      className="size-[18px] accent-brand-600"
                      checked={form.adults}
                      onChange={(e) => set("adults", e.target.checked)}
                    />
                    {t("adults")}
                  </label>
                </div>
              </div>
            </div>
            <Field label={tf("description")}>
              <textarea
                className="input resize-none"
                rows={2}
                maxLength={1000}
                placeholder={tf("descriptionPlaceholder")}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
          </Section>

          {/* 2. When and where */}
          <Section title={tf("sections.when")}>
            {group ? (
              <p className="rounded-xl bg-ink-50 px-4 py-3 text-[13px] text-ink-600">
                {group.kind === "dropin" ? tf("kindDropinLocked") : tf("kindSeasonLocked")}
              </p>
            ) : (
              <div role="radiogroup" aria-label={tf("kind")} className="grid gap-3 sm:grid-cols-2">
                {(["season", "dropin"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={form.kind === k}
                    onClick={() => set("kind", k)}
                    className={`flex flex-col gap-1 rounded-[14px] px-4 py-3.5 text-left transition-colors ${
                      form.kind === k
                        ? "border-2 border-brand-600 bg-brand-50"
                        : "border border-ink-200 bg-white hover:border-ink-400"
                    }`}
                  >
                    <span className="text-sm font-semibold text-ink-900">{t(`kind.${k}`)}</span>
                    <span className="text-xs text-ink-600">{tf(`kindHint.${k}`)}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <span id="days-label" className="text-[13px] font-medium text-ink-900">
                {tf("days")}
              </span>
              <div role="group" aria-labelledby="days-label" className="flex flex-wrap gap-1.5">
                {ISO_DAYS.map((d) => {
                  const on = form.days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        set("days", on ? form.days.filter((x) => x !== d) : [...form.days, d].sort())
                      }
                      className={`h-11 w-[52px] rounded-xl text-[13px] transition-colors ${
                        on
                          ? "border border-ink-900 bg-ink-900 font-semibold text-white"
                          : "border border-ink-200 bg-white text-ink-600 hover:border-ink-400"
                      }`}
                    >
                      {weekdayName(d, locale)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={tf("from")}>
                <input
                  type="time"
                  step={300}
                  className="input"
                  value={form.start_time}
                  onChange={(e) => set("start_time", e.target.value)}
                />
              </Field>
              <Field label={tf("to")}>
                <input
                  type="time"
                  step={300}
                  className="input"
                  value={form.end_time}
                  onChange={(e) => set("end_time", e.target.value)}
                />
              </Field>
              <Field label={tf("court")}>
                <select
                  className="input"
                  value={form.court_id ?? ""}
                  onChange={(e) => set("court_id", e.target.value || null)}
                >
                  {courtChoices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tf("starts")}>
                <input
                  type="date"
                  className="input"
                  value={form.starts_on}
                  onChange={(e) => set("starts_on", e.target.value)}
                />
              </Field>
              <Field label={tf("ends")}>
                <input
                  type="date"
                  className="input"
                  value={form.ends_on}
                  min={form.starts_on}
                  onChange={(e) => set("ends_on", e.target.value)}
                />
              </Field>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium text-ink-900">{tf("breaks")}</span>
              <div className="flex flex-wrap gap-2">
                {form.breaks.map((b, i) => (
                  <span
                    key={`${b.from}-${i}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-ink-50 py-1.5 pl-3 pr-1.5 text-[13px] text-ink-800"
                  >
                    {[b.label, rangeText(b, locale)].filter(Boolean).join(" · ")}
                    <button
                      type="button"
                      aria-label={tf("removeBreak", { name: b.label || rangeText(b, locale) })}
                      onClick={() => set("breaks", form.breaks.filter((_, j) => j !== i))}
                      className="grid size-6 place-items-center rounded-full bg-ink-100 text-ink-600 hover:bg-ink-200"
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </span>
                ))}
                {!newBreak && (
                  <button
                    type="button"
                    onClick={() => setNewBreak({ from: form.starts_on, to: form.starts_on, label: "" })}
                    className="rounded-full border border-dashed border-ink-200 bg-white px-3 py-1.5 text-[13px] font-medium text-brand-900 hover:border-brand-600"
                  >
                    + {tf("addBreak")}
                  </button>
                )}
              </div>
              {newBreak && (
                <div className="flex flex-wrap items-end gap-2 rounded-xl bg-ink-50 p-3">
                  <Field label={tf("breakName")} small>
                    <input
                      className="input w-44 bg-white"
                      placeholder={tf("breakPlaceholder")}
                      value={newBreak.label ?? ""}
                      onChange={(e) => setNewBreak({ ...newBreak, label: e.target.value })}
                    />
                  </Field>
                  <Field label={tf("from")} small>
                    <input
                      type="date"
                      className="input bg-white"
                      value={newBreak.from}
                      onChange={(e) =>
                        setNewBreak({
                          ...newBreak,
                          from: e.target.value,
                          to: newBreak.to < e.target.value ? e.target.value : newBreak.to,
                        })
                      }
                    />
                  </Field>
                  <Field label={tf("to")} small>
                    <input
                      type="date"
                      className="input bg-white"
                      min={newBreak.from}
                      value={newBreak.to}
                      onChange={(e) => setNewBreak({ ...newBreak, to: e.target.value })}
                    />
                  </Field>
                  <button
                    type="button"
                    className="btn-primary px-4 py-2.5"
                    disabled={!newBreak.from}
                    onClick={() => {
                      set("breaks", [...form.breaks, newBreak]);
                      setNewBreak(null);
                    }}
                  >
                    {tf("addBreakConfirm")}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setNewBreak(null)}>
                    {tf("cancel")}
                  </button>
                </div>
              )}
            </div>
          </Section>

          {/* 3. Players and sign-up */}
          <Section title={tf("sections.players")}>
            <Row
              title={form.kind === "dropin" ? tf("maxPerSession") : tf("maxPlayers")}
              hint={form.kind === "dropin" ? tf("maxPerSessionHint") : tf("maxPlayersHint")}
            >
              <span className="flex items-center overflow-hidden rounded-xl border border-ink-200">
                <button
                  type="button"
                  aria-label={tf("fewer")}
                  onClick={() => set("max_players", Math.max(1, form.max_players - 1))}
                  className="grid size-10 place-items-center hover:bg-ink-50"
                >
                  <Minus size={15} aria-hidden="true" />
                </button>
                <span className="w-10 text-center font-semibold" aria-live="polite">
                  {form.max_players}
                </span>
                <button
                  type="button"
                  aria-label={tf("more")}
                  onClick={() => set("max_players", Math.min(60, form.max_players + 1))}
                  className="grid size-10 place-items-center hover:bg-ink-50"
                >
                  <Plus size={15} aria-hidden="true" />
                </button>
              </span>
            </Row>
            <Row
              title={tf("onlineSignup")}
              hint={form.kind === "dropin" ? tf("onlineSignupDropin") : tf("onlineSignupHint")}
            >
              <Switch checked={form.online_signup} onChange={(v) => set("online_signup", v)} label={tf("onlineSignup")} />
            </Row>
            {form.kind === "season" && (
              <>
                <Row
                  title={tf("coachApproves")}
                  hint={tf("coachApprovesHint", {
                    coach: coaches.find((c) => c.id === form.coach_id)?.name ?? tf("theCoach"),
                  })}
                >
                  <Switch
                    checked={form.coach_approves}
                    onChange={(v) => set("coach_approves", v)}
                    label={tf("coachApproves")}
                  />
                </Row>
                <Row title={tf("trial")} hint={tf("trialHint")} last>
                  <Switch checked={form.trial} onChange={(v) => set("trial", v)} label={tf("trial")} />
                </Row>
              </>
            )}
          </Section>

          {/* 4. Price */}
          <Section title={tf("sections.price")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={form.kind === "dropin" ? tf("pricePerSession") : tf("pricePerMonth")}>
                <Money value={priceText} onChange={setPriceText} />
              </Field>
              {form.kind === "season" && plans.length > 0 && (
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-ink-900">{tf("memberPrice")}</span>
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                    <Money value={memberPriceText} onChange={setMemberPriceText} placeholder={tf("optional")} />
                    <select
                      aria-label={tf("memberPlan")}
                      className="input min-w-0"
                      value={form.member_plan_id ?? ""}
                      onChange={(e) => set("member_plan_id", e.target.value || null)}
                    >
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-ink-600">
              {form.kind === "dropin" ? tf("payDropin") : tf("paySeason")}
            </p>
          </Section>
          <div className="flex justify-end">
            {saveButton}
          </div>
        </form>

        {/* Summary and court check */}
        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-4 lg:sticky lg:top-24">
          <section aria-labelledby="sum" className="flex flex-col gap-3.5 rounded-[20px] bg-ink-900 p-5 text-white">
            <h2 id="sum" className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-200">
              {tf("summary")}
            </h2>
            {form.days.length === 0 ? (
              <p className="text-sm text-ink-200">{tf("pickDays")}</p>
            ) : (
              <>
                <p className="text-xl font-bold leading-snug">
                  {checking && !preview
                    ? tf("checking")
                    : tf("sessionsCount", { n: sessionsKept })}
                </p>
                <p className="text-[13px] leading-relaxed text-ink-200">
                  {tf("every", {
                    days: daysText(form.days, locale, "long"),
                    from: form.start_time,
                    to: form.end_time,
                    court: courtName,
                  })}
                  <br />
                  {rangeText({ from: form.starts_on, to: form.ends_on }, locale)}
                  {form.breaks.length > 0 && ` · ${tf("withoutBreaks", { n: form.breaks.length })}`}
                </p>
              </>
            )}
            <div className="flex flex-wrap gap-2">
              <Chip>{tf("upTo", { n: form.max_players })}</Chip>
              {priceText !== "" && (
                <Chip>
                  {form.kind === "dropin"
                    ? t("perSession", { price: money(Number(priceText.replace(",", ".")) || 0) })
                    : t("perMonth", { price: money(Number(priceText.replace(",", ".")) || 0) })}
                </Chip>
              )}
              {form.kind === "season" && form.trial && <Chip>{tf("freeTrial")}</Chip>}
            </div>
          </section>

          {preview && sessions > 0 && (
            <section
              aria-labelledby="clash"
              aria-live="polite"
              className={`flex flex-col gap-3 rounded-[20px] border bg-white p-[18px] ${
                clashes.length ? "border-amber-200" : "border-brand-200"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={`grid size-[30px] place-items-center rounded-full ${
                    clashes.length ? "bg-amber-50 text-amber-800" : "bg-brand-50 text-brand-800"
                  }`}
                >
                  {clashes.length ? <AlertTriangle size={16} /> : <Check size={16} />}
                </span>
                <h2 id="clash" className="text-[15px] font-bold text-ink-900">
                  {clashes.length
                    ? tf("freeFor", { n: sessions - clashes.length, total: sessions })
                    : tf("allFree", { court: courtName })}
                </h2>
              </div>
              {clashes.slice(0, 8).map((r) => (
                <div key={r.day} className="flex flex-col gap-2 rounded-[14px] bg-ink-50 p-3">
                  <span className="text-[13px] text-ink-800">
                    <span className="font-semibold">
                      {clubFormat(r.starts_at, locale, { weekday: "short", day: "numeric", month: "short" })}
                    </span>{" "}
                    · {clashText(r, tf)}
                  </span>
                  {r.clash !== "court" ? (
                    <span className="w-fit rounded-full bg-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-600">
                      {tf("skipped")}
                    </span>
                  ) : (
                  <div role="radiogroup" aria-label={r.day} className="flex flex-wrap gap-1.5">
                    {r.free_court_id && (
                      <ChoiceButton
                        on={choices[r.day] === r.free_court_id}
                        onClick={() => setChoices((c) => ({ ...c, [r.day]: r.free_court_id! }))}
                      >
                        {tf("useCourt", { court: r.free_court_name ?? "" })}
                      </ChoiceButton>
                    )}
                    <ChoiceButton
                      on={!choices[r.day]}
                      onClick={() =>
                        setChoices((c) => {
                          const next = { ...c };
                          delete next[r.day];
                          return next;
                        })
                      }
                    >
                      {tf("skipDay")}
                    </ChoiceButton>
                  </div>
                  )}
                </div>
              ))}
              {clashes.length > 8 && (
                <p className="text-xs text-ink-600">{tf("moreClashes", { n: clashes.length - 8 })}</p>
              )}
              <p className="text-xs text-ink-600">{tf("neverMoved")}</p>
            </section>
          )}
          {preview && sessions === 0 && form.days.length > 0 && (
            <p className="rounded-[20px] border border-ink-100 bg-white p-4 text-sm text-ink-600">{tf("noSessions")}</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function rangeText(b: { from: string; to: string }, locale: string) {
  const f = (d: string) => clubFormat(noon(d), locale, { day: "numeric", month: "short", year: "numeric" });
  return b.from === b.to ? f(b.from) : `${f(b.from)} – ${f(b.to)}`;
}

function clashText(r: PreviewRow, tf: ReturnType<typeof useTranslations>) {
  if (r.clash === "closed") return tf("clashClosed");
  const time =
    r.clash_starts && r.clash_ends
      ? `${clubFormat(r.clash_starts, "en", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}–${clubFormat(r.clash_ends, "en", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}`
      : "";
  return r.clash === "coach"
    ? tf("clashCoach", { who: r.clash_who ?? "", time })
    : tf("clashCourt", { who: r.clash_who ?? "", time });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-4 rounded-[20px] border border-ink-100 bg-white px-5 py-5 sm:px-6">
      <legend className="px-1.5 text-[13px] font-bold uppercase tracking-[0.06em] text-ink-600">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  children,
  small,
  group,
}: {
  label: string;
  children: React.ReactNode;
  small?: boolean;
  /** Buttons rather than one input: a named group, not a label. */
  group?: boolean;
}) {
  const className = `flex min-w-0 flex-col gap-1.5 font-medium text-ink-900 ${small ? "text-xs" : "text-[13px]"}`;
  if (group) {
    return (
      <div role="group" aria-label={label} className={className}>
        <span aria-hidden="true">{label}</span>
        {children}
      </div>
    );
  }
  return (
    <label className={className}>
      {label}
      {children}
    </label>
  );
}

function Row({
  title,
  hint,
  children,
  last,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 py-1 ${last ? "" : "border-b border-ink-50 pb-4"}`}>
      <span>
        <span className="block text-sm font-medium text-ink-900">{title}</span>
        <span className="text-xs text-ink-600">{hint}</span>
      </span>
      {children}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-[46px] shrink-0 rounded-full transition-colors ${checked ? "bg-brand-600" : "bg-ink-200"}`}
    >
      <span
        className={`absolute top-[3px] size-[22px] rounded-full bg-white shadow-sm transition-all ${
          checked ? "left-[21px]" : "left-[3px]"
        }`}
      />
    </button>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" className="flex gap-1.5 rounded-xl bg-ink-50 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-[9px] px-2 py-2 text-[13px] transition-colors ${
            value === o.value ? "bg-white font-semibold text-ink-900 shadow-sm" : "text-ink-600 hover:text-ink-900"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Pills<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full border px-3 py-2 text-[13px] transition-colors ${
            value === o.value
              ? "border-ink-900 bg-ink-900 font-semibold text-white"
              : "border-ink-200 bg-white text-ink-600 hover:border-ink-400"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Money({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <span className="flex items-center rounded-xl border border-ink-200 bg-white px-3.5 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400">
      <span className="text-ink-400" aria-hidden="true">
        €
      </span>
      <input
        inputMode="decimal"
        className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2.5 text-sm outline-none"
        value={value}
        placeholder={placeholder ?? "0"}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
      />
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs">{children}</span>;
}

function ChoiceButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1.5 text-xs transition-colors ${
        on ? "border-ink-900 bg-ink-900 font-semibold text-white" : "border-ink-200 bg-white text-ink-600"
      }`}
    >
      {children}
    </button>
  );
}

