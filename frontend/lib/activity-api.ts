import { request } from "./api";

export type ContributionCalendar = { start: string; end: string; days: Record<string, number> };

export async function getActivity(signal: AbortSignal): Promise<ContributionCalendar> {
  return (await request("/activity", { signal })).json();
}
