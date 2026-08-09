export function isOwner(email: string): boolean {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) return false;
  return email.trim().toLowerCase() === ownerEmail.trim().toLowerCase();
}