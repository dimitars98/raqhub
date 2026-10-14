import CoachDirectory from "@/components/coaches/CoachDirectory";

export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const { level = "all" } = await searchParams;
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <CoachDirectory level={level} basePath="/coaches" />
    </main>
  );
}
