/** The test-user sign-in bypass; only ever on in the dev server. */
export function devLoginEnabled() {
  return process.env.NODE_ENV === "development" && process.env.DEV_LOGIN === "true";
}

export const DEV_USERS = [
  { name: "Alice Dev", email: "alice@dev.local" },
  { name: "Bob Dev", email: "bob@dev.local" },
  { name: "Carol Dev", email: "carol@dev.local" },
];
