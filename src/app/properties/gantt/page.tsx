import { redirect } from "next/navigation";

/** The Gantt moved to /properties itself (now the default view — see
 *  /properties/page.tsx). This route stays only so any existing bookmark/
 *  link to /properties/gantt still lands somewhere sensible. */
export default async function PropertyGanttRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  redirect(tab ? `/properties?tab=${tab}` : "/properties");
}
