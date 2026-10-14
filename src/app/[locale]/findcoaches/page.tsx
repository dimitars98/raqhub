import Navbar from "@/components/layout/Navbar";
import CoachDirectory from "@/components/coaches/CoachDirectory";

// The coach list for visitors without an account.
export default async function FindCoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const { level = "all" } = await searchParams;
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-10 lg:py-14">
        <CoachDirectory level={level} basePath="/findcoaches" roomy />
      </main>
    </>
  );
}
