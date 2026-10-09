import { assertNativeSecurityEnvironment } from './native-security.js';
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

function databaseIdentity(value) {
  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.pathname.slice(1)) return null;
    return {
      host: url.hostname.toLowerCase(),
      port: url.port || "5432",
      database: decodeURIComponent(url.pathname.slice(1)).toLowerCase()
    };
  } catch {
    return null;
  }
}

export function resolveDatabaseUrl(env = process.env) {
  assertNativeSecurityEnvironment(env);
  if (env.NODE_ENV === "production") return env.DATABASE_URL;
  const devUrl = env.DEV_DATABASE_URL;
  if (!devUrl) throw new Error("Local development database is not configured");
  const dev = databaseIdentity(devUrl);
  const configuredProduction = env.DATABASE_URL ? databaseIdentity(env.DATABASE_URL) : null;
  if (!dev || !localHosts.has(dev.host) || !/(?:^|[_-])(dev|development|test)(?:$|[_-])/.test(dev.database) ||
      (env.DATABASE_URL && !configuredProduction) ||
      (configuredProduction && dev.host === configuredProduction.host && dev.port === configuredProduction.port && dev.database === configuredProduction.database)) {
    throw new Error("Development database isolation cannot be confirmed");
  }
  return devUrl;
}

export function assertDevelopmentDatabase(env = process.env) {
  if (env.NODE_ENV === "production") throw new Error("Emotion Lab writes are disabled in production");
  return resolveDatabaseUrl(env);
}
