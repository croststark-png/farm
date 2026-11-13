const API = "https://api.hydralauncher.gg";
const UA = "Hydra Launcher v3.0.0";

const refreshToken = process.env.HYDRA_REFRESH_TOKEN;
const titleQuery = (process.env.GAME_TITLE || "").toLowerCase().trim();
const secondsPerRun = Number(process.env.SECONDS_PER_RUN || "600");

function fail(msg) {
  console.error("ERROR: " + msg);
  process.exit(1);
}

async function call(path, { method = "GET", body, token } = {}) {
  const headers = { "User-Agent": UA, "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  if (!refreshToken) fail("Falta el secret HYDRA_REFRESH_TOKEN");
  if (!titleQuery) fail("Falta la variable HYDRA_GAME_TITLE");

  const auth = await call("/auth/refresh", {
    method: "POST",
    body: { refreshToken },
  });

  const games = await call("/profile/games?take=100", { token: auth.accessToken });
  const matches = games.filter((g) => (g.title || "").toLowerCase().includes(titleQuery));

  if (matches.length !== 1) {
    console.log("Juegos en tu perfil:");
    games.forEach((g) => console.log(` - ${g.title}  (${g.shop}:${g.objectId})`));
    fail(`Coincidencias con "${titleQuery}": ${matches.length}. Ajustá HYDRA_GAME_TITLE.`);
  }

  const game = matches[0];
  const perPlatform = game.runtimeByPlatform;
  const current = Math.max(
    0,
    Math.floor(
      typeof perPlatform?.hydra === "number"
        ? perPlatform.hydra
        : perPlatform
          ? 0
          : game.playTimeInSeconds ?? (game.playTimeInMilliseconds ?? 0) / 1000
    )
  );
  const next = current + secondsPerRun;

  await call(
    `/profile/games/${game.shop}/${encodeURIComponent(game.objectId)}/playtime`,
    { method: "PUT", token: auth.accessToken, body: { playTimeInSeconds: next } }
  );

  console.log(`${game.title}: ${(current / 3600).toFixed(2)}h -> ${(next / 3600).toFixed(2)}h`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
