import { notFound } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/server";
import BookingForm from "@/components/booking/BookingForm";
import type { Court } from "@/types/database";

type CourtWithClub = Court & {
  club?: {
    name: string;
    city: string | null;
    address: string | null;
    phone: string | null;
  } | null;
};

const SURFACE_LABEL: Record<string, string> = {
  clay: "Clay",
  hard: "Hard",
  grass: "Grass",
  artificial_grass: "Artificial grass",
  carpet: "Carpet",
};

export default async function CourtPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const { data } = await supabase
    .from("courts")
    .select("*, club:clubs(name, city, address, phone)")
    .eq("id", id)
    .single();

  const court = data as CourtWithClub | null;
  if (!court) notFound();

  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              {SURFACE_LABEL[court.surface]}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
              {court.is_indoor ? "Indoor" : "Outdoor"}
            </span>
          </div>
          <h1 className="text-2xl font-medium text-orange-900">{court.name}</h1>
          <p className="text-sm text-orange-600 mt-1">
            {court.club?.name}
            {court.club?.city ? ` · ${court.club.city}` : ""}
          </p>
          {court.description && (
            <p className="text-sm text-orange-700 mt-3">{court.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div className="card p-5 h-fit">
            <h2 className="text-sm font-medium text-orange-900 mb-4">
              Details
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-orange-500">Price</dt>
                <dd className="font-medium text-orange-900">
                  €{court.price_per_hour} / hour
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-orange-500">Surface</dt>
                <dd className="text-orange-900">
                  {SURFACE_LABEL[court.surface]}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-orange-500">Type</dt>
                <dd className="text-orange-900">
                  {court.is_indoor ? "Indoor" : "Outdoor"}
                </dd>
              </div>
              {court.club?.address && (
                <div className="flex justify-between">
                  <dt className="text-orange-500">Address</dt>
                  <dd className="text-orange-900 text-right max-w-[160px]">
                    {court.club.address}
                  </dd>
                </div>
              )}
              {court.club?.phone && (
                <div className="flex justify-between">
                  <dt className="text-orange-500">Phone</dt>
                  <dd className="text-orange-900">{court.club.phone}</dd>
                </div>
              )}
            </dl>
          </div>
          <BookingForm
            courtId={court.id}
            pricePerHour={court.price_per_hour}
            courtName={court.name}
          />
        </div>
      </main>
    </>
  );
}
