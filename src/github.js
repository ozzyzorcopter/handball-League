// ── GITHUB DISPATCH ──────────────────────────────────────────────────────────
// To enable archive-from-app, set GITHUB_PAT and GITHUB_REPO in your repo's
// GitHub secrets, then expose them via a small env inject or hardcode here.
// The PAT needs: repo scope (to trigger workflow_dispatch / repo_dispatch).
export const GITHUB_REPO = "ozzyzorcopter/handball-League";
export const GITHUB_PAT_KEY = "LEAGUESIM_PAT"; // name of the secret exposed to the page

export async function githubDispatch(eventType, payload) {
  // The PAT must be injected into the page. Options:
  // 1. Store in localStorage (user pastes it once in Settings)
  // 2. Hardcode (not safe for public repos)
  // We use localStorage so it's never in the source.
  const pat = localStorage.getItem(GITHUB_PAT_KEY);
  if (!pat) throw new Error("No GitHub PAT configured. Go to Settings → GitHub PAT to add it.");

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${pat}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ event_type: eventType, client_payload: payload }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${body}`);
  }
}
