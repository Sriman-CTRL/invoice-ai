/** Password rules shared by sign-up and change-password. Returns an error message, or null when acceptable. */
const COMMON = [
  "password", "passw0rd", "qwerty", "letmein", "welcome", "admin", "iloveyou", "abc123", "1q2w3e", "monkey", "dragon",
  "football", "login", "master", "sunshine", "princess", "changeme", "ledgerlane", "invoice",
];

export function passwordProblem(password: unknown, email?: string, minLength = 10): string | null {
  if (typeof password !== "string") return "Password is required";
  if (password.length < minLength || password.length > 72) return `Password must be ${minLength}-72 characters`;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return "Password must include at least one letter and one number";
  const lower = password.toLowerCase();
  if (COMMON.some((w) => lower.includes(w))) return "That password contains a very common word. Please choose something less guessable";
  if (/(.)\1{3,}/.test(password)) return "Avoid repeating the same character many times";
  if (/(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|asdf|zxcv)/i.test(password)) return "Avoid simple sequences like 1234 or abcd";
  const local = (email || "").split("@")[0].toLowerCase();
  if (local.length >= 4 && lower.includes(local)) return "Password must not contain your email name";
  return null;
}
